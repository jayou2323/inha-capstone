import { openSync, I2cBus } from 'i2c-bus';
import type { PN532Config } from '../types/index.js';

/**
 * PN532 NFC 칩 제어 서비스
 * I2C 통신을 통해 PN532와 통신하고 카드 에뮬레이션 모드 제어
 */
export class PN532Service {
  private i2cBus: I2cBus | null = null;
  private config: PN532Config;
  private isInitialized = false;

  // PN532 명령 코드
  private static readonly CMD_GET_FIRMWARE_VERSION = 0x02;
  private static readonly CMD_SAM_CONFIGURATION = 0x14;
  private static readonly CMD_TG_INIT_AS_TARGET = 0x8c;
  private static readonly CMD_TG_GET_DATA = 0x86;
  private static readonly CMD_TG_SET_DATA = 0x8e;

  // PN532 프레임 상수
  private static readonly PREAMBLE = 0x00;
  private static readonly START_CODE1 = 0x00;
  private static readonly START_CODE2 = 0xff;
  private static readonly POSTAMBLE = 0x00;
  private static readonly HOST_TO_PN532 = 0xd4;
  private static readonly PN532_TO_HOST = 0xd5;
  private static readonly ACK_FRAME = Buffer.from([0x00, 0x00, 0xff, 0x00, 0xff, 0x00]);

  constructor(config: PN532Config) {
    this.config = config;
  }

  /**
   * PN532 초기화
   */
  async initialize(): Promise<boolean> {
    try {
      console.log('[PN532] Initializing...');

      // I2C 버스 오픈
      this.i2cBus = openSync(this.config.i2cBus);

      // Wakeup 시퀀스 (선택적): 더미 데이터 전송으로 슬립 해제 시도
      // 일부 모듈은 필요할 수 있음. 여기서는 리셋 커맨드를 보내는 대신 펌웨어 버전 확인으로 대체.
      
      // 펌웨어 버전 확인 (통신 테스트)
      const version = await this.getFirmwareVersion();
      if (!version) {
        throw new Error('Failed to get firmware version');
      }

      console.log(`[PN532] Firmware version: ${version}`);

      // SAM(Security Access Module) 설정: Normal mode
      await this.configureSAM();

      this.isInitialized = true;
      console.log('[PN532] Initialized successfully');
      return true;
    } catch (error) {
      console.error('[PN532] Initialization failed:', error);
      this.close();
      return false;
    }
  }

  /**
   * 펌웨어 버전 확인
   */
  private async getFirmwareVersion(): Promise<string | null> {
    try {
      const response = await this.sendCommand(
        Buffer.from([PN532Service.CMD_GET_FIRMWARE_VERSION]),
        this.config.readyTimeoutMs
      );

      if (!response || response.length < 4) {
        return null;
      }

      const ic = response[0];
      const ver = response[1];
      const rev = response[2];
      const support = response[3];

      return `IC: ${ic}, Ver: ${ver}, Rev: ${rev}, Support: ${support}`;
    } catch (error) {
      console.error('[PN532] Failed to get firmware version:', error);
      return null;
    }
  }

  /**
   * SAM 설정
   */
  private async configureSAM(): Promise<boolean> {
    try {
      // Mode: 0x01 (Normal mode)
      // Timeout: 0x14 (20 * 50ms = 1 second)
      // IRQ: 0x01 (Use IRQ pin - but we use polling via I2C)
      // 실제로는 I2C 폴링을 하므로 IRQ 핀을 안 쓸 수도 있지만, 일반적인 설정값 사용
      const response = await this.sendCommand(
        Buffer.from([PN532Service.CMD_SAM_CONFIGURATION, 0x01, 0x14, 0x01]),
        this.config.readyTimeoutMs
      );

      return response !== null;
    } catch (error) {
      console.error('[PN532] SAM configuration failed:', error);
      return false;
    }
  }

  /**
   * 카드 에뮬레이션 모드로 초기화
   */
  async initAsTarget(ndefMessage: Buffer): Promise<boolean> {
    try {
      if (!this.isInitialized) {
        throw new Error('PN532 not initialized');
      }

      console.log('[PN532] Initializing as target (card emulation mode)...');

      // TgInitAsTarget 파라미터
      const mode = 0x00; // PICC only
      const sensRes = Buffer.from([0x04, 0x00]); // SENS_RES (ATQA)
      const nfcid1t = Buffer.from([0x12, 0x34, 0x56, 0x78]); // NFCID1t (UID)
      const selRes = 0x20; // SEL_RES (SAK)
      const felicaParams = Buffer.alloc(18, 0);
      const nfcid3t = Buffer.alloc(10, 0);

      // 명령 생성
      const command = Buffer.concat([
        Buffer.from([PN532Service.CMD_TG_INIT_AS_TARGET, mode]),
        sensRes,
        nfcid1t,
        Buffer.from([selRes]),
        felicaParams,
        nfcid3t,
        Buffer.from([ndefMessage.length]),
        ndefMessage,
        Buffer.from([0]), // Historical bytes length
        Buffer.alloc(0),  // Historical bytes
      ]);

      const response = await this.sendCommand(command, this.config.readyTimeoutMs);

      if (!response) {
        console.error('[PN532] Failed to initialize as target');
        return false;
      }

      console.log('[PN532] Target mode initialized, waiting for tag...');
      return true;
    } catch (error) {
      console.error('[PN532] Init as target failed:', error);
      return false;
    }
  }

  /**
   * 태깅 이벤트 대기 (Polling)
   */
  async waitForTag(timeoutMs: number): Promise<boolean> {
    try {
      console.log(`[PN532] Waiting for tag (timeout: ${timeoutMs}ms)...`);
      const startTime = Date.now();

      while (Date.now() - startTime < timeoutMs) {
        // TgGetData로 데이터 수신 대기 (상태 확인)
        // 주의: TgInitAsTarget이 성공하면 이미 타겟 모드에 진입한 상태일 수 있음
        // 여기서는 예시로 TgGetData를 보내지만, 실제로는 인터럽트나 상태 체크가 필요할 수 있음
        
        // 간단한 구현을 위해 TgGetData 시도
        const response = await this.sendCommand(
          Buffer.from([PN532Service.CMD_TG_GET_DATA]),
          1000
        );

        if (response && response.length > 0 && response[0] === 0x00) { // Status OK
           console.log('[PN532] Tag detected and data exchanged');
           return true;
        }

        await this.delay(200);
      }

      console.log('[PN532] Tag timeout');
      return false;
    } catch (error) {
      // 타임아웃이나 에러 발생 시
      return false;
    }
  }

  /**
   * 명령 전송 및 응답 수신 (ACK 처리 포함)
   */
  private async sendCommand(
    command: Buffer,
    timeoutMs: number = 1000
  ): Promise<Buffer | null> {
    if (!this.i2cBus) throw new Error('I2C bus not opened');

    try {
      // 1. 프레임 전송
      const frame = this.buildFrame(command);
      await this.i2cWrite(frame);

      // 2. ACK 대기
      const ack = await this.waitForAck(100); // ACK는 보통 금방 옴
      if (!ack) {
        console.warn('[PN532] No ACK received');
        return null;
      }

      // 3. 실제 응답 대기
      const response = await this.waitForResponse(timeoutMs);
      return response;

    } catch (error) {
      console.error('[PN532] Send command error:', error);
      return null;
    }
  }

  /**
   * ACK 프레임 대기
   */
  private async waitForAck(timeoutMs: number): Promise<boolean> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      if (await this.isReady()) {
        const data = await this.readData();
        if (data && this.isAckFrame(data)) {
          return true;
        }
      }
      await this.delay(10);
    }
    return false;
  }

  /**
   * 응답 데이터 대기
   */
  private async waitForResponse(timeoutMs: number): Promise<Buffer | null> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      if (await this.isReady()) {
        const data = await this.readData();
        if (data && !this.isAckFrame(data)) {
          // 응답 프레임 파싱
          return this.parseFrame(data);
        }
      }
      await this.delay(10);
    }
    return null;
  }

  /**
   * I2C Read (Raw Data)
   * PN532는 읽기 시 첫 바이트에 Status Byte를 붙여서 보냄
   */
  private async readData(): Promise<Buffer | null> {
    if (!this.i2cBus) return null;

    return new Promise((resolve) => {
      // 넉넉하게 읽음 (최대 255바이트)
      const buffer = Buffer.alloc(255);
      this.i2cBus!.i2cRead(this.config.i2cAddress, buffer.length, buffer, (err, bytesRead, resBuf) => {
        if (err || bytesRead === 0) {
          resolve(null);
        } else {
          // 유효한 데이터만 잘라서 반환
          resolve(resBuf.slice(0, bytesRead));
        }
      });
    });
  }

  /**
   * PN532 프레임 생성
   */
  private buildFrame(data: Buffer): Buffer {
    const frameData = Buffer.concat([
      Buffer.from([PN532Service.HOST_TO_PN532]), // TFI (Host to PN532)
      data
    ]);

    const length = frameData.length;
    const lengthChecksum = (~length + 1) & 0xff;
    
    const dataChecksum = (~frameData.reduce((sum, byte) => sum + byte, 0) + 1) & 0xff;

    return Buffer.concat([
      Buffer.from([
        PN532Service.PREAMBLE,
        PN532Service.START_CODE1,
        PN532Service.START_CODE2,
        length,
        lengthChecksum,
      ]),
      frameData,
      Buffer.from([dataChecksum, PN532Service.POSTAMBLE]),
    ]);
  }

  /**
   * 프레임 파싱
   */
  private parseFrame(buffer: Buffer): Buffer | null {
    // 1. Preamble (0x00) 찾기 (I2C Status Byte 때문에 오프셋이 있을 수 있음)
    let offset = 0;
    while (offset < buffer.length - 1) {
      if (buffer[offset] === 0x00 && buffer[offset + 1] === 0xff) {
        // Start Code 0x00 0xFF를 찾음 (Preamble은 그 앞)
        // 표준 프레임: [00] 00 FF ...
        if (offset > 0 && buffer[offset-1] === 0x00) {
          offset--; // Preamble 위치로
          break;
        }
      }
      offset++;
    }

    if (offset >= buffer.length - 5) return null; // 너무 짧음

    const frame = buffer.slice(offset);

    // 기본 검증
    if (frame[0] !== PN532Service.PREAMBLE || 
        frame[1] !== PN532Service.START_CODE1 || 
        frame[2] !== PN532Service.START_CODE2) {
      return null;
    }

    const length = frame[3];
    const lengthChecksum = frame[4];

    if (((length + lengthChecksum) & 0xff) !== 0) {
      console.error('[PN532] Length checksum error');
      return null;
    }

    // TFI + Data
    const data = frame.slice(5, 5 + length);
    const dataChecksum = frame[5 + length];

    const calculatedChecksum = (~data.reduce((sum, byte) => sum + byte, 0) + 1) & 0xff;
    if (calculatedChecksum !== dataChecksum) {
       console.error('[PN532] Data checksum error');
       return null;
    }

    // TFI 확인 (PN532 -> Host)
    if (data[0] !== PN532Service.PN532_TO_HOST) {
       // 에러 프레임일 수도 있음
       return null;
    }

    // 실제 데이터 반환 (TFI 제외)
    return data.slice(1);
  }

  private isAckFrame(buffer: Buffer): boolean {
    // ACK: 00 00 FF 00 FF 00
    // 버퍼 안에 ACK 시퀀스가 있는지 확인
    const hex = buffer.toString('hex');
    return hex.includes('0000ff00ff00');
  }

  /**
   * Ready 상태 확인 (Status Byte 읽기)
   */
  private async isReady(): Promise<boolean> {
    if (!this.i2cBus) return false;

    return new Promise((resolve) => {
      const buffer = Buffer.alloc(1);
      this.i2cBus!.i2cRead(this.config.i2cAddress, 1, buffer, (err) => {
        if (err) resolve(false);
        else resolve((buffer[0] & 0x01) === 0x01);
      });
    });
  }

  private async i2cWrite(data: Buffer): Promise<void> {
    if (!this.i2cBus) throw new Error('I2C bus not opened');
    return new Promise((resolve, reject) => {
      this.i2cBus!.i2cWrite(this.config.i2cAddress, data.length, data, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  close(): void {
    try {
      if (this.i2cBus) {
        this.i2cBus.closeSync();
        this.i2cBus = null;
      }
      this.isInitialized = false;
      console.log('[PN532] Closed');
    } catch (error) {
      console.error('[PN532] Close error:', error);
    }
  }

  async reinitialize(): Promise<boolean> {
    console.log('[PN532] Reinitializing...');
    this.close();
    await this.delay(1000);
    return await this.initialize();
  }
}

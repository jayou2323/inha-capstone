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
  
  // ACK 읽고 남은 데이터 보관용 버퍼
  private remainingBuffer: Buffer = Buffer.alloc(0);

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
  
  // ACK 패턴: 00 00 FF 00 FF 00
  // I2C는 앞에 Status(01)이 붙는 경우가 많음. 여기서는 raw sequence만 정의
  private static readonly ACK_SEQ = Buffer.from([0x00, 0x00, 0xff, 0x00, 0xff, 0x00]);

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
      if (!this.i2cBus) {
        this.i2cBus = openSync(this.config.i2cBus);
      }

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
      // IRQ: 0x01 (Use IRQ pin)
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
  async initAsTarget(ndefMessage: Buffer, timeoutMs: number = 0): Promise<boolean> {
    try {
      if (!this.isInitialized) {
        throw new Error('PN532 not initialized');
      }

      console.log('[PN532] Initializing as target (card emulation mode)...');

      // TgInitAsTarget (0x8C) 파라미터 구성
      // NDEF 메시지 길이에 따른 주의: PN532 내부 버퍼 제한이나 I2C 타이밍 이슈가 있을 수 있음.
      // 너무 긴 메시지는 처음에 실패할 수 있으므로, 테스트 단계에서는 짧게 줄여볼 수 있음.

      const mode = 0x00;
      const sensRes = Buffer.from([0x04, 0x00]);
      const nfcid1t = Buffer.from([0x12, 0x34, 0x56]); // 3 bytes for Mifare Params
      const selRes = 0x20; 
      const felicaParams = Buffer.alloc(18, 0);
      const nfcid3t = Buffer.alloc(10, 0);
      const historicalBytes = Buffer.alloc(0);

      const command = Buffer.concat([
        Buffer.from([PN532Service.CMD_TG_INIT_AS_TARGET, mode]),
        sensRes,
        nfcid1t,
        Buffer.from([selRes]),
        felicaParams,
        nfcid3t,
        Buffer.from([ndefMessage.length]),
        ndefMessage,
        Buffer.from([historicalBytes.length]),
        historicalBytes,
      ]);
      
      console.log(`[PN532] Sending TgInitAsTarget command (${command.length} bytes)`);

      // 타임아웃
      const actualTimeout = timeoutMs > 0 ? timeoutMs : this.config.readyTimeoutMs;
      
      const response = await this.sendCommand(command, actualTimeout);

      if (!response) {
        console.error('[PN532] Failed to initialize as target (No response or timeout)');
        return false;
      }
      
      console.log(`[PN532] TgInitAsTarget response: ${response.toString('hex')}`);
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
        const response = await this.sendCommand(
          Buffer.from([PN532Service.CMD_TG_GET_DATA]),
          1000
        );

        if (response && response.length > 0 && response[0] === 0x00) {
           console.log('[PN532] Tag detected and data exchanged');
           return true;
        }
        await this.delay(200);
      }

      console.log('[PN532] Tag timeout');
      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * 명령 전송 및 응답 수신
   */
  private async sendCommand(
    command: Buffer,
    timeoutMs: number = 1000
  ): Promise<Buffer | null> {
    if (!this.i2cBus) throw new Error('I2C bus not opened');

    try {
      // 0. 잔여 버퍼 및 PN532 입력 버퍼 비우기 (Flush)
      // 이전 명령의 쓰레기 응답이나 아직 읽지 않은 데이터가 있다면 제거
      this.remainingBuffer = Buffer.alloc(0);
      await this.flushInputBuffer();

      // 1. 명령 전송
      await this.delay(20); // 안정성 딜레이

      const frame = this.buildFrame(command);
      console.log(`[PN532-DEBUG] TX >> ${frame.toString('hex')}`);
      await this.i2cWrite(frame);

      // 2. ACK 대기
      const ack = await this.waitForAck(100);
      if (!ack) {
        console.warn('[PN532] No ACK received');
        return null;
      }

      // 3. 실제 응답 대기
      // waitForAck에서 remainingBuffer에 데이터가 들어갔을 수 있음
      const response = await this.waitForResponse(timeoutMs);
      return response;

    } catch (error) {
      console.error('[PN532] Send command error:', error);
      return null;
    }
  }

  /**
   * 입력 버퍼 비우기 (Flush)
   * PN532가 보낼 데이터가 없을 때까지 읽어냄
   */
  private async flushInputBuffer(): Promise<void> {
    try {
       // 최대 3번 시도해서 데이터가 있으면 읽어서 버림
       for (let i = 0; i < 3; i++) {
         if (await this.isReady()) {
            const garbage = await this.readData();
            if (garbage && garbage.length > 0) {
              console.log(`[PN532-DEBUG] Flushed garbage: ${garbage.toString('hex')}`);
            }
         } else {
           break;
         }
         await this.delay(10);
       }
    } catch (e) {
      // Ignore errors during flush
    }
  }

  private async waitForAck(timeoutMs: number): Promise<boolean> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      if (await this.isReady()) {
        const data = await this.readData();
        if (data) {
           console.log(`[PN532-DEBUG] ACK Check << ${data.toString('hex')}`);
           
           // ACK 찾기
           const ackIndex = data.indexOf(PN532Service.ACK_SEQ);
           if (ackIndex !== -1) {
             // ACK 발견
             // ACK 시퀀스(6바이트) 뒤에 데이터가 더 있다면 remainingBuffer에 저장
             const endOfAck = ackIndex + PN532Service.ACK_SEQ.length;
             if (endOfAck < data.length) {
               this.remainingBuffer = data.slice(endOfAck);
               console.log(`[PN532-DEBUG] Saved remaining buffer: ${this.remainingBuffer.toString('hex')}`);
             }
             return true;
           }
        }
      }
      await this.delay(10);
    }
    return false;
  }

  private async waitForResponse(timeoutMs: number): Promise<Buffer | null> {
    const startTime = Date.now();
    
    // 1. 이미 읽어둔 데이터가 있는지 확인
    if (this.remainingBuffer.length > 0) {
      console.log(`[PN532-DEBUG] Processing from remaining buffer: ${this.remainingBuffer.toString('hex')}`);
      const result = this.parseFrame(this.remainingBuffer);
      if (result) {
        this.remainingBuffer = Buffer.alloc(0); // 사용 완료
        return result;
      }
      // 파싱 실패 시 버퍼에 데이터가 부족한 것일 수 있으니 계속 진행
      // (단, 현재 구조상 조각난 프레임 처리는 복잡하므로, 
      //  단순하게 남은 버퍼는 이번 턴에서 소진된 것으로 처리하고 새로 읽음)
      //  실제로는 append 해야하지만, 보통은 한 번에 다 옴.
      //  여기서는 remainingBuffer + 새로 읽은 데이터를 합치는 로직으로 가겠음.
    }

    while (Date.now() - startTime < timeoutMs) {
      if (await this.isReady()) {
        const newData = await this.readData();
        if (newData) {
           console.log(`[PN532-DEBUG] RX << ${newData.toString('hex')}`);
           
           // 기존 버퍼와 합침
           this.remainingBuffer = Buffer.concat([this.remainingBuffer, newData]);
           
           // ACK 프레임이 또 들어오면 무시 (가끔 재전송 등으로 들어옴)
           if (this.isAckFrame(this.remainingBuffer)) {
             // ACK만 있으면 비우고 계속 대기, 데이터 섞여있으면 ACK 제거 후 처리 등 필요하나
             // 여기서는 단순하게 ACK가 아닌지 체크
             // -> isAckFrame은 "포함" 여부만 보므로, ACK가 포함되어 있어도 뒤에 데이터가 있을 수 있음.
             // 복잡해지므로 parseFrame에게 맡김 (parseFrame은 Preamble+StartCode 찾음)
           }

           const result = this.parseFrame(this.remainingBuffer);
           if (result) {
             this.remainingBuffer = Buffer.alloc(0); // 성공 시 비움
             return result;
           }
        }
      }
      await this.delay(10);
    }
    console.warn('[PN532] Response timeout');
    return null;
  }

  private async readData(): Promise<Buffer | null> {
    if (!this.i2cBus) return null;
    return new Promise((resolve) => {
      const buffer = Buffer.alloc(255);
      this.i2cBus!.i2cRead(this.config.i2cAddress, buffer.length, buffer, (err, bytesRead, resBuf) => {
        if (err || bytesRead === 0) resolve(null);
        else resolve(resBuf.slice(0, bytesRead));
      });
    });
  }

  private buildFrame(data: Buffer): Buffer {
    const frameData = Buffer.concat([
      Buffer.from([PN532Service.HOST_TO_PN532]),
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

  private parseFrame(buffer: Buffer): Buffer | null {
    let offset = 0;
    // Find Preamble (00) followed by Start Code (00 FF)
    // Scan for 00 00 FF pattern
    while (offset < buffer.length - 2) {
      if (buffer[offset] === 0x00 && buffer[offset + 1] === 0x00 && buffer[offset + 2] === 0xff) {
        break;
      }
      offset++;
    }

    if (offset >= buffer.length - 2) return null; // 헤더 못 찾음

    const frame = buffer.slice(offset);
    if (frame.length < 7) return null; // 너무 짧음 (헤더3 +  len2 + TFI1 + chk2 = 8 최소?)
    // 최소 구조: 00 00 FF LEN LCS TFI ... DCS 00
    // 최소 6 + 데이터길이

    // frame[0]=00, frame[1]=00, frame[2]=FF
    const length = frame[3];
    const lengthChecksum = frame[4];

    if (((length + lengthChecksum) & 0xff) !== 0) return null; // 길이 체크섬 오류

    if (frame.length < 5 + length + 2) return null; // 데이터 전체가 아직 안 옴

    const data = frame.slice(5, 5 + length);
    const dataChecksum = frame[5 + length];
    const calculatedChecksum = (~data.reduce((sum, byte) => sum + byte, 0) + 1) & 0xff;
    
    if (calculatedChecksum !== dataChecksum) return null; // 데이터 체크섬 오류
    if (data[0] !== PN532Service.PN532_TO_HOST) return null; // 방향 오류

    return data.slice(1);
  }

  private isAckFrame(buffer: Buffer): boolean {
    // ACK: 00 00 FF 00 FF 00
    return buffer.includes(PN532Service.ACK_SEQ);
  }

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

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

      // TgInitAsTarget (0x8C) 파라미터 구성 (UM0701-02 User Manual 참조)
      // Mode (1 byte): 0x00
      // Mifare Params (6 bytes):
      //   - SENS_RES (2 bytes): 0x04, 0x00
      //   - NFCID1t (3 bytes): Random or Fixed (e.g. 0x12, 0x34, 0x56)
      //   - SEL_RES (1 byte): 0x20 (ISO/IEC 14443-4) or 0x60 (NFCIP-1 Target)
      // FeliCa Params (18 bytes): All 0
      // NFCID3t (10 bytes): All 0
      // L_Gt (1 byte): Length of General Bytes
      // Gt (Var): General Bytes (NDEF message)
      // L_Tk (1 byte): Length of Historical Bytes
      // Tk (Var): Historical Bytes (Empty)

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

      // TgInitAsTarget은 외부 리더기가 활성화할 때까지 응답하지 않을 수 있음
      // 따라서 타임아웃을 충분히 길게 설정해야 함
      const actualTimeout = timeoutMs > 0 ? timeoutMs : this.config.readyTimeoutMs;
      
      const response = await this.sendCommand(command, actualTimeout);

      if (!response) {
        console.error('[PN532] Failed to initialize as target (No response or timeout)');
        return false;
      }
      
      // Response of TgInitAsTarget: Mode (1 byte) + Initiator Command (Var)
      // Mode 1: Active, 2: Passive... (Usually returns 1 byte Mode first)
      // but if successful, it means we are selected.
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
      
      // TgInitAsTarget이 성공했다는 것은 이미 태그(리더기)에 의해 선택되었다는 의미일 수 있음.
      // (Active 모드가 아니면 보통 Select 과정이 포함됨)
      // 여기서 TgGetData를 호출하여 데이터 교환 준비가 되었는지 확인

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
      // 1. 명령 전송 전 약간의 딜레이
      await this.delay(20);

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
      const response = await this.waitForResponse(timeoutMs);
      return response;

    } catch (error) {
      console.error('[PN532] Send command error:', error);
      return null;
    }
  }

  private async waitForAck(timeoutMs: number): Promise<boolean> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      if (await this.isReady()) {
        const data = await this.readData();
        if (data) {
           console.log(`[PN532-DEBUG] ACK << ${data.toString('hex')}`);
           if (this.isAckFrame(data)) return true;
        }
      }
      await this.delay(10);
    }
    return false;
  }

  private async waitForResponse(timeoutMs: number): Promise<Buffer | null> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      if (await this.isReady()) {
        const data = await this.readData();
        if (data && !this.isAckFrame(data)) {
           console.log(`[PN532-DEBUG] RX << ${data.toString('hex')}`);
           return this.parseFrame(data);
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
    // Sometimes I2C read returns status byte first, or garbage.
    // Scan for 00 00 FF pattern
    while (offset < buffer.length - 2) {
      if (buffer[offset] === 0x00 && buffer[offset + 1] === 0x00 && buffer[offset + 2] === 0xff) {
        break;
      }
      offset++;
    }

    if (offset >= buffer.length - 2) return null;

    const frame = buffer.slice(offset);
    if (frame.length < 7) return null; // Min valid frame length

    // frame[0]=00, frame[1]=00, frame[2]=FF
    const length = frame[3];
    const lengthChecksum = frame[4];

    if (((length + lengthChecksum) & 0xff) !== 0) return null;

    const data = frame.slice(5, 5 + length);
    const dataChecksum = frame[5 + length];
    const calculatedChecksum = (~data.reduce((sum, byte) => sum + byte, 0) + 1) & 0xff;
    
    if (calculatedChecksum !== dataChecksum) return null;
    if (data[0] !== PN532Service.PN532_TO_HOST) return null;

    return data.slice(1);
  }

  private isAckFrame(buffer: Buffer): boolean {
    const hex = buffer.toString('hex');
    // Search for ACK pattern: 00 00 FF 00 FF 00
    // 참고: I2C는 앞에 Status Byte(0x01) 등이 붙을 수 있으므로 includes로 검색
    return hex.includes('0000ff00ff00');
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

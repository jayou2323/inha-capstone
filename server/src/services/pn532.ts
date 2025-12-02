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

  // PN532 프레임 구조
  private static readonly PREAMBLE = 0x00;
  private static readonly START_CODE1 = 0x00;
  private static readonly START_CODE2 = 0xff;
  private static readonly POSTAMBLE = 0x00;

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

      // 펌웨어 버전 확인
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
  async initAsTarget(ndefMessage: Buffer): Promise<boolean> {
    try {
      if (!this.isInitialized) {
        throw new Error('PN532 not initialized');
      }

      console.log('[PN532] Initializing as target (card emulation mode)...');

      // TgInitAsTarget 파라미터
      const mode = 0x00; // PICC only

      // SENS_RES (ATQA)
      const sensRes = Buffer.from([0x04, 0x00]);

      // NFCID1t (UID) - 4바이트 UID
      const nfcid1t = Buffer.from([0x12, 0x34, 0x56, 0x78]);

      // SEL_RES (SAK)
      const selRes = 0x20; // ISO/IEC 14443-4 compliant

      // Parameters for Felica (not used, set to 0)
      const felicaParams = Buffer.alloc(18, 0);

      // NFCID3t (10 bytes, not used for Type 4)
      const nfcid3t = Buffer.alloc(10, 0);

      // General bytes (NDEF message)
      const generalBytes = ndefMessage;
      const generalBytesLength = generalBytes.length;

      // Historical bytes (empty)
      const historicalBytes = Buffer.alloc(0);
      const historicalBytesLength = 0;

      // 명령 생성
      const command = Buffer.concat([
        Buffer.from([PN532Service.CMD_TG_INIT_AS_TARGET, mode]),
        sensRes,
        nfcid1t,
        Buffer.from([selRes]),
        felicaParams,
        nfcid3t,
        Buffer.from([generalBytesLength]),
        generalBytes,
        Buffer.from([historicalBytesLength]),
        historicalBytes,
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
   * 태깅 이벤트 대기
   */
  async waitForTag(timeoutMs: number): Promise<boolean> {
    try {
      console.log(`[PN532] Waiting for tag (timeout: ${timeoutMs}ms)...`);

      const startTime = Date.now();

      while (Date.now() - startTime < timeoutMs) {
        // TgGetData로 데이터 수신 대기
        const response = await this.sendCommand(
          Buffer.from([PN532Service.CMD_TG_GET_DATA]),
          1000
        );

        if (response && response.length > 0) {
          console.log('[PN532] Tag detected and data exchanged');
          return true;
        }

        // 100ms 대기
        await this.delay(100);
      }

      console.log('[PN532] Tag timeout');
      return false;
    } catch (error) {
      console.error('[PN532] Wait for tag failed:', error);
      return false;
    }
  }

  /**
   * I2C를 통해 PN532에 명령 전송
   */
  private async sendCommand(
    command: Buffer,
    timeoutMs: number = 1000
  ): Promise<Buffer | null> {
    if (!this.i2cBus) {
      throw new Error('I2C bus not opened');
    }

    try {
      // 프레임 생성
      const frame = this.buildFrame(command);

      // I2C로 프레임 전송
      await this.i2cWrite(frame);

      // 응답 대기 및 읽기
      const response = await this.waitForResponse(timeoutMs);

      return response;
    } catch (error) {
      console.error('[PN532] Send command error:', error);
      return null;
    }
  }

  /**
   * PN532 프레임 생성
   */
  private buildFrame(data: Buffer): Buffer {
    const length = data.length;
    const lengthChecksum = (~length + 1) & 0xff;

    const dataChecksum = (~data.reduce((sum, byte) => sum + byte, 0) + 1) & 0xff;

    return Buffer.concat([
      Buffer.from([
        PN532Service.PREAMBLE,
        PN532Service.START_CODE1,
        PN532Service.START_CODE2,
        length,
        lengthChecksum,
      ]),
      data,
      Buffer.from([dataChecksum, PN532Service.POSTAMBLE]),
    ]);
  }

  /**
   * I2C 쓰기
   */
  private async i2cWrite(data: Buffer): Promise<void> {
    if (!this.i2cBus) {
      throw new Error('I2C bus not opened');
    }

    return new Promise((resolve, reject) => {
      this.i2cBus!.i2cWrite(this.config.i2cAddress, data.length, data, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * 응답 대기 및 읽기
   */
  private async waitForResponse(timeoutMs: number): Promise<Buffer | null> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      try {
        const ready = await this.isReady();

        if (ready) {
          return await this.i2cRead();
        }

        await this.delay(10);
      } catch (error) {
        console.error('[PN532] Wait for response error:', error);
        return null;
      }
    }

    console.warn('[PN532] Response timeout');
    return null;
  }

  /**
   * PN532가 응답 준비되었는지 확인
   */
  private async isReady(): Promise<boolean> {
    if (!this.i2cBus) {
      return false;
    }

    return new Promise((resolve) => {
      const buffer = Buffer.alloc(1);
      this.i2cBus!.i2cRead(this.config.i2cAddress, 1, buffer, (error) => {
        if (error) {
          resolve(false);
        } else {
          // Ready 상태: 0x01
          resolve((buffer[0] & 0x01) === 0x01);
        }
      });
    });
  }

  /**
   * I2C 읽기
   */
  private async i2cRead(): Promise<Buffer | null> {
    if (!this.i2cBus) {
      return null;
    }

    return new Promise((resolve) => {
      const buffer = Buffer.alloc(64);
      this.i2cBus!.i2cRead(
        this.config.i2cAddress,
        buffer.length,
        buffer,
        (error: Error | null, bytesRead: number, resultBuffer: Buffer) => {
          if (error || bytesRead === 0) {
            resolve(null);
          } else {
            // 프레임 파싱
            const data = this.parseFrame(resultBuffer.slice(0, bytesRead));
            resolve(data);
          }
        }
      );
    });
  }

  /**
   * 프레임 파싱
   */
  private parseFrame(frame: Buffer): Buffer | null {
    try {
      // 최소 프레임 크기 확인
      if (frame.length < 7) {
        return null;
      }

      // Preamble, Start Code 확인
      if (
        frame[0] !== PN532Service.PREAMBLE ||
        frame[1] !== PN532Service.START_CODE1 ||
        frame[2] !== PN532Service.START_CODE2
      ) {
        return null;
      }

      const length = frame[3];
      const lengthChecksum = frame[4];

      // Length checksum 확인
      if (((length + lengthChecksum) & 0xff) !== 0) {
        return null;
      }

      // 데이터 추출
      const data = frame.slice(5, 5 + length);
      const dataChecksum = frame[5 + length];

      // Data checksum 확인
      const calculatedChecksum =
        (~data.reduce((sum, byte) => sum + byte, 0) + 1) & 0xff;
      if (calculatedChecksum !== dataChecksum) {
        return null;
      }

      // ACK 프레임인 경우
      if (data[0] === 0x00 && data[1] === 0xff) {
        return Buffer.alloc(0);
      }

      // 응답 데이터 반환 (명령 코드 제외)
      return data.slice(1);
    } catch (error) {
      console.error('[PN532] Parse frame error:', error);
      return null;
    }
  }

  /**
   * 지연
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 리소스 정리
   */
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

  /**
   * 재초기화
   */
  async reinitialize(): Promise<boolean> {
    console.log('[PN532] Reinitializing...');
    this.close();
    await this.delay(1000);
    return await this.initialize();
  }
}

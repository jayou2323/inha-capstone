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
  
  // 데이터 수신 버퍼 (누적)
  private buffer: Buffer = Buffer.alloc(0);

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
   * TgInitAsTarget은 ACK만 받으면 성공 (외부 리더기가 SELECT할 때까지 응답 안 옴)
   */
  async initAsTarget(ndefMessage: Buffer, timeoutMs: number = 0): Promise<boolean> {
    try {
      if (!this.isInitialized) {
        throw new Error('PN532 not initialized');
      }

      console.log('[PN532] Initializing as target (card emulation mode)...');

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

      // TgInitAsTarget은 ACK만 받으면 성공으로 간주 (응답은 태깅 시 옴)
      const ackReceived = await this.sendCommandAckOnly(command);

      if (ackReceived) {
        console.log('[PN532] Target mode initialized (ACK received), ready for tagging...');
        return true;
      }

      console.error('[PN532] Failed to initialize as target (No ACK)');
      return false;
    } catch (error) {
      console.error('[PN532] Init as target failed:', error);
      return false;
    }
  }

  /**
   * 태깅 이벤트 대기 (Polling)
   * TgInitAsTarget의 응답이나 TgGetData로 태깅 감지
   */
  async waitForTag(timeoutMs: number): Promise<boolean> {
    try {
      console.log(`[PN532] Waiting for NFC tag (timeout: ${timeoutMs}ms)...`);
      
      const startTime = Date.now();
      let checkCount = 0;
      
      while (Date.now() - startTime < timeoutMs) {
        // PN532가 준비 상태인지 확인
        if (await this.isReady()) {
          const data = await this.readData();
          if (data && data.length > 0) {
            checkCount++;
            console.log(`[PN532-DEBUG] Tag check #${checkCount}: ${data.toString('hex').substring(0, 40)}...`);
            
            // TgInitAsTarget의 지연된 응답이나 실제 데이터가 있으면 성공
            const frame = this.extractResponseFrame();
            if (frame) {
              console.log('[PN532] Tag detected! Data received.');
              return true;
            }
          }
        }
        await this.delay(500); // 0.5초마다 체크
      }

      console.log('[PN532] Tag timeout (no phone detected)');
      return false;
    } catch (error) {
      console.error('[PN532] waitForTag error:', error);
      return false;
    }
  }

  /**
   * 명령 전송 (ACK만 대기)
   * TgInitAsTarget처럼 응답이 지연되는 명령용
   */
  private async sendCommandAckOnly(command: Buffer): Promise<boolean> {
    if (!this.i2cBus) throw new Error('I2C bus not opened');

    try {
      this.buffer = Buffer.alloc(0);
      await this.flushInputBuffer();
      await this.delay(50);

      const frame = this.buildFrame(command);
      console.log(`[PN532-DEBUG] TX >> ${frame.toString('hex')}`);
      await this.i2cWrite(frame);

      // ACK만 대기 (100ms)
      const startTime = Date.now();
      while (Date.now() - startTime < 200) {
        if (await this.isReady()) {
          const chunk = await this.readData();
          if (chunk && chunk.length > 0) {
            console.log(`[PN532-DEBUG] RX Chunk << ${chunk.toString('hex')}`);
            this.buffer = Buffer.concat([this.buffer, chunk]);
            
            const ackIndex = this.buffer.indexOf(PN532Service.ACK_SEQ);
            if (ackIndex !== -1) {
              console.log('[PN532-DEBUG] ACK Received');
              return true;
            }
          }
        }
        await this.delay(10);
      }

      console.warn('[PN532] No ACK received');
      return false;
    } catch (error) {
      console.error('[PN532] sendCommandAckOnly error:', error);
      return false;
    }
  }

  /**
   * 명령 전송 및 응답 수신 (통합 로직)
   */
  private async sendCommand(
    command: Buffer,
    timeoutMs: number = 1000
  ): Promise<Buffer | null> {
    if (!this.i2cBus) throw new Error('I2C bus not opened');

    try {
      // 0. 버퍼 초기화 (이전 명령의 잔여물 제거, 중요!)
      this.buffer = Buffer.alloc(0);
      
      // I2C 라인 클리어 시도
      await this.flushInputBuffer();

      // 1. 명령 전송 (딜레이 증가)
      await this.delay(50); // 20ms -> 50ms로 증가

      const frame = this.buildFrame(command);
      console.log(`[PN532-DEBUG] TX >> ${frame.toString('hex')}`);
      await this.i2cWrite(frame);

      // 2. ACK 및 응답 대기 (Stream 처리)
      const startTime = Date.now();
      let ackReceived = false;
      let syntaxErrorReceived = false;
      
      while (Date.now() - startTime < timeoutMs) {
        if (await this.isReady()) {
           const chunk = await this.readData();
           if (chunk && chunk.length > 0) {
             console.log(`[PN532-DEBUG] RX Chunk << ${chunk.toString('hex')}`);
             this.buffer = Buffer.concat([this.buffer, chunk]);
             
             // 2-1. ACK 확인
             if (!ackReceived) {
               const ackIndex = this.buffer.indexOf(PN532Service.ACK_SEQ);
               if (ackIndex !== -1) {
                 console.log('[PN532-DEBUG] ACK Received');
                 ackReceived = true;
                 // ACK 뒷부분 보존
                 this.buffer = this.buffer.slice(ackIndex + PN532Service.ACK_SEQ.length);
               }
             }

             // 2-2. Syntax Error 확인 (0x7F)
             // PN532는 에러 시 ACK 대신 NACK(00 00 FF FF 00 00) 또는 Syntax Error(7F)를 보냄
             // 여기서는 응답 프레임 추출 시 7F를 체크
             
             // 2-3. Response Frame 확인
             const response = this.extractResponseFrame();
             
             // extractResponseFrame이 null을 반환했더라도,
             // 내부적으로 TFI 7F 등을 감지했을 수 있음 (현재는 구현 안 함)
             // 여기서 명시적으로 체크하려면 extractResponseFrame이 에러 상태를 리턴해야 함.
             
             if (response) {
               if (response.length === 1 && response[0] === 0x7F) {
                 console.warn('[PN532] Syntax Error (0x7F) received');
                 syntaxErrorReceived = true;
                 return null; // 즉시 실패 처리하고 재시도 유도
               }
               
               console.log(`[PN532-DEBUG] Valid Response Frame found: ${response.toString('hex')}`);
               return response;
             }
           }
        }
        await this.delay(10);
      }

      if (!ackReceived) {
        console.warn('[PN532] No ACK received');
      } else if (syntaxErrorReceived) {
        // 이미 위에서 처리됨
      } else {
        console.warn('[PN532] Response timeout (ACK received)');
      }
      return null;

    } catch (error) {
      console.error('[PN532] Send command error:', error);
      return null;
    }
  }

  /**
   * 버퍼에서 유효한 응답 프레임을 찾아 추출하고 버퍼에서 제거
   */
  private extractResponseFrame(): Buffer | null {
    // 최소 프레임 길이: 8
    if (this.buffer.length < 8) return null;

    let offset = 0;
    let frameFound = false;
    
    while (offset < this.buffer.length - 2) {
      if (this.buffer[offset] === 0x00 && 
          this.buffer[offset + 1] === 0x00 && 
          this.buffer[offset + 2] === 0xff) {
        frameFound = true;
        break;
      }
      offset++;
    }

    if (!frameFound) {
      if (this.buffer.length > 2) {
        const keep = this.buffer.slice(this.buffer.length - 2);
        this.buffer = keep;
      }
      return null;
    }

    if (offset > 0) {
      this.buffer = this.buffer.slice(offset);
      offset = 0;
    }

    if (this.buffer.length < 5) return null;

    const length = this.buffer[3];
    const lengthChecksum = this.buffer[4];

    // Length Checksum 검증
    if (((length + lengthChecksum) & 0xff) !== 0) {
      console.warn('[PN532] Frame Length Checksum error. Skipping invalid header.');
      this.buffer = this.buffer.slice(3);
      return this.extractResponseFrame();
    }

    const totalLength = 5 + length + 2;
    if (this.buffer.length < totalLength) {
      return null;
    }

    const data = this.buffer.slice(5, 5 + length);
    const dataChecksum = this.buffer[5 + length];
    
    const calculatedChecksum = (~data.reduce((sum, byte) => sum + byte, 0) + 1) & 0xff;
    
    if (calculatedChecksum !== dataChecksum) {
       console.warn('[PN532] Frame Data Checksum error.');
       this.buffer = this.buffer.slice(3);
       return this.extractResponseFrame();
    }

    // TFI 확인 (PN532 -> Host: 0xD5)
    // 만약 Syntax Error(7F)인 경우, 데이터가 7F 하나만 옴.
    // 7F는 TFI 위치에 오지 않고, 별도의 Error Frame 구조가 있음.
    // 하지만 PN532는 보통 00 00 FF 01 FF 7F 81 00 (7F: Error Code) 형태로 보냄.
    // length=1, data=7F 이면 Syntax Error.
    
    if (data[0] === 0x7F) {
        // Syntax Error Frame: 00 00 FF 01 FF 7F 81 00
        // data = [7F]
        console.warn('[PN532] Syntax Error Frame detected');
        this.buffer = this.buffer.slice(totalLength);
        return Buffer.from([0x7F]); // 7F 리턴해서 상위에서 처리
    }

    if (data[0] !== PN532Service.PN532_TO_HOST) {
       console.warn(`[PN532] Invalid TFI: ${data[0].toString(16)}`);
       this.buffer = this.buffer.slice(totalLength);
       return this.extractResponseFrame();
    }

    this.buffer = this.buffer.slice(totalLength);
    return data.slice(1);
  }

  private async flushInputBuffer(): Promise<void> {
    try {
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
      // Ignore
    }
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

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

      // 1. 명령 전송
      await this.delay(20);

      const frame = this.buildFrame(command);
      console.log(`[PN532-DEBUG] TX >> ${frame.toString('hex')}`);
      await this.i2cWrite(frame);

      // 2. ACK 및 응답 대기 (Stream 처리)
      // ACK가 오고 나서 Response가 바로 이어서 올 수도 있고, 조금 있다 올 수도 있음.
      // 하나의 루프에서 데이터를 계속 읽으며 ACK와 Response를 찾음.
      
      const startTime = Date.now();
      let ackReceived = false;
      
      while (Date.now() - startTime < timeoutMs) {
        if (await this.isReady()) {
           const chunk = await this.readData();
           if (chunk && chunk.length > 0) {
             console.log(`[PN532-DEBUG] RX Chunk << ${chunk.toString('hex')}`);
             this.buffer = Buffer.concat([this.buffer, chunk]);
             
             // 2-1. ACK 확인 (아직 못 받았다면)
             if (!ackReceived) {
               // ACK 시퀀스 검색
               const ackIndex = this.buffer.indexOf(PN532Service.ACK_SEQ);
               if (ackIndex !== -1) {
                 console.log('[PN532-DEBUG] ACK Received');
                 ackReceived = true;
                 
                 // ACK 앞부분은 버리고, ACK 뒷부분부터 다시 버퍼 구성
                 // (ACK 바로 뒤에 Response 프레임이 붙어있을 수 있음)
                 this.buffer = this.buffer.slice(ackIndex + PN532Service.ACK_SEQ.length);
               }
             }

             // 2-2. Response Frame 확인 (ACK 받은 후, 혹은 ACK와 동시에)
             // ACK를 못 받았더라도 Response가 먼저 파싱된다면 성공으로 간주해도 무방하나, 
             // 표준 절차상 ACK 체크 권장. 여기서는 ACK 수신 여부와 관계없이 프레임 찾기 시도.
             // (가끔 ACK 놓쳐도 응답은 올 수 있음)
             
             const response = this.extractResponseFrame();
             if (response) {
               console.log(`[PN532-DEBUG] Valid Response Frame found: ${response.toString('hex')}`);
               return response;
             }
           }
        }
        await this.delay(10);
      }

      if (!ackReceived) {
        console.warn('[PN532] No ACK received');
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
    // 최소 프레임 길이: Preamble(1) + Start(2) + Len(1) + LCS(1) + TFI(1) + DCS(1) + Post(1) = 8
    if (this.buffer.length < 8) return null;

    // 1. 프레임 헤더 (00 00 FF) 찾기
    // 버퍼 전체를 훑어서 00 00 FF 패턴이 있는지 확인
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
      // 헤더를 못 찾았으면, 버퍼의 마지막 2바이트만 남기고 앞부분은 버려도 됨
      // (다음 청크와 연결되어 00 00 FF가 완성될 수 있으므로 끝부분은 보존)
      if (this.buffer.length > 2) {
        const keep = this.buffer.slice(this.buffer.length - 2);
        // console.log(`[PN532-DEBUG] Discarding garbage: ${this.buffer.slice(0, this.buffer.length - 2).toString('hex')}`);
        this.buffer = keep;
      }
      return null;
    }

    // 헤더 발견 (offset 위치)
    // 쓰레기 데이터 제거 (헤더 앞부분)
    if (offset > 0) {
      // console.log(`[PN532-DEBUG] Skipping garbage before header: ${this.buffer.slice(0, offset).toString('hex')}`);
      this.buffer = this.buffer.slice(offset);
      offset = 0;
    }

    // 이제 buffer는 00 00 FF ... 로 시작
    if (this.buffer.length < 5) return null; // 아직 Length 필드까지 안 옴

    const length = this.buffer[3];
    const lengthChecksum = this.buffer[4];

    // Length Checksum 검증
    if (((length + lengthChecksum) & 0xff) !== 0) {
      console.warn('[PN532] Frame Length Checksum error. Skipping invalid header.');
      // 이 헤더는 가짜임. 00 00 FF ... 패턴이었지만 체크섬이 안 맞음.
      // 헤더(3바이트)만 제거하고 다시 검색하도록 유도
      this.buffer = this.buffer.slice(3);
      return this.extractResponseFrame(); // 재귀 호출로 다음 헤더 찾기
    }

    // 전체 프레임 길이 확인
    // Header(5) + Data(Length) + DCS(1) + Post(1)
    const totalLength = 5 + length + 2;
    if (this.buffer.length < totalLength) {
      return null; // 데이터가 아직 다 안 옴. 대기.
    }

    // 데이터 추출 및 Checksum 검증
    const data = this.buffer.slice(5, 5 + length);
    const dataChecksum = this.buffer[5 + length];
    
    const calculatedChecksum = (~data.reduce((sum, byte) => sum + byte, 0) + 1) & 0xff;
    
    if (calculatedChecksum !== dataChecksum) {
       console.warn('[PN532] Frame Data Checksum error.');
       // 체크섬 오류면 이 프레임 버림
       this.buffer = this.buffer.slice(3);
       return this.extractResponseFrame();
    }

    // TFI 확인 (PN532 -> Host: 0xD5)
    if (data[0] !== PN532Service.PN532_TO_HOST) {
       console.warn(`[PN532] Invalid TFI: ${data[0].toString(16)}`);
       // TFI 안 맞으면 무시
       this.buffer = this.buffer.slice(totalLength);
       return this.extractResponseFrame();
    }

    // 성공! 프레임 추출
    // 버퍼에서 해당 프레임 제거
    this.buffer = this.buffer.slice(totalLength);
    
    // TFI(D5) 제외하고 리턴할지, 포함할지?
    // 기존 로직은 TFI 제외하고 리턴했음.
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

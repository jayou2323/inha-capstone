import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { MockPN532Service } from './utils/mock-pn532.js';
import { SessionManager } from './services/session-manager.js';
import { NfcController } from './controllers/nfc.controller.js';
import type { PN532Config } from './types/index.js';

// 환경 변수 로드
dotenv.config();

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';
const useMock = process.env.USE_MOCK_PN532 === 'true';

// PN532 설정
const pn532Config: PN532Config = {
  i2cBus: parseInt(process.env.I2C_BUS || '1', 10),
  i2cAddress: parseInt(process.env.I2C_ADDRESS || '0x24', 16),
  readyTimeoutMs: parseInt(process.env.READY_TIMEOUT_MS || '3000', 10),
  taggingTimeoutMs: parseInt(process.env.TAGGING_TIMEOUT_MS || '10000', 10),
  maxRetries: parseInt(process.env.MAX_RETRIES || '3', 10),
};

const sessionTimeoutMs = parseInt(process.env.SESSION_TIMEOUT_MS || '30000', 10);

console.log('='.repeat(60));
console.log('RPI NFC Bridge Server');
console.log('='.repeat(60));
console.log('Configuration:');
console.log(`  Port: ${PORT}`);
console.log(`  Host: ${HOST}`);
console.log(`  PN532 Mode: ${useMock ? 'MOCK' : 'REAL'}`);
console.log(`  I2C Bus: ${pn532Config.i2cBus}`);
console.log(`  I2C Address: 0x${pn532Config.i2cAddress.toString(16)}`);
console.log(`  Session Timeout: ${sessionTimeoutMs}ms`);
console.log(`  Tagging Timeout: ${pn532Config.taggingTimeoutMs}ms`);
console.log('='.repeat(60));

/**
 * 메인 애플리케이션 초기화
 */
async function main() {
  try {
    // Express 앱 생성
    const app = express();

    // 미들웨어
    app.use(cors());
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // 요청 로깅
    app.use((req, res, next) => {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
      next();
    });

    // PN532 초기화
    console.log('Initializing PN532...');
    let pn532;

    if (useMock) {
      pn532 = new MockPN532Service(pn532Config);
    } else {
      // 실제 PN532는 동적 import (Mac에서 에러 방지)
      const { PN532Service } = await import('./services/pn532.js');
      pn532 = new PN532Service(pn532Config);
    }

    const initSuccess = await pn532.initialize();

    if (!initSuccess) {
      throw new Error('Failed to initialize PN532');
    }

    // 세션 매니저 초기화
    const sessionManager = new SessionManager(
      pn532,
      sessionTimeoutMs,
      pn532Config.taggingTimeoutMs
    );

    // 컨트롤러 초기화
    const nfcController = new NfcController(sessionManager);

    // 라우트 설정
    app.post('/api/nfc/sessions', nfcController.createNfcSession);
    app.get('/api/nfc/sessions/:sessionId', nfcController.getSessionStatus);
    app.get('/api/nfc/sessions', nfcController.getAllSessions);
    app.get('/api/health', nfcController.healthCheck);

    // 루트 경로
    app.get('/', (req, res) => {
      res.json({
        service: 'RPI NFC Bridge Server',
        version: '1.0.0',
        mode: useMock ? 'mock' : 'real',
        endpoints: [
          'POST /api/nfc/sessions',
          'GET /api/nfc/sessions/:sessionId',
          'GET /api/nfc/sessions',
          'GET /api/health',
        ],
      });
    });

    // 404 핸들러
    app.use((req, res) => {
      res.status(404).json({
        error: 'Not Found',
        message: `Cannot ${req.method} ${req.path}`,
      });
    });

    // 에러 핸들러
    app.use(
      (
        err: Error,
        req: express.Request,
        res: express.Response,
        next: express.NextFunction
      ) => {
        console.error('[Express] Error:', err);
        res.status(500).json({
          error: 'Internal Server Error',
          message: err.message,
        });
      }
    );

    // 서버 시작
    const server = app.listen(PORT, () => {
      console.log('='.repeat(60));
      console.log(`Server is running on http://${HOST}:${PORT}`);
      console.log('='.repeat(60));
    });

    // Graceful shutdown
    const shutdown = async () => {
      console.log('\nShutting down gracefully...');

      server.close(() => {
        console.log('HTTP server closed');
      });

      sessionManager.shutdown();
      pn532.close();

      console.log('Cleanup completed');
      process.exit(0);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// 앱 시작
main();

import type { PN532Config } from '../types/index.js';

/**
 * Mock PN532 Service for development without hardware
 * Simulates NFC tag detection with random delays
 */
export class MockPN532Service {
  private config: PN532Config;

  constructor(config: PN532Config) {
    this.config = config;
  }

  async initialize(): Promise<boolean> {
    console.log('[MockPN532] Initializing (mock mode)');
    await this.delay(500);
    console.log('[MockPN532] ✓ Initialized');
    return true;
  }

  async initAsTarget(ndefMessage: Buffer, timeoutMs: number = 0): Promise<boolean> {
    console.log(`[MockPN532] Init as target - NDEF: ${ndefMessage.length} bytes (Timeout: ${timeoutMs}ms)`);
    await this.delay(1000);
    return true;
  }

  async waitForTag(timeoutMs: number): Promise<boolean> {
    console.log(`[MockPN532] Waiting for tag (${timeoutMs}ms)...`);

    // 3~7초 랜덤 대기 (실제 태깅 시뮬레이션)
    const delay = 3000 + Math.random() * 4000;
    await this.delay(Math.min(delay, timeoutMs - 500));

    console.log('[MockPN532] ✓ Tag detected (mock)');
    return true;
  }

  async reinitialize(): Promise<void> {
    console.log('[MockPN532] Reinitializing...');
    await this.delay(500);
    console.log('[MockPN532] ✓ Reinitialized');
  }

  close(): void {
    console.log('[MockPN532] Closed (mock)');
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

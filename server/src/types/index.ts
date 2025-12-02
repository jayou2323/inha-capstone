// NFC 세션 요청 (간소화 - orderId만 필수)
export interface NfcSessionRequest {
  orderId: string;
  receiptUrl?: string;
}

// NFC 세션
export interface NfcSession {
  sessionId: string;
  orderId: string;
  receiptUrl: string;
  status: 'pending' | 'ready' | 'tagging' | 'completed' | 'expired' | 'failed';
  createdAt: Date;
  expiresAt: Date;
  completedAt?: Date;
  error?: string;
}

// PN532 설정
export interface PN532Config {
  i2cBus: number;
  i2cAddress: number;
  readyTimeoutMs: number;
  taggingTimeoutMs: number;
  maxRetries: number;
}

// PN532 서비스 공통 인터페이스 (실제/모의 공통 사용)
export interface IPN532Service {
  initialize(): Promise<boolean>;
  initAsTarget(ndefMessage: Buffer): Promise<boolean>;
  waitForTag(timeoutMs: number): Promise<boolean>;
  /**
   * 에러 이후 재초기화
   * 실제 구현은 boolean 또는 void를 반환할 수 있으므로 유연하게 정의
   */
  reinitialize(): Promise<void | boolean>;
  close(): void;
}

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

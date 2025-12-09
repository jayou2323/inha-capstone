import { v4 as uuidv4 } from 'uuid';
import type { IPN532Service, NfcSession, NfcSessionRequest } from '../types/index.js';
import { NdefUrlRecord } from '../utils/ndef.js';

/**
 * NFC 세션 관리 서비스
 * - 다중 태깅 요청을 순차 처리하는 큐 시스템
 * - 세션 생명주기 관리 (생성, 만료, 완료)
 * - PN532와 연동하여 실제 NFC 태깅 처리
 */
export class SessionManager {
  private sessions: Map<string, NfcSession> = new Map();
  private queue: string[] = [];
  private isProcessing = false;
  private pn532: IPN532Service;
  private sessionTimeoutMs: number;
  private taggingTimeoutMs: number;

  constructor(pn532: IPN532Service, sessionTimeoutMs = 30000, taggingTimeoutMs = 10000) {
    this.pn532 = pn532;
    this.sessionTimeoutMs = sessionTimeoutMs;
    this.taggingTimeoutMs = taggingTimeoutMs;

    // 주기적으로 만료된 세션 정리
    setInterval(() => this.cleanupExpiredSessions(), 5000);
  }

  /**
   * 새로운 NFC 세션 생성
   */
  async createSession(request: NfcSessionRequest): Promise<NfcSession> {
    const sessionId = uuidv4();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.sessionTimeoutMs);

    // 영수증 URL 생성 - 테스트용 짧은 URL 사용
    // const receiptUrl = request.receiptUrl || `http://abc.com/r/${request.orderId}`;
    const receiptUrl = 'https://abc.com';

    const session: NfcSession = {
      sessionId,
      orderId: request.orderId,
      receiptUrl,
      status: 'pending',
      createdAt: now,
      expiresAt,
    };

    this.sessions.set(sessionId, session);
    this.queue.push(sessionId);

    console.log(`[SessionManager] Session created: ${sessionId}`);

    // 큐 처리 시작
    this.processQueue();

    return session;
  }

  /**
   * 세션 조회
   */
  getSession(sessionId: string): NfcSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * 모든 세션 조회
   */
  getAllSessions(): NfcSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * 세션 상태 업데이트
   */
  private updateSessionStatus(
    sessionId: string,
    status: NfcSession['status'],
    error?: string
  ): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = status;
      if (error) {
        session.error = error;
      }
      if (status === 'completed' || status === 'failed') {
        session.completedAt = new Date();
      }
    }
  }

  /**
   * 큐 처리
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      while (this.queue.length > 0) {
        const sessionId = this.queue.shift()!;
        const session = this.sessions.get(sessionId);

        if (!session) {
          console.warn(`[SessionManager] Session not found: ${sessionId}`);
          continue;
        }

        // 만료된 세션 스킵
        if (new Date() > session.expiresAt) {
          console.log(`[SessionManager] Session expired: ${sessionId}`);
          this.updateSessionStatus(sessionId, 'expired');
          continue;
        }

        console.log(`[SessionManager] Processing session: ${sessionId}`);
        await this.processSession(session);
      }
    } catch (error) {
      console.error('[SessionManager] Queue processing error:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * 개별 세션 처리
   */
  private async processSession(session: NfcSession): Promise<void> {
    const { sessionId, receiptUrl } = session;

    try {
      // 상태: ready
      this.updateSessionStatus(sessionId, 'ready');
      console.log(`[SessionManager] Session ready: ${sessionId}`);

      // NDEF URL 레코드 생성
      const ndefMessage = NdefUrlRecord.encode(receiptUrl);
      console.log(`[SessionManager] NDEF message created (${ndefMessage.length} bytes for URL: ${receiptUrl})`);

      // PN532를 타겟 모드로 초기화
      const initSuccess = await this.pn532.initAsTarget(ndefMessage, this.taggingTimeoutMs);
      if (!initSuccess) {
        throw new Error('Failed to initialize PN532 as target');
      }

      // 상태: tagging
      this.updateSessionStatus(sessionId, 'tagging');
      console.log(`[SessionManager] Waiting for tag: ${sessionId}`);

      // 태깅 대기
      const tagSuccess = await this.pn532.waitForTag(this.taggingTimeoutMs);

      if (tagSuccess) {
        // 성공
        this.updateSessionStatus(sessionId, 'completed');
        console.log(`[SessionManager] Session completed: ${sessionId}`);
      } else {
        // 타임아웃
        this.updateSessionStatus(sessionId, 'expired', 'Tagging timeout');
        console.log(`[SessionManager] Session timeout: ${sessionId}`);
      }
    } catch (error) {
      console.error(`[SessionManager] Session processing error: ${sessionId}`, error);
      this.updateSessionStatus(
        sessionId,
        'failed',
        error instanceof Error ? error.message : 'Unknown error'
      );

      // PN532 재초기화 시도
      console.log('[SessionManager] Attempting to reinitialize PN532...');
      await this.pn532.reinitialize();
    }
  }

  /**
   * 만료된 세션 정리
   */
  private cleanupExpiredSessions(): void {
    const now = new Date();
    let cleanedCount = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      // 만료 시간이 지나고 완료/실패 상태인 세션 삭제
      if (
        now > session.expiresAt &&
        (session.status === 'completed' ||
          session.status === 'failed' ||
          session.status === 'expired')
      ) {
        this.sessions.delete(sessionId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`[SessionManager] Cleaned up ${cleanedCount} expired sessions`);
    }
  }

  /**
   * 세션 통계
   */
  getStats(): {
    total: number;
    pending: number;
    ready: number;
    tagging: number;
    completed: number;
    expired: number;
    failed: number;
  } {
    const sessions = Array.from(this.sessions.values());

    return {
      total: sessions.length,
      pending: sessions.filter((s) => s.status === 'pending').length,
      ready: sessions.filter((s) => s.status === 'ready').length,
      tagging: sessions.filter((s) => s.status === 'tagging').length,
      completed: sessions.filter((s) => s.status === 'completed').length,
      expired: sessions.filter((s) => s.status === 'expired').length,
      failed: sessions.filter((s) => s.status === 'failed').length,
    };
  }

  /**
   * 리소스 정리
   */
  shutdown(): void {
    console.log('[SessionManager] Shutting down...');
    this.sessions.clear();
    this.queue = [];
    this.isProcessing = false;
  }
}

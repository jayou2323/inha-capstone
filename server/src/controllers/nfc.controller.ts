import type { Request, Response } from 'express';
import type { SessionManager } from '../services/session-manager.js';

/**
 * NFC 세션 관리 컨트롤러
 */
export class NfcController {
  constructor(private sessionManager: SessionManager) {}

  /**
   * POST /api/nfc/sessions
   * NFC 세션 생성
   */
  createNfcSession = async (req: Request, res: Response): Promise<void> => {
    try {
      const { orderId, receiptUrl } = req.body;

      if (!orderId) {
        res.status(400).json({ error: 'orderId is required' });
        return;
      }

      const session = await this.sessionManager.createSession({
        orderId,
        receiptUrl,
      });

      res.status(201).json({
        sessionId: session.sessionId,
        status: session.status,
        expiresAt: session.expiresAt.toISOString(),
        message: 'NFC session created',
      });
    } catch (error) {
      console.error('NFC session creation error:', error);
      res.status(500).json({ error: 'Failed to create NFC session' });
    }
  };

  /**
   * GET /api/nfc/sessions/:sessionId
   * 세션 상태 조회
   */
  getSessionStatus = async (req: Request, res: Response): Promise<void> => {
    const { sessionId } = req.params;
    const session = this.sessionManager.getSession(sessionId);

    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    res.json({
      sessionId: session.sessionId,
      status: session.status,
      expiresAt: session.expiresAt.toISOString(),
      message: session.error,
    });
  };

  /**
   * GET /api/nfc/sessions
   * 모든 세션 조회
   */
  getAllSessions = async (req: Request, res: Response): Promise<void> => {
    const sessions = this.sessionManager.getAllSessions();
    res.json({
      total: sessions.length,
      sessions: sessions.map((s) => ({
        sessionId: s.sessionId,
        orderId: s.orderId,
        status: s.status,
        createdAt: s.createdAt.toISOString(),
        expiresAt: s.expiresAt.toISOString(),
      })),
    });
  };

  /**
   * GET /api/health
   * 헬스 체크
   */
  healthCheck = async (req: Request, res: Response): Promise<void> => {
    const stats = this.sessionManager.getStats();
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      sessions: stats,
    });
  };
}

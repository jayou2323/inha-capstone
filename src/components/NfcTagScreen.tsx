import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Smartphone } from "lucide-react";
import {
  NFC_ANIMATIONS,
  NFC_TRANSITIONS,
  ANIMATION_VARIANTS,
} from "../constants/animations";
import { createNfcSession, getNfcSessionStatus } from "../lib/api";

interface NfcTagScreenProps {
  receiptUrl: string;
  onTagComplete: () => void;
  onTagFailed?: (error: string) => void;
}

const LOADING_DOTS_DELAYS = [0, 0.3, 0.6] as const;

export default function NfcTagScreen({
  receiptUrl,
  onTagComplete,
  onTagFailed,
}: NfcTagScreenProps) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("pending");
  const POLL_INTERVAL_MS = 1500;

  // 1. NFC 세션 생성
  useEffect(() => {
    const initSession = async () => {
      console.log(`[NFC] Creating session for receipt URL: ${receiptUrl}`);
      const result = await createNfcSession(receiptUrl);
      const sid = result.sessionId || "latest";
      console.log(`[NFC] Session ready: ${sid}`);
      setSessionId(sid);
    };
    initSession();
  }, [receiptUrl, onTagFailed]);

  // 2. 상태 폴링으로 완료 감지
  useEffect(() => {
    if (!sessionId) return;
    let timer: number | undefined;
    let stopped = false;

    const pollStatus = async () => {
      try {
        const res = await getNfcSessionStatus(sessionId);
        if (!res) return;
        setStatus(res.status);

        if (res.status === "scanned" || res.status === "completed") {
          stopped = true;
          onTagComplete();
        }
      } catch (error) {
        console.error("[NFC] 폴링 중 오류:", error);
        onTagFailed?.("NFC 상태 확인 중 오류가 발생했습니다.");
      } finally {
        if (!stopped) {
          timer = window.setTimeout(pollStatus, POLL_INTERVAL_MS);
        }
      }
    };

    pollStatus();

    return () => {
      stopped = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [sessionId, onTagComplete, onTagFailed]);

  // 3. 상태별 메시지
  const getStatusMessage = () => {
    switch (status) {
      case "pending":
        return "NFC 준비 중...";
      case "ready":
        return "휴대폰을 태그해 주세요";
      case "tagging":
        return "데이터 전송 중...";
      case "scanned":
      case "completed":
        return "전송이 완료되었습니다";
      default:
        return "휴대폰을 태그해 주세요";
    }
  };

  return (
    <div className="h-full flex items-center justify-center p-12">
      <motion.div
        {...ANIMATION_VARIANTS.scaleIn}
        transition={{ duration: 0.5 }}
        className="w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden"
      >
        {/* 헤더 */}
        <div className="bg-linear-to-r from-blue-500 to-purple-500 p-8 text-center">
          <h1 className="text-2xl font-bold text-white mb-2">
            영수증 전송중
          </h1>
          <p className="text-xl text-white/90">NFC로 데이터를 전송합니다</p>
        </div>

        {/* NFC 태그 */}
        <div className="p-12 text-center">
          <div className="relative w-48 h-48 mx-auto mb-8">
            <motion.div
              className="absolute inset-0 rounded-full border-4 border-indigo-400/40"
              animate={NFC_ANIMATIONS.pulse}
              transition={NFC_TRANSITIONS.pulse}
            />
            <motion.div
              className="absolute inset-0 rounded-full border-4 border-indigo-400/40"
              animate={NFC_ANIMATIONS.pulse}
              transition={{ ...NFC_TRANSITIONS.pulse, delay: 1 }}
            />

            {/* 스마트폰 아이콘 */}
            <motion.div
              className="absolute inset-0 flex items-center justify-center"
              animate={NFC_ANIMATIONS.phoneFloat}
              transition={NFC_TRANSITIONS.phoneFloat}
            >
              <div className="bg-linear-to-br from-blue-500 to-purple-500 rounded-full p-8 shadow-xl">
                <Smartphone
                  className="w-20 h-20 text-white"
                  strokeWidth={1.5}
                />
              </div>
            </motion.div>
          </div>

          <h2 className="text-2xl font-bold text-slate-900 mb-4">
            {getStatusMessage()}
          </h2>
          <p className="text-lg text-slate-600 mb-2">
            키오스크 하단의 NFC 리더기에
          </p>
          <p className="text-lg text-slate-600">휴대폰을 가까이 대주세요</p>

          {/* 로딩 */}
          <div className="mt-12 flex justify-center gap-2">
            {LOADING_DOTS_DELAYS.map((delay, index) => (
              <motion.div
                key={index}
                className="w-3 h-3 bg-indigo-500 rounded-full"
                animate={NFC_ANIMATIONS.dotPulse}
                transition={{ ...NFC_TRANSITIONS.dotPulse, delay }}
              />
            ))}
          </div>

          {/* NFC 미지원 사용자용 QR 코드 안내 */}
          <div className="mt-12 bg-slate-50 border border-slate-200 rounded-2xl px-6 py-5 inline-flex items-center gap-5 text-left">
            <div className="w-32 h-32 rounded-xl overflow-hidden border border-slate-200 bg-white shadow-sm">
              <img
                src="/images/qr_code.png"
                alt="QR code for receipt"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="text-slate-800">
              <p className="text-lg font-semibold mb-2">NFC스캔이 어려우신가요?</p>
              <p className="text-sm text-slate-600 leading-relaxed">
                QR 스캔하여 영수증을 받아보실 수 있습니다.
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

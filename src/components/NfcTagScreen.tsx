import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Smartphone } from "lucide-react";
import {
  TIMINGS,
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

  // 1. NFC 세션 생성
  useEffect(() => {
    const initSession = async () => {
      console.log(`[NFC] Creating session for receipt URL: ${receiptUrl}`);
      const result = await createNfcSession(receiptUrl);

      if (result.success && result.sessionId) {
        console.log(`[NFC] Session created: ${result.sessionId}`);
        setSessionId(result.sessionId);
      } else {
        console.error("[NFC] Session creation failed");
        onTagFailed?.("NFC 세션 생성 실패");
      }
    };
    initSession();
  }, [receiptUrl, onTagFailed]);

  // 2. 상태 폴링
  useEffect(() => {
    if (!sessionId) return;

    const pollInterval = setInterval(async () => {
      const session = await getNfcSessionStatus(sessionId);

      if (session) {
        console.log(`[NFC] Status: ${session.status}`);
        setStatus(session.status);

        // 완료 상태 체크
        if (session.status === "completed") {
          clearInterval(pollInterval);
          onTagComplete();
        } else if (session.status === "failed" || session.status === "expired") {
          clearInterval(pollInterval);
          onTagFailed?.(session.message || "NFC 태깅 실패");
        }
      }
    }, 500); // 500ms마다 폴링

    // 타임아웃 백업
    const timeout = setTimeout(() => {
      clearInterval(pollInterval);
      if (status !== "completed") {
        onTagFailed?.("NFC 태깅 시간 초과");
      }
    }, TIMINGS.NFC_TAG_TIMEOUT_MS);

    return () => {
      clearInterval(pollInterval);
      clearTimeout(timeout);
    };
  }, [sessionId, status, onTagComplete, onTagFailed]);

  // 3. 상태별 메시지
  const getStatusMessage = () => {
    switch (status) {
      case "pending":
        return "NFC 준비 중...";
      case "ready":
        return "휴대폰을 태그해 주세요";
      case "tagging":
        return "데이터 전송 중...";
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
        </div>
      </motion.div>
    </div>
  );
}

import { useEffect } from "react";
import { motion } from "framer-motion";
import { Smartphone } from "lucide-react";
import {
  TIMINGS,
  NFC_ANIMATIONS,
  NFC_TRANSITIONS,
  ANIMATION_VARIANTS,
} from "../constants/animations";

interface NfcTagScreenProps {
  onTagComplete: () => void;
}

const LOADING_DOTS_DELAYS = [0, 0.3, 0.6] as const;

export default function NfcTagScreen({
  onTagComplete,
}: NfcTagScreenProps) {

  useEffect(() => {
    // 10초 후 태그 완료 화면으로 이동, 실제로는 NFC 태그 감지 시
    const timer = setTimeout(onTagComplete, TIMINGS.NFC_TAG_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [onTagComplete]);

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
            번호표 전송중
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
              <div className="bg-linear-to-br from-indigo-500 to-blue-500 rounded-full p-8 shadow-xl">
                <Smartphone
                  className="w-20 h-20 text-white"
                  strokeWidth={1.5}
                />
              </div>
            </motion.div>
          </div>

          <h2 className="text-2xl font-bold text-slate-900 mb-4">
            휴대폰을 태그해 주세요
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

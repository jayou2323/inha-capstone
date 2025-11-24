import { useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { CheckCircle } from "lucide-react";
import {
  TIMINGS,
  ANIMATION_VARIANTS,
  NFC_TRANSITIONS,
} from "../constants/animations";

interface NfcTagCompleteScreenProps {
  onComplete: () => void;
}

export default function NfcTagCompleteScreen({
  onComplete,
}: NfcTagCompleteScreenProps) {
  const timeoutSeconds = useMemo(
    () => TIMINGS.NFC_COMPLETE_TIMEOUT_MS / 1000,
    []
  );

  useEffect(() => {
    const timer = setTimeout(onComplete, TIMINGS.NFC_COMPLETE_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="h-full flex items-center justify-center p-12">
      <motion.div
        {...ANIMATION_VARIANTS.scaleIn}
        transition={{ duration: 0.5 }}
        className="text-center"
      >
        <motion.div
          {...ANIMATION_VARIANTS.popIn}
          transition={{ delay: 0.2, ...NFC_TRANSITIONS.spring }}
        >
          <CheckCircle
            className="w-32 h-32 text-blue-500 mx-auto mb-8"
            strokeWidth={1.5}
          />
        </motion.div>

        <motion.h1
          {...ANIMATION_VARIANTS.fadeInUp}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="text-4xl font-bold text-slate-900 mb-4"
        >
          전송 완료
        </motion.h1>

        <motion.p
          {...ANIMATION_VARIANTS.fadeIn}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="text-lg text-slate-400 mt-8"
        >
          {timeoutSeconds}초 후 자동으로 처음 화면으로 돌아갑니다
        </motion.p>
      </motion.div>
    </div>
  );
}

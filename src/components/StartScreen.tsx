import { ShoppingBag, Store } from "lucide-react";
import { motion } from "framer-motion";
import type { OrderType } from "../types";

interface StartScreenProps {
  onSelect: (type: OrderType) => void;
}

const ORDER_OPTIONS = [
  {
    type: "takeout" as const,
    icon: ShoppingBag,
    label: "포장",
    color: "blue",
    animationDelay: 0.1,
    slideFrom: -50,
  },
  {
    type: "dinein" as const,
    icon: Store,
    label: "매장",
    color: "purple",
    animationDelay: 0.1,
    slideFrom: 50,
  },
];

export default function StartScreen({ onSelect }: StartScreenProps) {
  return (
    <div className="h-full flex flex-col items-center justify-around py-16 px-8 text-center">
      {/* 헤더 */}
      <motion.div
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
      >
        <h1 className="text-5xl font-extrabold text-slate-800 mb-4 tracking-tight">
          주문을 시작하시려면
        </h1>
        <p className="text-2xl text-slate-600">이용 방법을 선택해주세요</p>
      </motion.div>

      {/* 선택 버튼 */}
      <div className="flex flex-col gap-10 items-center justify-center w-full px-6">
        {ORDER_OPTIONS.map((option) => {
          const Icon = option.icon;
          return (
            <motion.button
              key={option.type}
              onClick={() => onSelect(option.type)}
              className={`group relative w-full max-w-sm h-72 bg-white rounded-3xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden border-4 border-transparent hover:border-${option.color}-500`}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              initial={{ opacity: 0, x: option.slideFrom }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                duration: 0.6,
                delay: option.animationDelay,
                ease: "easeOut",
              }}
            >
              <div className="relative h-full flex flex-col items-center justify-center p-8">
                <div
                  className={`w-32 h-32 rounded-full bg-${option.color}-50 flex items-center justify-center mb-6 transition-colors duration-300`}
                >
                  <Icon
                    className={`w-16 h-16 text-${option.color}-600 transition-transform duration-300 group-hover:scale-110`}
                    strokeWidth={1.5}
                  />
                </div>
                <h2 className="text-4xl font-bold text-slate-800">
                  {option.label}
                </h2>
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* 푸터 */}
      <motion.div
        className="text-center"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.4, ease: "easeOut" }}
      >
        <p className="text-lg text-slate-500">
          도움이 필요하시면 직원을 호출해주세요
        </p>
      </motion.div>
    </div>
  );
}

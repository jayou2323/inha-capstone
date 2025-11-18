import { ShoppingBag, Store } from "lucide-react";
import { motion } from "framer-motion";

interface StartScreenProps {
  onSelect: (type: "takeout" | "dinein") => void;
}

export default function StartScreen({ onSelect }: StartScreenProps) {
  return (
    <div className="h-full flex flex-col items-center justify-between py-16 px-12">
      {/* 헤더 */}
      <motion.div
        className="text-center"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <h1 className="text-3xl font-bold text-slate-800 mb-4">
          주문을 시작하시려면
        </h1>
        <p className="text-xl text-slate-600">화면을 터치해주세요</p>
      </motion.div>

      {/* 선택 버튼 */}
      <div className="flex gap-12 items-center justify-center">
        <motion.button
          onClick={() => onSelect("takeout")}
          className="group relative w-72 h-80 bg-white rounded-3xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <div className="absolute inset-0 bg-linear-to-br from-blue-500 to-blue-600 opacity-0 group-hover:opacity-10 transition-opacity duration-300" />

          <div className="relative h-full flex flex-col items-center justify-center p-8">
            <div className="w-32 h-32 rounded-full bg-blue-50 flex items-center justify-center mb-8 group-hover:bg-blue-100 transition-colors duration-300">
              <ShoppingBag
                className="w-16 h-16 text-blue-600"
                strokeWidth={1.5}
              />
            </div>

            <h2 className="text-2xl font-semibold text-slate-800 mb-3">포장</h2>
          </div>
        </motion.button>

        <motion.button
          onClick={() => onSelect("dinein")}
          className="group relative w-72 h-80 bg-white rounded-3xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <div className="absolute inset-0 bg-linear-to-br from-purple-500 to-purple-600 opacity-0 group-hover:opacity-10 transition-opacity duration-300" />

          <div className="relative h-full flex flex-col items-center justify-center p-8">
            <div className="w-32 h-32 rounded-full bg-purple-50 flex items-center justify-center mb-8 group-hover:bg-purple-100 transition-colors duration-300">
              <Store className="w-16 h-16 text-purple-600" strokeWidth={1.5} />
            </div>

            <h2 className="text-2xl font-semibold text-slate-800 mb-3">매장</h2>
          </div>
        </motion.button>
      </div>

      {/* 푸터 */}
      <motion.div
        className="text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4 }}
      >
        <p className="text-lg text-slate-400">
          문의사항이 있으시면 직원을 호출해주세요
        </p>
      </motion.div>
    </div>
  );
}

import { useEffect } from "react";
import { CheckCircle, ScrollText } from "lucide-react";
import type { CartItem } from "./Cart";

interface PaymentScreenProps {
  orderType: "takeout" | "dinein";
  items: CartItem[];
  totalPrice: number;
  onComplete: () => void;
}

export default function PaymentScreen({ onComplete }: PaymentScreenProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete();
    }, 10000); // 10초

    return () => clearTimeout(timer);
  }, [onComplete]);

  const handleReceiptChoice = (choice: "yes" | "no") => {
    if (choice === "yes") {
      // 실제로는 NFC 전송
      alert("영수증이 발급되었습니다.");
    }
    onComplete();
  };

  return (
    <div className="h-full flex items-center justify-center p-12">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden">
        {/* 결제 완료 헤더 */}
        <div className="bg-linear-to-r from-blue-500 to-purple-500 p-8 text-center">
          <CheckCircle className="w-20 h-20 text-white mx-auto mb-4" />
          <h1 className="text-4xl font-bold text-white mb-2">
            결제가 완료되었습니다
          </h1>
          <p className="text-xl text-white/90">이용해 주셔서 감사합니다</p>
        </div>

        {/* 영수증 선택 */}
        <div className="p-12">
          <div className="text-center mb-8">
            <ScrollText className="w-16 h-16 text-slate-400 mx-auto mb-4" />
            <h2 className="text-2xl text-slate-900">
              영수증을 발급하시겠습니까?
            </h2>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => handleReceiptChoice("yes")}
              className="flex-1 bg-linear-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white py-5 rounded-xl transition-all duration-300 flex items-center justify-center text-2xl font-bold"
            >
              발급
            </button>

            <button
              onClick={() => handleReceiptChoice("no")}
              className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 py-5 rounded-xl transition-all duration-300 flex items-center justify-center text-2xl font-bold"
            >
              미발급
            </button>
          </div>

          <p className="text-center text-slate-400 mt-6 text-lg">
            10초 후 자동으로 처음 화면으로 돌아갑니다.
          </p>
        </div>
      </div>
    </div>
  );
}

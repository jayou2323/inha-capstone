import { useEffect, useState } from "react";
import { CheckCircle, Loader2 } from "lucide-react";
import type { CartItem, OrderType } from "../types";
import { sendOrderData } from "../lib/api";
import { TIMINGS } from "../constants/animations";

interface PaymentScreenProps {
  orderType: OrderType;
  items: CartItem[];
  totalPrice: number;
  onNfcTransfer: (receiptUrl: string) => void;
  onPaperReceipt: () => void;
}

export default function PaymentScreen({
  orderType,
  items,
  totalPrice,
  onNfcTransfer,
  onPaperReceipt,
}: PaymentScreenProps) {
  const [isPaymentComplete, setIsPaymentComplete] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);

  // 1) 결제 처리: 결제 화면 진입 시 한 번만 실행 (items/price/type 변경 시에만 재실행)
  useEffect(() => {
    let isActive = true;

    const processPayment = async () => {
      console.log("processPayment");
      setIsLoading(true);
      try {
        const result = await sendOrderData(items, totalPrice, orderType);
        if (!isActive) return;

        if (result.success && result.shortUrl) {
          console.log("주문 데이터 전송 성공 (short_url):", result.shortUrl);
          setReceiptUrl(result.shortUrl);
        } else {
          console.error(
            "주문 데이터 전송 실패:",
            result.error ?? "알 수 없는 오류"
          );
        }
      } catch (error) {
        if (!isActive) return;
        console.error("결제 처리 중 오류:", error);
      } finally {
        if (!isActive) return;
        setIsPaymentComplete(true);
        setIsLoading(false);
      }
    };

    processPayment();

    return () => {
      isActive = false;
    };
  }, [items, totalPrice, orderType]);

  // 2) 자동 리다이렉트: receiptUrl 이 준비된 후 일정 시간 뒤에 NFC 화면으로 전환
  useEffect(() => {
    if (!receiptUrl) return;

    const timer = setTimeout(() => {
      onNfcTransfer(receiptUrl);
    }, TIMINGS.AUTO_REDIRECT_MS);
    return () => clearTimeout(timer);
  }, [onNfcTransfer, receiptUrl]);

  return (
    <div className="h-full flex items-center justify-center p-8">
      <div className="w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden">
        {/* 결제 완료 헤더 */}
        <div className="bg-linear-to-r from-blue-500 to-purple-500 p-8 text-center">
          {isLoading ? (
            <>
              <Loader2 className="w-16 h-16 text-white mx-auto mb-3 animate-spin" />
              <h1 className="text-2xl font-bold text-white mb-2">
                결제 처리중...
              </h1>
              <p className="text-xl text-white/90">잠시만 기다려주세요</p>
            </>
          ) : (
            <>
              <CheckCircle className="w-16 h-16 text-white mx-auto mb-3" />
              <h1 className="text-2xl font-bold text-white mb-2">
                결제가 완료되었습니다
              </h1>
              <p className="text-xl text-white/90">이용해 주셔서 감사합니다</p>
            </>
          )}
        </div>

        {/* 영수증 선택 */}
        {!isLoading && isPaymentComplete && (
          <div className="p-10">
            <div className="flex flex-col gap-4">
              <button
                onClick={() => receiptUrl && onNfcTransfer(receiptUrl)}
                disabled={!receiptUrl}
                className="flex-1 bg-linear-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white py-4 rounded-xl transition-all duration-300 flex items-center justify-center text-2xl font-bold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                영수증 발급받기
              </button>
              <button
                onClick={onPaperReceipt}
                className="flex-1 bg-white text-slate-800 py-4 rounded-xl border border-slate-200 hover:bg-slate-50 transition-all duration-200 text-2xl font-bold"
              >
                종이 영수증 발급받기
              </button>
            </div>

            <p className="text-center text-slate-400 mt-5 text-lg">
              10초 후 자동으로 화면이 전환됩니다.
            </p>
          </div>
        )}

        {isLoading && (
          <div className="p-8">
            <p className="text-center text-slate-400 text-base">
              주문 정보를 서버로 전송하는 중입니다...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

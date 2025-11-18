import {
  Trash2,
  Plus,
  Minus,
  CreditCard,
  ShoppingBag,
  Store,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface CartProps {
  items: CartItem[];
  orderType: "takeout" | "dinein";
  onUpdateQuantity: (id: string, quantity: number) => void;
  onRemove: (id: string) => void;
  onCheckout: () => void;
}

export default function Cart({
  items,
  orderType,
  onUpdateQuantity,
  onRemove,
  onCheckout,
}: CartProps) {
  const totalPrice = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  return (
    <div className="h-full flex flex-col bg-white rounded-3xl shadow-xl overflow-hidden">
      {/* 헤더 */}
      <div className="bg-linear-to-r from-blue-500 to-purple-500 p-6">
        <div className="flex items-center gap-3 mb-2">
          {orderType === "takeout" ? (
            <ShoppingBag className="w-8 h-8 text-white" />
          ) : (
            <Store className="w-8 h-8 text-white" />
          )}
          <h2 className="text-xl font-bold text-white">주문 내역</h2>
        </div>
        <p className="text-base text-white/80">
          {orderType === "takeout" ? "포장 주문" : "매장 주문"}
        </p>
      </div>

      {/* 장바구니 */}
      <div className="flex-1 overflow-y-auto p-6">
        <AnimatePresence>
          {items.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full flex flex-col items-center justify-center text-slate-400"
            >
              <ShoppingBag className="w-24 h-24 mb-4 opacity-30" />
              <p className="text-lg">선택된 메뉴가 없습니다</p>
            </motion.div>
          ) : (
            <motion.div layout className="space-y-4">
              {items.map((item) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  className="bg-slate-50 rounded-xl p-4"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-slate-800 mb-1">
                        {item.name}
                      </h3>
                      <p className="text-md font-bold text-blue-600">
                        {item.price.toLocaleString()}원
                      </p>
                    </div>
                    <button
                      onClick={() => onRemove(item.id)}
                      className="text-slate-400 hover:text-red-500 transition-colors p-1"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() =>
                        onUpdateQuantity(
                          item.id,
                          Math.max(0, item.quantity - 1)
                        )
                      }
                      className="w-8 h-8 rounded-lg bg-white hover:bg-slate-200 flex items-center justify-center transition-colors"
                    >
                      <Minus className="w-4 h-4 text-slate-600" />
                    </button>
                    <span className="w-12 text-center text-lg font-semibold text-slate-800">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() =>
                        onUpdateQuantity(item.id, item.quantity + 1)
                      }
                      className="w-8 h-8 rounded-lg bg-white hover:bg-slate-200 flex items-center justify-center transition-colors"
                    >
                      <Plus className="w-4 h-4 text-slate-600" />
                    </button>
                    <div className="ml-auto text-lg font-bold text-slate-800">
                      {(item.price * item.quantity).toLocaleString()}원
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 총액 및 결제 버튼 */}
      {items.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className="border-t border-slate-200 p-6 space-y-4"
        >
          <div className="flex items-center justify-between text-lg">
            <span className="text-slate-600">총 수량</span>
            <span className="font-semibold text-slate-800">
              {items.reduce((sum, item) => sum + item.quantity, 0)}개
            </span>
          </div>

          <div className="flex items-center justify-between text-xl">
            <span className="font-semibold text-slate-800">총 결제금액</span>
            <span className="font-bold text-blue-600">
              {totalPrice.toLocaleString()}원
            </span>
          </div>

          <button
            onClick={onCheckout}
            disabled={items.length === 0}
            className="w-full bg-linear-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 disabled:from-slate-300 disabled:to-slate-300 text-white py-4 rounded-xl transition-all duration-300 flex items-center justify-center gap-2 text-xl font-bold disabled:cursor-not-allowed"
          >
            <CreditCard className="w-6 h-6" />
            <span>{totalPrice.toLocaleString()}원 결제하기</span>
          </button>
        </motion.div>
      )}
    </div>
  );
}

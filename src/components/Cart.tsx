import { useMemo } from "react";
import {
  Trash2,
  Plus,
  Minus,
  CreditCard,
  ShoppingBag,
  Store,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { CartItem, OrderType } from "../types";
import { calculateTotalPrice, calculateTotalQuantity } from "../utils/cart";
import {
  ANIMATION_VARIANTS,
  TRANSITION_DEFAULTS,
} from "../constants/animations";

interface CartProps {
  items: CartItem[];
  orderType: OrderType;
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
  const totalPrice = useMemo(() => calculateTotalPrice(items), [items]);
  const totalQuantity = useMemo(() => calculateTotalQuantity(items), [items]);

  return (
    <div className="h-full flex flex-col bg-white">
      {/* 주문 내역 */}
      <div className="flex-1 flex flex-col p-4 overflow-hidden">
        <div className="flex items-center gap-2 mb-4">
          {orderType === "takeout" ? (
            <ShoppingBag className="w-6 h-6 text-blue-600" />
          ) : (
            <Store className="w-6 h-6 text-purple-600" />
          )}
          <h2 className="text-xl font-bold text-slate-800">주문 내역</h2>
          <span className="text-sm font-medium text-slate-500 ml-1">
            ({orderType === "takeout" ? "포장" : "매장"})
          </span>
        </div>

        <AnimatePresence>
          {items.length === 0 ? (
            <motion.div
              {...ANIMATION_VARIANTS.fadeIn}
              className="h-full flex flex-col items-center justify-center text-slate-400"
            >
              <ShoppingBag className="w-20 h-20 mb-4 opacity-30" />
              <p className="text-lg">선택된 메뉴가 없습니다</p>
            </motion.div>
          ) : (
            <motion.div layout className="space-y-3 overflow-y-auto pr-2">
              {items.map((item) => (
                <motion.div
                  key={item.id}
                  layout
                  {...ANIMATION_VARIANTS.slideLeft}
                  transition={{ ...TRANSITION_DEFAULTS.spring, stiffness: 400 }}
                  className="bg-slate-50 rounded-xl p-3 flex items-center"
                >
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-slate-800">
                      {item.name}
                    </h3>
                    <p className="text-md font-bold text-slate-500">
                      {item.price.toLocaleString()}원
                    </p>
                  </div>

                  <div className="flex items-center gap-2 mx-4">
                    <button
                      onClick={() => {
                        if (item.quantity === 1) {
                          onRemove(item.id);
                        } else {
                          onUpdateQuantity(item.id, item.quantity - 1);
                        }
                      }}
                      className="w-8 h-8 rounded-full bg-white hover:bg-slate-200 flex items-center justify-center transition-colors"
                    >
                      <Minus className="w-5 h-5 text-slate-600" />
                    </button>
                    <span className="w-10 text-center text-lg font-bold text-slate-800">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() =>
                        onUpdateQuantity(item.id, item.quantity + 1)
                      }
                      className="w-8 h-8 rounded-full bg-white hover:bg-slate-200 flex items-center justify-center transition-colors"
                    >
                      <Plus className="w-5 h-5 text-slate-600" />
                    </button>
                  </div>

                  <div className="w-28 text-right text-lg font-bold text-slate-800">
                    {(item.price * item.quantity).toLocaleString()}원
                  </div>

                  <button
                    onClick={() => onRemove(item.id)}
                    className="text-slate-400 hover:text-red-500 transition-colors p-1 ml-2"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 총액 및 결제 버튼 */}
      {items.length > 0 && (
        <motion.div
          {...ANIMATION_VARIANTS.slideUp}
          transition={TRANSITION_DEFAULTS.spring}
          className="bg-white border-t-2 border-slate-100 p-6 space-y-4"
        >
          <div className="flex items-center justify-between text-2xl">
            <span className="font-semibold text-slate-600">총 수량</span>
            <span className="font-bold text-slate-800">{totalQuantity}개</span>
          </div>

          <div className="flex items-center justify-between text-3xl">
            <span className="font-bold text-slate-800">총 결제금액</span>
            <span className="font-extrabold text-blue-600">
              {totalPrice.toLocaleString()}원
            </span>
          </div>

          <button
            onClick={onCheckout}
            disabled={items.length === 0}
            className="w-full bg-linear-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 disabled:opacity-50 text-white py-5 rounded-2xl transition-all duration-300 flex items-center justify-center gap-3 text-3xl font-bold disabled:cursor-not-allowed"
          >
            <CreditCard className="w-9 h-9" />
            <span>결제하기</span>
          </button>
        </motion.div>
      )}
    </div>
  );
}

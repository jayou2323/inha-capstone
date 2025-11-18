import { useState, useMemo, useCallback } from "react";
import { ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import MenuItem from "./MenuItem";
import Cart from "./Cart";
import type { CartItem, MenuItemType, OrderType } from "../types";
import { MENU_DATA, CATEGORIES } from "../constants/menu";
import { addItemToCart, calculateTotalPrice } from "../utils/cart";
import {
  ANIMATION_VARIANTS,
  TRANSITION_DEFAULTS,
} from "../constants/animations";

interface MenuScreenProps {
  orderType: OrderType;
  onBack: () => void;
  onCheckout: (items: CartItem[], totalPrice: number) => void;
}

export default function MenuScreen({
  orderType,
  onBack,
  onCheckout,
}: MenuScreenProps) {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  const filteredMenu = useMemo(
    () =>
      selectedCategory === "all"
        ? MENU_DATA
        : MENU_DATA.filter((item) => item.category === selectedCategory),
    [selectedCategory]
  );

  const handleAddToCart = useCallback((item: MenuItemType) => {
    setCartItems((prev) => addItemToCart(prev, item));
  }, []);

  const handleUpdateQuantity = useCallback((id: string, quantity: number) => {
    setCartItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, quantity } : item))
    );
  }, []);

  const handleRemoveItem = useCallback((id: string) => {
    setCartItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const handleCheckout = useCallback(() => {
    onCheckout(cartItems, calculateTotalPrice(cartItems));
  }, [cartItems, onCheckout]);

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 flex flex-col p-4 overflow-hidden">
        {/* 헤더 */}
        <motion.div
          {...ANIMATION_VARIANTS.slideDown}
          transition={TRANSITION_DEFAULTS.smooth}
          className="flex items-center justify-between mb-4"
        >
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-base text-slate-600 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>처음으로</span>
          </button>
        </motion.div>

        {/* 카테고리 */}
        <motion.div
          {...ANIMATION_VARIANTS.fadeIn}
          transition={{ ...TRANSITION_DEFAULTS.smooth, delay: 0.2 }}
          className="flex gap-2 mb-4"
        >
          {CATEGORIES.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`px-4 py-2 rounded-xl transition-all duration-300 text-sm font-semibold ${
                selectedCategory === category.id
                  ? "bg-linear-to-r from-blue-500 to-purple-500 text-white shadow-lg"
                  : "bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {category.name}
            </button>
          ))}
        </motion.div>

        {/* 메뉴판 */}
        <div className="flex-1 overflow-y-auto pr-2">
          <div className="grid grid-cols-4 gap-3 pb-4">
            {filteredMenu.map((item) => (
              <MenuItem key={item.id} item={item} onAdd={handleAddToCart} />
            ))}
          </div>
        </div>
      </div>

      {/* 장바구니 */}
      <motion.div
        {...ANIMATION_VARIANTS.slideUp}
        transition={{ ...TRANSITION_DEFAULTS.smooth, delay: 0.1 }}
        className="h-[480px] border-t-2 border-slate-200"
      >
        <Cart
          items={cartItems}
          orderType={orderType}
          onUpdateQuantity={handleUpdateQuantity}
          onRemove={handleRemoveItem}
          onCheckout={handleCheckout}
        />
      </motion.div>
    </div>
  );
}

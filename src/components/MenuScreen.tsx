import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import MenuItem, { type MenuItemType } from "./MenuItem";
import Cart, { type CartItem } from "./Cart";

interface MenuScreenProps {
  orderType: "takeout" | "dinein";
  onBack: () => void;
  onCheckout: (items: CartItem[], totalPrice: number) => void;
}

const MENU_DATA: MenuItemType[] = [
  {
    id: "1",
    name: "아메리카노",
    price: 4500,
    image: "/images/americano.jpg",
    category: "coffee",
  },
  {
    id: "2",
    name: "카페라떼",
    price: 5000,
    image: "/images/latte.jpg",
    category: "coffee",
  },
  {
    id: "3",
    name: "카푸치노",
    price: 5000,
    image: "/images/cappuccino.jpg",
    category: "coffee",
  },
  {
    id: "4",
    name: "에스프레소",
    price: 4000,
    image: "/images/espresso.jpg",
    category: "coffee",
  },
  {
    id: "5",
    name: "크루아상",
    price: 3500,
    image: "/images/croissant.jpg",
    category: "dessert",
  },
  {
    id: "6",
    name: "블루베리 머핀",
    price: 4000,
    image: "/images/muffin.jpg",
    category: "dessert",
  },
  {
    id: "7",
    name: "초코 케이크",
    price: 5500,
    image: "/images/cake.jpg",
    category: "dessert",
  },
  {
    id: "8",
    name: "클럽 샌드위치",
    price: 6500,
    image: "/images/sandwich.jpg",
    category: "food",
  },
];

const CATEGORIES = [
  { id: "all", name: "전체" },
  { id: "coffee", name: "커피" },
  { id: "dessert", name: "디저트" },
  { id: "food", name: "푸드" },
];

export default function MenuScreen({
  orderType,
  onBack,
  onCheckout,
}: MenuScreenProps) {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  const filteredMenu =
    selectedCategory === "all"
      ? MENU_DATA
      : MENU_DATA.filter((item) => item.category === selectedCategory);

  const handleAddToCart = (item: MenuItemType) => {
    setCartItems((prev) => {
      const existingItem = prev.find((cartItem) => cartItem.id === item.id);
      if (existingItem) {
        return prev.map((cartItem) =>
          cartItem.id === item.id
            ? { ...cartItem, quantity: cartItem.quantity + 1 }
            : cartItem
        );
      }
      return [
        ...prev,
        { id: item.id, name: item.name, price: item.price, quantity: 1 },
      ];
    });
  };

  const handleUpdateQuantity = (id: string, quantity: number) => {
    if (quantity === 0) {
      handleRemoveItem(id);
    } else {
      setCartItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, quantity } : item))
      );
    }
  };

  const handleRemoveItem = (id: string) => {
    setCartItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleCheckout = () => {
    const totalPrice = cartItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
    console.log("Checkout:", cartItems, totalPrice);
    // onCheckout(cartItems, totalPrice);
  };

  return (
    <div className="h-full flex gap-6 p-6">
      {/* 메뉴 */}
      <div className="flex-1 flex flex-col">
        {/* 헤더 */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center justify-between mb-6"
        >
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-lg text-slate-600 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
            <span>처음으로</span>
          </button>
          <div className="w-32" />
        </motion.div>

        {/* 카테고리 */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="flex gap-3 mb-6"
        >
          {CATEGORIES.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`px-6 py-3 rounded-xl transition-all duration-300 text-lg font-semibold ${
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
          <div className="grid grid-cols-3 gap-4 pb-4">
            {filteredMenu.map((item) => (
              <MenuItem key={item.id} item={item} onAdd={handleAddToCart} />
            ))}
          </div>
        </div>
      </div>

      {/* 장바구니 */}
      <motion.div
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.1, duration: 0.5 }}
        className="w-[400px]"
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

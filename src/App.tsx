import { useState } from "react";
import StartScreen from "./components/StartScreen";
import MenuScreen from "./components/MenuScreen";
import PaymentScreen from "./components/PaymentScreen";
import type { CartItem } from "./components/Cart";

export default function App() {
  const [screen, setScreen] = useState<"start" | "menu" | "payment">("start");
  const [orderType, setOrderType] = useState<"takeout" | "dinein">("takeout");

  const [completedOrder, setCompletedOrder] = useState<{
    items: CartItem[];
    totalPrice: number;
  } | null>(null);

  const handleSelectOrderType = (type: "takeout" | "dinein") => {
    setOrderType(type);
    setScreen("menu");
  };

  const handleBackToStart = () => {
    setScreen("start");
  };

  const handleCheckout = (items: CartItem[], totalPrice: number) => {
    setCompletedOrder({ items, totalPrice });
    setScreen("payment");
  };

  const handlePaymentComplete = () => {
    setCompletedOrder(null);
    setScreen("start");
  };

  return (
    <div className="w-[1280px] h-[720px] mx-auto bg-linaer-to-br from-slate-50 to-slate-100 overflow-hidden relative font-sans">
      <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />

      <div className="relative h-full">
        {screen === "start" && <StartScreen onSelect={handleSelectOrderType} />}
        {screen === "menu" && (
          <MenuScreen
            orderType={orderType}
            onBack={handleBackToStart}
            onCheckout={handleCheckout}
          />
        )}
        {screen === "payment" && completedOrder && (
          <PaymentScreen
            orderType={orderType}
            items={completedOrder.items}
            totalPrice={completedOrder.totalPrice}
            onComplete={handlePaymentComplete}
          />
        )}
      </div>
    </div>
  );
}

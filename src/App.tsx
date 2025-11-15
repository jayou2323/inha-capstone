import { useState } from "react";
import StartScreen from "./components/StartScreen";
import MenuScreen from "./components/MenuScreen";

export default function App() {
  const [screen, setScreen] = useState<"start" | "menu">("start");
  const [orderType, setOrderType] = useState<"takeout" | "dinein">("takeout");

  const handleSelectOrderType = (type: "takeout" | "dinein") => {
    setOrderType(type);
    setScreen("menu");
  };

  const handleBackToStart = () => {
    setScreen("start");
  };

  const handleCheckout = (items: unknown[], totalPrice: number) => {
    console.log("Checkout complete:", { items, totalPrice });
    setScreen("start");
  };

  return (
    <div className="w-[1280px] h-[720px] mx-auto bg-linaer-to-br from-slate-50 to-slate-100 overflow-hidden relative font-sans">
      <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />

      <div className="relative h-full">
        {screen === "start" && <StartScreen onSelect={handleSelectOrderType} />}
        {screen === "menu" && (
          <MenuScreen
            orderType={orderType}
            onBack={handleBackToStart}
            onCheckout={handleCheckout}
          />
        )}
      </div>
    </div>
  );
}

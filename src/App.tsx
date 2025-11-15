import { useState } from "react";
import StartScreen from "./components/StartScreen";

export default function App() {
  const [screen, setScreen] = useState<"start" | "menu">("start");
  const [orderType, setOrderType] = useState<"takeout" | "dinein" | null>(null);

  const handleSelectOrderType = (type: "takeout" | "dinein") => {
    setOrderType(type);
    setScreen("menu");
    console.log(`Order type selected: ${type}. Navigating to menu screen.`);
    setTimeout(() => {
      setScreen("start");
      console.log("Returning to start screen.");
    }, 2000);
  };

  return (
    <div className="w-[1280px] h-[720px] mx-auto bg-linear-to-br from-slate-50 to-slate-100 overflow-hidden relative">
      <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />

      <div className="relative h-full">
        {screen === "start" && <StartScreen onSelect={handleSelectOrderType} />}
        {screen === "menu" && (
          <div className="flex h-full items-center justify-center">
            <h1 className="text-4xl font-bold text-slate-800">
              메뉴 화면 (구현 예정)
            </h1>
            <p className="text-xl text-slate-600 mt-4">
              주문 유형: {orderType}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

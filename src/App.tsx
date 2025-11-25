import { useState, useCallback } from "react";
import StartScreen from "./components/StartScreen";
import MenuScreen from "./components/MenuScreen";
import PaymentScreen from "./components/PaymentScreen";
import NfcTagScreen from "./components/NfcTagScreen";
import NfcTagCompleteScreen from "./components/NfcTagComplete";
import type { CartItem, OrderType, ScreenType } from "./types";

export default function App() {
  const [screen, setScreen] = useState<ScreenType>("start");
  const [orderType, setOrderType] = useState<OrderType>("takeout");
  const [completedOrder, setCompletedOrder] = useState<{
    items: CartItem[];
    totalPrice: number;
  } | null>(null);

  const handleSelectOrderType = useCallback((type: OrderType) => {
    setOrderType(type);
    setScreen("menu");
  }, []);

  const handleBackToStart = useCallback(() => {
    setCompletedOrder(null);
    setScreen("start");
  }, []);

  const handleCheckout = useCallback(
    (items: CartItem[], totalPrice: number) => {
      setCompletedOrder({ items, totalPrice });
      setScreen("payment");
    },
    []
  );

  const handleNfcTransfer = useCallback(() => {
    setScreen("nfcTag");
  }, []);

  const handleNfcTagComplete = useCallback(() => {
    setScreen("nfcComplete");
  }, []);

  const handleNfcComplete = useCallback(() => {
    handleBackToStart();
  }, [handleBackToStart]);

  return (
    <div className="w-[720px] h-[1280px] bg-linear-to-br from-slate-50 to-slate-100 overflow-hidden relative font-sans">
      <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl" />

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
            onNfcTransfer={handleNfcTransfer}
          />
        )}

        {screen === "nfcTag" && (
          <NfcTagScreen onTagComplete={handleNfcTagComplete}/>
        )}

        {screen === "nfcComplete" && (
          <NfcTagCompleteScreen onComplete={handleNfcComplete} />
        )}
      </div>
    </div>
  );
}

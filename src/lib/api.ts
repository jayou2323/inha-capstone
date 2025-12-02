import axios from "axios";
import type { CartItem, NfcSession } from "../types";

interface OrderPayload {
  store_name: string;
  payment_time: string;
  order_type: "takeout" | "dinein";
  items: {
    name: string;
    qty: number;
    price: number;
  }[];
  tax: number;
  total: number;
}

export const sendOrderData = async (
  cartItems: CartItem[],
  totalPrice: number,
  orderType: "takeout" | "dinein"
) => {
  const paymentTime = new Date().toISOString().slice(0, 19).replace("T", " ");

  const payload: OrderPayload = {
    store_name: "집장인들",
    payment_time: paymentTime,
    order_type: orderType,
    items: cartItems.map((item) => ({
      name: item.name,
      qty: item.quantity,
      price: item.price,
    })),
    // 세금 대충 10%로 설정
    tax: Math.round(totalPrice * 0.1),
    total: totalPrice,
  };

  try {
    console.log("API Request:", payload);
    const response = await axios.post("/api/create", payload, {
      headers: {
        "Content-Type": "application/json",
      },
    });
    console.log("API Response:", response.data);
    return {
      success: true,
      orderId: response.data.orderId,
      data: response.data
    };
  } catch (error) {
    console.error("API Error:", error);
    if (axios.isAxiosError(error)) {
      console.error("Error response:", error.response?.data);
    }
    return { success: false, error };
  }
};

// NFC 브릿지 서버 Base URL (같은 기기에서 실행)
const NFC_BRIDGE_URL = "http://localhost:3001";

/**
 * NFC 세션 생성
 */
export const createNfcSession = async (
  orderId: string
): Promise<{ success: boolean; sessionId?: string; error?: any }> => {
  try {
    console.log(`[NFC API] Creating session for order: ${orderId}`);
    const response = await axios.post(
      `${NFC_BRIDGE_URL}/api/nfc/sessions`,
      { orderId },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
    console.log("[NFC API] Session created:", response.data);
    return {
      success: true,
      sessionId: response.data.sessionId,
    };
  } catch (error) {
    console.error("[NFC API] Session creation error:", error);
    return { success: false, error };
  }
};

/**
 * NFC 세션 상태 조회
 */
export const getNfcSessionStatus = async (
  sessionId: string
): Promise<NfcSession | null> => {
  try {
    const response = await axios.get(
      `${NFC_BRIDGE_URL}/api/nfc/sessions/${sessionId}`
    );
    return response.data;
  } catch (error) {
    console.error("[NFC API] Session status error:", error);
    return null;
  }
};

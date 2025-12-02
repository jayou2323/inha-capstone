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

    const rawData = response.data as any;
    // 1차: 최상위에 short_url 있는 경우
    let shortUrl: string | undefined = rawData?.short_url;

    // 2차: Lambda/API Gateway 형태로 body 안에 JSON 문자열로 들어있는 경우
    if (!shortUrl && rawData?.body) {
      try {
        const body =
          typeof rawData.body === "string"
            ? JSON.parse(rawData.body)
            : rawData.body;
        shortUrl = body?.short_url;
      } catch (e) {
        console.error("API Error: body JSON 파싱 실패", e, rawData.body);
      }
    }

    if (!shortUrl) {
      console.error("API Error: 응답에 short_url이 없습니다.", response.data);
      return {
        success: false,
        error: new Error("응답에 영수증 URL(short_url)이 없습니다."),
      };
    }

    return {
      success: true,
      shortUrl,
      data: response.data,
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
  receiptUrl: string
): Promise<{ success: boolean; sessionId?: string; error?: any }> => {
  try {
    console.log(`[NFC API] Creating session for receipt URL: ${receiptUrl}`);
    const response = await axios.post(
      `${NFC_BRIDGE_URL}/api/nfc/sessions`,
      // 서버는 orderId 필드를 요구하지만, 실제 NDEF에 쓸 것은 receiptUrl 이므로
      // 여기서는 receiptUrl을 함께 넘겨준다.
      { orderId: receiptUrl, receiptUrl },
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

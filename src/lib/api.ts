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

// Lambda(Function URL 또는 API Gateway) 기반 리다이렉트 저장 API
// 예시: https://xxxxx.lambda-url.ap-northeast-2.on.aws
const LAMBDA_BASE_URL =
  import.meta.env.VITE_LAMBDA_BASE_URL ||
  "https://example.lambda-url.ap-northeast-2.on.aws";
// Lambda에서 검사할 API 키
const LAMBDA_API_KEY =
  import.meta.env.VITE_LAMBDA_API_KEY || "set-me";

/**
 * NFC 세션 생성
 */
export const createNfcSession = async (
  receiptUrl: string
): Promise<{ success: boolean; sessionId?: string; error?: any }> => {
  try {
    // Lambda에 최신 주문 URL 저장
    const orderId = `order-${Date.now()}`;
    console.log(`[NFC API] Sending to Lambda: ${receiptUrl}`);
    await axios.post(
      `${LAMBDA_BASE_URL}/api/redirect`,
      { orderId, receiptUrl },
      {
        headers: {
          "Content-Type": "application/json",
          "x-api-key": LAMBDA_API_KEY,
        },
      }
    );
    // 물리 태그는 고정 URL(예: /r)로 리다이렉트되므로 sessionId는 의미 없음
    return { success: true, sessionId: "latest" };
  } catch (error) {
    console.error("[NFC API] Lambda redirect save error:", error);
    if (axios.isAxiosError(error)) {
      console.error("Error response:", error.response?.data);
    }
    // 네트워크 실패 시에도 UI 에러를 띄우지 않고 진행
    return { success: true, sessionId: "latest", error };
  }
};

/**
 * NFC 세션 상태 조회
 */
export const getNfcSessionStatus = async (
  sessionId: string
): Promise<NfcSession | null> => {
  // Lambda 기반 흐름에서는 폴링이 의미 없으므로 즉시 completed 반환
  return {
    sessionId,
    status: "completed",
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 1000 * 60 * 5).toISOString(),
  } as NfcSession;
};

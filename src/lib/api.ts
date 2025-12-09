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
// 개발 환경에서는 Vite 프록시를 통해 요청 (CORS 문제 우회)
// 프로덕션에서는 직접 Lambda Function URL 사용
const LAMBDA_BASE_URL = (
  import.meta.env.VITE_LAMBDA_BASE_URL ||
  "https://example.lambda-url.ap-northeast-2.on.aws"
).replace(/\/$/, "");
// Lambda에서 검사할 API 키
const LAMBDA_API_KEY =
  import.meta.env.VITE_LAMBDA_API_KEY || "set-me";

// 개발 환경에서는 프록시 사용, 프로덕션에서는 직접 Lambda URL 사용
const isDevelopment = import.meta.env.DEV;
const getLambdaUrl = (path: string) => {
  if (isDevelopment) {
    // 개발 환경: Vite 프록시 사용 (/lambda로 시작)
    return `/lambda${path}`;
  } else {
    // 프로덕션: 직접 Lambda Function URL 사용
    return `${LAMBDA_BASE_URL}${path}`;
  }
};

/**
 * NFC 세션 생성
 */
export const createNfcSession = async (
  receiptUrl: string
): Promise<{ success: boolean; sessionId?: string; error?: any }> => {
  try {
    console.log("[NFC API] Environment:", isDevelopment ? "development (using proxy)" : "production (direct)");
    console.log("[NFC API] LAMBDA_BASE_URL:", LAMBDA_BASE_URL);
    console.log("[NFC API] LAMBDA_API_KEY:", LAMBDA_API_KEY ? "***" : "NOT SET");
    // Lambda에 최신 주문 URL 저장
    const orderId = `order-${Date.now()}`;
    const url = getLambdaUrl("/api/redirect");
    const payload = { orderId, receiptUrl };
    console.log(`[NFC API] Sending POST to: ${url}`);
    console.log(`[NFC API] Payload:`, payload);
    
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    
    // 프로덕션 환경에서만 직접 헤더에 API 키 추가
    // 개발 환경에서는 프록시가 자동으로 추가함
    if (!isDevelopment) {
      headers["x-api-key"] = LAMBDA_API_KEY;
    }
    
    const response = await axios.post(
      url,
      payload,
      {
        headers,
        timeout: 10000, // 10초 timeout
        validateStatus: (status) => status < 500, // 5xx 에러만 throw
      }
    );
    
    console.log(`[NFC API] Response status: ${response.status}`);
    console.log(`[NFC API] Response data:`, response.data);
    
    // 물리 태그는 고정 URL(예: /r)로 리다이렉트되므로 sessionId는 의미 없음
    return { success: true, sessionId: "latest" };
  } catch (error) {
    console.error("[NFC API] Lambda redirect save error:", error);
    if (axios.isAxiosError(error)) {
      console.error("[NFC API] Error code:", error.code);
      console.error("[NFC API] Error message:", error.message);
      console.error("[NFC API] Error response status:", error.response?.status);
      console.error("[NFC API] Error response data:", error.response?.data);
      console.error("[NFC API] Error response headers:", error.response?.headers);
      
      // CORS 에러인지 확인
      if (error.code === "ERR_NETWORK" || error.message === "Network Error") {
        console.error("[NFC API] Network Error - 가능한 원인:");
        console.error("  1. CORS 설정 문제 (Lambda Function URL의 CORS 설정 확인 필요)");
        console.error("  2. 네트워크 연결 문제");
        console.error("  3. Lambda Function URL이 올바르지 않음");
        console.error("  4. 개발 환경에서는 Vite 프록시를 사용하도록 설정되어 있습니다.");
      }
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
  try {
    const url = getLambdaUrl("/api/session-status");
    const headers: Record<string, string> = {};
    if (!isDevelopment) {
      headers["x-api-key"] = LAMBDA_API_KEY;
    }

    const response = await axios.get(url, {
      headers,
      timeout: 8000,
      validateStatus: (status) => status < 500,
    });

    console.log("[NFC API] Session status response:", response.status, response.data);

    if (response.status !== 200) {
      console.warn("[NFC API] Session status not ready:", response.status, response.data);
      return null;
    }

    const data = response.data as {
      orderId?: string;
      receiptUrl?: string;
      status?: string;
      scannedAt?: number;
      updatedAt?: number;
    };

    const status = (data.status || "pending") as NfcSession["status"];
    const toIso = (ts?: number) =>
      typeof ts === "number" ? new Date(ts * 1000).toISOString() : undefined;

    return {
      sessionId,
      status,
      orderId: data.orderId,
      receiptUrl: data.receiptUrl,
      scannedAt: toIso(data.scannedAt),
      updatedAt: toIso(data.updatedAt),
      expiresAt: new Date(Date.now() + 1000 * 60 * 5).toISOString(),
    };
  } catch (error) {
    console.error("[NFC API] Session status fetch error:", error);
    return null;
  }
};

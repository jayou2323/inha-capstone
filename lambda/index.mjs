import { DynamoDBClient, GetItemCommand, PutItemCommand } from "@aws-sdk/client-dynamodb";

// 환경 변수
const TABLE_NAME = process.env.TABLE_NAME || "nfc-latest";
const REGION = process.env.AWS_REGION || "ap-northeast-2";
const TTL_HOURS = parseInt(process.env.TTL_HOURS || "24", 10);
// 반드시 설정 권장: 키오스크만 호출 가능하게 방어
const API_KEY = process.env.API_KEY;

const db = new DynamoDBClient({ region: REGION });

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,x-api-key,X-API-Key",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const json = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json", ...corsHeaders },
  body: JSON.stringify(body),
});

// 헤더를 대소문자 무시하고 찾는 헬퍼 함수
const getHeader = (headers = {}, name) => {
  if (!headers) return undefined;
  const lowerName = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === lowerName) return value;
  }
  return undefined;
};

const ensureApiKey = (headers = {}) => {
  if (!API_KEY) return false; // 미설정이면 거부
  const key = getHeader(headers, "x-api-key");
  return key === API_KEY;
};

async function handleSave(event) {
  if (!ensureApiKey(event.headers)) {
    return json(401, { error: "unauthorized" });
  }
  if (!event.body) return json(400, { error: "body required" });

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch {
    return json(400, { error: "invalid json" });
  }

  const { orderId, receiptUrl } = payload;
  if (!orderId || !receiptUrl) {
    return json(400, { error: "orderId and receiptUrl required" });
  }

  const now = Math.floor(Date.now() / 1000);
  const ttl = now + TTL_HOURS * 3600;

  await db.send(
    new PutItemCommand({
      TableName: TABLE_NAME,
      Item: {
        pk: { S: "latest" },
        orderId: { S: orderId },
        receiptUrl: { S: receiptUrl },
        status: { S: "pending" },
        updatedAt: { N: `${now}` },
        ttl: { N: `${ttl}` },
      },
    })
  );

  return json(200, { success: true, redirectUrl: "/r" });
}

async function handleRedirect() {
  const res = await db.send(
    new GetItemCommand({
      TableName: TABLE_NAME,
      Key: { pk: { S: "latest" } },
      ConsistentRead: true,
    })
  );

  const item = res.Item;
  const receiptUrl = item?.receiptUrl?.S;
  if (!receiptUrl) return json(404, { error: "not found or expired" });

  // /r 접근 시 자동으로 상태를 scanned 로 업데이트
  const now = Math.floor(Date.now() / 1000);
  const ttl = now + TTL_HOURS * 3600;
  await db.send(
    new PutItemCommand({
      TableName: TABLE_NAME,
      Item: {
        pk: { S: "latest" },
        orderId: item.orderId || { S: "unknown" },
        receiptUrl: { S: receiptUrl },
        status: { S: "scanned" },
        scannedAt: { N: `${now}` },
        updatedAt: { N: `${now}` },
        ttl: { N: `${ttl}` },
      },
    })
  );

  return {
    statusCode: 302,
    headers: { Location: receiptUrl },
    body: "",
  };
}

async function handleScanComplete(event) {
  if (!ensureApiKey(event.headers)) {
    return json(401, { error: "unauthorized" });
  }
  if (!event.body) return json(400, { error: "body required" });

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch {
    return json(400, { error: "invalid json" });
  }

  const { orderId } = payload;
  if (!orderId) return json(400, { error: "orderId required" });

  const now = Math.floor(Date.now() / 1000);
  const ttl = now + TTL_HOURS * 3600;

  await db.send(
    new PutItemCommand({
      TableName: TABLE_NAME,
      Item: {
        pk: { S: "latest" },
        orderId: { S: orderId },
        status: { S: "scanned" },
        scannedAt: { N: `${now}` },
        updatedAt: { N: `${now}` },
        ttl: { N: `${ttl}` },
      },
    })
  );

  return json(200, { success: true, status: "scanned", orderId });
}

async function handleSessionStatus() {
  const res = await db.send(
    new GetItemCommand({
      TableName: TABLE_NAME,
      Key: { pk: { S: "latest" } },
      ConsistentRead: true,
    })
  );

  const item = res.Item;
  if (!item) return json(404, { error: "not found or expired" });

  return json(200, {
    orderId: item.orderId?.S,
    receiptUrl: item.receiptUrl?.S,
    status: item.status?.S || "pending",
    scannedAt: item.scannedAt?.N ? Number(item.scannedAt.N) : undefined,
    updatedAt: item.updatedAt?.N ? Number(item.updatedAt.N) : undefined,
  });
}

// Lambda URL은 기본으로 HTTP API(v2) 포맷을 사용함
const getMethodAndPath = (event) => {
  const method =
    event.httpMethod ||
    event?.requestContext?.http?.method ||
    event?.requestContext?.httpMethod;
  const path =
    event.path ||
    event?.rawPath ||
    event?.requestContext?.http?.path ||
    "/";
  return { method, path };
};

export const handler = async (event) => {
  try {
    const { method: httpMethod, path } = getMethodAndPath(event);

    // CORS preflight
    if ((httpMethod || "").toUpperCase() === "OPTIONS") {
      return { 
        statusCode: 200, 
        headers: corsHeaders, 
        body: "" 
      };
    }

    const method = (httpMethod || "").toUpperCase();

    if (method === "POST" && path?.endsWith("/api/redirect")) {
      return handleSave(event);
    }
    if (method === "POST" && path?.endsWith("/api/scan-complete")) {
      return handleScanComplete(event);
    }
    if (method === "GET" && path?.endsWith("/api/session-status")) {
      return handleSessionStatus();
    }
    if (method === "GET" && (path === "/r" || path?.endsWith("/r"))) {
      const res = await handleRedirect();
      // redirect 응답에도 CORS 헤더 추가
      return { 
        ...res, 
        headers: { 
          ...(res.headers || {}), 
          ...corsHeaders 
        } 
      };
    }
    return json(404, { error: "not found", path, method });
  } catch (error) {
    // 에러 발생 시에도 CORS 헤더 포함
    console.error("Lambda handler error:", error);
    return json(500, { 
      error: "internal server error", 
      message: error.message 
    });
  }
};


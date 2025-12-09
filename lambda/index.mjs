import { DynamoDBClient, GetItemCommand, PutItemCommand } from "@aws-sdk/client-dynamodb";

// 환경 변수
const TABLE_NAME = process.env.TABLE_NAME || "nfc-latest";
const REGION = process.env.AWS_REGION || "ap-northeast-2";
const TTL_HOURS = parseInt(process.env.TTL_HOURS || "24", 10);
// 반드시 설정 권장: 키오스크만 호출 가능하게 방어
const API_KEY = process.env.API_KEY;

const db = new DynamoDBClient({ region: REGION });

const json = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

const ensureApiKey = (headers = {}) => {
  if (!API_KEY) return false; // 미설정이면 거부
  const key = headers["x-api-key"] || headers["X-API-Key"];
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

  return {
    statusCode: 302,
    headers: { Location: receiptUrl },
    body: "",
  };
}

export const handler = async (event) => {
  const { httpMethod, path } = event;

  if (httpMethod === "POST" && path?.endsWith("/api/redirect")) {
    return handleSave(event);
  }
  if (httpMethod === "GET" && (path === "/r" || path?.endsWith("/r"))) {
    return handleRedirect();
  }
  return json(404, { error: "not found" });
};


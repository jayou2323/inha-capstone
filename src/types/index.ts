export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export interface MenuItemType {
  id: string;
  name: string;
  price: number;
  image: string;
  category: string;
}

export type OrderType = "takeout" | "dinein";

export type ScreenType =
  | "start"
  | "menu"
  | "payment"
  | "nfcTag"
  | "nfcComplete";

export type NfcTransferType = "ticketOnly" | "ticketWithReceipt";

export interface Category {
  id: string;
  name: string;
}

// NFC 관련 타입
export interface NfcSession {
  sessionId: string;
  status:
    | "pending"
    | "ready"
    | "tagging"
    | "scanned"
    | "completed"
    | "expired"
    | "failed";
  expiresAt: string;
  orderId?: string;
  receiptUrl?: string;
  scannedAt?: string;
  updatedAt?: string;
  message?: string;
}

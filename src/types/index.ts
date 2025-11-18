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

export type ScreenType = "start" | "menu" | "payment";

export interface Category {
  id: string;
  name: string;
}

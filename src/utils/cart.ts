import type { CartItem } from "../types";

export const calculateTotalPrice = (items: CartItem[]): number => {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
};

export const calculateTotalQuantity = (items: CartItem[]): number => {
  return items.reduce((sum, item) => sum + item.quantity, 0);
};

export const addItemToCart = (
  items: CartItem[],
  newItem: { id: string; name: string; price: number }
): CartItem[] => {
  const existingItem = items.find((item) => item.id === newItem.id);

  if (existingItem) {
    return items.map((item) =>
      item.id === newItem.id ? { ...item, quantity: item.quantity + 1 } : item
    );
  }

  return [...items, { ...newItem, quantity: 1 }];
};

export const updateItemQuantity = (
  items: CartItem[],
  id: string,
  quantity: number
): CartItem[] => {
  return items.map((item) => (item.id === id ? { ...item, quantity } : item));
};

export const removeItemFromCart = (
  items: CartItem[],
  id: string
): CartItem[] => {
  return items.filter((item) => item.id !== id);
};

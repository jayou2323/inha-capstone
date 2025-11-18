import type { MenuItemType, Category } from "../types";

export const MENU_DATA: MenuItemType[] = [
  {
    id: "1",
    name: "아메리카노",
    price: 4500,
    image: "/images/americano.jpg",
    category: "coffee",
  },
  {
    id: "2",
    name: "카페라떼",
    price: 5000,
    image: "/images/latte.jpg",
    category: "coffee",
  },
  {
    id: "3",
    name: "카푸치노",
    price: 5000,
    image: "/images/cappuccino.jpg",
    category: "coffee",
  },
  {
    id: "4",
    name: "에스프레소",
    price: 4000,
    image: "/images/espresso.jpg",
    category: "coffee",
  },
  {
    id: "5",
    name: "크루아상",
    price: 3500,
    image: "/images/croissant.jpg",
    category: "dessert",
  },
  {
    id: "6",
    name: "블루베리 머핀",
    price: 4000,
    image: "/images/muffin.jpg",
    category: "dessert",
  },
  {
    id: "7",
    name: "케이크",
    price: 5500,
    image: "/images/cake.jpg",
    category: "dessert",
  },
  {
    id: "8",
    name: "샌드위치",
    price: 6500,
    image: "/images/sandwich.jpg",
    category: "food",
  },
];

export const CATEGORIES: Category[] = [
  { id: "all", name: "전체" },
  { id: "coffee", name: "커피" },
  { id: "dessert", name: "디저트" },
  { id: "food", name: "푸드" },
];

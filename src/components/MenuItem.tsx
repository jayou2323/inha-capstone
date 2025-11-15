import { ImageWithFallback } from "./ui/ImageWithFallback";

export interface MenuItemType {
  id: string;
  name: string;
  price: number;
  image: string;
  category: string;
}

interface MenuItemProps {
  item: MenuItemType;
  onAdd: (item: MenuItemType) => void;
}

export default function MenuItem({ item, onAdd }: MenuItemProps) {
  return (
    <button
      onClick={() => onAdd(item)}
      className="group relative bg-white rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden"
    >
      <div className="aspect-square overflow-hidden bg-slate-100">
        <ImageWithFallback
          src={item.image}
          alt={item.name}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
        />
      </div>

      <div className="p-4">
        <h3 className="text-lg font-semibold text-slate-800 mb-2 truncate">
          {item.name}
        </h3>
        <p className="text-lg font-bold text-blue-600">
          {item.price.toLocaleString()}원
        </p>
      </div>
    </button>
  );
}

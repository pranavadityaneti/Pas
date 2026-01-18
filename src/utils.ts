import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatQuantity = (qty: number, type: string) => {
    if (type === 'weight') {
        if (qty < 1000) return `${qty}g`;
        return `${(qty / 1000).toFixed(1).replace('.0', '')}kg`;
    }
    return `${qty}`;
}

export const calculateItemCost = (qty: number, price: number, type: string) => {
    if (type === 'weight') {
        return (qty / 1000) * price;
    }
    return qty * price;
}

export const getIncrement = (type: string) => {
    return type === 'weight' ? 250 : 1;
}

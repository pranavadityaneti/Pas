import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export functioncn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

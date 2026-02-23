import type { Metadata } from "next";
import { Inter, DM_Sans } from "next/font/google";
import "./globals.css";


const inter = Inter({ subsets: ["latin"] });
const dmSans = DM_Sans({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-dm-sans" });

export const metadata: Metadata = {
  title: "Pick At Store",
  description: "Skip the queue. Shop local.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning className={`${inter.className} ${dmSans.variable}`}>{children}</body>
    </html>
  );
}

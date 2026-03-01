import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { StoreProvider } from "@/context/StoreContext";
import { BottomNavBar } from "@/components/navigation/BottomNavBar";
import { ViewCartBar } from "@/components/navigation/ViewCartBar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "Pick At Store",
    description: "Shop from your favorite local stores",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body className={inter.className}>
                <StoreProvider>
                    <main className="pb-20">
                        {children}
                    </main>
                    <ViewCartBar />
                    <BottomNavBar />
                </StoreProvider>
            </body>
        </html>



    );
}

"use client";

import { createContext, useContext, useState, ReactNode } from "react";

export type HeroState = "intro" | "fan" | "stack" | "descend" | "spread" | "showcase" | "bento" | "footer";

interface HeroContextType {
    state: HeroState;
    setState: (state: HeroState) => void;
    nextState: () => void;
    appMode: "customer" | "merchant";
    setAppMode: (mode: "customer" | "merchant") => void;
}

const HeroContext = createContext<HeroContextType | undefined>(undefined);

export function HeroProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<HeroState>("intro");
    const [appMode, setAppMode] = useState<"customer" | "merchant">("customer");

    const nextState = () => {
        setState((prev) => {
            if (prev === "intro") return "fan";
            if (prev === "fan") return "stack";
            if (prev === "stack") return "bento";
            return "intro";
        });
    };

    return (
        <HeroContext.Provider value={{ state, setState, nextState, appMode, setAppMode }}>
            {children}
        </HeroContext.Provider>
    );
}

export const useHero = () => {
    const context = useContext(HeroContext);
    if (!context) throw new Error("useHero must be used within HeroProvider");
    return context;
};

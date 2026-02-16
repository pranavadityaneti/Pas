"use client";

import { DotLottieReact } from '@lottiefiles/dotlottie-react';

export function LottieSection() {
    return (
        <div className="w-full flex justify-center py-20 bg-[#FAF9F6]">
            <div className="w-full max-w-4xl">
                <DotLottieReact
                    src="https://lottie.host/21dca8d6-dbea-424f-8340-ee74e855f374/VkvMmnbvnd.lottie"
                    loop
                    autoplay
                    backgroundColor="transparent"
                    style={{ backgroundColor: 'transparent' }}
                    className="w-full h-auto"
                />
            </div>
        </div>
    );
}

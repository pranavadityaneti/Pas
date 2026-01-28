
import React from 'react';
import { MapPin } from 'lucide-react';

interface LocationPickerProps {
    value: { lat: number; lng: number };
    onChange: (lat: number, lng: number) => void;
}

export function LocationPicker({ value, onChange }: LocationPickerProps) {
    return (
        <div className="relative h-44 w-full rounded-xl overflow-hidden bg-gradient-to-br from-blue-50 via-gray-50 to-blue-100 border border-gray-200 shadow-sm">
            {/* Decorative grid pattern */}
            <div
                className="absolute inset-0 opacity-30"
                style={{
                    backgroundImage: `
                        linear-gradient(rgba(0,0,0,0.03) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px)
                    `,
                    backgroundSize: '20px 20px'
                }}
            />

            {/* Center content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                {/* Animated pin with pulse */}
                <div className="relative">
                    <div className="absolute inset-0 -m-2 bg-blue-400/20 rounded-full animate-ping" />
                    <div className="relative bg-white p-3 rounded-full shadow-lg border border-gray-100">
                        <MapPin className="w-6 h-6 text-blue-600" />
                    </div>
                </div>

                {/* Label */}
                <div className="mt-4 text-center">
                    <p className="text-sm font-medium text-gray-700">Click to select location</p>
                    <p className="text-xs text-gray-400 mt-1">
                        {value.lat.toFixed(4)}°N, {value.lng.toFixed(4)}°E
                    </p>
                </div>
            </div>

            {/* Decorative corner markers */}
            <div className="absolute top-3 left-3 w-4 h-4 border-l-2 border-t-2 border-gray-300 rounded-tl-sm" />
            <div className="absolute top-3 right-3 w-4 h-4 border-r-2 border-t-2 border-gray-300 rounded-tr-sm" />
            <div className="absolute bottom-3 left-3 w-4 h-4 border-l-2 border-b-2 border-gray-300 rounded-bl-sm" />
            <div className="absolute bottom-3 right-3 w-4 h-4 border-r-2 border-b-2 border-gray-300 rounded-br-sm" />
        </div>
    );
}

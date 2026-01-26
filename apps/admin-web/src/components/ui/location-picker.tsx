
import React from 'react';
import { Button } from './button';
import { MapPin } from 'lucide-react';

interface LocationPickerProps {
    value: { lat: number; lng: number };
    onChange: (lat: number, lng: number) => void;
}

export function LocationPicker({ value, onChange }: LocationPickerProps) {
    return (
        <div className="h-40 w-full bg-gray-100 rounded-lg flex flex-col items-center justify-center border-2 border-dashed border-gray-300">
            <MapPin className="h-8 w-8 text-gray-400 mb-2" />
            <p className="text-sm text-gray-500 font-medium">Map Integration Pending</p>
            <p className="text-xs text-gray-400">Lat: {value.lat}, Lng: {value.lng}</p>
        </div>
    );
}

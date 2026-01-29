import { useEffect, useRef, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Crosshair, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

// Fix for default marker icon in Leaflet with Vite
const customIcon = new L.Icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

interface LocationPickerProps {
    value: { lat: number; lng: number };
    onChange: (lat: number, lng: number) => void;
}

// Component to handle map click events
function MapClickHandler({ onChange }: { onChange: (lat: number, lng: number) => void }) {
    useMapEvents({
        click(e) {
            onChange(e.latlng.lat, e.latlng.lng);
        },
    });
    return null;
}

// Component to handle map resize and initialization
function MapResizer() {
    const map = useMap();
    useEffect(() => {
        const timer = setTimeout(() => {
            map.invalidateSize();
        }, 100);
        return () => clearTimeout(timer);
    }, [map]);
    return null;
}

// Component to fly map to new location
function MapFlyTo({ lat, lng }: { lat: number; lng: number }) {
    const map = useMap();
    const prevLatRef = useRef(lat);
    const prevLngRef = useRef(lng);

    useEffect(() => {
        if (Math.abs(lat - prevLatRef.current) > 0.0001 || Math.abs(lng - prevLngRef.current) > 0.0001) {
            map.flyTo([lat, lng], 16, { duration: 1 });
            prevLatRef.current = lat;
            prevLngRef.current = lng;
        }
    }, [map, lat, lng]);

    return null;
}

export function LocationPicker({ value, onChange }: LocationPickerProps) {
    const [mapKey, setMapKey] = useState(0);
    const [isLocating, setIsLocating] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const observer = new ResizeObserver(() => {
            setMapKey(prev => prev + 1);
        });

        if (containerRef.current) {
            observer.observe(containerRef.current);
        }

        return () => observer.disconnect();
    }, []);

    const handleGetCurrentLocation = useCallback(() => {
        if (!navigator.geolocation) {
            toast.error('Geolocation not supported');
            return;
        }

        setIsLocating(true);

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                onChange(latitude, longitude);
                setIsLocating(false);
                toast.success('Location found!');
            },
            (error) => {
                setIsLocating(false);
                if (error.code === error.PERMISSION_DENIED) {
                    toast.error('Location access denied');
                } else {
                    toast.error('Could not get location');
                }
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
        );
    }, [onChange]);

    return (
        <div
            ref={containerRef}
            className="relative w-full rounded-xl overflow-hidden border-2 border-gray-200 shadow-sm"
            style={{ height: '200px' }}
        >
            <MapContainer
                key={mapKey}
                center={[value.lat, value.lng]}
                zoom={15}
                scrollWheelZoom={true}
                style={{ height: '100%', width: '100%' }}
                className="z-0"
            >
                <TileLayer
                    attribution='&copy; OpenStreetMap'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <Marker
                    position={[value.lat, value.lng]}
                    icon={customIcon}
                    draggable={true}
                    eventHandlers={{
                        dragend: (e) => {
                            const marker = e.target;
                            const position = marker.getLatLng();
                            onChange(position.lat, position.lng);
                        },
                    }}
                />
                <MapClickHandler onChange={onChange} />
                <MapResizer />
                <MapFlyTo lat={value.lat} lng={value.lng} />
            </MapContainer>

            {/* Use My Location button */}
            <button
                type="button"
                onClick={handleGetCurrentLocation}
                disabled={isLocating}
                className="absolute z-[1000] bg-white hover:bg-gray-50 
                           shadow-md border border-gray-200 rounded-lg p-2.5
                           transition-all duration-200 hover:shadow-lg
                           disabled:opacity-50 disabled:cursor-not-allowed
                           group"
                style={{ top: '8px', right: '8px' }}
                title="Use my current location"
            >
                {isLocating ? (
                    <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                ) : (
                    <Crosshair className="w-5 h-5 text-gray-600 group-hover:text-blue-600 transition-colors" />
                )}
            </button>

            {/* Coordinates display */}
            <div className="absolute bottom-2 left-2 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 shadow-sm border border-gray-100 z-[1000]">
                📍 {value.lat.toFixed(5)}, {value.lng.toFixed(5)}
            </div>
        </div>
    );
}

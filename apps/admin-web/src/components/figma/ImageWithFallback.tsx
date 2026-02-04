import { useState, ImgHTMLAttributes } from 'react';
import { Image } from 'lucide-react';

interface ImageWithFallbackProps extends ImgHTMLAttributes<HTMLImageElement> {
    fallbackSrc?: string;
}

export function ImageWithFallback({
    src,
    alt,
    fallbackSrc = 'https://placehold.co/400x400/e2e8f0/1e293b?text=No+Image',
    className,
    ...props
}: ImageWithFallbackProps) {
    const [error, setError] = useState(false);

    if (error || !src) {
        return (
            <div className={`flex items-center justify-center bg-gray-100 ${className}`}>
                {/* If we have a fallback URL that is valid, try that, otherwise show Icon */}
                {fallbackSrc.startsWith('http') ? (
                    <img
                        src={fallbackSrc}
                        alt={alt}
                        className={className}
                        {...props}
                    />
                ) : (
                    <Image className="w-6 h-6 text-gray-400" />
                )}
            </div>
        );
    }

    return (
        <img
            src={src}
            alt={alt}
            className={className}
            onError={() => setError(true)}
            {...props}
        />
    );
}

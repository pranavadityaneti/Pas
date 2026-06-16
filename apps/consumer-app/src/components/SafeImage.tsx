import React, { useState } from 'react';
import { Image, ImageStyle, StyleProp, ImageResizeMode, ImageSourcePropType } from 'react-native';

// Phase 3 Item 3 (2026-06-16): a product <Image> that falls back to a placeholder
// when its source fails to load — e.g. hotlinked cdn.grofers.com URLs that
// block / expire / IP-restrict before the Phase 5 re-host to Supabase. Each
// instance owns its error state, so it works inside lists/maps (where a hook can't).
//
// NativeWind v2 note: this app transforms `className` at COMPILE time per JSX
// element, so a `className` passed through a wrapper would be dropped. SafeImage
// therefore takes plain RN `style` (universally safe); callers translate their
// image className to the equivalent style object.

const DEFAULT_FALLBACK =
  'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&h=400&fit=crop';

interface SafeImageProps {
  source: ImageSourcePropType;
  style?: StyleProp<ImageStyle>;
  resizeMode?: ImageResizeMode;
  /** Override the default placeholder shown on load failure. */
  fallbackUri?: string;
}

export default function SafeImage({
  source,
  style,
  resizeMode,
  fallbackUri = DEFAULT_FALLBACK,
}: SafeImageProps) {
  const [errored, setErrored] = useState(false);
  return (
    <Image
      source={errored ? { uri: fallbackUri } : source}
      style={style}
      resizeMode={resizeMode}
      onError={() => setErrored(true)}
    />
  );
}

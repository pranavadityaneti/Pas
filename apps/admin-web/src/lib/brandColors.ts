/**
 * PickAtStore Brand Colors
 * 
 * This is the centralized color configuration based on the brand guidelines.
 * Use these colors across all apps: Super Admin Dashboard, Merchant App, 
 * Merchant Dashboard, and Customer App.
 */

// =============================================================================
// PRIMARY PALETTE
// The central colors for Pick at Store. These should be prominent in all communication.
// =============================================================================

export const brand = {
    // Primary Colors
    primary: {
        storeRed: '#B52725',      // Main brand red - CTAs, primary actions
        locationYellow: '#FFCC05', // Secondary accent - highlights, badges
        vistaWhite: '#FDFCFA',     // Background, light surfaces
        blackShadow: '#121212',    // Text, dark surfaces, buttons
    },

    // Store Red Variants (for secondary elements: graphs, tables, accents)
    red: {
        100: '#B42926',  // Full saturation
        80: '#C35451',   // Lighter
        60: '#D27F7D',   // Medium
        40: '#E1A9A8',   // Light
    },

    // Location Yellow Variants
    yellow: {
        120: '#BF9905',  // Darker/richer
        100: '#FFCC07',  // Full saturation
        60: '#FFE06A',   // Medium
        40: '#FFEB9C',   // Light
    },
} as const;

// =============================================================================
// SEMANTIC COLORS
// Map brand colors to UI purposes
// =============================================================================

export const colors = {
    // Backgrounds
    background: {
        primary: brand.primary.vistaWhite,
        dark: brand.primary.blackShadow,
        surface: '#FFFFFF',
        muted: '#F5F5F5',
    },

    // Text
    text: {
        primary: brand.primary.blackShadow,
        secondary: '#6B7280',
        muted: '#9CA3AF',
        inverse: '#FFFFFF',
        link: brand.primary.storeRed,
    },

    // Actions
    action: {
        primary: brand.primary.blackShadow,      // Primary buttons
        primaryHover: '#2D2D2D',
        secondary: brand.primary.storeRed,       // Secondary buttons
        secondaryHover: '#9A1F1D',
        accent: brand.primary.locationYellow,    // Accent/highlight
        accentHover: brand.yellow[120],
    },

    // Status Colors
    status: {
        success: '#22C55E',
        successLight: '#DCFCE7',
        warning: brand.primary.locationYellow,
        warningLight: brand.yellow[40],
        error: brand.primary.storeRed,
        errorLight: brand.red[40],
        info: '#3B82F6',
        infoLight: '#DBEAFE',
    },

    // Navigation / Sidebar
    nav: {
        background: brand.primary.blackShadow,
        text: '#9CA3AF',
        textActive: '#FFFFFF',
        itemActive: brand.primary.storeRed,
        itemHover: 'rgba(255, 255, 255, 0.1)',
    },

    // Borders
    border: {
        default: '#E5E7EB',
        focus: brand.primary.storeRed,
        muted: '#D1D5DB',
    },
} as const;

// =============================================================================
// GRADIENT PRESETS
// =============================================================================

export const gradients = {
    brandPrimary: `linear-gradient(135deg, ${brand.primary.storeRed} 0%, ${brand.primary.locationYellow} 100%)`,
    brandSubtle: `linear-gradient(135deg, ${brand.red[60]} 0%, ${brand.yellow[60]} 100%)`,
    warmGlow: `linear-gradient(135deg, #ff6b35 0%, #f7931e 25%, #ffcc33 50%, #ff6b35 75%, #e55d30 100%)`,
} as const;

// =============================================================================
// TAILWIND-STYLE CLASS HELPERS
// Use these with inline styles or custom classNames
// =============================================================================

export const tw = {
    // Background classes
    bgPrimary: { backgroundColor: brand.primary.storeRed },
    bgSecondary: { backgroundColor: brand.primary.locationYellow },
    bgDark: { backgroundColor: brand.primary.blackShadow },
    bgLight: { backgroundColor: brand.primary.vistaWhite },

    // Text classes
    textPrimary: { color: brand.primary.blackShadow },
    textAccent: { color: brand.primary.storeRed },
    textHighlight: { color: brand.primary.locationYellow },
    textInverse: { color: '#FFFFFF' },

    // Border classes
    borderAccent: { borderColor: brand.primary.storeRed },
} as const;

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type BrandColor = typeof brand;
export type SemanticColors = typeof colors;

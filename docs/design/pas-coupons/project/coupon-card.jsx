// coupon-card.jsx — the shared coupon ticket. Used in admin preview + customer surfaces.
// Exports to window: CouponCard, formatValue, genCode, money
// Scaling: every dimension derives from the `w` (width in px) prop so one component
// renders crisply at 320 (mobile) → 560 (admin preview).

const money = (n) => '₹' + (Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

function genCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 10; i++) s += A[Math.floor(Math.random() * A.length)];
  return s;
}

// Theme per visual style. accent = brand color.
function couponTheme(style, accent) {
  // a muted, desaturated companion of the accent for body copy on cream
  const muted = `color-mix(in oklab, ${accent} 62%, #8a6a55)`;
  if (style === 'bold') {
    return {
      bodyBg: accent,
      tabBg: `color-mix(in oklab, ${accent} 78%, #000)`,
      tabText: '#fdf5e6',
      tabBorder: 'rgba(253,245,230,.55)',
      value: '#fff7ec',
      text: 'rgba(255,247,236,.82)',
      divider: 'rgba(255,247,236,.42)',
      pillBg: '#fdf5e6',
      pillText: accent,
      codeLabel: 'rgba(255,247,236,.6)',
      code: '#fff7ec',
      logoText: '#fff7ec',
      logoDot: '#fdf5e6',
      logoDotText: accent,
      hasTab: true,
    };
  }
  if (style === 'modern') {
    return {
      bodyBg: '#fffefb',
      tabBg: accent,
      tabText: '#fff',
      tabBorder: 'rgba(255,255,255,.5)',
      value: accent,
      text: '#73685c',
      divider: 'rgba(40,30,20,.13)',
      pillBg: `color-mix(in oklab, ${accent} 12%, #fff)`,
      pillText: accent,
      codeLabel: '#a99d8c',
      code: '#2a2521',
      logoText: '#2a2521',
      logoDot: accent,
      logoDotText: '#fff',
      hasTab: false,
    };
  }
  // classic — the reference look
  return {
    bodyBg: '#f8efd8',
    tabBg: accent,
    tabText: '#fbf3dc',
    tabBorder: 'rgba(251,243,220,.7)',
    value: accent,
    text: muted,
    divider: `color-mix(in oklab, ${accent} 42%, transparent)`,
    pillBg: accent,
    pillText: '#fbf3dc',
    codeLabel: muted,
    code: accent,
    logoText: accent,
    logoDot: accent,
    logoDotText: '#fbf3dc',
    hasTab: true,
  };
}

// the big value block, by discount type
function ValueBlock({ t, theme, px }) {
  const wrap = { display: 'flex', alignItems: 'baseline', lineHeight: 0.9, color: theme.value,
    fontWeight: 800, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' };
  if (t.type === 'percent') {
    return (
      <div style={{ ...wrap, gap: px(4) }}>
        <span style={{ fontSize: px(74) }}>{Math.round(t.value)}</span>
        <span style={{ fontSize: px(40) }}>%</span>
        <span style={{ fontSize: px(26), fontWeight: 700, letterSpacing: '0.04em', alignSelf: 'flex-end', marginBottom: px(8) }}>OFF</span>
      </div>
    );
  }
  if (t.type === 'bogo') {
    return (
      <div style={{ lineHeight: 0.92 }}>
        <div style={{ ...wrap, fontSize: px(56) }}>BOGO</div>
        <div style={{ color: theme.text, fontWeight: 600, fontSize: px(15), letterSpacing: '0.02em', marginTop: px(6) }}>
          Buy {t.bogoBuy}, get {t.bogoGet} free
        </div>
      </div>
    );
  }
  // fixed (rupees)
  const amt = (Number(t.value) || 0).toLocaleString('en-IN');
  return (
    <div style={{ ...wrap, gap: px(3) }}>
      <span style={{ fontSize: px(48), alignSelf: 'flex-start', marginTop: px(9) }}>₹</span>
      <span style={{ fontSize: px(78) }}>{amt}</span>
    </div>
  );
}

function Logo({ t, theme, px, logoDataUrl }) {
  if (logoDataUrl) {
    return <img src={logoDataUrl} alt="logo" style={{ maxWidth: px(120), maxHeight: px(56), objectFit: 'contain' }} />;
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: px(8) }}>
      <span style={{ width: px(26), height: px(26), borderRadius: '50%', background: theme.logoDot,
        color: theme.logoDotText, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: px(14), fontWeight: 800 }}>◐</span>
      <span style={{ color: theme.logoText, fontWeight: 800, fontSize: px(24), letterSpacing: '-0.01em' }}>{t.brandName}</span>
    </div>
  );
}

function CouponCard({ t, w = 540, logoDataUrl, children, faded = false }) {
  const s = w / 540;
  const px = (n) => (n * s).toFixed(2) + 'px';
  const theme = couponTheme(t.cardStyle, t.accent);
  const showTab = theme.hasTab;
  const radius = Math.max(0, (t.radius || 0)) * s;
  const dense = t.density === 'compact' ? 0.8 : t.density === 'comfy' ? 1.18 : 1;
  const padY = px(26 * dense), padX = px(30 * dense), gap = px(18 * dense);

  // silhouette mask by shape
  let maskStyle = {};
  if (t.shape === 'ticket') {
    const tile = 17 * s, r = 5.5 * s;
    const m = `radial-gradient(circle ${r}px at right, transparent ${r}px, #000 ${r + 0.5}px)`;
    maskStyle = { WebkitMaskImage: m, maskImage: m, WebkitMaskSize: `100% ${tile}px`, maskSize: `100% ${tile}px`,
      WebkitMaskRepeat: 'repeat-y', maskRepeat: 'repeat-y', WebkitMaskPosition: 'right center', maskPosition: 'right center' };
  } else if (t.shape === 'notched') {
    const R = 17 * s;
    const m = `radial-gradient(circle ${R}px at left center, transparent ${R}px, #000 ${R + 0.5}px), radial-gradient(circle ${R}px at right center, transparent ${R}px, #000 ${R + 0.5}px)`;
    maskStyle = { WebkitMaskImage: m, maskImage: m, WebkitMaskComposite: 'source-in', maskComposite: 'intersect',
      WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat', WebkitMaskSize: '100% 100%', maskSize: '100% 100%' };
  }

  const dotH = { borderTop: `${Math.max(2, 2 * s)}px dotted ${theme.divider}` };
  const dotV = { borderLeft: `${Math.max(2, 2 * s)}px dotted ${theme.divider}`, alignSelf: 'stretch' };
  const hasCode = !!(t.code && String(t.code).trim());

  return (
    <div style={{ filter: `drop-shadow(0 ${px(18)} ${px(34)} rgba(60,20,15,.20))`, width: w, opacity: faded ? 0.55 : 1, transition: 'opacity .2s' }}>
      <div style={{ display: 'flex', width: w, borderRadius: radius, overflow: 'hidden', background: theme.bodyBg, ...maskStyle }}>
        {showTab && (
          <div style={{ background: theme.tabBg, flex: `0 0 ${px(92)}`, position: 'relative', display: 'flex',
            alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ position: 'absolute', inset: px(13), border: `${Math.max(2, 2 * s)}px dashed ${theme.tabBorder}`, borderRadius: px(7) }} />
            <div style={{ transform: 'rotate(-90deg)', whiteSpace: 'nowrap', color: theme.tabText,
              fontWeight: 800, fontSize: px(27), letterSpacing: '0.34em', textIndent: '0.34em' }}>
              {(t.title || 'COUPON').toUpperCase()}
            </div>
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0, padding: `${padY} ${padX}`, display: 'flex', flexDirection: 'column', gap }}>
          {/* row 1: value | logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: px(16) }}>
            <div style={{ flex: 1, minWidth: 0 }}><ValueBlock t={t} theme={theme} px={px} /></div>
            {t.showLogo && (
              <>
                <div style={{ ...dotV, minHeight: px(58) }} />
                <Logo t={t} theme={theme} px={px} logoDataUrl={logoDataUrl} />
              </>
            )}
          </div>
          {/* row 2: description */}
          <div style={{ ...dotH, paddingTop: gap }}>
            <p style={{ margin: 0, color: theme.text, fontWeight: 500, fontSize: px(15), lineHeight: 1.5,
              textAlign: 'center', textWrap: 'pretty' }}>{t.description}</p>
          </div>
          {/* row 3: valid | code */}
          <div style={{ ...dotH, paddingTop: gap, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: `${px(8)} ${px(14)}` }}>
            <span style={{ background: theme.pillBg, color: theme.pillText, fontStyle: 'italic', fontWeight: 600,
              fontSize: px(13), padding: `${px(7)} ${px(12)}`, borderRadius: px(5), whiteSpace: 'nowrap' }}>
              {t.noExpiry ? 'Valid until cancelled' : `Valid thru ${fmtDateShort(t.validThrough)}`}
            </span>
            {hasCode && (
              <div style={{ textAlign: 'right', marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: px(14) }}>
                <div style={{ ...dotV, minHeight: px(34) }} />
                <div>
                  <div style={{ fontFamily: "'Space Mono', monospace", color: theme.codeLabel, fontSize: px(10),
                    letterSpacing: '0.18em', fontWeight: 700 }}>REDEEM CODE</div>
                  <div style={{ fontFamily: "'Space Mono', monospace", color: theme.code, fontSize: px(22),
                    fontWeight: 700, letterSpacing: '0.03em', marginTop: px(3) }}>{t.code}</div>
                </div>
              </div>
            )}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d)) return iso;
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}
function fmtDateShort(iso) {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d)) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

Object.assign(window, { CouponCard, formatValue: ValueBlock, genCode, money, fmtDate, fmtDateShort });

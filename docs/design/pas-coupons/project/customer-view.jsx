// customer-view.jsx — customer-facing coupon surfaces (web + mobile) with claim flow.
// Exports to window: CustomerView

const CV_CSS = `
.cv-web{font-family:'Hanken Grotesk',system-ui,sans-serif;background:#faf6ec;min-height:100%;color:#2a2521}
.cv-nav{display:flex;align-items:center;justify-content:space-between;padding:18px 30px;border-bottom:1px solid #ece4d6;background:#fffdf8}
.cv-brand{display:flex;align-items:center;gap:10px;font-weight:800;font-size:17px;letter-spacing:-.01em}
.cv-brand .dot{width:24px;height:24px;border-radius:50%;background:var(--accent);color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px}
.cv-navlinks{display:flex;gap:24px;font-size:14px;font-weight:600;color:#867a6b}
.cv-navlinks span:first-child{color:#2a2521}
.cv-cart{width:36px;height:36px;border-radius:10px;background:#f3ecde;display:flex;align-items:center;justify-content:center;font-size:16px}
.cv-body{max-width:880px;margin:0 auto;padding:40px 30px 60px}
.cv-eyebrow{font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--accent)}
.cv-h1{font-size:30px;font-weight:800;letter-spacing:-.02em;margin:8px 0 4px}
.cv-lede{font-size:15px;color:#867a6b;margin:0 0 30px}
.cv-hero{display:flex;flex-direction:column;align-items:center;gap:22px}
.cv-more-t{font-size:13px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#a2978a;margin:46px 0 16px}
.cv-rail{display:grid;grid-template-columns:1fr 1fr;gap:16px}
@media(max-width:720px){.cv-rail{grid-template-columns:1fr}}

.cv-act{width:100%;max-width:560px;background:#fffdf8;border:1px solid #ece4d6;border-radius:16px;padding:18px;
  display:flex;align-items:center;gap:14px;box-shadow:0 6px 20px rgba(60,20,15,.06)}
.cv-codebox{flex:1;min-width:0;display:flex;align-items:center;gap:12px;background:#f7f1e5;border:1.5px dashed #d8cfbf;border-radius:11px;padding:11px 14px}
.cv-codebox .lbl{font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#a99d8c}
.cv-codebox .code{font-family:'Space Mono',monospace;font-weight:700;font-size:17px;letter-spacing:.05em;color:#2a2521}
.cv-applied{color:var(--accent);font-weight:700;font-size:14px;display:flex;align-items:center;gap:7px}
.cv-cta{border:0;font:inherit;font-weight:700;font-size:15px;color:#fff;background:var(--accent);border-radius:12px;padding:14px 26px;cursor:pointer;transition:all .15s;white-space:nowrap}
.cv-cta:hover{filter:brightness(1.08)}
.cv-cta.ok{background:#2a7d4f}
.cv-copy{border:1.5px solid #e4dccd;background:#fff;font:inherit;font-weight:700;font-size:13px;color:#4a4136;border-radius:10px;padding:9px 14px;cursor:pointer;white-space:nowrap}
.cv-copy:hover{background:#f7f1e5}
.cv-terms{font-size:12.5px;color:#a99d8c;text-align:center;max-width:560px;line-height:1.6}

.cv-msmall{display:flex;flex-direction:column;gap:8px}
`;

function termsLine(t) {
  const bits = [];
  if (t.minOrder) bits.push('Min. order ' + money(t.minOrder));
  bits.push(t.eligibility === 'new' ? 'New customers only'
    : t.eligibility === 'returning' ? 'Returning customers'
    : t.eligibility === 'product' ? 'Select products' : 'All customers');
  if (t.perCustomer) bits.push('Limit ' + t.perCustomer + ' per customer');
  bits.push(t.noExpiry ? 'No expiry — valid until cancelled' : 'Valid through ' + fmtDate(t.validThrough));
  return bits.join(' · ');
}

function ActionBar({ t, applied, setApplied, compact }) {
  const [copied, setCopied] = React.useState(false);
  const hasCode = !!(t.code && String(t.code).trim());
  const copy = () => {
    try { navigator.clipboard && navigator.clipboard.writeText(t.code); } catch (e) {}
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  };
  if (compact) {
    return (
      <div className="cv-msmall">
        {!applied ? (
          <button className="cv-cta" style={{ width: '100%' }} onClick={() => setApplied(true)}>Apply coupon</button>
        ) : hasCode ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <div className="cv-codebox" style={{ flex: 1 }}>
              <div>
                <div className="lbl">Code</div>
                <div className="code">{t.code}</div>
              </div>
            </div>
            <button className="cv-copy" onClick={copy}>{copied ? '✓ Copied' : 'Copy'}</button>
          </div>
        ) : (
          <div className="cv-codebox" style={{ justifyContent: 'center' }}>
            <span className="cv-applied">✓ Applied — discount added automatically</span>
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="cv-act">
      {applied ? (
        hasCode ? (
          <>
            <div className="cv-codebox">
              <div style={{ flex: 1 }}>
                <div className="lbl">Your code</div>
                <div className="code">{t.code}</div>
              </div>
              <span className="cv-applied">✓ Applied</span>
            </div>
            <button className="cv-copy" onClick={copy}>{copied ? '✓ Copied' : 'Copy code'}</button>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="cv-applied">✓ Applied to your account</span>
            <span style={{ color: '#867a6b', fontSize: 14, fontWeight: 500 }}>No code needed — the discount is applied automatically at checkout.</span>
          </div>
        )
      ) : (
        <>
          <div style={{ flex: 1, color: '#867a6b', fontSize: 14, fontWeight: 500 }}>
            {hasCode
              ? 'Tap apply to add this coupon to your account and reveal your code.'
              : 'Tap apply to add this coupon — no code needed, the discount applies at checkout.'}
          </div>
          <button className="cv-cta" onClick={() => setApplied(true)}>Apply coupon</button>
        </>
      )}
    </div>
  );
}

// a small static sample coupon for the "more offers" rail
function sampleCoupon(over) {
  return { type: 'percent', value: 15, bogoBuy: 1, bogoGet: 1, title: 'SAVE', brandName: 'Logo',
    description: 'Save 15% storewide this weekend only.', validThrough: '2026-07-04', code: 'WEEKEND15',
    minOrder: 0, eligibility: 'all', perCustomer: 1, showLogo: false, accent: over.accent,
    cardStyle: over.cardStyle, shape: over.shape, radius: over.radius, density: 'compact', ...over };
}

function CustomerView({ t, logoDataUrl, platform }) {
  const [applied, setApplied] = React.useState(false);
  React.useEffect(() => { setApplied(false); }, [t.code]);

  const s2 = sampleCoupon({ accent: t.accent, cardStyle: t.cardStyle, shape: t.shape, radius: t.radius,
    type: 'percent', value: 15, code: 'WEEKEND15', description: 'Save 15% storewide this weekend only.', validThrough: '2026-07-04', title: 'SAVE' });
  const s3 = sampleCoupon({ accent: t.accent, cardStyle: t.cardStyle, shape: t.shape, radius: t.radius,
    type: 'fixed', value: 10, code: 'SHIPFREE10', description: 'Free shipping on your next delivery.', validThrough: '2026-08-15', title: 'SHIP' });

  if (platform === 'mobile') {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0', background: '#f4eede', minHeight: '100%' }}>
        <style>{CV_CSS}</style>
        <IOSDevice title="Rewards">
          <div style={{ '--accent': t.accent, fontFamily: "'Hanken Grotesk',system-ui,sans-serif", background: '#faf6ec', minHeight: '100%', padding: '12px 16px 30px' }}>
            <div className="cv-eyebrow" style={{ marginTop: 6 }}>Just for you</div>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.02em', margin: '4px 0 16px' }}>Your coupon</div>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <CouponCard t={t} w={330} logoDataUrl={logoDataUrl} />
            </div>
            <div style={{ marginTop: 18 }}>
              <ActionBar t={t} applied={applied} setApplied={setApplied} compact />
            </div>
            <p style={{ fontSize: 11.5, color: '#a99d8c', lineHeight: 1.6, marginTop: 14, textAlign: 'center' }}>{termsLine(t)}</p>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#a2978a', margin: '26px 0 12px' }}>More offers</div>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <CouponCard t={s2} w={330} />
            </div>
          </div>
        </IOSDevice>
      </div>
    );
  }

  // web
  return (
    <ChromeWindow width={1080} height={720} url="shop.example.com/rewards">
      <div className="cv-web" style={{ '--accent': t.accent }}>
        <style>{CV_CSS}</style>
        <div className="cv-nav">
          <div className="cv-brand"><span className="dot">◐</span> Marketplace</div>
          <div className="cv-navlinks"><span>Rewards</span><span>Shop</span><span>Orders</span><span>Account</span></div>
          <div className="cv-cart">🛍</div>
        </div>
        <div className="cv-body">
          <div className="cv-eyebrow">A gift for you</div>
          <h1 className="cv-h1">Your coupon is ready</h1>
          <p className="cv-lede">Apply it now and we'll save the code to your account for checkout.</p>
          <div className="cv-hero">
            <CouponCard t={t} w={560} logoDataUrl={logoDataUrl} />
            <ActionBar t={t} applied={applied} setApplied={setApplied} />
            <p className="cv-terms">{termsLine(t)}</p>
          </div>
          <div className="cv-more-t">More offers for you</div>
          <div className="cv-rail">
            <CouponCard t={s2} w={400} />
            <CouponCard t={s3} w={400} />
          </div>
        </div>
      </div>
    </ChromeWindow>
  );
}

Object.assign(window, { CustomerView });

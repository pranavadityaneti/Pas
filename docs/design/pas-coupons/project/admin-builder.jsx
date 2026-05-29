// admin-builder.jsx — coupon creation dashboard with live preview. 2 layouts.
// Exports to window: AdminBuilder, ABField, ABInput

const AB_CSS = `
.ab-wrap{--accent:#b42926;color:#2a2521;font-family:'Hanken Grotesk',system-ui,sans-serif}
.ab-shell{display:grid;gap:0}
.ab-split{grid-template-columns:minmax(0,1fr) minmax(0,520px)}
@media (max-width:980px){.ab-split{grid-template-columns:1fr}}
.ab-formcol{padding:34px 40px 80px;overflow-y:auto}
.ab-stack .ab-formcol{padding:30px 40px 80px}
.ab-eyebrow{font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--accent)}
.ab-h1{font-size:25px;font-weight:800;letter-spacing:-.01em;margin:6px 0 2px}
.ab-sub{font-size:14px;color:#867a6b;margin:0 0 26px}
.ab-sec{margin-bottom:24px}
.ab-sec-t{font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#a2978a;margin:0 0 12px;padding-bottom:8px;border-bottom:1px solid #ece4d6}
.ab-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.ab-grid.one{grid-template-columns:1fr}
.ab-field{display:flex;flex-direction:column;gap:6px;min-width:0}
.ab-field.span2{grid-column:1/-1}
.ab-lbl{font-size:12.5px;font-weight:600;color:#4a4136}
.ab-hint{font-size:11.5px;color:#a99d8c;font-weight:500}
.ab-inp,.ab-sel,.ab-ta{font:inherit;font-size:14px;color:#2a2521;background:#fff;border:1.5px solid #e4dccd;
  border-radius:10px;padding:10px 12px;outline:none;transition:border-color .15s,box-shadow .15s;width:100%;box-sizing:border-box}
.ab-inp:focus,.ab-sel:focus,.ab-ta:focus{border-color:var(--accent);box-shadow:0 0 0 3px color-mix(in oklab,var(--accent) 16%,transparent)}
.ab-ta{resize:vertical;min-height:64px;line-height:1.5}
.ab-inp-grp{display:flex;align-items:stretch}
.ab-inp-grp .ab-pre{display:flex;align-items:center;padding:0 12px;background:#f6f0e4;border:1.5px solid #e4dccd;border-right:0;
  border-radius:10px 0 0 10px;font-weight:700;color:#867a6b;font-size:14px}
.ab-inp-grp .ab-inp{border-radius:0 10px 10px 0}
.ab-seg{display:flex;background:#f3ecde;border-radius:11px;padding:4px;gap:4px}
.ab-seg button{flex:1;border:0;background:transparent;font:inherit;font-weight:600;font-size:13.5px;color:#7c7164;
  padding:9px 8px;border-radius:8px;cursor:pointer;transition:all .15s}
.ab-seg button[data-on="1"]{background:#fff;color:var(--accent);box-shadow:0 1px 4px rgba(0,0,0,.1)}
.ab-row2{display:flex;gap:10px}
.ab-btn{border:0;font:inherit;font-weight:700;font-size:13.5px;border-radius:10px;padding:11px 16px;cursor:pointer;transition:all .15s;white-space:nowrap}
.ab-btn.pri{background:var(--accent);color:#fff}
.ab-btn.pri:hover{filter:brightness(1.08)}
.ab-btn.ghost{background:#f3ecde;color:#4a4136}
.ab-btn.ghost:hover{background:#ebe2d2}
.ab-toggle{display:flex;align-items:center;gap:10px;cursor:pointer;user-select:none}
.ab-sw{width:38px;height:22px;border-radius:999px;background:#d8cfbf;position:relative;transition:background .15s;flex:0 0 auto}
.ab-sw[data-on="1"]{background:var(--accent)}
.ab-sw i{position:absolute;top:2px;left:2px;width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.25);transition:transform .15s}
.ab-sw[data-on="1"] i{transform:translateX(16px)}
.ab-upload{border:1.5px dashed #d8cfbf;border-radius:10px;padding:14px;display:flex;align-items:center;gap:12px;cursor:pointer;background:#fffdf9;transition:border-color .15s}
.ab-upload:hover{border-color:var(--accent)}
.ab-upload img{width:42px;height:42px;object-fit:contain;border-radius:6px;background:#f6f0e4}
.ab-prevcol{background:radial-gradient(circle at 50% 30%,#fff 0,#f4eede 100%);border-left:1px solid #ece4d6;
  padding:40px 28px;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:24px;position:sticky;top:0;align-self:start;min-height:100%}
.ab-stack .ab-prevcol{border-left:0;border-bottom:1px solid #ece4d6;position:static}
.ab-prevlabel{font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#a2978a;align-self:flex-start}
.ab-summary{display:flex;flex-wrap:wrap;gap:8px;width:100%;max-width:540px}
.ab-chip{display:inline-flex;align-items:center;gap:6px;background:#fff;border:1px solid #e8e0d1;border-radius:999px;
  padding:7px 13px;font-size:12.5px;font-weight:600;color:#4a4136}
.ab-chip b{color:var(--accent)}
.ab-save{display:flex;gap:10px;align-items:center;width:100%;max-width:540px;margin-top:4px}
.ab-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(20px);background:#2a2521;color:#fff;
  padding:12px 20px;border-radius:12px;font-weight:600;font-size:14px;opacity:0;transition:all .25s;pointer-events:none;z-index:60;box-shadow:0 8px 30px rgba(0,0,0,.25)}
.ab-toast[data-show="1"]{opacity:1;transform:translateX(-50%) translateY(0)}
`;

function ABSwitch({ on, onChange, label, hint }) {
  return (
    <label className="ab-toggle">
      <span className="ab-sw" data-on={on ? '1' : '0'} onClick={() => onChange(!on)}><i /></span>
      <span>
        <span className="ab-lbl">{label}</span>
        {hint && <span className="ab-hint" style={{ display: 'block' }}>{hint}</span>}
      </span>
    </label>
  );
}

function AdminBuilder({ t, setTweak, logoDataUrl, setLogoDataUrl, layout }) {
  const [toast, setToast] = React.useState('');
  const fileRef = React.useRef(null);
  const set = (k) => (e) => setTweak(k, e && e.target ? e.target.value : e);
  const setNum = (k) => (e) => setTweak(k, Number(e.target.value));

  const fire = (msg) => { setToast(msg); setTimeout(() => setToast(''), 1900); };

  const onFile = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => { setLogoDataUrl(r.result); setTweak('showLogo', true); };
    r.readAsDataURL(f);
  };

  const form = (
    <div className="ab-formcol">
      <div className="ab-eyebrow">Coupons · New</div>
      <h1 className="ab-h1">Create a coupon</h1>
      <p className="ab-sub">Build a promotion and watch it render exactly as customers will see it.</p>

      <div className="ab-sec">
        <div className="ab-sec-t">Discount</div>
        <div className="ab-field" style={{ marginBottom: 14 }}>
          <span className="ab-lbl">Type</span>
          <div className="ab-seg">
            {[['fixed', 'Fixed amount'], ['percent', 'Percentage'], ['bogo', 'BOGO']].map(([v, l]) => (
              <button key={v} data-on={t.type === v ? '1' : '0'} onClick={() => setTweak('type', v)}>{l}</button>
            ))}
          </div>
        </div>
        {t.type === 'fixed' && (
          <div className="ab-field">
            <span className="ab-lbl">Amount off</span>
            <div className="ab-inp-grp">
              <span className="ab-pre">₹</span>
              <input className="ab-inp" type="number" min="0" step="1" value={t.value} onChange={setNum('value')} />
            </div>
          </div>
        )}
        {t.type === 'percent' && (
          <div className="ab-field">
            <span className="ab-lbl">Percentage off</span>
            <div className="ab-inp-grp">
              <input className="ab-inp" style={{ borderRadius: '10px 0 0 10px', borderRight: 0 }} type="number" min="0" max="100" step="1" value={t.value} onChange={setNum('value')} />
              <span className="ab-pre" style={{ borderRadius: '0 10px 10px 0', borderRight: '1.5px solid #e4dccd', borderLeft: 0 }}>%</span>
            </div>
          </div>
        )}
        {t.type === 'bogo' && (
          <div className="ab-grid">
            <div className="ab-field">
              <span className="ab-lbl">Buy quantity</span>
              <input className="ab-inp" type="number" min="1" step="1" value={t.bogoBuy} onChange={setNum('bogoBuy')} />
            </div>
            <div className="ab-field">
              <span className="ab-lbl">Get free</span>
              <input className="ab-inp" type="number" min="1" step="1" value={t.bogoGet} onChange={setNum('bogoGet')} />
            </div>
          </div>
        )}
      </div>

      <div className="ab-sec">
        <div className="ab-sec-t">Details</div>
        <div className="ab-grid">
          <div className="ab-field">
            <span className="ab-lbl">Tab label</span>
            <input className="ab-inp" value={t.title} onChange={set('title')} maxLength="14" />
          </div>
          <div className="ab-field">
            <span className="ab-lbl">Brand name</span>
            <input className="ab-inp" value={t.brandName} onChange={set('brandName')} maxLength="18" />
          </div>
          <div className="ab-field span2">
            <span className="ab-lbl">Description</span>
            <textarea className="ab-ta" value={t.description} onChange={set('description')} maxLength="160" />
            <span className="ab-hint">{t.description.length}/160 characters</span>
          </div>
        </div>
      </div>

      <div className="ab-sec">
        <div className="ab-sec-t">Validity</div>
        <div className="ab-grid">
          <div className="ab-field">
            <span className="ab-lbl">Valid from</span>
            <input className="ab-inp" type="date" value={t.validFrom} onChange={set('validFrom')} />
          </div>
          <div className="ab-field">
            <span className="ab-lbl">Valid through</span>
            <input className="ab-inp" type="date" value={t.validThrough} onChange={set('validThrough')}
              disabled={t.noExpiry} style={{ opacity: t.noExpiry ? 0.5 : 1 }} />
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <ABSwitch on={t.noExpiry} onChange={(v) => setTweak('noExpiry', v)}
            label="No end date — valid until cancelled" hint="Coupon stays active until you turn it off" />
        </div>
      </div>

      <div className="ab-sec">
        <div className="ab-sec-t">Redeem code</div>
        <div className="ab-field">
          <span className="ab-lbl">Code</span>
          <div className="ab-row2">
            <input className="ab-inp" value={t.code} disabled={t.autoCode}
              style={{ fontFamily: "'Space Mono',monospace", letterSpacing: '.06em', opacity: t.autoCode ? 0.6 : 1 }}
              onChange={(e) => setTweak('code', e.target.value.toUpperCase())} />
            <button className="ab-btn ghost" onClick={() => setTweak('code', genCode())}>↻ Generate</button>
          </div>
          <div style={{ marginTop: 10 }}>
            <ABSwitch on={t.autoCode} onChange={(v) => { setTweak('autoCode', v); if (v) setTweak('code', genCode()); }}
              label="Auto-generate unique codes" hint="Each customer gets a one-time code at claim" />
          </div>
        </div>
      </div>

      <div className="ab-sec">
        <div className="ab-sec-t">Limits & eligibility</div>
        <div className="ab-grid">
          <div className="ab-field">
            <span className="ab-lbl">Total usage limit</span>
            <input className="ab-inp" type="number" min="0" value={t.usageLimit} onChange={setNum('usageLimit')} />
          </div>
          <div className="ab-field">
            <span className="ab-lbl">Per customer</span>
            <input className="ab-inp" type="number" min="0" value={t.perCustomer} onChange={setNum('perCustomer')} />
          </div>
          <div className="ab-field">
            <span className="ab-lbl">Minimum order</span>
            <div className="ab-inp-grp">
              <span className="ab-pre">₹</span>
              <input className="ab-inp" type="number" min="0" value={t.minOrder} onChange={setNum('minOrder')} />
            </div>
          </div>
          <div className="ab-field">
            <span className="ab-lbl">Eligibility</span>
            <select className="ab-sel" value={t.eligibility} onChange={set('eligibility')}>
              <option value="all">All customers</option>
              <option value="new">New customers only</option>
              <option value="returning">Returning customers</option>
              <option value="product">Specific products</option>
            </select>
          </div>
        </div>
      </div>

      <div className="ab-sec">
        <div className="ab-sec-t">Branding</div>
        <div style={{ marginBottom: 12 }}>
          <ABSwitch on={t.showLogo} onChange={(v) => setTweak('showLogo', v)} label="Show logo on coupon" />
        </div>
        {t.showLogo && (
          <div className="ab-upload" onClick={() => fileRef.current && fileRef.current.click()}>
            {logoDataUrl
              ? <img src={logoDataUrl} alt="" />
              : <span style={{ width: 42, height: 42, borderRadius: 6, background: '#f6f0e4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>⬆</span>}
            <span>
              <span className="ab-lbl">{logoDataUrl ? 'Replace logo' : 'Upload logo'}</span>
              <span className="ab-hint" style={{ display: 'block' }}>PNG or SVG, transparent background recommended</span>
            </span>
            {logoDataUrl && <button className="ab-btn ghost" style={{ marginLeft: 'auto' }} onClick={(e) => { e.stopPropagation(); setLogoDataUrl(null); }}>Remove</button>}
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onFile} />
          </div>
        )}
      </div>
    </div>
  );

  const summary = (
    <div className="ab-summary">
      <span className="ab-chip">Status <b>Draft</b></span>
      <span className="ab-chip">Limit <b>{t.usageLimit ? t.usageLimit.toLocaleString() : '∞'}</b></span>
      <span className="ab-chip">Per customer <b>{t.perCustomer || '∞'}</b></span>
      <span className="ab-chip">Min order <b>{money(t.minOrder)}</b></span>
    </div>
  );

  const preview = (
    <div className="ab-prevcol">
      <span className="ab-prevlabel">Live preview</span>
      <CouponCard t={t} w={layout === 'stacked' ? 560 : 430} logoDataUrl={logoDataUrl} />
      {summary}
      <div className="ab-save">
        <button className="ab-btn pri" style={{ flex: 1 }} onClick={() => fire('Coupon published — live for customers')}>Publish coupon</button>
        <button className="ab-btn ghost" onClick={() => fire('Saved as draft')}>Save draft</button>
      </div>
    </div>
  );

  return (
    <div className="ab-wrap" style={{ '--accent': t.accent, height: '100%' }}>
      <style>{AB_CSS}</style>
      {layout === 'stacked'
        ? <div className="ab-shell ab-stack"><div className="ab-prevcol">{<span className="ab-prevlabel">Live preview</span>}<CouponCard t={t} w={560} logoDataUrl={logoDataUrl} />{summary}<div className="ab-save"><button className="ab-btn pri" style={{ flex: 1 }} onClick={() => fire('Coupon published — live for customers')}>Publish coupon</button><button className="ab-btn ghost" onClick={() => fire('Saved as draft')}>Save draft</button></div></div>{form}</div>
        : <div className="ab-shell ab-split">{form}{preview}</div>}
      <div className="ab-toast" data-show={toast ? '1' : '0'}>{toast}</div>
    </div>
  );
}

Object.assign(window, { AdminBuilder });

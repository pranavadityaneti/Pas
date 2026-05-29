// app.jsx — shell: mode switch (Admin / Customer), shared coupon store, tweaks.
const { CouponCard, AdminBuilder, CustomerView } = window;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "type": "fixed",
  "value": 50,
  "bogoBuy": 1,
  "bogoGet": 1,
  "title": "COUPON",
  "brandName": "Logo",
  "description": "Take a flat discount off your next order. Limited time — apply at checkout to redeem.",
  "validFrom": "2026-06-01",
  "validThrough": "2026-12-25",
  "noExpiry": false,
  "code": "S67YZ882XF",
  "autoCode": false,
  "usageLimit": 500,
  "perCustomer": 1,
  "minOrder": 100,
  "eligibility": "all",
  "showLogo": true,
  "accent": "#b42926",
  "cardStyle": "classic",
  "shape": "ticket",
  "radius": 18,
  "density": "regular",
  "builderLayout": "split"
}/*EDITMODE-END*/;

const APP_CSS = `
*{box-sizing:border-box}
html,body{margin:0;height:100%}
body{font-family:'Hanken Grotesk',system-ui,sans-serif;background:#f0e9da;color:#2a2521;
  -webkit-font-smoothing:antialiased}
#root{height:100vh;display:flex;flex-direction:column;overflow:hidden}
.app-top{display:flex;align-items:center;gap:18px;padding:11px 18px;background:#fffdf8;border-bottom:1px solid #e6ddcc;
  flex:0 0 auto;z-index:5}
.app-logo{display:flex;align-items:center;gap:9px;font-weight:800;font-size:15px;letter-spacing:-.01em;color:#2a2521}
.app-logo .m{width:24px;height:24px;border-radius:7px;background:var(--accent);color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800}
.app-seg{display:flex;background:#f0e9da;border-radius:11px;padding:4px;gap:3px;margin:0 auto}
.app-seg button{border:0;background:transparent;font:inherit;font-weight:600;font-size:13.5px;color:#7c7164;
  padding:8px 18px;border-radius:8px;cursor:pointer;transition:all .15s;display:flex;align-items:center;gap:7px}
.app-seg button[data-on="1"]{background:#fff;color:var(--accent);box-shadow:0 1px 4px rgba(0,0,0,.1)}
.app-sub{display:flex;background:#f0e9da;border-radius:9px;padding:3px;gap:3px}
.app-sub button{border:0;background:transparent;font:inherit;font-weight:600;font-size:12.5px;color:#7c7164;
  padding:6px 13px;border-radius:7px;cursor:pointer;transition:all .15s}
.app-sub button[data-on="1"]{background:#fff;color:var(--accent);box-shadow:0 1px 3px rgba(0,0,0,.1)}
.app-stage{flex:1;min-height:0;overflow:auto}
.app-stage.center{display:flex;align-items:flex-start;justify-content:center;background:#f0e9da}
`;

const accents = ['#b42926', '#0e7c6b', '#2f5fb0', '#8a3a78', '#b06a16'];

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [logoDataUrl, setLogoDataUrl] = React.useState(null);
  const [mode, setMode] = React.useState(() => localStorage.getItem('pas_mode') || 'admin');
  const [platform, setPlatform] = React.useState(() => localStorage.getItem('pas_platform') || 'web');
  React.useEffect(() => { localStorage.setItem('pas_mode', mode); }, [mode]);
  React.useEffect(() => { localStorage.setItem('pas_platform', platform); }, [platform]);

  return (
    <div style={{ '--accent': t.accent, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <style>{APP_CSS}</style>
      <div className="app-top">
        <div className="app-logo"><span className="m">◐</span> PAS · Coupons</div>
        <div className="app-seg">
          <button data-on={mode === 'admin' ? '1' : '0'} onClick={() => setMode('admin')}>⚙ Admin builder</button>
          <button data-on={mode === 'customer' ? '1' : '0'} onClick={() => setMode('customer')}>♥ Customer app</button>
        </div>
        {mode === 'customer'
          ? <div className="app-sub">
              <button data-on={platform === 'web' ? '1' : '0'} onClick={() => setPlatform('web')}>Web</button>
              <button data-on={platform === 'mobile' ? '1' : '0'} onClick={() => setPlatform('mobile')}>Mobile</button>
            </div>
          : <div style={{ width: 96 }} />}
      </div>

      <div className={'app-stage' + (mode === 'customer' ? ' center' : '')}>
        {mode === 'admin'
          ? <AdminBuilder t={t} setTweak={setTweak} logoDataUrl={logoDataUrl} setLogoDataUrl={setLogoDataUrl} layout={t.builderLayout} />
          : <CustomerView t={t} logoDataUrl={logoDataUrl} platform={platform} />}
      </div>

      <TweaksPanel>
        <TweakSection label="Discount" />
        <TweakRadio label="Type" value={t.type}
          options={[{ value: 'fixed', label: 'Fixed' }, { value: 'percent', label: 'Percent' }, { value: 'bogo', label: 'BOGO' }]}
          onChange={(v) => setTweak('type', v)} />
        {t.type !== 'bogo' && (
          <TweakNumber label={t.type === 'percent' ? 'Percent off' : 'Amount off'} value={t.value}
            min={0} max={t.type === 'percent' ? 100 : 1000} step={t.type === 'percent' ? 1 : 5}
            unit={t.type === 'percent' ? '%' : ''} onChange={(v) => setTweak('value', v)} />
        )}

        <TweakSection label="Look" />
        <TweakColor label="Accent" value={t.accent} options={accents} onChange={(v) => setTweak('accent', v)} />
        <TweakRadio label="Card style" value={t.cardStyle}
          options={[{ value: 'classic', label: 'Classic' }, { value: 'modern', label: 'Modern' }, { value: 'bold', label: 'Bold' }]}
          onChange={(v) => setTweak('cardStyle', v)} />
        <TweakRadio label="Shape" value={t.shape}
          options={[{ value: 'ticket', label: 'Ticket' }, { value: 'notched', label: 'Notched' }, { value: 'plain', label: 'Plain' }]}
          onChange={(v) => setTweak('shape', v)} />

        <TweakSection label="Shape & density" />
        <TweakSlider label="Corner radius" value={t.radius} min={0} max={40} unit="px" onChange={(v) => setTweak('radius', v)} />
        <TweakRadio label="Density" value={t.density}
          options={[{ value: 'compact', label: 'Compact' }, { value: 'regular', label: 'Regular' }, { value: 'comfy', label: 'Comfy' }]}
          onChange={(v) => setTweak('density', v)} />

        <TweakSection label="Content" />
        <TweakToggle label="Show logo" value={t.showLogo} onChange={(v) => setTweak('showLogo', v)} />

        <TweakSection label="Admin builder" />
        <TweakRadio label="Layout" value={t.builderLayout}
          options={[{ value: 'split', label: 'Split' }, { value: 'stacked', label: 'Stacked' }]}
          onChange={(v) => setTweak('builderLayout', v)} />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);

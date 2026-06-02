import { useState, useEffect, type ChangeEvent } from 'react';
import {
  Info,
  Percent,
  Trash2,
  Power,
  Loader2,
  Plus,
  List,
  RefreshCw,
  Upload,
  X,
} from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Card, CardContent } from '../../ui/card';
import { Separator } from '../../ui/separator';
import { Badge } from '../../ui/badge';
import { toast } from 'sonner';
import {
  fetchCoupons,
  createCoupon,
  deleteCoupon,
  toggleCouponStatus,
  type Coupon,
  type CreateCouponInput,
  type DiscountType,
  type CouponTheme,
} from '../../../lib/couponService';
import {
  CouponCard,
  type CouponCardData,
  genCode,
  money,
  COUPON_THEMES,
  getThemePreset,
} from './CouponCard';

type ViewMode = 'list' | 'create';

// Small toggle styled like the design's switch (avoids depending on a switch ui primitive).
function Toggle({ on, onChange, label, hint }: { on: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      <button
        type="button"
        onClick={() => onChange(!on)}
        className={`relative w-[38px] h-[22px] rounded-full transition-colors shrink-0 ${on ? 'bg-[#B52725]' : 'bg-gray-300'}`}
        aria-pressed={on}
      >
        <span className={`absolute top-0.5 left-0.5 w-[18px] h-[18px] rounded-full bg-white shadow transition-transform ${on ? 'translate-x-4' : ''}`} />
      </button>
      <span>
        <span className="text-sm font-medium text-gray-700">{label}</span>
        {hint && <span className="block text-xs text-gray-400">{hint}</span>}
      </span>
    </label>
  );
}

export function CouponBuilder() {
  // View mode
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  // --- Form state (API-aligned) ---
  const [code, setCode] = useState('');
  const [autoCode, setAutoCode] = useState(false);
  const [discountType, setDiscountType] = useState<DiscountType>('PERCENTAGE');
  const [discountValue, setDiscountValue] = useState('20');
  const [bogoBuy, setBogoBuy] = useState('1');
  const [bogoGet, setBogoGet] = useState('1');
  const [maxDiscountCap, setMaxDiscountCap] = useState('100');
  const [fundingSource, setFundingSource] = useState<'PLATFORM' | 'MERCHANT'>('PLATFORM');
  const [audience, setAudience] = useState<CreateCouponInput['targetAudience']>('ALL');
  const [usageLimit, setUsageLimit] = useState('');
  const [perCustomerLimit, setPerCustomerLimit] = useState('');
  const [minOrder, setMinOrder] = useState('');
  const [title, setTitle] = useState('COUPON');
  const [brandName, setBrandName] = useState('Pick At Store');
  const [description, setDescription] = useState('Apply at checkout to save on your order.');
  const [validFrom, setValidFrom] = useState('');
  const [validThrough, setValidThrough] = useState('');
  const [noExpiry, setNoExpiry] = useState(true);
  const [showLogo, setShowLogo] = useState(true);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [theme, setTheme] = useState<CouponTheme>('classic');

  // Data state
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadCoupons();
  }, []);

  const loadCoupons = async () => {
    setLoading(true);
    try {
      const data = await fetchCoupons();
      setCoupons(data);
    } catch (err: any) {
      toast.error('Failed to load coupons', { description: err?.response?.data?.error ?? err?.message });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setCode('');
    setAutoCode(false);
    setDiscountType('PERCENTAGE');
    setDiscountValue('20');
    setBogoBuy('1');
    setBogoGet('1');
    setMaxDiscountCap('100');
    setFundingSource('PLATFORM');
    setAudience('ALL');
    setUsageLimit('');
    setPerCustomerLimit('');
    setMinOrder('');
    setTitle('COUPON');
    setBrandName('Pick At Store');
    setDescription('Apply at checkout to save on your order.');
    setValidFrom('');
    setValidThrough('');
    setNoExpiry(true);
    setShowLogo(true);
    setLogoDataUrl(null);
    setTheme('classic');
  };

  // ---- live-preview view model ----
  // Style props come from the selected theme preset; content fields are user-driven.
  const themePreset = getThemePreset(theme);
  const cardData: CouponCardData = {
    type: discountType === 'PERCENTAGE' ? 'percent' : discountType === 'FLAT' ? 'fixed' : 'bogo',
    value: Number(discountValue) || 0,
    bogoBuy: Number(bogoBuy) || 1,
    bogoGet: Number(bogoGet) || 1,
    title: title || 'COUPON',
    brandName: brandName || 'Pick At Store',
    description: description || 'Apply at checkout to save on your order.',
    validThrough,
    noExpiry,
    code,
    showLogo,
    ...themePreset,
  };

  const onLogoFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => { setLogoDataUrl(typeof r.result === 'string' ? r.result : null); setShowLogo(true); };
    r.readAsDataURL(f);
  };

  const handleCreate = async () => {
    // ---- validation ----
    if (!code.trim()) {
      toast.error('A redeem code is required', { description: 'Type one or turn on auto-generate.' });
      return;
    }
    if (discountType === 'PERCENTAGE') {
      const v = Number(discountValue);
      if (!v || v <= 0) { toast.error('Percentage must be greater than 0'); return; }
      if (v > 100) { toast.error('Percentage discount cannot exceed 100%'); return; }
    } else if (discountType === 'FLAT') {
      if (!Number(discountValue) || Number(discountValue) <= 0) { toast.error('Amount off must be greater than 0'); return; }
    } else if (discountType === 'BOGO') {
      if (!Number(bogoBuy) || Number(bogoBuy) < 1) { toast.error('BOGO “buy” quantity must be at least 1'); return; }
      if (!Number(bogoGet) || Number(bogoGet) < 1) { toast.error('BOGO “get free” quantity must be at least 1'); return; }
    }
    if (!noExpiry && !validThrough) {
      toast.error('Pick an end date', { description: 'Or switch on “valid until cancelled”.' });
      return;
    }

    setSubmitting(true);
    try {
      const input: CreateCouponInput = {
        code: code.toUpperCase(),
        discountType,
        discountValue: discountType === 'BOGO' ? undefined : Number(discountValue),
        maxDiscountCap: discountType === 'PERCENTAGE' && maxDiscountCap ? Number(maxDiscountCap) : null,
        fundingSource,
        targetAudience: audience,
        storeId: null, // App-wide coupon (Super Admin)
        usageLimit: usageLimit ? Number(usageLimit) : null,
        startDate: validFrom ? new Date(validFrom).toISOString() : new Date().toISOString(),
        endDate: noExpiry ? null : (validThrough ? new Date(validThrough).toISOString() : null),
        minOrder: minOrder ? Number(minOrder) : null,
        perCustomerLimit: perCustomerLimit ? Number(perCustomerLimit) : null,
        bogoBuy: discountType === 'BOGO' ? Number(bogoBuy) : null,
        bogoGet: discountType === 'BOGO' ? Number(bogoGet) : null,
        title: title || null,
        brandName: brandName || null,
        description: description || null,
        showLogo,
        logoUrl: logoDataUrl || null,
        autoCode,
        theme,
      };

      await createCoupon(input);
      toast.success('Coupon published — live for customers', { description: `Code: ${code.toUpperCase()}` });
      resetForm();
      setViewMode('list');
      loadCoupons();
    } catch (err: any) {
      if (err?.response?.status === 409) {
        toast.error('Coupon code already exists', { description: 'Please use a different code.' });
      } else {
        toast.error('Failed to create coupon', { description: err?.response?.data?.error ?? err?.message });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, c: string) => {
    if (!confirm(`Delete coupon "${c}"? This cannot be undone.`)) return;
    try {
      await deleteCoupon(id);
      toast.success('Coupon deleted', { description: c });
      loadCoupons();
    } catch (err: any) {
      toast.error('Failed to delete coupon', { description: err?.response?.data?.error ?? err?.message });
    }
  };

  const handleToggle = async (id: string, currentStatus: boolean) => {
    try {
      await toggleCouponStatus(id, !currentStatus);
      toast.success(`Coupon ${!currentStatus ? 'activated' : 'deactivated'}`);
      loadCoupons();
    } catch (err: any) {
      toast.error('Failed to update status', { description: err?.response?.data?.error ?? err?.message });
    }
  };

  // value summary for a coupon row
  const valueLabel = (c: Coupon) => {
    if (c.discountType === 'PERCENTAGE') return `${c.discountValue}% OFF`;
    if (c.discountType === 'BOGO') return `BOGO · Buy ${c.bogoBuy ?? 1} get ${c.bogoGet ?? 1}`;
    return `₹${c.discountValue} OFF`;
  };

  // ===================== LIST VIEW =====================
  if (viewMode === 'list') {
    return (
      <div className="flex flex-col h-full gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Percent className="w-5 h-5 text-[#B52725]" />
              Active Coupons
            </h3>
            <p className="text-sm text-gray-500 mt-0.5">{coupons.length} coupon{coupons.length !== 1 ? 's' : ''} configured</p>
          </div>
          <Button onClick={() => setViewMode('create')} className="bg-[#121212] hover:bg-[#2d2d2d] gap-2">
            <Plus className="w-4 h-4" />
            Create Coupon
          </Button>
        </div>

        <Separator />

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : coupons.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-16">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <Percent className="w-7 h-7 text-gray-400" />
            </div>
            <h4 className="font-semibold text-gray-700 mb-1">No coupons yet</h4>
            <p className="text-sm text-gray-500 max-w-xs">Create your first coupon to start offering promotions to your customers.</p>
            <Button onClick={() => setViewMode('create')} className="mt-4 bg-[#B52725] hover:bg-[#9a2120] gap-2">
              <Plus className="w-4 h-4" />
              Create First Coupon
            </Button>
          </div>
        ) : (
          <div className="grid gap-3 overflow-auto flex-1">
            {coupons.map((coupon) => (
              <Card key={coupon.id} className={`border transition-all ${coupon.isActive ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="bg-gray-900 text-white px-3 py-1.5 rounded-lg font-mono text-sm font-bold tracking-wider">
                        {coupon.code}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900">{valueLabel(coupon)}</span>
                          {coupon.maxDiscountCap && coupon.discountType === 'PERCENTAGE' && (
                            <span className="text-xs text-gray-500">(Max ₹{coupon.maxDiscountCap})</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <Badge
                            variant="secondary"
                            className={`text-[10px] h-5 px-1.5 border-none ${coupon.fundingSource === 'PLATFORM' ? 'bg-red-50 text-red-600' : 'bg-purple-50 text-purple-600'}`}
                          >
                            {coupon.fundingSource === 'PLATFORM' ? 'Platform Funded' : 'Merchant Funded'}
                          </Badge>
                          <Badge variant="secondary" className="text-[10px] h-5 px-1.5 border-none bg-blue-50 text-blue-600">
                            {coupon.targetAudience === 'ALL' ? 'All Users' : coupon.targetAudience === 'NEW_USERS' ? 'New Users' : 'Inactive Users'}
                          </Badge>
                          {coupon.storeId === null && (
                            <Badge variant="secondary" className="text-[10px] h-5 px-1.5 border-none bg-green-50 text-green-700">App-Wide</Badge>
                          )}
                          {coupon.minOrder ? (
                            <span className="text-[10px] text-gray-400">Min ₹{coupon.minOrder}</span>
                          ) : null}
                          {coupon.usageLimit && (
                            <span className="text-[10px] text-gray-400">Used: {coupon.usedCount}/{coupon.usageLimit}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggle(coupon.id, coupon.isActive)}
                        className={coupon.isActive ? 'text-green-600 hover:text-green-700' : 'text-gray-400 hover:text-gray-500'}
                        title={coupon.isActive ? 'Deactivate' : 'Activate'}
                      >
                        <Power className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(coupon.id, coupon.code)}
                        className="text-red-500 hover:text-red-600"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ===================== CREATE VIEW =====================
  const segBtn = (active: boolean) =>
    `flex-1 py-2 px-2 rounded-md text-sm font-semibold transition-all ${active ? 'bg-white text-[#B52725] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`;

  return (
    <div className="flex h-full gap-6">
      {/* Left: form */}
      <div className="flex-1 overflow-auto p-1">
        <Card className="border-gray-200 shadow-sm">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold tracking-[0.14em] uppercase text-[#B52725]">Coupons · New</p>
              <h3 className="text-xl font-bold text-gray-900 mt-1">Create a coupon</h3>
              <p className="text-sm text-gray-500 mt-1">Build a promotion and watch it render exactly as customers will see it.</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => { resetForm(); setViewMode('list'); }} className="gap-2 shrink-0">
              <List className="w-4 h-4" />
              Back to List
            </Button>
          </div>

          <div className="p-6 space-y-8">
            {/* DISCOUNT */}
            <section className="space-y-4">
              <h4 className="text-[11px] font-bold tracking-[0.1em] uppercase text-gray-400 border-b border-gray-100 pb-2">Discount</h4>
              <div className="space-y-2">
                <Label className="font-semibold text-gray-900">Type</Label>
                <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
                  {([['FLAT', 'Fixed amount'], ['PERCENTAGE', 'Percentage'], ['BOGO', 'BOGO']] as [DiscountType, string][]).map(([v, l]) => (
                    <button key={v} type="button" className={segBtn(discountType === v)} onClick={() => setDiscountType(v)}>{l}</button>
                  ))}
                </div>
              </div>

              {discountType === 'FLAT' && (
                <div className="space-y-2 w-1/2">
                  <Label className="font-semibold text-gray-900">Amount off</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">₹</span>
                    <Input type="number" min="0" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} className="pl-8" />
                  </div>
                </div>
              )}

              {discountType === 'PERCENTAGE' && (
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="font-semibold text-gray-900">Percentage off</Label>
                    <div className="relative">
                      <Input type="number" min="0" max="100" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} className="pr-8" />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">%</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="font-semibold text-gray-900">Max discount cap</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">₹</span>
                      <Input type="number" min="0" value={maxDiscountCap} onChange={(e) => setMaxDiscountCap(e.target.value)} className="pl-8" />
                    </div>
                    <p className="text-xs text-gray-500">Most a user can save per order.</p>
                  </div>
                </div>
              )}

              {discountType === 'BOGO' && (
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="font-semibold text-gray-900">Buy quantity</Label>
                    <Input type="number" min="1" value={bogoBuy} onChange={(e) => setBogoBuy(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-semibold text-gray-900">Get free</Label>
                    <Input type="number" min="1" value={bogoGet} onChange={(e) => setBogoGet(e.target.value)} />
                  </div>
                </div>
              )}
            </section>

            {/* DETAILS */}
            <section className="space-y-4">
              <h4 className="text-[11px] font-bold tracking-[0.1em] uppercase text-gray-400 border-b border-gray-100 pb-2">Details</h4>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="font-semibold text-gray-900">Tab label</Label>
                  <Input value={title} maxLength={14} onChange={(e) => setTitle(e.target.value)} placeholder="COUPON" />
                </div>
                <div className="space-y-2">
                  <Label className="font-semibold text-gray-900">Brand name</Label>
                  <Input value={brandName} maxLength={18} onChange={(e) => setBrandName(e.target.value)} placeholder="Pick At Store" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="font-semibold text-gray-900">Description</Label>
                <textarea
                  value={description}
                  maxLength={160}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm resize-y focus:outline-none focus:border-[#B52725] focus:ring-2 focus:ring-[#B52725]/15"
                />
                <p className="text-xs text-gray-400">{description.length}/160 characters</p>
              </div>
            </section>

            {/* VALIDITY */}
            <section className="space-y-4">
              <h4 className="text-[11px] font-bold tracking-[0.1em] uppercase text-gray-400 border-b border-gray-100 pb-2">Validity</h4>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="font-semibold text-gray-900">Valid from</Label>
                  <Input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="font-semibold text-gray-900">Valid through</Label>
                  <Input type="date" value={validThrough} disabled={noExpiry} onChange={(e) => setValidThrough(e.target.value)} className={noExpiry ? 'opacity-50' : ''} />
                </div>
              </div>
              <Toggle on={noExpiry} onChange={setNoExpiry} label="No end date — valid until cancelled" hint="Coupon stays active until you turn it off" />
            </section>

            {/* REDEEM CODE */}
            <section className="space-y-4">
              <h4 className="text-[11px] font-bold tracking-[0.1em] uppercase text-gray-400 border-b border-gray-100 pb-2">Redeem code</h4>
              <div className="space-y-2">
                <Label className="font-semibold text-gray-900">Code</Label>
                <div className="flex gap-2">
                  <Input
                    value={code}
                    disabled={autoCode}
                    onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12))}
                    className={`font-mono tracking-wider ${autoCode ? 'opacity-60' : ''}`}
                    placeholder="e.g. SUMMER20"
                  />
                  <Button type="button" variant="outline" className="gap-2 shrink-0" onClick={() => setCode(genCode())}>
                    <RefreshCw className="w-4 h-4" /> Generate
                  </Button>
                </div>
                <p className="text-xs text-gray-500 flex items-center gap-1"><Info className="w-3 h-3" /> Up to 12 alphanumeric characters.</p>
                <Toggle
                  on={autoCode}
                  onChange={(v) => { setAutoCode(v); if (v) setCode(genCode()); }}
                  label="Auto-generate unique codes"
                  hint="Each customer gets a one-time code at claim"
                />
              </div>
            </section>

            {/* LIMITS & ELIGIBILITY */}
            <section className="space-y-4">
              <h4 className="text-[11px] font-bold tracking-[0.1em] uppercase text-gray-400 border-b border-gray-100 pb-2">Limits & eligibility</h4>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="font-semibold text-gray-900">Total usage limit</Label>
                  <Input type="number" min="0" value={usageLimit} onChange={(e) => setUsageLimit(e.target.value)} placeholder="Unlimited if blank" />
                </div>
                <div className="space-y-2">
                  <Label className="font-semibold text-gray-900">Per customer</Label>
                  <Input type="number" min="0" value={perCustomerLimit} onChange={(e) => setPerCustomerLimit(e.target.value)} placeholder="Unlimited if blank" />
                </div>
                <div className="space-y-2">
                  <Label className="font-semibold text-gray-900">Minimum order</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">₹</span>
                    <Input type="number" min="0" value={minOrder} onChange={(e) => setMinOrder(e.target.value)} className="pl-8" placeholder="No minimum" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="font-semibold text-gray-900">Eligibility</Label>
                  <Select value={audience} onValueChange={(v) => setAudience(v as CreateCouponInput['targetAudience'])}>
                    <SelectTrigger><SelectValue placeholder="Select audience" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All customers</SelectItem>
                      <SelectItem value="NEW_USERS">New customers only</SelectItem>
                      <SelectItem value="INACTIVE_USERS">Inactive customers ({'>'} 30 days)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            {/* FUNDING SOURCE (business-critical, kept from prior engine) */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
                <h4 className="text-[11px] font-bold tracking-[0.1em] uppercase text-gray-400">Funding source</h4>
                <Badge variant="destructive" className="bg-red-50 text-red-600 border-red-200 hover:bg-red-100 text-[10px]">Critical finance impact</Badge>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setFundingSource('PLATFORM')}
                  className={`text-left border rounded-lg p-4 transition-all ${fundingSource === 'PLATFORM' ? 'border-[#B52725] bg-red-50/50 ring-1 ring-[#B52725]' : 'border-gray-200 hover:border-gray-300'}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${fundingSource === 'PLATFORM' ? 'border-[#B52725]' : 'border-gray-400'}`}>
                      {fundingSource === 'PLATFORM' && <div className="w-2 h-2 rounded-full bg-[#B52725]" />}
                    </div>
                    <span className="font-bold text-gray-900">Platform Funded</span>
                  </div>
                  <p className="text-sm text-gray-600 pl-6">The company bears the cost of this discount. Used for growth.</p>
                </button>

                <button
                  type="button"
                  onClick={() => setFundingSource('MERCHANT')}
                  className={`text-left border rounded-lg p-4 transition-all ${fundingSource === 'MERCHANT' ? 'border-purple-600 bg-purple-50/50 ring-1 ring-purple-600' : 'border-gray-200 hover:border-gray-300'}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${fundingSource === 'MERCHANT' ? 'border-purple-600' : 'border-gray-400'}`}>
                      {fundingSource === 'MERCHANT' && <div className="w-2 h-2 rounded-full bg-purple-600" />}
                    </div>
                    <span className="font-bold text-gray-900">Merchant Funded</span>
                  </div>
                  <p className="text-sm text-gray-600 pl-6">The store bears the cost. Used for clearance / merchant promos.</p>
                </button>
              </div>
            </section>

            {/* BRANDING */}
            <section className="space-y-4">
              <h4 className="text-[11px] font-bold tracking-[0.1em] uppercase text-gray-400 border-b border-gray-100 pb-2">Branding</h4>
              <Toggle on={showLogo} onChange={setShowLogo} label="Show logo on coupon" />
              {showLogo && (
                <label className="flex items-center gap-3 border border-dashed border-gray-300 rounded-lg p-3.5 cursor-pointer bg-[#fffdf9] hover:border-[#B52725] transition-colors">
                  {logoDataUrl
                    ? <img src={logoDataUrl} alt="" className="w-[42px] h-[42px] object-contain rounded bg-gray-50" />
                    : <span className="w-[42px] h-[42px] rounded bg-gray-50 flex items-center justify-center"><Upload className="w-5 h-5 text-gray-400" /></span>}
                  <span>
                    <span className="text-sm font-medium text-gray-700 block">{logoDataUrl ? 'Replace logo' : 'Upload logo'}</span>
                    <span className="text-xs text-gray-400">PNG or SVG, transparent background recommended</span>
                  </span>
                  {logoDataUrl && (
                    <Button type="button" variant="ghost" size="sm" className="ml-auto text-gray-500" onClick={(e) => { e.preventDefault(); setLogoDataUrl(null); }}>
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                  <input type="file" accept="image/*" className="hidden" onChange={onLogoFile} />
                </label>
              )}
            </section>

            {/* STYLE — preset themes (curated combinations of cardStyle/shape/accent/radius/density) */}
            <section className="space-y-4">
              <h4 className="text-[11px] font-bold tracking-[0.1em] uppercase text-gray-400 border-b border-gray-100 pb-2">Style</h4>
              <p className="text-xs text-gray-500 -mt-1">Choose a theme — the live preview updates instantly. Each theme is an on-brand combination of color, card style, shape, corner radius, and density.</p>
              <div className="grid grid-cols-2 gap-3">
                {COUPON_THEMES.map((opt) => {
                  const selected = theme === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setTheme(opt.id)}
                      className={`text-left border rounded-lg p-3 transition-all ${selected ? 'border-[#B52725] bg-red-50/50 ring-1 ring-[#B52725]' : 'border-gray-200 hover:border-gray-300'}`}
                    >
                      <div className="flex items-center gap-3">
                        {/* swatch: two squares = accent + body to give a visual hint */}
                        <div className="flex shrink-0 rounded-md overflow-hidden border border-gray-200">
                          <span className="block w-5 h-7" style={{ background: opt.preset.accent }} />
                          <span
                            className="block w-5 h-7"
                            style={{
                              background:
                                opt.preset.cardStyle === 'bold'
                                  ? opt.preset.accent
                                  : opt.preset.cardStyle === 'modern'
                                    ? '#fffefb'
                                    : '#f8efd8',
                            }}
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-gray-900">{opt.label}</div>
                          <div className="text-xs text-gray-500 truncate">{opt.description}</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>

          <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 rounded-b-xl">
            <Button variant="outline" onClick={() => { resetForm(); setViewMode('list'); }}>Cancel</Button>
            <Button className="bg-[#B52725] hover:bg-[#9a2120] gap-2" onClick={handleCreate} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {submitting ? 'Publishing…' : 'Publish coupon'}
            </Button>
          </div>
        </Card>
      </div>

      {/* Right: live preview */}
      <div className="w-[440px] shrink-0 flex flex-col items-center gap-6 rounded-xl border border-gray-200 p-8 overflow-auto"
        style={{ background: 'radial-gradient(circle at 50% 30%, #fff 0, #f4eede 100%)' }}>
        <span className="self-start text-[11px] font-bold tracking-[0.12em] uppercase text-gray-400">Live preview</span>

        <CouponCard t={cardData} w={376} logoDataUrl={logoDataUrl} />

        {/* summary chips */}
        <div className="flex flex-wrap gap-2 w-full">
          <span className="inline-flex items-center gap-1.5 bg-white border border-gray-200 rounded-full px-3 py-1.5 text-xs font-semibold text-gray-700">
            Status <b className="text-[#B52725]">Draft</b>
          </span>
          <span className="inline-flex items-center gap-1.5 bg-white border border-gray-200 rounded-full px-3 py-1.5 text-xs font-semibold text-gray-700">
            Limit <b className="text-[#B52725]">{usageLimit ? Number(usageLimit).toLocaleString() : '∞'}</b>
          </span>
          <span className="inline-flex items-center gap-1.5 bg-white border border-gray-200 rounded-full px-3 py-1.5 text-xs font-semibold text-gray-700">
            Per customer <b className="text-[#B52725]">{perCustomerLimit || '∞'}</b>
          </span>
          <span className="inline-flex items-center gap-1.5 bg-white border border-gray-200 rounded-full px-3 py-1.5 text-xs font-semibold text-gray-700">
            Min order <b className="text-[#B52725]">{minOrder ? money(minOrder) : '—'}</b>
          </span>
        </div>
      </div>
    </div>
  );
}

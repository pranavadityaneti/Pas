import { useState, useEffect } from 'react';
import {
  Info,
  CheckCircle2,
  Percent,
  Trash2,
  Power,
  Loader2,
  Plus,
  List,
  Eye
} from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { RadioGroup, RadioGroupItem } from '../../ui/radio-group';
import { Checkbox } from '../../ui/checkbox';
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
  type CreateCouponInput
} from '../../../lib/couponService';

type ViewMode = 'list' | 'create';

export function CouponBuilder() {
  // View mode
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  // Form state
  const [promoCode, setPromoCode] = useState('');
  const [discountType, setDiscountType] = useState<'PERCENTAGE' | 'FLAT'>('PERCENTAGE');
  const [discountValue, setDiscountValue] = useState('');
  const [maxDiscountCap, setMaxDiscountCap] = useState('100');
  const [fundingSource, setFundingSource] = useState<'PLATFORM' | 'MERCHANT'>('PLATFORM');
  const [audience, setAudience] = useState<string>('ALL');
  const [usageLimit, setUsageLimit] = useState('');
  const [endDate, setEndDate] = useState('');

  // Data state
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Load coupons on mount
  useEffect(() => {
    loadCoupons();
  }, []);

  const loadCoupons = async () => {
    setLoading(true);
    try {
      const data = await fetchCoupons();
      setCoupons(data);
    } catch (err: any) {
      toast.error('Failed to load coupons', { description: err?.message });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setPromoCode('');
    setDiscountType('PERCENTAGE');
    setDiscountValue('');
    setMaxDiscountCap('100');
    setFundingSource('PLATFORM');
    setAudience('ALL');
    setUsageLimit('');
    setEndDate('');
  };

  const handleCreate = async () => {
    // Validation
    if (!promoCode.trim()) {
      toast.error('Promo code is required');
      return;
    }
    if (!discountValue || Number(discountValue) <= 0) {
      toast.error('Discount value must be greater than 0');
      return;
    }
    if (discountType === 'PERCENTAGE' && Number(discountValue) > 100) {
      toast.error('Percentage discount cannot exceed 100%');
      return;
    }

    setSubmitting(true);
    try {
      const input: CreateCouponInput = {
        code: promoCode.toUpperCase(),
        discountType,
        discountValue: Number(discountValue),
        maxDiscountCap: maxDiscountCap ? Number(maxDiscountCap) : null,
        fundingSource,
        targetAudience: audience as CreateCouponInput['targetAudience'],
        storeId: null, // App-wide coupon (Super Admin)
        usageLimit: usageLimit ? Number(usageLimit) : null,
        startDate: new Date().toISOString(),
        endDate: endDate ? new Date(endDate).toISOString() : null,
      };

      await createCoupon(input);
      toast.success('Coupon created successfully!', { description: `Code: ${promoCode.toUpperCase()}` });
      resetForm();
      setViewMode('list');
      loadCoupons();
    } catch (err: any) {
      // Handle duplicate code error
      if (err?.code === '23505') {
        toast.error('Coupon code already exists', { description: 'Please use a different code.' });
      } else {
        toast.error('Failed to create coupon', { description: err?.message });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, code: string) => {
    if (!confirm(`Delete coupon "${code}"? This cannot be undone.`)) return;
    try {
      await deleteCoupon(id);
      toast.success('Coupon deleted', { description: code });
      loadCoupons();
    } catch (err: any) {
      toast.error('Failed to delete coupon', { description: err?.message });
    }
  };

  const handleToggle = async (id: string, currentStatus: boolean) => {
    try {
      await toggleCouponStatus(id, !currentStatus);
      toast.success(`Coupon ${!currentStatus ? 'activated' : 'deactivated'}`);
      loadCoupons();
    } catch (err: any) {
      toast.error('Failed to update status', { description: err?.message });
    }
  };

  // --- LIST VIEW ---
  if (viewMode === 'list') {
    return (
      <div className="flex flex-col h-full gap-4">
        {/* Header Bar */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Percent className="w-5 h-5 text-[#B52725]" />
              Active Coupons
            </h3>
            <p className="text-sm text-gray-500 mt-0.5">{coupons.length} coupon{coupons.length !== 1 ? 's' : ''} configured</p>
          </div>
          <Button
            onClick={() => setViewMode('create')}
            className="bg-[#121212] hover:bg-[#2d2d2d] gap-2"
          >
            <Plus className="w-4 h-4" />
            Create Coupon
          </Button>
        </div>

        <Separator />

        {/* Coupon List */}
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
            <Button
              onClick={() => setViewMode('create')}
              className="mt-4 bg-[#B52725] hover:bg-[#9a2120] gap-2"
            >
              <Plus className="w-4 h-4" />
              Create First Coupon
            </Button>
          </div>
        ) : (
          <div className="grid gap-3 overflow-auto flex-1">
            {coupons.map((coupon) => (
              <Card key={coupon.id} className={`border transition-all ${coupon.is_active ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {/* Code Badge */}
                      <div className="bg-gray-900 text-white px-3 py-1.5 rounded-lg font-mono text-sm font-bold tracking-wider">
                        {coupon.code}
                      </div>

                      {/* Details */}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900">
                            {coupon.discount_type === 'PERCENTAGE'
                              ? `${coupon.discount_value}% OFF`
                              : `₹${coupon.discount_value} OFF`}
                          </span>
                          {coupon.max_discount_cap && coupon.discount_type === 'PERCENTAGE' && (
                            <span className="text-xs text-gray-500">(Max ₹{coupon.max_discount_cap})</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge
                            variant="secondary"
                            className={`text-[10px] h-5 px-1.5 border-none ${coupon.funding_source === 'PLATFORM'
                                ? 'bg-red-50 text-red-600'
                                : 'bg-purple-50 text-purple-600'
                              }`}
                          >
                            {coupon.funding_source === 'PLATFORM' ? 'Platform Funded' : 'Merchant Funded'}
                          </Badge>
                          <Badge variant="secondary" className="text-[10px] h-5 px-1.5 border-none bg-blue-50 text-blue-600">
                            {coupon.target_audience === 'ALL' ? 'All Users' : coupon.target_audience === 'NEW_USERS' ? 'New Users' : 'Inactive Users'}
                          </Badge>
                          {coupon.store_id === null && (
                            <Badge variant="secondary" className="text-[10px] h-5 px-1.5 border-none bg-green-50 text-green-700">
                              App-Wide
                            </Badge>
                          )}
                          {coupon.usage_limit && (
                            <span className="text-[10px] text-gray-400">
                              Used: {coupon.used_count}/{coupon.usage_limit}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggle(coupon.id, coupon.is_active)}
                        className={coupon.is_active ? 'text-green-600 hover:text-green-700' : 'text-gray-400 hover:text-gray-500'}
                        title={coupon.is_active ? 'Deactivate' : 'Activate'}
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

  // --- CREATE VIEW ---
  return (
    <div className="flex h-full gap-6">
      {/* Left Panel: The Form */}
      <div className="flex-1 overflow-auto p-1">
        <Card className="border-gray-200 shadow-sm h-full flex flex-col">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Percent className="w-5 h-5 text-[#B52725]" />
                Coupon Configuration
              </h3>
              <p className="text-sm text-gray-500 mt-1">Define the rules and limits for this promotion.</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => { resetForm(); setViewMode('list'); }} className="gap-2">
              <List className="w-4 h-4" />
              Back to List
            </Button>
          </div>

          <div className="p-6 space-y-8 flex-1 overflow-auto">
            {/* Promo Code Input */}
            <div className="space-y-3">
              <Label className="text-base font-semibold text-gray-900">Promo Code</Label>
              <Input
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))}
                className="font-mono text-lg uppercase tracking-wider border-gray-300 focus:border-[#B52725]"
                placeholder="e.g. SUMMER20"
              />
              <p className="text-xs text-gray-500 flex items-center gap-1">
                <Info className="w-3 h-3" /> Max 10 alphanumeric characters.
              </p>
            </div>

            <Separator />

            {/* Discount Logic */}
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-3">
                <Label className="font-semibold text-gray-900">Discount Type</Label>
                <Select value={discountType} onValueChange={(v) => setDiscountType(v as 'PERCENTAGE' | 'FLAT')}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PERCENTAGE">Percentage (%)</SelectItem>
                    <SelectItem value="FLAT">Flat Amount (₹)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-3">
                <Label className="font-semibold text-gray-900">Value</Label>
                <div className="relative">
                  <Input
                    type="number"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    className="pl-8"
                    placeholder="e.g. 50"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">
                    {discountType === 'PERCENTAGE' ? '%' : '₹'}
                  </span>
                </div>
              </div>
            </div>

            {discountType === 'PERCENTAGE' && (
              <div className="space-y-3">
                <Label className="font-semibold text-gray-900">Max Discount Cap</Label>
                <div className="relative w-1/2">
                  <Input
                    type="number"
                    value={maxDiscountCap}
                    onChange={(e) => setMaxDiscountCap(e.target.value)}
                    className="pl-8"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">₹</span>
                </div>
                <p className="text-xs text-gray-500">Maximum amount a user can save per order.</p>
              </div>
            )}

            <Separator />

            {/* Funding Source */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Label className="font-semibold text-gray-900 text-base">Funding Source</Label>
                <Badge variant="destructive" className="bg-red-50 text-red-600 border-red-200 hover:bg-red-100">Critical Finance Impact</Badge>
              </div>
              <RadioGroup value={fundingSource} onValueChange={(v) => setFundingSource(v as 'PLATFORM' | 'MERCHANT')} className="grid grid-cols-2 gap-4">
                <div className={`border rounded-lg p-4 cursor-pointer transition-all ${fundingSource === 'PLATFORM' ? 'border-[#B52725] bg-red-50/50 ring-1 ring-[#B52725]' : 'border-gray-200 hover:border-gray-300'}`}>
                  <RadioGroupItem value="PLATFORM" id="platform" className="sr-only" />
                  <Label htmlFor="platform" className="cursor-pointer">
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${fundingSource === 'PLATFORM' ? 'border-[#B52725]' : 'border-gray-400'}`}>
                        {fundingSource === 'PLATFORM' && <div className="w-2 h-2 rounded-full bg-[#B52725]" />}
                      </div>
                      <span className="font-bold text-gray-900">Platform Funded</span>
                    </div>
                    <p className="text-sm text-gray-600 pl-6">The company bears the cost of this discount. Used for growth.</p>
                  </Label>
                </div>

                <div className={`border rounded-lg p-4 cursor-pointer transition-all ${fundingSource === 'MERCHANT' ? 'border-purple-600 bg-purple-50/50 ring-1 ring-purple-600' : 'border-gray-200 hover:border-gray-300'}`}>
                  <RadioGroupItem value="MERCHANT" id="merchant" className="sr-only" />
                  <Label htmlFor="merchant" className="cursor-pointer">
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${fundingSource === 'MERCHANT' ? 'border-purple-600' : 'border-gray-400'}`}>
                        {fundingSource === 'MERCHANT' && <div className="w-2 h-2 rounded-full bg-purple-600" />}
                      </div>
                      <span className="font-bold text-gray-900">Merchant Funded</span>
                    </div>
                    <p className="text-sm text-gray-600 pl-6">The store bears the cost. Used for clearance/merchant promos.</p>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <Separator />

            {/* Audience */}
            <div className="space-y-3">
              <Label className="font-semibold text-gray-900">Target Audience</Label>
              <Select value={audience} onValueChange={setAudience}>
                <SelectTrigger>
                  <SelectValue placeholder="Select audience" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Users</SelectItem>
                  <SelectItem value="NEW_USERS">New Users Only (First Order)</SelectItem>
                  <SelectItem value="INACTIVE_USERS">Inactive Users ({'>'} 30 Days)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Usage Limit & Expiry */}
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-3">
                <Label className="font-semibold text-gray-900">Usage Limit</Label>
                <Input
                  type="number"
                  value={usageLimit}
                  onChange={(e) => setUsageLimit(e.target.value)}
                  placeholder="Unlimited if blank"
                />
                <p className="text-xs text-gray-500">Total times this coupon can be used. Leave blank for unlimited.</p>
              </div>
              <div className="space-y-3">
                <Label className="font-semibold text-gray-900">Expiry Date</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
                <p className="text-xs text-gray-500">Leave blank for no expiry.</p>
              </div>
            </div>
          </div>

          <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 rounded-b-xl">
            <Button variant="outline" onClick={() => { resetForm(); setViewMode('list'); }}>Cancel</Button>
            <Button
              className="bg-[#B52725] hover:bg-[#9a2120] gap-2"
              onClick={handleCreate}
              disabled={submitting}
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {submitting ? 'Creating...' : 'Launch Coupon'}
            </Button>
          </div>
        </Card>
      </div>

      {/* Right Panel: Live Preview */}
      <div className="w-[380px] shrink-0 flex flex-col items-center justify-center bg-gray-100 rounded-xl border border-gray-200 p-8 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:16px_16px]"></div>

        <div className="text-center mb-8 z-10">
          <h3 className="text-lg font-bold text-gray-900 mb-1">Mobile App Preview</h3>
          <p className="text-sm text-gray-500">Live preview of the coupon card</p>
        </div>

        {/* Mobile Screen Container */}
        <div className="w-[320px] bg-white rounded-3xl shadow-2xl border-4 border-gray-900 overflow-hidden relative z-10">
          {/* Status Bar */}
          <div className="h-7 bg-gray-900 w-full flex items-center justify-between px-4">
            <div className="text-[10px] text-white font-medium">9:41</div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 bg-white rounded-full opacity-20"></div>
              <div className="w-3 h-3 bg-white rounded-full opacity-20"></div>
              <div className="w-4 h-2.5 border border-white rounded-[2px] opacity-40"></div>
            </div>
          </div>

          {/* App Content */}
          <div className="p-4 bg-gray-50 min-h-[500px]">
            <p className="text-xs font-bold text-gray-500 mb-3 uppercase tracking-wider">Checkout</p>

            {/* The Coupon Card */}
            <div className="bg-white rounded-lg border-2 border-dashed border-[#B52725] p-4 relative overflow-hidden shadow-sm">
              <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-gray-50 rounded-full"></div>
              <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-gray-50 rounded-full"></div>

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center shrink-0">
                  <Percent className="w-6 h-6 text-[#B52725]" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-gray-900 text-lg">{promoCode || 'CODE'}</h4>
                    <span className="text-[#B52725] font-bold text-sm">APPLY</span>
                  </div>
                  <p className="text-sm text-gray-600 font-medium mt-0.5">
                    Get {discountType === 'PERCENTAGE' ? `${discountValue || '0'}%` : `₹${discountValue || '0'}`} OFF
                  </p>
                  <p className="text-[10px] text-gray-400 mt-1 line-clamp-1">
                    {discountType === 'PERCENTAGE' && maxDiscountCap ? `Max discount ₹${maxDiscountCap}` : 'No cap'}
                    {' • '}
                    {audience === 'NEW_USERS' ? 'New users only' : audience === 'INACTIVE_USERS' ? 'Inactive users' : 'Valid on all orders'}
                  </p>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-dashed border-gray-200 flex items-center gap-2">
                <Badge variant="secondary" className="bg-green-100 text-green-700 text-[10px] hover:bg-green-100 h-5 px-1.5 border-none">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Valid
                </Badge>
                <span className="text-[10px] text-gray-400 ml-auto">
                  {endDate ? `Expires ${new Date(endDate).toLocaleDateString()}` : 'No expiry'}
                </span>
              </div>
            </div>

            {/* Mock Cart Items */}
            <div className="mt-6 space-y-3 opacity-50 pointer-events-none">
              <div className="h-12 bg-white rounded-lg w-full"></div>
              <div className="h-12 bg-white rounded-lg w-full"></div>
              <div className="h-32 bg-white rounded-lg w-full mt-6"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

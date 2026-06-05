/**
 * MerchantSignupCoupons — Admin CRUD for partner signup coupons.
 *
 * 2026-06-04 (Phase 2.E2): Lets admins create, list, toggle, and inspect
 * redemptions of merchant-signup coupons WITHOUT engineering involvement.
 * Backed by /admin/merchant-signup-coupons endpoints in apps/api.
 *
 * The two seed coupons (LAUNCH100, LAUNCH500) created by the migration
 * appear here on first load.
 *
 * Code + discountInr are immutable after create (server-enforced) — admin
 * can change isActive / maxUses / expiresAt / appliesToTier inline.
 *
 * No fancy preview/theming like the consumer CouponBuilder — these codes
 * are typed by hand into the signup app, so a utility CRUD surface is
 * the right altitude.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
    Loader2, Plus, Search, Power, Eye, Calendar as CalendarIcon, Tag, X,
} from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Card, CardContent } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Switch } from '../../ui/switch';
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '../../ui/dialog';
import {
    listMerchantSignupCoupons,
    createMerchantSignupCoupon,
    updateMerchantSignupCoupon,
    listMerchantSignupCouponRedemptions,
    type MerchantSignupCoupon,
    type MerchantSignupCouponRedemption,
    type CouponTier,
} from '../../../lib/merchantSignupCouponService';

function formatDate(iso: string | null): string {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
    } catch {
        return iso;
    }
}

function formatExpiryShort(iso: string | null): string {
    if (!iso) return 'Never';
    try {
        return new Date(iso).toLocaleDateString('en-IN', { dateStyle: 'medium' });
    } catch {
        return iso;
    }
}

interface CreateFormState {
    code: string;
    discountInr: string;
    maxUses: string;
    appliesToTier: 'all' | 'standard' | 'premium';
    expiresAt: string;
    isActive: boolean;
}

const EMPTY_FORM: CreateFormState = {
    code: '',
    discountInr: '',
    maxUses: '',
    appliesToTier: 'all',
    expiresAt: '',
    isActive: true,
};

export function MerchantSignupCoupons() {
    const [coupons, setCoupons] = useState<MerchantSignupCoupon[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('');
    const [showCreate, setShowCreate] = useState(false);
    const [createForm, setCreateForm] = useState<CreateFormState>(EMPTY_FORM);
    const [submitting, setSubmitting] = useState(false);
    const [redemptionTarget, setRedemptionTarget] = useState<MerchantSignupCoupon | null>(null);
    const [redemptions, setRedemptions] = useState<MerchantSignupCouponRedemption[]>([]);
    const [redemptionsLoading, setRedemptionsLoading] = useState(false);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const rows = await listMerchantSignupCoupons();
            setCoupons(rows);
        } catch (err: any) {
            toast.error('Failed to load coupons', {
                description: err?.response?.data?.error ?? err?.message,
            });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const filteredCoupons = useMemo(() => {
        const f = filter.trim().toUpperCase();
        if (!f) return coupons;
        return coupons.filter(c => c.code.includes(f));
    }, [coupons, filter]);

    const handleCreate = async () => {
        const code = createForm.code.trim().toUpperCase();
        const discount = Number(createForm.discountInr);
        if (!code || !/^[A-Z0-9_-]{3,30}$/.test(code)) {
            toast.error('Invalid code', { description: '3-30 chars, letters/digits/underscore/hyphen only.' });
            return;
        }
        if (!Number.isFinite(discount) || discount <= 0) {
            toast.error('Invalid discount', { description: 'Must be a positive number.' });
            return;
        }
        const maxUses = createForm.maxUses.trim() === '' ? null : Number(createForm.maxUses);
        if (maxUses !== null && (!Number.isFinite(maxUses) || maxUses <= 0)) {
            toast.error('Invalid max uses', { description: 'Leave blank for unlimited, or enter a positive number.' });
            return;
        }
        const expiresAt = createForm.expiresAt ? new Date(createForm.expiresAt).toISOString() : null;
        const tier: CouponTier =
            createForm.appliesToTier === 'standard' ? 'standard' :
            createForm.appliesToTier === 'premium' ? 'premium' :
            null;

        try {
            setSubmitting(true);
            const created = await createMerchantSignupCoupon({
                code,
                discountInr: Math.floor(discount),
                maxUses,
                appliesToTier: tier,
                expiresAt,
                isActive: createForm.isActive,
            });
            setCoupons(prev => [created, ...prev]);
            setShowCreate(false);
            setCreateForm(EMPTY_FORM);
            toast.success('Coupon created', { description: `${created.code} — ₹${created.discountInr} off` });
        } catch (err: any) {
            toast.error('Could not create coupon', {
                description: err?.response?.data?.error ?? err?.message,
            });
        } finally {
            setSubmitting(false);
        }
    };

    const toggleActive = async (c: MerchantSignupCoupon) => {
        try {
            const updated = await updateMerchantSignupCoupon(c.id, { isActive: !c.isActive });
            setCoupons(prev => prev.map(x => x.id === updated.id ? updated : x));
            toast.success(`${updated.code} ${updated.isActive ? 'activated' : 'deactivated'}`);
        } catch (err: any) {
            toast.error('Toggle failed', {
                description: err?.response?.data?.error ?? err?.message,
            });
        }
    };

    const openRedemptions = async (c: MerchantSignupCoupon) => {
        setRedemptionTarget(c);
        setRedemptionsLoading(true);
        try {
            const rows = await listMerchantSignupCouponRedemptions(c.id);
            setRedemptions(rows);
        } catch (err: any) {
            toast.error('Could not load redemptions', {
                description: err?.response?.data?.error ?? err?.message,
            });
        } finally {
            setRedemptionsLoading(false);
        }
    };

    return (
        <div className="space-y-4">
            {/* Header row: title + filter + create */}
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h2 className="text-lg font-semibold text-gray-900">Merchant Signup Coupons</h2>
                    <p className="text-sm text-gray-500">
                        Codes merchants can apply at signup for a flat ₹ discount. Separate from consumer coupons.
                    </p>
                </div>
                <Button onClick={() => setShowCreate(true)} className="bg-[#B52725] hover:bg-[#9d2120]">
                    <Plus className="w-4 h-4 mr-1" /> New Coupon
                </Button>
            </div>

            <div className="flex items-center gap-2">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                        className="pl-9"
                        placeholder="Filter by code…"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                    />
                </div>
                {!loading && (
                    <span className="text-sm text-gray-500">
                        {filteredCoupons.length} of {coupons.length}
                    </span>
                )}
            </div>

            {/* List */}
            {loading ? (
                <div className="flex items-center justify-center py-16 text-gray-500">
                    <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading coupons…
                </div>
            ) : filteredCoupons.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center text-gray-500">
                        {filter ? `No coupons matching "${filter}".` : 'No coupons yet — create the first one.'}
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {filteredCoupons.map(c => {
                        const isExpired = c.expiresAt && new Date(c.expiresAt).getTime() < Date.now();
                        const exhausted = c.maxUses !== null && c.usedCount >= c.maxUses;
                        const effectivelyActive = c.isActive && !isExpired && !exhausted;

                        return (
                            <Card key={c.id} className={!effectivelyActive ? 'opacity-70' : ''}>
                                <CardContent className="p-4 space-y-3">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <Tag className="w-4 h-4 text-[#B52725]" />
                                                <span className="font-mono font-semibold text-gray-900">{c.code}</span>
                                            </div>
                                            <div className="text-2xl font-bold text-gray-900 mt-1">
                                                ₹{c.discountInr.toLocaleString('en-IN')}
                                                <span className="text-sm text-gray-500 font-normal"> off</span>
                                            </div>
                                        </div>
                                        <Switch
                                            checked={c.isActive}
                                            onCheckedChange={() => toggleActive(c)}
                                            title={c.isActive ? 'Deactivate' : 'Activate'}
                                        />
                                    </div>

                                    <div className="flex flex-wrap gap-1 text-xs">
                                        {c.appliesToTier ? (
                                            <Badge variant="secondary">{c.appliesToTier} tier</Badge>
                                        ) : (
                                            <Badge variant="secondary">all tiers</Badge>
                                        )}
                                        {c.maxUses === null ? (
                                            <Badge variant="outline">∞ uses</Badge>
                                        ) : (
                                            <Badge variant="outline">{c.usedCount}/{c.maxUses}</Badge>
                                        )}
                                        {isExpired && <Badge variant="destructive">expired</Badge>}
                                        {exhausted && !isExpired && <Badge variant="destructive">exhausted</Badge>}
                                    </div>

                                    <div className="text-xs text-gray-500 space-y-1">
                                        <div className="flex items-center gap-1">
                                            <CalendarIcon className="w-3 h-3" />
                                            <span>Expires {formatExpiryShort(c.expiresAt)}</span>
                                        </div>
                                        <div>{c.redemptionCount} redemption{c.redemptionCount === 1 ? '' : 's'}</div>
                                    </div>

                                    <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                                        <span className="text-xs text-gray-400">
                                            Created {formatExpiryShort(c.createdAt)}
                                        </span>
                                        <Button variant="ghost" size="sm" onClick={() => openRedemptions(c)}>
                                            <Eye className="w-3 h-3 mr-1" />
                                            View redemptions
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* Create dialog */}
            <Dialog open={showCreate} onOpenChange={setShowCreate}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>New Merchant Signup Coupon</DialogTitle>
                        <DialogDescription>
                            Flat ₹ off applied at the Subscription step. Code and amount are immutable after creation.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <div className="grid gap-2">
                            <Label htmlFor="msc-code">Code</Label>
                            <Input
                                id="msc-code"
                                placeholder="LAUNCH2026"
                                value={createForm.code}
                                onChange={(e) => setCreateForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                                className="font-mono"
                                maxLength={30}
                            />
                            <p className="text-xs text-gray-500">3-30 chars; letters, digits, underscore, hyphen.</p>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="msc-discount">Discount (₹)</Label>
                            <Input
                                id="msc-discount"
                                type="number"
                                min={1}
                                step={1}
                                placeholder="500"
                                value={createForm.discountInr}
                                onChange={(e) => setCreateForm(f => ({ ...f, discountInr: e.target.value }))}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="grid gap-2">
                                <Label htmlFor="msc-maxuses">Max uses (optional)</Label>
                                <Input
                                    id="msc-maxuses"
                                    type="number"
                                    min={1}
                                    step={1}
                                    placeholder="unlimited"
                                    value={createForm.maxUses}
                                    onChange={(e) => setCreateForm(f => ({ ...f, maxUses: e.target.value }))}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label>Applies to</Label>
                                <Select
                                    value={createForm.appliesToTier}
                                    onValueChange={(v: 'all' | 'standard' | 'premium') => setCreateForm(f => ({ ...f, appliesToTier: v }))}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All tiers</SelectItem>
                                        <SelectItem value="standard">Standard only</SelectItem>
                                        <SelectItem value="premium">Premium only</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="msc-expires">Expires at (optional)</Label>
                            <Input
                                id="msc-expires"
                                type="datetime-local"
                                value={createForm.expiresAt}
                                onChange={(e) => setCreateForm(f => ({ ...f, expiresAt: e.target.value }))}
                            />
                            <p className="text-xs text-gray-500">Leave blank for no expiry.</p>
                        </div>

                        <div className="flex items-center justify-between rounded-md border border-gray-200 p-3">
                            <div>
                                <Label htmlFor="msc-active" className="font-medium">Active immediately</Label>
                                <p className="text-xs text-gray-500">Merchants can apply this code as soon as it's created.</p>
                            </div>
                            <Switch
                                id="msc-active"
                                checked={createForm.isActive}
                                onCheckedChange={(checked) => setCreateForm(f => ({ ...f, isActive: checked }))}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setShowCreate(false)} disabled={submitting}>
                            Cancel
                        </Button>
                        <Button onClick={handleCreate} disabled={submitting} className="bg-[#B52725] hover:bg-[#9d2120]">
                            {submitting ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Creating…</> : 'Create coupon'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Redemptions dialog */}
            <Dialog open={!!redemptionTarget} onOpenChange={(open) => !open && setRedemptionTarget(null)}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            Redemptions for{' '}
                            <span className="font-mono">{redemptionTarget?.code}</span>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="ml-auto"
                                onClick={() => setRedemptionTarget(null)}
                            >
                                <X className="w-4 h-4" />
                            </Button>
                        </DialogTitle>
                        <DialogDescription>
                            {redemptionTarget?.redemptionCount ?? 0} merchant{(redemptionTarget?.redemptionCount ?? 0) === 1 ? '' : 's'} have applied this coupon.
                        </DialogDescription>
                    </DialogHeader>

                    {redemptionsLoading ? (
                        <div className="flex items-center justify-center py-12 text-gray-500">
                            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
                        </div>
                    ) : redemptions.length === 0 ? (
                        <div className="py-8 text-center text-gray-500 text-sm">No redemptions yet.</div>
                    ) : (
                        <div className="space-y-2 max-h-[400px] overflow-auto">
                            {redemptions.map(r => (
                                <div key={r.id} className="rounded border border-gray-200 p-3 text-sm flex items-center justify-between">
                                    <div>
                                        <div className="font-medium text-gray-900">
                                            {r.merchant?.storeName || r.merchant?.ownerName || '(unnamed merchant)'}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            {r.merchant?.phone || '—'} · {r.merchant?.email || '—'}
                                        </div>
                                        <div className="text-xs text-gray-400 mt-1">
                                            Applied {formatDate(r.appliedAt)}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-semibold text-gray-900">₹{r.amountInr.toLocaleString('en-IN')}</div>
                                        {r.merchant?.status && (
                                            <Badge variant="outline" className="text-xs mt-1">{r.merchant.status}</Badge>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

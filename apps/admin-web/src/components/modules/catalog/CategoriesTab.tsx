// Category-visibility feature · Task 6 (spec D5). Admin "Categories" view inside the
// Master Catalog module: list the 15 Verticals (+ their Tier2 subcategories) each with
// a single on/off toggle. Disabling hides the category + all its products from customers
// instantly (RESTRICTIVE RLS) and blocks new merchant listings (server guard). Reads via
// the admin API (service_role) so disabled categories are always visible here to manage.
import { useState, useEffect, useCallback } from 'react';
import { ChevronRight, Loader2, AlertTriangle, RefreshCw, FolderTree, Package } from 'lucide-react';
import api from '@/lib/api';
import { Switch } from '../../ui/switch';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Collapsible, CollapsibleContent } from '../../ui/collapsible';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../ui/alert-dialog';
import { toast } from 'sonner';

interface Subcategory { id: string; name: string; active: boolean; productCount: number; }
interface Category {
  id: string;
  name: string;
  isActive: boolean;
  requiresFssai: boolean;
  productCount: number;
  subcategories: Subcategory[];
}

// A toggle awaiting confirmation (only disabling needs it; enabling is non-destructive).
interface Pending {
  kind: 'vertical' | 'subcategory';
  id: string;
  verticalId: string; // parent for subcategory; same as id for a vertical
  name: string;
  next: boolean;
  productCount: number;
}

export function CategoriesTab() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [pending, setPending] = useState<Pending | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/admin/categories');
      setCategories(res.data?.categories ?? []);
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Optimistic toggle with revert-on-error. Keyed `saving` map disables the Switch in flight.
  const applyVertical = async (id: string, next: boolean) => {
    const key = `vertical:${id}`;
    setSaving((s) => ({ ...s, [key]: true }));
    setCategories((cs) => cs.map((c) => (c.id === id ? { ...c, isActive: next } : c)));
    try {
      await api.patch(`/admin/categories/vertical/${id}`, { isActive: next });
      toast.success(`Category ${next ? 'enabled' : 'disabled'}`);
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Failed to update category');
      setCategories((cs) => cs.map((c) => (c.id === id ? { ...c, isActive: !next } : c)));
    } finally {
      setSaving((s) => ({ ...s, [key]: false }));
    }
  };

  const applySubcategory = async (verticalId: string, id: string, next: boolean) => {
    const key = `subcategory:${id}`;
    setSaving((s) => ({ ...s, [key]: true }));
    setCategories((cs) => cs.map((c) => (c.id === verticalId
      ? { ...c, subcategories: c.subcategories.map((s2) => (s2.id === id ? { ...s2, active: next } : s2)) }
      : c)));
    try {
      await api.patch(`/admin/categories/subcategory/${id}`, { active: next });
      toast.success(`Subcategory ${next ? 'enabled' : 'disabled'}`);
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Failed to update subcategory');
      setCategories((cs) => cs.map((c) => (c.id === verticalId
        ? { ...c, subcategories: c.subcategories.map((s2) => (s2.id === id ? { ...s2, active: !next } : s2)) }
        : c)));
    } finally {
      setSaving((s) => ({ ...s, [key]: false }));
    }
  };

  // Disabling is high-impact → confirm first. Enabling applies immediately.
  const onVerticalToggle = (c: Category, next: boolean) => {
    if (next) applyVertical(c.id, next);
    else setPending({ kind: 'vertical', id: c.id, verticalId: c.id, name: c.name, next, productCount: c.productCount });
  };
  const onSubToggle = (verticalId: string, s: Subcategory, next: boolean) => {
    if (next) applySubcategory(verticalId, s.id, next);
    else setPending({ kind: 'subcategory', id: s.id, verticalId, name: s.name, next, productCount: s.productCount });
  };

  const confirmPending = async () => {
    if (!pending) return;
    const p = pending;
    setPending(null);
    if (p.kind === 'vertical') await applyVertical(p.id, p.next);
    else await applySubcategory(p.verticalId, p.id, p.next);
  };

  const liveCount = categories.filter((c) => c.isActive).length;

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-20 text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading categories…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-20 gap-3">
        <AlertTriangle className="w-8 h-8 text-amber-500" />
        <p className="text-sm text-gray-600">{error}</p>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="w-4 h-4 mr-2" /> Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
      <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
        <div className="text-sm text-gray-600">
          <span className="font-semibold text-gray-900">{liveCount}</span> of{' '}
          <span className="font-semibold text-gray-900">{categories.length}</span> categories live
        </div>
        <Button variant="ghost" size="sm" onClick={load}>
          <RefreshCw className="w-4 h-4 mr-2" /> Refresh
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
        {categories.map((c) => {
          const isOpen = !!expanded[c.id];
          const vKey = `vertical:${c.id}`;
          return (
            <Collapsible key={c.id} open={isOpen} onOpenChange={(o) => setExpanded((e) => ({ ...e, [c.id]: o }))}>
              <div className={`flex items-center gap-3 px-4 py-3 ${c.isActive ? '' : 'bg-gray-50/70'}`}>
                <button
                  type="button"
                  onClick={() => setExpanded((e) => ({ ...e, [c.id]: !isOpen }))}
                  className={`p-1 rounded hover:bg-gray-100 text-gray-400 transition-transform ${isOpen ? 'rotate-90' : ''} ${c.subcategories.length ? '' : 'invisible'}`}
                  aria-label="Toggle subcategories"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <FolderTree className={`w-4 h-4 ${c.isActive ? 'text-[#B52725]' : 'text-gray-300'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`font-medium truncate ${c.isActive ? 'text-gray-900' : 'text-gray-400'}`}>{c.name}</span>
                    {c.requiresFssai && (
                      <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border border-amber-200 text-[10px] h-4 px-1">FSSAI</Badge>
                    )}
                    {!c.isActive && (
                      <Badge className="bg-gray-200 text-gray-600 hover:bg-gray-200 text-[10px] h-4 px-1">Hidden from customers</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                    <Package className="w-3 h-3" />
                    {c.productCount.toLocaleString('en-IN')} products
                    {c.subcategories.length > 0 && <span>· {c.subcategories.length} subcategories</span>}
                  </div>
                </div>
                {saving[vKey] && <Loader2 className="w-4 h-4 animate-spin text-gray-300" />}
                <Switch
                  checked={c.isActive}
                  disabled={!!saving[vKey]}
                  onCheckedChange={(v) => onVerticalToggle(c, v)}
                  // OFF state must stay clearly visible (the shared default track is near-white →
                  // invisible on the greyed disabled row). Force a grey track + border so the
                  // re-enable toggle is always findable.
                  className="data-[state=unchecked]:!bg-gray-300 data-[state=unchecked]:!border-gray-400 shrink-0"
                />
              </div>

              <CollapsibleContent>
                <div className="bg-gray-50/40">
                  {c.subcategories.map((s) => {
                    const sKey = `subcategory:${s.id}`;
                    const effectivelyHidden = !c.isActive; // parent off → child hidden regardless
                    return (
                      <div key={s.id} className="flex items-center gap-3 pl-14 pr-4 py-2.5 border-t border-gray-100">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`text-sm truncate ${s.active && !effectivelyHidden ? 'text-gray-700' : 'text-gray-400'}`}>{s.name}</span>
                            {!s.active && (
                              <Badge className="bg-gray-200 text-gray-600 hover:bg-gray-200 text-[10px] h-4 px-1">Off</Badge>
                            )}
                          </div>
                          <div className="text-xs text-gray-400 mt-0.5">{s.productCount.toLocaleString('en-IN')} products</div>
                        </div>
                        {saving[sKey] && <Loader2 className="w-4 h-4 animate-spin text-gray-300" />}
                        <Switch
                          checked={s.active}
                          disabled={!!saving[sKey]}
                          onCheckedChange={(v) => onSubToggle(c.id, s, v)}
                          className="data-[state=unchecked]:!bg-gray-300 data-[state=unchecked]:!border-gray-400 shrink-0"
                        />
                      </div>
                    );
                  })}
                  {c.subcategories.length === 0 && (
                    <div className="pl-14 pr-4 py-2.5 text-xs text-gray-400 border-t border-gray-100">No subcategories.</div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
        {categories.length === 0 && (
          <div className="py-20 text-center text-sm text-gray-400">No categories found.</div>
        )}
      </div>

      <AlertDialog open={!!pending} onOpenChange={(o) => { if (!o) setPending(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Disable {pending?.kind === 'vertical' ? 'category' : 'subcategory'} “{pending?.name}”?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This hides {pending ? pending.productCount.toLocaleString('en-IN') : ''} product
              {pending?.productCount === 1 ? '' : 's'} from customers across the app instantly (even on
              installed apps) and blocks merchants from listing new stock in it. Existing merchant stock is
              parked, not deleted — re-enabling restores everything.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-[#B52725] hover:bg-[#9e211f]" onClick={confirmPending}>
              Disable
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

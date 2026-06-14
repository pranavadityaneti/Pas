/**
 * Global Config — platform_settings switchboard.
 *
 * 2026-06-14: rebuilt from the 100%-mock form into a real load/save panel backed
 * by GET/PATCH /admin/config (platform_settings table). Scoped to the two
 * settings with a defined consumer: Service Radius + Minimum Order. The apps
 * read these via GET /config/public; they take effect once the consumer app
 * consumes them (store discovery radius + checkout minimum) — that wiring ships
 * in the next consumer build/OTA. Mock fees/referral/COD fields were removed
 * (no live consumer yet).
 */

import { useEffect, useState } from 'react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../ui/card';
import { toast } from 'sonner';
import { Save, Loader2, MapPin, ShoppingCart, AlertTriangle } from 'lucide-react';
import api from '../../../lib/api';

export function GlobalConfig() {
  const [radius, setRadius] = useState('');
  const [minOrder, setMinOrder] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/admin/config')
      .then(({ data }) => {
        const s = data?.settings || {};
        setRadius(String(s.service_radius_km ?? 10));
        setMinOrder(String(s.min_order_value ?? 0));
      })
      .catch(() => { setRadius('10'); setMinOrder('0'); })
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    const r = Number(radius), m = Number(minOrder);
    if (!isFinite(r) || r < 0 || !isFinite(m) || m < 0) {
      toast.error('Values must be non-negative numbers');
      return;
    }
    setSaving(true);
    try {
      await api.patch('/admin/config', { service_radius_km: r, min_order_value: m });
      toast.success('Global config saved');
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Global Platform Variables</h2>
          <p className="text-sm text-gray-500">Operational parameters the apps read at runtime.</p>
        </div>
        <Button onClick={save} disabled={saving} className="bg-[#B52725] hover:bg-[#9a1f1d] gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><MapPin className="w-4 h-4 text-[#B52725]" /> Service radius</CardTitle>
            <CardDescription>How far (km) customers see nearby stores.</CardDescription>
          </CardHeader>
          <CardContent>
            <Label>Service radius (km)</Label>
            <Input type="number" min="0" value={radius} onChange={(e) => setRadius(e.target.value)} className="mt-1" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><ShoppingCart className="w-4 h-4 text-[#B52725]" /> Minimum order</CardTitle>
            <CardDescription>Minimum cart value (₹) to checkout.</CardDescription>
          </CardHeader>
          <CardContent>
            <Label>Minimum order value (₹)</Label>
            <Input type="number" min="0" value={minOrder} onChange={(e) => setMinOrder(e.target.value)} className="mt-1" />
          </CardContent>
        </Card>
      </div>

      <div className="flex items-start gap-2 text-xs text-gray-500 bg-amber-50/50 border border-amber-100 rounded-lg p-3">
        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
        <span>Stored centrally and exposed to the apps via <code className="bg-white px-1 rounded">/config/public</code>. They take effect once the <strong>consumer app reads them</strong> (service radius in store discovery, minimum order at checkout) — that wiring ships in the next consumer build/OTA.</span>
      </div>
    </div>
  );
}

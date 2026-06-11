import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from './useStore';

// Phase 7F (2026-06-10) — merchant settlement history.
// Reads GET /merchant/settlements (Express API). Cycles are weekly (Mon-Sun
// IST), merchant-level (across ALL branches — settlements group by store_id),
// and only CLOSED/PAID cycles are visible; OPEN weeks are still accumulating.
// Money fields are Prisma Decimals → arrive as strings; Number() everything.

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export interface SettlementCycle {
    id: string;
    periodStart: string;
    periodEnd: string;
    status: 'CLOSED' | 'PAID';
    grossSales: number;
    commissionAmount: number;
    couponReimbursement: number;
    couponAbsorbed: number;
    clawbackAmount: number;
    netPayout: number;
    paidAt: string | null;
}

async function authHeaders(): Promise<Record<string, string>> {
    try {
        const { data } = await supabase.auth.getSession();
        const token = data?.session?.access_token;
        return token
            ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
            : { 'Content-Type': 'application/json' };
    } catch {
        return { 'Content-Type': 'application/json' };
    }
}

export function useSettlements() {
    const { merchantId } = useStore();
    const [cycles, setCycles] = useState<SettlementCycle[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        if (!merchantId || !API_URL) { setLoading(false); return; }
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`${API_URL}/merchant/settlements?merchantId=${encodeURIComponent(merchantId)}`, {
                headers: await authHeaders(),
            });
            if (!res.ok) {
                // 403 = staff account without store-manage rights; treat as empty
                // rather than an error banner — the section simply stays hidden.
                if (res.status === 403) { setCycles([]); return; }
                throw new Error(`HTTP ${res.status}`);
            }
            const body = await res.json();
            const rows: SettlementCycle[] = (body?.data || []).map((c: any) => ({
                id: String(c.id),
                periodStart: String(c.periodStart),
                periodEnd: String(c.periodEnd),
                status: c.status === 'PAID' ? 'PAID' : 'CLOSED',
                grossSales: Number(c.grossSales) || 0,
                commissionAmount: Number(c.commissionAmount) || 0,
                couponReimbursement: Number(c.couponReimbursement) || 0,
                couponAbsorbed: Number(c.couponAbsorbed) || 0,
                clawbackAmount: Number(c.clawbackAmount) || 0,
                netPayout: Number(c.netPayout) || 0,
                paidAt: c.paidAt ? String(c.paidAt) : null,
            }));
            setCycles(rows);
        } catch (e: any) {
            console.error('Error fetching settlements:', e);
            setError('Could not load settlements');
        } finally {
            setLoading(false);
        }
    }, [merchantId]);

    useEffect(() => { refresh(); }, [refresh]);

    return { cycles, loading, error, refresh };
}

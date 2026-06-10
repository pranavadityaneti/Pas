import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from './useStore';

export function useEarnings() {
    const { merchantId, activeStoreId } = useStore();
    const [stats, setStats] = useState({
        today: 0,
        todayOrders: 0,
        weekly: 0,
        total: 0,
        orderCount: 0,
        pendingCount: 0,
        estimatedPayout: 0,
        // Phase 6 (2026-06-10) — coupon money lines (COMPLETED orders, all time):
        // couponReimbursement = sum of PLATFORM-funded discounts (the platform
        // owes these back to the merchant); couponAbsorbed = sum of MERCHANT-
        // funded discounts (the merchant chose to absorb these).
        couponReimbursement: 0,
        couponAbsorbed: 0,
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!merchantId || !activeStoreId) return;

        async function fetchStats() {
            setLoading(true);
            try {
                // Base query scoped to the merchant
                let query = supabase
                    .from('orders')
                    // Phase 6 (2026-06-10): + coupon snapshot columns for the
                    // reimbursement/absorbed aggregates.
                    .select('total_amount, created_at, status, branch_id, order_coupon_discount, order_coupon_funding_source')
                    .eq('store_id', merchantId);

                // Branch routing: scope to the active branch
                if (activeStoreId === merchantId) {
                    // Main store — orders without a branch or where branch_id is the main store
                    query = query.or(`branch_id.is.null,branch_id.eq.${merchantId}`);
                } else {
                    // Specific branch selected
                    query = query.eq('branch_id', activeStoreId);
                }

                const { data, error } = await query;

                if (error) throw error;

                const now = new Date();
                const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
                const weekStart = todayStart - (7 * 24 * 60 * 60 * 1000);

                let todaySum = 0;
                let todayOrderCount = 0;
                let weeklySum = 0;
                let totalSum = 0;
                let completedCount = 0;
                let pendingCount = 0;
                // Phase 6 (2026-06-10) — coupon money aggregates over COMPLETED orders.
                let couponReimbursementSum = 0;
                let couponAbsorbedSum = 0;
                let todayCouponReimbursement = 0;

                (data || []).forEach(order => {
                    const orderTime = new Date(order.created_at).getTime();

                    // Today's Orders (all non-cancelled)
                    if (orderTime >= todayStart && order.status !== 'CANCELLED') {
                        todayOrderCount++;
                    }

                    if (order.status === 'COMPLETED') {
                        totalSum += order.total_amount;
                        completedCount++;
                        if (orderTime >= todayStart) todaySum += order.total_amount;
                        if (orderTime >= weekStart) weeklySum += order.total_amount;
                        // Phase 6 — coupon snapshot (NULL on non-coupon orders).
                        const couponSlice = order.order_coupon_discount != null ? Number(order.order_coupon_discount) : 0;
                        if (couponSlice > 0) {
                            if (order.order_coupon_funding_source === 'PLATFORM') {
                                couponReimbursementSum += couponSlice;
                                if (orderTime >= todayStart) todayCouponReimbursement += couponSlice;
                            } else if (order.order_coupon_funding_source === 'MERCHANT') {
                                couponAbsorbedSum += couponSlice;
                            }
                        }
                    } else if (
                        order.status === 'PENDING' ||
                        order.status === 'CONFIRMED' ||
                        order.status === 'PREPARING' ||
                        order.status === 'READY'
                    ) {
                        // Whitelist: only genuinely in-fulfillment statuses count as "Ongoing".
                        // Excludes REJECTED, EXPIRED, CANCELLED, REFUNDED, RETURN_*, etc.
                        pendingCount++;
                    }
                });

                setStats({
                    today: todaySum,
                    todayOrders: todayOrderCount,
                    weekly: weeklySum,
                    total: totalSum,
                    orderCount: completedCount,
                    pendingCount: pendingCount,
                    // Phase 6 (2026-06-10): a coupon order's total_amount is what
                    // the CUSTOMER paid (post-discount). PLATFORM-funded discounts
                    // are reimbursed to the merchant, so today's payout estimate
                    // adds them back before the fee simulation. Real payout math
                    // lands in Phase 7 — this remains an estimate.
                    estimatedPayout: (todaySum + todayCouponReimbursement) * 0.98, // 2% platform fee simulation
                    couponReimbursement: couponReimbursementSum,
                    couponAbsorbed: couponAbsorbedSum,
                });
            } catch (error) {
                console.error('Error fetching earnings:', error);
            } finally {
                setLoading(false);
            }
        }

        fetchStats();

        // Subscribe to real-time changes — listen at merchant level,
        // but gate refetch on branch match (client-side)
        const channel = supabase.channel(`earnings-${merchantId}-${activeStoreId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'orders',
                filter: `store_id=eq.${merchantId}`
            }, (payload: any) => {
                const incoming = payload.new || payload.old;
                if (!incoming) {
                    fetchStats();
                    return;
                }
                // Only refetch if the order belongs to the active branch
                const branchId = incoming.branch_id;
                if (activeStoreId === merchantId) {
                    // Main store — accept null branch or matching
                    if (!branchId || branchId === merchantId) fetchStats();
                } else {
                    if (branchId === activeStoreId) fetchStats();
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [merchantId, activeStoreId]);

    return { stats, loading };
}

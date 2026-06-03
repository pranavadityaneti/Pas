/**
 * Settlements Manager — placeholder until the payout vendor is integrated.
 *
 * 2026-06-02: hardcoded fake merchants (Ratnadeep / Vijetha / Organic World) removed
 * per founder request. Real wiring is gated on the payout-vendor selection
 * (Cashfree Payouts / Open Money / Decentro / Razorpay Route) — Razorpay X does
 * NOT support our business type, confirmed late May. See forlater.md HIGH PRIORITY
 * "Real merchant payout formula".
 *
 * Once a vendor is picked, the real implementation needs:
 *   - A new `payouts` Prisma table
 *   - Scheduled job that creates payouts on T+1 / T+2 cadence
 *   - Vendor webhook handlers (success / failure / reversal)
 *   - Real settlement breakdown: gross - Razorpay fee - GST - platform commission - TDS - refund offsets
 */

import { Wallet } from 'lucide-react';

export function SettlementsManager() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-6 py-12">
      <div className="w-20 h-20 rounded-2xl bg-gray-100 border border-gray-200 flex items-center justify-center mb-5">
        <Wallet className="w-10 h-10 text-gray-400" />
      </div>
      <h3 className="text-lg font-bold text-gray-900 mb-2">Settlements not yet active</h3>
      <p className="text-sm text-gray-600 max-w-md leading-relaxed">
        Merchant payouts will appear here once we integrate a payout vendor.
        Each settlement row will show cycle dates, GMV, platform commission,
        Razorpay fees, GST, TDS, and net amount transferred — with the bank UTR
        for reconciliation.
      </p>
      <p className="text-xs text-gray-500 mt-4 max-w-md">
        Blocked on payout-vendor selection. Razorpay X does not support our business
        type — evaluating Cashfree Payouts, Open Money, Decentro.
      </p>
    </div>
  );
}

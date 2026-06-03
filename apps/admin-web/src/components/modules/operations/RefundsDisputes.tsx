/**
 * Refunds & Disputes — Operations + Finance surface.
 *
 * Tonight's V1: placeholder shell. Real flow ships as part of WS2 + the dispute
 * resolution queue (forlater #Admin Dashboard changes).
 *
 * Expected V1.5 content:
 *  - Tab: "Refund requests" — pending small-amount approvals (Operations approves)
 *  - Tab: "Disputes" — order disputes between customer + merchant
 *  - Tab: "Escalated" — items kicked to Super Admin
 *  - Each refund row: customer, merchant, order#, amount, reason, [Approve] [Reject] [Escalate]
 */

import { RefreshCcw, Clock } from 'lucide-react';

export function RefundsDisputes() {
    return (
        <div className="h-full flex flex-col bg-gray-50 px-6 pt-10 pb-6 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-[#B52725] flex items-center justify-center shadow-lg">
                    <RefreshCcw className="w-7 h-7 text-white" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Refunds & Disputes</h1>
                    <p className="text-sm text-gray-500 mt-0.5">Approve refunds, resolve disputes, escalate when needed</p>
                </div>
            </div>

            {/* Coming soon */}
            <div className="flex-1 flex items-center justify-center">
                <div className="text-center max-w-md">
                    <div className="w-20 h-20 rounded-2xl bg-gray-100 border border-gray-200 flex items-center justify-center mx-auto mb-5">
                        <Clock className="w-10 h-10 text-gray-400" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Coming with WS2</h2>
                    <p className="text-sm text-gray-600 leading-relaxed">
                        Refund + dispute queue ships alongside the WS2 customer/merchant return + refund
                        flow. The backend data model is being built first; this queue surfaces it.
                    </p>

                    <div className="mt-6 grid grid-cols-3 gap-3 text-left">
                        <Cell label="Pending refunds" value="—" />
                        <Cell label="Open disputes"  value="—" />
                        <Cell label="Escalated"      value="—" />
                    </div>
                </div>
            </div>
        </div>
    );
}

function Cell({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-center">
            <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">{label}</div>
            <div className="text-xl font-bold text-gray-900 mt-1">{value}</div>
        </div>
    );
}

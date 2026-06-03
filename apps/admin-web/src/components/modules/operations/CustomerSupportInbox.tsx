/**
 * Customer Support Inbox — surfaces inbound Wati conversations.
 *
 * Tonight: hits GET /wati/inbox and lists recent inbound messages. Read-only;
 * "Reply" lives in the Wati dashboard for now (deep-link in the row).
 *
 * Roles: OPERATIONS / FINANCE / SUPPORT / SUPER_ADMIN — gated upstream by Sidebar.
 */

import { useEffect, useState } from 'react';
import api from '../../../lib/api';
import { Card, CardContent } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Inbox, ExternalLink, Loader2, MessageCircle } from 'lucide-react';

interface InboxRow {
    id: string;
    waMessageId?: string | null;
    waPhone: string;
    contactName?: string | null;
    direction: string;
    messageType: string;
    body?: string | null;
    tag?: string | null;
    status: string;
    isRead: boolean;
    receivedAt: string;
}

export function CustomerSupportInbox() {
    const [rows, setRows] = useState<InboxRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                const { data } = await api.get('/wati/inbox?limit=100');
                if (cancelled) return;
                setRows((data?.data as InboxRow[]) ?? []);
            } catch (e: any) {
                if (!cancelled) setError(e?.response?.data?.error ?? e?.message ?? 'Failed to load inbox');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    return (
        <div className="h-full flex flex-col bg-gray-50 px-6 pt-10 pb-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-[#B52725] flex items-center justify-center shadow-lg">
                        <Inbox className="w-7 h-7 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Customer Support</h1>
                        <p className="text-sm text-gray-500 mt-0.5">Inbound WhatsApp conversations via Wati</p>
                    </div>
                </div>
                <a
                    href="https://app.wati.io"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm font-bold text-[#B52725] hover:text-[#9a1f1d]"
                >
                    Open Wati to reply <ExternalLink className="w-4 h-4" />
                </a>
            </div>

            {error && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    {error}
                    <div className="mt-1 text-xs">
                        Tip: the Wati webhook needs to point to <code className="bg-white px-1 rounded">https://api.pickatstore.io/webhooks/wati</code> for messages to start landing here.
                    </div>
                </div>
            )}

            <Card className="border-gray-200 flex-1 overflow-hidden flex flex-col">
                <CardContent className="p-0 flex-1 overflow-auto">
                    {loading ? (
                        <div className="h-full flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
                    ) : rows.length === 0 ? (
                        <EmptyState />
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {rows.map(r => (
                                <div key={r.id} className="px-5 py-4 flex items-start gap-4 hover:bg-gray-50/50">
                                    <div className="size-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                                        <MessageCircle className="w-5 h-5 text-emerald-700" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <div className="text-sm font-bold text-gray-900 truncate">
                                                {r.contactName ?? `+${r.waPhone}`}
                                            </div>
                                            <span className="text-xs text-gray-400">+{r.waPhone}</span>
                                            {r.tag && <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">{r.tag}</Badge>}
                                            <StatusBadge status={r.status} />
                                        </div>
                                        <p className="text-sm text-gray-700 line-clamp-2">{r.body ?? <em className="text-gray-400">(no text body — message type: {r.messageType})</em>}</p>
                                        <div className="text-[11px] text-gray-400 mt-1">{new Date(r.receivedAt).toLocaleString()}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

function EmptyState() {
    return (
        <div className="h-full flex items-center justify-center p-10">
            <div className="text-center max-w-md">
                <div className="w-20 h-20 rounded-2xl bg-gray-100 border border-gray-200 flex items-center justify-center mx-auto mb-5">
                    <Inbox className="w-10 h-10 text-gray-400" />
                </div>
                <h2 className="text-lg font-bold text-gray-900 mb-2">No messages yet</h2>
                <p className="text-sm text-gray-600 leading-relaxed">
                    Inbound WhatsApp messages will appear here once the Wati webhook is
                    configured.
                </p>
                <p className="text-xs text-gray-500 mt-3">
                    Wati dashboard → Settings → Webhooks →{' '}
                    <code className="bg-gray-100 px-1 py-0.5 rounded">https://api.pickatstore.io/webhooks/wati</code>
                </p>
            </div>
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    if (status === 'resolved') return <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">Resolved</Badge>;
    if (status === 'in_progress') return <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">In progress</Badge>;
    if (status === 'spam') return <Badge variant="outline" className="text-[10px] bg-gray-100 text-gray-600 border-gray-200">Spam</Badge>;
    return <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">Open</Badge>;
}

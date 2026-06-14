/**
 * Customer Support Inbox — two-way Wati conversations.
 *
 * 2026-06-14: upgraded from a read-only list to a threaded inbox with replies.
 *   - Left:  conversations grouped by number (GET /admin/wati/threads), unread badges.
 *   - Right: the selected thread (GET /admin/wati/thread?phone=) + a reply box that
 *            sends a free-text WhatsApp message (POST /admin/wati/reply → Wati session
 *            message). Replies only work inside WhatsApp's 24-hour window; outside it
 *            Wati rejects and we surface the reason.
 *
 * Roles: OPERATIONS / FINANCE / SUPPORT / SUPER_ADMIN — gated upstream by Sidebar.
 */

import { useEffect, useState } from 'react';
import api from '../../../lib/api';
import { toast } from 'sonner';
import { Inbox, Loader2, Send, ExternalLink, MessageCircle } from 'lucide-react';
import { Button } from '../../ui/button';

interface Thread {
  waPhone: string;
  contactName?: string | null;
  lastBody?: string | null;
  lastAt: string;
  lastDirection: string;
  status: string;
  unread: number;
  count: number;
}
interface Msg {
  id: string;
  waPhone: string;
  direction: string;
  messageType: string;
  body?: string | null;
  receivedAt: string;
}

export function CustomerSupportInbox() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [active, setActive] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);

  const loadThreads = () => {
    setLoadingThreads(true);
    api.get('/admin/wati/threads')
      .then(({ data }) => setThreads(data?.threads ?? []))
      .catch(() => setThreads([]))
      .finally(() => setLoadingThreads(false));
  };
  useEffect(() => { loadThreads(); }, []);

  const openThread = (phone: string) => {
    setActive(phone);
    setLoadingMsgs(true);
    api.get('/admin/wati/thread', { params: { phone } })
      .then(({ data }) => setMessages(data?.messages ?? []))
      .catch(() => setMessages([]))
      .finally(() => setLoadingMsgs(false));
  };

  const send = async () => {
    const body = reply.trim();
    if (!body || !active || sending) return;
    setSending(true);
    try {
      await api.post('/admin/wati/reply', { phone: active, body });
      setReply('');
      openThread(active);
      loadThreads();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Could not send — the customer may need to message first (WhatsApp 24h window).');
    } finally {
      setSending(false);
    }
  };

  const activeThread = threads.find((t) => t.waPhone === active);

  return (
    <div className="h-full flex flex-col bg-gray-50 px-6 pt-10 pb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-[#B52725] flex items-center justify-center shadow-lg">
            <Inbox className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Customer Support</h1>
            <p className="text-sm text-gray-500 mt-0.5">Two-way WhatsApp conversations via Wati</p>
          </div>
        </div>
        <a href="https://app.wati.io" target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm font-bold text-[#B52725] hover:text-[#9a1f1d]">
          Open Wati <ExternalLink className="w-4 h-4" />
        </a>
      </div>

      <div className="flex-1 min-h-0 flex gap-4">
        {/* Left — conversations */}
        <div className="w-80 shrink-0 bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <span className="font-semibold text-gray-900 text-sm">Conversations</span>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={loadThreads} disabled={loadingThreads}>
              {loadingThreads ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Refresh'}
            </Button>
          </div>
          <div className="flex-1 overflow-auto divide-y divide-gray-50">
            {loadingThreads ? (
              <div className="h-full flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
            ) : threads.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-gray-400">No conversations yet.</div>
            ) : threads.map((t) => (
              <button key={t.waPhone} onClick={() => openThread(t.waPhone)}
                className={`w-full text-left px-4 py-3 hover:bg-gray-50 ${active === t.waPhone ? 'bg-[#B52725]/5 border-l-2 border-l-[#B52725]' : 'border-l-2 border-l-transparent'}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-gray-900 truncate">{t.contactName || `+${t.waPhone}`}</span>
                  {t.unread > 0 && <span className="text-[10px] font-bold bg-[#B52725] text-white rounded-full px-1.5 py-0.5">{t.unread}</span>}
                </div>
                <div className="text-xs text-gray-500 truncate mt-0.5">
                  {t.lastDirection === 'outbound' ? 'You: ' : ''}{t.lastBody || '(no text)'}
                </div>
                <div className="text-[10px] text-gray-400 mt-0.5">{t.lastAt ? new Date(t.lastAt).toLocaleString() : ''}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Right — thread + reply */}
        <div className="flex-1 min-w-0 bg-white border border-gray-200 rounded-xl flex flex-col overflow-hidden">
          {!active ? (
            <div className="flex-1 flex items-center justify-center text-center p-10">
              <div>
                <MessageCircle className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500">Select a conversation to view + reply.</p>
                <p className="text-[11px] text-gray-400 mt-2">Inbound messages arrive via the Wati webhook → <code className="bg-gray-100 px-1 rounded">/webhooks/wati</code></p>
              </div>
            </div>
          ) : (
            <>
              <div className="px-4 py-3 border-b border-gray-100">
                <div className="text-sm font-semibold text-gray-900">{activeThread?.contactName || `+${active}`}</div>
                <div className="text-xs text-gray-400">+{active}</div>
              </div>
              <div className="flex-1 overflow-auto p-4 space-y-2 bg-gray-50/50">
                {loadingMsgs ? (
                  <div className="h-full flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
                ) : messages.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-sm text-gray-400">No messages.</div>
                ) : messages.map((m) => {
                  const out = m.direction === 'outbound';
                  return (
                    <div key={m.id} className={`flex ${out ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${out ? 'bg-[#B52725] text-white rounded-br-sm' : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm'}`}>
                        {m.body || <em className="opacity-70">({m.messageType})</em>}
                        <div className={`text-[10px] mt-1 ${out ? 'text-white/70' : 'text-gray-400'}`}>{m.receivedAt ? new Date(m.receivedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="border-t border-gray-100 p-3 flex items-end gap-2">
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder="Type a reply… (Enter to send, Shift+Enter for newline)"
                  rows={2}
                  className="flex-1 resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B52725]/20 focus:border-[#B52725]"
                />
                <Button onClick={send} disabled={sending || !reply.trim()} className="h-10 bg-[#B52725] hover:bg-[#9a1f1d] text-white shrink-0">
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

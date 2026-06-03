/**
 * Roles & Permissions — Super Admin surface to view + manage admin users.
 *
 * Tonight's scope (V1): READ-ONLY list view of every admin-tier user with
 * their current role, status, and a quick reference of capabilities per role.
 * Role-change + suspend actions are scaffolded as TODOs — wire up next session.
 *
 * Access is gated upstream by Sidebar (only shown if roleCan(role, 'roles.manage'))
 * and at the route level (Super Admin only).
 */

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import api from '../../../lib/api';
import { useAuth } from '../../../context/AuthContext';
import { Card, CardContent } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '../../ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../ui/select';
import { ShieldCheck, UserCog, Loader2, Pause, Play } from 'lucide-react';
import { toast } from 'sonner';
import { ADMIN_ROLES, ROLE_LABEL, capabilitiesFor, type AdminRole } from '../../../lib/rbac';

interface AdminUserRow {
    id: string;
    email: string;
    name: string | null;
    role: string;
    isAdmin?: boolean;
    status?: string | null;
    suspended_at?: string | null;
    suspended_reason?: string | null;
}

export function RolesPermissions() {
    const [users, setUsers] = useState<AdminUserRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [inviteOpen, setInviteOpen] = useState(false);
    const [refreshTick, setRefreshTick] = useState(0);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                // @ts-ignore
                const { data, error: e } = await supabase
                    .from('User')
                    .select('id, email, name, role, isAdmin, status, suspended_at, suspended_reason')
                    .in('role', ['SUPER_ADMIN', 'OPERATIONS', 'FINANCE', 'SUPPORT'])
                    .order('role', { ascending: true });
                if (cancelled) return;
                if (e) { setError(e.message); return; }
                setUsers((data as AdminUserRow[]) ?? []);
            } catch (e: any) {
                if (!cancelled) setError(e?.message ?? 'Failed to load users');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [refreshTick]);

    const handleInviteSuccess = () => {
        setInviteOpen(false);
        setRefreshTick(t => t + 1);
    };

    const { user: currentUser } = useAuth();

    // Last-Super-Admin safeguard at the UI level — backend enforces too, but disabling
    // the controls makes the constraint visible instead of erroring on click.
    const superAdminCount = useMemo(
        () => users.filter(u => u.role === 'SUPER_ADMIN' || u.isAdmin === true).filter(u => (u.status ?? 'active') !== 'suspended').length,
        [users],
    );

    const [busyId, setBusyId] = useState<string | null>(null);

    const patchUser = async (id: string, body: { role?: string; status?: 'active' | 'suspended'; suspendedReason?: string }, optimistic?: Partial<AdminUserRow>) => {
        setBusyId(id);
        // Optimistic UI: apply the change locally; rollback on failure.
        const prev = users;
        if (optimistic) {
            setUsers(prev.map(u => u.id === id ? { ...u, ...optimistic } : u));
        }
        try {
            await api.patch(`/admin/users/${id}`, body);
            toast.success('Updated');
            setRefreshTick(t => t + 1);
        } catch (err: any) {
            setUsers(prev);
            const msg = err?.response?.data?.error ?? err?.message ?? 'Update failed';
            toast.error('Update failed', { description: msg });
        } finally {
            setBusyId(null);
        }
    };

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-gray-50 px-6 pt-10 pb-6 space-y-6 overflow-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-[#B52725] flex items-center justify-center shadow-lg">
                        <ShieldCheck className="w-7 h-7 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Roles & Permissions</h1>
                        <p className="text-sm text-gray-500 mt-0.5">Manage admin-tier users and their access levels</p>
                    </div>
                </div>
                <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
                    <DialogTrigger asChild>
                        <Button className="gap-2 bg-[#B52725] hover:bg-[#9a1f1d] text-white">
                            <UserCog className="w-4 h-4" /> Invite Admin
                        </Button>
                    </DialogTrigger>
                    <InviteAdminDialog onSuccess={handleInviteSuccess} />
                </Dialog>
            </div>

            {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
            )}

            {/* Capability reference card (collapsible feel) */}
            <Card className="border-gray-200">
                <CardContent className="p-5">
                    <h2 className="text-sm font-bold text-gray-900 mb-3 uppercase tracking-wider">Role capabilities reference</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {ADMIN_ROLES.map((r) => {
                            const caps = capabilitiesFor(r);
                            const isWildcard = caps.includes('*' as any);
                            return (
                                <div key={r} className="rounded-lg border border-gray-200 bg-white p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <RoleBadge role={r} />
                                        <span className="text-xs text-gray-500">
                                            {isWildcard ? 'All capabilities' : `${caps.length} capabilities`}
                                        </span>
                                    </div>
                                    {!isWildcard && (
                                        <div className="text-[11px] text-gray-600 leading-relaxed">
                                            {(caps as string[]).slice(0, 8).join(' · ')}
                                            {caps.length > 8 && ` … +${caps.length - 8} more`}
                                        </div>
                                    )}
                                    {isWildcard && (
                                        <div className="text-[11px] text-gray-600 leading-relaxed">
                                            Wildcard access — no restrictions.
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>

            {/* Admin users list */}
            <Card className="border-gray-200">
                <CardContent className="p-0">
                    <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                        <h2 className="text-base font-bold text-gray-900">Admin users ({users.length})</h2>
                        <span className="text-[11px] text-gray-500 uppercase tracking-wider">
                            Change role inline · suspend with the pause button
                        </span>
                    </div>

                    {users.length === 0 ? (
                        <div className="p-10 text-center text-sm text-gray-500">
                            No admin-tier users found. Use Invite Admin above to add one.
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {users.map((u) => {
                                const status = (u.status ?? 'active') as 'active' | 'suspended';
                                const isSelf = currentUser?.id === u.id;
                                const isCurrentSuperAdmin = u.role === 'SUPER_ADMIN' || u.isAdmin === true;
                                // Block demotion/suspension of the only remaining Super Admin.
                                const isLastSuperAdmin = isCurrentSuperAdmin && superAdminCount <= 1;
                                const roleDropdownDisabled = busyId === u.id || isLastSuperAdmin;
                                const suspendDisabled = busyId === u.id || isSelf || (isCurrentSuperAdmin && isLastSuperAdmin);

                                return (
                                    <div key={u.id} className="px-5 py-4 flex items-center gap-4 hover:bg-gray-50/50 transition-colors">
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-bold text-gray-900 truncate">
                                                {u.name ?? u.email.split('@')[0]}
                                                {isSelf && <span className="text-[10px] font-normal text-gray-500 ml-2 uppercase tracking-wider">(you)</span>}
                                            </div>
                                            <div className="text-xs text-gray-500 truncate">{u.email}</div>
                                        </div>

                                        {/* Role dropdown — auto-save on change */}
                                        <div className="w-[160px]">
                                            <Select
                                                value={u.role}
                                                disabled={roleDropdownDisabled}
                                                onValueChange={(newRole) => {
                                                    if (newRole === u.role) return;
                                                    patchUser(u.id, { role: newRole }, { role: newRole });
                                                }}
                                            >
                                                <SelectTrigger className="h-8 text-xs" title={isLastSuperAdmin ? 'Cannot demote the only remaining Super Admin' : undefined}>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                                                    <SelectItem value="OPERATIONS">Operations</SelectItem>
                                                    <SelectItem value="FINANCE">Finance</SelectItem>
                                                    <SelectItem value="SUPPORT">Customer Support</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <StatusBadge status={status} />

                                        {/* Suspend / Reactivate */}
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            disabled={suspendDisabled}
                                            title={
                                                isSelf ? "You can't suspend your own account"
                                                : isLastSuperAdmin ? 'Cannot suspend the only remaining Super Admin'
                                                : status === 'suspended' ? 'Reactivate this user'
                                                : 'Suspend this user (blocks new logins, keeps data)'
                                            }
                                            onClick={() => {
                                                if (status === 'suspended') {
                                                    patchUser(u.id, { status: 'active' }, { status: 'active' });
                                                } else {
                                                    const reason = window.prompt(`Suspend ${u.email}? Optional reason for audit:`, '');
                                                    if (reason === null) return; // cancelled
                                                    patchUser(u.id, { status: 'suspended', suspendedReason: reason }, { status: 'suspended', suspended_reason: reason });
                                                }
                                            }}
                                            className={status === 'suspended' ? 'text-emerald-700 hover:text-emerald-800' : 'text-gray-500 hover:text-red-700'}
                                        >
                                            {busyId === u.id ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : status === 'suspended' ? (
                                                <Play className="w-4 h-4" />
                                            ) : (
                                                <Pause className="w-4 h-4" />
                                            )}
                                        </Button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

// Per brand-palette rule: role badges use neutral gray (informational only).
// Status badges are semantic — green (active/granted), red (blocked/suspended).
function RoleBadge({ role }: { role: string }) {
    const label = role in ROLE_LABEL ? ROLE_LABEL[role as AdminRole] : role;
    // Super Admin gets brand-red text to signal the governance tier; others neutral.
    const cls = role === 'SUPER_ADMIN'
        ? 'bg-[#B52725]/10 text-[#B52725] border-[#B52725]/30'
        : 'bg-gray-100 text-gray-700 border-gray-200';
    return <Badge variant="outline" className={cls}>{label}</Badge>;
}

function StatusBadge({ status }: { status: string }) {
    if (status === 'suspended') {
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Suspended</Badge>;
    }
    return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Active</Badge>;
}

/**
 * Invite-Admin dialog. POSTs to /admin/users/invite which creates the Supabase
 * auth user + User row with the chosen role + emails a temp password via Resend.
 * The invitee logs in with email/password, gets prompted to change password on
 * first login (existing ForcePasswordChange flow).
 */
function InviteAdminDialog({ onSuccess }: { onSuccess: () => void }) {
    const [method, setMethod] = useState<'phone' | 'email'>('phone');  // Phone = primary per Wati OTP flow
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');  // 10 digits, no country code
    const [email, setEmail] = useState('');
    const [role, setRole] = useState<string>('OPERATIONS');
    const [submitting, setSubmitting] = useState(false);

    const phoneDigits = phone.replace(/\D/g, '');
    const phoneValid = phoneDigits.length === 10;
    const emailValid = email.includes('@');
    const nameValid = name.trim().length > 0;
    const canSubmit = nameValid && (method === 'phone' ? phoneValid : emailValid) && !submitting;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canSubmit) return;
        setSubmitting(true);
        try {
            const body: any = { method, name: name.trim(), role };
            if (method === 'phone') body.phone = phoneDigits;
            else                    body.email = email.trim();
            const { data } = await api.post('/admin/users/invite', body);
            if (method === 'phone') {
                toast.success('Phone allowlisted', {
                    description: data?.hint || `Tell ${name} to log in via WhatsApp OTP at admin.pickatstore.io.`,
                });
            } else {
                toast.success('Invite sent', { description: `${email} will receive their login email shortly.` });
            }
            setName(''); setPhone(''); setEmail(''); setRole('OPERATIONS');
            onSuccess();
        } catch (err: any) {
            const msg = err?.response?.data?.error ?? err?.message ?? 'Failed to send invite';
            toast.error('Invite failed', { description: msg });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
                <DialogTitle>Invite an admin</DialogTitle>
                <DialogDescription>
                    Invitees can log in via WhatsApp OTP (phone) or temporary password (email).
                </DialogDescription>
            </DialogHeader>

            {/* Method toggle */}
            <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
                <button
                    type="button"
                    onClick={() => setMethod('phone')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${method === 'phone' ? 'bg-white text-[#B52725] shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                >
                    📱 Phone (WhatsApp OTP)
                </button>
                <button
                    type="button"
                    onClick={() => setMethod('email')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${method === 'email' ? 'bg-white text-[#B52725] shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                >
                    ✉️ Email (temp password)
                </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 py-2">
                <div className="space-y-1.5">
                    <Label htmlFor="invite-name">Name</Label>
                    <Input id="invite-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" autoFocus />
                </div>

                {method === 'phone' ? (
                    <div className="space-y-1.5">
                        <Label htmlFor="invite-phone">Phone (India)</Label>
                        <div className="flex items-stretch gap-2">
                            <div className="px-3 flex items-center bg-gray-100 border border-gray-200 rounded-md text-sm text-gray-600 font-mono">+91</div>
                            <Input
                                id="invite-phone"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                                placeholder="98765 43210"
                                inputMode="numeric"
                            />
                        </div>
                        <p className="text-[11px] text-gray-500">
                            They open admin.pickatstore.io → enter this number → receive a WhatsApp OTP → log in.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-1.5">
                        <Label htmlFor="invite-email">Email</Label>
                        <Input id="invite-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="someone@pickatstore.io" />
                        <p className="text-[11px] text-gray-500">
                            They'll receive a Resend email with a temp password and be prompted to change it on first login.
                        </p>
                    </div>
                )}

                <div className="space-y-1.5">
                    <Label htmlFor="invite-role">Role</Label>
                    <Select value={role} onValueChange={setRole}>
                        <SelectTrigger id="invite-role"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="OPERATIONS">Operations</SelectItem>
                            <SelectItem value="FINANCE">Finance</SelectItem>
                            <SelectItem value="SUPPORT">Customer Support</SelectItem>
                            <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                        </SelectContent>
                    </Select>
                    <p className="text-[11px] text-gray-500">{capabilitiesFor(role).includes('*' as any) ? 'Wildcard access — no restrictions.' : `${capabilitiesFor(role).length} capabilities`}</p>
                </div>

                <DialogFooter>
                    <Button type="submit" disabled={!canSubmit} className="bg-[#B52725] hover:bg-[#9a1f1d] text-white gap-2">
                        {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> {method === 'phone' ? 'Allowlisting…' : 'Sending…'}</> : (method === 'phone' ? 'Allowlist phone' : 'Send invite')}
                    </Button>
                </DialogFooter>
            </form>
        </DialogContent>
    );
}

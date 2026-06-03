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

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { Card, CardContent } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { ShieldCheck, UserCog, Loader2 } from 'lucide-react';
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
    }, []);

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
                <Button disabled className="gap-2 bg-[#B52725] hover:bg-[#9a1f1d] text-white" title="Invite-admin UI ships next session">
                    <UserCog className="w-4 h-4" /> Invite Admin
                </Button>
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
                            Read-only · edit in next session
                        </span>
                    </div>

                    {users.length === 0 ? (
                        <div className="p-10 text-center text-sm text-gray-500">
                            No admin-tier users found. Assign a role to a user via SQL to get started:
                            <pre className="mt-3 text-xs bg-gray-50 border border-gray-200 rounded p-2 text-left font-mono inline-block">
{`UPDATE "User" SET role = 'OPERATIONS' WHERE email = 'someone@pickatstore.io';`}
                            </pre>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {users.map((u) => (
                                <div key={u.id} className="px-5 py-4 flex items-center gap-4 hover:bg-gray-50/50 transition-colors">
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-bold text-gray-900 truncate">{u.name ?? u.email.split('@')[0]}</div>
                                        <div className="text-xs text-gray-500 truncate">{u.email}</div>
                                    </div>
                                    <RoleBadge role={u.role} />
                                    <StatusBadge status={u.status ?? 'active'} />
                                </div>
                            ))}
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

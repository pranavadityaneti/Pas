/**
 * Role-Based Access Control — admin-web mirror.
 *
 * Mirrors `apps/api/src/lib/rbac.ts`. **Keep both files in sync** — capability
 * names, role list, and labels must match. Source of truth: the platform's
 * RBAC doc (2026-06-02).
 */

export type AdminRole =
    | 'SUPER_ADMIN'
    | 'OPERATIONS'
    | 'FINANCE'
    | 'SUPPORT';

export type Capability =
    | 'platform.settings.edit'
    | 'platform.feature_flags.edit'
    | 'admins.crud'
    | 'roles.manage'
    | 'coupons.create_edit_delete'
    | 'commission.configure'
    | 'taxes.configure'
    | 'fees.configure'
    | 'settlement.rules.configure'
    | 'analytics.all'
    | 'refunds.exceptional.approve'
    | 'disputes.escalation.approve'
    | 'merchants.onboarding.review'
    | 'merchants.kyc.review'
    | 'merchants.activate_suspend'
    | 'catalog.issues.manage'
    | 'listings.requests.approve'
    | 'tickets.respond'
    | 'refunds.in_policy.approve'
    | 'disputes.standard.resolve'
    | 'orders.failed.investigate'
    | 'payments.failed.investigate'
    | 'merchants.policies.enforce'
    | 'merchants.contact'
    | 'settlements.verify'
    | 'payouts.verify'
    | 'razorpay.reconcile'
    | 'payouts.disputes.handle'
    | 'refunds.high_value.approve'
    | 'reports.financial.generate'
    | 'reports.gst.generate'
    | 'analytics.financial'
    | 'orders.view'
    | 'order_history.view'
    | 'tickets.create'
    | 'tickets.escalate'
    | 'refunds.status.track'
    | 'disputes.status.track'
    | 'platform.assist';

const SUPER_ADMIN_CAPS: ReadonlyArray<Capability | '*'> = ['*'];

const OPERATIONS_CAPS: ReadonlyArray<Capability> = [
    'merchants.onboarding.review',
    'merchants.kyc.review',
    'merchants.activate_suspend',
    'catalog.issues.manage',
    'listings.requests.approve',
    'tickets.respond',
    'refunds.in_policy.approve',
    'disputes.standard.resolve',
    'orders.failed.investigate',
    'payments.failed.investigate',
    'merchants.policies.enforce',
    'merchants.contact',
    'orders.view',
    'order_history.view',
];

const FINANCE_CAPS: ReadonlyArray<Capability> = [
    'settlements.verify',
    'payouts.verify',
    'razorpay.reconcile',
    'payouts.disputes.handle',
    'refunds.high_value.approve',
    'reports.financial.generate',
    'reports.gst.generate',
    'analytics.financial',
    'orders.view',
    'refunds.status.track',
];

const SUPPORT_CAPS: ReadonlyArray<Capability> = [
    'orders.view',
    'order_history.view',
    'tickets.respond',
    'tickets.create',
    'tickets.escalate',
    'refunds.status.track',
    'disputes.status.track',
    'platform.assist',
];

const ROLE_CAPABILITIES: Record<AdminRole, ReadonlyArray<Capability | '*'>> = {
    SUPER_ADMIN: SUPER_ADMIN_CAPS,
    OPERATIONS:  OPERATIONS_CAPS,
    FINANCE:     FINANCE_CAPS,
    SUPPORT:     SUPPORT_CAPS,
};

/**
 * True if the role (or legacy isAdmin flag) grants the capability.
 *
 * `isAdmin === true` is treated as SUPER_ADMIN equivalent — this matches the
 * backend's requireAdmin + requireRole behaviour and keeps users created
 * pre-Role-enum (where only the boolean isAdmin existed) functional.
 */
export function roleCan(
    role: string | null | undefined,
    capability: Capability,
    isAdmin?: boolean | null,
): boolean {
    if (isAdmin === true) return true;
    if (!role) return false;
    const caps = ROLE_CAPABILITIES[role as AdminRole];
    if (!caps) return false;
    return caps.includes('*') || (caps as ReadonlyArray<string>).includes(capability);
}

export function capabilitiesFor(role: string | null | undefined): ReadonlyArray<Capability | '*'> {
    if (!role) return [];
    return ROLE_CAPABILITIES[role as AdminRole] ?? [];
}

export const ADMIN_ROLES: ReadonlyArray<AdminRole> = ['SUPER_ADMIN', 'OPERATIONS', 'FINANCE', 'SUPPORT'];

export const ROLE_LABEL: Record<AdminRole, string> = {
    SUPER_ADMIN: 'Super Admin',
    OPERATIONS:  'Operations',
    FINANCE:     'Finance',
    SUPPORT:     'Customer Support',
};

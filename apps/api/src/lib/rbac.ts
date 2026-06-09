/**
 * Role-Based Access Control — capability matrix.
 *
 * Source of truth: `docs/wati-automation-spec.md` is for Wati;
 * this is encoded directly from the platform's RBAC doc (2026-06-02).
 *
 * Pattern: each role has a list of capability strings. SUPER_ADMIN holds the
 * wildcard '*' so any new capability is implicitly allowed.
 *
 * Capability strings use dot-notation: `<resource>.<action>` (or
 * `<resource>.<scope>.<action>` for finer slices like refunds.in_policy.approve).
 *
 * Naming kept stable across server (this file) and admin-web (mirror in
 * apps/admin-web/src/lib/rbac.ts). If you change one, change the other.
 */

export type AdminRole =
    | 'SUPER_ADMIN'
    | 'OPERATIONS'
    | 'FINANCE'
    | 'SUPPORT';

export type Capability =
    // ─── Governance (Super Admin only) ────────────────────────────────────
    | 'platform.settings.edit'
    | 'platform.feature_flags.edit'
    | 'admins.crud'                         // create/edit/suspend/delete admin users
    | 'roles.manage'                        // assign/revoke roles
    | 'coupons.create_edit_delete'
    | 'coupons.view_analytics'
    | 'commission.configure'
    | 'taxes.configure'
    | 'fees.configure'
    | 'settlement.rules.configure'
    | 'analytics.all'                       // full access to every analytic
    | 'refunds.exceptional.approve'         // outside-policy refunds
    | 'disputes.escalation.approve'

    // ─── Operations (daily marketplace running) ───────────────────────────
    | 'merchants.onboarding.review'         // approve / reject / needs_info
    | 'merchants.kyc.review'
    | 'merchants.activate_suspend'          // soft-disable + reactivate
    | 'catalog.issues.manage'
    | 'listings.requests.approve'
    | 'tickets.respond'                     // shared with support
    | 'refunds.in_policy.approve'           // small refunds within threshold
    | 'disputes.standard.resolve'
    | 'orders.failed.investigate'
    | 'payments.failed.investigate'
    | 'merchants.policies.enforce'
    | 'merchants.contact'                   // request missing info

    // ─── Finance (money flow) ─────────────────────────────────────────────
    | 'settlements.verify'
    | 'payouts.verify'
    | 'razorpay.reconcile'
    | 'payouts.disputes.handle'
    | 'refunds.high_value.approve'          // above the small-refund threshold
    | 'reports.financial.generate'
    | 'reports.gst.generate'
    | 'analytics.financial'                 // financial-only analytics slice

    // ─── Support (customer-facing) ────────────────────────────────────────
    | 'orders.view'                         // read-only access to customer orders
    | 'order_history.view'
    | 'tickets.create'
    | 'tickets.escalate'
    | 'refunds.status.track'                // read-only on refund states
    | 'disputes.status.track'
    | 'platform.assist'                     // help merchants + customers use the platform
    ;

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
    'coupons.view_analytics',               // read-only coupon performance metrics
    'orders.view',                          // read-only for context
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
 * `isAdmin === true` is treated as SUPER_ADMIN equivalent — matches the existing
 * requireAdmin + requireRole behaviour and keeps users created pre-Role-enum
 * (where only the boolean isAdmin existed) functional.
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

/** Convenience — returns the role's full capability list (used in introspection / UI). */
export function capabilitiesFor(role: string | null | undefined): ReadonlyArray<Capability | '*'> {
    if (!role) return [];
    return ROLE_CAPABILITIES[role as AdminRole] ?? [];
}

/** All admin-tier roles (excludes MERCHANT and CONSUMER). Useful for UI lists. */
export const ADMIN_ROLES: ReadonlyArray<AdminRole> = ['SUPER_ADMIN', 'OPERATIONS', 'FINANCE', 'SUPPORT'];

/** Human-readable label for a role — used in the admin UI. */
export const ROLE_LABEL: Record<AdminRole, string> = {
    SUPER_ADMIN: 'Super Admin',
    OPERATIONS:  'Operations',
    FINANCE:     'Finance',
    SUPPORT:     'Customer Support',
};

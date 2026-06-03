/**
 * Shared building blocks for role-aware home pages.
 * Kept tiny and presentational — each home composes them however it wants.
 *
 * - HomeHeader   — greeting, optional role badge, optional right-side slot
 * - KpiTile      — compact metric card (no fake sparkline, no fake trend)
 * - QuickActions — horizontal pill row of navigate-here shortcuts
 * - SectionCard  — labelled white card wrapping a widget
 * - ChartEmpty   — honest "no data" state for charts
 */

import { Link } from 'react-router-dom';
import { ROLE_LABEL } from '../../lib/rbac';
import type { LucideIcon } from 'lucide-react';

// ───────────────────────────────────────────────────────────── Greeting header

export function HomeHeader({
  name,
  role,
  subtitle,
  right,
}: {
  name: string | null | undefined;
  role: string | null | undefined;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  const friendlyName = (name && name.trim().length > 0)
    ? name.trim().split(/\s+/)[0]
    : 'there';
  const roleLabel = role && (ROLE_LABEL as any)[role];

  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Hi, {friendlyName}
          </h1>
          {roleLabel && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#B52725]/10 text-[#B52725]">
              {roleLabel}
            </span>
          )}
        </div>
        {subtitle && (
          <p className="text-sm text-gray-500">{subtitle}</p>
        )}
      </div>
      {right && <div>{right}</div>}
    </div>
  );
}

// ───────────────────────────────────────────────────────────── Compact KPI tile

export function KpiTile({
  label,
  value,
  icon: Icon,
  accent,
  tone,
  subtext,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  accent?: boolean;
  tone?: 'warn' | 'good';
  subtext?: string;
}) {
  const valueClass =
    accent           ? 'text-[#B52725]' :
    tone === 'warn'  ? 'text-amber-600' :
    tone === 'good'  ? 'text-emerald-600' :
                       'text-gray-900';
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
        <Icon className="w-4 h-4 text-gray-400" />
      </div>
      <div className={`text-2xl font-bold ${valueClass}`}>{value}</div>
      {subtext && <div className="text-[11px] text-gray-500 mt-0.5">{subtext}</div>}
    </div>
  );
}

// ───────────────────────────────────────────────────────────── Quick actions row

export interface QuickAction {
  to:    string;
  label: string;
  icon:  LucideIcon;
}

export function QuickActions({ actions }: { actions: QuickAction[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((a) => (
        <Link
          key={a.to}
          to={a.to}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-gray-200 bg-white hover:bg-gray-50 hover:border-[#B52725] hover:text-[#B52725] transition-colors text-sm font-medium text-gray-700"
        >
          <a.icon className="w-4 h-4" />
          {a.label}
        </Link>
      ))}
    </div>
  );
}

// ───────────────────────────────────────────────────────────── Section card

export function SectionCard({
  title,
  icon: Icon,
  right,
  children,
  className,
}: {
  title: string;
  icon?: LucideIcon;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className ?? ''}`}>
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4 text-[#B52725]" />}
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        </div>
        {right}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────── Honest empty state

export function EmptyState({
  title,
  hint,
  height = 180,
}: {
  title: string;
  hint?: string;
  height?: number;
}) {
  return (
    <div
      style={{ minHeight: height }}
      className="flex flex-col items-center justify-center text-center text-sm text-gray-500 px-6"
    >
      <p className="font-medium text-gray-600">{title}</p>
      {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
    </div>
  );
}

// ───────────────────────────────────────────────────────────── INR formatter

export function fmtINR(n: number | undefined | null): string {
  if (n == null || isNaN(n)) return '₹0';
  return '₹' + Math.round(n).toLocaleString('en-IN');
}

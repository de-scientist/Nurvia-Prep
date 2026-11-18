"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  CheckCircle2,
  XCircle,
  CalendarDays,
  Wallet,
  ArrowRight,
  Repeat,
} from "lucide-react";
import { useRelativeStrataPrograms } from "@/lib/hooks/nexus/strata/learning/programs/relative/useRelativeStrataPrograms";
import {
  useDiscreteDominionSubscriptionPackages,
  type DiscreteSubscriptionPackage,
  type UserSubscriptionPackage,
} from "@/lib/hooks/nexus/subscription/packages/dicreate/useDiscreteDominionSubscriptionPackages";
import { useCurrentSystemUser } from "@/lib/hooks/users/account/current/useCurrentSystemUser";

const formatShortDate = (value?: string | null) => {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
};

const formatMoney = (amount?: number | null, currency?: string | null) => {
  if (amount == null) return "—";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
    }).format(amount);
  } catch {
    return `${currency ?? ""} ${amount}`.trim();
  }
};

const humanizeMinutes = (raw?: string | number | null) => {
  if (raw == null || raw === "") return null;
  const total = Number(raw);
  if (!Number.isFinite(total) || total <= 0) return typeof raw === "string" ? raw : null;

  const units: [string, number][] = [
    ["year", 525600],
    ["month", 43200],
    ["week", 10080],
    ["day", 1440],
    ["hour", 60],
  ];

  let remaining = Math.floor(total);
  const parts: string[] = [];

  for (const [label, size] of units) {
    const count = Math.floor(remaining / size);
    if (count > 0) {
      parts.push(`${count} ${label}${count === 1 ? "" : "s"}`);
      remaining -= count * size;
    }
  }

  if (parts.length === 0) {
    const mins = Math.floor(total);
    return `${mins} minute${mins === 1 ? "" : "s"}`;
  }

  return parts.join(", ");
};

export function useCheckSubscriptionStatus(parentName: string) {
  const { user } = useCurrentSystemUser();
  const isAuthenticated = !!user;
  const { programs } = useRelativeStrataPrograms();
  const { filteredSubscriptionPackages } = useDiscreteDominionSubscriptionPackages({
    page: 1,
    perPage: 100,
    sortColumn: null,
    sortDirection: "asc",
  });

  const currentProgramGuidIds = useMemo(
    () => new Set(programs.filter((p) => p.segment === parentName).map((p) => p.guidId)),
    [programs, parentName]
  );

  return useMemo(() => {
    if (!isAuthenticated) return null;

    type PackageWithCluster = DiscreteSubscriptionPackage & {
      terminalClusterTableName?: string;
      terminalClusterGuidId?: string;
    };

    const active: { pkg: DiscreteSubscriptionPackage; sub: UserSubscriptionPackage }[] = [];

    filteredSubscriptionPackages.forEach((pkg) => {
      const p = pkg as PackageWithCluster;
      const matches =
        p.terminalClusterTableName === "strata_programs" &&
        !!p.terminalClusterGuidId &&
        currentProgramGuidIds.has(p.terminalClusterGuidId);

      if (!matches) return;

      pkg.userSubscriptions?.forEach((sub) => {
        if (sub.subscriptionStatus === "Active") active.push({ pkg, sub });
      });
    });

    if (active.length === 0) return null;
    return { ...active[0], activeCount: active.length };
  }, [filteredSubscriptionPackages, currentProgramGuidIds, isAuthenticated]);
}

export default function ActiveSubscriptionCard({
  pkg,
  sub,
  activeCount,
   dashboardName,
}: {
  pkg: DiscreteSubscriptionPackage;
  sub: UserSubscriptionPackage;
  activeCount: number;
  dashboardName: string;
}) {
  const isActive = sub.subscriptionStatus === "Active";
  const isPaid = sub.subscriptionHasPaid === "Yes";
  const isAutoRenew = sub.subscriptionAutoRenew === "Yes";
  const cycle = humanizeMinutes(pkg.priceDuration || pkg.duration);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-teal-400/30 bg-gradient-to-br from-[#0F2036] via-[#142B4A] to-[#0D9488] p-5 md:p-6 shadow-md text-white">
      <div className="pointer-events-none absolute -inset-px rounded-2xl ring-1 ring-teal-300/20" />

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
        <div className="flex items-center gap-4 min-w-0">
          <div
            className={`flex items-center justify-center w-14 h-14 rounded-2xl shrink-0 ring-1 ${isActive
              ? "bg-teal-500/20 ring-teal-300/40"
              : "bg-rose-500/20 ring-rose-300/40"
              }`}
          >
            {isActive ? (
              <CheckCircle2 className="w-8 h-8 text-[#2DD4BF]" strokeWidth={2} />
            ) : (
              <XCircle className="w-8 h-8 text-rose-400" strokeWidth={2} />
            )}
          </div>

          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wider text-[#2DD4BF]">
              {activeCount} Active Subscription{activeCount === 1 ? "" : "s"}
            </p>
            <h3 className="text-xl md:text-2xl font-bold truncate mt-0.5">{pkg.name}</h3>
            {pkg.description && (
              <p className="text-xs text-slate-200/80 line-clamp-2 mt-0.5">{pkg.description}</p>
            )}
            <div className="flex items-center gap-1.5 flex-wrap mt-2">
              <span
                className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full ${isActive
                  ? "bg-teal-400/20 text-teal-100 border border-teal-300/30"
                  : "bg-rose-500/20 text-rose-200 border border-rose-400/30"
                  }`}
              >
                {isActive ? <CheckCircle2 className="w-3 h-3" strokeWidth={2.5} /> : <XCircle className="w-3 h-3" strokeWidth={2.5} />}
                Status: {sub.subscriptionStatus ?? "—"}
              </span>
              <span
                className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full ${isPaid
                  ? "bg-teal-400/20 text-teal-100 border border-teal-300/30"
                  : "bg-rose-500/20 text-rose-200 border border-rose-400/30"
                  }`}
              >
                {isPaid ? <CheckCircle2 className="w-3 h-3" strokeWidth={2.5} /> : <XCircle className="w-3 h-3" strokeWidth={2.5} />}
                Paid: {sub.subscriptionHasPaid ?? "—"}
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-white/10 border border-white/15 text-white">
                <Repeat className="w-3 h-3" />
                Auto Renew: {isAutoRenew ? "Yes" : "No"}
              </span>
            </div>
          </div>
        </div>

        <Link
          href={`/dashboards/${dashboardName}`}
          className="group relative inline-flex items-center justify-center gap-2 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] border border-teal-300/30 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all shrink-0"
        >
          <span>Go to Dashboard</span>
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

      <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-white/15 bg-white/5 px-4 py-3">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-teal-200">
            <CalendarDays className="w-3.5 h-3.5" /> Valid From
          </div>
          <p className="mt-1 text-sm font-bold">{formatShortDate(sub.validFrom)}</p>
        </div>
        <div className="rounded-xl border border-white/15 bg-white/5 px-4 py-3">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-teal-200">
            <CalendarDays className="w-3.5 h-3.5" /> Valid Until
          </div>
          <p className="mt-1 text-sm font-bold">{formatShortDate(sub.validUntil)}</p>
        </div>
        <div className="rounded-xl border border-white/15 bg-white/5 px-4 py-3">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-teal-200">
            <Wallet className="w-3.5 h-3.5" /> Cost
          </div>
          <p className="mt-1 text-sm font-bold">
            {formatMoney(pkg.amount, pkg.currency)}
            {cycle ? <span className="font-normal text-white/70"> / {cycle}</span> : null}
          </p>
        </div>
      </div>
    </div>
  );
}
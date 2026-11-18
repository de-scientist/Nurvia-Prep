// src/app/dashboards/ati-teas/auth/account/security/page.tsx
"use client";

import Link from "next/link";
import {
  FiArrowLeft,
  FiShield,
  FiMail,
  FiLock,
  FiKey,
  FiSmartphone,
  FiAlertTriangle,
  FiCheckCircle,
} from "react-icons/fi";
import { useFlexPageClasp } from "@/lib/contexts/panel/layout/utils/FlexPageClasp";
import { useCurrentSystemUser } from "@/lib/hooks/users/account/current/useCurrentSystemUser";

const CURRENT_PANEL = "nclex-pn";

// ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
function SectionCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111C2E] p-5 shadow-xs">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[#0D9488]">{icon}</span>
        <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">{title}</h2>
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function StatusRow({
  label,
  description,
  ok,
  actionHref,
  actionLabel,
  neutral = false,
}: {
  label: string;
  description?: string;
  ok: boolean;
  actionHref?: string;
  actionLabel?: string;
  neutral?: boolean;
}) {
  const tone = neutral
    ? "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
    : ok
      ? "bg-teal-50 dark:bg-teal-950/50 text-[#0D9488] dark:text-[#2DD4BF] border border-teal-200 dark:border-teal-800/70"
      : "bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/70";

  return (
    <div className="flex items-center justify-between gap-3 text-xs py-2 px-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
      <div className="min-w-0">
        <p className="font-semibold text-slate-900 dark:text-slate-100">{label}</p>
        {description && (
          <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{description}</p>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${tone}`}>
          {neutral ? label : ok ? "Enabled" : "Disabled"}
        </span>
        {!ok && !neutral && actionHref && (
          <Link
            href={actionHref}
            className="text-[10px] font-semibold text-[#0D9488] hover:underline"
          >
            {actionLabel ?? "Fix"}
          </Link>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="flex items-center justify-between text-xs py-1.5 px-1 rounded-lg hover:bg-[var(--text-color)]/5 transition-colors">
      <span className="opacity-60 text-[var(--text-color)]">{label}</span>
      <span className="font-medium text-[var(--text-color)] truncate max-w-[60%] text-right">
        {value ?? "—"}
      </span>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export default function AccountSecurityPage() {
  const { leftWidth, rightWidth, navHeight } = useFlexPageClasp();
  const { user, loading } = useCurrentSystemUser();

  if (loading) {
    return (
      <main
        className="pt-16 flex items-center justify-center"
        style={{ marginLeft: leftWidth, marginRight: rightWidth, minHeight: `calc(100vh - ${navHeight}px)` }}
      >
        <p className="text-sm font-bold opacity-60 text-[var(--text-color)]">Loading security details . . . ⚓</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main
        className="pt-16 flex flex-col items-center justify-center gap-4 text-center px-4"
        style={{ marginLeft: leftWidth, marginRight: rightWidth, minHeight: `calc(100vh - ${navHeight}px)` }}
      >
        <p className="text-sm font-bold opacity-70 text-[var(--text-color)]">
          You need to be signed in to view your security settings.
        </p>
        <Link
          href={`/dashboards/${CURRENT_PANEL}/auth/login`}
          className="px-5 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg hover:scale-105 transition-transform"
        >
          Log In
        </Link>
      </main>
    );
  }

  const access = user.accesses?.[0];
  const primaryEmail = user.emails?.find((e) => e.isPrimary);
  const primaryPhone = user.phones?.find((p) => p.isPrimary);
  const unusedBackupCodes = user.backupCodes?.filter((b) => !b.isUsed).length ?? 0;
  const totalBackupCodes = user.backupCodes?.length ?? 0;

  // A rough "security score" out of the checks we actually have data for — purely illustrative.
  const checks = [
    !!primaryEmail?.isVerified,
    !!primaryPhone?.isVerified,
    user.twoFactorEnabled,
    !access?.isLocked,
  ];
  const scorePercent = Math.round((checks.filter(Boolean).length / checks.length) * 100);

  return (
    <main
      className="pt-16 transition-all duration-300 ease-in-out overflow-x-hidden"
      style={{
        marginLeft: leftWidth,
        marginRight: rightWidth,
        minHeight: `calc(100vh - ${navHeight}px)`,
        backgroundColor: "var(--content-bg)",
        color: "var(--content-text)",
      }}
    >
      <div className="p-3 md:p-4 space-y-5 w-full max-w-7xl mx-auto">

        {/* ─────────────────────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <Link
            href={`/dashboards/${CURRENT_PANEL}/auth/account/show`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold opacity-60 hover:opacity-100 text-[var(--text-color)] transition-opacity"
          >
            <FiArrowLeft className="w-3.5 h-3.5" />
            Back to Profile
          </Link>
        </div>

        {/* ─────────────────────────────────────────────────────────────────────── */}
        {/* Header + security score */}
        <div className="rounded-2xl border border-slate-200/20 bg-gradient-to-br from-[#142B4A] via-[#0F2036] to-[#0D9488] px-6 py-6 flex flex-col sm:flex-row items-center gap-5 text-white shadow-md">

          <div className="flex-1 text-center sm:text-left">
            <h1 className="text-lg md:text-xl font-bold flex items-center justify-center sm:justify-start gap-2">
              <FiShield className="w-5 h-5 text-[#2DD4BF]" />
              Security &amp; Account
            </h1>
            <p className="text-sm text-slate-200/85 mt-0.5">
              {user.userName} · {user.email}
            </p>

            <Link
              href={`/dashboards/${CURRENT_PANEL}/auth/account/security/password`}
              className="inline-flex items-center gap-1.5 px-4 py-2 mt-3 rounded-xl font-semibold text-xs bg-[#0D9488] hover:bg-[#0F766E] text-white shadow-sm transition-colors whitespace-nowrap"
            >
              <FiLock className="w-3.5 h-3.5" />
              Update / Change My Password
            </Link>

          </div>

          <div className="flex flex-col items-center shrink-0">
            <div
              className={`w-14 h-14 rounded-2xl border flex items-center justify-center text-sm font-bold ${scorePercent >= 75
                  ? "bg-teal-400/20 border-teal-300/40 text-teal-100"
                  : scorePercent >= 50
                    ? "bg-amber-400/20 border-amber-300/40 text-amber-100"
                    : "bg-rose-500/20 border-rose-400/40 text-rose-100"
                }`}
            >
              {scorePercent}%
            </div>

            <span className="text-[10px] uppercase font-bold text-teal-100 mt-1.5 tracking-wider">
              Security Score
            </span>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          <SectionCard title="Verification" icon={<FiCheckCircle className="w-4 h-4" />}>
            <StatusRow
              label="Email Verified"
              description={primaryEmail?.email ?? user.email}
              ok={!!primaryEmail?.isVerified}
              actionHref={`/dashboards/${CURRENT_PANEL}/auth/account/verify/email`}
              actionLabel="Verify email"
            />
            <StatusRow
              label="Phone Verified"
              description={primaryPhone?.phoneNumber ?? user.phoneNumber ?? "No phone on file"}
              ok={!!primaryPhone?.isVerified}
              actionHref={`/dashboards/${CURRENT_PANEL}/auth/account/verify/phone`}
              actionLabel="Verify phone"
            />
          </SectionCard>

          <SectionCard title="Two-Factor Authentication" icon={<FiSmartphone className="w-4 h-4" />}>
            <StatusRow
              label="2FA"
              description="Extra verification step at login"
              ok={user.twoFactorEnabled}
              actionHref={`/dashboards/${CURRENT_PANEL}/auth/account/security/2fa`}
              actionLabel="Enable 2FA"
            />
            <InfoRow
              label="Backup Codes"
              value={totalBackupCodes > 0 ? `${unusedBackupCodes} of ${totalBackupCodes} unused` : "None generated"}
            />
          </SectionCard>

          <SectionCard title="Account Access" icon={<FiLock className="w-4 h-4" />}>
            <StatusRow
              label="Account Active"
              ok={!!access?.isActive}
              neutral={false}
            />
            <StatusRow
              label="Account Locked"
              description={access?.isLocked ? "Your account is currently locked" : "No active lockout"}
              ok={!access?.isLocked}
            />
            <InfoRow label="Lockout Enabled" value={user.lockoutEnabled ? "Yes" : "No"} />
            <InfoRow label="Lockout Ends" value={user.lockoutEnd ?? "Not locked out"} />
            <InfoRow label="Two-Factor Expiry" value={access?.twoFactorExpiry ?? "—"} />
          </SectionCard>

          <SectionCard title="Contact on File" icon={<FiMail className="w-4 h-4" />}>
            <InfoRow label="Email" value={user.email} />
            <InfoRow label="Phone" value={user.phoneNumber ?? "—"} />
            <InfoRow label="User Type" value={user.userType} />
          </SectionCard>

          <SectionCard title="Roles" icon={<FiShield className="w-4 h-4" />}>
            {user.roles?.length ? (
              user.roles.map((r) => (
                <InfoRow key={r.id} label={r.name ?? "Unnamed Role"} value={`Rank ${r.rank} · ${r.status ?? "—"}`} />
              ))
            ) : (
              <p className="text-xs opacity-50 text-[var(--text-color)]">No roles assigned.</p>
            )}
          </SectionCard>

          <SectionCard title="Grants" icon={<FiKey className="w-4 h-4" />}>
            {user.grants?.length ? (
              user.grants.map((g) => (
                <InfoRow key={g.id} label={g.name ?? "Unnamed Grant"} value={g.status ?? "—"} />
              ))
            ) : (
              <p className="text-xs opacity-50 text-[var(--text-color)]">No grants assigned.</p>
            )}
          </SectionCard>

          <SectionCard title="Account Timeline" icon={<FiAlertTriangle className="w-4 h-4" />}>
            <InfoRow label="Created" value={user.createdAt} />
            <InfoRow label="Last Updated" value={user.updatedAt ?? "Never"} />
            <InfoRow label="Deleted" value={user.deletedAt ?? "Not deleted"} />
          </SectionCard>

        </div>
      </div>
    </main>
  );
}

// ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// The End By : B.L.S.M.C ;  -  SkewBlanc - The Winds Chase Us ⚓
// ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
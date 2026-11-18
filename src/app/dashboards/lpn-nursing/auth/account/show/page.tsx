"use client";

import Link from "next/link";
import {
  FiEdit2,
  FiMail,
  FiShield,
  FiUser,
  FiAward,
  FiKey,
  FiLock,
  FiMapPin,
  FiGlobe,
} from "react-icons/fi";
import { useFlexPageClasp } from "@/lib/contexts/panel/layout/utils/FlexPageClasp";
import { useCurrentSystemUser } from "@/lib/hooks/users/account/current/useCurrentSystemUser";

const CURRENT_PANEL = "lpn-nursing";

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

function Row({
  label,
  value,
  badge,
}: {
  label: string;
  value?: string | number | null;
  badge?: { text: string; tone: "good" | "bad" | "neutral" };
}) {
  const toneClasses = {
    good: "bg-teal-50 dark:bg-teal-950/50 text-[#0D9488] dark:text-[#2DD4BF] border border-teal-200 dark:border-teal-800/70",
    bad: "bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/70",
    neutral: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300",
  };

  return (
    <div className="flex items-center justify-between text-xs py-1.5 px-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      {badge ? (
        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${toneClasses[badge.tone]}`}>
          {badge.text}
        </span>
      ) : (
        <span className="font-medium text-slate-900 dark:text-slate-100 truncate max-w-[60%] text-right">
          {value ?? "—"}
        </span>
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export default function ProfileShowPage() {
  const { leftWidth, rightWidth, navHeight } = useFlexPageClasp();
  const { user, loading } = useCurrentSystemUser();

  if (loading) {
    return (
      <main
        className="pt-16 flex items-center justify-center"
        style={{ marginLeft: leftWidth, marginRight: rightWidth, minHeight: `calc(100vh - ${navHeight}px)` }}
      >
        <p className="text-sm font-bold opacity-60 text-[var(--text-color)]">Loading profile . . . ⚓</p>
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
          You need to be signed in to view this profile.
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
  const topRole = user.roles?.length
    ? [...user.roles].sort((a, b) => b.rank - a.rank)[0]?.name ?? "Void"
    : "Void";

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
        {/* Header card */}
        <div className="rounded-2xl border border-slate-200/20 bg-gradient-to-br from-[#142B4A] via-[#0F2036] to-[#0D9488] px-6 py-6 md:px-8 md:py-7 flex flex-col sm:flex-row items-center sm:items-start gap-5 text-white shadow-md">

          <div className="flex-1 text-center sm:text-left">
            <h1 className="text-xl md:text-2xl font-bold">{user.userName}</h1>
            <p className="text-xs md:text-sm text-slate-200/85 mt-0.5">{user.email}</p>

            <div className="mt-3 flex flex-wrap gap-2 justify-center sm:justify-start">
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${access?.isActive ? "bg-teal-400/20 text-teal-100 border border-teal-300/30" : "bg-rose-500/20 text-rose-200 border border-rose-400/30"}`}>
                {access?.isActive ? "Active Account" : "Inactive Account"}
              </span>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-white/15 text-white border border-white/20">
                {topRole}
              </span>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-white/10 text-slate-200">
                {user.userType}
              </span>
            </div>
          </div>

          <div className="flex-1 flex flex-col items-center sm:items-end gap-2.5">
            <Link
              href={`/dashboards/${CURRENT_PANEL}/auth/account/edit`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-xs md:text-sm bg-[#0D9488] hover:bg-[#0F766E] text-white shadow-sm transition-colors"
            >
              <FiEdit2 className="w-4 h-4" />
              Edit My Profile
            </Link>

            <Link
              href={`/dashboards/${CURRENT_PANEL}/auth/account/security/password`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-xs md:text-sm border border-white/25 bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <FiLock className="w-4 h-4" />
              Update / Change My Password
            </Link>
          </div>

        </div>

        {/* ─────────────────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          <SectionCard title="Account" icon={<FiUser className="w-4 h-4" />}>
            <Row label="Username" value={user.userName} />
            <Row label="User Type" value={user.userType} />
            <Row label="Created" value={user.createdAt} />
            <Row label="Updated" value={user.updatedAt ?? "Never"} />
            <Row label="Deleted" value={user.deletedAt ?? "Not deleted"} />
          </SectionCard>

          <SectionCard title="Security" icon={<FiShield className="w-4 h-4" />}>
            <Row
              label="Email Confirmed"
              badge={{ text: user.emailConfirmed ? "Yes" : "No", tone: user.emailConfirmed ? "good" : "bad" }}
            />
            <Row
              label="Phone Confirmed"
              badge={{ text: user.phoneNumberConfirmed ? "Yes" : "No", tone: user.phoneNumberConfirmed ? "good" : "bad" }}
            />
            <Row
              label="Two-Factor Auth"
              badge={{ text: user.twoFactorEnabled ? "Enabled" : "Disabled", tone: user.twoFactorEnabled ? "good" : "bad" }}
            />
            <Row
              label="Lockout Enabled"
              badge={{ text: user.lockoutEnabled ? "Yes" : "No", tone: user.lockoutEnabled ? "neutral" : "good" }}
            />
            <Row label="Lockout Ends" value={user.lockoutEnd ?? "Not locked out"} />
          </SectionCard>

          <SectionCard title="Contact" icon={<FiMail className="w-4 h-4" />}>
            <Row label="Primary Email" value={primaryEmail?.email ?? user.email} />
            <Row
              label="Email Verified"
              badge={{ text: primaryEmail?.isVerified ? "Verified" : "Unverified", tone: primaryEmail?.isVerified ? "good" : "bad" }}
            />
            <Row label="Primary Phone" value={primaryPhone?.phoneNumber ?? user.phoneNumber ?? "—"} />
            <Row
              label="Phone Verified"
              badge={{ text: primaryPhone?.isVerified ? "Verified" : "Unverified", tone: primaryPhone?.isVerified ? "good" : "bad" }}
            />
          </SectionCard>

          <SectionCard title="Personal Details" icon={<FiUser className="w-4 h-4" />}>
            <Row label="Gender" value={user.profile?.gender} />
            <Row label="Date of Birth" value={user.profile?.dateOfBirth} />
            <Row label="Ethnicity" value={user.profile?.ethnicity} />
            <Row label="Race" value={user.profile?.race} />
            <Row label="Religion" value={user.profile?.religion} />
            <Row label="Language" value={user.profile?.language} />
          </SectionCard>

          <SectionCard title="About" icon={<FiGlobe className="w-4 h-4" />}>
            <Row label="Website" value={user.profile?.website} />
            <div className="pt-1">
              <p className="text-[10px] uppercase font-bold opacity-50 text-[var(--text-color)] mb-1">Bio</p>
              <p className="text-xs text-[var(--text-color)] opacity-80">{user.profile?.bio || "No bio added yet."}</p>
            </div>
            <div className="pt-1">
              <p className="text-[10px] uppercase font-bold opacity-50 text-[var(--text-color)] mb-1">About</p>
              <p className="text-xs text-[var(--text-color)] opacity-80">{user.profile?.about || "No details added yet."}</p>
            </div>
          </SectionCard>

          <SectionCard title="Location" icon={<FiMapPin className="w-4 h-4" />}>
            <Row label="Name" value={user.profile?.location?.name} />
            <Row label="Country" value={user.profile?.location?.country} />
          </SectionCard>

          <SectionCard title="Roles" icon={<FiShield className="w-4 h-4" />}>
            {user.roles?.length ? (
              user.roles.map((r) => (
                <Row key={r.id} label={r.name ?? "Unnamed Role"} value={`Rank ${r.rank} · ${r.status ?? "—"}`} />
              ))
            ) : (
              <p className="text-xs opacity-50 text-[var(--text-color)]">No roles assigned.</p>
            )}
          </SectionCard>

          <SectionCard title="Grants" icon={<FiKey className="w-4 h-4" />}>
            {user.grants?.length ? (
              user.grants.map((g) => (
                <Row key={g.id} label={g.name ?? "Unnamed Grant"} value={g.status ?? "—"} />
              ))
            ) : (
              <p className="text-xs opacity-50 text-[var(--text-color)]">No grants assigned.</p>
            )}
          </SectionCard>

          <SectionCard title="Categories" icon={<FiUser className="w-4 h-4" />}>
            {user.categories?.length ? (
              user.categories.map((c, i) => (
                <Row key={i} label={c.categoryName} value={`${c.dashboard} · ${c.dashboardRole} · ${c.accessLevel}`} />
              ))
            ) : (
              <p className="text-xs opacity-50 text-[var(--text-color)]">No categories assigned.</p>
            )}
          </SectionCard>

          <SectionCard title="Badges" icon={<FiAward className="w-4 h-4" />}>
            {user.badges?.length ? (
              <div className="flex flex-wrap gap-2">
                {user.badges.map((b) => (
                  <span
                    key={b.id}
                    title={b.description}
                    className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-yellow-500/15 text-yellow-600"
                  >
                    {b.badgeName}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs opacity-50 text-[var(--text-color)]">No badges earned yet.</p>
            )}
          </SectionCard>

          <SectionCard title="Backup Codes" icon={<FiKey className="w-4 h-4" />}>
            {user.backupCodes?.length ? (
              <Row
                label="Codes Remaining"
                value={`${user.backupCodes.filter((b) => !b.isUsed).length} of ${user.backupCodes.length}`}
              />
            ) : (
              <p className="text-xs opacity-50 text-[var(--text-color)]">No backup codes generated.</p>
            )}
          </SectionCard>

        </div>
      </div>
    </main>
  );
}

// ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// The End By : B.L.S.M.C ;  -  SkewBlanc - The Winds Chase Us ⚓
// ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
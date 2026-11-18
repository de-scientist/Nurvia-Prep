"use client";

import Link from "next/link";
import Image from "next/image";
import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  FiLogIn,
  FiUserPlus,
  FiHelpCircle,
  FiMail,
  FiChevronDown,
  FiChevronUp,
  FiUser,
  FiSettings,
  FiShield,
  FiTrash2,
  FiAlertTriangle,
} from "react-icons/fi";

import { Dropdown } from "@/components/dashboards/includes/navbar/dropdowns/Dropdown";
import { DropdownItem } from "@/components/dashboards/includes/navbar/dropdowns/DropdownItem";
import { useCurrentSystemUser } from "@/lib/hooks/users/account/current/useCurrentSystemUser";
import { dynamicLogoutService } from "@/lib/services/auth/logoutService";
import { destroyAccountService } from "@/lib/services/auth/destroyService";
import { clearSystemUserSessionCookies } from "@/lib/utils/sessions/clearSystemUserSessionCookies";

const TARGET_PANEL = "Lpn-Nursing";
const DEFAULT_LOGOUT_REDIRECT = `/dashboards/${TARGET_PANEL.toLowerCase()}/auth/logout`;
const TARGET_DASHBOARD = TARGET_PANEL.toLowerCase();
const TARGET_PROGRAM = TARGET_PANEL.toLowerCase();

// const LOGOUT_FETCH_TYPE = "distinct" // Can  "relative" or  "distinct"  // "relative" destroys all sessions and distinct destroy current session only
const LOGOUT_FETCH_TYPE_DISTINCT = "distinct";
const LOGOUT_FETCH_TYPE_RELATIVE = "relative";

// ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// INFO ROW 
function InfoRow({
  label,
  value,
  status,
  actionHref,
  actionLabel,
}: {
  label: string;
  value?: string;
  status?: boolean;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div
      className="
        group flex items-center justify-between
        text-xs py-1.5 px-2.5
        rounded-lg
        transition-all duration-200
        hover:bg-slate-100 dark:hover:bg-slate-800/70
      "
    >
      <span className="text-slate-600 dark:text-slate-400 font-semibold">{label}</span>

      {typeof status === "boolean" ? (
        status ? (
          <span className="font-semibold text-[#0D9488]">Yes</span>
        ) : (
          <a
            href={actionHref}
            className="
              inline-flex items-center gap-1
              text-[10px] font-semibold
              text-amber-700 dark:text-amber-300
              px-2 py-0.5 rounded-full
              border border-amber-300/60 dark:border-amber-700
              bg-amber-50 dark:bg-amber-950/50
              hover:bg-amber-100 dark:hover:bg-amber-900/60
              transition
            "
          >
            {actionLabel ?? "Verify"}
          </a>
        )
      ) : (
        <span className="font-medium text-slate-900 dark:text-slate-100 truncate max-w-[170px]">
          {value ?? "—"}
        </span>
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
/* MAIN COMPONENT */

export default function UserDropdown() {
  const { user, loading } = useCurrentSystemUser();
  const [isOpen, setIsOpen] = useState(false);
  const [avatarBroken, setAvatarBroken] = useState(false);
  const [logoutOptionsOpen, setLogoutOptionsOpen] = useState(false);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteReason, setDeleteReason] = useState("");

  /* Info collapse state (remembered) */
  const [infoOpen, setInfoOpen] = useState(true); // by default let the accordion state be open !
  const hoverTimeout = React.useRef<NodeJS.Timeout | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    setIsOpen(false);
    setLogoutOptionsOpen(false);
    setShowDeleteConfirm(false);
    setDeleteError(null);
    setDeleteReason("");
    setInfoOpen(false);
  }, [pathname]);

  useEffect(() => {
    const saved = localStorage.getItem("user_dropdown_info_open");
    if (saved !== null) {
      setInfoOpen(saved === "true");
    }
  }, []);

  const toggleInfo = () => {
    const next = !infoOpen;
    setInfoOpen(next);
    localStorage.setItem("user_dropdown_info_open", String(next));
  };

  const handleDeleteAccount = async () => {
    if (!user?.guidId || !user?.email) {
      setDeleteError("Unable to identify your account. Please sign in again.");
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);

    const res = await destroyAccountService({
      guidId: user.guidId,
      email: user.email,
      reason: deleteReason.trim() || undefined,
    });

    if (!res.success) {
      // Session stays intact so the user can retry
      setDeleteError(
        res.error || res.message || "Could not delete your account. Please try again."
      );
      setIsDeleting(false);
      return;
    }

    // Success: now it is safe to wipe the session
    clearSystemUserSessionCookies();

    const msg = encodeURIComponent(
      res.message || "Your account has been Deactivated and Deleted Successfully ⚓"
    );
    window.location.href = `/dashboards/${TARGET_DASHBOARD}/auth/login?msg=${msg}`;
  };

  if (loading) {
    return <div className="text-xs font-semibold text-slate-500">Loading...</div>;
  }

  // ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  // NOT LOGGED IN 

  if (!user) {
    return (
      <div
        className="relative"
        onMouseEnter={() => {
          hoverTimeout.current = setTimeout(() => setIsOpen(true), 80);
        }}
        onMouseLeave={() => {
          if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
        }}
      >

        <button
          onClick={() => setIsOpen(v => !v)}
          className="
            group relative flex items-center gap-2 px-4 py-2
            rounded-xl text-sm font-semibold
            text-white
            bg-[#142B4A] hover:bg-[#0D9488]
            shadow-xs
            transition-colors
          "
        >
          <FiLogIn className="relative" />
          <span className="relative">Login / Register</span>
          <FiChevronDown className="relative ml-1 text-xs" />
        </button>

        <Dropdown
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          className="
            absolute right-0 mt-3 w-[250px]
            rounded-2xl border border-slate-200 dark:border-slate-800
            bg-white dark:bg-[#111C2E]
            shadow-xl z-50
          "
        >
          <div className="px-1.5 py-1.5 space-y-1">
            <DropdownItem>
              <Link
                href={`/dashboards/${TARGET_DASHBOARD}/auth/login`}
                className="
                  group flex items-center gap-2.5
                  rounded-xl px-3 py-2
                  transition-all duration-200
                  hover:bg-slate-100 dark:hover:bg-slate-800
                "
              >
                <FiLogIn className="text-[#0D9488] transition-transform duration-200 group-hover:translate-x-0.5" />
                <span className="font-medium">Login</span>
              </Link>
            </DropdownItem>

            <DropdownItem>
              <Link
                href={`/dashboards/${TARGET_DASHBOARD}/auth/register`}
                className="
                group flex items-center gap-2.5
                rounded-xl px-3 py-2
                transition-all duration-200
                hover:bg-slate-100 dark:hover:bg-slate-800
              "
              >
                <FiUserPlus className="text-[#0D9488] transition-transform duration-200 group-hover:translate-x-0.5" />
                <span className="font-medium">Create account</span>
              </Link>
            </DropdownItem>


            <div className="my-1.5 h-px bg-slate-200 dark:bg-slate-800" />

            <DropdownItem>
              <Link
                href={`/dashboards/${TARGET_DASHBOARD}/vista/pages/support`}
                className="
                group flex items-center gap-2.5
                rounded-xl px-3 py-2
                transition-all duration-200
                hover:bg-slate-100 dark:hover:bg-slate-800
              "
              >
                <FiHelpCircle className="text-slate-500 group-hover:text-[#0D9488] transition-colors" />
                <span className="font-medium">Help Center</span>
              </Link>
            </DropdownItem>


            <DropdownItem>
              <Link
                href={`/dashboards/${TARGET_DASHBOARD}/vista/pages/contact-us`}
                className="
                  group flex items-center gap-2.5
                  rounded-xl px-3 py-2
                  transition-all duration-200
                  hover:bg-slate-100 dark:hover:bg-slate-800
                "
              >
                <FiMail className="text-slate-500 group-hover:text-[#0D9488] transition-colors" />
                <span className="font-medium">Contact Support</span>
              </Link>
            </DropdownItem>

          </div>

        </Dropdown>
      </div>
    );
  }
  // ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  //  LOGGED IN

  const avatarSrc =
    !avatarBroken && user.profile?.profilePicture
      ? user.profile.profilePicture
      : null;

  const access = user.accesses?.[0];
  const primaryEmail = user.emails?.find(e => e.isPrimary);
  const primaryPhone = user.phones?.find(p => p.isPrimary);
  const userName = user?.userName?.trim() || "";
  const userInitial = userName ? userName[0].toUpperCase() : "?";
  const role =
    user.roles && user.roles.length > 0
      ? [...user.roles]
        .sort((a, b) => b.rank - a.rank)[0]?.name ?? "Void"
      : "Void"; const grantsCount = user.grants?.length ?? 0;
  const category = user.categories?.[0]?.categoryName;
  const badges = user.badges?.map(b => b.badgeName).join(", ");

  // ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  // LOGGED IN

  return (
    <div
      className="relative"
      onMouseEnter={() => {
        hoverTimeout.current = setTimeout(() => setIsOpen(true), 80);
      }}
      onMouseLeave={() => {
        if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
      }}
    >

      {/* Trigger */}
      <button
        onClick={() => setIsOpen(v => !v)}
        className="
          group flex items-center gap-2
          rounded-xl px-2 py-1
          border border-transparent hover:border-slate-200 dark:hover:border-slate-700
          transition-all duration-200
          hover:bg-slate-100/70 dark:hover:bg-slate-800/50
        "
      >
        <span
          className="
            hidden sm:flex h-9 w-9 rounded-full overflow-hidden
            items-center justify-center
            bg-[#142B4A] text-white
            transition-all duration-200
          "
        >
          {avatarSrc ? (
            <Image
              src={avatarSrc}
              alt={user.userName}
              width={40}
              height={40}
              referrerPolicy="no-referrer"
              onError={() => setAvatarBroken(true)}
            />
          ) : (
            <span className="text-sm font-bold text-white">
              {userInitial}
            </span>
          )}
        </span>

        {/* Phone: bordered, max 10 chars */}
        <span className="sm:hidden text-xs font-semibold whitespace-nowrap rounded-lg border border-slate-300 dark:border-slate-700 px-2 py-1.5 transition-colors group-hover:text-[#0D9488]">
          {userName.length > 10 ? userName.slice(0, 10) + "…" : userName}
        </span>

        {/* sm and up: full name, unchanged */}
        <span className="hidden sm:inline text-sm font-semibold transition-colors group-hover:text-[#0D9488]">
          {user.userName}
        </span>

      </button>

      {/* Dropdown */}
      <Dropdown
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        className="absolute right-0 mt-3 w-[340px] max-w-[calc(100vw-1rem)] rounded-2xl border border-slate-200 dark:border-slate-800
                  bg-white dark:bg-[#111C2E]
                  shadow-2xl z-50"
      >
        {/* Header */}
        <div className="px-6 py-4 text-center border-b border-slate-100 dark:border-slate-800">
          <div className="mx-auto mb-2.5 h-14 w-14 rounded-full overflow-hidden bg-[#142B4A] text-white flex items-center justify-center shadow-sm">
            {avatarSrc ? (
              <Image
                src={avatarSrc}
                alt={user.userName}
                width={56}
                height={56}
                referrerPolicy="no-referrer"
                onError={() => setAvatarBroken(true)}
              />
            ) : (
              <span className="text-xl font-bold text-white">
                {userInitial}
              </span>
            )}
          </div>

          <div className="font-bold text-slate-900 dark:text-slate-100">{user.userName}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{user.email}</div>

          <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-teal-50 dark:bg-teal-950/50 border border-teal-200 dark:border-teal-800 px-2.5 py-0.5 text-[11px] font-semibold text-[#0D9488] dark:text-[#2DD4BF]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#0D9488]" />
            {access?.isActive ? "Active Account" : "Inactive Account"}
          </div>
        </div>

        {/* Collapsible Info */}
        <button
          onClick={toggleInfo}
          className="
            group w-full
            flex items-center justify-between
            px-6 py-2.5
            text-xs font-semibold
            text-slate-700 dark:text-slate-300
            border-b border-slate-100 dark:border-slate-800
            transition-colors
            hover:bg-slate-50 dark:hover:bg-slate-800/50
          "
        >
          <span>Account Information</span>
          <span className="flex items-center gap-1 text-[11px] text-[#0D9488]">
            <span>{infoOpen ? "Hide" : "Show"}</span>
            {infoOpen ? <FiChevronUp /> : <FiChevronDown />}
          </span>
        </button>


        {infoOpen && (
          <div
            className="
            px-4 py-3 space-y-0.5
            bg-slate-50/60 dark:bg-slate-900/40
            border-b border-slate-100 dark:border-slate-800
          "
          >
            <InfoRow label="Role" value={role} />
            <InfoRow label="Grants" value={`${grantsCount}`} />
            <InfoRow label="User type" value={user.userType} />
            <InfoRow label="Phone" value={primaryPhone?.phoneNumber} />
            <InfoRow
              label="Email verified"
              status={primaryEmail?.isVerified}
              actionHref={`/dashboards/${TARGET_PROGRAM}/auth/account/verify/email`}
              actionLabel="Verify email"
            />

            <InfoRow
              label="Phone verified"
              status={primaryPhone?.isVerified}
              actionHref={`/dashboards/${TARGET_PROGRAM}/auth/account/verify/phone`}
              actionLabel="Verify phone"
            />

            <InfoRow
              label="2FA enabled"
              status={user.twoFactorEnabled}
              actionHref={`/dashboards/${TARGET_PROGRAM}/auth/account/security/2fa`}
              actionLabel="Enable 2FA"
            />
            <InfoRow label="Category" value={category} />
            <InfoRow label="Badges" value={badges} />
          </div>
        )}

        {/* Actions */}
        <div
          className="px-3 py-2 space-y-1"
          onClick={(e) => {
            if ((e.target as HTMLElement).closest("a")) {
              if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
              setIsOpen(false);
              setLogoutOptionsOpen(false);
            }
          }}
        >
          <DropdownItem>
            <Link
              href={`/dashboards/${TARGET_PROGRAM}/auth/account/show`}
              className="
              group flex items-center gap-2.5 rounded-xl px-3 py-2
              transition-all duration-200
            "
            >
              <FiUser className="text-[#0D9488] group-hover:translate-x-0.5 transition" />
              My Profile Account
            </Link>
          </DropdownItem>

          <DropdownItem>
            <Link
              href={`/dashboards/${TARGET_PROGRAM}/auth/account/support`}
              className="
                group flex items-center gap-2.5 rounded-xl px-3 py-2
                transition-all duration-200
              "
            >
              <FiSettings className="text-[#0D9488] group-hover:rotate-6 transition" />
              Support / Help
            </Link>
          </DropdownItem>

          <DropdownItem>
            <Link
              href={`/dashboards/${TARGET_PROGRAM}/auth/account/security/profile`}
              className="
                group flex items-center gap-2.5 rounded-xl px-3 py-2
                transition-all duration-200
              "
            >
              <FiShield className="text-[#142B4A] dark:text-[#2DD4BF] group-hover:-translate-y-0.5 transition" />
              Account Security
            </Link>
          </DropdownItem>

          {/* Logout Actions */}
          <div className="relative pt-2 space-y-2 border-t border-slate-100 dark:border-slate-800">

            {/* PRIMARY: Distinct Logout */}
            <div className="flex items-center gap-2">
              <button
                onClick={async () => {
                  try {
                    const response = await dynamicLogoutService(
                      TARGET_PANEL,
                      LOGOUT_FETCH_TYPE_DISTINCT
                    );

                    const redirectTo =
                      typeof response?.redirect_to === "string" &&
                        response.redirect_to.trim() !== ""
                        ? response.redirect_to
                        : DEFAULT_LOGOUT_REDIRECT;

                    const msg = encodeURIComponent(
                      typeof response?.message === "string" &&
                        response.message.trim() !== ""
                        ? response.message
                        : "You’ve Been Signed Out Successfully"
                    );

                    window.location.href = `${redirectTo}?msg=${msg}`;
                  } catch {
                    // 🚨 absolute final fallback — nothing can block logout navigation
                    const msg = encodeURIComponent("You’ve Been Signed Out Successfully");
                    window.location.href = `${DEFAULT_LOGOUT_REDIRECT}?msg=${msg}`;
                  }
                }}


                className="
                  flex-1
                  flex items-center justify-center gap-2
                  px-4 py-2
                  rounded-xl
                  text-xs font-semibold
                  text-rose-700 dark:text-rose-300
                  border border-rose-200 dark:border-rose-800/70
                  bg-rose-50 dark:bg-rose-950/40
                  hover:bg-rose-100 dark:hover:bg-rose-900/50
                  transition-colors
                "
              >
                <FiLogIn className="h-4 w-4" />
                <span>Sign Out</span>
              </button>

              {/* SECONDARY TOGGLE */}
              <button
                onClick={() => setLogoutOptionsOpen((v) => !v)}
                className="
                  p-2 rounded-xl
                  border border-slate-200 dark:border-slate-700
                  bg-slate-50 dark:bg-slate-800
                  text-slate-700 dark:text-slate-300
                  hover:bg-slate-100 dark:hover:bg-slate-700
                  transition
                "
                title="Advanced logout options"
              >
                {logoutOptionsOpen ? <FiChevronUp /> : <FiChevronDown />}
              </button>
            </div>

            {/* ADVANCED DROPDOWN */}
            {logoutOptionsOpen && (
              <div
                className="
                  absolute right-0 mt-1
                  w-full
                  rounded-xl
                  border border-slate-200 dark:border-slate-800
                  bg-white dark:bg-[#111C2E]
                  shadow-xl
                  animate-fade-in
                  z-50
                "
              >
                <button
                  onClick={async () => {
                    try {
                      const response = await dynamicLogoutService(
                        TARGET_PANEL,
                        LOGOUT_FETCH_TYPE_RELATIVE
                      );

                      const redirectTo =
                        typeof response?.redirect_to === "string" &&
                          response.redirect_to.trim() !== ""
                          ? response.redirect_to
                          : DEFAULT_LOGOUT_REDIRECT;

                      const msg = encodeURIComponent(
                        typeof response?.message === "string" &&
                          response.message.trim() !== ""
                          ? response.message
                          : "You’ve Been Signed Out Successfully"
                      );

                      window.location.href = `${redirectTo}?msg=${msg}`;
                    } catch {
                      // 🚨 absolute final fallback — nothing can block logout navigation
                      const msg = encodeURIComponent("You’ve Been Signed Out Successfully");
                      window.location.href = `${DEFAULT_LOGOUT_REDIRECT}?msg=${msg}`;
                    }
                  }}

                  className="
                    w-full
                    flex items-start gap-3
                    px-4 py-3
                    text-left
                    rounded-t-xl
                    hover:bg-rose-50 dark:hover:bg-rose-950/30
                    transition
                  "
                >
                  <FiShield className="text-rose-600 mt-0.5" />
                  <div>
                    <div className="text-xs font-bold text-rose-700 dark:text-rose-300">
                      Log out of all Devices
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      Sign out from all active sessions
                    </div>
                  </div>
                </button>

                {/* DELETE MY ACCOUNT */}
                <div className="border-t border-slate-100 dark:border-slate-800 bg-rose-50/40 dark:bg-rose-950/20 rounded-b-xl">
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm((v) => !v)}
                    className="
                    w-full
                    flex items-start gap-3
                    px-4 py-3
                    text-left
                    hover:bg-rose-100/60 dark:hover:bg-rose-950/40
                    transition
                  "
                  >
                    <FiTrash2 className="text-rose-600 mt-0.5 shrink-0" />
                    <div>
                      <div className="text-xs font-bold text-rose-700 dark:text-rose-300">
                        Delete my account
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        Deactivate and delete account
                      </div>
                    </div>
                  </button>

                  {showDeleteConfirm && (
                    <div className="p-3 mx-3 mb-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-xl space-y-2">
                      <div className="flex items-start gap-2 text-xs font-semibold text-rose-900 dark:text-rose-200">
                        <FiAlertTriangle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                        <span>
                          Are you sure you want to delete your account? This will deactivate your access.
                        </span>
                      </div>

                      <textarea
                        value={deleteReason}
                        onChange={(e) => setDeleteReason(e.target.value)}
                        disabled={isDeleting}
                        maxLength={300}
                        rows={2}
                        placeholder="Reason for leaving (optional)"
                        className="w-full resize-none rounded-lg border border-rose-200 dark:border-rose-800 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-rose-500"
                      />

                      {deleteError && (
                        <p className="text-[11px] text-rose-700 dark:text-rose-300">{deleteError}</p>
                      )}

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={handleDeleteAccount}
                          disabled={isDeleting}
                          className="flex-1 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow-xs transition disabled:opacity-50"
                        >
                          {isDeleting ? "Deleting..." : "Yes, Delete Account"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowDeleteConfirm(false);
                            setDeleteReason("");
                            setDeleteError(null);
                          }}
                          disabled={isDeleting}
                          className="px-3 py-1.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-medium rounded-lg transition"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>

              </div>
            )}
          </div>

        </div>

      </Dropdown>
      
    </div>
  );

  // ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
}

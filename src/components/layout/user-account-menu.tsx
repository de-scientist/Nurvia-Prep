"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeftRight,
  CheckCircle2,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Settings,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import { useAuth } from "@/components/auth/auth-provider";
import { UserAvatar } from "@/components/shared/avatar/UserAvatar";
import { feedback } from "@/lib/feedback/feedback-context";

interface UserAccountMenuProps {
  avatarUrl: string | null;
}

export function UserAccountMenu({ avatarUrl }: UserAccountMenuProps) {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [open, setOpen] = React.useState(false);
  const [signingOut, setSigningOut] = React.useState(false);
  const [signOutError, setSignOutError] = React.useState<string | null>(null);
  const [resendingEmail, setResendingEmail] = React.useState(false);
  const [emailSent, setEmailSent] = React.useState(false);
  const menuId = React.useId();

  const rootRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const firstLinkRef = React.useRef<HTMLAnchorElement>(null);

  const normalizedRole = (user?.role ?? "").trim().toLowerCase();
  const isSuperadmin = normalizedRole === "superadmin";
  const isLearner = normalizedRole === "learner";
  const canUseLearnerAccount = isLearner || isSuperadmin;

  const canAccessAdmin = Boolean(
    user &&
      ["author", "reviewer", "publisher", "administrator", "superadmin", "staff"].includes(
        normalizedRole
      )
  );

  React.useEffect(() => {
    setOpen(false);
    setSignOutError(null);
  }, [pathname]);

  React.useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (
        rootRef.current &&
        !rootRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }

      if (
        event.key === "ArrowDown" ||
        event.key === "ArrowUp" ||
        event.key === "Home" ||
        event.key === "End"
      ) {
        const items = Array.from(
          rootRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? []
        );
        if (items.length === 0) return;
        event.preventDefault();

        const currentIndex = items.indexOf(document.activeElement as HTMLElement);
        if (event.key === "Home") {
          items[0]?.focus();
        } else if (event.key === "End") {
          items[items.length - 1]?.focus();
        } else if (event.key === "ArrowDown") {
          const next = currentIndex >= 0 ? (currentIndex + 1) % items.length : 0;
          items[next]?.focus();
        } else {
          const prev = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
          items[prev]?.focus();
        }
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    const frame = requestAnimationFrame(() => {
      if (firstLinkRef.current) {
        firstLinkRef.current.focus();
      } else {
        const firstItem = rootRef.current?.querySelector<HTMLElement>('[role="menuitem"]');
        firstItem?.focus();
      }
    });

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      cancelAnimationFrame(frame);
    };
  }, [open]);

  const closeMenu = () => {
    setOpen(false);
    setSignOutError(null);
  };

  const handleResendVerification = async () => {
    if (resendingEmail || emailSent) return;
    setResendingEmail(true);

    try {
      const res = await fetch("/api/auth/support/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user?.email, action: "resend-verification" }),
      });

      if (res.ok) {
        setEmailSent(true);
        feedback.success(
          `Verification email dispatched to ${user?.email || "your inbox"}. Please check your messages.`,
          "Verification Email Sent"
        );
      } else {
        const data = await res.json().catch(() => ({}));
        feedback.fromHttp(res.status, data.message || data.error);
      }
    } catch {
      feedback.error("Unable to send verification email. Please try again later.");
    } finally {
      setResendingEmail(false);
    }
  };

  const handleSignOut = async () => {
    if (signingOut) return;

    setSigningOut(true);
    setSignOutError(null);

    try {
      const response = await signOut();

      if (!response.success) {
        setSignOutError(
          response.message || "Unable to sign out. Please try again."
        );
        setSigningOut(false);
        return;
      }

      setOpen(false);
      router.replace("/");
    } catch {
      setSignOutError("Unable to sign out. Please try again.");
      setSigningOut(false);
    }
  };

  const handleMenuItemKeyDown = (event: React.KeyboardEvent<HTMLAnchorElement>) => {
    if (event.key === " ") {
      event.preventDefault();
      event.currentTarget.click();
    }
  };

  const linkClass =
    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label="Open account menu"
        aria-haspopup="menu"
        aria-controls={open ? menuId : undefined}
        aria-expanded={open}
        onClick={() => {
          setOpen((current) => !current);
          setSignOutError(null);
        }}
        className="flex items-center gap-2 rounded-full border border-border bg-background p-1.5 pr-3 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <UserAvatar name={user?.name} avatarUrl={avatarUrl} size="sm" />
        <span className="hidden max-w-36 truncate text-left text-xs font-semibold sm:block">
          {user?.name || "My Account"}
        </span>
        <ChevronDown
          size={15}
          className={`text-muted-foreground transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label="Account options"
          className="absolute right-0 z-[100] mt-3 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-2xl"
        >
          <div className="border-b border-border bg-muted/40 p-4">
            <div className="flex min-w-0 items-start gap-3">
              <UserAvatar name={user?.name} avatarUrl={avatarUrl} size="lg" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {user?.name || "Account"}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {user?.email}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                    {user?.role || "Learner"}
                  </span>
                  {user?.emailVerified ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      <CheckCircle2 size={10} /> Verified
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400 border border-amber-500/20">
                      <AlertCircle size={10} /> Unverified
                    </span>
                  )}
                </div>
                {!user?.emailVerified && (
                  <button
                    type="button"
                    onClick={handleResendVerification}
                    disabled={resendingEmail || emailSent}
                    className="mt-1.5 text-[11px] font-medium text-brand-teal hover:underline disabled:opacity-50 transition-opacity block text-left"
                  >
                    {resendingEmail
                      ? "Sending..."
                      : emailSent
                      ? "✓ Verification link sent"
                      : "Resend verification email"}
                  </button>
                )}
              </div>
            </div>
          </div>

          {isSuperadmin && (
            <div className="p-2 border-b border-border bg-primary/5">
              {pathname?.startsWith("/admin") ? (
                <Link
                  role="menuitem"
                  href="/learner"
                  onClick={closeMenu}
                  onKeyDown={handleMenuItemKeyDown}
                  className="flex w-full items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/20"
                >
                  <ArrowLeftRight size={14} />
                  Switch to Learner Dashboard
                </Link>
              ) : (
                <Link
                  role="menuitem"
                  href="/admin"
                  onClick={closeMenu}
                  onKeyDown={handleMenuItemKeyDown}
                  className="flex w-full items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/20"
                >
                  <ArrowLeftRight size={14} />
                  Switch to Superadmin Console
                </Link>
              )}
            </div>
          )}

          <div className="space-y-1 p-2">
            {canUseLearnerAccount && (
              <>
                <Link
                  ref={firstLinkRef}
                  role="menuitem"
                  href="/learner/account"
                  onClick={closeMenu}
                  onKeyDown={handleMenuItemKeyDown}
                  className={linkClass}
                >
                  <UserRound size={16} />
                  My Account
                </Link>

                <Link
                  role="menuitem"
                  href="/learner/profile"
                  onClick={closeMenu}
                  onKeyDown={handleMenuItemKeyDown}
                  className={linkClass}
                >
                  <UserRound size={16} />
                  Profile
                </Link>

                <Link
                  role="menuitem"
                  href="/learner/settings"
                  onClick={closeMenu}
                  onKeyDown={handleMenuItemKeyDown}
                  className={linkClass}
                >
                  <Settings size={16} />
                  Settings
                </Link>

                <Link
                  role="menuitem"
                  href="/learner/settings/security"
                  onClick={closeMenu}
                  onKeyDown={handleMenuItemKeyDown}
                  className={linkClass}
                >
                  <ShieldCheck size={16} />
                  Security Settings
                </Link>
              </>
            )}

            {canAccessAdmin && !canUseLearnerAccount && (
              <Link
                ref={firstLinkRef}
                role="menuitem"
                href="/admin/settings"
                onClick={closeMenu}
                onKeyDown={handleMenuItemKeyDown}
                className={linkClass}
              >
                <Settings size={16} />
                Admin Settings
              </Link>
            )}

            {canAccessAdmin && (
              <Link
                role="menuitem"
                href="/admin"
                onClick={closeMenu}
                onKeyDown={handleMenuItemKeyDown}
                className={linkClass}
              >
                <LayoutDashboard size={16} />
                Admin Dashboard
              </Link>
            )}

            {isSuperadmin && (
              <Link
                role="menuitem"
                href="/learner"
                onClick={closeMenu}
                onKeyDown={handleMenuItemKeyDown}
                className={linkClass}
              >
                <LayoutDashboard size={16} />
                Learner Dashboard
              </Link>
            )}
          </div>

          <div className="border-t border-border p-2">
            {signOutError && (
              <p role="alert" className="px-3 py-2 text-xs text-destructive">
                {signOutError}
              </p>
            )}

            <button
              type="button"
              role="menuitem"
              disabled={signingOut}
              onClick={handleSignOut}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <LogOut size={16} />
              {signingOut ? "Signing out..." : "Sign Out"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";
import { FiLogIn, FiLock, FiArrowLeft, FiSmartphone, FiCheckCircle, FiCopy } from "react-icons/fi";
import { useFlexPageClasp } from "@/lib/contexts/panel/layout/utils/FlexPageClasp";
import { useCurrentSystemUser } from "@/lib/hooks/users/account/current/useCurrentSystemUser";
import { start2faSetup, confirm2faSetup, disable2fa } from "@/lib/services/auth/supportService";

const CURRENT_PANEL = "lpn-nursing";

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
export default function TwoFactorAuthPage() {
  const { leftWidth, rightWidth, navHeight } = useFlexPageClasp();
  const { user, loading } = useCurrentSystemUser();

  // Local wizard state — step 1: generate secret/QR, step 2: confirm code
  const [step, setStep] = useState<"idle" | "setup" | "confirm">("idle");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const [secret, setSecret] = useState<string>("");
  const [qrCodeUrl, setQrCodeUrl] = useState<string | undefined>(undefined);

  const handleStartSetup = async () => {
    if (!user) {
      setMessage({ text: "You need to be signed in to manage two-factor authentication.", ok: false });
      return;
    }
    setMessage(null);
    setBusy(true);
    try {
      const result = await start2faSetup(user.guidId, user.email);
      if (result?.error) throw new Error(result.error);
      const data = result?.data as { secret: string; qrCodeUrl?: string } | undefined;
      setSecret(data?.secret ?? "");
      setQrCodeUrl(data?.qrCodeUrl);
      setStep("setup");
    } catch (err) {
      console.error("❌ [TwoFactorAuthPage] Failed to start 2FA setup:", err);
      setMessage({ text: err instanceof Error ? err.message : "Failed to start 2FA setup.", ok: false });
    } finally {
      setBusy(false);
    }
  };

  const handleConfirm = async () => {
    if (!user) {
      setMessage({ text: "You need to be signed in to manage two-factor authentication.", ok: false });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const result = await confirm2faSetup(user.guidId, code);
      if (result?.error) throw new Error(result.error);
      setMessage({ text: result?.message ?? "Two-factor authentication enabled.", ok: true });
      setStep("idle");
      setCode("");
    } catch (err) {
      console.error("❌ [TwoFactorAuthPage] Failed to confirm 2FA:", err);
      setMessage({ text: err instanceof Error ? err.message : "Invalid code.", ok: false });
    } finally {
      setBusy(false);
    }
  };

  const handleDisable = async () => {
    if (!user) {
      setMessage({ text: "You need to be signed in to manage two-factor authentication.", ok: false });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const result = await disable2fa(user.guidId);
      if (result?.error) throw new Error(result.error);
      setMessage({ text: result?.message ?? "Two-factor authentication disabled.", ok: true });
    } catch (err) {
      console.error("❌ [TwoFactorAuthPage] Failed to disable 2FA:", err);
      setMessage({ text: err instanceof Error ? err.message : "Failed to disable 2FA.", ok: false });
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <main
        className="pt-16 flex items-center justify-center"
        style={{ marginLeft: leftWidth, marginRight: rightWidth, minHeight: `calc(100vh - ${navHeight}px)` }}
      >
        <p className="text-sm font-bold opacity-60 text-[var(--text-color)]">Loading . . . ⚓</p>
      </main>
    );
  }

   if (!user) {
    return (
      <main className="min-h-[70vh] flex items-center justify-center px-4 py-10 bg-slate-50 dark:bg-[#0B1220]">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111C2E] shadow-xl px-6 py-8 text-center">

          {/* Icon */}
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0D9488]/10 border border-[#0D9488]/20">
            <FiLock className="h-6 w-6 text-[#0D9488]" />
          </div>

          {/* Heading */}
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            Sign In Required
          </h2>

          {/* Message */}
          <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            You must be logged in to access your security settings.
            Please sign in to manage Two-Factor Authentication.
          </p>

          {/* Button */}
          <Link
            href={`/dashboards/${CURRENT_PANEL}/auth/login`}
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-[#142B4A] hover:bg-[#0D9488] px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors"
          >
            <FiLogIn className="h-4 w-4" />
            Log In to Continue
          </Link>
        </div>
      </main>
    );
  }

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
      <div className="p-3 md:p-4 space-y-5 w-full max-w-5xl mx-auto">
        <Link
          href={`/dashboards/${CURRENT_PANEL}/auth/account/security/profile`}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-[#0D9488] transition-colors"
        >
          <FiArrowLeft className="w-3.5 h-3.5" />
          Back to My Security Profile
        </Link>

        {/* Current user info */}
        <div className="rounded-2xl border border-slate-200/20 bg-gradient-to-br from-[#142B4A] via-[#0F2036] to-[#0D9488] px-6 py-5 flex items-center justify-center text-white shadow-md">
          <div className="text-center">
            <h1 className="text-lg font-bold flex items-center justify-center gap-2">
              <FiSmartphone className="w-4 h-4 text-[#2DD4BF]" />
              Two-Factor Authentication
            </h1>

            <p className="text-sm text-slate-200/85 mt-0.5">
              {user.userName} · {user.email}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111C2E] p-5 space-y-2 shadow-xs">
          <InfoRow label="Two-Factor Authentication Status" value={user.twoFactorEnabled ? "Enabled" : "Disabled"} />
          <InfoRow
            label="Backup Codes"
            value={`${user.backupCodes?.filter((b) => !b.isUsed).length ?? 0} of ${user.backupCodes?.length ?? 0} unused`}
          />
        </div>


        {message && (
          <p className={`text-xs text-center font-semibold ${message.ok ? "text-[#0D9488]" : "text-rose-600"}`}>
            {message.text}
          </p>
        )}
        {/* ─────────────────────────────────────────────────────────────────────── */}
        {user.twoFactorEnabled ? (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111C2E] p-5 space-y-3 flex flex-col items-center text-center shadow-xs">
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Two-factor authentication is currently protecting your account.
              Disabling it will remove this extra layer of security.
            </p>

            <button
              onClick={handleDisable}
              disabled={busy}
              className="px-5 py-2.5 rounded-xl font-semibold text-sm bg-rose-600 hover:bg-rose-700 text-white shadow-sm transition-colors disabled:opacity-50"
            >
              {busy ? "Disabling…" : "Disable 2FA"}
            </button>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 text-center bg-white dark:bg-[#111C2E] p-5 space-y-4 flex flex-col items-center shadow-xs">
            {step === "idle" && (
              <>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Add an extra layer of security by requiring a verification code
                  from your authenticator app at login.
                </p>

                <button
                  onClick={handleStartSetup}
                  className="px-5 py-2.5 rounded-xl font-semibold text-sm bg-[#142B4A] hover:bg-[#0D9488] text-white shadow-sm transition-colors"
                >
                  Set Up 2FA
                </button>
              </>
            )}

            {step === "setup" && (
              <>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Scan this into your authenticator app (Google Authenticator,
                  Authy, etc.), or enter the code manually.
                </p>

                {qrCodeUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={
                      qrCodeUrl.startsWith("data:")
                        ? qrCodeUrl
                        : `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrCodeUrl)}`
                    }
                    alt="2FA QR Code"
                    width={144}
                    height={144}
                    className="block mx-auto rounded-xl border border-slate-200 dark:border-slate-700"
                  />
                ) : (
                  <div className="w-36 h-36 mx-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-[10px] text-slate-500">
                    QR Code Unavailable
                  </div>
                )}

                <div className="flex items-center justify-center gap-2">
                  <code className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-mono text-slate-800 dark:text-slate-200">
                    {secret}
                  </code>

                  <button
                    onClick={() => navigator.clipboard.writeText(secret)}
                    className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-[#0D9488] transition"
                    title="Copy secret"
                  >
                    <FiCopy className="w-3.5 h-3.5" />
                  </button>
                </div>

                <button
                  onClick={() => setStep("confirm")}
                  className="px-5 py-2.5 rounded-xl font-semibold text-xs bg-[#142B4A] hover:bg-[#0D9488] text-white transition-colors"
                >
                  I&apos;ve Added It — Continue
                </button>
              </>
            )}

            {step === "confirm" && (
              <>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Enter the 6-digit code from your authenticator app to confirm setup.
                </p>

                <input
                  type="text"
                  maxLength={88}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  onPaste={(e) => {
                    e.preventDefault();
                    const pasted = e.clipboardData.getData("text").trim();
                    setCode(pasted.slice(0, 88));
                  }}
                  placeholder="········"
                  className="w-full max-w-xs text-center tracking-[0.5em] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-lg font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/20"
                />

                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={handleConfirm}
                    disabled={busy || code.length < 4}
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm bg-[#142B4A] hover:bg-[#0D9488] text-white shadow-sm transition-colors disabled:opacity-50"
                  >
                    <FiCheckCircle className="w-4 h-4" />
                    {busy ? "Confirming…" : "Submit, Confirm & Enable"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

      </div>
    </main>
  );
}

// ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// The End By : B.L.S.M.C ;  -  SkewBlanc - The Winds Chase Us ⚓
// ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
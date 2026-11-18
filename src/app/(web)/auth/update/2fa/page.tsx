"use client";

import Link from "next/link";
import { useState } from "react";
import { FiLogIn, FiLock, FiSmartphone, FiCheckCircle, FiCopy } from "react-icons/fi";
import { useCurrentSystemUser } from "@/lib/hooks/users/account/current/useCurrentSystemUser";
import { start2faSetup, confirm2faSetup, disable2fa } from "@/lib/services/auth/supportService";

const CURRENT_PANEL = "ati-teas";

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
      >
        <p className="text-sm font-bold opacity-60 text-[var(--text-color)]">Loading . . . ⚓</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-[75vh] flex items-center justify-center px-4 py-12 bg-[#F8FAFC] dark:bg-[#0B1220]">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111C2E] shadow-lg px-6 py-8 text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#142B4A]/10 dark:bg-white/10 border border-[#0D9488]/20">
            <FiLock className="h-6 w-6 text-[#0D9488]" />
          </div>
          <h2 className="text-xl font-bold text-[#0F172A] dark:text-white">
            Sign In Required
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            You must be logged in to access your security settings.
            Please sign in to manage two-factor authentication.
          </p>
          <Link
            href={`/dashboards/${CURRENT_PANEL}/auth/login`}
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-[#142B4A] hover:bg-[#1E3A5F] px-6 py-3 text-sm font-semibold text-white shadow-sm transition"
          >
            <FiLogIn className="h-4 w-4" />
            Sign In to Continue
          </Link>
          <p className="mt-4 text-[11px] text-slate-400">
            Two-factor authentication settings are available only to signed-in users.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="py-12 min-h-[75vh] bg-[#F8FAFC] dark:bg-[#0B1220]">
      <div className="px-4 sm:px-6 lg:px-8 space-y-5 w-full max-w-3xl mx-auto">

        {/* Current user info */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111C2E] px-6 py-6 text-center shadow-xs">
          <h1 className="text-xl font-bold text-[#0F172A] dark:text-white flex items-center justify-center gap-2">
            <FiSmartphone className="w-5 h-5 text-[#0D9488]" />
            Two-Factor Authentication
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {user.userName} · {user.email}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111C2E] p-5 space-y-3 shadow-xs">
          <InfoRow label="Two-Factor Authentication Status" value={user.twoFactorEnabled ? "Enabled" : "Disabled"} />
          <InfoRow
            label="Backup Codes"
            value={`${user.backupCodes?.filter((b) => !b.isUsed).length ?? 0} of ${user.backupCodes?.length ?? 0} unused`}
          />
        </div>

        {message && (
          <p className={`text-xs text-center font-semibold ${message.ok ? "text-emerald-600" : "text-rose-600"}`}>
            {message.text}
          </p>
        )}

        {user.twoFactorEnabled ? (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111C2E] p-6 space-y-4 flex flex-col items-center text-center shadow-xs">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Two-factor authentication is currently protecting your account.
              Disabling it will remove this extra layer of security.
            </p>

            <button
              onClick={handleDisable}
              disabled={busy}
              className="px-5 py-2.5 rounded-xl font-semibold text-sm bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition disabled:opacity-50"
            >
              {busy ? "Disabling…" : "Disable 2FA"}
            </button>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 text-center bg-white dark:bg-[#111C2E] p-6 space-y-4 flex flex-col items-center shadow-xs">
            {step === "idle" && (
              <>
                <p className="text-sm text-slate-600 dark:text-slate-300 max-w-md">
                  Add an extra layer of security by requiring a verification code
                  from your authenticator app at login.
                </p>

                <button
                  onClick={handleStartSetup}
                  className="px-6 py-2.5 rounded-xl font-semibold text-sm bg-[#142B4A] hover:bg-[#0D9488] text-white shadow-xs transition"
                >
                  Set Up 2FA
                </button>
              </>
            )}

            {step === "setup" && (
              <>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Scan this QR code into your authenticator app (Google Authenticator,
                  Authy, etc.), or enter the key manually.
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
                  <div className="w-36 h-36 mx-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex items-center justify-center text-xs text-slate-400">
                    QR Code Unavailable
                  </div>
                )}

                <div className="flex items-center justify-center gap-2">
                  <code className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-mono text-[#0F172A] dark:text-white">
                    {secret}
                  </code>

                  <button
                    onClick={() => navigator.clipboard.writeText(secret)}
                    className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition"
                    title="Copy secret"
                  >
                    <FiCopy className="w-3.5 h-3.5" />
                  </button>
                </div>

                <button
                  onClick={() => setStep("confirm")}
                  className="px-5 py-2.5 rounded-xl font-semibold text-xs bg-[#0D9488] hover:bg-[#0F766E] text-white transition"
                >
                  I&apos;ve Added It — Continue
                </button>
              </>
            )}

            {step === "confirm" && (
              <>
                <p className="text-sm text-slate-600 dark:text-slate-300">
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
                  className="w-full max-w-xs text-center tracking-[0.5em] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-lg font-mono text-[#0F172A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30"
                />

                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={handleConfirm}
                    disabled={busy || code.length < 4}
                    className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm bg-[#142B4A] hover:bg-[#0D9488] text-white shadow-xs transition disabled:opacity-50"
                  >
                    <FiCheckCircle className="w-4 h-4" />
                    {busy ? "Confirming…" : "Confirm & Enable"}
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
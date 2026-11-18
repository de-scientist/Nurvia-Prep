"use client";

import Link from "next/link";
import { useState } from "react";
import { FiLogIn, FiArrowLeft, FiLock, FiEye, FiEyeOff, FiCheckCircle } from "react-icons/fi";
import { useFlexPageClasp } from "@/lib/contexts/panel/layout/utils/FlexPageClasp";
import { useCurrentSystemUser } from "@/lib/hooks/users/account/current/useCurrentSystemUser";
import { changeCurrentUserPassword, changeCurrentUserPin } from "@/lib/services/auth/supportService";

const TARGET_PROGRAM = "nclex-pn";

function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <label className="block">
      <span className="text-[10px] uppercase font-bold opacity-50 tracking-wide text-[var(--text-color)]">
        {label}
      </span>
      <div className="mt-1 relative">
        <input
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          className="w-full rounded-lg border border-[var(--text-color)]/20 bg-[var(--content-bg)] px-3 py-2 pr-9 text-sm text-[var(--text-color)] focus:outline-none focus:ring-2 focus:ring-indigo-400/50"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-color)] opacity-50 hover:opacity-100 transition"
          tabIndex={-1}
        >
          {visible ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
        </button>
      </div>
    </label>
  );
}

// A lightweight, non-prescriptive strength hint — not a hard gate, just guidance.
function getStrength(password: string): { label: string; percent: number; tone: string } {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { label: "Weak", percent: 20, tone: "bg-rose-500" };
  if (score <= 3) return { label: "Fair", percent: 55, tone: "bg-yellow-500" };
  return { label: "Strong", percent: 100, tone: "bg-emerald-500" };
}

function PinField({
  label,
  value,
  onChange,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <label className="block">
      <span className="text-[10px] uppercase font-bold opacity-50 tracking-wide text-[var(--text-color)]">
        {label}
      </span>
      <div className="mt-1 relative">
        <input
          type={visible ? "text" : "password"}
          inputMode="numeric"
          maxLength={24}
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
          autoComplete={autoComplete}
          className="w-full rounded-lg border border-[var(--text-color)]/20 bg-[var(--content-bg)] px-3 py-2 pr-9 text-sm tracking-[0.3em] text-[var(--text-color)] focus:outline-none focus:ring-2 focus:ring-indigo-400/50"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-color)] opacity-50 hover:opacity-100 transition"
          tabIndex={-1}
        >
          {visible ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
        </button>
      </div>
    </label>
  );
}

// ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export default function ChangePasswordPage() {
  const { leftWidth, rightWidth, navHeight } = useFlexPageClasp();
  const { user, loading } = useCurrentSystemUser();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const [showAdvanced, setShowAdvanced] = useState(false);

  const [currentPin, setCurrentPin] = useState(""); const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinBusy, setPinBusy] = useState(false);
  const [pinMessage, setPinMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const strength = getStrength(newPassword);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const canSubmitPassword =
    currentPassword.length > 0 && newPassword.length >= 8 && passwordsMatch && !passwordBusy;

  const pinsMatch = newPin.length > 0 && newPin === confirmPin;
  const canSubmitPin = newPin.length >= 4 && pinsMatch && !pinBusy;

  const handlePasswordSubmit = async () => {
    if (!canSubmitPassword) return;
    if (!user) {
      setPasswordMessage({ text: "You need to be signed in to change your password.", ok: false });
      return;
    }
    setPasswordBusy(true);
    setPasswordMessage(null);
    try {
      const result = await changeCurrentUserPassword({ userGuidId: user.guidId, currentPassword, newPassword });
      if (result?.error) throw new Error(result.error);
      setPasswordMessage({ text: result?.message ?? "Password changed successfully.", ok: true });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      console.error("❌ [ChangePasswordPage] Failed to change password:", err);
      setPasswordMessage({ text: err instanceof Error ? err.message : "Failed to change password.", ok: false });
    } finally {
      setPasswordBusy(false);
    }
  };

  const handlePinSubmit = async () => {
    if (!canSubmitPin) return;
    if (!user) {
      setPinMessage({ text: "You need to be signed in to change your PIN.", ok: false });
      return;
    }
    setPinBusy(true);
    setPinMessage(null);
    try {
      const result = await changeCurrentUserPin({
        userGuidId: user.guidId,
        currentPin: currentPin || undefined,
        newPin,
      });
      if (result?.error) throw new Error(result.error);
      setPinMessage({ text: result?.message ?? "PIN changed successfully.", ok: true });
      setCurrentPin("");
      setNewPin("");
      setConfirmPin("");
    } catch (err) {
      console.error("❌ [ChangePasswordPage] Failed to change PIN:", err);
      setPinMessage({ text: err instanceof Error ? err.message : "Failed to change PIN.", ok: false });
    } finally {
      setPinBusy(false);
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
            Please sign in to update your password or PIN.
          </p>

          {/* Button */}
          <Link
            href={`/dashboards/${TARGET_PROGRAM}/auth/login`}
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
      className="pt-16 flex flex-col items-center justify-center gap-4 text-center px-4"
      style={{ marginLeft: leftWidth, marginRight: rightWidth, minHeight: `calc(100vh - ${navHeight}px)` }}>

      <div className="p-3 md:p-4 space-y-5 w-full max-w-2xl mx-auto text-left">

        <Link
          href={`/dashboards/${TARGET_PROGRAM}/auth/account/security/profile`}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-[#0D9488] transition-colors"
        >
          <FiArrowLeft className="w-3.5 h-3.5" />
          Back to My Security Profile
        </Link>

        {/* Current user info */}
        <div className="rounded-2xl border border-slate-200/20 bg-gradient-to-br from-[#142B4A] via-[#0F2036] to-[#0D9488] px-6 py-5 flex flex-col items-center text-center gap-1.5 text-white shadow-md">
          <h1 className="text-lg font-bold flex items-center gap-2">
            <FiLock className="w-4 h-4 text-[#2DD4BF]" />
            Update Password &amp; PIN
          </h1>
          <p className="text-sm text-slate-200/85">{user.userName} · {user.email}</p>
        </div>

        {/* ─────────────────────────────────────────────────────────────────────── */}
        <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
          Update your password or PIN, or both — each is saved independently.
        </p>

        <div className={`grid grid-cols-1 ${showAdvanced ? "md:grid-cols-2" : "max-w-md mx-auto w-full"} gap-4`}>

          {/* Password card */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111C2E] p-5 space-y-4 shadow-xs">

            {passwordMessage && (
              <p className={`text-xs text-center font-semibold ${passwordMessage.ok ? "text-[#0D9488]" : "text-rose-600"}`}>
                {passwordMessage.text}
              </p>
            )}

            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <FiLock className="w-4 h-4 text-[#0D9488]" />
              Password
            </h2>

            <PasswordField
              label="Current Password"
              value={currentPassword}
              onChange={setCurrentPassword}
              autoComplete="current-password"
            />
            <PasswordField
              label="New Password"
              value={newPassword}
              onChange={setNewPassword}
              autoComplete="new-password"
            />

            {newPassword.length > 0 && (
              <div>
                <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full ${strength.tone} transition-all duration-300`}
                    style={{ width: `${strength.percent}%` }}
                  />
                </div>
                <p className="text-xs mt-1.5 text-slate-600 dark:text-slate-400 leading-relaxed">
                  Strength: <strong>{strength.label}</strong>
                  <br />
                  <span className="text-[11px] opacity-80">
                    Use 8+ characters with a mix of case, numbers, and symbols.
                  </span>
                </p>
              </div>
            )}

            <PasswordField
              label="Confirm New Password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              autoComplete="new-password"
            />
            {confirmPassword.length > 0 && !passwordsMatch && (
              <p className="text-xs font-semibold text-rose-600">Passwords do not match.</p>
            )}

            <button
              onClick={handlePasswordSubmit}
              disabled={!canSubmitPassword}
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm bg-[#142B4A] hover:bg-[#0D9488] text-white shadow-sm transition-colors disabled:opacity-50"
            >
              <FiCheckCircle className="w-4 h-4" />
              {passwordBusy ? "Updating…" : "Submit & Update Password"}
            </button>

          </div>

          {/* PIN card (advanced) */}
          {showAdvanced && (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111C2E] p-5 space-y-4 shadow-xs">

              {pinMessage && (
                <p className={`text-xs text-center font-semibold ${pinMessage.ok ? "text-[#0D9488]" : "text-rose-600"}`}>
                  {pinMessage.text}
                </p>
              )}

              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <FiLock className="w-4 h-4 text-[#0D9488]" />
                PIN
              </h2>

              <PinField
                label="Current PIN (leave blank if none set)"
                value={currentPin}
                onChange={setCurrentPin}
                autoComplete="off"
              />
              <PinField
                label="New PIN"
                value={newPin}
                onChange={setNewPin}
                autoComplete="off"
              />
              <PinField
                label="Confirm New PIN"
                value={confirmPin}
                onChange={setConfirmPin}
                autoComplete="off"
              />
              {confirmPin.length > 0 && !pinsMatch && (
                <p className="text-xs font-semibold text-rose-600">PINs do not match.</p>
              )}
              {newPin.length > 0 && newPin.length < 4 && (
                <p className="text-xs font-semibold text-rose-600">PIN must be at least 4 digits.</p>
              )}

              <button
                onClick={handlePinSubmit}
                disabled={!canSubmitPin}
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm bg-[#142B4A] hover:bg-[#0D9488] text-white shadow-sm transition-colors disabled:opacity-50"
              >
                <FiCheckCircle className="w-4 h-4" />
                {pinBusy ? "Updating…" : "Update PIN"}
              </button>

            </div>
          )}

        </div>
        {/* Links */}
        <div className="mt-4 flex flex-row gap-3 w-full">
          <Link
            href={`/dashboards/${TARGET_PROGRAM}/auth/login`}
            className="flex-1 text-center bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold py-2.5 px-4 rounded-xl hover:border-[#0D9488] hover:text-[#0D9488] transition-colors"
          >
            Sign In Instead
          </Link>
          <Link
            href={`/dashboards/${TARGET_PROGRAM}/auth/register`}
            className="flex-1 text-center bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold py-2.5 px-4 rounded-xl hover:border-[#0D9488] hover:text-[#0D9488] transition-colors"
          >
            Create Account
          </Link>
        </div>

        <div className="mt-2 flex flex-row gap-3 w-full">
          <Link
            href={`/dashboards/${TARGET_PROGRAM}/auth/account/recovery/password`}
            className="flex-1 text-center bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold py-2.5 px-4 rounded-xl hover:border-[#0D9488] hover:text-[#0D9488] transition-colors"
          >
            Forgot Password?
          </Link>
          <Link
            href={`/dashboards/${TARGET_PROGRAM}/auth/account/support`}
            className="flex-1 text-center bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold py-2.5 px-4 rounded-xl hover:border-[#0D9488] hover:text-[#0D9488] transition-colors"
          >
            Having Issues?
          </Link>
        </div>


        {/* Advanced options toggle */}
        <div className="text-center">
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="text-xs font-semibold text-[#0D9488] hover:underline"
          >
            {showAdvanced ? "Hide advanced options ▲" : "Advanced options (PIN) ▼"}
          </button>
        </div>

      </div>
    </main >
  );
}

// ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// The End By : B.L.S.M.C ;  -  SkewBlanc - The Winds Chase Us ⚓
// ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
"use client";

import Link from "next/link";
import { useState } from "react";
import { FiLogIn, FiLock, FiEye, FiEyeOff, FiCheckCircle } from "react-icons/fi";
import { useCurrentSystemUser } from "@/lib/hooks/users/account/current/useCurrentSystemUser";
import { changeCurrentUserPassword, changeCurrentUserPin } from "@/lib/services/auth/supportService";

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
  const { user, loading } = useCurrentSystemUser();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
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
            Please sign in to update your password or PIN.
          </p>
          <Link
            href="/auth/login"
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-[#142B4A] hover:bg-[#1E3A5F] px-6 py-3 text-sm font-semibold text-white shadow-sm transition"
          >
            <FiLogIn className="h-4 w-4" />
            Sign In to Continue
          </Link>
          <p className="mt-4 text-[11px] text-slate-400">
            Password and PIN settings are available only to signed-in users.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="py-12 min-h-[75vh] bg-[#F8FAFC] dark:bg-[#0B1220]">
      <div className="px-4 sm:px-6 lg:px-8 space-y-5 w-full max-w-3xl mx-auto">

        {/* Current user info */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111C2E] px-6 py-6 flex flex-col items-center text-center gap-1 shadow-xs">
          <h1 className="text-xl font-bold text-[#0F172A] dark:text-white flex items-center gap-2">
            <FiLock className="w-5 h-5 text-[#0D9488]" />
            Update Password & PIN
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{user.userName} · {user.email}</p>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
          Update your password, your PIN, or both — each is saved independently.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

          {/* Password card */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111C2E] p-6 space-y-4 shadow-xs">

            {passwordMessage && (
              <p className={`text-xs text-center font-semibold ${passwordMessage.ok ? "text-emerald-600" : "text-rose-600"}`}>
                {passwordMessage.text}
              </p>
            )}

            <h2 className="text-sm font-bold text-[#0F172A] dark:text-white flex items-center gap-2">
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
                <p className="text-xs mt-1.5 text-slate-500 dark:text-slate-400">
                  Strength: {strength.label} — use 8+ characters with a mix of case, numbers, and symbols.
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
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm bg-[#142B4A] hover:bg-[#0D9488] text-white shadow-xs transition disabled:opacity-50"
            >
              <FiCheckCircle className="w-4 h-4" />
              {passwordBusy ? "Updating…" : "Update Password"}
            </button>

          </div>

          {/* PIN card */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111C2E] p-6 space-y-4 shadow-xs">

            {pinMessage && (
              <p className={`text-xs text-center font-semibold ${pinMessage.ok ? "text-emerald-600" : "text-rose-600"}`}>
                {pinMessage.text}
              </p>
            )}

            <h2 className="text-sm font-bold text-[#0F172A] dark:text-white flex items-center gap-2">
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
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm bg-[#142B4A] hover:bg-[#0D9488] text-white shadow-xs transition disabled:opacity-50"
            >
              <FiCheckCircle className="w-4 h-4" />
              {pinBusy ? "Updating…" : "Update PIN"}
            </button>

          </div>

        </div>

      </div>
    </main>
  );
}

// ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// The End By : B.L.S.M.C ;  -  SkewBlanc - The Winds Chase Us ⚓
// ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
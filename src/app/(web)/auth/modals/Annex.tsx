"use client";

import { useState } from "react";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { FiCheckCircle, FiX } from "react-icons/fi";
import { APP_NAME } from "@/lib/config/config";
import { login, LoginCredentials } from "@/lib/services/auth/loginService";

// ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

const DEFAULT_LANDING_PATH = "/pages/entrance";
const role = "Learner";

const CHALLENGE_STANDARD = "learner.login.skew8lancasto";
const CHALLENGE_CUSTOM = "custom.login.skew8lancasto";

type AnnexCredentials = LoginCredentials & { targetEmail?: string };

interface AnnexProps {
  isOpen: boolean;
  onClose: () => void;
  redirectPath?: string;
}

export default function Annex({ isOpen, onClose, redirectPath }: AnnexProps) {
  const [form, setForm] = useState({ targetEmail: "", email: "", password: "" });
  const [targetMode, setTargetMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const toggleTargetMode = () => {
    setTargetMode((prev) => !prev);
    setForm((prev) => ({ ...prev, targetEmail: "" }));
    setError("");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setSuccess("");

    try {
      const credentials: AnnexCredentials = {
        email: form.email.trim(),
        password: form.password,
        pin: "",
        loginMethod: "password",
        LoginProvider: "email",
        loginProviderPayload: "Void",
        dashboardName: "web",
        role,
        challenge: targetMode ? CHALLENGE_CUSTOM : CHALLENGE_STANDARD,
        remember: false,
        ...(targetMode ? { targetEmail: form.targetEmail.trim() } : {}),
      };

      const data = await login(credentials);

      if (data?.error) {
        setError(data.error);
        return;
      }

      setSuccess("Login Successful ! Redirecting . . . ⚓");
      setTimeout(() => {
        onClose();
        window.location.assign(redirectPath || DEFAULT_LANDING_PATH);
      }, 800);
    } catch (err: unknown) {
      console.error("Login failed:", err);
      setError(err instanceof Error ? err.message : "Login failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 backdrop-blur-xs px-4 py-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md bg-white dark:bg-[#111C2E] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 md:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-slate-800 text-slate-600 dark:text-slate-300 transition hover:border-[#0D9488] hover:text-[#0D9488]"
        >
          <FiX className="h-5 w-5" />
        </button>

        <div className="text-center mb-5">
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-xl md:text-2xl font-extrabold text-[#142B4A] dark:text-white">{APP_NAME}</h1>
            <FiCheckCircle className="text-[#0D9488] text-lg" title="Verified" />
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Sign in to continue</p>
        </div>

        {error && (
          <div role="alert" className="mb-3 relative bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 px-4 py-3 rounded-xl text-sm flex items-center gap-3">
            <span className="flex-1 leading-tight">{error}</span>
            <button type="button" onClick={() => setError("")} className="opacity-70 hover:opacity-100">✕</button>
          </div>
        )}

        {success && (
          <div role="status" className="mb-3 relative bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 px-4 py-3 rounded-xl text-sm flex items-center gap-3">
            <FiCheckCircle className="text-emerald-600 shrink-0" />
            <span className="flex-1 leading-tight">{success}</span>
            <button type="button" onClick={() => setSuccess("")} className="opacity-70 hover:opacity-100">✕</button>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          {targetMode && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">Target Email</label>
              <input
                type="email"
                name="targetEmail"
                autoComplete="off"
                required
                value={form.targetEmail}
                onChange={handleChange}
                className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl px-3.5 py-2.5 text-sm text-[#0F172A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 focus:border-[#0D9488]"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">Email Address</label>
            <input
              type="email"
              name="email"
              autoComplete="username"
              required
              value={form.email}
              onChange={handleChange}
              className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl px-3.5 py-2.5 text-sm text-[#0F172A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 focus:border-[#0D9488]"
            />
          </div>

          <div className="relative">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                autoComplete="current-password"
                required
                value={form.password}
                onChange={handleChange}
                maxLength={32}
                className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl px-3.5 py-2.5 pr-10 text-sm text-[#0F172A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 focus:border-[#0D9488]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute top-3 right-3 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-[#142B4A] hover:bg-[#1E3A5F] text-white py-3 rounded-xl text-sm font-semibold transition disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isLoading ? "Signing in…" : "Sign In"}
          </button>

          {/* Camouflaged toggle — preserved */}
          <div className="flex items-center justify-center pt-1">
            <button
              type="button"
              role="switch"
              aria-checked={targetMode}
              aria-label="Option"
              onClick={toggleTargetMode}
              className="group flex items-center justify-center opacity-90 transition-opacity hover:opacity-100 focus:opacity-100"
            >
              <span
                className={`relative inline-flex h-3 w-10 items-center rounded-full transition-colors duration-200 ${
                  targetMode ? "bg-[#0D9488]" : "bg-slate-300 dark:bg-slate-700"
                }`}
              >
                <span
                  className={`inline-block h-2 w-2 rounded-full bg-white shadow transition-transform duration-200 ${
                    targetMode ? "translate-x-7" : "translate-x-1"
                  }`}
                />
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
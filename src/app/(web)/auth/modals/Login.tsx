"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FcGoogle } from "react-icons/fc";
import {
  FaEye,
  FaEyeSlash,
} from "react-icons/fa";
import { FiCheckCircle, FiX } from "react-icons/fi";
import { APP_NAME } from "@/lib/config/config";
import { login, LoginCredentials } from "@/lib/services/auth/loginService";
import { redirectToSocialProvider } from "@/lib/services/auth/socialService";

// ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

const DEFAULT_LANDING_PATH = "/pages/entrance";
const role = "Learner";

// ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchToRegister: () => void;
  initialEmail?: string;
  initialMessage?: string;
  redirectPath?: string;
}

export default function LoginModal({
  isOpen,
  onClose,
  onSwitchToRegister,
  initialEmail,
  initialMessage,
  redirectPath,
}: LoginModalProps) {
  const router = useRouter();

  const [form, setForm] = useState({ email: "", password: "", pin: "", remember: false });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const loginMethod: "password" | "pin" = "password";

  const handleSocialClick = (provider: Parameters<typeof redirectToSocialProvider>[0]['provider']) => {
    redirectToSocialProvider({ provider, context: 'login', redirectPath: DEFAULT_LANDING_PATH }).catch((err) => {
      console.error(`Social redirect (${provider}) failed:`, err)
      setError('Could not start social sign-in. Please try again.')
    })
  }

  useEffect(() => {
    if (isOpen && initialEmail) {
      setForm((prev) => ({ ...prev, email: initialEmail }));
    }
    if (isOpen && initialMessage) {
      setSuccess(initialMessage);
    }
  }, [isOpen, initialEmail, initialMessage]);

  // check for a social login error cookie when the modal opens
  useEffect(() => {
    if (!isOpen) return;
    const match = document.cookie.match(/(?:^|; )socialError=([^;]*)/);
    if (match) {
      setError(decodeURIComponent(match[1]));
      document.cookie = 'socialError=; path=/; max-age=0';
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && initialEmail) {
      setForm((prev) => ({ ...prev, email: initialEmail }));
    }
    if (isOpen && initialMessage) {
      setSuccess(initialMessage);
    }
  }, [isOpen, initialEmail, initialMessage]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const credentials: LoginCredentials =
        loginMethod === "password"
          ? {
            email: form.email,
            password: form.password,
            pin: "",
            loginMethod: "password",
            LoginProvider: "email",
            loginProviderPayload: "Void",
            dashboardName: "web",
            role,
            challenge: "learner.login.skew8lancasto",
            remember: form.remember,
          }
          : {
            email: form.email,
            password: "",
            pin: form.pin,
            loginMethod: "pin",
            LoginProvider: "email",
            loginProviderPayload: "Void",
            dashboardName: "web",
            role,
            challenge: "learner.login.skew8lancasto",
            remember: form.remember,
          };

      const data = await login(credentials);

      if (data?.error) {
        setError(data.error);
        setSuccess("");
        return;
      }

      setSuccess("Login Successful ! Redirecting . . . ⚓");
      setError("");
      setTimeout(() => {
        onClose();
        router.push(redirectPath || DEFAULT_LANDING_PATH);
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
          <div className="inline-flex items-center gap-2 rounded-full border border-[#0D9488]/25 bg-[#0D9488]/10 px-3 py-0.5 text-[11px] font-semibold text-[#0D9488] dark:text-teal-300 mb-2">
            NURVIA Learner Access
          </div>
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-xl md:text-2xl font-extrabold text-[#142B4A] dark:text-white">{APP_NAME}</h1>
            <FiCheckCircle className="text-[#0D9488] text-lg" title="Verified" />
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Sign in to continue</p>
        </div>

        <button
          type="button"
          className="w-full flex items-center justify-center gap-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 px-4 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition text-slate-700 dark:text-slate-200 font-semibold text-sm"
          onClick={() => handleSocialClick('google')}
        >
          <FcGoogle className="text-xl" />
          Continue with Google
        </button>

        <div className="text-center text-xs text-slate-400 my-3">or sign in with email</div>

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

          <div className={`relative ${loginMethod !== "password" ? "hidden" : ""}`}>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                autoComplete="current-password"
                required={loginMethod === "password"}
                value={form.password}
                onChange={handleChange}
                maxLength={32}
                className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl px-3.5 py-2.5 pr-10 text-sm text-[#0F172A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 focus:border-[#0D9488]"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute top-3 right-3 text-slate-400 hover:text-slate-600">
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300 cursor-pointer">
            <input type="checkbox" name="remember" checked={form.remember} onChange={handleChange} className="accent-[#0D9488]" />
            Remember me
          </label>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-[#142B4A] hover:bg-[#1E3A5F] text-white py-3 rounded-xl text-sm font-semibold transition disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isLoading ? "Signing in…" : "Sign In"}
          </button>

          <div className="flex flex-row gap-3 pt-2">
            <Link
              href="/auth/recovery/password"
              className="flex-1 text-center bg-[#F8FAFC] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold py-2.5 px-3 rounded-xl hover:border-[#0D9488] hover:text-[#0D9488] transition"
              onClick={onClose}
            >
              Forgot Password?
            </Link>
            <button
              type="button"
              onClick={onSwitchToRegister}
              className="flex-1 text-center bg-[#F8FAFC] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold py-2.5 px-3 rounded-xl hover:border-[#0D9488] hover:text-[#0D9488] transition"
            >
              Register Instead?
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

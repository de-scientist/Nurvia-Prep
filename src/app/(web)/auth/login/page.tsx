// SkewLine\castoline\src\app\web\(auth)\login\page.tsx
'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import 'react-phone-number-input/style.css'
import { FcGoogle } from 'react-icons/fc'
import { FaEye, FaEyeSlash } from 'react-icons/fa'
import { FiCheckCircle } from 'react-icons/fi'
import { APP_NAME } from '@/lib/config/config'
import { login, LoginCredentials } from '@/lib/services/auth/loginService' //  use your authService.ts which calls apiFetch to login - avoid direct axios calls to backend
import { useEffect } from 'react'
import Image from 'next/image'
import { session } from '@/lib/services/auth/sessionService'
import { useSearchParams } from 'next/navigation'
import { redirectToSocialProvider } from '@/lib/services/auth/socialService'

// ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

import { Suspense } from 'react'

// Extract searchParams logic into a child
function LoginSearchParamsHandler({
  onRegistered,
  onSocialError,
}: {
  onRegistered: (email: string, message: string) => void;
  onSocialError: (message: string) => void;
}) {
  const searchParams = useSearchParams();
  const justRegistered = searchParams.get('registered') === 'true';
  const registeredEmail = searchParams.get('email') ?? '';

  useEffect(() => {
    if (justRegistered && registeredEmail) {
      onRegistered(
        decodeURIComponent(registeredEmail),
        `Account created successfully ⚓ You can now log in as ${decodeURIComponent(registeredEmail)}`
      );
    }
  }, [justRegistered, registeredEmail, onRegistered]);

  useEffect(() => {
    const match = document.cookie.match(/(?:^|; )socialError=([^;]*)/);
    if (match) {
      onSocialError(decodeURIComponent(match[1]));
      // clear it so refresh/back doesn't re-show a stale error
      document.cookie = 'socialError=; path=/; max-age=0';
    }
  }, [onSocialError]);

  return null;
}

// ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

// Main Login Page User Inputs and Logic
export default function WebLoginPage() {
  const [form, setForm] = useState({
    email: '',
    password: '',
    pin: '',
    phone: '',
    remember: false,
  })

  // ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const loginMethod: "password" | "pin" = "password";

  const role = "Learner"; // hidden, fixed role
  const LANDING_PATH = "/pages/entrance"; // Landing page

  const handleSocialClick = (provider: Parameters<typeof redirectToSocialProvider>[0]['provider']) => {
    redirectToSocialProvider({ provider, context: 'login', redirectPath: LANDING_PATH }).catch((err) => {
      console.error(`Social redirect (${provider}) failed:`, err)
      setError('Could not start social sign-in. Please try again.')
    })
  }
  const handleRegisteredRedirect = useCallback((email: string, message: string) => {
    setForm(prev => ({ ...prev, email }));
    setSuccess(message);
  }, []);

  const handleSocialError = useCallback((message: string) => {
    setError(message);
  }, []);

  // Check if user is already authenticated for him to avoid login again
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  // ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  // Check if the User in Logged In
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const data = await session.check()

        // 🔹 Debug log only
        console.log("➡️ Login status check :", {
          logged_in: data.logged_in,
          // user_id: data.user_id,
          // user_email: data.user_email,
          redirect_url: data.redirect_url,
        })

        //  Only update state
        setIsAuthenticated(!!data.logged_in)
      } catch (err) {
        console.error("Session check failed:", err)
        setIsAuthenticated(false)
      }
    }

    checkAuth()
  }, []) // ❗ no router dependency

  // ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

  // Handle login submission using authService.ts
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      // Build credentials object based on selected login method
      let credentials: LoginCredentials;

      if (loginMethod === "password") {
        credentials = {
          email: form.email,
          password: form.password,
          pin: "",              // not used for password login
          loginMethod: "password",
          LoginProvider: "email",
          loginProviderPayload: "Void",
          dashboardName: "web", // hardcoded
          role: role,           // Predefined
          challenge: "learner.login.skew8lancasto",
          remember: form.remember,
        }
      } else {
        credentials = {
          email: form.email,
          password: "",         // not used for pin login
          pin: form.pin!,
          loginMethod: "pin",
          LoginProvider: "email",
          loginProviderPayload: "Void",
          dashboardName: "web", // hardcoded
          role: role,           // from dropdown
          challenge: "learner.login.skew8lancasto",
          remember: form.remember,
        }
      }

      // Call authService login function 
      const data = await login(credentials); // LoginResponse object already

      if (data?.error) {
        console.warn("⚠️ Login error (400 body):", data.error, data);
        setError(data.error)
        setSuccess('')
        return
      }

      setSuccess("Login Successful ! Redirecting . . . ⚓")
      setError('')
      setTimeout(() => {
        window.location.assign(LANDING_PATH)
      }, 800)
      return

    } catch (err: unknown) {
      console.error("Login failed:", err)
      setError(err instanceof Error ? err.message : "Login failed. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  // ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

  // Render the login form
  return (
    <div className="flex flex-col items-center justify-center bg-[#F8FAFC] dark:bg-[#0B1220] px-4 py-12 min-h-[85vh]">

      <Suspense fallback={null}>
        <LoginSearchParamsHandler onRegistered={handleRegisteredRedirect} onSocialError={handleSocialError} />
      </Suspense>

      {/* App Title / Branding */}
      <div className="flex flex-col items-center justify-center mb-6 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#0D9488]/25 bg-[#0D9488]/10 px-3.5 py-1 text-xs font-semibold text-[#0D9488] dark:text-teal-300 mb-2">
          NURVIA Learner Access
        </div>
        <div className="flex items-center justify-center gap-2">
          <span className="text-2xl md:text-3xl font-extrabold text-slate-600 dark:text-slate-300">
            Welcome to
          </span>
          <h1 className="text-2xl md:text-3xl font-extrabold text-[#142B4A] dark:text-white">
            {APP_NAME}
          </h1>
          <FiCheckCircle
            className="text-[#0D9488] text-xl md:text-2xl"
            title="Verified"
          />
        </div>

        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
          Your clinical education platform for nursing & allied-health exam preparation.
        </p>
      </div>

      {/* Login Card Container */}
      <div className="max-w-5xl w-full bg-white dark:bg-[#111C2E] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg grid grid-cols-1 md:grid-cols-2 overflow-hidden">

        {/* LEFT SIDE: Full Image Background + Text at Bottom */}
        <div className="hidden md:flex relative w-full h-full items-end justify-center overflow-hidden bg-[#142B4A]">
          {/* Background Image */}
          <Image
            src="/web/auth/login/loginFoto.jpg"
            alt="Welcome"
            layout="fill"
            objectFit="cover"
            priority
            className="z-0 opacity-85"
          />

          {/* Top Social Login Buttons Overlay DESKTOP */}
          <div className="absolute top-0 left-0 z-10 w-full p-6">
            <div className="bg-[#142B4A]/80 backdrop-blur-md border border-white/15 rounded-2xl p-4 shadow-lg">
              <p className="text-center text-teal-200 text-[11px] font-semibold tracking-wider uppercase mb-3">
                Single Sign-On
              </p>
              <button
                type="button"
                className="w-full flex items-center justify-center gap-2.5 bg-white border border-slate-200 px-4 py-2.5 rounded-xl hover:bg-slate-50 transition text-slate-800 font-semibold text-sm"
                onClick={() => handleSocialClick('google')}
              >
                <FcGoogle className="text-xl" />
                Continue with Google
              </button>
            </div>
          </div>

          {/* Bottom Text Overlay */}
          <div className="z-10 w-full p-8 bg-gradient-to-t from-[#142B4A] via-[#142B4A]/70 to-transparent text-white text-left">
            {isAuthenticated ? (
              <>
                <h2 className="text-2xl font-extrabold">Welcome Back!</h2>
                <p className="text-sm text-slate-200 mt-1.5">
                  You&apos;re already signed in. Ready to dive into {APP_NAME}?
                </p>
              </>
            ) : (
              <>
                <h2 className="text-2xl font-extrabold">Clinical Confidence Starts Here</h2>
                <p className="text-sm text-slate-200 mt-1.5">
                  Sign in to continue exploring {APP_NAME}. Structured. Evidence-Based. Reliable.
                </p>
              </>
            )}
          </div>
        </div>

        <div className="w-full p-6 md:p-8 space-y-5 border-l border-slate-200 dark:border-slate-800">

          {/* Mobile-only Social Login Buttons */}
          <div className="md:hidden">
            <button
              type="button"
              className="w-full flex items-center justify-center gap-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 px-4 py-2.5 rounded-xl hover:bg-slate-50 transition text-slate-700 dark:text-slate-200 font-semibold text-sm"
              onClick={() => handleSocialClick('google')}
            >
              <FcGoogle className="text-xl" />
              Continue with Google
            </button>
          </div>

          <div className="text-center text-xs font-semibold uppercase tracking-wider text-slate-400">
            Sign in with email
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex justify-center">
              <div role="alert" className="relative max-w-md w-full bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 px-4 py-3 rounded-xl text-sm flex items-center gap-3">
                <span className="flex-1 leading-tight">{error}</span>
                <button
                  type="button"
                  onClick={() => setError("")}
                  className="opacity-70 hover:opacity-100"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="flex justify-center">
              <div role="status" className="relative max-w-md w-full bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 px-4 py-3 rounded-xl text-sm flex items-center gap-3">
                <FiCheckCircle className="text-emerald-600 text-base shrink-0" />
                <span className="flex-1 leading-tight">{success}</span>
                <button
                  type="button"
                  onClick={() => setSuccess("")}
                  className="opacity-70 hover:opacity-100"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* If authenticated, show dashboard button */}
          {isAuthenticated ? (
            <div className="text-center py-4">
              <button
                onClick={() => window.location.assign('/dashboards')}
                className="w-full bg-[#0D9488] text-white py-3 rounded-xl hover:bg-[#0F766E] font-semibold text-sm transition"
              >
                Continue to Learner Dashboard →
              </button>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">
                Your active session is ready.
              </p>
            </div>
          ) : (
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

              {/* PASSWORD FIELD */}
              <div className={`mb-4 relative ${loginMethod !== "password" ? "hidden" : ""}`}>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                  Password
                </label>
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
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute top-3 right-3 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    id="remember"
                    name="remember"
                    checked={form.remember}
                    onChange={handleChange}
                    className="accent-[#0D9488]"
                  />
                  Remember me
                </label>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#142B4A] text-white py-3 rounded-xl hover:bg-[#1E3A5F] text-sm font-semibold transition disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Signing in…' : 'Sign In'}
              </button>

              {/* Links */}
              <div className="pt-2 flex flex-row gap-3 w-full">
                <Link
                  href="/auth/recovery/password"
                  className="flex-1 text-center bg-[#F8FAFC] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold py-2.5 px-3 rounded-xl hover:border-[#0D9488] hover:text-[#0D9488] transition"
                >
                  Forgot Password?
                </Link>
                <Link
                  href="/auth/register"
                  className="flex-1 text-center bg-[#F8FAFC] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold py-2.5 px-3 rounded-xl hover:border-[#0D9488] hover:text-[#0D9488] transition"
                >
                  Register Instead?
                </Link>
              </div>

            </form>
          )}
        </div>
      </div>

    </div>
  )
}

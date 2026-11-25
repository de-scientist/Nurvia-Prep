// SkewLine\castoline\src\app\web\(auth)\login\page.tsx
'use client'

import { useState, useCallback, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { FcGoogle } from 'react-icons/fc'
import { FiCheckCircle, FiAlertCircle } from 'react-icons/fi'
import { Eye, EyeOff, Lock, Mail, ArrowRight } from 'lucide-react'
import { APP_NAME } from '@/lib/config/config'
import { login, LoginCredentials } from '@/lib/services/auth/loginService'
import { session } from '@/lib/services/auth/sessionService'
import { redirectToSocialProvider } from '@/lib/services/auth/socialService'
import { AuthShell } from '@/components/auth/auth-shell'
import { Button } from '@/components/ui/button'

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
        `Account created successfully. You can now log in as ${decodeURIComponent(registeredEmail)}.`
      );
    }
  }, [justRegistered, registeredEmail, onRegistered]);

  useEffect(() => {
    const match = document.cookie.match(/(?:^|; )socialError=([^;]*)/);
    if (match) {
      onSocialError(decodeURIComponent(match[1]));
      document.cookie = 'socialError=; path=/; max-age=0';
    }
  }, [onSocialError]);

  return null;
}

export default function WebLoginPage() {
  const [form, setForm] = useState({
    email: '',
    password: '',
    remember: true,
  })

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const role = "Learner";
  const LANDING_PATH = "/pages/entrance";

  const handleSocialClick = (provider: Parameters<typeof redirectToSocialProvider>[0]['provider']) => {
    redirectToSocialProvider({ provider, context: 'login', redirectPath: LANDING_PATH }).catch((err) => {
      console.error(`Social redirect (${provider}) failed:`, err)
      setError('Could not connect to Google sign-in. Please try again or use your password.')
    })
  }

  const handleRegisteredRedirect = useCallback((email: string, message: string) => {
    setForm(prev => ({ ...prev, email }));
    setSuccess(message);
  }, []);

  const handleSocialError = useCallback((message: string) => {
    setError(message);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const data = await session.check()
        setIsAuthenticated(!!data.logged_in)
      } catch (err) {
        console.error("Session check failed:", err)
        setIsAuthenticated(false)
      }
    }
    checkAuth()
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const credentials: LoginCredentials = {
        email: form.email,
        password: form.password,
        pin: "",
        loginMethod: "password",
        LoginProvider: "email",
        loginProviderPayload: "Void",
        dashboardName: "web",
        role: role,
        challenge: "learner.login.skew8lancasto",
        remember: form.remember,
      }

      const data = await login(credentials);

      if (data?.error) {
        setError(data.error)
        setSuccess('')
        return
      }

      setSuccess("Authentication verified! Opening your study workspace...")
      setError('')
      setTimeout(() => {
        window.location.assign(LANDING_PATH)
      }, 700)
    } catch (err: unknown) {
      console.error("Login failed:", err)
      setError(err instanceof Error ? err.message : "Unable to sign in. Please verify your details.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AuthShell mode="sign-in">
      <Suspense fallback={null}>
        <LoginSearchParamsHandler onRegistered={handleRegisteredRedirect} onSocialError={handleSocialError} />
      </Suspense>

      <div className="mb-4 space-y-1.5">
        <div className="inline-flex items-center gap-2 rounded-full border border-clinical-teal/30 bg-clinical-mist px-3 py-1 text-xs font-semibold text-clinical-teal">
          <span className="h-2 w-2 rounded-full bg-clinical-teal animate-pulse" />
          Learner Sign-In
        </div>
        <h1 className="font-brand text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Welcome to {APP_NAME}
        </h1>
        <p className="text-sm text-foreground-secondary leading-relaxed">
          Access your clinical question banks, interactive rationales, and exam simulations.
        </p>
      </div>

      {isAuthenticated ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/90 p-6 text-center space-y-3 shadow-xs dark:border-emerald-800 dark:bg-emerald-950/40">
          <FiCheckCircle className="mx-auto h-10 w-10 text-emerald-600" />
          <h2 className="text-base font-bold text-emerald-950 dark:text-emerald-200">
            Active Session Detected
          </h2>
          <p className="text-xs text-emerald-800/90 dark:text-emerald-300/90">
            You are already authenticated as an active nursing learner.
          </p>
          <Button
            type="button"
            className="w-full h-11 bg-clinical-teal text-white font-semibold hover:bg-clinical-tealHover"
            onClick={() => window.location.assign('/dashboards')}
          >
            <span>Proceed to Learner Dashboard</span>
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="space-y-3.5">
          <button
            type="button"
            onClick={() => handleSocialClick('google')}
            disabled={isLoading}
            className="flex h-11 w-full items-center justify-center gap-3 rounded-xl border border-border bg-white px-4 text-sm font-semibold text-foreground shadow-xs transition-all hover:border-clinical-teal/60 hover:bg-clinical-mist/50 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-teal disabled:cursor-not-allowed disabled:opacity-60 dark:bg-surface dark:hover:bg-surface-muted"
          >
            <FcGoogle className="h-5 w-5" />
            <span>Continue with Google</span>
          </button>

          <div className="relative flex items-center justify-center py-0.5">
            <div className="w-full border-t border-border" />
            <span className="relative bg-surface-elevated px-3 text-xs sm:text-[13px] font-medium text-foreground-muted whitespace-nowrap">
              or sign in with email
            </span>
            <div className="w-full border-t border-border" />
          </div>

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50/80 p-3 text-sm text-rose-900 shadow-xs dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200"
            >
              <FiAlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
              <span className="leading-snug">{error}</span>
            </div>
          )}

          {success && (
            <div
              role="status"
              className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 text-sm text-emerald-900 shadow-xs dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
            >
              <FiCheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <span className="leading-snug">{success}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-3" noValidate>
            <div className="space-y-1">
              <label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-foreground-secondary">
                Email address
              </label>
              <div className="relative">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  required
                  value={form.email}
                  onChange={handleChange}
                  placeholder="nurse@example.com"
                  className="h-11 w-full rounded-xl border border-border bg-background px-3.5 pl-10 text-sm text-foreground placeholder:text-foreground-muted/60 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-teal"
                />
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-muted" />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-foreground-secondary">
                  Password
                </label>
                <Link
                  href="/auth/recovery/password"
                  className="text-xs font-semibold text-clinical-teal underline-offset-4 hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={form.password}
                  onChange={handleChange}
                  maxLength={128}
                  placeholder="Enter your password"
                  className="h-11 w-full rounded-xl border border-border bg-background px-3.5 pl-10 pr-11 text-sm text-foreground placeholder:text-foreground-muted/60 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-teal"
                />
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-muted" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-foreground-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-teal transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-0.5">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  name="remember"
                  checked={form.remember}
                  onChange={handleChange}
                  className="h-4 w-4 rounded border-border text-clinical-teal focus:ring-clinical-teal focus-visible:ring-2 focus-visible:ring-clinical-teal"
                />
                <span className="text-xs text-foreground-secondary">
                  Remember me on this device
                </span>
              </label>
            </div>

            <Button
              type="submit"
              size="lg"
              className="h-11 w-full rounded-xl bg-clinical-teal text-white font-semibold shadow-md transition-all hover:bg-clinical-tealHover hover:shadow-lg active:scale-[0.99] disabled:cursor-not-allowed"
              isLoading={isLoading}
              disabled={isLoading}
            >
              <span>Sign In to Learner Sanctuary</span>
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </form>
        </div>
      )}

      <p className="mt-4 border-t border-border pt-3.5 text-center text-sm text-foreground-secondary">
        Need a learner account?{" "}
        <Link href="/auth/register" className="font-semibold text-clinical-teal underline-offset-4 hover:underline">
          Create an account
        </Link>
      </p>
    </AuthShell>
  )
}

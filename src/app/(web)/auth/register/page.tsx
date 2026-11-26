'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FcGoogle } from 'react-icons/fc'
import { FiCheckCircle, FiAlertCircle } from 'react-icons/fi'
import { User, Mail, Eye, EyeOff, ArrowRight } from 'lucide-react'
import 'react-phone-number-input/style.css'
import { CountryCode } from 'libphonenumber-js'
import PhoneInput from "react-phone-number-input"
import { APP_NAME } from '@/lib/config/config';
import { registerUser } from '@/lib/services/auth/registerService'
import { session } from '@/lib/services/auth/sessionService'
import { redirectToSocialProvider } from '@/lib/services/auth/socialService'
import { AuthShell } from '@/components/auth/auth-shell'
import { Button } from '@/components/ui/button'
import { sanitizeInternalDestination, getAuthReturnContext } from '@/lib/subscriptions/cart-store'

const role = "Learner";
const LOGIN_PATH = "/auth/login";

export default function RegisterPage() {
  const [form, setForm] = useState<{
    username: string;
    email: string;
    phone: string;
    password: string;
    confirmPassword: string;
    pin_confirmation: string;
    pin: string;
    loginMethod: "password" | "pin" | "both";
    agree: boolean;
  }>({
    username: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    pin_confirmation: "",
    pin: "",
    loginMethod: "password",
    agree: false,
  })

  const [passwordRequirements, setPasswordRequirements] = useState({
    length: false,
    uppercase: false,
    number: false,
    specialChar: false,
  })

  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [userCountry] = useState<CountryCode | undefined>("US")
  const router = useRouter()

  const resolveReturnPath = () => {
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      const fromUrl = sanitizeInternalDestination(
        sp.get("returnTo") || sp.get("redirectPath") || sp.get("next")
      );
      if (fromUrl) return fromUrl;
    }
    return getAuthReturnContext()?.returnTo || "/learner";
  };

  const handleSocialClick = (provider: Parameters<typeof redirectToSocialProvider>[0]['provider']) => {
    redirectToSocialProvider({ provider, context: 'register', redirectPath: resolveReturnPath() }).catch((err) => {
      console.error(`Social redirect (${provider}) failed:`, err)
      setError('Could not connect to Google sign-up. Please try again or create an account with email.')
    })
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))

    if (name === 'password') {
      setPasswordRequirements({
        length: value.length >= 6,
        uppercase: /[A-Z]/.test(value),
        number: /\d/.test(value),
        specialChar: /[!@#$%^&*(),.?":{}|<>]/.test(value),
      })
    }
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

  useEffect(() => {
    const match = document.cookie.match(/(?:^|; )socialError=([^;]*)/);
    if (match) {
      setError(decodeURIComponent(match[1]));
      document.cookie = 'socialError=; path=/; max-age=0';
    }
  }, []);

  const handlePhoneChange = (value: string | undefined) => {
    const phone = value || "";
    setForm((prev) => ({ ...prev, phone }));
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    setSuccess('')

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match. Please verify your entries.')
      setIsLoading(false)
      return
    }

    if (!form.agree) {
      setError('Please accept the Terms of Service and Privacy Policy to continue.')
      setIsLoading(false)
      return
    }

    try {
      const data = await registerUser({
        username: form.username,
        email: form.email,
        phone: form.phone,
        password: form.password,
        passwordConfirmation: form.confirmPassword,
        loginMethod: "password",
        role: role,
        agree: form.agree,
        challenge: "register-skew8@lancasto",
      })

      if (data?.error) {
        setError(data.error)
        return
      }

      setSuccess('Account created successfully! Preparing your access...')
      const ret = resolveReturnPath();
      const retParam = ret && ret !== "/learner" ? `&returnTo=${encodeURIComponent(ret)}` : "";
      setTimeout(() => {
        router.push(`${LOGIN_PATH}?registered=true&email=${encodeURIComponent(form.email)}${retParam}`)
      }, 1000)
    } catch (err: unknown) {
      console.error('Registration failed:', err)
      setError(err instanceof Error ? err.message : 'Unable to complete registration. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AuthShell mode="sign-up">
      <div className="mb-4 space-y-1.5">
        <div className="inline-flex items-center gap-2 rounded-full border border-clinical-teal/30 bg-clinical-mist px-3 py-1 text-xs font-semibold text-clinical-teal">
          <span className="h-2 w-2 rounded-full bg-clinical-teal animate-pulse" />
          Candidate Registration
        </div>
        <h1 className="font-brand text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Join {APP_NAME}
        </h1>
        <p className="text-sm text-foreground-secondary leading-relaxed">
          Create your nursing candidate profile to unlock comprehensive clinical simulations and rationales.
        </p>
      </div>

      {isAuthenticated ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/90 p-6 text-center space-y-3 shadow-xs dark:border-emerald-800 dark:bg-emerald-950/40">
          <FiCheckCircle className="mx-auto h-10 w-10 text-emerald-600" />
          <h2 className="text-base font-bold text-emerald-950 dark:text-emerald-200">
            Active Session Detected
          </h2>
          <p className="text-xs text-emerald-800/90 dark:text-emerald-300/90">
            You are already logged into QuizNurse.
          </p>
          <Button
            type="button"
            className="w-full h-11 bg-clinical-teal text-white font-semibold hover:bg-clinical-tealHover"
            onClick={() => router.push('/dashboards')}
          >
            <span>Continue to Learner Dashboard</span>
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
              or create account with email
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

          <form onSubmit={handleRegister} className="space-y-2.5" noValidate>
            <div className="space-y-1">
              <label htmlFor="username" className="text-xs font-semibold uppercase tracking-wider text-foreground-secondary">
                Full Name / Candidate Handle
              </label>
              <div className="relative">
                <input
                  id="username"
                  type="text"
                  name="username"
                  autoComplete="name"
                  required
                  value={form.username}
                  onChange={handleChange}
                  placeholder="Nurse Taylor"
                  className="h-10 sm:h-10.5 w-full rounded-xl border border-border bg-background px-3.5 pl-10 text-sm text-foreground placeholder:text-foreground-muted/60 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-teal"
                />
                <User className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-muted" />
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-foreground-secondary">
                Candidate Email Address
              </label>
              <div className="relative">
                <input
                  id="email"
                  type="email"
                  name="email"
                  required
                  value={form.email}
                  onChange={handleChange}
                  placeholder="candidate@nursing.edu"
                  className="h-10 sm:h-10.5 w-full rounded-xl border border-border bg-background px-3.5 pl-10 text-sm text-foreground placeholder:text-foreground-muted/60 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-teal"
                />
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-muted" />
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="phone" className="text-xs font-semibold uppercase tracking-wider text-foreground-secondary">
                Mobile Phone Number
              </label>
              <PhoneInput
                international
                defaultCountry={userCountry}
                value={form.phone}
                onChange={handlePhoneChange}
                name="phone"
                className="phone-input-custom rounded-xl border border-border bg-background px-3.5 py-2 text-sm text-foreground focus-within:ring-2 focus-within:ring-clinical-teal"
              />
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <div className="space-y-1">
                <label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-foreground-secondary">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    name="password"
                    autoComplete="new-password"
                    required
                    value={form.password}
                    onChange={handleChange}
                    placeholder="Min 6 characters"
                    className="h-10 sm:h-10.5 w-full rounded-xl border border-border bg-background px-3.5 pr-10 text-sm text-foreground transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-teal"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-foreground-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-teal transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label htmlFor="confirmPassword" className="text-xs font-semibold uppercase tracking-wider text-foreground-secondary">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    name="confirmPassword"
                    autoComplete="new-password"
                    required
                    value={form.confirmPassword}
                    onChange={handleChange}
                    placeholder="Repeat password"
                    className="h-10 sm:h-10.5 w-full rounded-xl border border-border bg-background px-3.5 pr-10 text-sm text-foreground transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-teal"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                    className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-foreground-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-teal transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-1 pt-0.5">
              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  name="agree"
                  checked={form.agree}
                  onChange={handleChange}
                  className="mt-0.5 h-4 w-4 rounded border-border text-clinical-teal focus:ring-clinical-teal focus-visible:ring-2 focus-visible:ring-clinical-teal"
                />
                <span className="text-xs leading-relaxed text-foreground-secondary">
                  I agree to the QuizNurse{" "}
                  <Link href="/terms" className="font-semibold text-clinical-teal underline-offset-4 hover:underline">
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link href="/privacy" className="font-semibold text-clinical-teal underline-offset-4 hover:underline">
                    Privacy Policy
                  </Link>
                  .
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
              <span>Create Candidate Account</span>
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </form>
        </div>
      )}

      <p className="mt-4 border-t border-border pt-3.5 text-center text-sm text-foreground-secondary">
        Already have a profile?{" "}
        <Link href={LOGIN_PATH} className="font-semibold text-clinical-teal underline-offset-4 hover:underline">
          Sign In
        </Link>
      </p>
    </AuthShell>
  )
}

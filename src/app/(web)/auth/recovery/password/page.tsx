'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FaEye, FaEyeSlash } from 'react-icons/fa'
import { FiCheckCircle, FiAlertCircle } from 'react-icons/fi'
import { Mail, KeyRound, Lock, ArrowRight, ArrowLeft } from 'lucide-react'
import { APP_NAME } from '@/lib/config/config'
import {
  requestRecoveryCode,
  verifyRecoveryCode,
  resetCredentials,
} from '@/lib/services/auth/supportService'
import { useCurrentSystemUser } from '@/lib/hooks/users/account/current/useCurrentSystemUser'
import { AuthShell } from '@/components/auth/auth-shell'
import { Button } from '@/components/ui/button'

type Step = 'email' | 'code' | 'reset' | 'done'

export default function RecoveryPasswordPage() {
  const { user, loading: userLoading } = useCurrentSystemUser()
  const router = useRouter()

  const [step, setStep] = useState<Step>('email')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Step 1: Email
  const [email, setEmail] = useState('')

  useEffect(() => {
    if (user?.email) setEmail(user.email)
  }, [user])

  // Step 2: Code
  const [code, setCode] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)

  // Step 3: New credentials
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const [passwordRequirements, setPasswordRequirements] = useState({
    length: false,
    uppercase: false,
    number: false,
    specialChar: false,
  })

  const handlePasswordInput = (value: string) => {
    setPassword(value)
    setPasswordRequirements({
      length: value.length >= 6,
      uppercase: /[A-Z]/.test(value),
      number: /\d/.test(value),
      specialChar: /[!@#$%^&*(),.?":{}|<>]/.test(value),
    })
  }

  // Step 1 → Request code
  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setIsLoading(true)

    try {
      const response = await requestRecoveryCode({
        email,
        context: 'password',
      })

      if (response.error) {
        setError(response.error)
        return
      }

      setSuccess('Verification code sent to your email.')
      setStep('code')
      setResendCooldown(60)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to send recovery code.')
    } finally {
      setIsLoading(false)
    }
  }

  // Step 2 → Verify code
  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setIsLoading(true)

    try {
      const response = await verifyRecoveryCode({
        email,
        code,
        context: 'password',
      })

      if (response.error) {
        setError(response.error)
        return
      }

      setSuccess('Code verified. Set your new password.')
      setStep('reset')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid verification code.')
    } finally {
      setIsLoading(false)
    }
  }

  // Step 3 → Reset credentials
  const handleResetCredentials = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    if (!passwordRequirements.length) {
      setError('Password must be at least 6 characters.')
      return
    }

    setIsLoading(true)

    try {
      const response = await resetCredentials({
        ...(user ? { userGuidId: user.guidId } : {}),
        email,
        code,
        context: 'password',
        loginMethod: 'password',
        password,
        passwordConfirmation: confirmPassword,
      })

      if (response.error) {
        setError(response.error)
        return
      }

      setStep('done')
      setTimeout(() => {
        router.push(`/auth/login?registered=true&email=${encodeURIComponent(email)}`)
      }, 1500)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to reset credentials.')
    } finally {
      setIsLoading(false)
    }
  }

  // Cooldown countdown
  useEffect(() => {
    if (resendCooldown <= 0) return
    const interval = setInterval(() => {
      setResendCooldown((prev) => prev - 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [resendCooldown])

  return (
    <AuthShell mode="forgot-password">
      <div className="mb-4 space-y-1.5">
        <div className="inline-flex items-center gap-2 rounded-full border border-clinical-teal/30 bg-clinical-mist px-3 py-1 text-xs font-semibold text-clinical-teal">
          <span className="h-2 w-2 rounded-full bg-clinical-teal animate-pulse" />
          Credential Recovery
        </div>
        <h1 className="font-brand text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Recover your access
        </h1>
        <p className="text-sm text-foreground-secondary leading-relaxed">
          Verify your candidate identity to securely establish a new password for {APP_NAME}.
        </p>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-2 pb-3 text-xs font-semibold text-foreground-muted border-b border-border/60 mb-4">
        <span className={step === 'email' ? 'text-clinical-teal' : ''}>1. Email</span>
        <span>→</span>
        <span className={step === 'code' ? 'text-clinical-teal' : ''}>2. Code</span>
        <span>→</span>
        <span className={step === 'reset' || step === 'done' ? 'text-clinical-teal' : ''}>3. New Password</span>
      </div>

      {(error || success) && (
        <div
          role="alert"
          className={`mb-4 flex items-start gap-2.5 rounded-xl p-3.5 text-sm shadow-xs ${
            error
              ? 'border border-rose-200 bg-rose-50/80 text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200'
              : 'border border-emerald-200 bg-emerald-50/80 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'
          }`}
        >
          {error ? (
            <FiAlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
          ) : (
            <FiCheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          )}
          <span className="flex-1 leading-snug">{error || success}</span>
        </div>
      )}

      {step === 'email' && (
        <form onSubmit={handleRequestCode} className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-foreground-secondary">
              Account Email
              {userLoading && <span className="ml-2 text-xs font-normal text-foreground-muted">(checking session…)</span>}
            </label>
            <div className="relative">
              <input
                type="email"
                required
                readOnly={!!user}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="candidate@nursing.edu"
                className={`h-11 w-full rounded-xl border border-border px-3.5 pl-10 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-teal ${
                  user ? 'bg-surface-muted text-foreground-muted cursor-not-allowed' : 'bg-background text-foreground'
                }`}
              />
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-muted" />
            </div>
          </div>

          <Button
            type="submit"
            size="lg"
            disabled={isLoading}
            isLoading={isLoading}
            className="h-11 w-full rounded-xl bg-clinical-teal text-white font-semibold shadow-md transition-all hover:bg-clinical-tealHover hover:shadow-lg active:scale-[0.99]"
          >
            <span>Send Verification Code</span>
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </form>
      )}

      {step === 'code' && (
        <form onSubmit={handleVerifyCode} className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-foreground-secondary">
              Verification Code
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Enter 6-digit code"
                className="h-11 w-full rounded-xl border border-border bg-background px-3.5 pl-10 text-sm font-mono tracking-widest text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-teal"
              />
              <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-muted" />
            </div>
          </div>

          <Button
            type="submit"
            size="lg"
            disabled={isLoading}
            isLoading={isLoading}
            className="h-11 w-full rounded-xl bg-clinical-teal text-white font-semibold shadow-md transition-all hover:bg-clinical-tealHover hover:shadow-lg active:scale-[0.99]"
          >
            <span>Verify Code</span>
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>

          <div className="flex justify-between items-center pt-1.5 text-xs">
            <button
              type="button"
              onClick={() => setStep('email')}
              className="text-foreground-secondary hover:text-foreground inline-flex items-center gap-1"
            >
              <ArrowLeft className="h-3 w-3" /> Change email
            </button>
            <button
              type="button"
              disabled={resendCooldown > 0}
              onClick={(e: React.MouseEvent<HTMLButtonElement>) => handleRequestCode(e as unknown as React.FormEvent)}
              className="text-clinical-teal font-semibold hover:underline disabled:opacity-50"
            >
              {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend code'}
            </button>
          </div>
        </form>
      )}

      {step === 'reset' && (
        <form onSubmit={handleResetCredentials} className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-foreground-secondary">
              New Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => handlePasswordInput(e.target.value)}
                placeholder="At least 6 characters"
                className="h-11 w-full rounded-xl border border-border bg-background px-3.5 pl-10 pr-11 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-teal"
              />
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-muted" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-foreground-muted hover:text-foreground"
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-foreground-secondary">
              Confirm New Password
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
                className="h-11 w-full rounded-xl border border-border bg-background px-3.5 pl-10 pr-11 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-teal"
              />
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-muted" />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-foreground-muted hover:text-foreground"
              >
                {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            size="lg"
            disabled={isLoading}
            isLoading={isLoading}
            className="h-11 w-full rounded-xl bg-clinical-teal text-white font-semibold shadow-md transition-all hover:bg-clinical-tealHover hover:shadow-lg active:scale-[0.99]"
          >
            <span>Reset Password & Sign In</span>
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </form>
      )}

      {step === 'done' && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/90 p-5 text-center space-y-2.5">
          <FiCheckCircle className="mx-auto h-11 w-11 text-emerald-600" />
          <h2 className="text-base font-bold text-emerald-950">Password Successfully Reset!</h2>
          <p className="text-xs text-emerald-800">
            Redirecting to sign in with your updated credentials...
          </p>
        </div>
      )}

      <p className="mt-4 border-t border-border pt-3.5 text-center text-sm text-foreground-secondary">
        Remembered your password?{" "}
        <Link href="/auth/login" className="font-semibold text-clinical-teal underline-offset-4 hover:underline">
          Return to sign in
        </Link>
      </p>
    </AuthShell>
  )
}

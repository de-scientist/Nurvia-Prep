'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { FaEye, FaEyeSlash } from 'react-icons/fa'
import { FiCheckCircle, FiMail, FiArrowLeft } from 'react-icons/fi'
import { APP_NAME } from '@/lib/config/config'
import { useRouter } from 'next/navigation'
import {
  requestRecoveryCode,
  verifyRecoveryCode,
  resetCredentials,
} from '@/lib/services/auth/supportService'
import { useCurrentSystemUser } from '@/lib/hooks/users/account/current/useCurrentSystemUser'

// ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

type Step = 'email' | 'code' | 'reset' | 'done'

// ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

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

  // ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

  const handlePasswordInput = (value: string) => {
    setPassword(value)
    setPasswordRequirements({
      length: value.length >= 6,
      uppercase: /[A-Z]/.test(value),
      number: /\d/.test(value),
      specialChar: /[!@#$%^&*(),.?":{}|<>]/.test(value),
    })
  }

  const generatePassword = () => {
    const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    const lower = 'abcdefghijklmnopqrstuvwxyz'
    const digits = '0123456789'
    const specials = '!@#$%^&*()-_=+[]{};:,.<>?'
    const allChars = upper + lower + digits + specials

    let generated = ''
    generated += upper.charAt(Math.floor(Math.random() * upper.length))
    generated += lower.charAt(Math.floor(Math.random() * lower.length))
    generated += digits.charAt(Math.floor(Math.random() * digits.length))
    generated += specials.charAt(Math.floor(Math.random() * specials.length))
    for (let i = 0; i < 12; i++) {
      generated += allChars.charAt(Math.floor(Math.random() * allChars.length))
    }
    generated = generated.split('').sort(() => 0.5 - Math.random()).join('')

    setPassword(generated)
    setConfirmPassword(generated)
    setPasswordRequirements({ length: true, uppercase: true, number: true, specialChar: true })
  }

  // ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  // Step 1 → Request code

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setIsLoading(true)

    try {
      const response = await requestRecoveryCode({
        ...(user ? { userGuidId: user.guidId } : {}),
        email,
        context: 'password',
      })

      if (response.error) {
        setError(response.error)
        return
      }

      setSuccess(`A recovery code (or link) has been sent to ${email} ⚓`)
      setStep('code')
      startResendCooldown()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to send recovery code.')
    } finally {
      setIsLoading(false)
    }
  }

  const startResendCooldown = () => {
    setResendCooldown(60)
    const interval = setInterval(() => {
      setResendCooldown(prev => {
        if (prev <= 1) {
          clearInterval(interval)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const handleResendCode = async () => {
    if (resendCooldown > 0) return
    setError('')
    setIsLoading(true)
    try {
      const response = await requestRecoveryCode({
        ...(user ? { userGuidId: user.guidId } : {}),
        email,
        context: 'password',
      })
      if (response.error) {
        setError(response.error)
        return
      }
      setSuccess('Code resent ⚓')
      startResendCooldown()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to resend code.')
    } finally {
      setIsLoading(false)
    }
  }

  // ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  // Step 2 → Verify code

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setIsLoading(true)

    try {
      const response = await verifyRecoveryCode({
        ...(user ? { userGuidId: user.guidId } : {}),
        email,
        code,
        context: 'password',
      })

      if (response.error) {
        setError(response.error)
        return
      }

      setSuccess('Code verified ✓ Now set your new credentials.')
      setStep('reset')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid or expired code.')
    } finally {
      setIsLoading(false)
    }
  }

  // ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  // Step 3 → Reset credentials

  const handleResetCredentials = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (password !== confirmPassword) {
      setError('Passwords do not match!')
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

  // ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col items-center bg-[#F8FAFC] dark:bg-[#0B1220] px-4 py-12 min-h-[85vh]">

      {/* App Title / Branding */}
      <div className="flex flex-col items-center justify-center mb-6 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#0D9488]/25 bg-[#0D9488]/10 px-3.5 py-1 text-xs font-semibold text-[#0D9488] dark:text-teal-300 mb-2">
          NURVIA Account Security
        </div>
        <div className="flex items-center justify-center gap-2">
          <span className="text-2xl md:text-3xl font-extrabold text-slate-600 dark:text-slate-300">
            Recover your
          </span>
          <h1 className="text-2xl md:text-3xl font-extrabold text-[#142B4A] dark:text-white">
            {APP_NAME}
          </h1>
          <FiCheckCircle className="text-[#0D9488] text-xl md:text-2xl" title="Verified" />
        </div>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
          Reset your password and restore access to your learner account.
        </p>
      </div>

      {/* Card Container */}
      <div className="max-w-5xl w-full bg-white dark:bg-[#111C2E] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg grid grid-cols-1 md:grid-cols-2 overflow-hidden">

        {/* LEFT SIDE: Photo */}
        <div className="hidden md:flex relative w-full h-full items-end justify-center overflow-hidden bg-[#142B4A]">
          <Image
            src="/web/auth/recovery/password/passwordFoto.jpg"
            alt="Account Recovery"
            layout="fill"
            objectFit="cover"
            priority
            className="z-0 opacity-85"
          />

          <div className="z-10 w-full p-8 bg-gradient-to-t from-[#142B4A] via-[#142B4A]/70 to-transparent text-white text-left">
            <h2 className="text-2xl font-extrabold">Password Recovery</h2>
            <p className="text-sm text-slate-200 mt-1.5">
              We&apos;ll help you verify your identity and get back into {APP_NAME} safely.
            </p>
          </div>
        </div>

        {/* RIGHT SIDE: Form */}
        <div className="w-full p-8 space-y-5 border-l border-slate-200 dark:border-slate-800">

          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2 text-xs font-semibold text-slate-400">
            <span className={step === 'email' ? 'text-[#0D9488]' : ''}>1. Email</span>
            <span>→</span>
            <span className={step === 'code' ? 'text-[#0D9488]' : ''}>2. Verify</span>
            <span>→</span>
            <span className={step === 'reset' || step === 'done' ? 'text-[#0D9488]' : ''}>3. New Credentials</span>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-900/60 p-3.5 text-xs text-slate-600 dark:text-slate-300 space-y-1.5">
            <p className="font-semibold text-[#0F172A] dark:text-white">
              Use this form if you already have an account and need to reset your forgotten password.
            </p>
            <p>
              Enter your registered email, confirm the verification code sent to your inbox, and set your new password.
            </p>
          </div>

          {/* Alert Message */}
          {(error || success) && (
            <div className="flex justify-center">
              <div
                role="alert"
                className={`relative max-w-md w-full px-4 py-3 rounded-xl text-sm flex items-center gap-3 ${
                  error
                    ? 'bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
                    : 'bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                }`}
              >
                <span className="flex-1 leading-tight">{error || success}</span>
                <button
                  type="button"
                  onClick={() => { setError(''); setSuccess('') }}
                  className="opacity-70 hover:opacity-100"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* STEP 1: Email */}
          {step === 'email' && (
            <form onSubmit={handleRequestCode} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                  Account Email
                  {userLoading && <span className="ml-2 text-xs text-slate-400 font-normal">(checking session…)</span>}
                </label>
                <div className="relative">
                  <FiMail className="absolute top-3 left-3 text-slate-400" />
                  <input
                    type="email"
                    name="email"
                    required
                    readOnly={!!user}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`w-full border border-slate-300 dark:border-slate-700 rounded-xl pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 focus:border-[#0D9488] ${
                      user ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-white dark:bg-slate-900 text-[#0F172A] dark:text-white'
                    }`}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#142B4A] hover:bg-[#1E3A5F] text-white py-3 rounded-xl text-sm font-semibold transition disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Sending…' : 'Send Recovery Code'}
              </button>
            </form>
          )}

          {/* STEP 2: Code */}
          {step === 'code' && (
            <form onSubmit={handleVerifyCode} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                  Verification code sent to {email}
                </label>
                <input
                  type="text"
                  name="code"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  onPaste={(e) => {
                    e.preventDefault()
                    const pasted = e.clipboardData.getData('text').trim()
                    setCode(pasted.slice(0, 8))
                  }}
                  maxLength={8}
                  className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl px-3.5 py-2.5 text-center text-lg font-mono tracking-[0.5em] text-[#0F172A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 focus:border-[#0D9488]"
                />
                <p className="text-xs text-slate-500 mt-2">
                  You can also click the verification link sent to your email.
                </p>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#142B4A] hover:bg-[#1E3A5F] text-white py-3 rounded-xl text-sm font-semibold transition disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Verifying…' : 'Verify Code'}
              </button>

              <button
                type="button"
                onClick={handleResendCode}
                disabled={resendCooldown > 0}
                className="w-full text-xs font-semibold text-[#0D9488] hover:text-[#0F766E] disabled:text-slate-400 disabled:cursor-not-allowed"
              >
                {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend Code'}
              </button>

              <button
                type="button"
                onClick={() => setStep('email')}
                className="w-full flex items-center justify-center gap-1 text-xs text-slate-500 hover:text-slate-700"
              >
                <FiArrowLeft /> Use a different email
              </button>
            </form>
          )}

          {/* STEP 3: New Credentials */}
          {step === 'reset' && (
            <form onSubmit={handleResetCredentials} className="space-y-4">
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">New Password</label>
                    <button
                      type="button"
                      onClick={generatePassword}
                      className="text-xs font-semibold bg-[#0D9488]/10 text-[#0D9488] px-2.5 py-0.5 rounded-lg hover:bg-[#0D9488]/20"
                    >
                      Auto-Generate
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      maxLength={24}
                      value={password}
                      onChange={(e) => handlePasswordInput(e.target.value)}
                      className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl px-3.5 py-2.5 text-sm text-[#0F172A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 focus:border-[#0D9488] pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute top-3 right-3 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <FaEyeSlash /> : <FaEye />}
                    </button>
                  </div>

                  {password && (
                    <ul className="mt-2 text-xs space-y-1">
                      <li className={passwordRequirements.length ? 'text-[#0D9488] font-medium' : 'text-slate-500'}>
                        {passwordRequirements.length ? '✓' : '•'} At least 6 characters
                      </li>
                      <li className={passwordRequirements.uppercase ? 'text-[#0D9488] font-medium' : 'text-slate-500'}>
                        {passwordRequirements.uppercase ? '✓' : '•'} One uppercase letter (optional)
                      </li>
                      <li className={passwordRequirements.number ? 'text-[#0D9488] font-medium' : 'text-slate-500'}>
                        {passwordRequirements.number ? '✓' : '•'} One number (optional)
                      </li>
                      <li className={passwordRequirements.specialChar ? 'text-[#0D9488] font-medium' : 'text-slate-500'}>
                        {passwordRequirements.specialChar ? '✓' : '•'} One special character (optional)
                      </li>
                    </ul>
                  )}
                </div>

                {passwordRequirements.length && (
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">Confirm New Password</label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        required
                        maxLength={24}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className={`w-full border ${
                          password && confirmPassword && password !== confirmPassword
                            ? 'border-rose-400'
                            : 'border-slate-300 dark:border-slate-700'
                        } bg-white dark:bg-slate-900 rounded-xl px-3.5 py-2.5 text-sm text-[#0F172A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 focus:border-[#0D9488] pr-10`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute top-3 right-3 text-slate-400 hover:text-slate-600"
                      >
                        {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                      </button>
                    </div>
                    {password && confirmPassword && password !== confirmPassword && (
                      <p className="mt-1 text-xs text-rose-500">Passwords do not match</p>
                    )}
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#142B4A] hover:bg-[#1E3A5F] text-white py-3 rounded-xl text-sm font-semibold transition disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Saving…' : 'Save New Credentials'}
              </button>
            </form>
          )}

          {/* STEP 4: Done */}
          {step === 'done' && (
            <div className="text-center space-y-3 py-4">
              <FiCheckCircle className="text-[#0D9488] text-4xl mx-auto" />
              <h3 className="text-lg font-bold text-[#0F172A] dark:text-white">Password Updated</h3>
              <p className="text-sm text-slate-600 dark:text-slate-300">Redirecting you to login…</p>
            </div>
          )}

          {/* Links */}
          <div className="mt-6 flex flex-row gap-3 w-full">
            <Link
              href="/auth/login"
              className="flex-1 text-center bg-[#F8FAFC] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold py-2.5 px-4 rounded-xl hover:border-[#0D9488] hover:text-[#0D9488] transition"
            >
              Back to Login
            </Link>
            <Link
              href="/auth/register"
              className="flex-1 text-center bg-[#F8FAFC] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold py-2.5 px-4 rounded-xl hover:border-[#0D9488] hover:text-[#0D9488] transition"
            >
              Register Now?
            </Link>
          </div>

          <div className="mt-3 flex flex-row gap-3 w-full">
            <Link
              href="/auth/update/password"
              className="flex-1 text-center bg-[#F8FAFC] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold py-2.5 px-4 rounded-xl hover:border-[#0D9488] hover:text-[#0D9488] transition"
            >
              Change Password
            </Link>
            <Link
              href="/auth/support"
              className="flex-1 text-center bg-[#F8FAFC] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold py-2.5 px-4 rounded-xl hover:border-[#0D9488] hover:text-[#0D9488] transition"
            >
              Need Support?
            </Link>
          </div>

        </div>
      </div>
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// The End By B.L.S.M.C - [SkewBlanc] - The Winds Chase Us ⚓
// ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

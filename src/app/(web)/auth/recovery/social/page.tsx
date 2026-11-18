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

// ─────────────────────────────────────────────────────────────────────────────

type Step = 'email' | 'code' | 'reset' | 'done'
type CredentialMethod = 'password' | 'pin' | 'both'

// ─────────────────────────────────────────────────────────────────────────────

export default function RecoverySocialPage() {
  const router = useRouter()
  const { user, loading: userLoading } = useCurrentSystemUser()

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
  const [credentialMethod, setCredentialMethod] = useState<CredentialMethod>('password')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pin, setPin] = useState('')
  const [pinConfirmation, setPinConfirmation] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [showPin, setShowPin] = useState(false)
  const [showConfirmPin, setShowConfirmPin] = useState(false)

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
      length: value.length >= 8,
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

  const generatePin = (length = 16) => {
    const digits = '0123456789'
    let generated = ''
    for (let i = 0; i < length; i++) {
      generated += digits.charAt(Math.floor(Math.random() * digits.length))
    }
    setPin(generated)
    setPinConfirmation(generated)
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
        context: 'social',
      })

      if (response.error) {
        setError(response.error)
        return
      }

      setSuccess(`A verification code (or link) has been sent to ${email} ⚓`)
      setStep('code')
      startResendCooldown()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to send verification code.')
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
        context: 'social',
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
        context: 'social',
      })

      if (response.error) {
        setError(response.error)
        return
      }

      setSuccess('Email verified ✓ Now set up your credentials.')
      setStep('reset')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid or expired code.')
    } finally {
      setIsLoading(false)
    }
  }

  // ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  // Step 3 → Create credentials

  const handleCreateCredentials = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (credentialMethod !== 'pin' && password !== confirmPassword) {
      setError('Passwords do not match!')
      return
    }

    if (credentialMethod !== 'password' && pin !== pinConfirmation) {
      setError('PINs do not match!')
      return
    }

    const isPasswordStrong = Object.values(passwordRequirements).every(Boolean)
    if (credentialMethod !== 'pin' && !isPasswordStrong) {
      setError('Password does not meet all requirements.')
      return
    }

    setIsLoading(true)

    try {
      const response = await resetCredentials({
        ...(user ? { userGuidId: user.guidId } : {}),
        email,
        code,
        context: 'social',
        loginMethod: credentialMethod,
        password: credentialMethod !== 'pin' ? password : undefined,
        passwordConfirmation: credentialMethod !== 'pin' ? confirmPassword : undefined,
        pin: credentialMethod !== 'password' ? pin : undefined,
        pinConfirmation: credentialMethod !== 'password' ? pinConfirmation : undefined,
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
      setError(err instanceof Error ? err.message : 'Unable to create credentials.')
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
            Switch to email on
          </span>
          <h1 className="text-2xl md:text-3xl font-extrabold text-[#142B4A] dark:text-white">
            {APP_NAME}
          </h1>
          <FiCheckCircle className="text-[#0D9488] text-xl md:text-2xl" title="Verified" />
        </div>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
          Signed up with Google, Apple, or another provider? Set up a password or PIN here.
        </p>
      </div>

      {/* Card Container */}
      <div className="max-w-5xl w-full bg-white dark:bg-[#111C2E] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg grid grid-cols-1 md:grid-cols-2 overflow-hidden">

        {/* LEFT SIDE: Photo */}
        <div className="hidden md:flex relative w-full h-full items-end justify-center overflow-hidden bg-[#142B4A]">
          <Image
            src="/web/auth/recovery/social/socialFoto.jpg"
            alt="Account Recovery"
            layout="fill"
            objectFit="cover"
            priority
            className="z-0 opacity-85"
          />

          <div className="z-10 w-full p-8 bg-gradient-to-t from-[#142B4A] via-[#142B4A]/70 to-transparent text-white text-left">
            <h2 className="text-2xl font-extrabold">Direct Email Credentials</h2>
            <p className="text-sm text-slate-200 mt-1.5">
              Verify the email you used with your social account to set up a direct login.
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
            <span className={step === 'reset' || step === 'done' ? 'text-[#0D9488]' : ''}>3. Set Credentials</span>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-900/60 p-3.5 text-xs text-slate-600 dark:text-slate-300 space-y-1.5">
            <p className="font-semibold text-[#0F172A] dark:text-white">
              Use this page if you originally signed up with Google, Apple, Facebook, GitHub, LinkedIn, or Microsoft and want to enable direct email + password or PIN login.
            </p>
            <p>
              Enter the email linked to your social account, verify it, and set up your password, PIN, or both.
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
                  Social Account Email
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
                {isLoading ? 'Sending…' : 'Send Verification Code'}
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

          {/* STEP 3: Create Credentials */}
          {step === 'reset' && (
            <form onSubmit={handleCreateCredentials} className="space-y-4">

              {/* Method Selector */}
              <div className="mb-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-2">
                  Choose Login Method
                </label>
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                  {(['password', 'pin', 'both'] as CredentialMethod[]).map(method => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setCredentialMethod(method)}
                      className={`flex-1 px-3 py-2 text-xs font-semibold rounded-lg transition-all ${
                        credentialMethod === method
                          ? 'bg-[#142B4A] text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-700'
                      }`}
                    >
                      {method === 'password' && 'Password Only'}
                      {method === 'pin' && 'PIN Only'}
                      {method === 'both' && 'Password + PIN'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Password Fields */}
              {(credentialMethod === 'password' || credentialMethod === 'both') && (
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">Password</label>
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
                          {passwordRequirements.length ? '✓' : '•'} At least 8 characters
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
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">Confirm Password</label>
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
              )}

              {/* PIN Fields */}
              {(credentialMethod === 'pin' || credentialMethod === 'both') && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">PIN (4–24 digits)</label>
                    <button
                      type="button"
                      onClick={() => generatePin(16)}
                      className="text-xs font-semibold bg-[#0D9488]/10 text-[#0D9488] px-2.5 py-0.5 rounded-lg hover:bg-[#0D9488]/20"
                    >
                      Auto-Generate
                    </button>
                  </div>
                  <div className="relative mb-3">
                    <input
                      type={showPin ? 'text' : 'password'}
                      required
                      maxLength={24}
                      pattern="[0-9]*"
                      inputMode="numeric"
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                      className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl px-3.5 py-2.5 text-sm text-[#0F172A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 focus:border-[#0D9488] pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPin(!showPin)}
                      className="absolute top-3 right-3 text-slate-400 hover:text-slate-600"
                    >
                      {showPin ? <FaEyeSlash /> : <FaEye />}
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">Confirm PIN</label>
                    <div className="relative">
                      <input
                        type={showConfirmPin ? 'text' : 'password'}
                        required
                        maxLength={24}
                        inputMode="numeric"
                        value={pinConfirmation}
                        onChange={(e) => setPinConfirmation(e.target.value.replace(/\D/g, ''))}
                        className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl px-3.5 py-2.5 text-sm text-[#0F172A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 focus:border-[#0D9488] pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPin(!showConfirmPin)}
                        className="absolute top-3 right-3 text-slate-400 hover:text-slate-600"
                      >
                        {showConfirmPin ? <FaEyeSlash /> : <FaEye />}
                      </button>
                    </div>
                    {pin && pinConfirmation && pin !== pinConfirmation && (
                      <p className="mt-1 text-xs text-rose-500">PINs do not match</p>
                    )}
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#142B4A] hover:bg-[#1E3A5F] text-white py-3 rounded-xl text-sm font-semibold transition disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Saving…' : 'Create Credentials'}
              </button>
            </form>
          )}

          {/* STEP 4: Done */}
          {step === 'done' && (
            <div className="text-center space-y-3 py-4">
              <FiCheckCircle className="text-[#0D9488] text-4xl mx-auto" />
              <h3 className="text-lg font-bold text-[#0F172A] dark:text-white">You&apos;re All Set</h3>
              <p className="text-sm text-slate-600 dark:text-slate-300">You can now log in with email. Redirecting…</p>
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

// The End By B.L.S.M.C - [SkewBlanc] - The Winds Chase Us ⚓
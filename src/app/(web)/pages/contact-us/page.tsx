'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { FiCheckCircle, FiMail } from 'react-icons/fi'
import { APP_NAME } from '@/lib/config/config'
import PhoneInput from 'react-phone-number-input'
import 'react-phone-number-input/style.css'
import { submitSupportIssue } from '@/lib/services/auth/supportService'
import { useCurrentSystemUser } from '@/lib/hooks/users/account/current/useCurrentSystemUser'

// ─────────────────────────────────────────────────────────────────────────────
type IssueCategory =
  | 'login_issue'
  | 'account_recovery'
  | 'payment_billing'
  | 'exam_technical'
  | 'other'

// ─────────────────────────────────────────────────────────────────────────────

export default function SupportPage() {
  const { user, loading: userLoading } = useCurrentSystemUser()
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [category, setCategory] = useState<IssueCategory>('login_issue')
  const [message, setMessage] = useState('')

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitted, setSubmitted] = useState(false)


  useEffect(() => {
    if (!user) return
    const primaryPhone = user.phones?.find(p => p.isPrimary)?.phoneNumber

    if (user.email) setEmail(user.email)
    if (primaryPhone) {
      setPhone(primaryPhone.startsWith('+') ? primaryPhone : '+' + primaryPhone.replace(/\D/g, ''))
    }
  }, [user])

  const handlePhoneChange = (value: string | undefined) => {
    setPhone(value || '')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (message.trim().length < 10) {
      setError('Please describe your issue in a bit more detail (at least 10 characters).')
      return
    }

    setIsLoading(true)

    try {
      const response = await submitSupportIssue({
        ...(user ? { userGuidId: user.guidId } : {}),
        email,
        phone,
        category,
        message,
      })

      if (response.error) {
        setError(response.error)
        return
      }

      setSuccess('Your issue has been submitted. Our team will reach out shortly ⚓')
      setSubmitted(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to submit your issue right now.')
    } finally {
      setIsLoading(false)
    }
  }

  // ───────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col items-center justify-center bg-[#F8FAFC] dark:bg-[#0B1220] px-4 py-12 min-h-screen">

      {/* App Title / Branding */}
      <div className="flex flex-col items-center justify-center mb-6 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#0D9488]/25 bg-[#0D9488]/10 px-3.5 py-1 text-xs font-semibold text-[#0D9488] dark:text-teal-300 mb-3">
          QuizNurse Academic & Technical Support
        </div>
        <div className="flex items-center justify-center gap-2">
          <span className="text-2xl md:text-3xl lg:text-4xl font-extrabold text-slate-600 dark:text-slate-300">
            Support at
          </span>
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-extrabold text-[#142B4A] dark:text-white">
            {APP_NAME}
          </h1>
          <FiCheckCircle className="text-[#0D9488] text-xl md:text-2xl" title="Verified" />
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
          Having trouble? Tell us what happened and we&apos;ll help you sort it out.
        </p>
      </div>

      {/* Card Container */}
      <div className="max-w-5xl w-full bg-white dark:bg-[#111C2E] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg grid grid-cols-1 md:grid-cols-2 overflow-hidden">

        {/* LEFT SIDE: Photo */}
        <div className="hidden md:flex relative w-full h-full items-end justify-center overflow-hidden bg-[#142B4A]">
          <Image
            src="/web/auth/support/supportFoto.jpg"
            alt="Support"
            layout="fill"
            objectFit="cover"
            priority
            className="z-0 opacity-85"
          />

          <div className="z-10 w-full p-8 bg-gradient-to-t from-[#142B4A] via-[#142B4A]/70 to-transparent text-white text-left">
            <span className="inline-block rounded-full bg-[#0D9488] px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white mb-2">
              Learner Care
            </span>
            <h2 className="text-2xl font-extrabold">We&apos;ve Got You Covered</h2>
            <p className="text-sm text-slate-200 mt-2 leading-relaxed">
              Let us know what&apos;s going on and our support specialists will follow up directly.
            </p>
          </div>
        </div>

        {/* RIGHT SIDE: Form */}
        <div className="w-full p-8 space-y-6 border-l border-slate-200 dark:border-slate-800">

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
                  className="font-bold opacity-70 hover:opacity-100"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {!submitted ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                  Email
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

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                  Phone
                </label>
                <PhoneInput
                  international
                  defaultCountry="US"
                  value={phone}
                  onChange={handlePhoneChange}
                  name="phone"
                  disabled={!!user}
                  className={`w-full border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2.5 focus-within:ring-2 focus-within:ring-[#0D9488]/30 focus-within:border-[#0D9488] transition-all ${
                    user ? 'bg-slate-100 dark:bg-slate-800 cursor-not-allowed' : 'bg-white dark:bg-slate-900'
                  }`}
                  countrySelectProps={{ className: 'text-[#0D9488] text-sm' }}
                />

                <style jsx global>{`
                  .PhoneInputInput {
                    width: 100%;
                    font-size: 0.875rem;
                    padding: 0;
                    color: inherit;
                    background-color: transparent;
                    border: none;
                    outline: none;
                    box-shadow: none;
                  }
                  .PhoneInputInput:focus {
                    outline: none;
                    box-shadow: none;
                  }
                `}</style>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                  What&apos;s this about?
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as IssueCategory)}
                  className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl px-3 py-2.5 text-sm text-[#0F172A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 focus:border-[#0D9488]"
                >
                  <option value="Unable To Access Account">Unable To Access Account</option>
                  <option value="Account Recovery Problem">Account Recovery Problem</option>
                  <option value="Payment / Billing Issue">Payment / Billing Issue</option>
                  <option value="Exam or Technical Issue">Exam or Technical Issue</option>
                  <option value="Something Else">Something Else</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                  Describe your issue
                </label>
                <textarea
                  required
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Tell us what happened, what you expected, and any error messages you saw…"
                  className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl px-3 py-2.5 text-sm text-[#0F172A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 focus:border-[#0D9488] resize-none"
                />
                <p className="text-xs text-slate-400 mt-1">{message.length} characters</p>
              </div>

              <button
                type="submit"
                disabled={isLoading || userLoading}
                className="w-full bg-[#142B4A] hover:bg-[#1E3A5F] text-white py-3 rounded-xl text-sm font-semibold transition disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Submitting…' : userLoading ? 'Checking Your Session…' : 'Submit Issue'}
              </button>
            </form>
          ) : (
            <div className="text-center space-y-3 py-6">
              <FiCheckCircle className="text-[#0D9488] text-4xl mx-auto" />
              <h3 className="text-lg font-bold text-[#0F172A] dark:text-white">Thanks for Reaching Out</h3>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                We&apos;ve logged your issue and will follow up at {email} or by phone shortly.
              </p>
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
              href="/auth/recovery/password"
              className="flex-1 text-center bg-[#F8FAFC] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold py-2.5 px-4 rounded-xl hover:border-[#0D9488] hover:text-[#0D9488] transition"
            >
              Forgot Password?
            </Link>
          </div>

          <div className="mt-3 flex flex-row w-full">
            <Link
              href="/auth/recovery/social"
              className="flex-1 text-center bg-[#F8FAFC] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold py-2.5 px-4 rounded-xl hover:border-[#0D9488] hover:text-[#0D9488] transition"
            >
              Switch to Email and Password / PIN?
            </Link>
          </div>

        </div>
      </div>
    </div>
  )
}

// The End By B.L.S.M.C - [SkewBlanc] - The Winds Chase Us ⚓
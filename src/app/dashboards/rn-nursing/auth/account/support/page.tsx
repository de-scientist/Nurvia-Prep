'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useFlexPageClasp } from "@/lib/contexts/panel/layout/utils/FlexPageClasp";
import { FiCheckCircle, FiMail } from 'react-icons/fi'
import { APP_NAME } from '@/lib/config/config'
import { CountryCode } from 'libphonenumber-js'
import PhoneInput from 'react-phone-number-input'
import { isValidPhoneNumber } from 'react-phone-number-input'
import 'react-phone-number-input/style.css'
import { submitSupportIssue } from '@/lib/services/auth/supportService'
import { useCurrentSystemUser } from '@/lib/hooks/users/account/current/useCurrentSystemUser'

// ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

const TARGET_PROGRAM = "rn-nursing";

type IssueCategory =
  | 'login_issue'
  | 'account_recovery'
  | 'payment_billing'
  | 'exam_technical'
  | 'other'

// ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export default function SupportPage() {
  const { leftWidth, rightWidth, navHeight } = useFlexPageClasp();
  const { user, loading: userLoading } = useCurrentSystemUser()
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [phoneValid, setPhoneValid] = useState(false)
  const [phoneTouched, setPhoneTouched] = useState(false)
  const [category, setCategory] = useState<IssueCategory>('login_issue')
  const [message, setMessage] = useState('')

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const [userCountry, setUserCountry] = useState<CountryCode | undefined>('US')

  useEffect(() => {
    const browserLocale = navigator.language || 'en-US'
    const countryCode = browserLocale.split('-')[1]?.toUpperCase() as CountryCode
    setUserCountry(countryCode)
  }, [])

  useEffect(() => {
    if (!user) return
    const primaryPhone = user.phones?.find(p => p.isPrimary)?.phoneNumber

    if (user.email) setEmail(user.email)
    if (primaryPhone) {
      setPhone(primaryPhone)
      setPhoneValid(isValidPhoneNumber(primaryPhone))
    }
  }, [user])

  const handlePhoneChange = (value: string | undefined) => {
    const phoneVal = value || ''
    if (!phoneTouched) setPhoneTouched(true)
    setPhone(phoneVal)
    setPhoneValid(isValidPhoneNumber(phoneVal))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!phoneValid) {
      setError('Please enter a valid phone number.')
      return
    }

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

  // ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

  return (
    <main
      className="pt-16 flex flex-col items-center justify-center gap-4 text-center px-4"
      style={{ marginLeft: leftWidth, marginRight: rightWidth, minHeight: `calc(100vh - ${navHeight}px)` }}>

      {/* App Title / Branding */}
      <div className="flex flex-col items-center justify-center mb-3 text-center">
        <div className="flex items-center justify-center gap-2">
          <span className="text-2xl md:text-3xl font-bold text-slate-600 dark:text-slate-300">
            Support at
          </span>
          <h1 className="text-2xl md:text-3xl font-bold text-[#142B4A] dark:text-white">
            {APP_NAME}
          </h1>
          <FiCheckCircle className="text-[#0D9488] text-xl md:text-2xl" title="Verified" />
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Having trouble? Tell us what happened and our clinical support team will help you resolve it.
        </p>
      </div>

      {/* Card Container */}
      <div className="max-w-5xl w-full bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl grid grid-cols-1 md:grid-cols-2 overflow-hidden text-left">

        {/* LEFT SIDE: Photo */}
        <div className="hidden md:flex relative w-full h-full items-end justify-center overflow-hidden">
          <Image
            src="/web/auth/support/supportFoto.jpg"
            alt="Support"
            layout="fill"
            objectFit="cover"
            priority
            className="z-0"
          />

          <div className="z-10 w-full p-8 bg-gradient-to-t from-[#142B4A]/95 via-[#142B4A]/60 to-transparent text-white text-center">
            <h2 className="text-2xl font-bold">We&apos;re Here to Help</h2>
            <p className="text-sm text-slate-200 mt-2">
              Let us know what&apos;s going on and our team will follow up directly.
            </p>
          </div>
        </div>

        {/* RIGHT SIDE: Form */}
        <div className="w-full p-6 md:p-8 space-y-5 border-l border-slate-200 dark:border-slate-800">

          {/* Alert Message */}
          {(error || success) && (
            <div className="flex justify-center">
              <div
                role="alert"
                className={`relative max-w-md w-full px-4 py-3 rounded-xl text-sm flex items-center gap-3
                ${error ? 'bg-rose-50 border border-rose-200 text-rose-800' : ''}
                ${success ? 'bg-teal-50 border border-teal-200 text-[#0D9488]' : ''}`}
              >
                <span className="flex items-center justify-center leading-none">
                  {error ? '⚠️' : '✔️'}
                </span>
                <span className="flex-1 leading-tight">{error || success}</span>
                <button
                  type="button"
                  onClick={() => { setError(''); setSuccess('') }}
                  className="absolute top-2 right-2 font-bold opacity-70 hover:opacity-100"
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
                  Your Email
                  {userLoading && <span className="ml-2 text-xs text-slate-400">(checking session...)</span>}
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
                    className={`w-full border border-slate-300 dark:border-slate-700 rounded-xl pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/20 ${user ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 cursor-not-allowed' : 'text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900'
                      }`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                  Your Phone {' '}
                  {phone && phone.length > 6 && !phoneValid && (
                    <span className="text-rose-500 text-xs">(Invalid phone number)</span>
                  )}
                </label>
                <PhoneInput
                  international
                  defaultCountry={userCountry}
                  value={phone}
                  onChange={handlePhoneChange}
                  name="phone"
                  disabled={!!user}
                  className={`w-full border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2.5 focus-within:border-[#0D9488] focus-within:ring-2 focus-within:ring-[#0D9488]/20 transition-all ${user ? 'bg-slate-100 dark:bg-slate-800 cursor-not-allowed' : 'bg-white dark:bg-slate-900'
                    }`}
                  countrySelectProps={{ className: 'text-[#142B4A] text-sm' }}
                />

                <style jsx global>{`
                  .PhoneInputInput {
                    width: 100%;
                    font-size: 0.875rem;
                    padding: 0;
                    color: #0f172a;
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
                  What&apos;s this About?
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as IssueCategory)}
                  className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/20"
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
                  Describe Your Issue
                </label>
                <textarea
                  required
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Tell us what happened, what you expected, and any error messages you saw..."
                  className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/20 resize-none"
                />
                <p className="text-xs text-slate-400 mt-1">{message.length} characters</p>
              </div>

              <button
                type="submit"
                disabled={isLoading || userLoading}
                className="w-full bg-[#142B4A] hover:bg-[#0D9488] text-white py-2.5 rounded-xl font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Submitting...' : userLoading ? 'Checking Your Session...' : 'Submit Issue'}
              </button>
            </form>
          ) : (
            <div className="text-center space-y-3 py-4">
              <FiCheckCircle className="text-[#0D9488] text-4xl mx-auto" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Thanks for Reaching Out</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                We&apos;ve logged your issue and will follow up at {email} or by phone shortly.
              </p>
            </div>
          )}

          {/* Links */}
          <div className="mt-4 flex flex-row gap-3 w-full">
            <Link
              href={`/dashboards/${TARGET_PROGRAM}/auth/login`}
              className="flex-1 text-center bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold py-2.5 px-4 rounded-xl hover:border-[#0D9488] hover:text-[#0D9488] transition-colors"
            >
              Back to Login
            </Link>
            <Link
              href={`/dashboards/${TARGET_PROGRAM}/auth/account/recovery/password`}
              className="flex-1 text-center bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold py-2.5 px-4 rounded-xl hover:border-[#0D9488] hover:text-[#0D9488] transition-colors"
            >
              Forgot Password?
            </Link>
          </div>

          <div className="mt-2 flex flex-row w-full">
            <Link
              href={`/dashboards/${TARGET_PROGRAM}/auth/account/recovery/social`}
              className="flex-1 text-center bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold py-2.5 px-4 rounded-xl hover:border-[#0D9488] hover:text-[#0D9488] transition-colors"
            >
              Switch to Email &amp; Password / PIN
            </Link>
          </div>

        </div>
      </div>
    </main>
  )
}

// ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

// The End By B.L.S.M.C - [SkewBlanc] - The Winds Chase Us ⚓

// ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

'use client'

import { useState, useEffect } from 'react'
import { FiCheckCircle, FiMail } from 'react-icons/fi'
import { CountryCode } from 'libphonenumber-js'
import PhoneInput from 'react-phone-number-input'
import 'react-phone-number-input/style.css'
import { submitSupportIssue } from '@/lib/services/auth/supportService'
import { useCurrentSystemUser } from '@/lib/hooks/users/account/current/useCurrentSystemUser'
import Image from 'next/image'

// ─────────────────────────────────────────────────────────────────────────────

export type IssueCategory =
    | 'login_issue'
    | 'account_recovery'
    | 'payment_billing'
    | 'exam_technical'
    | 'other'

const CATEGORY_OPTIONS: { value: IssueCategory; label: string }[] = [
    { value: 'login_issue', label: "I can't log in" },
    { value: 'account_recovery', label: 'Account recovery problem' },
    { value: 'payment_billing', label: 'Payment / billing issue' },
    { value: 'exam_technical', label: 'Exam or technical issue' },
    { value: 'other', label: 'Something else' },
]

// Lenient check: E.164 shape only (+ and 8–15 digits). No area-code dictionary.
const isAcceptablePhone = (value: string) => /^\+\d{8,15}$/.test(value)

// ─────────────────────────────────────────────────────────────────────────────

type ContactProps = {
    id?: string
    heading?: string
    subheading?: string
    defaultCategory?: IssueCategory
    categories?: IssueCategory[]   // limit which options show; defaults to all
    className?: string
    onSubmitted?: () => void
}

export default function Contact({
    id = 'contact',
    heading = 'Need Help? Contact Us',
    subheading = "Tell us what happened and we'll help you sort it out.",
    defaultCategory = 'other',
    categories,
    className = '',
    onSubmitted,
}: ContactProps) {
    const { user, loading: userLoading } = useCurrentSystemUser()

    const [email, setEmail] = useState('')
    const [phone, setPhone] = useState('')
    const [phoneValid, setPhoneValid] = useState(false)
    const [category, setCategory] = useState<IssueCategory>(defaultCategory)
    const [message, setMessage] = useState('')

    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')
    const [submitted, setSubmitted] = useState(false)

    const [userCountry, setUserCountry] = useState<CountryCode | undefined>('US')

    const options = categories
        ? CATEGORY_OPTIONS.filter((o) => categories.includes(o.value))
        : CATEGORY_OPTIONS

    useEffect(() => {
        const browserLocale = navigator.language || 'en-US'
        const countryCode = browserLocale.split('-')[1]?.toUpperCase() as CountryCode | undefined
        setUserCountry(countryCode ?? 'US')
    }, [])

    // Prefill from the signed-in user
    useEffect(() => {
        if (!user) return
        const primaryPhone = user.phones?.find((p) => p.isPrimary)?.phoneNumber

        if (user.email) setEmail(user.email)
        if (primaryPhone) {
            const normalized = primaryPhone.startsWith('+')
                ? primaryPhone
                : '+' + primaryPhone.replace(/\D/g, '')
            setPhone(normalized)
            setPhoneValid(isAcceptablePhone(normalized))
        }
    }, [user])

    const handlePhoneChange = (value: string | undefined) => {
        const phoneVal = value || ''
        setPhone(phoneVal)
        setPhoneValid(isAcceptablePhone(phoneVal))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')

        if (!phoneValid) {
            setError('Please enter a valid phone number.')
            return
        }

        if (message.trim().length < 10) {
            setError('Please Describe your issue in a Bit More Details (at least 10 characters).')
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

            setSubmitted(true)
            onSubmitted?.()
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Unable to submit your issue right now.')
        } finally {
            setIsLoading(false)
        }
    }

    const resetForm = () => {
        setSubmitted(false)
        setMessage('')
        setError('')
        setCategory(defaultCategory)
    }

    // ───────────────────────────────────────────────────────────────────────────

    return (
        <section
            id={id}
            className={`py-14 px-4 sm:px-6 bg-[#F8FAFC] dark:bg-[#111C2E]/60 border-t border-slate-200 dark:border-slate-800 ${className}`}
        >
            <div className="mx-auto max-w-5xl">
                <div className="text-center mb-8 space-y-2">
                    <span className="text-xs font-bold uppercase tracking-widest text-[#0D9488]">
                        ACADEMIC &amp; TECHNICAL SUPPORT
                    </span>
                    <h2 className="font-brand text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white">{heading}</h2>
                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{subheading}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">

                    {/* LEFT: image (hidden on phones, same height as the form) */}
                    <div className="hidden md:block relative w-full h-full rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm">
                        <Image
                            src="/components/sections/support.png"
                            alt="Customer support"
                            fill
                            sizes="(min-width: 768px) 50vw, 0px"
                            className="object-cover"
                            priority
                        />
                    </div>

                    {/* RIGHT: form */}
                    <div className="bg-white dark:bg-[#0B1220] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 md:p-8 w-full">
                        {error && (
                            <div role="alert" className="relative mb-4 px-4 py-3 rounded-xl text-sm flex items-center gap-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200">
                                <span>⚠️</span>
                                <span className="flex-1 leading-tight">{error}</span>
                                <button
                                    type="button"
                                    onClick={() => setError('')}
                                    className="font-bold hover:text-rose-900"
                                    aria-label="Dismiss error"
                                >
                                    ✕
                                </button>
                            </div>
                        )}

                        {!submitted ? (
                            <form onSubmit={handleSubmit} className="space-y-4">
                                {/* Email */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                                        Enter your Email
                                        {userLoading && (
                                            <span className="ml-2 text-xs text-slate-400">(checking session . . .)</span>
                                        )}
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
                                            placeholder="you@example.com"
                                            className={`w-full border border-slate-300 dark:border-slate-700 rounded-lg pl-10 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D9488] ${user ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100'
                                                }`}
                                        />
                                    </div>
                                </div>

                                {/* Phone */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                                        Enter your Phone{' '}
                                        {phone && phone.length > 6 && !phoneValid && (
                                            <span className="text-rose-600 text-xs">(Invalid phone number)</span>
                                        )}
                                    </label>
                                    <PhoneInput
                                        international
                                        defaultCountry={userCountry}
                                        value={phone}
                                        onChange={handlePhoneChange}
                                        name="phone"
                                        disabled={!!user && !!phone}
                                        className={`w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-900 focus-within:ring-2 focus-within:ring-[#0D9488] transition-all ${user && phone ? 'bg-slate-100 dark:bg-slate-800 cursor-not-allowed' : ''
                                            }`}
                                        countrySelectProps={{ className: 'text-slate-800 dark:text-slate-200 text-sm' }}
                                    />

                                    <style jsx global>{`
                    .PhoneInputInput {
                      width: 100%;
                      font-size: 0.875rem;
                      padding: 0;
                      color: #0F172A;
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

                                {/* Category */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                                        What&apos;s this About ?
                                    </label>
                                    <select
                                        value={category}
                                        onChange={(e) => setCategory(e.target.value as IssueCategory)}
                                        className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
                                    >
                                        {options.map((o) => (
                                            <option key={o.value} value={o.value}>
                                                {o.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Message */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                                        Kindly Describe your issue
                                    </label>
                                    <textarea
                                        required
                                        rows={5}
                                        value={message}
                                        onChange={(e) => setMessage(e.target.value)}
                                        placeholder="Tell us what happened, what you expected, and any error messages you saw . . ."
                                        className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0D9488] resize-none"
                                    />
                                    <p className="text-xs text-slate-400 mt-1">{message.length} characters</p>
                                </div>

                                <button
                                    type="submit"
                                    disabled={isLoading || userLoading}
                                    className="w-full bg-[#142B4A] hover:bg-[#0F2036] dark:bg-[#0D9488] dark:hover:bg-[#0F766E] text-white py-2.5 rounded-lg font-semibold text-sm transition disabled:opacity-70 disabled:cursor-not-allowed"
                                >
                                    {isLoading
                                        ? 'Submitting…'
                                        : userLoading
                                            ? 'Checking Your Session…'
                                            : 'Submit Message'}
                                </button>
                            </form>
                        ) : (
                            <div className="text-center space-y-3 py-6">
                                <FiCheckCircle className="text-[#059669] text-4xl mx-auto" />
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Thanks for Reaching Out</h3>
                                <p className="text-sm text-slate-600 dark:text-slate-300">
                                    We&apos;ve logged your inquiry and will follow up at {email} or by phone shortly.
                                </p>
                                <button
                                    type="button"
                                    onClick={resetForm}
                                    className="mt-2 text-xs font-semibold border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-[#0D9488] hover:bg-slate-50 dark:hover:bg-slate-800"
                                >
                                    Send Another Message
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </section>
    )
}
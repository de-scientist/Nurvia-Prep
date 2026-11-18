'use client'

import { useState, useEffect } from 'react'
import { useFlexPageClasp } from "@/lib/contexts/panel/layout/utils/FlexPageClasp";
import Link from 'next/link'
import { FcGoogle } from 'react-icons/fc'
import { FaEye, FaEyeSlash } from 'react-icons/fa'
import { FiCheckCircle } from 'react-icons/fi'
import 'react-phone-number-input/style.css'
import { useRouter } from 'next/navigation'
import { CountryCode } from 'libphonenumber-js'
import PhoneInput from "react-phone-number-input"
import { isValidPhoneNumber } from 'react-phone-number-input'
import { APP_NAME } from '@/lib/config/config';
import { registerUser } from '@/lib/services/auth/registerService'
import Image from 'next/image'
import { session } from '@/lib/services/auth/sessionService'
import { redirectToSocialProvider } from '@/lib/services/auth/socialService'

const role = "Learner"; // hidden, fixed role
const TARGET_PROGRAM = "nclex-pn";
const LOGIN_PATH = `/dashboards/${TARGET_PROGRAM}/auth/login`;

// ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

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

    // ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

    const { leftWidth, rightWidth, navHeight } = useFlexPageClasp();

    const [passwordRequirements, setPasswordRequirements] = useState({
        length: false,
        uppercase: false,
        number: false,
        specialChar: false,
    })
    const showPinFields = form.loginMethod === "pin" || form.loginMethod === "both"

    const [phoneValid, setPhoneValid] = useState(false)
    const [phoneTouched, setPhoneTouched] = useState(false)
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [isAuthenticated, setIsAuthenticated] = useState(false)
    const router = useRouter()
    const handleSocialClick = (provider: Parameters<typeof redirectToSocialProvider>[0]['provider']) => {
        redirectToSocialProvider({ provider, context: 'register' }).catch((err) => {
            console.error(`Social redirect (${provider}) failed:`, err)
            setError('Could not start social sign-up. Please try again.')
        })
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target
        setForm(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value,
        }))


        // Check password requirements when password changes
        if (name === 'password') {
            setPasswordRequirements({
                length: value.length >= 6,
                uppercase: /[A-Z]/.test(value),
                number: /\d/.test(value),
                specialChar: /[!@#$%^&*(),.?":{}|<>]/.test(value),
            })
        }
    }

    // ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
    // Check if the User in Logged In
    useEffect(() => {
        const checkAuth = async () => {
            try {
                const data = await session.check()

                // 🔹 Debug log only
                console.log("➡️ Login status check:", {
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

    useEffect(() => {
        const match = document.cookie.match(/(?:^|; )socialError=([^;]*)/);
        if (match) {
            setError(decodeURIComponent(match[1]));
            document.cookie = 'socialError=; path=/; max-age=0';
        }
    }, []);

    // ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

    const [userCountry, setUserCountry] = useState<CountryCode | undefined>("US")

    useEffect(() => {
        const browserLocale = navigator.language || "en-US"
        const countryCode = browserLocale.split("-")[1]?.toUpperCase() as CountryCode
        setUserCountry(countryCode)
    }, [])


    const handlePhoneChange = (value: string | undefined) => {
        const phone = value || ''

        if (!phoneTouched) {
            setPhoneTouched(true)
        }

        setForm(prev => ({ ...prev, phone }))
        setPhoneValid(isValidPhoneNumber(phone))
    }

    const generatePassword = () => {
        const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const lower = 'abcdefghijklmnopqrstuvwxyz';
        const digits = '0123456789';
        const specials = '!@#$%^&*()-_=+[]{};:,.<>?';
        const allChars = upper + lower + digits + specials;

        let password = '';

        // Ensure at least one of each required type for generated password
        password += upper.charAt(Math.floor(Math.random() * upper.length));
        password += lower.charAt(Math.floor(Math.random() * lower.length));
        password += digits.charAt(Math.floor(Math.random() * digits.length));
        password += specials.charAt(Math.floor(Math.random() * specials.length));

        // Fill the rest randomly (12 more chars to make length ~16)
        for (let i = 0; i < 12; i++) {
            password += allChars.charAt(Math.floor(Math.random() * allChars.length));
        }

        // Shuffle the password
        password = password.split('').sort(() => 0.5 - Math.random()).join('');

        // Update form
        setForm(prev => ({
            ...prev,
            password,
            confirmPassword: password
        }));

        // Set password requirements as satisfied for generated password
        setPasswordRequirements({
            length: true,
            uppercase: true,
            number: true,
            specialChar: true, // generated password always has special char
        });
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!form.agree) {
            setError('You must agree to the terms to continue.')
            return
        }

        if (form.loginMethod !== "pin" && form.password !== form.confirmPassword) {
            setError('Passwords do not match!')
            return
        }

        if (!phoneValid) {
            setError('Please enter a valid phone number with at least 10 digits.')
            return
        }

        if (form.loginMethod !== "pin" && !passwordRequirements.length) {
            setError('Password must be at least 6 characters.')
            return
        }

        setIsLoading(true)
        setError('')
        setSuccess('')

        try {
            // Call registerService instead of Axios
            const response = await registerUser({
                username: form.username,
                email: form.email,
                phone: form.phone,
                password: form.loginMethod !== "pin" ? form.password : undefined,
                passwordConfirmation: form.loginMethod !== "pin" ? form.confirmPassword : undefined,
                pin: form.loginMethod !== "password" ? form.pin : undefined,
                pin_confirmation: form.loginMethod !== "password" ? form.pin_confirmation : undefined,
                loginMethod: form.loginMethod,
                agree: form.agree,
                role: role,
                dashboardName: 'web',
                provider: 'email',
                providerPayload: 'Void',
                challenge: "register-skew8@lancasto",
            })

            if (response.error) {
                setError(response.error)
            } else {
                // Redirect to login with success message and pre-filled email
                router.push(`${LOGIN_PATH}?registered=true&email=${encodeURIComponent(form.email)}`)
            }

        } catch (err: unknown) {
            console.error('💥 Registration error:', err)
            setError(err instanceof Error ? err.message : 'Unexpected registration error')
        } finally {
            setIsLoading(false)
        }

    }

    // ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

    return (
        <main
            className={`py-16 transition-all duration-300 ease-in-out overflow-x-hidden flex flex-col items-center justify-center relative  }`}
            style={{
                marginLeft: leftWidth,
                marginRight: rightWidth,
                minHeight: `calc(100vh - ${navHeight}px)`,
                backgroundColor: "var(--content-bg)",
                color: "var(--content-text)",
            }}
        >
            <div>

                {/* App Title / Branding */}
                <div className="flex flex-col items-center justify-center my-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                        <span className="text-2xl md:text-3xl font-bold text-slate-600 dark:text-slate-300">
                            Welcome to
                        </span>
                        <h1 className="text-2xl md:text-3xl font-bold text-[#142B4A] dark:text-white">
                            {APP_NAME}
                        </h1>
                        <FiCheckCircle
                            className="text-[#0D9488] text-xl md:text-2xl"
                            title="Verified"
                        />
                    </div>

                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Your clinical preparation platform for nursing licensure and admissions.
                    </p>
                </div>

                {/* Login Card Container */}
                <div className="max-w-5xl w-full bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl grid grid-cols-1 md:grid-cols-2 overflow-hidden">

                    {/* LEFT SIDE: Full Image Background + Text at Bottom */}
                    <div className="hidden md:flex relative w-full h-full items-end justify-center overflow-hidden">
                        {/* Background Image */}
                        <Image
                            src="/auth/loginImage.jpg"
                            alt="Welcome"
                            layout="fill"
                            objectFit="cover"
                            priority
                            className="z-0"
                        />

                        {/* Top Social Login Buttons Overlay */}
                        <div className="absolute top-0 left-0 z-10 w-full p-4">
                            <div className="bg-[#142B4A]/70 backdrop-blur-md rounded-2xl p-4 shadow-lg border border-white/15">
                                <button
                                    type="button"
                                    className="w-full flex items-center justify-center gap-2 bg-white border border-slate-200 px-4 py-2.5 rounded-xl hover:bg-slate-50 transition text-slate-800 font-semibold text-sm shadow-xs"
                                    onClick={() => handleSocialClick('google')}
                                >
                                    <FcGoogle className="text-xl" />
                                    Continue with Google
                                </button>
                            </div>
                        </div>

                        {/* Bottom Text Overlay */}
                        <div className="z-10 w-full p-8 bg-gradient-to-t from-[#142B4A]/95 via-[#142B4A]/60 to-transparent text-white text-center">
                            {isAuthenticated ? (
                                <>
                                    <h2 className="text-2xl font-bold">Welcome Back!</h2>
                                    <p className="text-sm text-slate-200 mt-2">
                                        You&apos;re already signed in. Ready to continue your {APP_NAME} preparation?
                                    </p>
                                </>
                            ) : (
                                <>
                                    <h2 className="text-2xl font-bold">Join {APP_NAME}</h2>
                                    <p className="text-sm text-slate-200 mt-2">
                                        Create your learner account for structured exam prep, rationales, and analytics.
                                    </p>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="w-full p-6 md:p-8 bg-white dark:bg-[#111C2E] space-y-3 border-l border-slate-200 dark:border-slate-800">

                        {/* Mobile-only Social Login Buttons */}
                        <div className="md:hidden">
                            <button
                                type="button"
                                className="w-full flex items-center justify-center gap-2 bg-white border border-slate-300 px-4 py-2.5 rounded-xl hover:bg-slate-50 transition text-slate-700 font-semibold text-sm"
                                onClick={() => handleSocialClick('google')}
                            >
                                <FcGoogle className="text-xl" />
                                Continue with Google
                            </button>
                        </div>

                        <div className="text-center text-xs uppercase tracking-wider font-semibold text-slate-400">
                            or register with email
                        </div>

                        {/* Alert Message */}
                        {(error || success) && (
                            <div className="flex justify-center">
                                <div
                                    role="alert"
                                    className={`relative max-w-md w-full px-4 py-3 rounded-xl text-sm flex items-center gap-3
                                    ${error ? 'bg-rose-50 border border-rose-200 text-rose-800' : ''}
                                    ${success ? 'bg-teal-50 border border-teal-200 text-[#0D9488]' : ''}
                                `}
                                >
                                    <span className="flex items-center justify-center leading-none">
                                        {error ? '⚠️' : '✅'}
                                    </span>
                                    <span className="flex-1 leading-tight">
                                        {error || success}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setError('')
                                            setSuccess('')
                                        }}
                                        className="absolute top-2 right-2 font-bold opacity-70 hover:opacity-100"
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
                                    onClick={() => router.push(`/dashboards/${TARGET_PROGRAM}`)}
                                    className="w-full bg-[#142B4A] hover:bg-[#0D9488] text-white py-2.5 rounded-xl font-semibold transition-colors"
                                >
                                    Continue to Dashboard
                                </button>
                            </div>
                        ) : (
                            <form onSubmit={handleRegister} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">Username</label>
                                    <input
                                        type="text"
                                        name="username"
                                        autoComplete="nickname"
                                        required
                                        value={form.username}
                                        onChange={handleChange}
                                        className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/20"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">Email Address</label>
                                    <input
                                        type="email"
                                        name="email"
                                        required
                                        value={form.email}
                                        onChange={handleChange}
                                        className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/20"
                                    />
                                </div>

                                <div className="mb-4">
                                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                                        Phone Number{' '}
                                        {form.phone && form.phone.length > 6 && !phoneValid && (
                                            <span className="text-rose-500 text-xs">(Invalid phone number)</span>
                                        )}
                                    </label>

                                    <PhoneInput
                                        international
                                        defaultCountry={userCountry}
                                        value={form.phone}
                                        onChange={handlePhoneChange}
                                        name="phone"
                                        className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl px-3 py-2.5 focus-within:border-[#0D9488] focus-within:ring-2 focus-within:ring-[#0D9488]/20 transition-all"
                                        countrySelectProps={{
                                            className: "text-[#142B4A] text-sm",
                                        }}
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

                                {/* 🔑 PASSWORD FIELDS */}
                                {(form.loginMethod === "password" || form.loginMethod === "both") && (
                                    <div className="animate-fadeIn space-y-3">
                                        <div>
                                            <div className="flex justify-between items-center mb-1.5">
                                                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                                                    Password
                                                </label>

                                                <button
                                                    type="button"
                                                    onClick={generatePassword}
                                                    className="text-xs bg-teal-50 border border-teal-200 text-[#0D9488] font-semibold px-2.5 py-1 rounded-lg hover:bg-teal-100 transition-colors"
                                                >
                                                    Generate
                                                </button>
                                            </div>

                                            <div className="relative">
                                                <input
                                                    type={showPassword ? "text" : "password"}
                                                    name="password"
                                                    required={showPinFields}
                                                    value={form.password}
                                                    maxLength={24}
                                                    onChange={handleChange}
                                                    className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/20 pr-10"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPassword(!showPassword)}
                                                    className="absolute top-2.5 right-3 text-slate-500 hover:text-slate-700"
                                                >
                                                    {showPassword ? <FaEyeSlash /> : <FaEye />}
                                                </button>
                                            </div>

                                            {/* Password Requirements */}
                                            {form.password && (
                                                <div className="mt-2 text-xs text-slate-500 space-y-1">
                                                    <p className="font-semibold">Password must contain:</p>
                                                    <ul className="space-y-1 mt-1">
                                                        <li className={passwordRequirements.length ? "text-[#0D9488] font-medium" : "text-slate-500"}>
                                                            {passwordRequirements.length ? "✓" : "•"} At Least 6 Characters
                                                        </li>
                                                        <li className={passwordRequirements.uppercase ? "text-[#0D9488] font-medium" : "text-slate-500"}>
                                                            {passwordRequirements.uppercase ? "✓" : "•"} One Uppercase Letter (Optional)
                                                        </li>
                                                        <li className={passwordRequirements.number ? "text-[#0D9488] font-medium" : "text-slate-500"}>
                                                            {passwordRequirements.number ? "✓" : "•"} One Number (Optional)
                                                        </li>
                                                        <li className={passwordRequirements.specialChar ? "text-[#0D9488] font-medium" : "text-slate-500"}>
                                                            {passwordRequirements.specialChar ? "✓" : "•"} One Special Character (Optional)
                                                        </li>
                                                    </ul>
                                                </div>
                                            )}
                                        </div>

                                        {/* CONFIRM PASSWORD */}
                                        {passwordRequirements.length && (
                                                <div>
                                                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                                                        Confirm Password
                                                    </label>

                                                    <div className="relative">
                                                        <input
                                                            type={showConfirmPassword ? "text" : "password"}
                                                            name="confirmPassword"
                                                            required={showPinFields}
                                                            value={form.confirmPassword}
                                                            onChange={handleChange}
                                                            maxLength={24}
                                                            className={`w-full border ${form.password &&
                                                                form.confirmPassword &&
                                                                form.password !== form.confirmPassword
                                                                ? "border-rose-300"
                                                                : "border-slate-300 dark:border-slate-700"
                                                                } bg-white dark:bg-slate-900 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/20 pr-10`}
                                                        />

                                                        <button
                                                            type="button"
                                                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                            className="absolute top-2.5 right-3 text-slate-500 hover:text-slate-700"
                                                        >
                                                            {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                                                        </button>
                                                    </div>

                                                    {form.password &&
                                                        form.confirmPassword &&
                                                        form.password !== form.confirmPassword && (
                                                            <p className="mt-1 text-xs text-rose-500">Passwords do not match</p>
                                                        )}
                                                </div>
                                            )}
                                    </div>
                                )}

                                <div className="flex items-start gap-2">
                                    <input
                                        type="checkbox"
                                        name="agree"
                                        checked={form.agree}
                                        onChange={handleChange}
                                        className="mt-1 accent-[#0D9488]"
                                    />
                                    <label className="text-xs text-slate-600 dark:text-slate-300">
                                        I agree to the{' '}
                                        <Link href="/pages/terms-of-service" className="text-[#0D9488] underline hover:opacity-80 font-semibold">
                                            Terms and Conditions
                                        </Link>
                                    </label>
                                </div>


                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full bg-[#142B4A] hover:bg-[#0D9488] text-white py-2.5 rounded-xl font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    {isLoading ? 'Creating Account...' : 'Create Account'}
                                </button>

                                {/* Links */}
                                <div className="my-3 flex flex-row gap-3 w-full">
                                    <Link
                                        href={`/dashboards/${TARGET_PROGRAM}/auth/account/support`}
                                        className="flex-1 text-center bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold py-2.5 px-4 rounded-xl hover:border-[#0D9488] hover:text-[#0D9488] transition-colors"
                                    >
                                        Having Issues?
                                    </Link>
                                    <Link
                                        href={`/dashboards/${TARGET_PROGRAM}/auth/login`}
                                        className="flex-1 text-center bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold py-2.5 px-4 rounded-xl hover:border-[#0D9488] hover:text-[#0D9488] transition-colors"
                                    >
                                        Sign In Instead
                                    </Link>
                                </div>

                            </form>
                        )}
                    </div>
                </div>

            </div>
        </main>

    )
}
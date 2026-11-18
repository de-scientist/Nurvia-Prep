"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FcGoogle } from "react-icons/fc";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { FiCheckCircle, FiX } from "react-icons/fi";
import "react-phone-number-input/style.css";
import { CountryCode } from "libphonenumber-js";
import PhoneInput from "react-phone-number-input";
import { APP_NAME } from "@/lib/config/config";
import { login, LoginCredentials } from "@/lib/services/auth/loginService";
import { registerUser } from "@/lib/services/auth/registerService";
import { redirectToSocialProvider } from "@/lib/services/auth/socialService";

// ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

const DEFAULT_LANDING_PATH = "/pages/entrance";
const role = "Learner";

type AuthTab = "login" | "register";

// ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

function AuthForm() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const initialTab: AuthTab = searchParams.get("tab") === "register" ? "register" : "login";
    const initialEmail = searchParams.get("email") ?? undefined;
    const initialMessage = searchParams.get("message") ?? undefined;

    const rawRedirect = searchParams.get("redirect");
    const redirectPath =
        rawRedirect && rawRedirect.startsWith("/") && !rawRedirect.startsWith("//")
            ? rawRedirect
            : undefined;

    const [tab, setTab] = useState<AuthTab>(initialTab);

    // ── Login state
    const [loginForm, setLoginForm] = useState({ email: "", password: "", remember: false });
    const [loginLoading, setLoginLoading] = useState(false);
    const [loginError, setLoginError] = useState("");
    const [loginSuccess, setLoginSuccess] = useState("");
    const [showLoginPassword, setShowLoginPassword] = useState(false);

    // ── Register state
    const [regForm, setRegForm] = useState({
        username: "",
        email: "",
        phone: "",
        password: "",
        confirmPassword: "",
        agree: false,
    });
    const [passwordRequirements, setPasswordRequirements] = useState({
        length: false,
        uppercase: false,
        number: false,
        specialChar: false,
    });
    const [showRegPassword, setShowRegPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [regLoading, setRegLoading] = useState(false);
    const [regError, setRegError] = useState("");
    const [userCountry] = useState<CountryCode | undefined>("US");

    // ── Prefill from URL params
    useEffect(() => {
        if (initialEmail) setLoginForm((prev) => ({ ...prev, email: initialEmail }));
        if (initialMessage) setLoginSuccess(initialMessage);
    }, [initialEmail, initialMessage]);

    // ── Social login error cookie
    useEffect(() => {
        const match = document.cookie.match(/(?:^|; )socialError=([^;]*)/);
        if (match) {
            const msg = decodeURIComponent(match[1]);
            if (initialTab === "register") setRegError(msg);
            else setLoginError(msg);
            document.cookie = "socialError=; path=/; max-age=0";
        }
    }, [initialTab]);

    // ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

    const switchTab = (next: AuthTab) => {
        if (next === tab) return;
        setLoginError("");
        setRegError("");
        setTab(next);
    };

    const handleSocialClick = (provider: Parameters<typeof redirectToSocialProvider>[0]["provider"]) => {
        const isLogin = tab === "login";
        redirectToSocialProvider(
            isLogin
                ? { provider, context: "login", redirectPath: DEFAULT_LANDING_PATH }
                : { provider, context: "register" }
        ).catch((err) => {
            console.error(`Social redirect (${provider}) failed:`, err);
            const msg = `Could not start social sign-${isLogin ? "in" : "up"}. Please try again.`;
            if (isLogin) setLoginError(msg);
            else setRegError(msg);
        });
    };

    // ── Login handlers
    const handleLoginChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        setLoginForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoginLoading(true);
        setLoginError("");

        try {
            const credentials: LoginCredentials = {
                email: loginForm.email,
                password: loginForm.password,
                pin: "",
                loginMethod: "password",
                LoginProvider: "email",
                loginProviderPayload: "Void",
                dashboardName: "web",
                role,
                challenge: "learner.login.skew8lancasto",
                remember: loginForm.remember,
            };

            const data = await login(credentials);

            if (data?.error) {
                setLoginError(data.error);
                setLoginSuccess("");
                return;
            }

            setLoginSuccess("Login Successful ! Redirecting . . . ⚓");
            setLoginError("");
            setTimeout(() => {
                router.push(redirectPath || DEFAULT_LANDING_PATH);
            }, 800);
        } catch (err: unknown) {
            console.error("Login failed:", err);
            setLoginError(err instanceof Error ? err.message : "Login failed. Please try again.");
        } finally {
            setLoginLoading(false);
        }
    };

    // ── Register handlers
    const handleRegChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        setRegForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));

        if (name === "password") {
            setPasswordRequirements({
                length: value.length >= 6,
                uppercase: /[A-Z]/.test(value),
                number: /\d/.test(value),
                specialChar: /[!@#$%^&*(),.?":{}|<>]/.test(value),
            });
        }
    };

    const handlePhoneChange = (value: string | undefined) => {
        const phone = value || "";
        setRegForm((prev) => ({ ...prev, phone }));
    };

    const generatePassword = () => {
        const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        const lower = "abcdefghijklmnopqrstuvwxyz";
        const digits = "0123456789";
        const specials = "!@#$%^&*()-_=+[]{};:,.<>?";
        const allChars = upper + lower + digits + specials;
        let password = "";
        password += upper.charAt(Math.floor(Math.random() * upper.length));
        password += lower.charAt(Math.floor(Math.random() * lower.length));
        password += digits.charAt(Math.floor(Math.random() * digits.length));
        password += specials.charAt(Math.floor(Math.random() * specials.length));
        for (let i = 0; i < 12; i++) {
            password += allChars.charAt(Math.floor(Math.random() * allChars.length));
        }
        password = password.split("").sort(() => 0.5 - Math.random()).join("");
        setRegForm((prev) => ({ ...prev, password, confirmPassword: password }));
        setPasswordRequirements({ length: true, uppercase: true, number: true, specialChar: true });
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!regForm.agree) {
            setRegError("You must agree to the terms to continue.");
            return;
        }
        if (regForm.password !== regForm.confirmPassword) {
            setRegError("Passwords do not match!");
            return;
        }

        if (!Object.values(passwordRequirements).every(Boolean)) {
            setRegError("Password does not meet all requirements. Please check the criteria.");
            return;
        }

        setRegLoading(true);
        setRegError("");

        try {
            const response = await registerUser({
                username: regForm.username,
                email: regForm.email,
                phone: regForm.phone,
                password: regForm.password,
                passwordConfirmation: regForm.confirmPassword,
                pin: undefined,
                pin_confirmation: undefined,
                loginMethod: "password",
                agree: regForm.agree,
                role,
                dashboardName: "web",
                provider: "email",
                providerPayload: "Void",
                challenge: "register-skew8@lancasto",
            });

            if (response.error) {
                setRegError(response.error);
            } else {
                setLoginForm((prev) => ({ ...prev, email: regForm.email, password: "" }));
                setLoginSuccess(`Account created successfully ⚓ You can now log in as ${regForm.email}`);
                setLoginError("");
                setTab("login");
            }
        } catch (err: unknown) {
            console.error("💥 Registration error:", err);
            setRegError(err instanceof Error ? err.message : "Unexpected registration error");
        } finally {
            setRegLoading(false);
        }
    };

    // ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

    const isLogin = tab === "login";

    return (
        <div className="flex min-h-[85vh] items-center justify-center bg-[#F8FAFC] dark:bg-[#0B1220] px-4 py-10">
            <div className="relative w-full max-w-lg bg-white dark:bg-[#111C2E] rounded-2xl shadow-lg border border-slate-200 dark:border-slate-800 p-6 md:p-8">
                {/* Back home */}
                <Link
                    href="/"
                    aria-label="Back home"
                    className="absolute top-4 right-4 flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-slate-800 text-slate-600 dark:text-slate-300 transition hover:border-[#0D9488] hover:text-[#0D9488]"
                >
                    <FiX className="h-5 w-5" />
                </Link>

                {/* Header */}
                <div className="text-center mb-5 pt-1">
                    <div className="inline-flex items-center gap-2 rounded-full border border-[#0D9488]/25 bg-[#0D9488]/10 px-3 py-0.5 text-[11px] font-semibold text-[#0D9488] dark:text-teal-300 mb-2">
                        NURVIA Learner Portal
                    </div>
                    <div className="flex items-center justify-center gap-2">
                        <h1 className="text-xl md:text-2xl font-extrabold text-[#142B4A] dark:text-white">{APP_NAME}</h1>
                        <FiCheckCircle className="text-[#0D9488] text-lg" title="Verified" />
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {isLogin ? "Sign in to your clinical learning workspace" : "Create your learner account"}
                    </p>
                </div>

                {/* Composite tab switch */}
                <div
                    role="tablist"
                    className="relative mx-auto mb-5 grid grid-cols-2 w-full max-w-xs rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-1"
                >
                    <span
                        aria-hidden
                        className="absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-lg bg-[#142B4A] shadow-xs transition-transform duration-300 ease-out"
                        style={{ transform: isLogin ? "translateX(0)" : "translateX(100%)" }}
                    />
                    <button
                        type="button"
                        role="tab"
                        aria-selected={isLogin}
                        onClick={() => switchTab("login")}
                        className={`relative z-10 py-2 text-xs font-semibold rounded-lg transition-colors duration-300 ${
                            isLogin ? "text-white" : "text-slate-600 dark:text-slate-300 hover:text-[#0F172A] dark:hover:text-white"
                        }`}
                    >
                        Login
                    </button>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={!isLogin}
                        onClick={() => switchTab("register")}
                        className={`relative z-10 py-2 text-xs font-semibold rounded-lg transition-colors duration-300 ${
                            !isLogin ? "text-white" : "text-slate-600 dark:text-slate-300 hover:text-[#0F172A] dark:hover:text-white"
                        }`}
                    >
                        Register
                    </button>
                </div>

                {/* Google */}
                <button
                    type="button"
                    className="w-full flex items-center justify-center gap-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 px-4 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition text-slate-700 dark:text-slate-200 font-semibold text-sm"
                    onClick={() => handleSocialClick("google")}
                >
                    <FcGoogle className="text-xl" />
                    Continue with Google
                </button>

                <div className="relative my-4 flex items-center justify-center">
                    <div className="w-full border-t border-slate-200 dark:border-slate-800" />
                    <span className="bg-white dark:bg-[#111C2E] px-3 text-xs text-slate-400 whitespace-nowrap">
                        {isLogin ? "or sign in with email" : "or sign up with email"}
                    </span>
                    <div className="w-full border-t border-slate-200 dark:border-slate-800" />
                </div>

                {/* Animated panel */}
                <div key={tab} className={isLogin ? "auth-slide-left" : "auth-slide-right"}>
                    {isLogin ? (
                        <>
                            {loginError && (
                                <div role="alert" className="mb-4 relative bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 px-4 py-3 rounded-xl text-sm flex items-center gap-3">
                                    <span className="flex-1 leading-tight">{loginError}</span>
                                    <button type="button" onClick={() => setLoginError("")} className="opacity-70 hover:opacity-100">✕</button>
                                </div>
                            )}

                            {loginSuccess && (
                                <div role="status" className="mb-4 relative bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 px-4 py-3 rounded-xl text-sm flex items-center gap-3">
                                    <FiCheckCircle className="text-emerald-600 shrink-0" />
                                    <span className="flex-1 leading-tight">{loginSuccess}</span>
                                    <button type="button" onClick={() => setLoginSuccess("")} className="opacity-70 hover:opacity-100">✕</button>
                                </div>
                            )}

                            <form onSubmit={handleLogin} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">Email Address</label>
                                    <input
                                        type="email"
                                        name="email"
                                        autoComplete="username"
                                        required
                                        value={loginForm.email}
                                        onChange={handleLoginChange}
                                        className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl px-3.5 py-2.5 text-sm text-[#0F172A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 focus:border-[#0D9488]"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">Password</label>
                                    <div className="relative">
                                        <input
                                            type={showLoginPassword ? "text" : "password"}
                                            name="password"
                                            autoComplete="current-password"
                                            required
                                            value={loginForm.password}
                                            onChange={handleLoginChange}
                                            maxLength={32}
                                            className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl px-3.5 py-2.5 pr-10 text-sm text-[#0F172A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 focus:border-[#0D9488]"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowLoginPassword(!showLoginPassword)}
                                            className="absolute top-3 right-3 text-slate-400 hover:text-slate-600"
                                        >
                                            {showLoginPassword ? <FaEyeSlash /> : <FaEye />}
                                        </button>
                                    </div>
                                </div>

                                <label className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        name="remember"
                                        checked={loginForm.remember}
                                        onChange={handleLoginChange}
                                        className="accent-[#0D9488] rounded"
                                    />
                                    Remember me
                                </label>

                                <button
                                    type="submit"
                                    disabled={loginLoading}
                                    className="w-full bg-[#142B4A] hover:bg-[#1E3A5F] text-white py-3 rounded-xl text-sm font-semibold transition disabled:opacity-70 disabled:cursor-not-allowed"
                                >
                                    {loginLoading ? "Signing in…" : "Sign In"}
                                </button>

                                <div className="flex flex-row gap-3 pt-2">
                                    <Link
                                        href="/auth/recovery/password"
                                        className="flex-1 text-center bg-[#F8FAFC] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold py-2.5 px-3 rounded-xl hover:border-[#0D9488] hover:text-[#0D9488] transition"
                                    >
                                        Forgot Password?
                                    </Link>
                                    <button
                                        type="button"
                                        onClick={() => switchTab("register")}
                                        className="flex-1 text-center bg-[#F8FAFC] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold py-2.5 px-3 rounded-xl hover:border-[#0D9488] hover:text-[#0D9488] transition"
                                    >
                                        Register Instead?
                                    </button>
                                </div>
                            </form>
                        </>
                    ) : (
                        <>
                            {regError && (
                                <p role="alert" className="mb-4 text-sm text-rose-800 dark:text-rose-200 text-center font-medium bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-xl py-2.5 px-3">
                                    {regError}
                                </p>
                            )}

                            <form onSubmit={handleRegister} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">Username</label>
                                    <input
                                        type="text"
                                        name="username"
                                        autoComplete="nickname"
                                        required
                                        value={regForm.username}
                                        onChange={handleRegChange}
                                        className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl px-3.5 py-2.5 text-sm text-[#0F172A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 focus:border-[#0D9488]"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">Email Address</label>
                                    <input
                                        type="email"
                                        name="email"
                                        required
                                        value={regForm.email}
                                        onChange={handleRegChange}
                                        className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl px-3.5 py-2.5 text-sm text-[#0F172A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 focus:border-[#0D9488]"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                                        Phone Number
                                    </label>
                                    <PhoneInput
                                        international
                                        defaultCountry={userCountry}
                                        value={regForm.phone}
                                        onChange={handlePhoneChange}
                                        name="phone"
                                        className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl px-3.5 py-2.5 focus-within:ring-2 focus-within:ring-[#0D9488]/30 focus-within:border-[#0D9488] transition-all [&_.PhoneInputInput]:text-[#0F172A] dark:[&_.PhoneInputInput]:text-white [&_.PhoneInputInput]:bg-transparent [&_.PhoneInputInput]:border-0 [&_.PhoneInputInput]:outline-none [&_.PhoneInputInput]:ring-0 [&_.PhoneInputInput]:shadow-none"
                                    />
                                </div>

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
                                                type={showRegPassword ? "text" : "password"}
                                                name="password"
                                                autoComplete="new-password"
                                                required
                                                value={regForm.password}
                                                maxLength={24}
                                                onChange={handleRegChange}
                                                className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl px-3.5 py-2.5 text-sm text-[#0F172A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 focus:border-[#0D9488] pr-10"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowRegPassword(!showRegPassword)}
                                                className="absolute top-3 right-3 text-slate-400 hover:text-slate-600"
                                            >
                                                {showRegPassword ? <FaEyeSlash /> : <FaEye />}
                                            </button>
                                        </div>

                                        {regForm.password && (
                                            <ul className="mt-2 text-xs space-y-1">
                                                <li className={passwordRequirements.length ? "text-[#0D9488] font-medium" : "text-slate-500"}>
                                                    {passwordRequirements.length ? "✓" : "•"} At Least 6 Characters
                                                </li>
                                                <li className={passwordRequirements.uppercase ? "text-[#0D9488] font-medium" : "text-slate-500"}>
                                                    {passwordRequirements.uppercase ? "✓" : "•"} One Uppercase Letter
                                                </li>
                                                <li className={passwordRequirements.number ? "text-[#0D9488] font-medium" : "text-slate-500"}>
                                                    {passwordRequirements.number ? "✓" : "•"} One Number
                                                </li>
                                                <li className={passwordRequirements.specialChar ? "text-[#0D9488] font-medium" : "text-slate-500"}>
                                                    {passwordRequirements.specialChar ? "✓" : "•"} One Special Character
                                                </li>
                                            </ul>
                                        )}
                                    </div>

                                    {passwordRequirements.length && (
                                        <div>
                                            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">Confirm Password</label>
                                            <div className="relative">
                                                <input
                                                    type={showConfirmPassword ? "text" : "password"}
                                                    name="confirmPassword"
                                                    autoComplete="new-password"
                                                    required
                                                    value={regForm.confirmPassword}
                                                    onChange={handleRegChange}
                                                    maxLength={24}
                                                    className={`w-full border ${
                                                        regForm.password && regForm.confirmPassword && regForm.password !== regForm.confirmPassword
                                                            ? "border-rose-400"
                                                            : "border-slate-300 dark:border-slate-700"
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
                                            {regForm.password && regForm.confirmPassword && regForm.password !== regForm.confirmPassword && (
                                                <p className="mt-1 text-xs text-rose-500">Passwords do not match</p>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-start gap-2">
                                    <input
                                        type="checkbox"
                                        name="agree"
                                        checked={regForm.agree}
                                        onChange={handleRegChange}
                                        className="mt-1 accent-[#0D9488]"
                                    />
                                    <label className="text-xs text-slate-600 dark:text-slate-300">
                                        I agree to the{" "}
                                        <Link
                                            href="/pages/terms-of-service"
                                            className="text-[#0D9488] font-semibold underline hover:text-[#0F766E]"
                                        >
                                            Terms and Conditions
                                        </Link>
                                    </label>
                                </div>

                                <button
                                    type="submit"
                                    disabled={regLoading}
                                    className="w-full bg-[#142B4A] hover:bg-[#1E3A5F] text-white py-3 rounded-xl text-sm font-semibold transition disabled:opacity-70 disabled:cursor-not-allowed"
                                >
                                    {regLoading ? "Creating Account…" : "Create Account"}
                                </button>

                                <div className="flex flex-row gap-3 pt-2">
                                    <Link
                                        href="/auth/support"
                                        className="flex-1 text-center bg-[#F8FAFC] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold py-2.5 px-3 rounded-xl hover:border-[#0D9488] hover:text-[#0D9488] transition"
                                    >
                                        Need Support?
                                    </Link>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setLoginForm((prev) => ({ ...prev, email: regForm.email || prev.email }));
                                            switchTab("login");
                                        }}
                                        className="flex-1 text-center bg-[#F8FAFC] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold py-2.5 px-3 rounded-xl hover:border-[#0D9488] hover:text-[#0D9488] transition"
                                    >
                                        Login Instead?
                                    </button>
                                </div>
                            </form>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────

export default function AuthPage() {
    return (
        <Suspense fallback={null}>
            <AuthForm />
        </Suspense>
    );
}

// ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
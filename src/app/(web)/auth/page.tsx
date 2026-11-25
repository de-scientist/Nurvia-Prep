"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FcGoogle } from "react-icons/fc";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { FiCheckCircle, FiAlertCircle } from "react-icons/fi";
import { ArrowRight, User, Mail, Lock } from "lucide-react";
import "react-phone-number-input/style.css";
import { CountryCode } from "libphonenumber-js";
import PhoneInput from "react-phone-number-input";
import { APP_NAME } from "@/lib/config/config";
import { login, LoginCredentials } from "@/lib/services/auth/loginService";
import { registerUser } from "@/lib/services/auth/registerService";
import { redirectToSocialProvider } from "@/lib/services/auth/socialService";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";

const DEFAULT_LANDING_PATH = "/pages/entrance";
const role = "Learner";

type AuthTab = "login" | "register";

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
    const [loginForm, setLoginForm] = useState({ email: "", password: "", remember: true });
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

            setLoginSuccess("Authentication verified! Opening your study workspace...");
            setLoginError("");
            setTimeout(() => {
                router.push(redirectPath || DEFAULT_LANDING_PATH);
            }, 700);
        } catch (err: unknown) {
            console.error("Login failed:", err);
            setLoginError(err instanceof Error ? err.message : "Login failed. Please try again.");
        } finally {
            setLoginLoading(false);
        }
    };

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

    const handlePhoneChange = (val: string | undefined) => {
        setRegForm((prev) => ({ ...prev, phone: val ?? "" }));
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

        if (!regForm.username.trim()) {
            setRegError("Please provide your name or candidate handle.");
            return;
        }
        if (!regForm.email.trim()) {
            setRegError("Candidate email address is required.");
            return;
        }
        if (regForm.password !== regForm.confirmPassword) {
            setRegError("Passwords do not match. Please verify your entries.");
            return;
        }
        if (!Object.values(passwordRequirements).every(Boolean)) {
            setRegError("Password must meet length, uppercase, number, and special character criteria.");
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
                setLoginSuccess(`Account created successfully! You can now sign in as ${regForm.email}`);
                setLoginError("");
                setTab("login");
            }
        } catch (err: unknown) {
            console.error("Registration error:", err);
            setRegError(err instanceof Error ? err.message : "Unexpected registration error");
        } finally {
            setRegLoading(false);
        }
    };

    const isLogin = tab === "login";

    return (
        <AuthShell mode={isLogin ? "sign-in" : "sign-up"}>
            <div className="mb-5 space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full border border-clinical-teal/30 bg-clinical-mist px-3 py-1 text-xs font-semibold text-clinical-teal">
                    <span className="h-2 w-2 rounded-full bg-clinical-teal animate-pulse" />
                    {isLogin ? "Learner Sign-In" : "Candidate Registration"}
                </div>
                <h1 className="font-brand text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                    {isLogin ? `Welcome back to ${APP_NAME}` : `Join ${APP_NAME}`}
                </h1>
                <p className="text-sm text-foreground-secondary leading-relaxed">
                    {isLogin
                        ? "Sign in to resume timed simulations, study sets, and performance analytics."
                        : "Create your learner profile to access evidence-based nursing question banks."}
                </p>
            </div>

            {/* Composite Pill Tab Switcher */}
            <div
                role="tablist"
                className="relative mb-5 grid grid-cols-2 w-full rounded-xl bg-surface-muted border border-border p-1"
            >
                <button
                    type="button"
                    role="tab"
                    aria-selected={isLogin}
                    onClick={() => switchTab("login")}
                    className={`relative z-10 py-2 text-xs font-semibold rounded-lg transition-all ${
                        isLogin
                            ? "bg-clinical-teal text-white shadow-sm"
                            : "text-foreground-secondary hover:text-foreground"
                    }`}
                >
                    Sign In
                </button>
                <button
                    type="button"
                    role="tab"
                    aria-selected={!isLogin}
                    onClick={() => switchTab("register")}
                    className={`relative z-10 py-2 text-xs font-semibold rounded-lg transition-all ${
                        !isLogin
                            ? "bg-clinical-teal text-white shadow-sm"
                            : "text-foreground-secondary hover:text-foreground"
                    }`}
                >
                    Create Account
                </button>
            </div>

            {/* Google Authentication */}
            <button
                type="button"
                className="w-full flex items-center justify-center gap-3 bg-white border border-border px-4 py-3 rounded-xl hover:bg-clinical-mist/50 hover:border-clinical-teal/60 transition text-foreground font-semibold text-sm shadow-xs disabled:opacity-60 dark:bg-surface"
                onClick={() => handleSocialClick("google")}
                disabled={loginLoading || regLoading}
            >
                <FcGoogle className="text-xl" />
                <span>{isLogin ? "Continue with Google" : "Sign up with Google"}</span>
            </button>

            <div className="relative my-3 flex items-center justify-center">
                <div className="w-full border-t border-border" />
                <span className="bg-surface-elevated px-3 text-xs sm:text-[13px] font-medium text-foreground-muted whitespace-nowrap">
                    {isLogin ? "or sign in with email" : "or create account with email"}
                </span>
                <div className="w-full border-t border-border" />
            </div>

            {isLogin ? (
                <>
                    {loginError && (
                        <div
                            role="alert"
                            className="mb-4 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50/80 p-3.5 text-sm text-rose-900 shadow-xs dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200"
                        >
                            <FiAlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                            <span className="flex-1 leading-snug">{loginError}</span>
                        </div>
                    )}

                    {loginSuccess && (
                        <div
                            role="status"
                            className="mb-4 flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/80 p-3.5 text-sm text-emerald-900 shadow-xs dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
                        >
                            <FiCheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                            <span className="flex-1 leading-snug">{loginSuccess}</span>
                        </div>
                    )}

                    <form onSubmit={handleLogin} className="space-y-4" noValidate>
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold uppercase tracking-wider text-foreground-secondary">
                                Email Address
                            </label>
                            <div className="relative">
                                <input
                                    type="email"
                                    name="email"
                                    autoComplete="username"
                                    required
                                    value={loginForm.email}
                                    onChange={handleLoginChange}
                                    placeholder="nurse@example.com"
                                    className="h-12 w-full rounded-xl border border-border bg-background px-3.5 pl-10 text-sm text-foreground placeholder:text-foreground-muted/60 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-teal"
                                />
                                <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-muted" />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                                <label className="text-xs font-semibold uppercase tracking-wider text-foreground-secondary">
                                    Password
                                </label>
                                <Link
                                    href="/auth/recovery/password"
                                    className="text-xs font-semibold text-clinical-teal underline-offset-4 hover:underline"
                                >
                                    Forgot Password?
                                </Link>
                            </div>
                            <div className="relative">
                                <input
                                    type={showLoginPassword ? "text" : "password"}
                                    name="password"
                                    autoComplete="current-password"
                                    required
                                    value={loginForm.password}
                                    onChange={handleLoginChange}
                                    maxLength={128}
                                    placeholder="Enter your password"
                                    className="h-12 w-full rounded-xl border border-border bg-background px-3.5 pl-10 pr-11 text-sm text-foreground placeholder:text-foreground-muted/60 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-teal"
                                />
                                <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-muted" />
                                <button
                                    type="button"
                                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                                    aria-label={showLoginPassword ? "Hide password" : "Show password"}
                                    className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-foreground-muted hover:text-foreground"
                                >
                                    {showLoginPassword ? <FaEyeSlash /> : <FaEye />}
                                </button>
                            </div>
                        </div>

                        <label className="flex items-center gap-2 text-xs font-medium text-foreground-secondary cursor-pointer select-none">
                            <input
                                type="checkbox"
                                name="remember"
                                checked={loginForm.remember}
                                onChange={handleLoginChange}
                                className="h-4 w-4 rounded border-border text-clinical-teal focus:ring-clinical-teal"
                            />
                            Remember me on this device
                        </label>

                        <Button
                            type="submit"
                            size="lg"
                            disabled={loginLoading}
                            isLoading={loginLoading}
                            className="h-12 w-full rounded-xl bg-clinical-teal text-white font-semibold shadow-md transition-all hover:bg-clinical-tealHover hover:shadow-lg active:scale-[0.99]"
                        >
                            <span>Sign In to Study Sanctuary</span>
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    </form>
                </>
            ) : (
                <>
                    {regError && (
                        <div
                            role="alert"
                            className="mb-4 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50/80 p-3.5 text-sm text-rose-900 shadow-xs dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200"
                        >
                            <FiAlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                            <span className="flex-1 leading-snug">{regError}</span>
                        </div>
                    )}

                    <form onSubmit={handleRegister} className="space-y-3.5" noValidate>
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold uppercase tracking-wider text-foreground-secondary">
                                Full Name / Candidate Handle
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    name="username"
                                    autoComplete="nickname"
                                    required
                                    value={regForm.username}
                                    onChange={handleRegChange}
                                    placeholder="Nurse Jordan, RN candidate"
                                    className="h-11 w-full rounded-xl border border-border bg-background px-3.5 pl-10 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-teal"
                                />
                                <User className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-muted" />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold uppercase tracking-wider text-foreground-secondary">
                                Candidate Email Address
                            </label>
                            <div className="relative">
                                <input
                                    type="email"
                                    name="email"
                                    required
                                    value={regForm.email}
                                    onChange={handleRegChange}
                                    placeholder="jordan@nursing.edu"
                                    className="h-11 w-full rounded-xl border border-border bg-background px-3.5 pl-10 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-teal"
                                />
                                <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-muted" />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold uppercase tracking-wider text-foreground-secondary">
                                Mobile Phone Number
                            </label>
                            <PhoneInput
                                international
                                defaultCountry={userCountry}
                                value={regForm.phone}
                                onChange={handlePhoneChange}
                                name="phone"
                                className="phone-input-custom rounded-xl border border-border bg-background px-3.5 py-2 text-sm text-foreground focus-within:ring-2 focus-within:ring-clinical-teal"
                            />
                        </div>

                        <div className="space-y-3">
                            <div className="space-y-1.5">
                                <div className="flex justify-between items-center">
                                    <label className="text-xs font-semibold uppercase tracking-wider text-foreground-secondary">
                                        Password
                                    </label>
                                    <button
                                        type="button"
                                        onClick={generatePassword}
                                        className="text-xs font-semibold text-clinical-teal hover:underline"
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
                                        maxLength={128}
                                        onChange={handleRegChange}
                                        placeholder="Min 6 characters"
                                        className="h-11 w-full rounded-xl border border-border bg-background px-3.5 pl-10 pr-10 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-teal"
                                    />
                                    <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-muted" />
                                    <button
                                        type="button"
                                        onClick={() => setShowRegPassword(!showRegPassword)}
                                        aria-label={showRegPassword ? "Hide password" : "Show password"}
                                        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-foreground-muted hover:text-foreground"
                                    >
                                        {showRegPassword ? <FaEyeSlash /> : <FaEye />}
                                    </button>
                                </div>

                                {regForm.password && (
                                    <ul className="grid grid-cols-2 gap-1 text-[11px] pt-1">
                                        <li className={passwordRequirements.length ? "text-emerald-700 font-medium" : "text-foreground-muted"}>
                                            {passwordRequirements.length ? "✓" : "•"} 6+ characters
                                        </li>
                                        <li className={passwordRequirements.uppercase ? "text-emerald-700 font-medium" : "text-foreground-muted"}>
                                            {passwordRequirements.uppercase ? "✓" : "•"} 1 uppercase
                                        </li>
                                        <li className={passwordRequirements.number ? "text-emerald-700 font-medium" : "text-foreground-muted"}>
                                            {passwordRequirements.number ? "✓" : "•"} 1 number
                                        </li>
                                        <li className={passwordRequirements.specialChar ? "text-emerald-700 font-medium" : "text-foreground-muted"}>
                                            {passwordRequirements.specialChar ? "✓" : "•"} 1 special char
                                        </li>
                                    </ul>
                                )}
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold uppercase tracking-wider text-foreground-secondary">
                                    Confirm Password
                                </label>
                                <div className="relative">
                                    <input
                                        type={showConfirmPassword ? "text" : "password"}
                                        name="confirmPassword"
                                        autoComplete="new-password"
                                        required
                                        value={regForm.confirmPassword}
                                        onChange={handleRegChange}
                                        maxLength={128}
                                        placeholder="Repeat password"
                                        className="h-11 w-full rounded-xl border border-border bg-background px-3.5 pl-10 pr-10 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-teal"
                                    />
                                    <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-muted" />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                                        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-foreground-muted hover:text-foreground"
                                    >
                                        {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="pt-1">
                            <label className="flex items-start gap-2.5 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    name="agree"
                                    checked={regForm.agree}
                                    onChange={handleRegChange}
                                    className="mt-0.5 h-4 w-4 rounded border-border text-clinical-teal focus:ring-clinical-teal"
                                />
                                <span className="text-xs leading-relaxed text-foreground-secondary">
                                    I agree to the NURVIA{" "}
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
                            disabled={regLoading}
                            isLoading={regLoading}
                            className="h-12 w-full rounded-xl bg-clinical-teal text-white font-semibold shadow-md transition-all hover:bg-clinical-tealHover hover:shadow-lg active:scale-[0.99]"
                        >
                            <span>Create Candidate Profile</span>
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    </form>
                </>
            )}
        </AuthShell>
    );
}

export default function AuthPage() {
    return (
        <Suspense fallback={null}>
            <AuthForm />
        </Suspense>
    );
}

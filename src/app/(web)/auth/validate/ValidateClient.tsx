"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FiAlertTriangle, FiCheckCircle, FiLoader } from "react-icons/fi";
import { APP_NAME } from "@/lib/config/config";
import { resolveValidation } from "@/lib/services/auth/validateService";
import { confirmEmailVerificationCode, resetCredentials } from "@/lib/services/auth/supportService";
import { useAuth } from "@/components/auth/auth-provider";

type Phase = "form" | "checking" | "credentials" | "success" | "error";
type Method = "password" | "pin" | "both";

const EMAIL_REASONS = ["verification", "registration", "login"];
const CRED_REASONS = ["password", "social"];

const REASON_LABEL: Record<string, string> = {
    verification: "Verify my email",
    registration: "Verify my new account",
    login: "Confirm my sign-in",
    password: "Reset my password",
    social: "Set up direct login",
};

interface Props {
    reason?: string;
    userGuid?: string;
    token?: string;
}

interface Ctx {
    reason: string;
    email: string;
    userGuidId: string;
    code: string;
}

export default function ValidateClient({ reason: reasonProp, userGuid, token }: Props) {
    const params = useSearchParams();
    const router = useRouter();
    const { status: authStatus, refresh } = useAuth();
    const isLink = Boolean(reasonProp && userGuid && token);

    const safeDestination = useMemo(() => {
        const requested = params.get("returnTo");
        const track = params.get("track") || params.get("pathway");

        if (requested && requested.startsWith("/") && !requested.startsWith("//")) {
            try {
                const url = new URL(requested, "http://localhost");
                if (!["/sign-in", "/sign-up", "/access-denied"].includes(url.pathname)) {
                    if (track && !url.searchParams.has("track") && !url.searchParams.has("pathway")) {
                        url.searchParams.set("track", track);
                    }
                    return `${url.pathname}${url.search}${url.hash}`;
                }
            } catch {
                // Ignore parse errors
            }
        }
        if (track) return `/learner/library?track=${encodeURIComponent(track)}`;
        return "/learner/library";
    }, [params]);

    const [reason, setReason] = useState(
        (reasonProp ?? params.get("reason") ?? "verification").toLowerCase()
    );
    const [phase, setPhase] = useState<Phase>(isLink ? "checking" : "form");
    const [message, setMessage] = useState("");
    const [ctx, setCtx] = useState<Ctx | null>(null);

    // manual code form
    const [email, setEmail] = useState(params.get("email") ?? "");
    const [code, setCode] = useState(params.get("code") ?? "");

    // credentials form
    const [method, setMethod] = useState<Method>("password");
    const [password, setPassword] = useState("");
    const [passwordConfirmation, setPasswordConfirmation] = useState("");
    const [pin, setPin] = useState("");
    const [pinConfirmation, setPinConfirmation] = useState("");
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState("");

    const ran = useRef(false); // React strict mode runs effects twice; a link must only be used once

    const fail = (msg: string) => {
        setMessage(msg);
        setPhase("error");
    };

    // Resolve (check) first, then act by reason
    const run = useCallback(async (r: string, token: string, who: { userGuidId?: string; email?: string }) => {
        setPhase("checking");
        setMessage("");

        const resolved = await resolveValidation({ context: r, token, ...who });
        if (resolved.error || !resolved.data) {
            fail(resolved.error ?? "This link or code is invalid or has expired.");
            return;
        }

        const c: Ctx = {
            reason: r,
            email: resolved.data.email,
            userGuidId: resolved.data.userGuidId,
            code: token.trim(),
        };
        setCtx(c);

        if (CRED_REASONS.includes(r)) {
            setPhase("credentials"); // the user still has to choose the new credentials
            return;
        }

        if (EMAIL_REASONS.includes(r)) {
            const res = await confirmEmailVerificationCode(c.userGuidId, c.email, c.code, c.reason);
            if (res.error || res.success === false) {
                fail(res.error ?? res.message ?? "Verification failed. Please request a new link.");
                return;
            }
            setMessage(res.message ?? "Your email has been verified.");
            setPhase("success");
            return;
        }

        fail("Unknown validation type.");
    }, []);

    // Link flow: validate automatically on load
    useEffect(() => {
        if (!isLink || ran.current) return;
        ran.current = true;
        run(reasonProp!.toLowerCase(), token!, { userGuidId: userGuid });
    }, [isLink, reasonProp, token, userGuid, run]);

    // Query-string prefill: /auth/validate?email=..&code=..&reason=.. validates automatically
    useEffect(() => {
        if (isLink || ran.current) return;
        const e = params.get("email");
        const c = params.get("code");
        if (e && c) {
            ran.current = true;
            run(reason, c, { email: e });
        }
    }, [isLink, params, reason, run]);

    const submitCode = (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim() || !code.trim()) return;
        run(reason, code, { email });
    };

    const submitCredentials = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!ctx) return;
        setFormError("");

        if (method !== "pin") {
            if (password.length < 8) return setFormError("Password must be at least 8 characters.");
            if (password !== passwordConfirmation) return setFormError("Passwords do not match.");
        }
        if (method !== "password") {
            if (!/^\d{4,24}$/.test(pin)) return setFormError("PIN must be 4 to 24 digits.");
            if (pin !== pinConfirmation) return setFormError("PINs do not match.");
        }

        setSaving(true);
        const res = await resetCredentials({
            userGuidId: ctx.userGuidId,
            email: ctx.email,
            code: ctx.code,
            context: ctx.reason as "password" | "social",
            loginMethod: method,
            password: method !== "pin" ? password : undefined,
            passwordConfirmation: method !== "pin" ? passwordConfirmation : undefined,
            pin: method !== "password" ? pin : undefined,
            pinConfirmation: method !== "password" ? pinConfirmation : undefined,
        });
        setSaving(false);

        if (res.error || res.success === false) {
            setFormError(res.error ?? res.message ?? "Could not update your credentials.");
            return;
        }
        setMessage(res.message ?? "Your credentials were updated.");
        setPhase("success");
    };

    useEffect(() => {
        if (phase === "success") {
            void refresh();
            if (authStatus === "authenticated") {
                const timer = setTimeout(() => {
                    router.push(safeDestination);
                }, 2000);
                return () => clearTimeout(timer);
            }
        }
    }, [phase, authStatus, refresh, router, safeDestination]);

    const input =
        "w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl px-3.5 py-2.5 text-sm text-[#0F172A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 focus:border-[#0D9488]";

    return (
        <div className="flex items-center justify-center bg-[#F8FAFC] dark:bg-[#0B1220] px-4 py-12 min-h-[80vh]">
            <div className="w-full max-w-md bg-white dark:bg-[#111C2E] rounded-2xl shadow-lg border border-slate-200 dark:border-slate-800 p-6 md:p-8">
                <div className="text-center mb-6">
                    <div className="inline-flex items-center gap-2 rounded-full border border-[#0D9488]/25 bg-[#0D9488]/10 px-3 py-0.5 text-[11px] font-semibold text-[#0D9488] dark:text-teal-300 mb-2">
                        NURVIA Account Verification
                    </div>
                    <h1 className="text-xl md:text-2xl font-extrabold text-[#142B4A] dark:text-white">{APP_NAME}</h1>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{REASON_LABEL[reason] ?? "Verification"}</p>
                </div>

                {phase === "checking" && (
                    <div className="py-10 text-center text-slate-600 dark:text-slate-300">
                        <FiLoader className="mx-auto mb-3 h-8 w-8 animate-spin text-[#0D9488]" />
                        <p className="text-sm font-medium">Validating…</p>
                    </div>
                )}

                {phase === "success" && (
                    <div className="py-6 text-center">
                        <FiCheckCircle className="mx-auto mb-3 h-14 w-14 text-[#0D9488]" />
                        <h2 className="text-lg font-bold text-[#0F172A] dark:text-white">Email Verified</h2>
                        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{message || "Your email address has been verified successfully."}</p>
                        {authStatus === "authenticated" ? (
                            <div className="mt-6 space-y-2">
                                <Link
                                    href={safeDestination}
                                    className="inline-block rounded-xl bg-[#142B4A] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#1E3A5F] transition-colors"
                                >
                                    Continue to Study Library
                                </Link>
                                <p className="text-xs text-slate-400">Redirecting to your destination shortly…</p>
                            </div>
                        ) : (
                            <Link
                                href={`/sign-in?returnTo=${encodeURIComponent(safeDestination)}${ctx?.email ? `&email=${encodeURIComponent(ctx.email)}` : ""}`}
                                className="mt-6 inline-block rounded-xl bg-[#142B4A] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#1E3A5F] transition-colors"
                            >
                                Sign In to Continue
                            </Link>
                        )}
                    </div>
                )}

                {phase === "error" && (
                    <div className="py-6 text-center">
                        <FiAlertTriangle className="mx-auto mb-3 h-14 w-14 text-rose-500" />
                        <h2 className="text-lg font-bold text-rose-700 dark:text-rose-400">Validation failed</h2>
                        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{message}</p>
                        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
                            <button
                                type="button"
                                onClick={() => { ran.current = true; setPhase("form"); setMessage(""); }}
                                className="rounded-xl border border-slate-300 dark:border-slate-700 px-5 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-[#0D9488] hover:text-[#0D9488]"
                            >
                                Enter a code instead
                            </button>
                            <Link
                                href="/auth/recovery/password"
                                className="rounded-xl bg-[#142B4A] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#1E3A5F]"
                            >
                                Request a new link
                            </Link>
                        </div>
                    </div>
                )}

                {phase === "form" && (
                    <form onSubmit={submitCode} className="space-y-4">
                        <p className="text-sm text-slate-600 dark:text-slate-300">
                            Enter the email you used and the verification code we sent you.
                        </p>
                        <div>
                            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">Action</label>
                            <select value={reason} onChange={(e) => setReason(e.target.value)} className={input}>
                                {Object.entries(REASON_LABEL).map(([k, v]) => (
                                    <option key={k} value={k}>{v}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">Email</label>
                            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
                        </div>
                        <div>
                            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">Verification code</label>
                            <input
                                required
                                value={code}
                                onChange={(e) => setCode(e.target.value)}
                                inputMode="text"
                                autoComplete="one-time-code"
                                className={`${input} font-mono tracking-widest`}
                            />
                        </div>
                        <button type="submit" className="w-full rounded-xl bg-[#142B4A] py-3 text-sm font-semibold text-white hover:bg-[#1E3A5F]">
                            Validate
                        </button>
                    </form>
                )}

                {phase === "credentials" && ctx && (
                    <form onSubmit={submitCredentials} className="space-y-4">
                        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 px-3.5 py-2.5 text-sm text-emerald-800 dark:text-emerald-200">
                            <FiCheckCircle className="shrink-0" />
                            Verified {ctx.email}. Choose your new credentials.
                        </div>

                        <div>
                            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">Login method</label>
                            <select value={method} onChange={(e) => setMethod(e.target.value as Method)} className={input}>
                                <option value="password">Password</option>
                                <option value="pin">PIN</option>
                                <option value="both">Password and PIN</option>
                            </select>
                        </div>

                        {method !== "pin" && (
                            <>
                                <div>
                                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">New password</label>
                                    <input type="password" autoComplete="new-password" maxLength={24} value={password}
                                        onChange={(e) => setPassword(e.target.value)} className={input} />
                                </div>
                                <div>
                                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">Confirm password</label>
                                    <input type="password" autoComplete="new-password" maxLength={24} value={passwordConfirmation}
                                        onChange={(e) => setPasswordConfirmation(e.target.value)} className={input} />
                                </div>
                            </>
                        )}

                        {method !== "password" && (
                            <>
                                <div>
                                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">New PIN (4 to 24 digits)</label>
                                    <input inputMode="numeric" maxLength={24} value={pin}
                                        onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} className={input} />
                                </div>
                                <div>
                                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">Confirm PIN</label>
                                    <input inputMode="numeric" maxLength={24} value={pinConfirmation}
                                        onChange={(e) => setPinConfirmation(e.target.value.replace(/\D/g, ""))} className={input} />
                                </div>
                            </>
                        )}

                        {formError && (
                            <p role="alert" className="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 px-3.5 py-2.5 text-sm text-rose-800 dark:text-rose-200">{formError}</p>
                        )}

                        <button type="submit" disabled={saving}
                            className="w-full rounded-xl bg-[#142B4A] py-3 text-sm font-semibold text-white hover:bg-[#1E3A5F] disabled:opacity-70">
                            {saving ? "Saving…" : "Save and continue"}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}
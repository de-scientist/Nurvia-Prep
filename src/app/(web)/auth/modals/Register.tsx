"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { FcGoogle } from "react-icons/fc";
import {
  FaEye,
  FaEyeSlash,
} from "react-icons/fa";
import { FiCheckCircle, FiX } from "react-icons/fi";
import "react-phone-number-input/style.css";
import { CountryCode } from "libphonenumber-js";
import PhoneInput from "react-phone-number-input";
import { APP_NAME } from "@/lib/config/config";
import { registerUser } from "@/lib/services/auth/registerService";
import { redirectToSocialProvider } from "@/lib/services/auth/socialService";

// ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

const role = "Learner";

// ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

interface RegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchToLogin: (email: string, message: string) => void;
}

export default function RegisterModal({ isOpen, onClose, onSwitchToLogin }: RegisterModalProps) {
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
    username: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    pin_confirmation: "",
    pin: "",
    loginMethod: "password",
    agree: false,
  });

  const [passwordRequirements, setPasswordRequirements] = useState({
    length: false,
    uppercase: false,
    number: false,
    specialChar: false,
  });

  const showPinFields = form.loginMethod === "pin" || form.loginMethod === "both";
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const [userCountry] = useState<CountryCode | undefined>("US");

  const handleSocialClick = (provider: Parameters<typeof redirectToSocialProvider>[0]['provider']) => {
    redirectToSocialProvider({ provider, context: 'register' }).catch((err) => {
      console.error(`Social redirect (${provider}) failed:`, err)
      setError('Could not start social sign-up. Please try again.')
    })
  }

  // Check 
  useEffect(() => {
    if (!isOpen) return;
    const match = document.cookie.match(/(?:^|; )socialError=([^;]*)/);
    if (match) {
      setError(decodeURIComponent(match[1]));
      document.cookie = 'socialError=; path=/; max-age=0';
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));

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
    setForm((prev) => ({ ...prev, phone }));
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
    setForm((prev) => ({ ...prev, password, confirmPassword: password }));
    setPasswordRequirements({ length: true, uppercase: true, number: true, specialChar: true });
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.agree) {
      setError("You must agree to the terms to continue.");
      return;
    }
    if (form.loginMethod !== "pin" && form.password !== form.confirmPassword) {
      setError("Passwords do not match!");
      return;
    }

    const isPasswordStrong = Object.values(passwordRequirements).every(Boolean);
    if (form.loginMethod !== "pin" && !isPasswordStrong) {
      setError("Password does not meet all requirements. Please check the criteria.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
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
        role,
        dashboardName: "web",
        provider: "email",
        providerPayload: "Void",
        challenge: "register-skew8@lancasto",
      });

      if (response.error) {
        setError(response.error);
      } else {
        onSwitchToLogin(
          form.email,
          `Account created successfully ⚓ You can now log in as ${form.email}`
        );
      }
    } catch (err: unknown) {
      console.error("💥 Registration error:", err);
      setError(err instanceof Error ? err.message : "Unexpected registration error");
    } finally {
      setIsLoading(false);
    }
  };

  // ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 backdrop-blur-xs px-4 py-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-white dark:bg-[#111C2E] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 md:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-slate-800 text-slate-600 dark:text-slate-300 transition hover:border-[#0D9488] hover:text-[#0D9488]"
        >
          <FiX className="h-5 w-5" />
        </button>

        <div className="text-center mb-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#0D9488]/25 bg-[#0D9488]/10 px-3 py-0.5 text-[11px] font-semibold text-[#0D9488] dark:text-teal-300 mb-2">
            NURVIA Learner Enrollment
          </div>
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-xl md:text-2xl font-extrabold text-[#142B4A] dark:text-white">{APP_NAME}</h1>
            <FiCheckCircle className="text-[#0D9488] text-lg" title="Verified" />
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Create your learner account</p>
        </div>

        <button
          type="button"
          className="w-full flex items-center justify-center gap-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 px-4 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition text-slate-700 dark:text-slate-200 font-semibold text-sm"
          onClick={() => handleSocialClick('google')}
        >
          <FcGoogle className="text-xl" />
          Continue with Google
        </button>

        <div className="text-center text-xs text-slate-400 my-4">or sign up with email</div>

        {error && (
          <p role="alert" className="mb-3 text-sm text-rose-800 dark:text-rose-200 text-center font-medium bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-xl py-2.5 px-3">
            {error}
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
              value={form.username}
              onChange={handleChange}
              className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl px-3.5 py-2.5 text-sm text-[#0F172A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 focus:border-[#0D9488]"
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
              value={form.phone}
              onChange={handlePhoneChange}
              name="phone"
              className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl px-3.5 py-2.5 focus-within:ring-2 focus-within:ring-[#0D9488]/30 focus-within:border-[#0D9488] transition-all [&_.PhoneInputInput]:text-[#0F172A] dark:[&_.PhoneInputInput]:text-white [&_.PhoneInputInput]:bg-transparent [&_.PhoneInputInput]:border-0 [&_.PhoneInputInput]:outline-none [&_.PhoneInputInput]:ring-0 [&_.PhoneInputInput]:shadow-none"
            />
          </div>

          {(form.loginMethod === "password" || form.loginMethod === "both") && (
            <div className="space-y-3">
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">Password</label>
                  <button type="button" onClick={generatePassword} className="text-xs font-semibold bg-[#0D9488]/10 text-[#0D9488] px-2.5 py-0.5 rounded-lg hover:bg-[#0D9488]/20">
                    Auto-Generate
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
                    className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl px-3.5 py-2.5 text-sm text-[#0F172A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 focus:border-[#0D9488] pr-10"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute top-3 right-3 text-slate-400 hover:text-slate-600">
                    {showPassword ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>

                {form.password && (
                  <ul className="mt-2 text-xs space-y-1">
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
                )}
              </div>

              {passwordRequirements.length && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">Confirm Password</label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      name="confirmPassword"
                      required={showPinFields}
                      value={form.confirmPassword}
                      onChange={handleChange}
                      maxLength={24}
                      className={`w-full border ${
                        form.password && form.confirmPassword && form.password !== form.confirmPassword
                          ? "border-rose-400"
                          : "border-slate-300 dark:border-slate-700"
                      } bg-white dark:bg-slate-900 rounded-xl px-3.5 py-2.5 text-sm text-[#0F172A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 focus:border-[#0D9488] pr-10`}
                    />
                    <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute top-3 right-3 text-slate-400 hover:text-slate-600">
                      {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                    </button>
                  </div>
                  {form.password && form.confirmPassword && form.password !== form.confirmPassword && (
                    <p className="mt-1 text-xs text-rose-500">Passwords do not match</p>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex items-start gap-2">
            <input type="checkbox" name="agree" checked={form.agree} onChange={handleChange} className="mt-1 accent-[#0D9488]" />
            <label className="text-xs text-slate-600 dark:text-slate-300">
              I agree to the{" "}
              <Link href="/pages/terms-of-service" className="text-[#0D9488] font-semibold underline hover:text-[#0F766E]" onClick={onClose}>
                Terms and Conditions
              </Link>
            </label>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-[#142B4A] hover:bg-[#1E3A5F] text-white py-3 rounded-xl text-sm font-semibold transition disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isLoading ? "Creating Account…" : "Create Account"}
          </button>

          <div className="flex flex-row gap-3 pt-2">
            <Link
              href="/auth/support"
              className="flex-1 text-center bg-[#F8FAFC] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold py-2.5 px-3 rounded-xl hover:border-[#0D9488] hover:text-[#0D9488] transition"
              onClick={onClose}
            >
              Need Support?
            </Link>
            <button
              type="button"
              onClick={() => onSwitchToLogin(form.email, "")}
              className="flex-1 text-center bg-[#F8FAFC] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold py-2.5 px-3 rounded-xl hover:border-[#0D9488] hover:text-[#0D9488] transition"
            >
              Login Instead?
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

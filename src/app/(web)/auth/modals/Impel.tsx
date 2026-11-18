"use client";

import { FiLogIn, FiX, FiUserPlus } from "react-icons/fi";
import { APP_NAME } from "@/lib/config/config";

interface ImpelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onChooseLogin: () => void;
  onChooseRegister: () => void;
}

export default function ImpelModal({
  isOpen,
  onClose,
  onChooseLogin,
  onChooseRegister,
}: ImpelModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 backdrop-blur-xs px-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111C2E] shadow-2xl p-8 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-slate-800 text-slate-600 dark:text-slate-300 transition hover:border-[#0D9488] hover:text-[#0D9488]"
        >
          <FiX className="h-5 w-5" />
        </button>

        <div className="inline-flex items-center gap-2 rounded-full border border-[#0D9488]/25 bg-[#0D9488]/10 px-3 py-0.5 text-[11px] font-semibold text-[#0D9488] dark:text-teal-300 mb-3">
          NURVIA Learner Account
        </div>
        <h2 className="text-2xl font-extrabold text-[#142B4A] dark:text-white mb-2">
          Welcome to {APP_NAME}
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-300 mb-6">
          Sign in to your existing learner account or create a new one to continue.
        </p>

        <div className="flex flex-col gap-3">
          <button
            onClick={onChooseLogin}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#142B4A] hover:bg-[#1E3A5F] text-white py-3 text-sm font-semibold transition"
          >
            <FiLogIn className="w-4 h-4" />
            I already have an account — Sign In
          </button>

          <button
            onClick={onChooseRegister}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-[#0D9488] bg-[#0D9488]/10 text-[#0D9488] dark:text-teal-300 py-3 text-sm font-semibold hover:bg-[#0D9488] hover:text-white transition"
          >
            <FiUserPlus className="w-4 h-4" />
            I&apos;m new here — Create Account
          </button>
        </div>
        <p className="text-xs pt-4 text-slate-400">
          Structured clinical readiness & NGN practice
        </p>
      </div>
    </div>
  );
}
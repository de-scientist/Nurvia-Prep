"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FiArrowLeft, FiSave, FiUser } from "react-icons/fi";
import { useFlexPageClasp } from "@/lib/contexts/panel/layout/utils/FlexPageClasp";
import { useCurrentSystemUser } from "@/lib/hooks/users/account/current/useCurrentSystemUser";
import { updateCurrentUserProfile } from "@/lib/services/auth/supportService";

const CURRENT_PANEL = "nclex-rn";

interface ProfileFormState {
  gender: string;
  ethnicity: string;
  race: string;
  religion: string;
  language: string;
  dateOfBirth: string;
  bio: string;
  website: string;
  about: string;
}

const EMPTY_FORM: ProfileFormState = {
  gender: "",
  ethnicity: "",
  race: "",
  religion: "",
  language: "",
  dateOfBirth: "",
  bio: "",
  website: "",
  about: "",
};

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400">
        {label}
      </span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/20 transition"
      />
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400">
        {label}
      </span>
      <textarea
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        className="mt-1.5 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/20 resize-none transition"
      />
    </label>
  );
}

// ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export default function ProfileEditPage() {
  const { leftWidth, rightWidth, navHeight } = useFlexPageClasp();
  const { user, loading } = useCurrentSystemUser();

  const [form, setForm] = useState<ProfileFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ text: string; ok: boolean } | null>(null);

  // Seed the form once the user loads
  useEffect(() => {
    if (!user?.profile) return;
    setForm({
      gender: user.profile.gender ?? "",
      ethnicity: user.profile.ethnicity ?? "",
      race: user.profile.race ?? "",
      religion: user.profile.religion ?? "",
      language: user.profile.language ?? "",
      dateOfBirth: user.profile.dateOfBirth ? user.profile.dateOfBirth.slice(0, 10) : "",
      bio: user.profile.bio ?? "",
      website: user.profile.website ?? "",
      about: user.profile.about ?? "",
    });
  }, [user]);

  const updateField = (key: keyof ProfileFormState) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    setSaveMessage(null);
    try {
      const result = await updateCurrentUserProfile(form);
      if (result?.error) throw new Error(result.error);
      setSaveMessage({ text: "Profile updated successfully ⚓", ok: true });
    } catch (err) {
      console.error("❌ [ProfileEditPage] Failed to save profile:", err);
      setSaveMessage({ text: "Failed to update profile. Please try again.", ok: false });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main
        className="pt-16 flex items-center justify-center"
        style={{ marginLeft: leftWidth, marginRight: rightWidth, minHeight: `calc(100vh - ${navHeight}px)` }}
      >
        <p className="text-sm font-bold opacity-60 text-[var(--text-color)]">Loading profile . . . ⚓</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main
        className="pt-16 flex flex-col items-center justify-center gap-4 text-center px-4"
        style={{ marginLeft: leftWidth, marginRight: rightWidth, minHeight: `calc(100vh - ${navHeight}px)` }}
      >
        <p className="text-sm font-bold opacity-70 text-[var(--text-color)]">
          You need to be signed in to edit your profile.
        </p>
        <Link
          href={`/dashboards/${CURRENT_PANEL}/auth/login`}
          className="px-5 py-2.5 rounded-xl font-semibold text-sm bg-[#142B4A] hover:bg-[#0D9488] text-white shadow-sm transition-colors"
        >
          Log In
        </Link>
      </main>
    );
  }

  return (
    <main
      className="pt-16 transition-all duration-300 ease-in-out overflow-x-hidden"
      style={{
        marginLeft: leftWidth,
        marginRight: rightWidth,
        minHeight: `calc(100vh - ${navHeight}px)`,
        backgroundColor: "var(--content-bg)",
        color: "var(--content-text)",
      }}
    >
      <div className="p-3 md:p-6 space-y-5 w-full max-w-5xl mx-auto">

        {/* ─────────────────────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <Link
            href={`/dashboards/${CURRENT_PANEL}/auth/account/show`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-[#0D9488] transition-colors"
          >
            <FiArrowLeft className="w-3.5 h-3.5" />
            Back to Profile
          </Link>
        </div>

        {/* ─────────────────────────────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-slate-200/20 bg-gradient-to-br from-[#142B4A] via-[#0F2036] to-[#0D9488] px-6 py-6 flex flex-col sm:flex-row items-center gap-5 text-white shadow-md">
          <div className="h-16 w-16 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center shrink-0 text-2xl font-bold">
            {user.userName?.[0]?.toUpperCase() ?? "U"}
          </div>
          <div className="text-center sm:text-left">
            <h1 className="text-lg md:text-xl font-bold">Edit Profile</h1>
            <p className="text-xs text-slate-200/85">
              {user.userName} · {user.email}
            </p>
            <p className="text-[11px] text-teal-100/80 mt-1">
              Profile avatar is synced automatically from Gravatar based on your primary email address.
            </p>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111C2E] p-5 md:p-6 space-y-4 shadow-xs">
          <div className="flex items-center gap-2 mb-1">
            <FiUser className="w-4 h-4 text-[#0D9488]" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Personal Details</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Gender" value={form.gender} onChange={updateField("gender")} placeholder="e.g. Female" />
            <Field label="Date of Birth" type="date" value={form.dateOfBirth} onChange={updateField("dateOfBirth")} />
            <Field label="Ethnicity" value={form.ethnicity} onChange={updateField("ethnicity")} />
            <Field label="Race" value={form.race} onChange={updateField("race")} />
            <Field label="Religion" value={form.religion} onChange={updateField("religion")} />
            <Field label="Language" value={form.language} onChange={updateField("language")} placeholder="e.g. English" />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111C2E] p-5 md:p-6 space-y-4 shadow-xs">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">About You</h2>
          <Field label="Website" value={form.website} onChange={updateField("website")} placeholder="https://" />
          <TextAreaField label="Bio" value={form.bio} onChange={updateField("bio")} placeholder="A short line about yourself" />
          <TextAreaField label="About" value={form.about} onChange={updateField("about")} placeholder="More detail about your background" />
        </div>

        {/* ─────────────────────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3">
          {saveMessage && (
            <p className={`text-xs font-semibold ${saveMessage.ok ? "text-[#0D9488]" : "text-rose-600"}`}>
              {saveMessage.text}
            </p>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="ml-auto inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm bg-[#142B4A] hover:bg-[#0D9488] text-white shadow-sm transition-colors disabled:opacity-50"
          >
            <FiSave className="w-4 h-4" />
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>

      </div>
    </main>
  );
}

// ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// The End By : B.L.S.M.C ;  -  SkewBlanc - The Winds Chase Us ⚓
// ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
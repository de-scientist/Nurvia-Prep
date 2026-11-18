// src/app/(web)/pages/(more)/about/page.tsx
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
    title: "About Us",
    description: "Learn more about our platform, mission, and the team behind it.",
};

export default function AboutPage() {
    return (
        <main className="min-h-screen bg-white dark:bg-[#0B1220] text-[#0F172A] dark:text-slate-100">

            {/* ── Hero ── */}
            <section className="relative overflow-hidden bg-gradient-to-br from-[#142B4A] via-[#0F2036] to-[#0D9488] text-white py-20 px-6">
                <div className="relative max-w-4xl mx-auto text-center">
                    <span className="inline-block mb-4 px-4 py-1.5 rounded-full border border-white/20 bg-white/10 text-xs font-semibold tracking-wider uppercase text-teal-200">
                        Social Study Groups
                    </span>
                    <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight mb-5">
                        Built for Nursing Learners.<br className="hidden sm:block" /> Driven by Clinical Readiness.
                    </h1>
                    <p className="text-lg sm:text-xl text-slate-200 max-w-2xl mx-auto leading-relaxed">
                        We&apos;re on a mission to make exam preparation smarter, more accessible, and
                        genuinely effective — for every student, everywhere.
                    </p>
                </div>
            </section>

            {/* ── Mission ── */}
            <section className="py-16 px-6">
                <div className="max-w-4xl mx-auto grid sm:grid-cols-2 gap-12 items-center">
                    <div>
                        <h2 className="text-3xl font-extrabold text-[#0F172A] dark:text-white mb-4">Our Mission</h2>
                        <p className="text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
                            We believe every student deserves access to high-quality exam practice tools —
                            not just those who can afford expensive prep courses or tutors.
                        </p>
                        <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                            Our platform combines adaptive assessments, AI-powered guidance, and
                            real-time performance analytics to give you the edge you need to succeed.
                        </p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        {[
                            { emoji: "🎯", label: "Focused Practice" },
                            { emoji: "🤖", label: "Clinical Rationales" },
                            { emoji: "📊", label: "Smart Analytics" },
                            { emoji: "⚡", label: "Real-time Feedback" },
                        ].map(({ emoji, label }) => (
                            <div
                                key={label}
                                className="flex flex-col items-center justify-center gap-2 p-5 rounded-2xl bg-[#F8FAFC] dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 text-center"
                            >
                                <span className="text-3xl">{emoji}</span>
                                <span className="text-sm font-bold text-[#0F172A] dark:text-white">{label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Stats ── */}
            <section className="bg-[#F8FAFC] dark:bg-[#111C2E] border-y border-slate-200 dark:border-slate-800 py-16 px-6">
                <div className="max-w-4xl mx-auto">
                    <h2 className="text-3xl font-extrabold text-center text-[#0F172A] dark:text-white mb-12">By the Numbers</h2>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                        {[
                            { value: "50K+", label: "Students" },
                            { value: "10K+", label: "Practice Questions" },
                            { value: "98%", label: "Satisfaction Rate" },
                            { value: "24/7", label: "Academic Support" },
                        ].map(({ value, label }) => (
                            <div key={label} className="text-center">
                                <div className="text-4xl font-extrabold text-[#0D9488] mb-1">
                                    {value}
                                </div>
                                <div className="text-sm text-slate-600 dark:text-slate-400 font-medium">{label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Values ── */}
            <section className="py-16 px-6">
                <div className="max-w-4xl mx-auto">
                    <h2 className="text-3xl font-extrabold text-center text-[#0F172A] dark:text-white mb-12">What We Stand For</h2>
                    <div className="grid sm:grid-cols-3 gap-6">
                        {[
                            {
                                emoji: "🌍",
                                title: "Accessibility",
                                desc: "Quality education tools should be available to everyone, regardless of background or budget.",
                            },
                            {
                                emoji: "🔬",
                                title: "Evidence-Based",
                                desc: "Every feature is grounded in learning science — spaced repetition, active recall, and more.",
                            },
                            {
                                emoji: "🤝",
                                title: "Student-First",
                                desc: "We listen to our users and ship improvements fast. Your success is our only metric.",
                            },
                        ].map(({ emoji, title, desc }) => (
                            <div
                                key={title}
                                className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111C2E] shadow-xs hover:border-[#0D9488]/40 transition"
                            >
                                <div className="text-4xl mb-4">{emoji}</div>
                                <h3 className="text-lg font-bold text-[#0F172A] dark:text-white mb-2">{title}</h3>
                                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Team ── */}
            <section className="bg-[#F8FAFC] dark:bg-[#111C2E] border-y border-slate-200 dark:border-slate-800 py-16 px-6">
                <div className="max-w-4xl mx-auto">
                    <h2 className="text-3xl font-extrabold text-center text-[#0F172A] dark:text-white mb-4">Meet the Team</h2>
                    <p className="text-center text-slate-600 dark:text-slate-300 mb-12 max-w-xl mx-auto">
                        A small, passionate team of educators, engineers, and designers committed to
                        transforming how students prepare for exams.
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                        {[
                            { initials: "SK", name: "Skew Blanc", role: "Founder & CEO" },
                            { initials: "AM", name: "Alex M.", role: "Lead Engineer" },
                            { initials: "JR", name: "Jamie R.", role: "Head of Design" },
                            { initials: "TC", name: "Taylor C.", role: "Content Lead" },
                        ].map(({ initials, name, role }) => (
                            <div key={name} className="flex flex-col items-center text-center gap-3">
                                <div className="w-16 h-16 rounded-2xl bg-[#142B4A] text-white flex items-center justify-center text-xl font-bold shadow-sm">
                                    {initials}
                                </div>
                                <div>
                                    <div className="font-bold text-sm text-[#0F172A] dark:text-white">{name}</div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400">{role}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── CTA ── */}
            <section className="py-16 px-6">
                <div className="max-w-2xl mx-auto text-center">
                    <h2 className="text-3xl font-extrabold text-[#0F172A] dark:text-white mb-4">Ready to Start?</h2>
                    <p className="text-slate-600 dark:text-slate-300 mb-8">
                        Join thousands of students already using our platform to ace their exams.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <Link
                            href="/auth/register"
                            className="px-6 py-3 rounded-xl bg-[#142B4A] hover:bg-[#0D9488] text-white font-semibold text-sm shadow-sm transition"
                        >
                            Get Started Free
                        </Link>
                        <Link
                            href="/pages/contact-us"
                            className="px-6 py-3 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-sm hover:border-[#0D9488] hover:text-[#0D9488] transition"
                        >
                            Contact Us
                        </Link>
                    </div>
                </div>
            </section>

        </main>
    );
}
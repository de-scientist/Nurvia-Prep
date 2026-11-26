import Link from "next/link";
import {
    FiLogIn,
    FiUserPlus,
    FiHelpCircle,
    FiKey,
    FiLock,
    FiShield,
    FiRefreshCw,
    FiCompass,
    FiBookOpen,
    FiShoppingBag,
    FiInfo,
    FiFileText,
    FiMail,
    FiStar,
    FiUsers,
    FiHeart,
    FiFileMinus,
    FiEdit3,
    FiVideo,
    FiSearch,
    FiGrid,
    FiActivity,
} from "react-icons/fi";

// ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

interface ActionLink {
    title: string;
    description: string;
    href: string;
    icon: React.ElementType;
}

interface ActionSection {
    title: string;
    subtitle: string;
    gradient: string;
    links: ActionLink[];
}

const SECTIONS: ActionSection[] = [
    {
        title: "Account & Security",
        subtitle: "Sign in, register, and manage how you access your account.",
        gradient: "from-indigo-500/10 via-purple-500/10 to-pink-500/10",
        links: [
            { title: "Log In", description: "Access your existing account.", href: "/auth/login", icon: FiLogIn },
            { title: "Register", description: "Create a new account to get started.", href: "/auth/register", icon: FiUserPlus },
            { title: "Support", description: "Report an issue or get help from our team.", href: "/auth/support", icon: FiHelpCircle },
            { title: "Recover Password", description: "Forgot your password? Reset it here.", href: "/auth/recovery/password", icon: FiKey },
            { title: "Update Password", description: "Change your current password or PIN.", href: "/auth/update/password", icon: FiLock },
            { title: "Update 2FA", description: "Manage two-factor authentication on your account.", href: "/auth/update/2fa", icon: FiShield },
            {
                title: "Switch to Email Login",
                description: "Signed up with Google, Apple, Facebook, GitHub, LinkedIn, or Microsoft? Set up direct email + password/PIN login here.",
                href: "/auth/recovery/social",
                icon: FiRefreshCw,
            },
        ],
    },
    {
        title: "Explore",
        subtitle: "Discover our programs, study notes, and shop.",
        gradient: "from-emerald-500/10 via-teal-500/10 to-cyan-500/10",
        links: [
            { title: "Entrance", description: "See all the exam prep programs we offer.", href: "/pages/entrance", icon: FiCompass },
            { title: "Notes", description: "Browse study notes and reference material.", href: "/pages/notes", icon: FiBookOpen },
            { title: "Shop", description: "Purchase courses, bundles, and study resources.", href: "/pages/shop", icon: FiShoppingBag },
            { title: "Search", description: "Search across the entire platform.", href: "/pages/search", icon: FiSearch },
        ],
    },
    {
        title: "Exam Programs",
        subtitle: "Jump into prep content for a specific exam.",
        gradient: "from-amber-500/10 via-orange-500/10 to-rose-500/10",
        links: [
            { title: "ATI TEAS", description: "Prep content for the ATI TEAS exam.", href: "/pages/exams/ati-teas", icon: FiActivity },
            { title: "HESI A2", description: "Prep content for the HESI A2 exam.", href: "/pages/exams/hesi-a2", icon: FiActivity },
            { title: "RN Nursing", description: "Prep content for RN Nursing.", href: "/pages/exams/rn-nursing", icon: FiActivity },
            { title: "LPN Nursing", description: "Prep content for LPN Nursing.", href: "/pages/exams/lpn-nursing", icon: FiActivity },
            { title: "RN Licensure", description: "Prep content for RN Licensure exams.", href: "/pages/exams/nclex-rn", icon: FiActivity },
            { title: "LPN Licensure", description: "Prep content for LPN Licensure exams.", href: "/pages/exams/nclex-pn", icon: FiActivity },
        ],
    },
    {
        title: "Dashboards",
        subtitle: "Go straight to your dashboard for an active program.",
        gradient: "from-blue-500/10 via-sky-500/10 to-cyan-500/10",
        links: [
            { title: "ATI TEAS Dashboard", description: "Your results, progress, and live exams for ATI TEAS.", href: "/dashboards/ati-teas", icon: FiGrid },
            { title: "HESI A2 Dashboard", description: "Your results, progress, and live exams for HESI A2.", href: "/dashboards/hesi-a2", icon: FiGrid },
            { title: "RN Nursing Dashboard", description: "Your results, progress, and live exams for RN Nursing.", href: "/dashboards/rn-nusring", icon: FiGrid },
            { title: "LPN Nursing Dashboard", description: "Your results, progress, and live exams for LPN Nursing.", href: "/dashboards/lpn-nursing", icon: FiGrid },
        ],
    },
    {
        title: "Company",
        subtitle: "Learn more about who we are and how we work.",
        gradient: "from-fuchsia-500/10 via-purple-500/10 to-indigo-500/10",
        links: [
            { title: "About Us", description: "Our story and what we're building.", href: "/pages/about-us", icon: FiInfo },
            { title: "Documentation", description: "Guides and reference documentation.", href: "/pages/documentation", icon: FiFileText },
            { title: "Contact Us", description: "Send us a message directly.", href: "/pages/contact-us", icon: FiMail },
            { title: "FAQs", description: "Answers to commonly asked questions.", href: "/pages/faqs", icon: FiHelpCircle },
            { title: "Reviews", description: "See what our students are saying.", href: "/pages/reviews", icon: FiStar },
            { title: "Team", description: "Meet the people behind the platform.", href: "/pages/team", icon: FiUsers },
            { title: "Values", description: "What we stand for and prioritize.", href: "/pages/values", icon: FiHeart },
            { title: "Terms of Service", description: "The terms that govern using our platform.", href: "/pages/terms-of-service", icon: FiFileMinus },
            { title: "Privacy Policy", description: "How we handle and protect your data.", href: "/pages/privacy-policy", icon: FiLock },
            { title: "Blogs", description: "Articles, tips, and platform updates.", href: "/pages/blogs", icon: FiEdit3 },
        ],
    },
    {
        title: "Community",
        subtitle: "Connect with other students in real time.",
        gradient: "from-rose-500/10 via-pink-500/10 to-fuchsia-500/10",
        links: [
            { title: "Live Sessions", description: "Join live study sessions and Q&As.", href: "/pages/live-sessions", icon: FiVideo },
            { title: "Social Groups", description: "Find and join study groups.", href: "/pages/social-groups", icon: FiUsers },
        ],
    },
];

// ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

function ActionCard({ title, description, href, icon: Icon }: ActionLink) {
    return (
        <Link
            href={href}
            className="group flex flex-col gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111C2E] p-5 hover:border-[#0D9488]/50 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200"
        >
            <div className="w-10 h-10 rounded-xl bg-[#0D9488]/10 flex items-center justify-center group-hover:bg-[#0D9488]/20 transition-colors">
                <Icon className="w-5 h-5 text-[#0D9488] dark:text-teal-300" />
            </div>
            <div className="space-y-1">
                <h3 className="font-bold text-sm text-[#0F172A] dark:text-white">{title}</h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{description}</p>
            </div>
            <span className="mt-auto inline-flex items-center justify-center rounded-xl bg-[#142B4A] group-hover:bg-[#0D9488] px-4 py-2 text-xs font-semibold text-white transition-colors">
                Open Route →
            </span>
        </Link>
    );
}

// ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export default function ActionsPage() {
    return (
        <main className="py-10 bg-[#F8FAFC] dark:bg-[#0B1220] text-[#0F172A] dark:text-slate-100 overflow-x-hidden">
            <div className="px-4 sm:px-6 lg:px-8 space-y-8 w-full max-w-7xl mx-auto">
                {/* Hero */}
                <div className="text-center space-y-2">
                    <div className="inline-flex items-center gap-2 rounded-full border border-[#0D9488]/25 bg-[#0D9488]/10 px-3.5 py-1 text-xs font-semibold text-[#0D9488] dark:text-teal-300">
                        Platform Navigation Directory
                    </div>
                    <h1 className="text-2xl md:text-3xl font-extrabold text-[#0F172A] dark:text-white">
                        Everywhere You Can Go
                    </h1>
                    <p className="text-sm text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
                        A single directory to jump into your account, explore our clinical programmes, or open your learner dashboard.
                    </p>
                </div>

                {/* Sections */}
                {SECTIONS.map((section) => (
                    <section key={section.title} className="space-y-4">
                        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111C2E] px-6 py-4">
                            <h2 className="text-lg font-bold text-[#0F172A] dark:text-white">{section.title}</h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{section.subtitle}</p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            {section.links.map((link) => (
                                <ActionCard key={link.href} {...link} />
                            ))}
                        </div>
                    </section>
                ))}
            </div>
        </main>
    );
}

// ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// The End By : B.L.S.M.C ;  -  SkewBlanc - The Winds Chase Us ⚓
// ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
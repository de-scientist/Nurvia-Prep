'use client'

import { useEffect, useState } from 'react'
import React from 'react'
import { useRouter } from 'next/navigation'
import {
    FaUserGraduate,
    FaStethoscope,
    FaAward,
    FaClipboardList,
    FaBookOpen,
    FaCrown,
    FaFire,
    FaStar,
    FaBolt,
} from 'react-icons/fa'

// Badge types with label, color, and icon
const badgePool = [
    { label: 'New', color: 'bg-green-500', icon: <FaStar className="mr-1" /> },
    { label: 'Hot', color: 'bg-red-500', icon: <FaFire className="mr-1" /> },
    { label: 'Updated', color: 'bg-yellow-500', icon: <FaBolt className="mr-1" /> },
    { label: 'Popular', color: 'bg-indigo-500', icon: <FaCrown className="mr-1" /> },
]

interface DashboardCard {
    label: string
    description: string
    icon: React.ReactElement
    route: string
    badge?: {
        label: string
        color: string
        icon: React.ReactElement
    }
}

// Move this outside to avoid useEffect ESLint warning
const rawCards: DashboardCard[] = [
    {
        label: 'ATI TEAS EXAMS',
        description: 'Assess academic preparedness for nursing school.',
        icon: <FaBookOpen className="text-purple-600 text-3xl" />,
        route: '/pages/exams/ati-teas',
    },    
    {
        label: 'HESI A2 EXAMS',
        description: 'Health Education Systems Inc. admissions exams.',
        icon: <FaClipboardList className="text-rose-600 text-3xl" />,
        route: '/pages/exams/hesi-a2',
    },
    {
        label: 'NCLEX EXAMS',
        description: 'Comprehensive NCLEX practice exams.',
        icon: <FaAward className="text-pink-600 text-3xl" />,
        route: '/pages/exams/nclex',
    },
    {
        label: 'NCLEX-RN EXAMS',
        description: 'Registered Nurse licensure exam prep.',
        icon: <FaAward className="text-green-600 text-3xl" />,
        route: '/pages/exams/nclex-rn',
    },
    {
        label: 'NCLEX-PN EXAMS',
        description: 'Practical Nurse licensure exam guide.',
        icon: <FaAward className="text-orange-600 text-3xl" />,
        route: '/pages/exams/nclex-pn',
    },
    {
        label: 'PRE NURSING EXAMS',
        description: 'Entry-level nursing readiness assessments.',
        icon: <FaClipboardList className="text-cyan-600 text-3xl" />,
        route: '/pages/exams/pre-nursing',
    },
    {
        label: 'RN NURSING EXAMS',
        description: 'Registered Nurse core competency review.',
        icon: <FaStethoscope className="text-blue-500 text-3xl" />,
        route: '/pages/exams/rn-nursing',
    },
    {
        label: 'LPN NURSING EXAMS',
        description: 'Licensed Practical Nurse exam simulations.',
        icon: <FaStethoscope className="text-purple-500 text-3xl" />,
        route: '/pages/exams/lpn-nursing',
    },
    {
        label: 'CNA EXAMS',
        description: 'Certified Nursing Assistant training & evaluation.',
        icon: <FaStethoscope className="text-teal-600 text-3xl" />,
        route: '/pages/exams/cna',
    },
    {
        label: 'GED EXAMS',
        description: 'General Educational Development prep & tests.',
        icon: <FaBookOpen className="text-yellow-600 text-3xl" />,
        route: '/pages/exams/ged',
    },
    {
        label: 'CERTIFICATION EXAMS',
        description: 'Various professional healthcare certifications.',
        icon: <FaAward className="text-red-500 text-3xl" />,
        route: '/pages/exams/certifications',
    },
    {
        label: 'Users Dashboard',
        description: 'Manage profile, progress, and system access',
        icon: <FaUserGraduate className="text-blue-600 text-3xl" />,
        route: '/user/dashboard',
    },
    {
        label: 'Praxis Dashboard',
        description: 'Prep for the Praxis educator certification exams.',
        icon: <FaClipboardList className="text-indigo-600 text-3xl" />,
        route: '/pages/exams/praxis',
    },
]

export default function DashboardsPage() {
    const router = useRouter()
    const [lastOpenedRoute, setLastOpenedRoute] = useState<string | null>(null)

    const [dashboardCards, setDashboardCards] = useState<DashboardCard[]>([])

    // Assign badges randomly
    function assignRandomBadges(cards: DashboardCard[]) {
        const maxBadges = 5
        const shuffled = [...cards].sort(() => 0.5 - Math.random()).slice(0, maxBadges)
        return cards.map((card) => {
            const matched = shuffled.find((c) => c.route === card.route)
            return {
                ...card,
                badge: matched ? badgePool[Math.floor(Math.random() * badgePool.length)] : undefined,
            }
        })
    }

    useEffect(() => {
        const updated = assignRandomBadges(rawCards)
        setDashboardCards(updated)

        const last = localStorage.getItem('lastOpenedRoute')
        if (last) setLastOpenedRoute(last)
    }, [])

    const handleCardClick = (route: string) => {
        localStorage.setItem('lastOpenedRoute', route)
        router.push(route)
    }

    return (
        <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B1220] py-12 px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-7xl">
                <div className="text-center mb-10">
                    <div className="inline-flex items-center gap-2 rounded-full border border-[#0D9488]/25 bg-[#0D9488]/10 px-3.5 py-1 text-xs font-semibold text-[#0D9488] dark:text-teal-300 mb-3">
                        NURVIA Resource Hub
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-extrabold text-[#0F172A] dark:text-white">
                        Explore All Resources
                    </h1>
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                        Select an exam track or study resource below to continue your preparation.
                    </p>
                </div>

                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 bg-white dark:bg-[#111C2E] shadow-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5">
                        {dashboardCards.map((card, index) => {
                            const isLastOpened = lastOpenedRoute === card.route

                            return (
                                <div
                                    key={index}
                                    onClick={() => handleCardClick(card.route)}
                                    className={`relative cursor-pointer rounded-2xl border p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
                                        isLastOpened
                                            ? 'border-[#0D9488] ring-2 ring-[#0D9488]/30 bg-teal-50/40 dark:bg-teal-950/20'
                                            : 'border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-[#0B1220] hover:border-[#0D9488]/50'
                                    }`}
                                >
                                    {card.badge && (
                                        <span
                                            className={`absolute top-3 right-3 text-white font-semibold text-[10px] uppercase tracking-wider px-2.5 py-0.5 rounded-full flex items-center ${
                                                card.badge.color
                                            } ${isLastOpened ? 'opacity-75' : ''}`}
                                        >
                                            {card.badge.icon}
                                            {card.badge.label}
                                        </span>
                                    )}

                                    {isLastOpened && (
                                        <span className="absolute top-3 left-3 font-semibold bg-[#0D9488] text-white text-[10px] uppercase tracking-wider px-2.5 py-0.5 rounded-full">
                                            Last Opened
                                        </span>
                                    )}

                                    <div className="mb-4 mt-2 flex justify-center">{card.icon}</div>

                                    <h2 className="text-base font-bold text-[#0F172A] dark:text-white text-center mb-1.5">
                                        {card.label}
                                    </h2>

                                    <p className="text-xs text-slate-600 dark:text-slate-400 text-center leading-relaxed">{card.description}</p>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>
        </div>
    )
}

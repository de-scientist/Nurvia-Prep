// src\app\(web)\auth\logout\page.tsx
'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useSearchParams } from 'next/navigation'
import { FiHome, FiLogIn, FiHeart } from 'react-icons/fi'
import { APP_NAME } from '@/lib/config/config'
import { useFlexPageClasp } from "@/lib/contexts/panel/layout/utils/FlexPageClasp";

// ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

const TARGET_DASHBOARD = "nclex-pn";

// ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

// extract searchParams logic into a child (mirrors LoginSearchParamsHandler pattern)
function LogoutSearchParamsHandler({
  onMessage,
}: {
  onMessage: (msg: string) => void
}) {
  const searchParams = useSearchParams()
  const msg = searchParams.get('msg')

  useEffect(() => {
    if (msg) {
      onMessage(decodeURIComponent(msg))
    }
  }, [msg, onMessage])

  return null
}

// ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export default function WebLogoutPage() {
  const [message, setMessage] = useState('')
  const { leftWidth, rightWidth, navHeight } = useFlexPageClasp();

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
      <Suspense fallback={null}>
        <LogoutSearchParamsHandler onMessage={setMessage} />
      </Suspense>

      <div className="max-w-md w-full bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden text-center">

        {/* Top image / brand strip */}
        <div className="relative w-full h-40 bg-gradient-to-br from-[#142B4A] via-[#0F2036] to-[#0D9488] flex items-center justify-center">
          <Image
            src="/web/auth/login/loginFoto.jpg"
            alt="See you soon"
            fill
            style={{ objectFit: 'cover' }}
            className="opacity-45"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#142B4A]/90 via-[#142B4A]/40 to-transparent" />
          <FiHeart className="absolute text-[#2DD4BF] text-4xl drop-shadow-lg" />
        </div>

        <div className="p-8 space-y-4">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Signed Out Safely
          </h1>

          <p className="text-sm text-slate-600 dark:text-slate-400">
            You&apos;ve been signed out of <span className="font-semibold text-[#0D9488]">{APP_NAME}</span>.
            Your study progress and analytics are saved and ready for your next session.
          </p>

          {message && (
            <div className="flex justify-center">
              <div className="max-w-sm w-full bg-teal-50 border border-teal-200 text-[#0D9488] px-4 py-2.5 rounded-xl text-xs font-medium">
                {message}
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Link
              href="/"
              className="flex-1 inline-flex items-center justify-center gap-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold py-2.5 px-4 rounded-xl hover:border-[#0D9488] hover:text-[#0D9488] transition-colors"
            >
              <FiHome />
              Go Home
            </Link>

            <Link
              href={`/dashboards/${TARGET_DASHBOARD}/auth/login`}
              className="flex-1 inline-flex items-center justify-center gap-2 bg-[#142B4A] hover:bg-[#0D9488] text-white font-semibold py-2.5 px-4 rounded-xl transition-colors"
            >
              <FiLogIn />
              Sign In Again
            </Link>
          </div>

          <p className="text-[11px] text-slate-400 pt-2">
            For your security, remember to close this tab on shared or public devices.
          </p>
        </div>
      </div>
    </main>
  )
}
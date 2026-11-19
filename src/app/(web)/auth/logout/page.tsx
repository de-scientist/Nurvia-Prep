// src\app\(web)\auth\logout\page.tsx
'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useSearchParams } from 'next/navigation'
import { FiHome, FiLogIn, FiHeart } from 'react-icons/fi'
import { APP_NAME } from '@/lib/config/config'
import { useAuth } from '@/components/auth/auth-provider'

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
  const { status, signOut } = useAuth()

  useEffect(() => {
    if (status === 'authenticated') {
      void signOut()
    }
  }, [status, signOut])

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center bg-[#F8FAFC] dark:bg-[#0B1220] px-4 py-12">

      <Suspense fallback={null}>
        <LogoutSearchParamsHandler onMessage={setMessage} />
      </Suspense>

      <div className="max-w-md w-full bg-white dark:bg-[#111C2E] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden text-center">

        {/* Top image / brand strip */}
        <div className="relative w-full h-36 bg-[#142B4A] flex items-center justify-center">
          <Image
            src="/web/auth/login/loginFoto.jpg"
            alt="See you soon"
            fill
            style={{ objectFit: 'cover' }}
            className="opacity-70"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#142B4A] via-[#142B4A]/40 to-transparent" />
          <FiHeart className="absolute text-white text-3xl drop-shadow-md" />
        </div>

        <div className="p-8 space-y-4">
          <h1 className="text-2xl font-extrabold text-[#0F172A] dark:text-white">
            Signed Out Safely
          </h1>

          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            You&apos;ve been signed out of <span className="font-semibold text-[#0D9488]">{APP_NAME}</span>.
            Thanks for studying with us today — your progress is saved and waiting for you.
          </p>

          {message && (
            <div className="flex justify-center">
              <div className="max-w-sm w-full bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 px-4 py-2.5 rounded-xl text-xs">
                {message}
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Link
              href="/"
              className="flex-1 inline-flex items-center justify-center gap-2 bg-[#F8FAFC] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold py-2.5 px-4 rounded-xl hover:border-[#0D9488] hover:text-[#0D9488] transition"
            >
              <FiHome />
              Go Home
            </Link>

            <Link
              href="/auth/login"
              className="flex-1 inline-flex items-center justify-center gap-2 bg-[#142B4A] text-white text-xs font-semibold py-2.5 px-4 rounded-xl hover:bg-[#1E3A5F] transition"
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
    </div>
  )
}
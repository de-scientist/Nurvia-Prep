// src/app/(web)/auth/onetap/page.tsx — replace only the handleCredentialResponse block
'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Script from 'next/script'
import { oneTapLogin } from '@/lib/services/auth/socialService'

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: GoogleIdConfig) => void;
          prompt: (momentCallback?: (notification: unknown) => void) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
          cancel: () => void;
        };
      };
    };
  }
}

interface GoogleIdConfig {
  client_id: string;
  callback: (response: { credential: string; select_by?: string }) => void;
  auto_select?: boolean;
  cancel_on_tap_outside?: boolean;
}

const LANDING_PATH = "/pages/entrance";
const GOOGLE_CLIENT_ID = process.env.SKEW_LINE_GOOGLE_CLIENT_ID;

export default function GoogleOneTapPage() {
  const router = useRouter()
  const [error, setError] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle')
  const buttonRef = useRef<HTMLDivElement>(null)
  const initialized = useRef(false)

  const handleCredentialResponse = useCallback(
    async (response: { credential: string; select_by?: string }) => {
      setStatus('loading')
      setError('')

      try {
        const data = await oneTapLogin({
          credential: response.credential,
          select_by: response.select_by,
          context: "login",
        })

        if (data?.error) {
          console.warn("⚠️ One Tap error:", data.error, data)
          setError(data.error)
          setStatus('idle')
          return
        }

        // Session cookies are written inside oneTapLogin() via writeAuthSessionCookies(),
        // same as loginService.login() — no extra persistence step needed here.
        console.log("✅ One Tap login successful:", data)
        setStatus('success')

        setTimeout(() => {
          router.push(LANDING_PATH)
        }, 500)
      } catch (err: unknown) {
        console.error("One Tap request failed:", err)
        setError(err instanceof Error ? err.message : "One Tap login failed. Please try again.")
        setStatus('idle')
      }
    },
    [router]
  )

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) {
      console.error("SKEW_LINE_GOOGLE_CLIENT_ID is not set ⚓")
      setError("One Tap is not configured.")
      return
    }

    const tryInit = () => {
      if (initialized.current) return
      if (!window.google?.accounts?.id) return

      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse,
        auto_select: false,
        cancel_on_tap_outside: true,
      })

      window.google.accounts.id.prompt()

      if (buttonRef.current) {
        window.google.accounts.id.renderButton(buttonRef.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "continue_with",
          shape: "pill",
          width: 320,
        })
      }

      initialized.current = true
    }

    const interval = setInterval(() => {
      tryInit()
      if (initialized.current) clearInterval(interval)
    }, 200)

    return () => {
      clearInterval(interval)
      window.google?.accounts?.id?.cancel()
    }
  }, [handleCredentialResponse])

  return (
    <>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
      />

      <div className="flex flex-col items-center justify-center min-h-[65vh] bg-[#F8FAFC] dark:bg-[#0B1220] px-4 py-12">
        <div className="max-w-md w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111C2E] p-8 shadow-sm text-center flex flex-col items-center gap-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#0D9488]/25 bg-[#0D9488]/10 px-3 py-0.5 text-[11px] font-semibold text-[#0D9488] dark:text-teal-300">
            NURVIA Single Sign-On
          </div>
          <h1 className="text-2xl font-extrabold text-[#0F172A] dark:text-white">Continue with Google</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300 text-center max-w-sm">
            Choose your Google account to continue. This uses Google&apos;s One Tap sign-in.
          </p>

          {error && (
            <div role="alert" className="w-full bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 px-4 py-3 rounded-xl text-sm flex items-center gap-3">
              <span className="flex-1 leading-tight">{error}</span>
            </div>
          )}

          {status === 'loading' && (
            <p className="text-sm font-medium text-[#0D9488]">Signing you in…</p>
          )}
          {status === 'success' && (
            <p className="text-sm font-medium text-emerald-600">Success! Redirecting…</p>
          )}

          <div ref={buttonRef} className="mt-2" />
        </div>
      </div>
    </>
  )
}

// ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// The End By : B.L.S.M.C ; - SkewBlanc - The Winds Chase Us ⚓
// ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
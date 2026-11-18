'use client';

import { useEffect, useState } from 'react';
import PageWrapper from '@/app/(web)/wrapper'
import type { PageContent } from '@/lib/types/PageContent';
import { apiFetch } from '@/lib/api/api/api';

export default function PolicyPage() {
  const [data, setData] = useState<PageContent | null>(null);

useEffect(() => {
  apiFetch<PageContent>('/NextPolicy') 
    .then(setData)
    .catch((err) => console.error('Error fetching policy content:', err));
}, []);

  return (
    <PageWrapper>
      <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111C2E] p-8 shadow-xs">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#0D9488]/25 bg-[#0D9488]/10 px-3 py-0.5 text-xs font-semibold text-[#0D9488] dark:text-teal-300 mb-3">
            Platform Documentation
          </div>
          <h1 className="text-3xl font-extrabold text-[#0F172A] dark:text-white mb-6">
            {data?.title || 'Documentation & Policies'}
          </h1>

          <div className="text-base text-slate-600 dark:text-slate-300 leading-relaxed space-y-4">
            <p>
              {data?.content ||
                'We take your privacy seriously. This policy outlines what data we collect, how we use it, and the rights you have over your information.'}
            </p>

            <p>
              By using our services, you agree to the collection and use of
              information in accordance with this policy. We never sell or misuse
              your data.
            </p>

            <p>
              If you have any questions about our documentation or policies, please{' '}
              <a href="/pages/contact-us" className="text-[#0D9488] font-semibold underline">
                contact us
              </a>{' '}
              for more information.
            </p>
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}

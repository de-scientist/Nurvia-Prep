'use client';

export default function TermsPage() {
  return (
    <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111C2E] p-8 shadow-xs">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#0D9488]/25 bg-[#0D9488]/10 px-3 py-0.5 text-xs font-semibold text-[#0D9488] dark:text-teal-300 mb-3">
          Legal Agreement
        </div>
        <h1 className="text-3xl font-extrabold text-[#0F172A] dark:text-white mb-4">Terms and Conditions</h1>
        <p className="text-base text-slate-600 dark:text-slate-300 leading-relaxed">
          By using this site, you agree to our terms and conditions governing access to NURVIA clinical exam preparation resources, assessments, and learner accounts.
        </p>
      </div>
    </div>
  );
}

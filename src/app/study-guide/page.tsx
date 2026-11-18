import { redirect } from "next/navigation";

export default async function StudyGuideSingularRedirect({
  searchParams,
}: {
  searchParams?: Promise<{ subject?: string; topic?: string }>;
}) {
  const resolved = searchParams ? await searchParams : undefined;
  const query = new URLSearchParams();
  if (resolved?.subject) query.set("subject", resolved.subject);
  if (resolved?.topic) query.set("topic", resolved.topic);

  const qs = query.toString();
  redirect(`/study-guides${qs ? `?${qs}` : ""}`);
}

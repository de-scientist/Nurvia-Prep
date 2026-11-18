import { redirect } from "next/navigation";

export default function StudyGuideSingularRedirect({
  searchParams,
}: {
  searchParams?: { subject?: string; topic?: string };
}) {
  const query = new URLSearchParams();
  if (searchParams?.subject) query.set("subject", searchParams.subject);
  if (searchParams?.topic) query.set("topic", searchParams.topic);

  const qs = query.toString();
  redirect(`/study-guides${qs ? `?${qs}` : ""}`);
}

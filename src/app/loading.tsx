import { PageLoader } from "@/components/shared/feedback";

export default function GlobalLoading() {
  return (
    <PageLoader
      fullscreen
      message="Loading QuizNurse workspace..."
    />
  );
}

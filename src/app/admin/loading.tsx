import { DashboardSkeleton } from "@/components/shared/feedback";

export default function AdminRouteLoading() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading administrative workspace"
      className="min-h-screen bg-background p-6 sm:p-8 space-y-6"
    >
      <DashboardSkeleton />
    </div>
  );
}

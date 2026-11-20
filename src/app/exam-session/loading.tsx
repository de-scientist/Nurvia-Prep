import { ExamLoadingScreen } from "@/components/exam/ExamLoadingScreen";

export default function ExamSessionRouteLoading() {
  return (
    <ExamLoadingScreen
      title="Clinical Examination Workspace"
      currentStage={1}
      mode="Exam"
    />
  );
}

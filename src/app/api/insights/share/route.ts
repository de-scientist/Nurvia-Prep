import { NextRequest, NextResponse } from 'next/server';
import { insightsStore } from '@/lib/insights/insights-store';

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' };

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body || !body.examType || !body.outcome) {
      return NextResponse.json(
        {
          success: false,
          message: 'Exam type and outcome are required to share your results.',
          errorCode: 'VALIDATION_ERROR',
        },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    // Sharing is voluntary and anonymized

    const result = insightsStore.shareResult({
      examType: body.examType,
      outcome: body.outcome,
      examDate: body.examDate,
      questionCount: body.questionCount ? Number(body.questionCount) : undefined,
      weeksStudied: body.weeksStudied ? Number(body.weeksStudied) : undefined,
      prepResources: Array.isArray(body.prepResources) ? body.prepResources : ['QuizNurse Study Library'],
      story: body.story,
    });

    return NextResponse.json(
      {
        success: true,
        message: result.message,
        data: { recordId: result.recordId },
      },
      { status: 201, headers: NO_STORE_HEADERS }
    );
  } catch {
    return NextResponse.json(
      {
        success: false,
        message: 'Unable to share examination outcome.',
        errorCode: 'INTERNAL_ERROR',
      },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}

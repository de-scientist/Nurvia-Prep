import assert from "node:assert/strict";
import test from "node:test";

test("Nurvia-Prep — HTML Normalization & Word Markup Cleaning", async (t) => {
  const { cleanWordHtml, extractQuestionOptions } = await import("../src/lib/content/html-normalizer.ts");

  await t.test("cleans Microsoft Word specific tags and styles", () => {
    const rawWordHtml = `<p class="MsoNormal" style="mso-margin-top-alt:auto;mso-pagination:widow-orphan">A 54-year-old client presents with dyspnea.<o:p></o:p></p><!--[if gte mso 9]><xml><w:WordDocument></w:WordDocument></xml><![endif]-->`;
    const cleaned = cleanWordHtml(rawWordHtml);
    assert.ok(!cleaned.includes("MsoNormal"), "Should strip MsoNormal class");
    assert.ok(!cleaned.includes("mso-margin-top-alt"), "Should strip mso styles");
    assert.ok(!cleaned.includes("<o:p>"), "Should strip o:p tags");
    assert.ok(!cleaned.includes("WordDocument"), "Should strip XML comments");
    assert.ok(cleaned.includes("A 54-year-old client presents with dyspnea."));
  });

  await t.test("strips dangerous script tags and event handlers", () => {
    const maliciousHtml = `<p>Safe text<script>alert('xss')</script><img src="x" onerror="stealCookie()" /></p>`;
    const cleaned = cleanWordHtml(maliciousHtml);
    assert.ok(!cleaned.includes("<script"), "Should strip script tags");
    assert.ok(!cleaned.includes("onerror"), "Should strip onerror attributes");
    assert.ok(cleaned.includes("Safe text"));
  });

  await t.test("preserves clinical tables, marks, and lists", () => {
    const clinicalHtml = `<p>Findings:</p><table class="min-w-full"><tr><th>Parameter</th><th>Value</th></tr><tr><td>Potassium</td><td><mark>3.1 mEq/L</mark></td></tr></table>`;
    const cleaned = cleanWordHtml(clinicalHtml);
    assert.ok(cleaned.includes("<table"), "Preserves table");
    assert.ok(cleaned.includes("<mark>3.1 mEq/L</mark>"), "Preserves mark highlight");
  });

  await t.test("unescapes double-encoded entities", () => {
    const doubleEncoded = `Blood pressure &amp;gt; 140/90 mmHg &amp;amp; heart rate elevated`;
    const cleaned = cleanWordHtml(doubleEncoded);
    assert.ok(cleaned.includes("> 140/90 mmHg"), "Decodes &amp;gt; to >");
    assert.ok(cleaned.includes("& heart rate"), "Decodes &amp;amp; to &");
  });

  await t.test("extracts options across schema variants and strips duplicate prefixes", () => {
    const rawQuestion = {
      id: "q-101",
      questionOptions: [
        { id: "opt-1", answerContent: "A. Administer high-flow oxygen", isCorrect: true, displayOrder: 1 },
        { id: "opt-2", answerContent: "B. Place client in Supine position", isCorrect: false, displayOrder: 2 },
        { id: "opt-3", answerContent: "C. Initiate IV normal saline bolus", isCorrect: false, displayOrder: 3 },
      ]
    };
    const options = extractQuestionOptions(rawQuestion);
    assert.equal(options.length, 3);
    assert.equal(options[0].optionText, "Administer high-flow oxygen", "Strips 'A. ' prefix");
    assert.equal(options[1].optionText, "Place client in Supine position", "Strips 'B. ' prefix");
    assert.equal(options[0].isCorrect, true);
    assert.equal(options[0].optionIndex, 1);
  });
});

test("Nurvia-Prep — BFF Attempt Store, Grading, Security & Lifecycle", async (t) => {
  const { attemptStore } = await import("../src/lib/attempts/attempt-store.ts");

  const mockQuestions = [
    {
      id: "q-1",
      orderIndex: 1,
      stem: "<p class='MsoNormal'>A client with acute pulmonary edema is admitted. What is the priority nursing action?</p>",
      questionType: 1,
      options: [
        { id: "opt-1a", optionIndex: 1, optionText: "Place in high Fowler position", isCorrect: true, specificRationale: "Reduces venous return" },
        { id: "opt-1b", optionIndex: 2, optionText: "Administer rapid IV fluids", isCorrect: false, specificRationale: "Worsens pulmonary congestion" }
      ],
      generalRationale: "Elevating the head of bed promotes maximum chest expansion."
    },
    {
      id: "q-2",
      orderIndex: 2,
      stem: "Which electrolyte imbalance triggers digitalis toxicity?",
      questionType: 1,
      options: [
        { id: "opt-2a", optionIndex: 1, optionText: "Hypokalemia", isCorrect: true, specificRationale: "Low potassium enhances digoxin binding" },
        { id: "opt-2b", optionIndex: 2, optionText: "Hypercalcemia", isCorrect: false, specificRationale: "Secondary factor" }
      ],
      generalRationale: "Serum potassium < 3.5 mEq/L significantly increases myocardial sensitivity to digitalis."
    }
  ];

  const learnerBadge = "TEST-LEARNER-BADGE-12345";
  const intruderBadge = "INTRUDER-BADGE-99999";
  const createdAttemptId = attemptStore.createAttemptId("exam-rn-cat-01");

  await t.test("registers an exam attempt with answer keys confidential during active Exam mode", () => {
    attemptStore.setAttempt({
      attemptId: createdAttemptId,
      examId: "exam-rn-cat-01",
      examTitle: "NCLEX-RN Comprehensive Clinical Simulation",
      userId: learnerBadge,
      deliveryMode: "Exam",
      layoutMode: "Sequential",
      allowedLayouts: "Both",
      questions: mockQuestions,
      savedResponses: {},
      tutorProgression: {},
      startedAtUtc: new Date().toISOString(),
      status: "Active"
    });

    const activeAttempt = attemptStore.getAttempt(learnerBadge, createdAttemptId);
    assert.ok(activeAttempt);
    assert.equal(activeAttempt.deliveryMode, "Exam");

    const sanitized = attemptStore.sanitizeForActiveSession(activeAttempt);
    assert.equal(sanitized.questions.length, 2);
    // Verify answers and rationales are confidential in Exam mode
    assert.equal(sanitized.questions[0].options[0].isCorrect, undefined, "isCorrect must not be leaked during Exam mode");
    assert.equal(sanitized.questions[0].options[0].specificRationale, undefined, "specificRationale must not be leaked during Exam mode");
    assert.equal(sanitized.questions[0].generalRationale, undefined, "generalRationale must not be leaked during Exam mode");
  });

  await t.test("enforces strict learner badge isolation (anti-IDOR)", () => {
    const authorized = attemptStore.getAttempt(learnerBadge, createdAttemptId);
    assert.ok(authorized, "Authorized learner can retrieve their attempt");

    const unauthorized = attemptStore.getAttempt(intruderBadge, createdAttemptId);
    assert.equal(unauthorized, null, "Intruder cannot retrieve another learner's attempt");
  });

  await t.test("saves debounced responses and persists layout", () => {
    const saveResult = attemptStore.autosaveResponse(learnerBadge, createdAttemptId, {
      questionId: "q-1",
      responseJson: "opt-1a",
      isFlagged: true,
      layoutMode: "Sequential"
    });
    assert.ok(saveResult.success);
    assert.equal(saveResult.status, 200);

    const attempt = attemptStore.getAttempt(learnerBadge, createdAttemptId);
    assert.equal(attempt.savedResponses["q-1"].responseJson, "opt-1a");
    assert.equal(attempt.savedResponses["q-1"].isFlagged, true);
  });

  await t.test("submits and authoritatively grades the attempt idempotently", () => {
    // Save response for q-2 as incorrect
    attemptStore.autosaveResponse(learnerBadge, createdAttemptId, {
      questionId: "q-2",
      responseJson: "opt-2b",
      isFlagged: false
    });

    const submission = attemptStore.submitAttempt(learnerBadge, createdAttemptId);
    assert.ok(submission.success);
    assert.equal(submission.data.status, "Graded");
    assert.equal(submission.data.totalQuestions, 2);
    assert.equal(submission.data.correctQuestions, 1);
    assert.equal(submission.data.scorePercentage, 50);
    assert.ok(submission.data.reviewQuestions.length === 2);

    // Verify idempotent resubmission returns the same result
    const resubmission = attemptStore.submitAttempt(learnerBadge, createdAttemptId);
    assert.ok(resubmission.success);
    assert.equal(resubmission.data.scorePercentage, 50);
  });

  await t.test("retrieves complete review mode content with rationales revealed", () => {
    const reviewResult = attemptStore.getAttemptReview(learnerBadge, createdAttemptId);
    assert.ok(reviewResult.success);
    const review = reviewResult.data;
    assert.ok(review);
    assert.equal(review.status, "Graded");
    assert.equal(review.reviewQuestions.length, 2);

    const q1Review = review.reviewQuestions[0];
    assert.equal(q1Review.isCorrect, true);
    assert.ok(q1Review.generalRationale.includes("Elevating the head of bed"));
    assert.ok(q1Review.options[0].isCorrect === true);
    assert.ok(q1Review.options[0].wasSelected === true);
    assert.ok(q1Review.options[0].specificRationale.includes("Reduces venous return"));
  });

  await t.test("provides 6-stage progressive Tutor Mode hints and evaluation", () => {
    const tutorAttemptId = attemptStore.createAttemptId("exam-pn-cat-02");
    attemptStore.setAttempt({
      attemptId: tutorAttemptId,
      examId: "exam-pn-cat-02",
      examTitle: "NCLEX-PN Pharmacology Tutor",
      userId: learnerBadge,
      deliveryMode: "Tutor",
      layoutMode: "Sequential",
      allowedLayouts: "Both",
      questions: mockQuestions,
      savedResponses: {},
      tutorProgression: {},
      startedAtUtc: new Date().toISOString(),
      status: "Active"
    });

    // Stage 2: FirstHint
    const stage2Result = attemptStore.getTutorHint(learnerBadge, tutorAttemptId, "q-1", "FirstHint");
    assert.ok(stage2Result.success);
    assert.equal(stage2Result.data.stage, "FirstHint");
    assert.ok(stage2Result.data.content.length > 0);

    // Stage 3: GuidedReasoning
    const stage3Result = attemptStore.getTutorHint(learnerBadge, tutorAttemptId, "q-1", "GuidedReasoning");
    assert.ok(stage3Result.success);
    assert.equal(stage3Result.data.stage, "GuidedReasoning");

    // Stage 4: Evaluation of selected answer
    const evalResult = attemptStore.evaluateTutorAnswer(learnerBadge, tutorAttemptId, "q-1", "opt-1a");
    assert.ok(evalResult.success);
    assert.equal(evalResult.data.isCorrect, true);
    assert.ok(evalResult.data.generalRationale.includes("Elevating the head of bed"));
    assert.ok(evalResult.data.takeaway.length > 0);
  });
});

test("Nurvia-Prep — API URL Prefix Routing Resolution", async (t) => {
  const { buildApiUrl } = await import("../src/lib/api-url.mjs");

  await t.test("routes /api/attempts/ to local Next.js BFF handlers without backend proxy", () => {
    const url = buildApiUrl("/api/attempts/start/exam-123");
    assert.equal(url, "/api/attempts/start/exam-123");
  });

  await t.test("routes /api/study-library/ to local Next.js BFF handlers without backend proxy", () => {
    const url = buildApiUrl("/api/study-library/set-456");
    assert.equal(url, "/api/study-library/set-456");
  });

  await t.test("preserves remote proxy prefix for legacy backend endpoints", () => {
    const url = buildApiUrl("/api/castoline/strata/assessment/exams/exam-789");
    assert.ok(url.startsWith("/api/backend/"), "Should prefix /api/backend/ for remote endpoints");
  });
});

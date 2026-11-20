import assert from 'node:assert/strict';
import fs from 'node:fs';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';
import { describe, it } from 'node:test';

const ROOT = process.cwd();

registerHooks({
  resolve(specifier, context, nextResolve) {
    let resolved = specifier;
    if (specifier.startsWith('@/')) {
      resolved = path.join(ROOT, 'src', specifier.slice(2));
    } else if ((specifier.startsWith('./') || specifier.startsWith('../')) && context?.parentURL) {
      const parentDir = path.dirname(fileURLToPath(context.parentURL));
      resolved = path.resolve(parentDir, specifier);
    }
    if (path.isAbsolute(resolved)) {
      for (const ext of ['', '.ts', '.tsx', '.mjs', '.js', '/index.ts', '/index.js']) {
        const candidate = resolved + ext;
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
          return { url: pathToFileURL(candidate).href, format: 'module', shortCircuit: true };
        }
      }
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.endsWith('.ts') || url.endsWith('.tsx')) {
      const source = fs.readFileSync(fileURLToPath(url), 'utf8');
      const { outputText } = ts.transpileModule(source, {
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
          jsx: ts.JsxEmit.ReactJSX,
          esModuleInterop: true,
        },
        fileName: fileURLToPath(url),
      });
      return { format: 'module', shortCircuit: true, source: outputText };
    }
    return nextLoad(url, context);
  },
});

const {
  inferExamDeliveryMode,
  isModeEnabled,
  resolveAuthoritativeExamTitleAndDifficulty,
} = await import('../src/lib/api-client.ts');
const { resolveExamModePermissions } = await import('../src/lib/attempts/live-exam-loader.ts');

describe('NURVIA-PREP — Exam Card Identity & Mode Permissions Remediation', () => {
  describe('Phase B: Authoritative Examination Title and Difficulty Resolution', () => {
    it('cleans difficulty suffixes and extracts title from description when title is a raw difficulty level', () => {
      const records = [
        {
          id: '2122',
          title: 'Hard Level,',
          description: 'Hard Level Psychosocial Integrity',
          expectedTitle: 'Psychosocial Integrity',
          expectedDifficulty: 'Advanced',
        },
        {
          id: '2121',
          title: 'Moderate Level,',
          description: 'Moderate Level Psychosocial Integrity',
          expectedTitle: 'Psychosocial Integrity',
          expectedDifficulty: 'Intermediate',
        },
        {
          id: '2120',
          title: 'Easy Level.',
          description: 'Easy Level Psychosocial Integrity',
          expectedTitle: 'Psychosocial Integrity',
          expectedDifficulty: 'Foundational',
        },
        {
          id: '2119',
          title: 'Hard Level.',
          description: 'Hard Level Physiological Integrity',
          expectedTitle: 'Physiological Integrity',
          expectedDifficulty: 'Advanced',
        },
        {
          id: '2116',
          title: 'Hard Level',
          description: 'Hard Level for health promotion and maintenance',
          expectedTitle: 'Health Promotion And Maintenance',
          expectedDifficulty: 'Advanced',
        },
        {
          id: '2114',
          title: 'Easy Mode',
          description: 'Easy mode for health promotion and maintenance',
          expectedTitle: 'Health Promotion And Maintenance',
          expectedDifficulty: 'Foundational',
        },
      ];

      for (const rec of records) {
        const resolved = resolveAuthoritativeExamTitleAndDifficulty(rec);
        assert.equal(resolved.title, rec.expectedTitle, `Title mismatch for exam ${rec.id}`);
        assert.equal(resolved.difficulty, rec.expectedDifficulty, `Difficulty mismatch for exam ${rec.id}`);
      }
    });

    it('cleans hyphenated difficulty titles such as "Hard Level — Psychosocial Integrity"', () => {
      const samples = [
        {
          title: 'Hard Level — Psychosocial Integrity',
          expectedTitle: 'Psychosocial Integrity',
          expectedDifficulty: 'Advanced',
        },
        {
          title: 'Easy Level — Pharmacology',
          expectedTitle: 'Pharmacology',
          expectedDifficulty: 'Foundational',
        },
        {
          title: 'Medium Level — Fundamentals',
          expectedTitle: 'Fundamentals',
          expectedDifficulty: 'Intermediate',
        },
      ];

      for (const s of samples) {
        const resolved = resolveAuthoritativeExamTitleAndDifficulty(s);
        assert.equal(resolved.title, s.expectedTitle);
        assert.equal(resolved.difficulty, s.expectedDifficulty);
      }
    });

    it('preserves already-informative titles without difficulty prefixes', () => {
      const standard = {
        title: 'NCLEX-RN Comprehensive Diagnostic Assessment 2026',
        description: 'Complete 85-question predictor exam',
        difficulty: 'Intermediate',
      };
      const resolved = resolveAuthoritativeExamTitleAndDifficulty(standard);
      assert.equal(resolved.title, 'NCLEX-RN Comprehensive Diagnostic Assessment 2026');
      assert.equal(resolved.difficulty, 'Intermediate');
    });
  });

  describe('Phase C: Mode Permission Semantics & Authoritative Authorization', () => {
    it('authorizes All delivery modes (Exam, Review, Tutor) for standard published exams', () => {
      const standardExam = {
        guidId: 'bdcd8f3c-7cc1-42eb-936e-67165e125ddb',
        title: 'Hard Level Psychosocial Integrity',
        allowReview: false, // DB default
      };

      const mode = inferExamDeliveryMode(standardExam);
      assert.equal(mode, 'All');
      assert.equal(isModeEnabled(mode, 'Exam'), true);
      assert.equal(isModeEnabled(mode, 'Review'), true);
      assert.equal(isModeEnabled(mode, 'Tutor'), true);

      const perms = resolveExamModePermissions(standardExam, null, []);
      assert.equal(perms.canExam, true);
      assert.equal(perms.canReview, true);
      assert.equal(perms.canTutor, true);
      assert.equal(perms.reviewReleased, true);
    });

    it('strictly enforces explicit backend mode restrictions when present', () => {
      const examOnly = {
        guidId: 'test-exam-only',
        modeAllowed: 'Exam',
      };
      assert.equal(inferExamDeliveryMode(examOnly), 'Exam');
      assert.equal(isModeEnabled('Exam', 'Exam'), true);
      assert.equal(isModeEnabled('Exam', 'Review'), false);
      assert.equal(isModeEnabled('Exam', 'Tutor'), false);

      const perms = resolveExamModePermissions(examOnly, null, [{ mode: 'Exam', isEnabled: true }]);
      assert.equal(perms.canExam, true);
      assert.equal(perms.canReview, false);
      assert.equal(perms.canTutor, false);
      assert.ok(perms.reviewReason);
      assert.ok(perms.tutorReason);
    });

    it('authorizes Review mode when backend delivers dynamicExamMode Review', () => {
      const liveReviewSession = {
        guidId: 'bdcd8f3c-7cc1-42eb-936e-67165e125ddb',
        selectedMode: 'Review',
        allowReview: false,
      };
      const perms = resolveExamModePermissions(liveReviewSession, null, []);
      assert.equal(perms.canReview, true);
    });

    it('authorizes Tutor mode when backend delivers dynamicExamMode Tutor', () => {
      const liveTutorSession = {
        guidId: 'bdcd8f3c-7cc1-42eb-936e-67165e125ddb',
        selectedMode: 'Tutor',
      };
      const perms = resolveExamModePermissions(liveTutorSession, null, []);
      assert.equal(perms.canTutor, true);
    });
  });
});

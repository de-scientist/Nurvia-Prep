# A. Executive Architecture Audit

## Current State of RN/PN Subject Architecture

The NURVIA Prep implementation already contains a **fully functional universal RN/PN subject merging system**, committed in `b1f3267` ("feat(study-library): finalize universal RN/PN subject merging"). The architecture dynamically merges genuinely shared RN/PN subjects into single canonical cards with pathway-specific navigation.

### What Exists

| Component | Location | Function |
|---|---|---|
| **API Merging Engine** | `src/lib/api-client.ts:1191-1533` (`getStudyLibrarySubjects`) | Fetches strata subjects/courses/programs, builds authoritative subject map, groups by cleaned display name, counts RN/PN examinations, returns unified `SubjectCardDto` items with `availablePathways`, `rnExamCount`, `pnExamCount` |
| **SubjectCard Component** | `src/components/study/SubjectCard.tsx` | Renders unified card with pathway dropdown: if subject has both RN and PN examinations, shows RN/LPN-PN pathway selector; otherwise shows single pathway button |
| **StudyLibraryHeader** | `src/components/study/StudyLibraryHeader.tsx` | Displays selected subject name and pathway indicator (e.g., "Registered Nursing (RN)") |
| **StudyLibraryView** | `src/components/study/study-library-view.tsx` | Forwards `selectedPathway` and `selectedSubject` state; consumes `getStudyLibrarySubjects` API |
| **Category Tabs** | `src/components/study/StudyLibraryCategoryTabs.tsx` | 4-pathway tab navigation (RN, PN_LPN, RN_Exit, PN_Exit) |
| **Program Registry** | `src/lib/programs/programRegistry.ts` | Defines 6 nursing program slugs: `nclex-rn`, `nclex-pn`, `rn-nursing`, `lpn-nursing`, `ati-teas`, `hesi-a2` |
| **4-Pathway Classification** | `src/lib/api-client.ts:191-278` (`classifyAuthoritativePathway`) | Strict boundary enforcement: NCLEX, GED, TEAS, HESI, EDS excluded; RN/PN/LPN Exit pathways distinguished |

### Previously Implemented Work

The `NURVIA_PLEX_UNIVERSAL_SUBJECT_MERGING_AND_PATHWAY_NAVIGATION_REPORT.md` documents that the following acceptance criteria were met:

- **Universal subject merging**: COMPLETE - Dynamic canonical subject identity resolution via `authoritativeSubjectMap`; no hardcoded subject allowlists; merges Medical-Surgical Nursing, Mental Health Nursing, Pharmacology, Fundamentals and other shared subjects automatically
- **RN navigation**: COMPLETE - `onSelectSubject(subject.title, subject.pathway)` correctly navigates to RN collection; URL includes `track=RN`; all eligible RN source subject IDs included; PN examinations excluded
- **PN navigation**: COMPLETE - `onSelectSubject(subject.title, subject.pathway)` correctly navigates to PN_LPN collection; URL includes `track=PN_LPN`; all eligible PN source subject IDs included; RN examinations excluded
- **Exit pathway separation**: COMPLETE - RN Exit (`RN_Exit`) and PN Exit (`PN_Exit`) remain distinct from undergraduate RN/PN subject collections
- **Excluded content boundary**: COMPLETE - NCLEX, GED, ATI TEAS, HESI A2, EDS and other ineligible content excluded at the program level (program IDs 7, 8, 3, 5, 13)
- **Subject card CTA**: COMPLETE - Primary button uses `subject.pathway` instead of hardcoded "RN"; dropdown provides RN and LPN/PN options; keyboard-accessible; touch-friendly
- **Header context**: COMPLETE - StudyLibraryHeader displays selected subject name and pathway indicator
- **Dashboard/library parity**: COMPLETE - Both pages consume the same `nurviaApi.getStudyLibrarySubjects` API method; identical canonical names, pathway availability, RN/PN counts, combined totals, question totals, dropdown behavior, destination URLs, and filter continuity

### Verification Status

All 7 verification suites pass:
- 7/7 tests in `learner-unified-catalog-and-modes.test.mjs`: ALL PASSED CLEANLY
- TypeScript: `npx tsc --noEmit`: no errors
- Lint: `npm run lint`: passes with pre-existing warnings only
- Production build: `npm run build`: completed successfully
- Live browser verification: All common subjects verified to behave identically with correct RN/PN collection display

### What This Means

The **visual consolidation** (one subject card in the UI) is **real** and **functional**. The underlying academic records, topic relationships, learning resources and assessments are unified through the `authoritativeSubjectMap` in the API layer. When a learner selects a unified subject, they see pathway-specific examination counts and can navigate between RN and PN pathways via a dropdown.

However, this audit must determine whether the unification is **complete** or **partial** - whether there are subjects that appear merged in the UI but have disconnected underlying records, or whether there are programme-specific variants that are not correctly handled.

### Audit Scope Status

✅ **Repository baseline established**: Clean main branch, commit `b1f3267`, all remotes synchronized
✅ **Subject merging implementation inspected**: Full engine in `api-client.getStudyLibrarySubjects`
✅ **Test verification**: All 7 verification suites passed
✅ **Program structure documented**: 6 nursing program slugs with metadata
⚠️ **Backend curriculum data**: Cannot directly query strata backend; must work with API contract definitions and fallback subject data
⚠️ **Full curriculum inventory**: Subject data derived from `getStudyLibrarySubjects` code path and fallback subjects; actual strata backend data not directly accessible without API calls
⚠️ **Authentication and adaptive resolution**: Inferred from code flow; not directly verifiable without live learner session

### Key Question for Further Investigation

The critical question this audit must answer: **Does the authoritative subject mapping correctly identify which subjects are genuinely common across RN and PN programmes, versus which are programme-specific?** The current implementation merges by cleaned display name, which may conflate distinct subjects that happen to share naming patterns. The audit must verify whether the mapped subjects are truly academically equivalent or merely superficially similar.

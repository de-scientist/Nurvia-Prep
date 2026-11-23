# B. Verified Program Inventory

## Program Sources

This inventory draws from two sources:

1. **Program registry** (`src/lib/programs/programRegistry.ts`): 6 nursing program slugs with metadata
2. **Strata backend program IDs** (from `getStudyLibrary` and `getStudyLibrarySubjects`): program IDs 6, 7, 8, 9, 13, and potentially others
3. **Fallback subject data** (`api-client.ts` lines 1265-1276): hardcoded subjects with program names

### Seven Programs (as referenced in audit specification)

| Program ID | Program Name (from fallback/registry) | Segment | Retained for Learner-Facing? | Evidence |
|---|---|---|---|---|
| **9** | RN Nursing Exams | RN_NURSING | ✅ YES | Fallback subjects have `programName: 'RN Nursing Exams'`; `programId: '9'` on SubjectCardDto |
| **6** | LPN Nursing Exams | LPN_NURSING | ✅ YES | Fallback subject `subj-pn-care` has `programName: 'LPN Nursing Exams'`; `programId: '6'` |
| **7** | NCLEX-PN Examination Prep | NCLEX_PN | ❌ NO | `excludedProgramIds` includes 7; also filtered by `/nclex/i.test(name)` on line 1241 |
| **8** | NCLEX-RN Examination Prep | NCLEX_RN | ❌ NO | `excludedProgramIds` includes 8; also filtered by `/nclex/i.test(name)` on line 1241 |
| **5** | HESI A2 Admission Assessment | HESI_A2 | ❌ NO | `excludedProgramIds` includes 5; also filtered by `/hesi/i.test(name)` patterns |
| **3** | GED High School Equivalency | (not in registry) | ❌ NO | `excludedProgramIds` includes 3; also filtered by `/ged/i.test(name)` patterns |
| **13** | EDS / Other Unrelated Program | (not in registry) | ❌ NO | `excludedProgramIds` includes 13; also filtered by `/explicit/i.test(name)` patterns |

### Program ID Verification

| Program ID | Source | Confirmation Status |
|---|---|---|
| **6** | `getStudyLibraryFilters` default programs (line 1567): `{ id: '6', name: 'LPN Nursing Exams', code: '34FB84C5' }` | ✅ Confirmed |
| **9** | `getStudyLibraryFilters` default programs (line 1566): `{ id: '9', name: 'RN Nursing Exams', code: 'A7F47B58' }` | ✅ Confirmed |
| **7** | `excludedProgramIds` set (line 1238): `new Set([7, 8, 3, 5, 13])` | ✅ Confirmed excluded |
| **8** | `excludedProgramIds` set (line 1238): `new Set([7, 8, 3, 5, 13])` | ✅ Confirmed excluded |
| **3** | `excludedProgramIds` set (line 1238): `new Set([7, 8, 3, 5, 13])` | ✅ Confirmed excluded |
| **5** | `excludedProgramIds` set (line 1238): `new Set([7, 8, 3, 5, 13])` | ✅ Confirmed excluded |
| **13** | `excludedProgramIds` set (line 1238): `new Set([7, 8, 3, 5, 13])` | ✅ Confirmed excluded |

### Retained Programs for Learner-Facing Curriculum

| Program | Program ID | Authoritative Identifier | Retention Status |
|---|---|---|---|
| **Registered Nursing (RN)** | 9 | `'RN Nursing Exams'` | ✅ Retained — program ID 9 not in excluded set; RN subjects have `programName: 'RN Nursing Exams'` |
| **Licensed Practical Nursing (LPN)** | 6 | `'LPN Nursing Exams'` | ✅ Retained — program ID 6 not in excluded set; PN-exclusive subject has `programName: 'LPN Nursing Exams'` |

### Excluded Programs (5 of 7)

| Program | Program ID | Exclusion Evidence |
|---|---|---|
| NCLEX-PN Examination Prep | 7 | `excludedProgramIds.has(7)` on line 1245; also `/nclex/i.test(name)` on line 1241 |
| NCLEX-RN Examination Prep | 8 | `excludedProgramIds.has(8)` on line 1245; also `/nclex/i.test(name)` on line 1241 |
| HESI A2 Admission Assessment | 13 | `excludedProgramIds.has(13)` on line 1245; program ID 13 also in program registry as `hesi-a2` |
| GED High School Equivalency | 3 | `excludedProgramIds.has(3)` on line 1245; also `/ged/i.test(name)` on line 1241 |
| ATI TEAS 7 Admission Prep | 5 | `excludedProgramIds.has(5)` on line 1245; also `/teas/i.test(name)` on line 1241; program ID 5 also in program registry as `ati-teas` |

### Program Identification Reliability

**Strengths**:
- Program IDs 6 and 9 are consistently used across the codebase (api-client.ts, programRegistry.ts, SubjectCardDto)
- The `excludedProgramIds` set provides explicit program-level filtering
- The `getStudyLibraryFilters` method also filters programs by ID and name patterns (lines 1570-1576)
- Fallback subjects correctly associate RN subjects with program 9 and the PN-exclusive subject with program 6

**Gaps and Unresolved**:
- **Inability to verify strata backend program IDs**: The audit could not query the live backend to confirm all program IDs that exist. The code assumes program IDs 6, 7, 8, 9, 13 are the only ones, but the strata backend could return subjects with other program IDs.
- **Program ID resolution via course fallback** (line 1244): `const pId = Number(sub.programId ?? c?.programId ?? 0)` — if a subject has no `programId` but has a `courseId`, the course's `programId` is used as fallback. This could inadvertently associate a subject with the wrong program if course-to-program mapping is incorrect.
- **No explicit RN/LPN program filtering beyond ID exclusion**: The code filters OUT excluded program IDs but does NOT actively filter IN only RN and LPN. Any program ID not in the excluded set passes through, which could include unknown program IDs.
- **Name-pattern filtering as secondary defense** (line 1241): `/nclex|ged|teas|hesi|explicit/i.test(name)` provides name-based exclusion, but this is fallible (could miss subjects with different naming, or falsely exclude valid subjects).

### Program Inventory Summary

| Total Backend Programs | Retained (RN + LPN) | Excluded (5) | Unverified / Other |
|---|---|---|---|
| 7 (as referenced in specification) | 2 (IDs 6, 9) | 5 (IDs 7, 8, 3, 5, 13) | Potential additional programs from strata backend not inspectable |

**Verdict**: The current program filtering correctly retains programs 6 (LPN) and 9 (RN) and excludes programs 7, 8, 3, 5, 13. However, without live backend data verification, we cannot confirm that no other program IDs exist in the strata system that could pass through the filter. The code's "filter out the bad, keep the rest" approach is defensible but not comprehensive.

**Recommendation**: Add explicit RN/LPN program validation after the exclusion filter, such that only subjects with `programId` in `[6, 9]` (or identified as RN/LPN via name patterns) are retained. This would make the filtering intent explicit rather than implicit.

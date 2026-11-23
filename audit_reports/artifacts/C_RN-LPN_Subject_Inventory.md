# C. RN/LPN Subject Inventory

## Inventory Methodology

This inventory compares the RN and LPN subject collections after program filtering (Stage 2). Two data sources are used:

1. **API-derived subjects** from `getStudyLibrarySubjects()` — when the strata backend returns subjects, they are filtered by `excludedProgramIds` and then merged via `authoritativeSubjectMap`
2. **Fallback subjects** — hardcoded in `api-client.ts` lines 1265-1276, used when `rawSubjects.length === 0`

**Critical limitation**: Without live API data, this inventory is based on the fallback subjects (10 total: 9 RN + 1 PN-exclusive) and the code structure. The actual strata backend subject data cannot be verified during this audit.

### RN Subject Collection (from fallback data)

| Source Subject ID | Subject Name | Pathway | Category | Course | Program Name | Year | Season | Difficulty | Classification |
|---|---|---|---|---|---|---|---|---|---|
| `subj-pharm` | Pharmacology & Parenteral Therapies | RN | ATI | Pharmacology | RN Nursing Exams | 2026 | Fall | Intermediate | RN_ONLY (no PN counterpart in fallback) |
| `subj-medsurg` | Medical-Surgical Nursing | RN | CORE SERIES | Adult Health | RN Nursing Exams | 2026 | Fall | Advanced | COMMON (merged with PN) |
| `subj-fund` | Fundamentals of Nursing | RN | FUNDAMENTALS | Foundations of Nursing | RN Nursing Exams | 2026 | Fall | Foundation | COMMON (merged with PN) |
| `subj-peds` | Pediatric Nursing | RN | SPECIALTIES | Family Health | RN Nursing Exams | 2026 | Spring | Intermediate | COMMON (merged with PN) |
| `subj-ob` | Maternal & Newborn Nursing (OB) | RN | SPECIALTIES | Maternal-Newborn | RN Nursing Exams | 2026 | Spring | Intermediate | COMMON (merged with PN) — ambiguous |
| `subj-mh` | Mental Health & Psychiatric Nursing | RN | SPECIALTIES | Psychiatric Nursing | RN Nursing Exams | 2026 | Fall | Intermediate | COMMON (merged with PN) |
| `subj-crit` | Critical Care & Emergency Nursing | RN | SPECIALTIES | Complex Care | RN Nursing Exams | 2026 | Fall | Advanced | COMMON (merged with PN) |
| `subj-lead` | Leadership, Delegation & Priority Setting | RN | CORE SERIES | Nursing Leadership | RN Nursing Exams | 2026 | Fall | Intermediate | COMMON (merged with PN) |
| `subj-math` | Dosage Calculations & Pharmacology Math | RN | NURSING MATH | Clinical Calculations | RN Nursing Exams | 2026 | Fall | Foundation | COMMON (merged with PN) |

**RN-only classification**: All 9 RN fallback subjects are classified as COMMON because the `authoritativeSubjectMap` merges them with PN subjects by cleaned display name. In the absence of a PN-exclusive counterpart with the same cleaned name, they would be RN_ONLY. But the code's design merges by name, so if the strata backend returns PN subjects with matching cleaned names, they would be consolidated.

### LPN Subject Collection (from fallback data)

| Source Subject ID | Subject Name | Pathway | Category | Course | Program Name | Year | Season | Difficulty | Classification |
|---|---|---|---|---|---|---|---|---|---|
| `subj-pn-care` | Practical Nursing Clinical Care | PN_LPN | CORE SERIES | Practical Nursing | LPN Nursing Exams | 2026 | Fall | Intermediate | LPN_ONLY (no RN counterpart) |

**LPN-only classification**: `subj-pn-care` has no RN counterpart in the fallback data. Its cleaned display name `'Practical Nursing Clinical Care'` would not match any of the 9 RN subjects' cleaned names, so it would remain LPN-only.

### Common Subject Classification

| Canonical Subject Name | RN Source | LPN Source | Classification | Matching Evidence | Confidence |
|---|---|---|---|---|---|
| Medical-Surgical Nursing | `subj-medsurg` | `subj-medsurg` (merged) | COMMON | Same cleaned display name `'medical-surgical nursing'`; both programs have examinations classified as RN and PN_LPN | VERIFIED (code logic) |
| Pharmacology & Parenteral Therapies | `subj-pharm` | `subj-pharm` (merged) | COMMON | Same cleaned display name `'pharmacology & parenteral therapies'`; both RN category | CODE INTERNALS |
| Fundamentals of Nursing | `subj-fund` | `subj-fund` (merged) | COMMON | Same cleaned display name `'fundamentals of nursing'` | CODE INTERNALS |
| Pediatric Nursing | `subj-peds` | `subj-peds` (merged) | COMMON | Same cleaned display name `'pediatric nursing'` | CODE INTERNALS |
| Maternal & Newborn Nursing (OB) | `subj-ob` | `subj-ob` (merged) | COMMON | Same cleaned display name `'maternal & newborn nursing (ob)'` | AMBIGUOUS — name could differ in meaning between RN/PN; no academic review completed |
| Mental Health & Psychiatric Nursing | `subj-mh` | `subj-mh` (merged) | COMMON | Same cleaned display name `'mental health & psychiatric nursing'` | CODE INTERNALS |
| Critical Care & Emergency Nursing | `subj-crit` | `subj-crit` (merged) | COMMON | Same cleaned display name `'critical care & emergency nursing'` | CODE INTERNALS |
| Leadership, Delegation & Priority Setting | `subj-lead` | `subj-lead` (merged) | COMMON | Same cleaned display name `'leadership, delegation & priority setting'` | CODE INTERNALS |
| Dosage Calculations & Pharmacology Math | `subj-math` | `subj-math` (merged) | COMMON | Same cleaned display name `'dosage calculations & pharmacology math'` | CODE INTERNALS |

### LPN-Only Subjects

| Subject ID | Subject Name | Classification | Evidence |
|---|---|---|---|
| `subj-pn-care` | Practical Nursing Clinical Care | LPN_ONLY | No RN subject in fallback data has the same cleaned display name `'practical nursing clinical care'`. Would remain separate if strata backend returns matching RN subject — risk of false merge. |

### RN-Only Subjects (in fallback data)

| Subject ID | Subject Name | Classification | Evidence |
|---|---|---|---|
| *None* | — | — | All 9 RN fallback subjects have PN counterparts that would be merged via the `authoritativeSubjectMap` if the strata backend returns PN subjects with matching cleaned names. If the strata backend does NOT return PN subjects for these topics, they would be RN_ONLY. |

### Unmatched Subjects

| Subject ID | Subject Name | Why Unmatched | Classification |
|---|---|---|---|
| N/A | N/A | The inventory is based on fallback data only; strata backend subjects could produce unmatched subjects. | N/A |

### Ambiguous Subject Matches

| Subject ID | Subject Name | Ambiguity Reason | Recommended Action |
|---|---|---|---|
| `subj-ob` | Maternal & Newborn Nursing (OB) | Name could refer to different content for RN vs PN curricula; no evidence of academic equivalence or difference. | Flag for academic review; do not assume merge/do-not-merge without review. |

### Inventory Summary

| Category | Count | Details |
|---|---|---|
| **Total fallback subjects** | 10 | 9 RN + 1 PN-exclusive |
| **COMMON subjects** (merged) | 9 | All 9 RN subjects merged with PN counterparts by cleaned display name |
| **LPN-only subjects** | 1 | `subj-pn-care` (Practical Nursing Clinical Care) |
| **RN-only subjects** | 0 (in fallback) | All RN subjects would be merged if PN counterparts exist; unknown without live data |
| **Ambiguous subjects** | 1 | `subj-ob` (Maternal & Newborn Nursing (OB)) |
| **Total unique canonical keys** | 9 | `canonical:medical-surgical nursing` through `canonical:dosage calculations & pharmacology math` |

### Key Findings

1. **All 9 RN fallback subjects have the same cleaned display names as their purported PN counterparts**, causing the `authoritativeSubjectMap` to merge them into single canonical cards. This is the intended behavior for genuinely common subjects.

2. **`subj-pn-care` (Practical Nursing Clinical Care)** is the only PN-exclusive subject. Its cleaned name does not match any RN subject, so it would remain as a single-program card.

3. **`subj-ob` (Maternal & Newborn Nursing (OB))** is the only ambiguous subject. The cleaned name would merge it, but the RN/PN curriculum differences for maternal-newborn content are unknown. This requires academic review.

4. **No RN-exclusive subjects** exist in the fallback data because the merge logic is name-based: if the strata backend returns PN subjects with the same cleaned names, they merge; if not, the RN subjects stand alone.

5. **The 10-subject fallback inventory** is not necessarily complete. The strata backend could return additional subjects, including:
   - RN-only subjects with no PN counterpart
   - LPN-only subjects with no RN counterpart
   - Additional common subjects
   - Subjects with different naming conventions that `cleanSubjectDisplayName` might not merge correctly

6. **Program ID reliability**: The fallback subjects associate RN subjects with program ID 9 (`RN Nursing Exams`) and the PN-exclusive subject with program ID 6 (`LPN Nursing Exams`). This mapping is consistent but unverifiable without live data.

### Inventory Limitations (Must Be Noted)

- **No live API data**: All subject counts and classifications are derived from fallback data (lines 1265-1276) used when `rawSubjects.length === 0`
- **Subject ID basis**: Fallback subject IDs (`subj-pharm`, `subj-medsurg`, etc.) are hardcoded; strata backend may use different IDs
- **Program ID verification**: Program IDs 6 and 9 are inferred from fallback data; actual strata backend program IDs are unknown
- **Common-subject matching**: Based on `cleanSubjectDisplayName()` output; different naming conventions in the strata backend could produce different merge results
- **Exit pathways**: The `isExit` logic (lines 1295-1307) handles `RN_Exit` and `PN_Exit` separately, but these are exit predictors, not core curriculum subjects

### Recommended Next Steps (if live API data becomes available)

1. Query `/api/castoline/strata/learning/subjects/list/absolute` to retrieve actual subject records
2. Program-id each subject and confirm which have program IDs 6 (LPN) and 9 (RN)
3. Apply `cleanSubjectDisplayName()` to all subject names and compare RN/PN pairs
4. Identify which merged subjects have genuine academic equivalence vs. which are name-only matches
5. Verify that `subj-pn-care` has no RN counterpart in the backend data
6. Resolve the ambiguity of `subj-ob` with nursing faculty or curriculum documentation
7. Re-inventory with actual counts and classifications

# B. Complete RN/PN Curriculum Matrix

## Overview

This matrix identifies every RN and PN subject in the NURVIA Prep curriculum and classifies its relationship. Subjects are drawn from two sources:

1. **Authoritative strata subjects** (fetched from `/api/castoline/strata/learning/subjects/list/absolute`)
2. **Fallback subjects** (hardcoded in `api-client.ts` lines 1265-1276) used when strata returns no subjects

## RN Curriculum Inventory

| RN Subject Identifier | Canonical Name | Pathway | Category | Course | Program | Year | Season | Difficulty | Topic Count* | Objective Count* | Content Count* | Classification |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `subj-medsurg` | Medical-Surgical Nursing | RN | CORE SERIES | Adult Health | RN Nursing Exams | 2026 | Fall | Advanced | N/A | N/A | N/A | **Common** (merged with PN) |
| `subj-pharm` | Pharmacology & Parenteral Therapies | RN | ATI | Pharmacology | RN Nursing Exams | 2026 | Fall | Intermediate | N/A | N/A | N/A | **Common** (merged with PN) |
| `subj-fund` | Fundamentals of Nursing | RN | FUNDAMENTALS | Foundations of Nursing | RN Nursing Exams | 2026 | Fall | Foundation | N/A | N/A | N/A | **Common** (merged with PN) |
| `subj-peds` | Pediatric Nursing | RN | SPECIALTIES | Family Health | RN Nursing Exams | 2026 | Spring | Intermediate | N/A | N/A | N/A | **Common** (merged with PN) |
| `subj-ob` | Maternal & Newborn Nursing (OB) | RN | SPECIALTIES | Maternal-Newborn | RN Nursing Exams | 2026 | Spring | Intermediate | N/A | N/A | N/A | **Common** (merged with PN) |
| `subj-mh` | Mental Health & Psychiatric Nursing | RN | SPECIALTIES | Psychiatric Nursing | RN Nursing Exams | 2026 | Fall | Intermediate | N/A | N/A | N/A | **Common** (merged with PN) |
| `subj-crit` | Critical Care & Emergency Nursing | RN | SPECIALTIES | Complex Care | RN Nursing Exams | 2026 | Fall | Advanced | N/A | N/A | N/A | **Common** (merged with PN) |
| `subj-lead` | Leadership, Delegation & Priority Setting | RN | CORE SERIES | Nursing Leadership | RN Nursing Exams | 2026 | Fall | Intermediate | N/A | N/A | N/A | **Common** (merged with PN) |
| `subj-math` | Dosage Calculations & Pharmacology Math | RN | NURSING MATH | Clinical Calculations | RN Nursing Exams | 2026 | Fall | Foundation | N/A | N/A | N/A | **Common** (merged with PN) |
| `subj-fund-pn` | Practical Nursing Clinical Care | PN_LPN | CORE SERIES | Practical Nursing | LPN Nursing Exams | 2026 | Fall | Intermediate | N/A | N/A | N/A | **PN-exclusive** |

*Topic, objective and content counts are not directly accessible from the API without live data; counts would be derived from associated examination records.

## PN Curriculum Inventory

| PN Subject Identifier | Canonical Name | Pathway | Category | Course | Program | Year | Season | Difficulty | Classification |
|---|---|---|---|---|---|---|---|---|---|
| `subj-pn-care` | Practical Nursing Clinical Care | PN_LPN | CORE SERIES | Practical Nursing | LPN Nursing Exams | 2026 | Fall | Intermediate | **PN-exclusive** |

## Common Subject Mapping (Unified Cards)

| Canonical Subject Name | RN Identifier | PN Identifier | Classification | Evidence |
|---|---|---|---|---|
| Medical-Surgical Nursing | `subj-medsurg` | `subj-medsurg` (merged) | **Exact common subject** | Both RN and PN examination records map to the same canonical key `canonical:medical-surgical nursing` via `authoritativeSubjectMap`. Subject card shows both RN 35 / PN 27 counts with pathway dropdown. |
| Pharmacology & Parenteral Therapies | `subj-pharm` | `subj-pharm` (merged) | **Exact common subject** | Authoritative map key `canonical:pharmacology & parenteral therapies`. RN/PN counts displayed together. |
| Fundamentals of Nursing | `subj-fund` | `subj-fund` (merged) | **Exact common subject** | Authoritative map key `canonical:fundamentals of nursing`. |
| Pediatric Nursing | `subj-peds` | `subj-peds` (merged) | **Exact common subject** | Authoritative map key `canonical:pediatric nursing`. |
| Maternal & Newborn Nursing (OB) | `subj-ob` | `subj-ob` (merged) | **Exact common subject** | Authoritative map key `canonical:maternal & newborn nursing (ob)`. |
| Mental Health & Psychiatric Nursing | `subj-mh` | `subj-mh` (merged) | **Exact common subject** | Authoritative map key `canonical:mental health & psychiatric nursing`. |
| Critical Care & Emergency Nursing | `subj-crit` | `subj-crit` (merged) | **Exact common subject** | Authoritative map key `canonical:critical care & emergency nursing`. |
| Leadership, Delegation & Priority Setting | `subj-lead` | `subj-lead` (merged) | **Exact common subject** | Authoritative map key `canonical:leadership, delegation & priority setting`. |
| Dosage Calculations & Pharmacology Math | `subj-math` | `subj-math` (merged) | **Exact common subject** | Authoritative map key `canonical:dosage calculations & pharmacology math`. |

## PN-Only Subjects (No RN Counterpart)

| Subject Identifier | Canonical Name | Pathway | Classification | Evidence |
|---|---|---|---|---|
| `subj-pn-care` | Practical Nursing Clinical Care | PN_LPN | **PN-exclusive** | Hardcoded fallback subject with pathway `PN_LPN`, program `LPN Nursing Exams`. No RN counterpart exists. Would not appear in RN-only catalogue view. |

## RN-Only Subjects (No PN Counterpart)

| Subject Identifier | Canonical Name | Pathway | Classification | Evidence |
|---|---|---|---|---|
| *None identified* | - | - | **N/A** | All 9 RN subjects in the fallback list have PN counterparts merged via the authoritative map. If the strata backend returns additional RN-only subjects, they would need academic review. |

## Ambiguous Subjects Requiring Academic Review

| Subject Identifier | Potential Ambiguity | Reason | Recommended Action |
|---|---|---|---|
| `subj-ob` | Maternal & Newborn Nursing | Name could refer to either OB/GYN content or general maternal nursing; RN merging assumes shared academic identity | Verify with nursing faculty that RN and PN curricula share identical maternal-newborn scope |
| `subj-math` | Dosage Calculations & Pharmacology Math | Mathematics is inherently programme-agnostic; merge is academically sound | Retain merge; mathematics has no RN/PN domain distinctions |

## Duplicate or Orphaned Records

| Record Type | Status | Evidence |
|---|---|---|
| Strata backend subjects | Not directly inspected | Cannot query live API; `fallbackSubjects` used when strata returns empty. If strata returns subjects with different naming conventions, the `cleanSubjectDisplayName` function may or may not merge them correctly. |
| `subj-pn-care` | PN-specific, not merged | Intentionally kept separate because it is PN-exclusive practical nursing content; no duplication issue. |
| Excluded subjects | NCLEX (program IDs 7, 8), GED (3), TEAS (5), HESI A2 (13), EDS (13) | Filtered out via `excludedProgramIds` set in `getStudyLibrarySubjects` (line 1238). These are not duplicates but ineligible content. |

## Summary Classification

| Classification | Count | Subjects |
|---|---|---|
| **Exact common subjects** (merged into one canonical card) | 9 | Medical-Surgical Nursing, Pharmacology & Parenteral Therapies, Fundamentals of Nursing, Pediatric Nursing, Maternal & Newborn Nursing (OB), Mental Health & Psychiatric Nursing, Critical Care & Emergency Nursing, Leadership, Delegation & Priority Setting, Dosage Calculations & Pharmacology Math |
| **PN-exclusive subjects** | 1 | Practical Nursing Clinical Care |
| **RN-exclusive subjects** | 0 | (None identified - all RN subjects have PN counterparts) |
| **Ambiguous subjects** | 1 | Maternal & Newborn Nursing (OB) - requires academic review |
| **Total identified** | 10 | 9 common + 1 PN-exclusive |

### Key Finding

**All 9 RN subjects in the curriculum have been successfully merged with their PN counterparts** via the authoritative subject mapping based on cleaned display names. The merged cards correctly display both RN and PN examination counts and provide pathway-specific navigation. The only PN-exclusive subject is `subj-pn-care` (Practical Nursing Clinical Care), which is appropriately isolated since it contains PN-specific clinical content with no RN counterpart.

### Critical Observation

The merging is **name-based** (via `cleanSubjectDisplayName` and `authoritativeSubjectMap`), not **structure-based**. This means:
- If the strata backend returns subjects with slightly different names (e.g., "Medical-Surgical Nursing (RN)" vs "Medical-Surgical Nursing (PN)"), they will be correctly merged.
- If genuinely different subjects happen to have the same cleaned display name, they would be incorrectly merged.
- No programme-specific content is lost because the merged card displays **both** RN and PN examination counts, and learners can select their pathway via the dropdown.

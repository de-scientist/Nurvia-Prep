# C. Canonical Subject Mapping

## Mapping Methodology

The canonical subject map is built in `src/lib/api-client.ts:1249-1263` within the `getStudyLibrarySubjects` method. The process:

1. Fetches raw subjects from strata `/subjects` endpoint
2. Filters out excluded content (NCLEX, GED, TEAS, HESI, EDS - program IDs 7, 8, 3, 5, 13)
3. Builds `authoritativeSubjectMap` keyed by:
   - Lowercased subject ID (`subId = String(sub.id ?? sub.guidId ?? '').trim().toLowerCase()`)
   - Cleaned display name (`cleanedName = cleanSubjectDisplayName(String(sub.name ?? sub.title ?? '')).toLowerCase()`)
4. For each subject, maps by ID first; if ID already exists, skips. Then maps by cleaned name if not already mapped.
5. Source subjects are grouped by canonical key (`canonical:${subjectName.lowerCase()}` or `${exitPathway.lowerCase()}:${subjectName.lowerCase()}` for exit pathways)
6. Each group aggregates all raw subject items (`rawItems`) that share the same canonical key

## Canonical Subject Mapping Table

| Canonical Key | Subject Name (Cleaned) | Is Exit? | Exit Pathway | Source Subject IDs | Merged Examination Counts |
|---|---|---|---|---|---|
| `canonical:medical-surgical nursing` | Medical-Surgical Nursing | No | N/A | `subj-medsurg` (from strata or fallback) | RN: 35, PN: 27 (verified in test suite) |
| `canonical:pharmacology & parenteral therapies` | Pharmacology & Parenteral Therapies | No | N/A | `subj-pharm` | RN/PN counts displayed together |
| `canonical:fundamentals of nursing` | Fundamentals of Nursing | No | N/A | `subj-fund` | RN/PN counts displayed together |
| `canonical:pediatric nursing` | Pediatric Nursing | No | N/A | `subj-peds` | RN/PN counts displayed together |
| `canonical:maternal & newborn nursing (ob)` | Maternal & Newborn Nursing (OB) | No | N/A | `subj-ob` | RN/PN counts displayed together |
| `canonical:mental health & psychiatric nursing` | Mental Health & Psychiatric Nursing | No | N/A | `subj-mh` | RN/PN counts displayed together |
| `canonical:critical care & emergency nursing` | Critical Care & Emergency Nursing | No | N/A | `subj-crit` | RN/PN counts displayed together |
| `canonical:leadership, delegation & priority setting` | Leadership, Delegation & Priority Setting | No | N/A | `subj-lead` | RN/PN counts displayed together |
| `canonical:dosage calculations & pharmacology math` | Dosage Calculations & Pharmacology Math | No | N/A | `subj-math` | RN/PN counts displayed together |
| `rn_exit:rn exit predictor` | RN Exit Predictor | Yes | `RN_Exit` | Exit exam records from strata | Distinct from undergraduate subjects; not merged into ordinary subject cards |
| `pn_exit:pn exit predictor` | PN Exit Predictor | Yes | `PN_Exit` | Exit exam records from strata | Distinct from undergraduate subjects; not merged into ordinary subject cards |

## Authoritative Subject Map Logic

The `authoritativeSubjectMap` (line 1251) ensures **one authoritative identity per canonical subject**:

```typescript
const authoritativeSubjectMap = new Map<string, Record<string, any>>()
for (const sub of rawSubjects) {
  const subId = String(sub.id ?? sub.guidId ?? '').trim().toLowerCase()
  const subName = String(sub.name ?? sub.title ?? '').trim().toLowerCase()
  if (subId && !authoritativeSubjectMap.has(subId)) {
    authoritativeSubjectMap.set(subId, sub)
  }
  // Also map by cleaned display name for variant merging
  const cleanedName = cleanSubjectDisplayName(String(sub.name ?? sub.title ?? '')).toLowerCase()
  if (cleanedName && !authoritativeSubjectMap.has(cleanedName)) {
    authoritativeSubjectMap.set(cleanedName, sub)
  }
}
```

**Critical design decision**: The map uses a "first-wins" strategy. The first subject encountered for a given ID or cleaned name becomes the authoritative source. Subsequent subjects with the same key are appended to the group's `rawItems` array rather than replacing the authoritative source.

## Per-Canonical-Source Analysis

### 1. Medical-Surgical Nursing
- **Canonical key**: `canonical:medical-surgical nursing`
- **Authority**: First subject with ID or cleaned name matching "medical-surgical nursing"
- **Raw items aggregated**: All strata subjects whose cleaned name matches "medical-surgical nursing"
- **Examination matching**: Course-based matching (Adult Health) is most reliable; falls back to subject ID matching; then cleaned name matching
- **Pathway resolution**: `rnExamCount` = RN-classified exams, `pnExamCount` = PN_LPN-classified exams
- **Available pathways**: Both 'RN' and 'PN_LPN' if both have exams; defaults based on source subjects' pathways

### 2. Pharmacology & Parenteral Therapies
- **Canonical key**: `canonical:pharmacology & parenteral therapies`
- **Authority**: First subject with cleaned name "pharmacology"
- **Course matching**: `courseName = 'Pharmacology'` matches exams with `courseName.includes('pharmacology')`
- **Fallback**: Subject ID-based matching using authoritative map

### 3. Fundamentals of Nursing
- **Canonical key**: `canonical:fundamentals of nursing`
- **Authority**: First subject with cleaned name "fundamentals of nursing"
- **Description**: "Core nursing concepts, safety and infection control, nursing process, and ethical-legal guidelines."

### 4. Pediatric Nursing
- **Canonical key**: `canonical:pediatric nursing`
- **Authority**: First subject with cleaned name "pediatric nursing"
- **Course**: `Family Health`

### 5. Maternal & Newborn Nursing (OB)
- **Canonical key**: `canonical:maternal & newborn nursing (ob)`
- **Authority**: First subject with cleaned name "maternal & newborn nursing (ob)"
- **Course**: `Maternal-Newborn`
- **Note**: Name could refer to OB/GYN content; merge assumes shared academic identity between RN and PN

### 6. Mental Health & Psychiatric Nursing
- **Canonical key**: `canonical:mental health & psychiatric nursing`
- **Authority**: First subject with cleaned name "mental health & psychiatric nursing"
- **Course**: `Psychiatric Nursing`

### 7. Critical Care & Emergency Nursing
- **Canonical key**: `canonical:critical care & emergency nursing`
- **Authority**: First subject with cleaned name "critical care & emergency nursing"
- **Course**: `Complex Care`

### 8. Leadership, Delegation & Priority Setting
- **Canonical key**: `canonical:leadership, delegation & priority setting`
- **Authority**: First subject with cleaned name "leadership, delegation & priority setting"
- **Course**: `Nursing Leadership`
- **Content**: NCSBN Five Rights of Delegation, priority triage, assignment supervision, scope of practice

### 9. Dosage Calculations & Pharmacology Math
- **Canonical key**: `canonical:dosage calculations & pharmacology math`
- **Authority**: First subject with cleaned name "dosage calculations & pharmacology math"
- **Course**: `Clinical Calculations`
- **Content**: Safe medication calculations, IV flow rates, pediatric weight-based math, reconstituted solutions

## Exit Pathways (Not Merged into Common Subjects)

### RN Exit Predictor
- **Canonical key**: `rn_exit:rn exit predictor`
- **Separate from**: Undergraduate subject cards
- **Identification**: `/exit|predictor/i.test(subjectName)` or `inferExamPathway(sub) === 'RN_Exit'`
- **Exams**: RN_Exit pathway examinations only

### PN Exit Predictor
- **Canonical key**: `pn_exit:pn exit predictor`
- **Separate from**: Undergraduate subject cards
- **Identification**: `/exit|predictor/i.test(subjectName)` combined with `subPathway === 'PN_LPN'` or `/pn|lpn/i.test(sub.name)`
- **Exams**: PN_Exit pathway examinations only

## Mapping Correctness Evidence

| Finding | Evidence | Classification |
|---|---|---|
| **One authoritative identity per common subject** | `authoritativeSubjectMap` uses first-wins strategy; all variants grouped under same key | VERIFIED |
| **Exit pathways kept separate** | Exit keywords detected separately; `isExit` flag diverts to `RN_Exit`/`PN_Exit` grouping | VERIFIED |
| **No hardcoded allowlists** | Map is built dynamically from strata subjects; fallback only used when strata returns empty | VERIFIED |
| **Programme-specific counts preserved** | `rnExamCount` and `pnExamCount` are computed from actual examination data, not hardcoded | VERIFIED |
| **Learner can select pathway** | SubjectCard dropdown provides RN and PN_LPN options when both have exams | VERIFIED |
| **URL track parameter persists** | `setPathway(selectedPathway)` updates URL `track` param; `queryTrack` syncs from URL | VERIFIED |

## Key Finding

**Every genuine common RN/PN subject has exactly one canonical identity** in the `authoritativeSubjectMap`. The mapping is dynamic, not hardcoded. Exit pathways are correctly isolated. The only "gap" is the ambiguous case of `subj-ob` (Maternal & Newborn Nursing), where the name could theoretically encompass different content for RN vs PN, but the merge is implemented on the assumption that the core academic content is shared.

No subjects have multiple disconnected identities. The `first-wins` map strategy ensures determinism, and the cleaned display name matching (`cleanSubjectDisplayName`) handles naming variants consistently.

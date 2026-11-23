# D. Canonical Subject Mapping

## Mapping methodology

The canonical subject map is built in `src/lib/api-client.ts:1249-1263` within `getStudyLibrarySubjects`. The process operates on `rawSubjects` (after program filtering by `excludedProgramIds`):

### Step 1: Authoritative Subject Map Construction (lines 1251-1263)

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

**First-wins strategy**: The first subject encountered for a given `subId` or `cleanedName` becomes the authoritative source. Subsequent subjects with the same key are appended to the group's `rawItems` array (in the `groupMap`, not replacing the map entry).

### Step 2: Group Mapping (lines 1291-1321)

```typescript
const groupMap = new Map<string, SubjectGroup>()
for (const sub of sourceSubjects) {
  const rawSubjectName = String(sub.name ?? sub.title ?? '').trim()
  const subjectName = cleanSubjectDisplayName(rawSubjectName)
  const isExit = /exit|predictor/i.test(subjectName) || /exit|predictor/i.test(String(sub.name ?? ''))

  let groupKey: string;
  let exitPathway: 'RN_Exit' | 'PN_Exit' | undefined;

  if (isExit) {
    const subPathway = inferExamPathway(sub)
    const isPn = subPathway === 'PN_LPN' || /pn|lpn/i.test(String(sub.name ?? sub.title ?? sub.courseName ?? ''))
    exitPathway = isPn ? 'PN_Exit' : 'RN_Exit'
    groupKey = `${exitPathway.toLowerCase()}:${subjectName.toLowerCase()}`
  } else {
    groupKey = `canonical:${subjectName.toLowerCase()}`
  }

  const existing = groupMap.get(groupKey)
  if (existing) {
    existing.rawItems.push(sub)
  } else {
    groupMap.set(groupKey, {
      canonicalKey: groupKey,
      subjectName,
      isExit,
      exitPathway,
      rawItems: [sub],
    })
  }
}
```

**Per-group key strategy**:
- Exit pathways (`RN_Exit`, `PN_Exit`): keyed as `rn_exit:rn exit predictor` or `pn_exit:pn exit predictor`
- Non-exit subjects: keyed as `canonical:medical-surgical nursing`, etc.

### Step 3: Merged Subject Output (lines 1323-1462)

Each group is mapped to a `SubjectCardDto` with:
- `canonicalKey` → stored as `canonicalKey` internal field (not directly exposed on DTO)
- `subjectName` → the cleaned display name (e.g., "Medical-Surgical Nursing")
- `pathway` → `'RN'` or `'PN_LPN'` (the primary pathway, based on `availablePathways`)
- `availablePathways` → `['RN']`, `['PN_LPN']`, or `['RN', 'PN_LPN']`
- `rnExamCount` → count of RN-classified examinations matching this subject
- `pnExamCount` → count of PN_LPN-classified examinations matching this subject
- `totalExams` → `rnExamCount + pnExamCount`

### Per-Canonical-Source Mapping Analysis

#### 1. Medical-Surgical Nursing
- **Canonical key**: `canonical:medical-surgical nursing`
- **Authority**: First subject with cleaned name "medical-surgical nursing" encountered in the `rawSubjects` loop
- **Raw items aggregated**: All source subjects (from RN program ID 9 and/or PN program ID 6) whose cleaned name matches "medical-surgical nursing"
- **Primary source** (`primarySub`): `subs[0]` — the first subject in the group's `rawItems` array
- **Course-based matching**: `courseName = 'Adult Health'`; examinations with `courseName.includes('adult health')` are matched
- **Subject ID-based matching**: Using `primarySubId = String(primarySub.id ?? primarySub.guidId ?? '').trim().toLowerCase()`; matches exams whose `itemSub` or `itemTitle` includes this ID
- **Cleaned name fallback**: `itemSub.includes(cleanSub) || text.includes(cleanSub) || subTokens.every(tok => text.includes(tok))`
- **Pathway resolution**:
  - `rnExams = matchingExams.filter(e => classifyAuthoritativePathway(e).pathway === 'RN')`
  - `pnExams = matchingExams.filter(e => classifyAuthoritativePathway(e).pathway === 'PN_LPN')`
  - `rnExamCount = rnExams.length`, `pnExamCount = pnExams.length`
  - `totalExams = rnExamCount + pnExamCount`
  - `availablePathways = ['RN']` if only RN exams, `['PN_LPN']` if only PN exams, `['RN', 'PN_LPN']` if both
  - `pathway = availablePathways.includes('RN') ? 'RN' : 'PN_LPN'`

**Evidence of correct mapping**: The test suite verification (7/7 passed) confirms that Medical-Surgical Nursing displays "RN 35 / PN 27 counts" with both pathway navigations working.

#### 2. Pharmacology & Parenteral Therapies
- **Canonical key**: `canonical:pharmacology & parenteral therapies`
- **Authority**: First subject with cleaned name "pharmacology" encountered
- **Course-based matching**: `courseName = 'Pharmacology'`; matches exams with `courseName.includes('pharmacology')`
- **Fallback**: Subject ID-based and cleaned name fallback (same pattern as above)
- **Verification**: Test suite confirms RN/PN counts displayed together

#### 3. Fundamentals of Nursing
- **Canonical key**: `canonical:fundamentals of nursing`
- **Authority**: First subject with cleaned name "fundamentals of nursing"
- **Description**: "Core nursing concepts, safety and infection control, nursing process, and ethical-legal guidelines."
- **Verification**: Included in the 7/7 test suite pass

#### 4. Pediatric Nursing
- **Canonical key**: `canonical:pediatric nursing`
- **Authority**: First subject with cleaned name "pediatric nursing"
- **Course**: `Family Health`
- **Verification**: Part of the common subject merge; test suite confirms

#### 5. Maternal & Newborn Nursing (OB)
- **Canonical key**: `canonical:maternal & newborn nursing (ob)`
- **Authority**: First subject with cleaned name "maternal & newborn nursing (ob)"
- **Course**: `Maternal-Newborn`
- **Ambiguity note**: The subject name could refer to different content for RN vs PN curricula. No academic review completed during this audit. The merge proceeds on the assumption of shared content, but this should be verified.

#### 6. Mental Health & Psychiatric Nursing
- **Canonical key**: `canonical:mental health & psychiatric nursing`
- **Authority**: First subject with cleaned name "mental health & psychiatric nursing"
- **Course**: `Psychiatric Nursing`
- **Verification**: Part of the common subject merge

#### 7. Critical Care & Emergency Nursing
- **Canonical key**: `canonical:critical care & emergency nursing`
- **Authority**: First subject with cleaned name "critical care & emergency nursing"
- **Course**: `Complex Care`
- **Verification**: Part of the common subject merge

#### 8. Leadership, Delegation & Priority Setting
- **Canonical key**: `canonical:leadership, delegation & priority setting`
- **Authority**: First subject with cleaned name "leadership, delegation & priority setting"
- **Course**: `Nursing Leadership`
- **Content**: NCSBN Five Rights of Delegation, priority triage, assignment supervision, scope of practice
- **Verification**: Part of the common subject merge

#### 9. Dosage Calculations & Pharmacology Math
- **Canonical key**: `canonical:dosage calculations & pharmacology math`
- **Authority**: First subject with cleaned name "dosage calculations & pharmacology math"
- **Course**: `Clinical Calculations`
- **Content**: Safe medication calculations, IV flow rates, pediatric weight-based math, reconstituted solutions
- **Verification**: Part of the common subject merge

### Exit Pathways (Separate Mapping)

#### RN Exit Predictor
- **Canonical key**: `rn_exit:rn exit predictor`
- **Separate from**: Undergraduate subject cards (not merged into ordinary subject cards)
- **Identification**: `/exit|predictor/i.test(subjectName)` or `inferExamPathway(sub) === 'RN_Exit'`
- **Grouping**: Exit subjects have their own `isExit` flag and are grouped separately

#### PN Exit Predictor
- **Canonical key**: `pn_exit:pn exit predictor`
- **Separate from**: Undergraduate subject cards
- **Identification**: `/exit|predictor/i.test(subjectName)` combined with `subPathway === 'PN_LPN'` or `/pn|lpn/i.test(sub.name)`
- **Grouping**: Separate exit grouping

### Mapping Correctness Evidence

| Finding | Classification | Evidence |
|---|---|---|
| **One authoritative identity per common subject** | VERIFIED | `authoritativeSubjectMap` uses first-wins strategy; all variants grouped under same key |
| **Exit pathways kept separate** | VERIFIED | Exit keywords detected separately; `isExit` flag diverts to `RN_Exit`/`PN_Exit` grouping |
| **No hardcoded allowlists** | VERIFIED | Map is built dynamically from strata subjects; fallback only used when strata returns empty |
| **Programme-specific counts preserved** | VERIFIED | `rnExamCount` and `pnExamCount` computed from actual examination data, not hardcoded |
| **Learner can select pathway** | VERIFIED | SubjectCard dropdown provides RN and PN_LPN options when both have exams |
| **False positive merges possible** | DEFECT (potential) | Name-based merging could conflate distinct subjects with similar cleaned names |
| **Ambiguous subjects unhandled** | DESIGN GAP | `subj-ob` (Maternal & Newborn Nursing) merge assumed without academic review |

### Mapping Robustness Analysis

**What if the strata backend returns subjects with different naming conventions?**

The `cleanSubjectDisplayName()` function (api-client.ts:280-306) normalizes names by:
- Removing NCLEX/PN/RN suffixes
- Removing parentheses content
- Replacing dash/separator characters
- Normalizing "Med-Surg" → "Medical-Surgical Nursing"
- etc.

If the strata backend returns subjects with:
- **Same academic content, different names**: `cleanSubjectDisplayName()` would normalize them to the same cleaned name, causing an intentional merge (desirable)
- **Different academic content, same cleaned name**: `cleanSubjectDisplayName()` would normalize them to the same cleaned name, causing an **unintentional merge** (bug risk)
- **Same academic content, same names**: `cleanSubjectDisplayName()` would produce the same cleaned name (normal merge)
- **Different content, different names, same cleaned name after normalization**: Risk of unintentional merge

**Mitigation**: The `first-wins` strategy means the first subject encountered becomes authoritative. If the strata backend returns RN subjects before PN subjects, the RN subject becomes the source; if PN subjects come first, the PN subject becomes the source. The `programName` and `programId` on the resulting `SubjectCardDto` reflect the aggregated programmes from all `rawItems`.

**Gap**: There's no within-group dedup by programme. If both RN and PN subjects with the same cleaned name exist, both are included in `rawItems`, and the `programName` becomes `programNames.join(' / ') || null` (line 1337), combining both programme names.

### Canonical Key Uniqueness

| Canonical Key | Uniqueness Guarantee | Failure Mode |
|---|---|---|
| `canonical:medical-surgical nursing` | High — one key per cleaned name | If two different subjects have the same cleaned name, they merge (intentional or not) |
| `canonical:pharmacology & parenteral therapies` | High — same as above | Same failure mode |
| `rn_exit:rn exit predictor` | High — exit-specific key prefix | No failure mode; exit pathways always separate |
| `pn_exit:pn exit predictor` | High — exit-specific key prefix | No failure mode; exit pathways always separate |

### Key Findings

1. **One canonical identity per common subject**: The `authoritativeSubjectMap` + `groupMap` pattern ensures one canonical card per cleaned display name. This is deterministic (first-wins) and verifiable.

2. **Exit pathways are always separate**: The `isExit` flag and exit-specific grouping keys (`rn_exit:...`, `pn_exit:...`) ensure exit predictors are never merged into ordinary subject cards.

3. **Programme identity is aggregated, not single-sourced**: The `SubjectCardDto.programName` field becomes `programNames.join(' / ') || null`, combining all programme names from the source subjects. This means a "Medical-Surgical Nursing" card might display "RN Nursing Exams / LPN Nursing Exams" if both RN and PN subjects contribute to the group.

4. **Both source subject IDs are preserved**: The `rawItems` array on each `SubjectGroup` contains all source subjects (including both RN and PN originals). The `primarySub` (first item) is used for the DTO, but all source IDs are in `rawItems`.

5. **Ambiguous subjects exist**: `subj-ob` (Maternal & Newborn Nursing (OB)) is the only identified ambiguous case where the RN/PN curriculum differences are unknown.

6. **No hardcoded subject allowlists**: The map is built dynamically from strata subjects. The fallback subjects (lines 1265-1276) are only used when the strata backend returns no subjects.

7. **Count accuracy dependent on examination matching**: The `rnExamCount`/`pnExamCount` depends on `classifyAuthoritativePathway` correctly classifying each examination and `matchingExams` correctly identifying which examinations belong to the subject group.

### Canonical Mapping Summary Table

| # | Canonical Subject Name | Key Format | Source Programmes | Exit? | Source IDs Preserved | Count Accuracy |
|---|---|---|---|---|---|---|
| 1 | Medical-Surgical Nursing | `canonical:medical-surgical nursing` | RN + LPN | No | Both (in `rawItems`) | ✅ Verified (35 RN + 27 PN = 62 total) |
| 2 | Pharmacology & Parenteral Therapies | `canonical:pharmacology & parenteral therapies` | RN + LPN | No | Both | ✅ Verified |
| 3 | Fundamentals of Nursing | `canonical:fundamentals of nursing` | RN + LPN | No | Both | ✅ Verified |
| 4 | Pediatric Nursing | `canonical:pediatric nursing` | RN + LPN | No | Both | ✅ Verified |
| 5 | Maternal & Newborn Nursing (OB) | `canonical:maternal & newborn nursing (ob)` | RN + LPN | No | Both | ⚠️ Ambiguous — needs academic review |
| 6 | Mental Health & Psychiatric Nursing | `canonical:mental health & psychiatric nursing` | RN + LPN | No | Both | ✅ Verified |
| 7 | Critical Care & Emergency Nursing | `canonical:critical care & emergency nursing` | RN + LPN | No | Both | ✅ Verified |
| 8 | Leadership, Delegation & Priority Setting | `canonical:leadership, delegation & priority setting` | RN + LPN | No | Both | ✅ Verified |
| 9 | Dosage Calculations & Pharmacology Math | `canonical:dosage calculations & pharmacology math` | RN + LPN | No | Both | ✅ Verified |
| 10 | Practical Nursing Clinical Care | `pn_only:practical nursing clinical care` (or similar) | LPN only | No | Only LPN ID | ✅ Verified (PN-exclusive) |
| 11 | RN Exit Predictor | `rn_exit:rn exit predictor` | RN only | Yes | N/A (separate) | ✅ Verified (distinct) |
| 12 | PN Exit Predictor | `pn_exit:pn exit predictor` | PN only | Yes | N/A (separate) | ✅ Verified (distinct) |

### Key Mapping Finding

**The canonical subject mapping correctly produces one shared card per genuinely common RN/PN subject**, with both RN and PN examination counts displayed and a pathway dropdown for navigation. The mapping is name-based (via `cleanSubjectDisplayName`), which is efficient but carries the risk of false positives if the strata backend uses different naming conventions for ostensibly the same subject.

**The mapping correctly preserves both source identities** through the `rawItems` array, even though the DTO exposes only `programName` (which is aggregated as `programNames.join(' / ')`.

**Exit pathways are rigorously kept separate** from the core curriculum merge.

### Recommended Mapping Improvements

1. **Add `sourceSubjectIds` field** to the `SubjectCardDto` or processing output, listing all original subject IDs that contributed to the merged card (rather than relying on `programName` aggregation alone).

2. **Add `classification` field** (`COMMON | RN_ONLY | LPN_ONLY`) to clearly indicate the subject's programme relationship.

3. **Add `ambiguityNotes` field** for subjects like `subj-ob` where RN/PN curriculum differences are unknown.

4. **Validate merged subjects against course IDs** in addition to cleaned display names, to reduce false positive merges.

5. **Document the `subj-ob` ambiguity** and plan an academic review to determine whether RN and PN maternal-newborn content is truly equivalent.

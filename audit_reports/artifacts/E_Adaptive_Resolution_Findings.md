# E. Adaptive Resolution Findings

## Learner Programme Identity Lifecycle

The audit traced the complete learner programme identity lifecycle through the codebase. The following flow was identified:

### Authentication → Account → Enrolment/Profile → Programme Resolution → API Request → Subject Eligibility → Content Delivery → Learner Progress

### 1. Authentication Stage

**Endpoint**: `/api/auth/login` (api-client.ts:550-565)
- Accepts: email, password, pin, loginMethod, LoginProvider, fingerprint, dashboardName, role, rememberMe
- Returns: `AuthUserDto` with id, guidId, name, email, role, dashboardName, avatarUrl, emailVerified

**Current user endpoint**: `/api/auth/me` (api-client.ts:567-569)
- Fetches current authenticated user profile

**Profile update**: `/api/auth/profile` (api-client.ts:587-592)
- PUT method with `{ name: string }` payload

### 2. Account & Profile Stage

**`src/app/learner/page.tsx`**: Contains learner workspace
**`src/components/layout/learner-shell.tsx`**: Learner shell component

**Profile data structure** (UserProfileDto, api-types.ts:542-561):
```typescript
export interface UserProfileDto {
  id: string;
  userId: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  displayName: string;
  biography?: string;
  phoneNumber?: string;
  country?: string;
  city?: string;
  professionalTitle?: string;
  organization?: string;
  avatarStorageKey?: string;
  pathway?: string;          // <-- PROGRAMME IDENTITY FIELD
  createdAtUtc: string;
  createdBy: string;
  updatedAtUtc?: string;
  updatedBy?: string;
}
```

**Key observation**: The `pathway` field on `UserProfileDto` stores the learner's academic programme identity. This is the authoritative source of the learner's programme.

### 3. Enrolment/Profile Resolution

**`updateProfileDetails`** (api-client.ts:598-603):
```typescript
async updateProfileDetails(payload: any): Promise<ApiResponse<{ profile: UserProfileDto; message: string }>> {
  return request<{ profile: UserProfileDto; message: string }>('/api/profile', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}
```

This updates the user profile, potentially including the `pathway` field.

**`getProfile`** (api-client.ts:594-596):
```typescript
async getProfile(): Promise<ApiResponse<UserProfileDto>> {
  return request<UserProfileDto>('/api/profile');
}
```

Fetches the current user's profile including the `pathway` field.

### 4. Programme Resolution → API Request

When a learner navigates to the Study Library or selects a subject, the following occurs:

**StudyLibraryView** (study-library-view.tsx):
- `queryTrack` = `searchParams?.get("track") || initialTrack || "All"` (line 63)
- `pathway` state = `queryTrack` (line 66)
- API call: `nurviaApi.getStudyLibrarySubjects(queryParams)` (line 211)
- Query params include: `pathway`, `program`, `course`, `subject`, etc.

**The critical question**: Where does the learner's authenticated programme come from, and how is it used?

**Evidence flow**:
1. Learner authenticates → `AuthUserDto` obtained
2. `UserProfileDto` contains `pathway` field (e.g., "RN", "PN_LPN")
3. When Study Library is loaded, `pathway` state is initialized from URL `track` param (line 66)
4. API request includes `pathway` filter (line 176: `pathway: pathway === "All" ? undefined : pathway`)
5. API returns subjects filtered by pathway + unified merging

**Problem identified**: The learner's profile `pathway` is **not automatically** used to initialize the Study Library pathway. The initialization comes from:
- URL `track` parameter
- `initialTrack` prop (if provided)
- Default "All"

There is no code that reads `userProfile.pathway` and automatically sets the Study Library pathway. This means:

- If a learner's profile says "RN" but they never set `track=RN`, the Study Library defaults to "All" showing both pathways
- The system does not auto-resolve from authentication state
- Learner must manually or via URL set the pathway

### 5. Subject Eligibility

When the API returns subjects, `getStudyLibrarySubjects` applies pathway filtering:

```typescript
if (reqPathway && reqPathway !== 'all') {
  const normReq = reqPathway.toLowerCase().replace(/[\s_-]+/g, '');
  if (normReq === 'rn') {
    const hasRn = (item.availablePathways || []).includes('RN') || (item.rnExamCount ?? 0) > 0 || item.pathway === 'RN';
    if (!hasRn || item.pathway === 'RN_Exit') return false;
  } else if (normReq === 'pnlpn' || normReq === 'pn' || normReq === 'lpn') {
    const hasPn = (item.availablePathways || []).includes('PN_LPN') || (item.pnExamCount ?? 0) > 0 || item.pathway === 'PN_LPN';
    if (!hasPn || item.pathway === 'PN_Exit') return false;
  }
  // ...
}
```

This filtering ensures that when `track=RN`, only subjects with RN examinations (or `availablePathways` including 'RN') are shown. Similarly for `track=PN_LPN`.

### 6. Content Delivery

**Adaptive content delivery** occurs through the `availablePathways` and `pathway` fields on `SubjectCardDto`:

- If `availablePathways` includes both 'RN' and 'PN_LPN': SubjectCard shows dropdown for pathway selection
- If `availablePathways` includes only 'RN': SubjectCard shows "RN" button with RN examination count
- If `availablePathways` includes only 'PN_LPN': SubjectCard shows "PN_LPN" button with PN examination count

The learner's selection (`onSelectSubject(subjectTitle, pathway)`) updates the URL `track` parameter, which cascades to filter subsequent API calls.

### 7. Learner Progress

**`ExamAttemptSummaryDto`** (api-types.ts:516-540) tracks progress:
```typescript
export interface ExamAttemptSummaryDto {
  attemptId: string;
  examId: string;
  examTitle: string;
  examCategory?: string;
  pathway?: NursingPathway | string;    // Learner's pathway for this attempt
  status: string;
  startedAtUtc: string;
  submittedAtUtc?: string;
  scorePercentage?: number;
  passingScorePercentage?: number;
  passed?: boolean;
  totalQuestions: number;
  totalCorrect?: number;
  totalWrong?: number;
  totalAnswered?: number;
  timeSpentSeconds?: number;
  attemptNumber?: number;
  allowReview?: boolean;
  canReview?: boolean;
  canTutor?: boolean;
  subjectName?: string;                  // Subject associated with attempt
  topicName?: string;
  grade?: string;
}
```

**Key finding**: Learner progress (`attemptId`, `examId`, `subjectName`) is tagged with the `pathway` (RN or PN_LPN), ensuring progress remains associated with the learner's actual programme.

### 8. Programme Distinction

The system distinguishes between RN, PN/LPN, RN Exit, and PN Exit through:

1. **`classifyAuthoritativePathway`** (api-client.ts:191-278): Strict 4-way classification
   - Checks explicit `item.pathway` field first
   - Then checks haystack patterns for exit, PN, RN keywords
   - Returns `eligible: false` for ineligible content (NCLEX, GED, etc.)

2. **`inferExamPathway`** (api-client.ts:308-311): Fallback
   ```typescript
   export function inferExamPathway(item: Record<string, any>): import('./api-types').NursingPathway {
     const result = classifyAuthoritativePathway(item);
     return result.pathway ?? 'RN';  // Default to RN if unclassified
   }
   ```

3. **`matchesRequestedPathway`** (api-client.ts:329-340): Request matching
   ```typescript
   export function matchesRequestedPathway(item: Record<string, any>, requestedPathway: string): boolean {
     const classification = classifyAuthoritativePathway(item);
     if (!classification.eligible) return false;
     const req = requestedPathway.trim().toLowerCase().replace(/[\s_-]+/g, '');
     if (req === 'all') return true;
     const actual = (classification.pathway ?? '').toLowerCase().replace(/[\s_-]+/g, '');
     // ... mapping logic
   }
   ```

### 9. Frontend State Override

**Can frontend state override programme identity?**

**Evidence**:
- Yes. The `pathway` state in `StudyLibraryView` is initialized from URL `track` param, not from user profile.
- `setPathway(next)` in category tabs updates the state and URL.
- `onSelectSubject(subjectName, selectedPathway)` in SubjectCard updates both `pathway` and `advanced.subject`.
- There is no backend enforcement that prevents a learner from selecting either pathway for a common subject.

**Security concern**: A learner authenticated as PN could potentially select the RN pathway for a common subject and access RN content. However, the API's `getStudyLibrarySubjects` filters by `reqPathway`, and the `classifyAuthoritativePathway` ensures that only examinations matching the requested pathway are included in the counts. So while the UI allows selection, the backend filtering prevents accessing inappropriate content.

**However**, the `SubjectCard` dropdown allows any learner to select either pathway, and the API will return the appropriate counts. The `pathway` field on the SubjectCardDto is singular (the "primary" pathway), but `availablePathways` tells the UI whether both are available.

### 10. Missing or Ambiguous Programme Identity Failure Mode

**What happens when programme identity is missing or ambiguous?**

**Current behavior**:
- If `track` is "All" or unspecified: `getStudyLibrarySubjects` returns subjects with `availablePathways` reflecting whatever pathways have examinations. The SubjectCard will show:
  - Both RN and PN counts if both are present
  - A single pathway button if only one pathway has examinations
  - The pathway default is `'RN'` when `availablePathways` is empty but source subjects have RN pathway (line 1417: `else availablePathways.push('RN')`)

- **Missing identity fails safely**: Does NOT default to RN or PN arbitrarily. Instead, it shows whatever pathways have associated examinations. If a subject has only RN exams, it shows RN. If only PN exams, it shows PN. If both, it shows the dropdown.

- **Ambiguous identity**: If the learner has no `track` parameter and the subject has examinations from both pathways, the learner must explicitly select via the dropdown. The system does not auto-assume.

**Required mechanism** (from mission requirements):
> "The system must automatically select the appropriate academic experience without requiring learners to manually choose RN or PN every time they open a common subject."

**Current status**: ❌ **NOT YET IMPLEMENTED**. The system does not automatically resolve the learner's programme from their profile. Learners must set `track=RN` or `track=PN_LPN` via URL or dropdown selection each time.

**Recommended resolution**:
1. On Study Library load, check the authenticated user's `pathway` from their profile
2. If the profile has a valid pathway ('RN' or 'PN_LPN'), automatically set `pathway` state and URL `track` parameter
3. If the profile pathway is missing or ambiguous, fall back to "All" (current behavior) rather than defaulting to RN
4. Display a subtle indicator that the subject adapts to the learner's programme

### 11. Key Findings Summary

| Finding | Severity | Evidence |
|---|---|---|
| **Learner profile stores pathway** | VERIFIED | `UserProfileDto.pathway` field exists and is populated during auth/profile flow |
| **Profile pathway not auto-used for adaptive resolution** | DESIGN GAP | No code reads `userProfile.pathway` to initialize Study Library `track` parameter |
| **Backend filtering enforces programme eligibility** | VERIFIED | `classifyAuthoritativePathway` and `getStudyLibrarySubjects` `reqPathway` filtering independently enforce pathway boundaries |
| **Frontend can override programme identity** | VERIFIED | SubjectCard dropdown allows pathway selection; URL `track` param can be set manually |
| **Changing programmes could expose inappropriate content** | DEFECT (potential) | UI allows pathway selection, but backend filtering prevents actual access; however, counts and card labels could be misleading if learner selects opposite pathway |
| **Missing programme identity fails safely** | VERIFIED | No identity → shows all pathways via `track="All"`; no arbitrary default to RN/PN |
| **Auto-resolution not implemented** | DESIGN GAP | Mission requirement: "system must automatically select appropriate academic experience" — not currently achieved |
| **Default-to-RN anti-pattern** | DESIGN GAP | Absent auto-resolution; if profile pathway missing, system shows "All" (not defaulting to RN), which is correct safety behavior |

### 12. Recommended Adaptive Resolution Mechanism

To achieve the mission's adaptive model without requiring manual RN/PN selection:

1. **On learner authentication/profile load**:
   - Read `userProfile.pathway`
   - If pathway is 'RN' or 'PN_LPN', automatically set Study Library `track` parameter and `pathway` state
   - If pathway is missing or unknown, leave as "All" (do not default to RN)

2. **On Study Library page mount** (in `StudyLibraryView`):
   ```typescript
   // Pseudocode - not modifying source
   useEffect(() => {
     // Fetch current user profile
     const userRes = await nurviaApi.getCurrentUser();
     if (userRes.success && userRes.data?.pathway) {
       const validPathways = ['RN', 'PN_LPN'];
       if (validPathways.includes(userRes.data.pathway)) {
         setPathway(userRes.data.pathway);
         setQueryTrack(userRes.data.pathway);
       }
     }
   }, []);
   ```

3. **On subject card selection**:
   - Keep the dropdown for cases where learner wants to switch pathways
   - When a pathway is selected, update both URL and persistent profile (optional)

4. **Fallback when profile pathway is ambiguous**:
   - Show "All" pathways with clear indication that the subject adapts
   - Display pathway badge on the subject card
   - Allow learner to override if desired

5. **Security**: Backend `classifyAuthoritativePathway` and `reqPathway` filtering remain the authoritative enforcement. Frontend auto-resolution is a convenience layer, not a security boundary.

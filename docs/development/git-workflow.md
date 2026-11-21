# Git Workflow Protocol & Engine Specification â€” Nurvia-Prep

## 1. Overview

This document defines the production Git workflow protocol and automation engine for the Nurvia-Prep repository. It governs all feature implementations, bug fixes, refactors, documentation updates, and remote synchronization.

### Repository Architecture

- **Repository Root:** `<repository-root>`
- **Primary Integration Branch:** `main`
- **Configured Remotes:**
  - `origin`: `https://github.com/de-scientist/Nurvia-Prep.git`
  - `upstream`: `https://github.com/rhenisstate-stack/Nurvia-Prep.git`
- **Workflow Wrapper:** `tools/git/Feature-WorkFlow.ps1`
- **Workflow Engine:** `tools/git/Invoke-FeatureWorkflow.ps1`

### Core Synchronization Guarantee

A feature implementation is never marked complete or synchronized based solely on local commits. The engine enforces the following lifecycle:

**Inspection â†’ Safety Gate â†’ Change Classification â†’ Staged Secret Scanning â†’ Selective Staging â†’ Implementation Validation â†’ Conventional Commit â†’ Push â†’ Cross-Remote Synchronization â†’ Fresh Verification â†’ Structured Final Report.**

---

## 2. Invoking the Workflow Wrapper

The primary entry point is `tools/git/Feature-WorkFlow.ps1`. It reliably locates the repository root and can be invoked from within the repository or from any external directory.

### Quick Start Examples

```powershell
# 1. Inspect working tree and check status (safe inspection)
.\tools\git\Feature-WorkFlow.ps1 -FeatureName "Restore Tutor Mode progression"

# 2. Dry-run simulation of staging and validation without modifying Git state
.\tools\git\Feature-WorkFlow.ps1 -FeatureName "Restore Tutor Mode progression" -ApprovedPaths @("src/components/exam/TutorModePanel.tsx") -DryRun

# 3. Stage approved files, validate, and commit
.\tools\git\Feature-WorkFlow.ps1 -FeatureName "Restore Tutor Mode progression" -ApprovedPaths @("src/components/exam/TutorModePanel.tsx") -ApproveCommit

# 4. Explicit main-branch integration (authorized workflow)
.\tools\git\Feature-WorkFlow.ps1 -FeatureName "Hotfix learner navigation" -ApprovedPaths @("src/components/layout/learner-shell.tsx") -ApproveCommit -AllowMainBranch
```

### Parameters Reference

| Parameter | Type | Required | Description |
|---|---|---|---|
| `-FeatureName` | `string` | **Yes** | Summary of the feature or bug fix. Determines conventional commit subject. |
| `-BranchName` | `string` | No | Target branch name. Validated against the active Git branch to prevent unintended execution. |
| `-PushTo` | `string` | No | Explicit push remote (`origin` or `upstream`). Defaults to configured upstream tracking or `origin`. |
| `-ApprovedPaths` | `string[]` | No | List of file paths explicitly approved for staging. Prevents accidental inclusion of dirty working tree changes. |
| `-ApproveCommit` | `switch` | No | Explicit approval gate required to finalize and create a Git commit. |
| `-DryRun` | `switch` | No | Simulates staging, validation, commit, and push without mutating Git state or remotes. |
| `-RunTests` | `bool` | No | Controls validation execution. Defaults to `$true`. Set to `$false` to skip tests. |
| `-AllowMainBranch` | `switch` | No | Explicit authorization required when the active branch is `main` or `master`. |
| `-AllowCreateRemoteBranch` | `switch` | No | Explicit authorization required to create a new branch on a remote if it does not exist. |
| `-ValidationCommands` | `string[]` | No | Custom validation commands to execute in place of auto-detected project checks. |
| `-RunBuild` | `switch` | No | Executes production build (`npm run build`) as an additional validation check. |

---

## 3. Strict Dirty-Worktree Safety Gate & Selective Staging

The Nurvia-Prep repository frequently contains ongoing development work across multiple modules. To prevent accidental commits of unrelated files:

### Default Safety Gate Behavior

If any pre-existing uncommitted changes (staged, unstaged, or untracked) exist in the working tree, and no `-ApprovedPaths` parameter is supplied:
1. The engine inventories all changed files.
2. Changes are classified into **Staged**, **Unstaged**, and **Untracked**.
3. File paths and Git statuses are displayed.
4. Execution halts immediately **before** staging or committing.
5. The engine returns outcome state `WORKTREE_REVIEW_REQUIRED` with exit code `3`.

### Selective Staging Rules

- Changes are staged **only** when explicitly listed in `-ApprovedPaths`.
- Safe Git arguments are used (`git add -- <path>`), fully supporting filenames containing spaces, brackets (`[id]`), Unicode, and special characters.
- Ignored files defined in `.gitignore` are checked via `git check-ignore` and are never staged.
- Blanket staging commands (`git add .` or `git add -A`) are strictly prohibited.
- If pre-existing staged changes outside the approved list exist before invocation, the engine halts to prevent committing unauthorized staged files.
- Before committing, the staged diff summary (`git diff --cached --stat`) and whitespace checks (`git diff --cached --check`) are verified.
- The user must provide the `-ApproveCommit` switch to finalize the commit; otherwise, the engine halts at `IMPLEMENTED_AND_TESTED_COMMIT_PENDING` (exit code `2`).

---

## 4. Content-Based Secret Scanner

The workflow engine inspects the **exact content** of staged files prior to committing. It scans staged diff additions (`git diff --cached -U0`) and full staged file content for newly added files.

### Detected Secret Patterns

1. **AWS Access Keys:** `AKIA[0-9A-Z]{16}`, `ASIA[0-9A-Z]{16}`, etc.
2. **AWS Secret Access Keys:** `aws_secret_access_key = ...` (40-char high-entropy string)
3. **GitHub Personal Access Tokens:** `ghp_*`, `gho_*`, `github_pat_*`
4. **Stripe API Keys:** `sk_live_*`, `rk_live_*`, `sk_test_*`
5. **Private Key Blocks:** `-----BEGIN RSA/OPENSSH/EC/DSA/PGP/PRIVATE KEY-----`
6. **Database Connection Strings:** URLs that embed usernames and passwords in the connection authority section.
7. **Authentication & JWT Secrets:** `auth_secret`, `jwt_secret`, `app_secret` assignments
8. **Slack Tokens:** `xox[baprs]-*`
9. **Google API Keys:** `AIza[0-9A-Za-z\-_]{35}`

### Security Enforcement

- **Redaction:** Secret values are **never printed** to the console or written to logs.
- **Reporting:** Reports only the filename, line number, and rule identifier (e.g. `Rule 'STRIPE_SECRET_KEY' matched in file 'src/lib/api.ts' at line 42`).
- **Blocking:** Detection immediately aborts the commit and returns `VALIDATION_FAILED` (exit code `4`).
- **Preservation:** Suspected secrets are never automatically deleted or rewritten on disk; manual resolution is required.

---

## 5. Implementation Validation Quality Gates

The engine executes real validation checks against the project repository and records exact commands, exit codes, execution status, and failure output.

### Standard Validation Suite

1. **Git Whitespace & Patch Check:**
   - `git diff --check`
   - `git diff --cached --check`
2. **TypeScript Type Checking:**
   - `npx tsc --noEmit` (executed if `tsconfig.json` exists)
3. **Linter:**
   - `npm run lint` (executed if declared in `package.json`)
4. **Project Test Suite:**
   - `npm test` (executed if declared in `package.json`; reported as `Skipped` if not defined)
5. **Production Build:**
   - `npm run build` (executed if `-RunBuild` switch is supplied)

### Quality Gate Rules

- A test is reported as `Passed` only if it actually executed and returned exit code `0`.
- A skipped test is reported as `Skipped`, never as `Passed`.
- Any failure blocks the commit and sets outcome `VALIDATION_FAILED` (exit code `4`).

---

## 6. Main Branch Governance

The `main` branch serves as the authoritative primary integration branch.

- **Direct Commits Blocked:** Committing directly to `main` without `-AllowMainBranch` is blocked by default (`WORKTREE_REVIEW_REQUIRED`, exit code `3`).
- **No Force Pushing:** Force-pushes (`--force`, `+ref`) are strictly prohibited under all circumstances.
- **Integrity Guarantee:** Passing `-AllowMainBranch` authorizes execution on `main` but does **not** bypass test validation, secret scanning, dirty-worktree protection, or remote divergence checks.

---

## 7. Recoverable State Machine & Commit Recovery

The workflow operates as a state machine:

```
[INSPECTION_PENDING]
        |
        v
[Dirty Worktree?] â”€â”€(No ApprovedPaths)â”€â”€> [WORKTREE_REVIEW_REQUIRED (Code 3)]
        |
    (Approved)
        v
[VALIDATION & SECRET SCAN] â”€â”€(Failure)â”€â”€> [VALIDATION_FAILED (Code 4)]
        |
     (Passed)
        v
[-ApproveCommit?] â”€â”€(No)â”€â”€> [IMPLEMENTED_AND_TESTED_COMMIT_PENDING (Code 2)]
        |
     (Approved)
        v
[COMMIT_CREATED]
        |
        v
[PUSH_PENDING] â”€â”€(Push Fails / Diverged)â”€â”€> [SYNCHRONIZATION_BLOCKED (Code 5) / PUSH_PENDING (Code 1)]
        |
     (Pushed)
        v
[REMOTE_SYNC_PENDING] â”€â”€(Secondary Push)â”€â”€> [SYNCHRONIZATION_BLOCKED (Code 5)]
        |
     (Synced)
        v
[FRESH VERIFICATION] â”€â”€(Parity Match)â”€â”€> [IMPLEMENTED_TESTED_COMMITTED_AND_FULLY_SYNCHRONIZED (Code 0)]
```

### Commit Recovery on Push Failure

If a commit is successfully created locally but network failure or rejection prevents pushing:
1. The local commit is preserved in Git history.
2. On subsequent rerun of the workflow, the engine inspects the commit graph and detects that the active branch's `HEAD` commit is already ahead of the remote.
3. The engine skips creating a duplicate commit and transitions directly to `PUSH_PENDING`.
4. History remains clean with no duplicate commits.

---

## 8. Cross-Remote Synchronization & Remote Parity

Nurvia-Prep maintains two active remotes: `origin` and `upstream`.

### Synchronization Procedure

1. **Fresh Fetch:** Executes `git fetch origin --prune` and `git fetch upstream --prune`.
2. **Ancestry Analysis:** Uses `git merge-base --is-ancestor` to verify that the proposed push is strictly a fast-forward update.
3. **Primary Push:** Pushes local commits to the primary remote (`origin` or `upstream`).
4. **Secondary Sync:** Updates the secondary remote using fast-forward push.
5. **Fresh Verification:** Queries remote references (`ls-remote` and fresh fetch) to confirm exact SHA parity:
   $$\text{Local HEAD} = \text{origin/branch} = \text{upstream/branch}$$
6. **Divergence Protection:** If `origin` and `upstream` have independent commits:
   - Neither remote is overwritten.
   - Force-push is forbidden.
   - Divergent commits are reported.
   - Returns `SYNCHRONIZATION_BLOCKED_CONFLICT_REQUIRES_RESOLUTION` (exit code `5`).

---

## 9. Process Exit Codes & Structured Result Object

The workflow engine sets `$global:LASTEXITCODE` and exits with an explicit process code:

| Exit Code | Outcome State | Meaning |
|---|---|---|
| **0** | `IMPLEMENTED_TESTED_COMMITTED_AND_FULLY_SYNCHRONIZED` | Implementation validated, committed, pushed, and verified across both remotes. |
| **1** | `IMPLEMENTED_TESTED_COMMITTED_PUSH_PENDING` | Commit created locally; push or remote creation pending. |
| **2** | `IMPLEMENTED_AND_TESTED_COMMIT_PENDING` | Changes staged and validated; explicit `-ApproveCommit` required. |
| **3** | `WORKTREE_REVIEW_REQUIRED` | Pre-existing uncommitted files detected; supply `-ApprovedPaths`. |
| **4** | `VALIDATION_FAILED` | Implementation validation, test suite, or secret scan failed. |
| **5** | `SYNCHRONIZATION_BLOCKED_CONFLICT_REQUIRES_RESOLUTION` | Remote divergence or conflict detected; manual resolution required. |
| **6** | `IMPLEMENTATION_INCOMPLETE` | Execution failed due to missing repository or invalid parameters. |

### Structured Result Object Properties

When invoked from PowerShell, the wrapper emits a `PSCustomObject`:

```powershell
$result = .\tools\git\Feature-WorkFlow.ps1 -FeatureName "..." -ApprovedPaths @(...) -ApproveCommit

$result.FeatureName                 # String: feature summary
$result.Branch                      # String: active branch
$result.CommitHash                  # String: 40-char SHA
$result.CommitMessage               # String: conventional commit subject
$result.ApprovedFiles               # String[]: approved staging paths
$result.ValidationResults           # Object[]: individual command results
$result.PushRemote                  # String: push remote name
$result.PushBranch                  # String: push branch name
$result.OriginHash                  # String: origin SHA
$result.UpstreamHash                # String: upstream SHA
$result.LocalHead                   # String: local HEAD SHA
$result.WorkingTreeStatus           # String: working tree state
$result.RemainingUncommittedChanges # String[]: uncommitted items remaining
$result.FinalOutcome                # String: standardized outcome enum
$result.ExitCode                    # Int: process exit code (0-6)
$result.Success                     # Boolean: $true if fully synchronized
```

---

## 10. Failure Recovery Guide

### Issue: `WORKTREE_REVIEW_REQUIRED` (Exit Code 3)
- **Cause:** Pre-existing unstaged or untracked files are present in the working tree.
- **Resolution:** Review the inventory displayed by the engine. To commit specific files, provide `-ApprovedPaths @("path/to/file1", "path/to/file2")`. Other uncommitted work will remain untouched in your working tree.

### Issue: `VALIDATION_FAILED` (Exit Code 4) â€” Secret Detected
- **Cause:** A suspected API key, private key, or credential was found in staged changes.
- **Resolution:** Remove the credential from the file. Replace it with an environment variable reference (e.g. `process.env.API_KEY`). Re-run the command.

### Issue: `VALIDATION_FAILED` (Exit Code 4) â€” Tests / Lint Failed
- **Cause:** TypeScript check (`tsc`) or linting (`eslint`) returned a non-zero exit code.
- **Resolution:** Review the failure output in the terminal, fix the compiler errors or linting violations, and re-run.

### Issue: `SYNCHRONIZATION_BLOCKED_CONFLICT_REQUIRES_RESOLUTION` (Exit Code 5)
- **Cause:** The remote branch contains commits that are not present locally (remote divergence).
- **Resolution:** Fetch the remote (`git fetch origin`) and inspect differences (`git log origin/branch..HEAD` and `git log HEAD..origin/branch`). Rebase or merge cleanly as appropriate, verify tests, and re-run the workflow.

## Verified synchronization behavior

The current workflow engine selects origin as its primary push remote when
origin exists; otherwise, it selects the first configured remote. It fetches
remote references and checks ancestry before pushing. It does not blindly
force-push or overwrite divergent remote history.

After synchronization, verify both local branches and their corresponding
remote-tracking branches with git rev-list --left-right --count.
A result of 0 indicates exact commit parity.

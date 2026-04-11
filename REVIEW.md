# REVIEW.md — RSS Platform Code Review Checklist

**Repository:** `alexander-proudfoot/rss-platform`
**Applies to:** All pull requests. Reviewed by the managed Claude Code Review service on every PR.
**Architecture:** Claude Managed Agents (Anthropic infrastructure). No SWA, no Azure Functions, no MSAL, no AAD.

---

## How to Use This Checklist

Work through every applicable section before requesting review. Sections marked **[if applicable]** are conditional — skip them only if the condition does not apply to this PR. All other sections are mandatory.

A PR may not be merged if any item is marked BLOCKED.

---

## Section 1 — TypeScript Compilation [if applicable]

Applies if any TypeScript files are introduced or modified in this PR.

- [ ] Run `tsc -b` from the repo root. Confirm zero errors before pushing.
- [ ] Run `npm ci` to verify the lockfile is consistent and installs cleanly.
- [ ] `package-lock.json` is committed. CI uses `npm ci` — a missing or stale lockfile will fail the build.
- [ ] `tsconfig.node.json` (if present) has `"composite": true`. It must NOT have `"noEmit": true` or `"allowImportingTsExtensions"`.
- [ ] No TypeScript errors are suppressed with `// @ts-ignore` or `// @ts-expect-error` without an accompanying explanation comment.

**BLOCKED if:** `tsc -b` reports any errors, or `package-lock.json` is absent.

---

## Section 2 — Environment Variables and Secrets

Applies to all PRs. The RSS Platform uses environment variables for secrets — there are no Key Vault runtime lookups in the agent path.

- [ ] No secrets, API keys, or credentials are hardcoded in any file (including `.md`, `.yaml`, `.json`, `.ts`, `.js`).
- [ ] Secrets are referenced as environment variables (e.g., `process.env.ZOHO_API_KEY`, `process.env.ANTHROPIC_API_KEY`).
- [ ] `.env` files are not committed. Confirm `.gitignore` excludes `.env` and `.env.*`.
- [ ] Any new environment variable required by the agent is documented in `README.md` or `agent/managed-agent-config.yaml` with its purpose and where to obtain the value.
- [ ] Zoho CRM credentials (OAuth tokens, client ID, client secret) are not present in any committed file.
- [ ] The Anthropic API key is not present in any committed file.

**BLOCKED if:** Any secret or credential is found in committed content.

---

## Section 3 — Package Management [if applicable]

Applies if `package.json` exists or is introduced in this PR.

- [ ] `package-lock.json` is committed and up to date with `package.json`.
- [ ] No packages are installed with `--save-dev` that belong in `dependencies`, or vice versa.
- [ ] No packages with known critical vulnerabilities are introduced. Run `npm audit` and resolve any critical findings before pushing.
- [ ] Package versions are pinned or use tilde/caret ranges consistently with the existing `package.json` style. Do not mix pinned and unpinned versions without justification.
- [ ] No packages are added that introduce Azure SDK, MSAL, or SWA dependencies — this repo does not use Azure hosting.

**BLOCKED if:** `npm audit` reports critical vulnerabilities, or `package-lock.json` is missing.

---

## Section 4 — SKILL.md Pattern Compliance

Applies to all PRs that create or modify any `SKILL.md` file.

Every `SKILL.md` file must conform to the standard SKILL.md pattern. Verify each of the following for every `SKILL.md` touched by this PR:

- [ ] **YAML frontmatter** is present at the top of the file with at minimum `name` and `description` fields.
- [ ] **Title and overview paragraph** are present, and the overview includes reference file loading instructions (specifying which shared or methodology files the skill loads at activation).
- [ ] **Quick Reference table** is present. The table provides a scannable summary of the skill's key inputs, outputs, or decision points.
- [ ] **"When to Use" section** is present and clearly describes the trigger condition for activating this skill.
- [ ] **"Inputs to Gather" table** is present. The table lists the data the agent must collect before proceeding, with columns for input name, description, and whether it is required or optional.
- [ ] **"Workflow" section** is present and contains a numbered multi-step process. Steps must be sequential and actionable.
- [ ] **Minimum operational rules:** `skills/skill-tracker/SKILL.md` must have at least 3 operational rules. All other `SKILL.md` files must have at least 5 operational rules.
- [ ] **"Anti-Patterns — NEVER Do These" section** is present with numbered items.
- [ ] **Copyright notice** is present as the final line of the file:
  ```
  (c) 2026 Proudfoot. All rights reserved. Confidential and proprietary.
  ```

**BLOCKED if:** Any SKILL.md file in this PR is missing any of the above elements.

---

## Section 5 — Miller Heiman IP Exclusion Verification

Applies to all PRs. Mandatory. No exceptions.

Run the following command from the repo root before requesting review:

```bash
grep -rni "economic buyer\|user buyer\|technical buyer\|buying influence\|win-results\|red flag\|sponsorship gap\|concept.*mode.*rating\|perspective.*strateg" --include="*.md" --include="*.yaml" --include="*.json" . | grep -v "miller-heiman-exclusion-register" | grep -v "MUST NEVER\|EXCLUDED\|Exclusion\|never.*use\|never appear" # EXCLUDED terms — Exclusion check
```

- [ ] The command returns **zero results**.
- [ ] If any result is returned: the PR is blocked. Rework the content to use RSS terminology before requesting review. Consult `methodology/miller-heiman-exclusion-register.md` for approved RSS equivalents.

**BLOCKED if:** The grep command returns any results.

> **Why this matters:** The RSS methodology is proprietary to Alexander Proudfoot. Miller Heiman terminology constitutes IP contamination. This check takes under 5 seconds — do not skip it.

---

## Section 6 — Methodology Digitisation Accuracy

Applies to all PRs that create or modify any file in `methodology/`.

- [ ] Methodology file content is digitised from SharePoint RSS source documents. Content must not be invented or inferred from general sales knowledge.
- [ ] File content references the **Situational Matrix** dimensions: customer perception of need and customer perception of value.
- [ ] File content uses **RSS 5-Unit Model** terminology: Positioning, Discovering, Building, Presenting, Resolving Concerns.
- [ ] No methodology content uses Miller Heiman terminology (verified by Section 5 above).
- [ ] The PR description includes confirmation that David Warren's validation via the Methodology Lab has been completed, or — if validation is pending — the PR is marked Draft and Issue #2 is referenced as a blocking dependency.

**BLOCKED if:** Methodology content is not grounded in RSS source documents, uses MH terminology, or is being promoted to production without David Warren's sign-off.

---

## Section 7 — Agent System Instructions Quality

Applies to all PRs that create or modify `agent/system-instructions.md`.

- [ ] **IP protection rules** are present. The system instructions must explicitly prohibit the agent from generating Miller Heiman terminology.
- [ ] **Miller Heiman exclusion enforcement section** is present. It must list the "MUST NEVER" terms consistent with `methodology/miller-heiman-exclusion-register.md` and CLAUDE.md.
- [ ] **RSS coaching persona** is defined. The persona must establish the agent's role, tone, and coaching philosophy grounded in RSS methodology.
- [ ] **Skills table** is present and correctly references all 3 SKILL.md files:
  - `skills/pre-call-coaching/SKILL.md`
  - `skills/post-call-debrief/SKILL.md`
  - `skills/skill-tracker/SKILL.md`
- [ ] **Shared reference** is listed: `skills/shared/rss-methodology-reference.md` must be referenced as the condensed methodology source loaded by all skills.

**BLOCKED if:** Any of the above elements are absent from `system-instructions.md`.

---

## Section 8 — Shared Reference Efficiency

Applies to all PRs that create or modify `skills/shared/rss-methodology-reference.md`.

- [ ] The shared reference file is a **condensed** version of the methodology files — not a copy or near-copy. Its purpose is context window optimisation.
- [ ] The file is **shorter** than the combined total length of the five methodology files in `methodology/`. If it is longer or equal in length, it is not functioning as a condensed reference.
- [ ] The file covers all **5 RSS units**: Positioning, Discovering, Building, Presenting, Resolving Concerns.
- [ ] The file covers the **Situational Matrix**: both dimensions (customer perception of need, customer perception of value) and how they map to selling approach.

**BLOCKED if:** The shared reference is longer than the combined methodology files, or omits any of the 5 RSS units or the Situational Matrix.

---

## Final Pre-Merge Checklist

Before marking a PR ready for review (or approving if you are the reviewer):

- [ ] All applicable sections above are complete with no BLOCKED items.
- [ ] Miller Heiman IP grep (Section 5) has been run and returned zero results.
- [ ] `tsc -b` passes if TypeScript is present (Section 1).
- [ ] No secrets are committed (Section 2).
- [ ] If methodology files are included: David Warren sign-off is confirmed or the PR is Draft pending Issue #2 (Section 6).
- [ ] Audit log committed if any state-changing script was run as part of this PR.

---

*(c) 2026 Proudfoot. All rights reserved. Confidential and proprietary.*

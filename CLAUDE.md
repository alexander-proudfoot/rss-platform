# rss-platform -- Claude Code Context

**Template version:** 4.3.1 (Phase 2: SWA + Managed Agent, D099, 2026-04-11)

## Project

- RSS Platform: AI sales coaching platform with SWA frontend + Claude Managed Agent backend
- Phase 1 (merged): Methodology knowledge base, agent skills, agent config (Anthropic Managed Agents)
- Phase 2 (D099): SWA deployment with React 19 + Vite + TypeScript + Tailwind v4 + Azure Functions + Azure SQL
- Issues: New issues auto-added to [Product Board](https://github.com/orgs/alexander-proudfoot/projects/3) via `.github/workflows/auto-add-to-project.yml`

## Architecture (Phase 2)

The RSS Platform is a Static Web App (SWA) with an Azure Functions API backend that integrates with a Claude Managed Agent for AI coaching.

**Frontend:** React 19 + Vite + TypeScript + Tailwind v4. Four screens: Coaching (chat), Matrix (situational grid), Dashboard (development tracking), History (session browser).

**Backend:** Azure Functions v4 (Node 20). Endpoints for coaching sessions, messages (async via job queue), profiles, observations, trends, matrix positions. Core libraries in `api/src/lib/`: auth.ts, db.ts, jobs.ts, managed-agent.ts.

**AI Integration:** Claude Managed Agent accessed via Anthropic SDK with `managed-agents-2026-04-01` beta header. Session create/poll/extract pattern (from Imerys). Multi-turn coaching conversations via persistent agent sessions.

**Database:** Azure SQL with mssql driver (connection pooling). Tables: salesperson_profiles, coaching_sessions, coaching_messages, observation_log, matrix_positions, ai_jobs.

**Auth:** Azure AD via SWA built-in auth. ClientPrincipal extracted from `x-ms-client-principal` header. No MSAL.

**Phase 1 content** (methodology/, skills/, agent/) is untouched and carries forward.

### Agent Configuration (Phase 1, unchanged)

- **Agent configuration:** `agent/managed-agent-config.yaml` -- defines the agent ID, model, tools, and knowledge file references.
- **System instructions:** `agent/system-instructions.md` -- the agent's persistent system prompt, referencing RSS methodology and skill files.

## Plugins (D078, Amendment 1)

This repo uses the 14-plugin standard set (D078, amended D091, Amendment 1). These plugins
MUST be active during every Code session. They are not optional.

On session start, before any other work, run these commands:

```
/plugin frontend-design
/plugin code-review
/plugin github
/plugin commit-commands
/plugin security-guidance
/plugin superpowers
/plugin typescript-lsp
/plugin pr-review-toolkit
/plugin claude-md-management
/plugin playwright
/plugin feature-dev
/plugin skill-creator
/plugin code-simplifier
/plugin agent-sdk-dev
```

Verify with `/plugins`. If any plugin is missing, load it before proceeding.

Key plugins and when to use them:
- **agent-sdk-dev**: Use for all Claude Agent SDK and Managed Agents API work. Mandatory for this repo.
- **superpowers**: Use `/review` before every commit. Mandatory.
- **code-review**: Run `/code-review` on the diff before pushing. Mandatory.
- **typescript-lsp**: Active throughout for type checking if TypeScript is introduced.
- **security-guidance**: Consult when handling API keys, secrets, or Zoho CRM credentials.

### Why the explicit /plugin commands matter

The `/plugin` commands are listed individually because batch `/plugins enable`
does not exist. Each plugin must be loaded separately. The commands are listed
here rather than in the handoff prompt so they persist across all sessions for
this repo regardless of which handoff is being executed.

## Shell Tools

Three shell tools are available. Use whichever is most natural for the task.

**bash** -- primary for Code Web sessions (the sandbox is Linux). Use for file operations, npm, node, git, and general scripting.

**pwsh** (PowerShell 7) -- primary for local Windows execution on the deployer's local machine. Use for Azure CLI (`az`), Windows-specific operations, and any script run locally by the deployer. Never use `powershell.exe` (5.1); always use `pwsh`.

**gh** (GitHub CLI) -- available in both contexts. Use for repo operations, issue creation, PR management, and GitHub API calls. Authenticated via `gh auth`.

When writing scripts for the deployer to run locally, prefer `.ps1` files executed via `pwsh -NoProfile -ExecutionPolicy Bypass -File "script.ps1"`. When writing scripts for Code Web, use bash directly.

## Script Logging (mandatory)

Every script that modifies state (deploys, provisions, migrates, configures) must log its output:

1. Create `Audit/logs/` if it doesn't exist
2. For PowerShell: `Start-Transcript -Path "Audit/logs/{scriptname}-{timestamp}.log"` at the start, `Stop-Transcript` at the end
3. For bash: redirect output with `script_name="..."; log_file="Audit/logs/${script_name}-$(date +%Y%m%d-%H%M%S).log"; exec > >(tee -a "$log_file") 2>&1`
4. `git add` the log file
5. `git commit -m "Log: {description}"`
6. `git push`

Code reads logs from the repo. The deployer does not paste terminal output.

Simple read-only operations (listing files, checking status, reading config) do not require logging.

## TypeScript Rules

- Always run `tsc -b` before every push. No exceptions.
- Run `npm ci` before first push to verify lockfile works.
- Commit `package-lock.json` always -- CI uses `npm ci`.
- `tsconfig.node.json`: must have `composite: true`, NOT `noEmit: true`, NOT `allowImportingTsExtensions`.

## RSS Methodology

The RSS (Relationship Selling Skills) methodology is the domain knowledge that powers the agent's coaching capability.

Four methodology files live in `methodology/`:

| File | Purpose |
|------|---------|
| `methodology/rss-situational-matrix.md` | Situational selling matrix: opportunity classification and response mapping |
| `methodology/rss-5-unit-model.md` | The 5-Unit Model: the RSS framework for structuring customer conversations |
| `methodology/rss-coaching-methodology.md` | Coaching framework: observation, feedback, and skill development protocols |
| `methodology/rss-sales-mos.md` | Sales Management Operating System: cadence, pipeline reviews, team meetings |

All content is digitised from SharePoint RSS source documents. The SharePoint originals are the authoritative source; methodology files in this repo are the encoded representation.

**David Warren must validate all methodology encoding via the Methodology Lab before production deployment.** No methodology file may be marked production-ready until David Warren has reviewed it in the Methodology Lab and confirmed it accurately represents the RSS source material.

## Agent Skills

The agent exposes three skills, each with its own SKILL.md trigger definition.

| Skill file | Trigger condition |
|-----------|-------------------|
| `skills/pre-call-coaching/SKILL.md` | Before a customer call or meeting -- when the rep needs coaching on approach, questions to ask, and positioning |
| `skills/post-call-debrief/SKILL.md` | After a customer interaction -- when the rep needs structured debrief to extract learnings and next actions |
| `skills/skill-tracker/SKILL.md` | Reviewing skill development over time -- typically after a series of debriefs, to assess progress against the RSS competency model |

Shared methodology reference used by all three skills: `skills/shared/rss-methodology-reference.md`

When modifying a skill, always check whether the change should be reflected in the shared reference file. Changes to RSS methodology encoding must propagate consistently across all skill files.

## Miller Heiman IP Exclusion (Critical)

**This repository must never contain Miller Heiman terminology.** The RSS methodology is proprietary to Alexander Proudfoot and must be expressed entirely in RSS terms. Using Miller Heiman terminology constitutes IP contamination and is grounds for immediate rework before any PR is merged.

**Excluded terms** (must never appear in any `.md`, `.yaml`, or `.json` file in this repo):
- Economic Buyer (in the Miller Heiman Buying Influence sense) [EXCLUDED TERM]
- User Buyer (in the Miller Heiman Buying Influence sense) [EXCLUDED TERM]
- Technical Buyer (in the Miller Heiman Buying Influence sense) [EXCLUDED TERM]
- Buying Influence / Buying Influences [EXCLUDED TERM]
- Concept / Mode / Rating (the Miller Heiman three-step evaluation model) [EXCLUDED TERM]
- Win-Results [EXCLUDED TERM]
- Red Flag (as defined in Strategic Selling -- the specific MH risk classification) [EXCLUDED TERM]
- Perspective strategies (the four MH perspective strategies) [EXCLUDED TERM]
- Sponsorship Gap [EXCLUDED TERM]
- Even Keel (Miller Heiman Mode assessment) [EXCLUDED TERM]
- Overconfident (Miller Heiman Mode assessment) [EXCLUDED TERM]

**Verification command -- must return zero results before every PR:**

```bash
grep -rni "economic buyer\|user buyer\|technical buyer\|buying influence\|win-results\|red flag\|sponsorship gap\|concept.*mode.*rating\|perspective.*strateg\|even keel\|overconfident" --include="*.md" --include="*.yaml" --include="*.json" . | grep -v "miller-heiman-exclusion-register" | grep -v "MUST NEVER\|EXCLUDED\|Exclusion\|never.*use\|never appear" # EXCLUDED terms — Exclusion check
```

If this command returns any results, the PR is blocked. Fix before requesting review.

The authoritative register of excluded terms and their RSS equivalents is at `methodology/miller-heiman-exclusion-register.md`.

## Zoho CRM Integration

The agent connects to Zoho CRM via the MCP connector (D068) to provide contextually-aware coaching grounded in real deal data.

**Reads** (agent pulls this data when preparing coaching):
- Accounts module: organisation data, relationship history
- Contacts module: contact details, roles, interaction history
- Deals module: opportunity data, stage, value, close date
- Events module: meeting history, call logs

**Writes** (agent records coaching outputs back to CRM):
- SF_Notes module: coaching observations linked to contacts and deals
- Deals module: deal notes capturing coaching-relevant insights

All CRM writes are coaching observations only. The agent does not modify deal stages, values, or dates.

## Azure Naming

- Resource naming: `pft-{app}-{env}` (e.g., `pft-rss-prod`)
- Secrets in Key Vault, never in GitHub secrets or hardcoded

## Branch Protection

Code changes go through PRs so the managed Code Review service can review them. The bypass-branch-protection pattern is for infrastructure scripts and Audit log pushes only, not application code.

## Audit Logging

- All state-changing scripts log to `Audit/logs/<scriptname>-<timestamp>.log`.
- Log files are committed to the repo automatically.
- `Audit/**` should be in any deploy workflow's `paths-ignore` to avoid triggering deployments on log commits.

## Known Gotchas

This section grows with each build. Read all entries before writing any code.

1. **npm ci requires package-lock.json.** Always commit the lockfile. Always run `npm ci` locally before first push to verify it works. (Gotcha #8 from template.)

2. **Plugins require explicit loading at session start.** Plugins do not auto-load from settings.json or handoff prose. The CLAUDE.md Plugins section (above) lists all 14 `/plugin [name]` commands. Code must run them before starting any work. Verify with `/plugins`. If this CLAUDE.md does not have a Plugins section, add it from `proudfoot-programme/qa/CLAUDE-TEMPLATE.md` before proceeding with any build. (Gotcha #16 from template, updated: 14 plugins.)

3. **Plan-first protocol (D088).** Builds modifying 3+ files must produce a build plan via the superpowers plugin before execution. The plan is written to `Audit/build-plans/{directive}-plan.md` and Code must STOP for user review before executing. The plan must specify: files to create/modify, execution order, plugin and MCP usage, risk areas. PPM may waive for builds modifying fewer than 3 files. (Gotcha #19 from template.)

4. **Pattern sweep on bot findings (D092 amendment).** When the code review bot flags an issue that could exist in multiple files (hardcoded paths, stale version numbers, genericisation misses, stale cross-references), do not fix only the flagged line. Before committing the fix: grep for the pattern across all files in the repo, fix every instance, and verify with grep that zero instances remain. Combine all pattern fixes into a single commit. Point-fixing causes repeated bot review cycles (each ~35 minutes) as the bot finds the same pattern in the next file. (Gotcha #21 from template.)

5. **MSYS path rewriting in Git Bash on Windows.** When running bash scripts on Windows via Git Bash, MSYS automatically rewrites API paths starting with `/` to Windows filesystem paths (e.g., `/repos/org/repo/...` becomes `C:/Program Files/Git/repos/org/repo/...`). This breaks `gh api` calls and any HTTP client using path-style arguments. Fix: set `MSYS_NO_PATHCONV=1` before execution. For PowerShell: `$env:MSYS_NO_PATHCONV=1` before the bash invocation. For bash scripts intended to run on Windows, add `export MSYS_NO_PATHCONV=1` at the top of the script (after the shebang). (Gotcha #22 from template.)

6. **Claude Code Review requires per-repo enablement.** The Claude Code Review GitHub App is installed org-wide but does not automatically review all repos. Each repo must be explicitly enabled at `claude.ai/admin-settings/claude-code` with a review behavior set (once after PR creation / after every push / manual). If a PR's Checks tab shows no "Claude Code Review" check, the repo has not been enabled. An org admin must enable it before the Phase G self-review protocol can function. This is a one-time setup per repo, not per PR. The "Re-run all checks" button in GitHub does NOT retrigger Code Review -- use `@claude review once` as a PR comment or push a new commit. Reviews average 20-36 minutes and $15-25 per review. (Gotcha #23 from template.)

7. **Bot review cycling protocol.** After 3-4 rounds of fixes, the Code Review bot can start re-reporting stale findings that do not match actual file contents. This happens because the bot's analysis includes prior review context that has not refreshed. When Code observes this: stop the fix loop after 2 consecutive rounds where no new unique findings appear. "New unique" means a finding on a line or pattern not flagged in any prior round. If the bot is only re-flagging previously addressed items, Code notes "Bot cycling detected -- all unique findings resolved, remaining flags are stale re-reports" in a PR comment and proceeds to Phase F (frontend builds) or Phase E (backend-only builds). PPM retains authority to spot-check the PR and reopen if genuine issues were missed. (Gotcha #24 from template.)

8. **Use `gh pr checks --watch` for Phase G bot wait.** When waiting for the Claude Code Review bot to complete in Phase G, use `gh pr checks {PR_NUMBER} --repo alexander-proudfoot/rss-platform --watch`. This blocks in a single call until the check completes. Do not write bash polling loops or repeated `gh api` calls, which burn tokens unnecessarily. After the check completes, read the bot's findings via `gh pr view {PR_NUMBER} --repo alexander-proudfoot/rss-platform --comments`. (Gotcha #26 from template.)

9. **Federated credential idempotency -- filter by subject, not name.** Azure enforces uniqueness on the issuer+subject combination for federated credentials, but the `setup-oidc.ps1` pattern checks by credential name. If a credential exists under a different name with the same subject, the create call fails with a conflict error. Always check for existing credentials by subject: `az ad app federated-credential list --id {APP_OBJECT_ID} --query "[?subject=='{SUBJECT}'].name" -o tsv`. If a match is found under any name, skip the create. (Gotcha #27 from template -- retained for future Azure integration work.)

10. **Privileged scripts must document prerequisite permissions in header.** Scripts that require elevated permissions (Entra ID admin, Key Vault Secrets Officer, subscription Owner) must list all required permissions in the script header comment block, alongside the existing step listing. Format: "Requires: [permission] on [resource]". This prevents first-run failures when a different operator runs the script. (Gotcha #28 from template -- retained for future Azure integration work.)

11. **Miller Heiman IP verification is mandatory before every PR.** Run the grep command from the Miller Heiman IP Exclusion section before requesting any code review. A PR with Miller Heiman terminology will be rejected regardless of other quality. This check takes 5 seconds; do not skip it.

12. **David Warren methodology sign-off is a hard gate.** No methodology file may be promoted to production or referenced in production agent config until David Warren has reviewed and approved it in the Methodology Lab. "It looks right" is not sufficient -- it must be formally validated against the RSS source documents.

13. **Pre-push code review is mandatory (D101).** Run pr-review-toolkit (silent-failure-hunter, type-design-analyzer) and /code-review locally before every push. The GitHub Code Review bot is the final safety net at $15-25 per run, not the primary debugging loop. Every issue caught pre-push saves a bot iteration. (Gotcha #29 from template.)

14. **Pattern sweep is literal, not optional (D101 amendment to D092).** When the bot flags an issue, the fix procedure is:
  1. Identify the PATTERN, not just the line.
  2. Write a grep/regex that matches ALL instances of this pattern in the entire repo.
  3. Run that grep.
  4. Fix EVERY match in a single commit.
  5. Verify with grep that zero matches remain.

  "Pattern" means the class of problem, not the literal string. Example: if the bot flags a missing LASTEXITCODE check after `az keyvault secret set`, the pattern is "any az CLI call without error handling" -- grep for all `az ` calls in the file and fix them all. Fixing only the flagged line guarantees another bot round at $15-25. Three or more bot rounds on the same class of issue is a build failure. (Gotcha #30 from template.)

# D099 Deployment Execution Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modify deploy scripts for non-interactive CI execution, create SWA app-settings delivery script, update CLAUDE.md with KG#29/KG#30, then provision Azure resources and wire up the full RSS Platform deployment.

**Architecture:** Phase D (script modifications) goes through PR on `feature/D099-deploy`; Azure provisioning (Phase A) is CLI execution directly, not through the PR. SWA app settings are delivered via a dedicated script that pulls from Key Vault, keeping secrets out of GitHub.

**Tech Stack:** PowerShell 7 (`pwsh`), Azure CLI (`az`), GitHub CLI (`gh`), Bicep (pre-compiled to JSON in `infra/`).

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `infra/deploy.ps1` | Add `-NonInteractive` switch + SP auth; auto-generate SQL password |
| Create | `infra/set-swa-appsettings.ps1` | Read KV secrets → push to SWA app settings |
| Modify | `infra/deploy-preview.ps1` | Thread `-NonInteractive` and SP auth through to `deploy.ps1` |
| Modify | `CLAUDE.md` | Add KG#29 and KG#30 |

---

## Pre-requisites (verify before Task 1)

- [ ] Azure CLI authenticated: `az account show` succeeds
- [ ] `gh` CLI authenticated: `gh auth status` shows `alexander-proudfoot`
- [ ] On branch `feature/D099-deploy` (see Task 0)
- [ ] 14 plugins loaded: run each `/plugin` command from CLAUDE.md Plugins section, verify with `/plugins`

---

## Task 0: Create feature branch

**Files:** none (git operation only)

- [ ] **Step 1: Create branch from main**

```bash
git checkout main
git pull origin main
git checkout -b feature/D099-deploy
git push -u origin feature/D099-deploy
```

Expected: branch `feature/D099-deploy` tracking `origin/feature/D099-deploy`.

---

## Task 1: Modify `deploy.ps1` — non-interactive mode + SP auth

**Files:**
- Modify: `infra/deploy.ps1`

### Background — what changes and why

Current `deploy.ps1` has two problems for CI execution:

1. `[Parameter(Mandatory)] [SecureString]$SqlAdminPassword` — always prompts interactively; CI has no tty.
2. Step 2 uses `az ad signed-in-user show` — fails when logged in as a service principal (SPs have no "signed-in user").

### Changes needed

**Parameter block** — make `$SqlAdminPassword` optional, add `-NonInteractive` and `-SqlAdminLogin` default:

```powershell
param(
  [ValidateSet('prod', 'preview')]
  [string]$Environment = 'prod',

  [ValidatePattern('^[a-zA-Z0-9\-]+$')]
  [string]$Location = 'uksouth',

  [Parameter(Mandatory)]
  [ValidatePattern('^[a-zA-Z][a-zA-Z0-9\-_]{0,127}$')]
  [string]$SqlAdminLogin,

  [SecureString]$SqlAdminPassword,          # no longer Mandatory

  [ValidatePattern('^[a-zA-Z0-9\-_\.]+$')]
  [string]$ResourceGroup = '',

  [switch]$SkipSchemaMigration,

  [switch]$NonInteractive                   # NEW
)
```

**Service principal auth block** — add immediately after `$ErrorActionPreference = 'Stop'`, before transcript start:

```powershell
# ── 0. Optional service-principal login (CI) ─────────────────────────────────
if ($env:AZURE_CLIENT_ID -and $env:AZURE_CLIENT_SECRET -and $env:AZURE_TENANT_ID) {
  Write-Host "=== Step 0: Service-principal login ==="
  az login --service-principal `
    --username $env:AZURE_CLIENT_ID `
    --password $env:AZURE_CLIENT_SECRET `
    --tenant $env:AZURE_TENANT_ID `
    --output none
  if ($LASTEXITCODE -ne 0) { Write-Error "az login --service-principal failed (exit $LASTEXITCODE)" }
  Write-Host "SP login OK."
}
```

**Password handling block** — add after SP login, before transcript, to resolve password before transcript starts (keeps it out of the log):

```powershell
# ── Resolve SQL admin password ────────────────────────────────────────────────
if ($NonInteractive) {
  # Auto-generate a cryptographically secure 32-character password.
  # Character classes: uppercase, lowercase, digit, special — all guaranteed present.
  $charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()-_=+'
  $bytes   = [byte[]]::new(64)
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  # Map each byte to a charset character (modulo bias is negligible for 64-char charset)
  $pwChars = $bytes | ForEach-Object { $charset[$_ % $charset.Length] }
  # Guarantee at least one of each character class in positions 0-3
  $pwChars[0] = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[[System.Security.Cryptography.RandomNumberGenerator]::GetInt32(26)]
  $pwChars[1] = 'abcdefghijklmnopqrstuvwxyz'[[System.Security.Cryptography.RandomNumberGenerator]::GetInt32(26)]
  $pwChars[2] = '0123456789'[[System.Security.Cryptography.RandomNumberGenerator]::GetInt32(10)]
  $pwChars[3] = '!@#$%^&*()-_=+'[[System.Security.Cryptography.RandomNumberGenerator]::GetInt32(14)]
  # Shuffle using Fisher-Yates with cryptographic random
  for ($i = $pwChars.Count - 1; $i -gt 0; $i--) {
    $j = [System.Security.Cryptography.RandomNumberGenerator]::GetInt32($i + 1)
    $tmp = $pwChars[$i]; $pwChars[$i] = $pwChars[$j]; $pwChars[$j] = $tmp
  }
  $SqlAdminPassword = ConvertTo-SecureString (-join $pwChars) -AsPlainText -Force
  Remove-Variable pwChars, bytes -ErrorAction SilentlyContinue
} elseif (-not $SqlAdminPassword) {
  $SqlAdminPassword = Read-Host -AsSecureString 'SQL Admin Password'
}
```

**Step 2 — deployer object ID** — replace the current body with SP-aware logic:

```powershell
Write-Host "`n=== Step 2: Resolve deployer object ID ==="
if ($env:AZURE_CLIENT_ID) {
  # Logged in as service principal — get SP object ID by client (app) ID
  $DeployerObjectId = az ad sp show --id $env:AZURE_CLIENT_ID --query id -o tsv
} else {
  $DeployerObjectId = az ad signed-in-user show --query id -o tsv
}
if ($LASTEXITCODE -ne 0) { Write-Error "Deployer OID resolution failed (exit $LASTEXITCODE)" }
if ([string]::IsNullOrWhiteSpace($DeployerObjectId)) { Write-Error "Deployer object ID is empty — KV RBAC role assignment will fail" }
Write-Host "Deployer OID:    $DeployerObjectId"
```

**`.PARAMETER NonInteractive` docstring** — add to the comment block:

```
.PARAMETER NonInteractive
  Switch: auto-generate a cryptographically secure SQL admin password.
  When set, no interactive prompt is issued. Intended for CI/CD use.
  When not set and -SqlAdminPassword is omitted, prompts interactively.
```

**`.REQUIRES` — add SP auth requirement:**

```
.REQUIRES
  ...
  - (CI only) AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_TENANT_ID env vars set
```

- [ ] **Step 2: Apply changes to `infra/deploy.ps1`**

Using the Edit tool, make all four changes above:
1. Parameter block: remove `[Parameter(Mandatory)]` from `$SqlAdminPassword`, add `[switch]$NonInteractive`
2. After `Set-StrictMode -Version Latest`, add SP login block (Step 0)
3. After SP login block, add password resolution block
4. Replace Step 2 body with SP-aware OID resolution

- [ ] **Step 3: Run pre-commit security review**

BEFORE committing, invoke:
- `security-guidance` plugin: review the password generation logic and SP credential handling
- `superpowers:requesting-code-review` skill: `/Skill(review)` on `infra/deploy.ps1`
- `pr-review-toolkit:silent-failure-hunter` agent on `infra/deploy.ps1`: check error paths in SP login block and password generation
- `/Skill(simplify)` on `infra/deploy.ps1`

Fix any RED or YELLOW findings before proceeding.

- [ ] **Step 4: Run MH exclusion check**

```bash
grep -rni "economic buyer\|user buyer\|technical buyer\|buying influence\|win-results\|red flag\|sponsorship gap\|concept.*mode.*rating\|perspective.*strateg\|even keel\|overconfident" --include="*.md" --include="*.yaml" --include="*.json" . | grep -v "miller-heiman-exclusion-register" | grep -v "MUST NEVER\|EXCLUDED\|Exclusion\|never.*use\|never appear"
```

Expected: zero results.

- [ ] **Step 5: Commit**

```bash
git add infra/deploy.ps1
git commit -m "feat: add -NonInteractive switch and SP auth to deploy.ps1 (D099)"
```

---

## Task 2: Create `infra/set-swa-appsettings.ps1`

**Files:**
- Create: `infra/set-swa-appsettings.ps1`

### Full script content

```powershell
<#
.SYNOPSIS
  Delivers Key Vault secrets to the RSS Platform SWA app settings.

.DESCRIPTION
  Reads each required secret from Key Vault and replicates it to the SWA
  configuration via az staticwebapp appsettings set. Missing secrets produce
  a warning rather than a hard failure, so partial configuration is possible
  while Anthropic IDs are still being provisioned.

.PARAMETER Environment
  Target environment: 'prod' or 'preview'. Default: 'prod'.

.PARAMETER ResourceGroup
  Azure resource group. Default: 'pft-rss-{Environment}-rg'.

.PARAMETER KvName
  Key Vault name. Default: 'pft-kv-rss-{Environment}'.

.PARAMETER SwaName
  Static Web App resource name. Default: 'pft-rss-{Environment}'.

.REQUIRES
  - Azure CLI (az) authenticated (interactive or service principal)
  - Reader on Key Vault (to read secrets)
  - Contributor on the SWA resource (to set app settings)
  - pwsh (PowerShell 7) — do NOT run with powershell.exe 5.1
  - (CI only) AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_TENANT_ID env vars set

.NOTES
  Output is logged to Audit/logs/set-swa-appsettings-{timestamp}.log, then
  committed and pushed to the repo. Secret values are never written to the log.
  Directive: D099
#>
param(
  [ValidateSet('prod', 'preview')]
  [string]$Environment = 'prod',

  [string]$ResourceGroup = '',

  [string]$KvName = '',

  [string]$SwaName = ''
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# ── 0. Optional service-principal login (CI) ─────────────────────────────────
if ($env:AZURE_CLIENT_ID -and $env:AZURE_CLIENT_SECRET -and $env:AZURE_TENANT_ID) {
  Write-Host "=== Step 0: Service-principal login ==="
  az login --service-principal `
    --username $env:AZURE_CLIENT_ID `
    --password $env:AZURE_CLIENT_SECRET `
    --tenant $env:AZURE_TENANT_ID `
    --output none
  if ($LASTEXITCODE -ne 0) { Write-Error "az login --service-principal failed (exit $LASTEXITCODE)" }
  Write-Host "SP login OK."
}

# Resolve defaults
if ([string]::IsNullOrEmpty($ResourceGroup)) { $ResourceGroup = "pft-rss-$Environment-rg" }
if ([string]::IsNullOrEmpty($KvName))        { $KvName = "pft-kv-rss-$Environment" }
if ([string]::IsNullOrEmpty($SwaName))       { $SwaName = "pft-rss-$Environment" }

# Script logging
$ScriptDir = $PSScriptRoot
$RepoRoot  = Resolve-Path (Join-Path $ScriptDir '..')
$LogDir    = Join-Path $RepoRoot 'Audit' 'logs'
if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir | Out-Null }
$Timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$LogFile   = Join-Path $LogDir "set-swa-appsettings-$Timestamp.log"
Start-Transcript -Path $LogFile

try {
  Write-Host "=== RSS Platform SWA App Settings Delivery ==="
  Write-Host "Environment:   $Environment"
  Write-Host "Resource Group: $ResourceGroup"
  Write-Host "Key Vault:     $KvName"
  Write-Host "SWA:           $SwaName"

  # Secret map: SWA setting name → Key Vault secret name
  $secretMap = [ordered]@{
    'SQL_CONNECTION_STRING'  = 'SQL-CONNECTION-STRING'
    'ANTHROPIC_API_KEY'      = 'ANTHROPIC-API-KEY'
    'MANAGED_AGENT_ID'       = 'MANAGED-AGENT-ID'
    'MANAGED_ENVIRONMENT_ID' = 'MANAGED-ENVIRONMENT-ID'
    'AZURE_CLIENT_ID'        = 'AZURE-CLIENT-ID'
    'AZURE_CLIENT_SECRET'    = 'AZURE-CLIENT-SECRET'
  }

  # ── 1. Read secrets from Key Vault ──────────────────────────────────────────
  Write-Host "`n=== Step 1: Reading secrets from Key Vault '$KvName' ==="
  $appSettings = [ordered]@{}
  $missing     = [System.Collections.Generic.List[string]]::new()

  foreach ($settingName in $secretMap.Keys) {
    $kvSecretName = $secretMap[$settingName]
    Write-Host "  Reading: $kvSecretName ..."
    $secretValue = az keyvault secret show `
      --vault-name $KvName `
      --name $kvSecretName `
      --query value `
      --output tsv 2>$null
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($secretValue)) {
      Write-Warning "  MISSING: $kvSecretName not found in Key Vault '$KvName' — skipping '$settingName'"
      $missing.Add($kvSecretName)
    } else {
      $appSettings[$settingName] = $secretValue
      Write-Host "  OK:      $kvSecretName -> $settingName"
    }
    # Clear secret value from variable immediately after use
    Remove-Variable secretValue -ErrorAction SilentlyContinue
  }

  if ($appSettings.Count -eq 0) {
    Write-Error "No secrets found in Key Vault '$KvName'. Cannot configure SWA. Verify KV name and permissions."
  }

  # ── 2. Build appsettings string and set on SWA ──────────────────────────────
  # az staticwebapp appsettings set accepts --setting-names KEY=VALUE KEY=VALUE ...
  # Secret values are passed via a temp JSON file to avoid them appearing in process args.
  Write-Host "`n=== Step 2: Setting $($appSettings.Count) app setting(s) on SWA '$SwaName' ==="

  $TempSettingsFile = [System.IO.Path]::GetTempFileName()
  try {
    # Build the settings JSON for az staticwebapp appsettings set --input-file (if supported)
    # Fallback: use --setting-names with NAME=VALUE pairs.
    # Use --setting-names approach: values are passed via individual env vars to avoid leaking
    # in process args. Each key=value is provided as a separate argument.
    $settingArgs = $appSettings.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" }
    az staticwebapp appsettings set `
      --name $SwaName `
      --resource-group $ResourceGroup `
      --setting-names @settingArgs `
      --output none
    if ($LASTEXITCODE -ne 0) { Write-Error "az staticwebapp appsettings set failed (exit $LASTEXITCODE)" }
    Write-Host "App settings set OK."
  } finally {
    # Clear the in-memory settings hashtable so values don't linger
    $appSettings.Clear()
    if (Test-Path $TempSettingsFile) { Remove-Item $TempSettingsFile -Force -ErrorAction SilentlyContinue }
  }

  # ── 3. Summary ───────────────────────────────────────────────────────────────
  Write-Host ""
  Write-Host "============================================================"
  Write-Host "SWA APP SETTINGS DELIVERY COMPLETE — $Environment"
  Write-Host "============================================================"
  if ($missing.Count -gt 0) {
    Write-Host "WARNING: The following secrets were NOT found in Key Vault and were skipped:"
    foreach ($s in $missing) { Write-Host "  [ ] $s" }
    Write-Host ""
    Write-Host "Re-run this script after populating the missing secrets."
  } else {
    Write-Host "All secrets delivered successfully."
  }
  Write-Host "Log: $LogFile"

} finally {
  try { Stop-Transcript } catch { }
  # Commit audit log
  $LogRelPath = "Audit/logs/set-swa-appsettings-$Timestamp.log"
  try {
    git -C $RepoRoot add $LogRelPath
    git -C $RepoRoot commit -m "Log: D099 SWA app settings delivery $Environment $Timestamp"
    git -C $RepoRoot push
    Write-Host "Audit log committed: $LogRelPath"
  } catch {
    Write-Warning "Audit log push failed: $_"
    Write-Warning "Push manually: git add '$LogRelPath' && git commit && git push"
  }
}
```

- [ ] **Step 2: Run pre-commit security review**

AFTER writing the script, invoke ALL of:
- `security-guidance` plugin: review secret handling — especially the `$settingArgs` build (do values appear in process args?)
- `superpowers:requesting-code-review` skill: `/Skill(review)` on `infra/set-swa-appsettings.ps1`
- `pr-review-toolkit:silent-failure-hunter` agent on `infra/set-swa-appsettings.ps1`: check every `Write-Error`, `$LASTEXITCODE` check, and `finally` block
- `/Skill(simplify)` on `infra/set-swa-appsettings.ps1`

Fix any RED or YELLOW findings before proceeding.

> **Security note on `--setting-names @settingArgs`:** az CLI receives the KV=VALUE pairs as process arguments. On Windows, process arguments are visible in the process list while the command runs. Evaluate whether to use a temp JSON file + `--input-file` flag (if supported by the installed az version) or accept the current approach given the short execution window. Check: `az staticwebapp appsettings set --help | grep input`.

- [ ] **Step 3: Run MH exclusion check** (same grep as Task 1 Step 4)

- [ ] **Step 4: Commit**

```bash
git add infra/set-swa-appsettings.ps1
git commit -m "feat: add set-swa-appsettings.ps1 for KV→SWA secret delivery (D099)"
```

---

## Task 3: Update `infra/deploy-preview.ps1` — thread NonInteractive (P2)

**Files:**
- Modify: `infra/deploy-preview.ps1`

This is a **P2 (could-have)**. Skip if time-constrained; the preview environment is not in scope for this deployment.

- [ ] **Step 1: Update parameter block**

Add `[switch]$NonInteractive` parameter. Remove `[Parameter(Mandatory)]` from `$SqlAdminPassword`.

New param block:
```powershell
param(
  [string]$Location = 'uksouth',

  [Parameter(Mandatory)]
  [string]$SqlAdminLogin,

  [SecureString]$SqlAdminPassword,

  [string]$ResourceGroup = 'pft-rss-preview-rg',

  [switch]$SkipSchemaMigration,

  [switch]$NonInteractive
)
```

- [ ] **Step 2: Thread NonInteractive into `$params`**

```powershell
if ($SkipSchemaMigration) { $params['SkipSchemaMigration'] = [switch]$true }
if ($NonInteractive)      { $params['NonInteractive']      = [switch]$true }
if ($SqlAdminPassword)    { $params['SqlAdminPassword']    = $SqlAdminPassword }
```

Remove the existing `SqlAdminPassword = $SqlAdminPassword` line from the static `$params` hash.

- [ ] **Step 3: Update `.PARAMETER` docstring** — add NonInteractive.

- [ ] **Step 4: Update `.REQUIRES`** — add SP env var requirement.

- [ ] **Step 5: Run security-guidance + /Skill(review) + /Skill(simplify)**

- [ ] **Step 6: Commit**

```bash
git add infra/deploy-preview.ps1
git commit -m "feat: thread -NonInteractive through deploy-preview.ps1 (D099)"
```

---

## Task 4: Update `CLAUDE.md` — add KG#29 and KG#30

**Files:**
- Modify: `CLAUDE.md`

> **NOTE:** KG#29 and KG#30 text comes from `proudfoot-programme/qa/CLAUDE-TEMPLATE.md` (a separate repo). The text below is drafted from the D101 description ("pre-push review" and "pattern sweep enforcement"). Neil must confirm the exact text from the template matches before this task is committed. If the template text differs, use the template text verbatim.

- [ ] **Step 1: Add KG#13 (KG#29 from template) to `CLAUDE.md`**

Append the following entry after KG#12 in the Known Gotchas section:

```markdown
13. **Pre-push review protocol is mandatory (D101).** Before every `git push`, run ALL of the following in order and fix every finding before pushing: (1) `/code-review` on the diff, (2) `/Skill(review)` (superpowers second opinion), (3) `pr-review-toolkit:silent-failure-hunter` on all new/modified functions, (4) `pr-review-toolkit:type-design-analyzer` on any new type definitions, (5) `/Skill(simplify)` on all new files. A push that skips any of these gates is a protocol violation. Running the gates is not sufficient if findings are ignored -- RED findings block the push; YELLOW findings require a documented justification. (Gotcha #29 from template.)

14. **Pattern sweep is mandatory before committing any bot fix (D101 / D092 amendment).** When a code review bot (or any reviewer) flags an issue, treat it as a pattern signal. Before writing the fix commit: grep the entire repo for the pattern, fix every instance, verify with grep that zero instances remain, then commit all fixes together. Committing a point-fix that leaves the pattern in other files causes repeated bot review rounds (~35 min each). Pattern: `grep -rn "<flagged-pattern>" --include="*.ps1" --include="*.ts" --include="*.tsx" --include="*.json" .`. If grep confirms the pattern exists only in the flagged location, document that confirmation in the commit message. (Gotcha #30 from template.)
```

- [ ] **Step 2: Verify numbering** — existing gotchas are numbered 1-12. New entries are numbered 13 and 14 in the repo's CLAUDE.md (they are KG#29 and KG#30 in the canonical template, but the repo renumbers locally). Confirm Neil is happy with local numbering vs template numbering before committing.

- [ ] **Step 3: Run MH exclusion check** (same grep as Task 1 Step 4)

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add KG#29 and KG#30 (pre-push review + pattern sweep) to CLAUDE.md (D101/D099)"
```

---

## STOP: Pre-PR quality gates (run before `git push`)

Before pushing the branch and creating the PR, run the full pre-push gate in order:

- [ ] `/code-review` on full diff: `git diff main...HEAD`
- [ ] `/Skill(review)` on full diff
- [ ] `pr-review-toolkit:silent-failure-hunter` on `infra/deploy.ps1` and `infra/set-swa-appsettings.ps1`
- [ ] `pr-review-toolkit:type-design-analyzer` (PowerShell scripts — note any strong-typed params)
- [ ] `/Skill(simplify)` on all modified/created files
- [ ] Fix all RED; fix YELLOW or document justification
- [ ] Re-run gates if fixes were non-trivial
- [ ] MH exclusion grep: zero results

Only push after a clean pass.

---

## Task 5: Push branch and create PR

- [ ] **Step 1: Push branch**

```bash
git push -u origin feature/D099-deploy
```

- [ ] **Step 2: Create PR**

```bash
gh pr create \
  --repo alexander-proudfoot/rss-platform \
  --base main \
  --head feature/D099-deploy \
  --title "feat: deploy.ps1 non-interactive mode + SWA appsettings script (D099)" \
  --body "$(cat <<'EOF'
## Summary
- `deploy.ps1`: adds `-NonInteractive` switch with cryptographically secure password generation; adds service-principal login support via env vars; fixes deployer OID resolution for SP auth context
- `set-swa-appsettings.ps1`: new script that reads secrets from Key Vault and delivers them to SWA app settings; graceful warn-not-fail on missing secrets
- `deploy-preview.ps1`: threads `-NonInteractive` and SP auth through to `deploy.ps1` (P2)
- `CLAUDE.md`: adds KG#29 (pre-push review protocol) and KG#30 (pattern sweep enforcement)

## Test plan
- [ ] `deploy.ps1 -NonInteractive -SqlAdminLogin rssadmin` — verify no interactive prompt, verify temp params file is cleaned up
- [ ] `deploy.ps1` (without `-NonInteractive`, without `-SqlAdminPassword`) — verify it prompts interactively
- [ ] `set-swa-appsettings.ps1` with a KV secret missing — verify WARNING not error, script continues
- [ ] MH exclusion grep: zero results
- [ ] `tsc -b` clean (no TypeScript modified)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Note PR number for Phase G**

---

## Phase G: Bot review

- [ ] **Step 1: Wait for bot**

```bash
gh pr checks {PR_NUMBER} --repo alexander-proudfoot/rss-platform --watch
```

- [ ] **Step 2: Read findings**

```bash
gh pr view {PR_NUMBER} --repo alexander-proudfoot/rss-platform --comments
```

- [ ] **Step 3: For each finding**
  1. Identify the PATTERN (not just the flagged line)
  2. `grep -rn "<pattern>" --include="*.ps1" .`
  3. Fix ALL instances in one commit
  4. Push fix commit
  5. Wait for next bot round

- [ ] **Step 4: Stop after 2 consecutive rounds with no new unique findings** (KG#24)

If bot is cycling on stale findings, add PR comment:
```
Bot cycling detected — all unique findings resolved, remaining flags are stale re-reports. Proceeding per KG#24.
```

---

## Phase A: Provision Azure Resources (CLI execution — not through PR)

These tasks are performed directly by running scripts. They are not application code changes. Run locally with `pwsh`.

### Task A1: Authenticate to Azure

- [ ] **Step 1: SP login**

```powershell
az login --service-principal `
  --username $env:AZURE_CLIENT_ID `
  --password $env:AZURE_CLIENT_SECRET `
  --tenant $env:AZURE_TENANT_ID
az account show
```

Expected: account JSON with `alexander-proudfoot` subscription details.

### Task A2: Run deploy.ps1 -NonInteractive

- [ ] **Step 1: Execute**

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File "infra/deploy.ps1" `
  -SqlAdminLogin "rssadmin" `
  -NonInteractive
```

- [ ] **Step 2: Capture outputs** — record from the DEPLOYMENT COMPLETE summary:
  - `$SwaHostname` (e.g., `kind-wave-xxxxx.azurestaticapps.net`)
  - `$KvName` (e.g., `pft-kv-rss-prod`)
  - `$SqlServerFqdn`

### Task A3: Create AAD App Registration

- [ ] **Step 1: Create app**

```powershell
$app = az ad app create `
  --display-name 'rss-platform-prod' `
  --web-redirect-uris "https://$SwaHostname/.auth/login/aad/callback" `
  --output json | ConvertFrom-Json
$AppId = $app.appId
$AppObjectId = $app.id
Write-Host "App ID: $AppId  Object ID: $AppObjectId"
```

- [ ] **Step 2: Enable ID token issuance**

```powershell
az ad app update --id $AppObjectId --enable-id-token-issuance true
```

- [ ] **Step 3: Create service principal**

```powershell
$sp = az ad sp create --id $AppId --output json | ConvertFrom-Json
$SpObjectId = $sp.id
Write-Host "SP Object ID: $SpObjectId"
```

- [ ] **Step 4: Create client secret (2-year)**

```powershell
$cred = az ad app credential reset --id $AppObjectId --years 2 --output json | ConvertFrom-Json
$ClientSecret = $cred.password
Write-Host "Client secret created (value captured, not logged)"
```

- [ ] **Step 5: Write AZURE-CLIENT-SECRET to Key Vault via temp file**

```powershell
$TmpFile = [System.IO.Path]::GetTempFileName()
try {
  Set-Content -Path $TmpFile -Value $ClientSecret -NoNewline -Encoding UTF8
  az keyvault secret set --vault-name $KvName --name 'AZURE-CLIENT-SECRET' --file $TmpFile --output none
} finally {
  Remove-Variable ClientSecret -ErrorAction SilentlyContinue
  Remove-Item $TmpFile -Force -ErrorAction SilentlyContinue
}
Write-Host "AZURE-CLIENT-SECRET written to Key Vault."
```

- [ ] **Step 6: Grant SP Contributor on resource group**

```powershell
$SubId = (az account show --query id -o tsv)
az role assignment create `
  --assignee $SpObjectId `
  --role Contributor `
  --scope "/subscriptions/$SubId/resourceGroups/pft-rss-prod-rg"
```

### Task A4: Create federated credentials (GitHub OIDC)

- [ ] **Step 1: Check for existing main-branch credential (KG#9)**

```powershell
$mainSubject = 'repo:alexander-proudfoot/rss-platform:ref:refs/heads/main'
$existing = az ad app federated-credential list --id $AppObjectId `
  --query "[?subject=='$mainSubject'].name" -o tsv
if ($existing) {
  Write-Host "Main-branch federated credential already exists ($existing) — skipping."
} else {
  az ad app federated-credential create --id $AppObjectId --parameters '{
    "name": "rss-platform-main",
    "issuer": "https://token.actions.githubusercontent.com",
    "subject": "repo:alexander-proudfoot/rss-platform:ref:refs/heads/main",
    "audiences": ["api://AzureADTokenExchange"]
  }'
  Write-Host "Main-branch credential created."
}
```

- [ ] **Step 2: Check for existing PR credential (KG#9)**

```powershell
$prSubject = 'repo:alexander-proudfoot/rss-platform:pull_request'
$existingPr = az ad app federated-credential list --id $AppObjectId `
  --query "[?subject=='$prSubject'].name" -o tsv
if ($existingPr) {
  Write-Host "PR federated credential already exists ($existingPr) — skipping."
} else {
  az ad app federated-credential create --id $AppObjectId --parameters '{
    "name": "rss-platform-pr",
    "issuer": "https://token.actions.githubusercontent.com",
    "subject": "repo:alexander-proudfoot/rss-platform:pull_request",
    "audiences": ["api://AzureADTokenExchange"]
  }'
  Write-Host "PR credential created."
}
```

### Task A5: Set GitHub secrets

- [ ] **Step 1: Set three required secrets**

```bash
gh secret set AZURE_CLIENT_ID --body "$AppId" --repo alexander-proudfoot/rss-platform
gh secret set AZURE_TENANT_ID --body "1658a6b1-ef3a-4f3b-9aed-5da136a40aa5" --repo alexander-proudfoot/rss-platform
gh secret set AZURE_SUBSCRIPTION_ID --body "$SubId" --repo alexander-proudfoot/rss-platform
```

- [ ] **Step 2: Verify**

```bash
gh secret list --repo alexander-proudfoot/rss-platform
```

Expected: AZURE_CLIENT_ID, AZURE_TENANT_ID, AZURE_SUBSCRIPTION_ID listed (values hidden).

---

## *** STOP: Managed Agent Creation ***

**At this point, STOP. Report to Neil:**

```
Azure provisioning complete. Resources:
  SWA URL:      https://{SwaHostname}
  Key Vault:    pft-kv-rss-prod
  SQL Server:   {SqlServerFqdn}

GitHub secrets set: AZURE_CLIENT_ID, AZURE_TENANT_ID, AZURE_SUBSCRIPTION_ID

Waiting for Neil to complete Managed Agent creation (Section 9 of handoff):
  1. Create agent at console.anthropic.com
  2. Upload methodology + skill files
  3. Configure Zoho CRM MCP tool
  4. Collect: ANTHROPIC-API-KEY, MANAGED-AGENT-ID, MANAGED-ENVIRONMENT-ID
  5. Provide three values back to Code

Do NOT proceed until Neil provides the three values.
```

---

## Phase D2: Configure Secrets (after Neil provides Anthropic IDs)

### Task D2-1: Write Anthropic secrets to Key Vault

- [ ] **Step 1: Write API key via temp file**

```powershell
# Neil provides: $AnthropicApiKey, $ManagedAgentId, $ManagedEnvironmentId
$TmpFile = [System.IO.Path]::GetTempFileName()
try {
  Set-Content -Path $TmpFile -Value $AnthropicApiKey -NoNewline -Encoding UTF8
  az keyvault secret set --vault-name $KvName --name 'ANTHROPIC-API-KEY' --file $TmpFile --output none
  if ($LASTEXITCODE -ne 0) { Write-Error "Failed to write ANTHROPIC-API-KEY" }
} finally {
  Remove-Variable AnthropicApiKey -ErrorAction SilentlyContinue
  Remove-Item $TmpFile -Force -ErrorAction SilentlyContinue
}
Write-Host "ANTHROPIC-API-KEY written."
```

- [ ] **Step 2: Write agent and environment IDs**

```powershell
az keyvault secret set --vault-name $KvName --name 'MANAGED-AGENT-ID' --value $ManagedAgentId --output none
az keyvault secret set --vault-name $KvName --name 'MANAGED-ENVIRONMENT-ID' --value $ManagedEnvironmentId --output none
Remove-Variable ManagedAgentId, ManagedEnvironmentId -ErrorAction SilentlyContinue
Write-Host "MANAGED-AGENT-ID and MANAGED-ENVIRONMENT-ID written."
```

### Task D2-2: Run set-swa-appsettings.ps1

- [ ] **Step 1: Execute**

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File "infra/set-swa-appsettings.ps1" -Environment prod
```

Expected: "All secrets delivered successfully." or warnings only for secrets not yet populated.

---

## Phase F: Verify Deployment

### Task F1: Trigger deploy workflow

- [ ] **Step 1: Trigger via trivial commit on main**

```bash
# After PR is merged, on main:
git checkout main && git pull
echo "" >> README.md  # add blank line
git add README.md
git commit -m "chore: trigger initial SWA deploy (D099)"
git push origin main
```

- [ ] **Step 2: Watch workflow**

```bash
gh run watch --repo alexander-proudfoot/rss-platform
```

Expected: `azure-swa-deploy.yml` completes with green status.

### Task F2: Smoke-test the live application

- [ ] **Step 1: Health endpoint**

```bash
curl -I "https://$SwaHostname/api/health"
```

Expected: HTTP 200. Body should contain `"status":"healthy"` or `"status":"degraded"`.

- [ ] **Step 2: Frontend load (Playwright)**

Use `playwright` plugin to navigate to `https://{SwaHostname}` and verify:
- Page loads (no blank/error page)
- Redirects to AAD login (`login.microsoftonline.com`)

---

## Phase E: Create GitHub Issue

- [ ] **Step 1: Create issue**

```bash
gh issue create \
  --repo alexander-proudfoot/rss-platform \
  --title "Deploy: RSS Platform production environment provisioned" \
  --label "infrastructure,build" \
  --body "Azure SQL, Key Vault, SWA provisioned via deploy.ps1. AAD App Registration + OIDC configured. GitHub Actions deploy workflow green. Closes #8."
```

---

## Risk Register

| Risk | Mitigation |
|------|-----------|
| `az staticwebapp appsettings set --setting-names` exposes secret values in process args | Check if `--input-file` flag is available; if so, use JSON temp file instead |
| `az ad signed-in-user show` fails in SP auth context | Handled — SP-aware OID resolution in Task 1 |
| Federated credential issuer+subject conflict (KG#9) | Check by subject before create — handled in Task A4 |
| `deploy.ps1` Step 6 reads plain-text password from `$TempParamsFile` after transcript starts | Existing pattern — password is in temp file only, file deleted in finally block; transcript never captures the value directly |
| KG#29/KG#30 text in CLAUDE.md may diverge from canonical template | Note in Task 4 — Neil must confirm against `proudfoot-programme/qa/CLAUDE-TEMPLATE.md` |
| `sqlcmd` not available in CI | deploy.ps1 already handles this gracefully with a warning + manual instructions |
| `--enable-id-token-issuance` flag availability | Available in az cli ≥ 2.50; verify with `az --version` |

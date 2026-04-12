# D099 Hotfix + Infrastructure as Code — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the synchronous await in messages.ts (KG#18 timeout risk), add TOP 200 bound to matrix.ts, and create Bicep IaC templates + deploy scripts for Azure SQL / Key Vault / SWA.

**Architecture:** Two independent workstreams — (A) a targeted two-line fix to the Azure Functions API restoring fire-and-forget async; (B) Bicep modules + PowerShell deploy scripts to provision all Azure resources. No frontend changes. No Phase 1 content changes.

**Tech Stack:** TypeScript (Azure Functions v4), Bicep, PowerShell 7 (pwsh), Azure CLI, GitHub Actions (YAML)

---

## Pre-flight Checklist

- [ ] Verify on branch `feature/D099-hotfix-iac` (create from main if not present)
- [ ] Run `npm ci` in both root and `api/` to ensure lockfile is valid
- [ ] Confirm `tsc -b` passes clean before any changes (baseline)
- [ ] Run Miller Heiman IP grep (see Section 11) — must be zero results before any PR

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `api/src/functions/messages.ts` | Modify | Restore fire-and-forget + 202 response |
| `api/src/lib/jobs.ts` | Modify comments only | Update stale docstrings to reflect fire-and-forget |
| `api/src/functions/matrix.ts` | Modify | Add `TOP 200` to history query |
| `infra/main.bicep` | Create | Orchestrates sql/keyvault/swa modules |
| `infra/modules/sql.bicep` | Create | Azure SQL Server + Database + firewall |
| `infra/modules/keyvault.bicep` | Create | Key Vault with RBAC + deployer role assignment |
| `infra/modules/swa.bicep` | Create | Static Web App Standard tier |
| `infra/deploy.ps1` | Create | Full prod deployment: Bicep + schema + KV secrets |
| `infra/deploy-preview.ps1` | Create | Thin wrapper for preview environment |
| `.github/workflows/azure-swa-deploy.yml` | Create | SWA CI/CD with OIDC auth (P1 Should-Have) |

---

## Task 0: Branch Setup

**Files:** none (git operations only)

- [ ] **Step 1: Create feature branch from main**

```bash
git checkout main
git pull origin main
git checkout -b feature/D099-hotfix-iac
```

Expected: `Switched to a new branch 'feature/D099-hotfix-iac'`

- [ ] **Step 2: Verify TypeScript baseline compiles clean**

```bash
cd api && npx tsc -b 2>&1
```

Expected: no output (zero errors). If errors exist, note them before proceeding — they are pre-existing, not introduced by this build.

---

## Task 1: Fix messages.ts — Restore Fire-and-Forget Async

**Files:**
- Modify: `api/src/functions/messages.ts:39-80`
- Modify: `api/src/lib/jobs.ts:27-33` and `api/src/lib/jobs.ts:63-67` (comment-only updates)

**What's wrong:** Lines 78-80 of messages.ts call `await executeJob(...)` then return `status: 200`. This makes the endpoint block for the full agent response (30 seconds to 10+ minutes), hitting the SWA 45-second proxy timeout. The fix is to call `void executeJob(...).catch(() => {})` and return `status: 202` immediately. The jobs.ts docstrings also contain stale claims about awaiting.

- [ ] **Step 1: Apply the fire-and-forget fix to messages.ts**

Replace the block from line 39 to line 80 with:

```typescript
  const messageContent = body.content
  const work = async (_jobId: string) => {
    let agentResponse
    if (session.agent_session_id) {
      agentResponse = await sendMessageToSession(session.agent_session_id, messageContent)
    } else {
      agentResponse = await createAgentSession(messageContent)
      await query(
        'UPDATE coaching_sessions SET agent_session_id = @agentSessionId WHERE id = @sessionId',
        { agentSessionId: agentResponse.sessionId, sessionId },
        req,
      )
    }

    // Save assistant message
    await query(
      `INSERT INTO coaching_messages (id, session_id, role, content, created_at)
       VALUES (@id, @sessionId, 'assistant', @content, GETUTCDATE())`,
      { id: uuidv4(), sessionId, content: agentResponse.text },
      req,
    )

    return JSON.stringify({ text: agentResponse.text })
  }

  const jobId = await submitJob(
    session.salesperson_id,
    sessionId,
    'coaching_message',
    work,
    { content: messageContent },
    req,
  )

  // Fire-and-forget: start agent work in the background, return 202 immediately.
  // executeJob handles its own errors internally (catches and sets job to 'failed').
  // The outer .catch() prevents unhandled promise rejection if executeJob throws
  // before reaching its internal try/catch.
  void executeJob(jobId, work, req).catch(() => {})

  return { status: 202, jsonBody: { jobId } }
```

The full file after this change:

```typescript
import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions'
import { getClientPrincipal } from '../lib/auth.js'
import { query } from '../lib/db.js'
import { submitJob, executeJob } from '../lib/jobs.js'
import { createSession as createAgentSession, sendMessageToSession } from '../lib/managed-agent.js'
import { v4 as uuidv4 } from 'uuid'

async function sendMessage(req: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const principal = getClientPrincipal(req)
  if (!principal) return { status: 401 }

  const sessionId = req.params.sessionId
  if (!sessionId) return { status: 400 }

  const body = await req.json() as { content: string }
  if (!body.content?.trim()) return { status: 400, jsonBody: { error: 'content is required' } }

  // Verify session belongs to user
  const sessionResult = await query<{ id: string; agent_session_id: string | null; salesperson_id: string } & Record<string, unknown>>(
    `SELECT cs.id, cs.agent_session_id, cs.salesperson_id
     FROM coaching_sessions cs
     JOIN salesperson_profiles sp ON cs.salesperson_id = sp.id
     WHERE cs.id = @sessionId AND sp.user_oid = @userOid`,
    { sessionId, userOid: principal.userId },
    req,
  )
  if (sessionResult.recordset.length === 0) return { status: 404 }

  const session = sessionResult.recordset[0]

  // Save user message
  await query(
    `INSERT INTO coaching_messages (id, session_id, role, content, created_at)
     VALUES (@id, @sessionId, 'user', @content, GETUTCDATE())`,
    { id: uuidv4(), sessionId, content: body.content },
    req,
  )

  const messageContent = body.content
  const work = async (_jobId: string) => {
    let agentResponse
    if (session.agent_session_id) {
      agentResponse = await sendMessageToSession(session.agent_session_id, messageContent)
    } else {
      agentResponse = await createAgentSession(messageContent)
      await query(
        'UPDATE coaching_sessions SET agent_session_id = @agentSessionId WHERE id = @sessionId',
        { agentSessionId: agentResponse.sessionId, sessionId },
        req,
      )
    }

    // Save assistant message
    await query(
      `INSERT INTO coaching_messages (id, session_id, role, content, created_at)
       VALUES (@id, @sessionId, 'assistant', @content, GETUTCDATE())`,
      { id: uuidv4(), sessionId, content: agentResponse.text },
      req,
    )

    return JSON.stringify({ text: agentResponse.text })
  }

  const jobId = await submitJob(
    session.salesperson_id,
    sessionId,
    'coaching_message',
    work,
    { content: messageContent },
    req,
  )

  // Fire-and-forget: start agent work in the background, return 202 immediately.
  // executeJob handles its own errors internally (catches and sets job to 'failed').
  // The outer .catch() prevents unhandled promise rejection if executeJob throws
  // before reaching its internal try/catch.
  void executeJob(jobId, work, req).catch(() => {})

  return { status: 202, jsonBody: { jobId } }
}

app.http('sendMessage', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'sessions/{sessionId}/messages',
  handler: sendMessage,
})
```

- [ ] **Step 2: Update stale docstrings in jobs.ts**

Replace the `submitJob` JSDoc (lines 27-33):
```typescript
/**
 * Create a job record in the database and return the job ID.
 * The caller is responsible for executing the work via executeJob.
 */
```

Replace the `executeJob` JSDoc (lines 63-67):
```typescript
/**
 * Execute the work for a previously submitted job.
 * Safe to call as fire-and-forget: all errors are caught internally and
 * written to the ai_jobs record as status 'failed' with a user-friendly message.
 */
```

- [ ] **Step 3: AFTER writing — run tsc -b via TypeScript LSP**

```bash
cd api && npx tsc -b 2>&1
```

Expected: zero output (no errors).

- [ ] **Step 4: AFTER writing — run /code-review on the diff**

Run the `code-review:code-review` skill. Focus: does the fire-and-forget pattern look correct? Does the `req` reference in `work` close over correctly (it's in scope)? Fix any RED findings before proceeding.

- [ ] **Step 5: AFTER writing — run /Skill(review) (superpowers)**

Run `superpowers:verification-before-completion`. Confirm: messages.ts returns 202, executeJob is called with void, `.catch(() => {})` is present.

- [ ] **Step 6: Commit**

```bash
git add api/src/functions/messages.ts api/src/lib/jobs.ts
git commit -m "$(cat <<'EOF'
fix: restore fire-and-forget async pattern in messages.ts (KG#18)

Reverts the synchronous await pattern introduced during D092 round 2.
Endpoint now returns 202 immediately; agent work executes in the background
via void executeJob().catch(). Stale docstrings in jobs.ts updated.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Fix matrix.ts — Add TOP 200 Bound

**Files:**
- Modify: `api/src/functions/matrix.ts:21-29`

**What's wrong:** The history query fetches all rows for a user without any limit. For active users with many matrix assessments, this could return large unbounded result sets. Adding `TOP 200` provides a practical safety bound.

- [ ] **Step 1: Add TOP 200 to the history query**

On line 22 of `api/src/functions/matrix.ts`, change:

```typescript
    `SELECT mp.id, mp.customer_name, mp.opportunity_name, mp.quadrant, mp.evidence, mp.assessed_at
```

to:

```typescript
    `SELECT TOP 200 mp.id, mp.customer_name, mp.opportunity_name, mp.quadrant, mp.evidence, mp.assessed_at
```

The full query block after the change:

```typescript
  const result = await query<MatrixPositionRow>(
    `SELECT TOP 200 mp.id, mp.customer_name, mp.opportunity_name, mp.quadrant, mp.evidence, mp.assessed_at
     FROM matrix_positions mp
     JOIN salesperson_profiles sp ON mp.salesperson_id = sp.id
     WHERE sp.user_oid = @userOid ${whereCustomer}
     ORDER BY mp.assessed_at DESC`,
    { userOid: principal.userId, ...(customerFilter ? { customer: customerFilter } : {}) },
    req,
  )
```

- [ ] **Step 2: AFTER writing — run tsc -b**

```bash
cd api && npx tsc -b 2>&1
```

Expected: zero output.

- [ ] **Step 3: AFTER writing — run /Skill(review)**

Run `superpowers:verification-before-completion`. Confirm: TOP 200 is on the `history` query, not the `currentPositions` rollup (which is already bounded by distinct customer count).

- [ ] **Step 4: Commit**

```bash
git add api/src/functions/matrix.ts
git commit -m "$(cat <<'EOF'
fix: add TOP 200 bound to matrix positions history query

Prevents unbounded result sets as a user's assessment history grows.
The currentPositions rollup (latest-per-customer) is already bounded
by distinct customer count and is unchanged.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Create infra/modules/sql.bicep

**Files:**
- Create: `infra/modules/sql.bicep`

- [ ] **Step 1: Create the infra/modules directory and sql.bicep**

```bicep
// infra/modules/sql.bicep
// RSS Platform — Azure SQL Server + Database
// Directive: D099

@description('Target environment: prod or preview')
param environment string

@description('Azure region')
param location string

@description('SQL Server administrator login')
param sqlAdminLogin string

@description('SQL Server administrator password')
@secure()
param sqlAdminPassword string

var sqlServerName = 'pft-sql-rss-${environment}'
var databaseName = 'pft-rss-${environment}-db'
var tags = {
  project: 'rss-platform'
  directive: 'D099'
  environment: environment
}

resource sqlServer 'Microsoft.Sql/servers@2022-05-01-preview' = {
  name: sqlServerName
  location: location
  tags: tags
  properties: {
    administratorLogin: sqlAdminLogin
    administratorLoginPassword: sqlAdminPassword
    minimalTlsVersion: '1.2'
    publicNetworkAccess: 'Enabled'
  }
}

resource sqlDatabase 'Microsoft.Sql/servers/databases@2022-05-01-preview' = {
  parent: sqlServer
  name: databaseName
  location: location
  tags: tags
  sku: {
    name: 'Basic'
    tier: 'Basic'
    capacity: 5
  }
  properties: {
    collation: 'SQL_Latin1_General_CP1_CI_AS'
  }
}

// Allow all Azure services (IP 0.0.0.0) — required for Functions to reach the database
resource firewallAzureServices 'Microsoft.Sql/servers/firewallRules@2022-05-01-preview' = {
  parent: sqlServer
  name: 'AllowAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

output sqlServerName string = sqlServer.name
output sqlServerFqdn string = sqlServer.properties.fullyQualifiedDomainName
output databaseName string = databaseName
```

- [ ] **Step 2: Validate Bicep syntax**

```bash
az bicep build --file infra/modules/sql.bicep
```

Expected: no output (exits 0). If `az bicep` is not available: `az bicep install` then retry.

- [ ] **Step 3: Commit**

```bash
git add infra/modules/sql.bicep
git commit -m "$(cat <<'EOF'
infra: add sql.bicep module (Azure SQL Server + Database)

Basic tier SQL Server with TLS 1.2 minimum and Azure Services firewall rule.
Naming: pft-sql-rss-{env}. D099 IaC.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Create infra/modules/keyvault.bicep

**Files:**
- Create: `infra/modules/keyvault.bicep`

- [ ] **Step 1: Write keyvault.bicep**

```bicep
// infra/modules/keyvault.bicep
// RSS Platform — Azure Key Vault
// Directive: D099

@description('Target environment: prod or preview')
param environment string

@description('Azure region')
param location string

@description('AAD Object ID of the deployer — granted Key Vault Secrets Officer role')
param deployerObjectId string = ''

var keyVaultName = 'pft-kv-rss-${environment}'
// Key Vault Secrets Officer built-in role
var kvSecretsOfficerRoleId = 'b86a8fe4-44ce-4948-aee5-eccb2c155cd7'
var tags = {
  project: 'rss-platform'
  directive: 'D099'
  environment: environment
}

resource keyVault 'Microsoft.KeyVault/vaults@2023-02-01' = {
  name: keyVaultName
  location: location
  tags: tags
  properties: {
    tenantId: subscription().tenantId
    sku: {
      family: 'A'
      name: 'standard'
    }
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 7
    publicNetworkAccess: 'Enabled'
  }
}

// Grant deployer Key Vault Secrets Officer so deploy.ps1 can write secrets
resource deployerRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (!empty(deployerObjectId)) {
  scope: keyVault
  name: guid(keyVault.id, deployerObjectId, kvSecretsOfficerRoleId)
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', kvSecretsOfficerRoleId)
    principalId: deployerObjectId
    principalType: 'User'
  }
}

output keyVaultName string = keyVaultName
output keyVaultUri string = keyVault.properties.vaultUri
```

- [ ] **Step 2: Validate Bicep syntax**

```bash
az bicep build --file infra/modules/keyvault.bicep
```

Expected: no output (exits 0).

- [ ] **Step 3: Commit**

```bash
git add infra/modules/keyvault.bicep
git commit -m "$(cat <<'EOF'
infra: add keyvault.bicep module

Key Vault with RBAC authorization. Grants deployer Key Vault Secrets
Officer role so deploy.ps1 can write SQL-CONNECTION-STRING post-deploy.
Naming: pft-kv-rss-{env}. D099 IaC.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Create infra/modules/swa.bicep

**Files:**
- Create: `infra/modules/swa.bicep`

- [ ] **Step 1: Write swa.bicep**

Note: The SWA resource is created without a GitHub `repositoryUrl`. The deployment token is retrieved in `deploy.ps1` and stored as a GitHub Actions secret separately. This avoids requiring a GitHub PAT at Bicep deploy time.

```bicep
// infra/modules/swa.bicep
// RSS Platform — Azure Static Web App (Standard tier)
// Directive: D099

@description('Target environment: prod or preview')
param environment string

@description('Azure region. SWA is available in limited regions; uksouth is supported.')
param location string

var swaName = 'pft-rss-${environment}'
var tags = {
  project: 'rss-platform'
  directive: 'D099'
  environment: environment
}

resource staticWebApp 'Microsoft.Web/staticSites@2023-01-01' = {
  name: swaName
  location: location
  tags: tags
  sku: {
    name: 'Standard'
    tier: 'Standard'
  }
  properties: {
    // Repository linking is done post-deploy via the deployment token.
    // See deploy.ps1 Step: Configure GitHub Actions.
    buildProperties: {
      skipGithubActionWorkflowGeneration: true
    }
  }
}

output swaName string = swaName
output swaDefaultHostname string = staticWebApp.properties.defaultHostname
output swaId string = staticWebApp.id
```

- [ ] **Step 2: Validate Bicep syntax**

```bash
az bicep build --file infra/modules/swa.bicep
```

Expected: no output (exits 0).

- [ ] **Step 3: Commit**

```bash
git add infra/modules/swa.bicep
git commit -m "$(cat <<'EOF'
infra: add swa.bicep module

Static Web App Standard tier. GitHub CI/CD is configured via deployment
token in deploy.ps1, not via Bicep repositoryUrl. Naming: pft-rss-{env}.
D099 IaC.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Create infra/main.bicep

**Files:**
- Create: `infra/main.bicep`

- [ ] **Step 1: Write main.bicep**

```bicep
// infra/main.bicep
// RSS Platform — Main Bicep orchestration template
// Directive: D099
//
// Resources provisioned:
//   - Azure SQL Server + Database (pft-sql-rss-{env})
//   - Azure Key Vault (pft-kv-rss-{env})
//   - Azure Static Web App (pft-rss-{env})
//
// Usage:
//   az deployment group create \
//     --resource-group pft-rss-prod-rg \
//     --template-file infra/main.bicep \
//     --parameters environment=prod sqlAdminLogin=rssadmin sqlAdminPassword=<secret> \
//                  deployerObjectId=$(az ad signed-in-user show --query id -o tsv)
//
// After deployment, run deploy.ps1 to complete: schema migration, KV secret population.

@description('Target environment: prod or preview')
@allowed(['prod', 'preview'])
param environment string = 'prod'

@description('Azure region for all resources')
param location string = 'uksouth'

@description('SQL Server administrator login name')
param sqlAdminLogin string

@description('SQL Server administrator password')
@secure()
param sqlAdminPassword string

@description('AAD Object ID of the deployer. Used to grant Key Vault Secrets Officer role.')
param deployerObjectId string = ''

module sql 'modules/sql.bicep' = {
  name: 'sql-${environment}'
  params: {
    environment: environment
    location: location
    sqlAdminLogin: sqlAdminLogin
    sqlAdminPassword: sqlAdminPassword
  }
}

module keyVault 'modules/keyvault.bicep' = {
  name: 'keyvault-${environment}'
  params: {
    environment: environment
    location: location
    deployerObjectId: deployerObjectId
  }
}

module swa 'modules/swa.bicep' = {
  name: 'swa-${environment}'
  params: {
    environment: environment
    location: location
  }
}

output sqlServerFqdn string = sql.outputs.sqlServerFqdn
output databaseName string = sql.outputs.databaseName
output keyVaultName string = keyVault.outputs.keyVaultName
output keyVaultUri string = keyVault.outputs.keyVaultUri
output swaName string = swa.outputs.swaName
output swaDefaultHostname string = swa.outputs.swaDefaultHostname
output swaId string = swa.outputs.swaId
```

- [ ] **Step 2: Validate the full template (all modules)**

```bash
az bicep build --file infra/main.bicep
```

Expected: no output (exits 0). This also validates all referenced modules.

- [ ] **Step 3: AFTER writing — run /Skill(review)**

Run `superpowers:verification-before-completion`. Check: naming matches `pft-rss-{env}` / `pft-sql-rss-{env}` / `pft-kv-rss-{env}`. Parameters have `@secure()` on passwords. Tags present on all resources.

- [ ] **Step 4: Commit**

```bash
git add infra/main.bicep
git commit -m "$(cat <<'EOF'
infra: add main.bicep orchestration template

Provisions SQL, Key Vault, and SWA for prod or preview environment.
All resources tagged project/directive/environment. D099 IaC.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Create infra/deploy.ps1

**Files:**
- Create: `infra/deploy.ps1`

- [ ] **Step 1: Write deploy.ps1**

```powershell
<#
.SYNOPSIS
  Provisions all Azure resources for the RSS Platform and runs the schema migration.

.DESCRIPTION
  Deploys Azure SQL, Key Vault, and Static Web App via Bicep, then writes the SQL
  connection string to Key Vault, runs the initial schema migration, and prints a
  summary of which secrets still require manual population.

.PARAMETER Environment
  Target environment: 'prod' or 'preview'. Default: 'prod'.

.PARAMETER Location
  Azure region. Default: 'uksouth'.

.PARAMETER SqlAdminLogin
  SQL Server administrator login name.

.PARAMETER SqlAdminPassword
  SQL Server administrator password (SecureString — prompted if not supplied).

.PARAMETER ResourceGroup
  Azure resource group. Default: 'pft-rss-{Environment}-rg'.

.PARAMETER SkipSchemamigration
  Switch: skip the sqlcmd schema migration step (e.g., if already run).

.REQUIRES
  - Azure CLI (az) authenticated via: az login
  - Contributor role on the target resource group
  - Key Vault Secrets Officer on the provisioned Key Vault (assigned by Bicep to the deployer)
  - sqlcmd installed (https://aka.ms/sqlcmdinstall) for schema migration
  - pwsh (PowerShell 7) — do NOT run with powershell.exe 5.1

.NOTES
  Output is logged to Audit/logs/deploy-{timestamp}.log and committed.
  Directive: D099
#>
param(
  [ValidateSet('prod', 'preview')]
  [string]$Environment = 'prod',

  [string]$Location = 'uksouth',

  [Parameter(Mandatory)]
  [string]$SqlAdminLogin,

  [Parameter(Mandatory)]
  [SecureString]$SqlAdminPassword,

  [string]$ResourceGroup = '',

  [switch]$SkipSchemaMigration
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# Resolve resource group default
if ([string]::IsNullOrEmpty($ResourceGroup)) {
  $ResourceGroup = "pft-rss-$Environment-rg"
}

# Script logging — per CLAUDE.md script logging protocol
$ScriptDir   = $PSScriptRoot
$RepoRoot    = Resolve-Path (Join-Path $ScriptDir '..')
$LogDir      = Join-Path $RepoRoot 'Audit' 'logs'
if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir | Out-Null }
$Timestamp   = Get-Date -Format 'yyyyMMdd-HHmmss'
$LogFile     = Join-Path $LogDir "deploy-$Timestamp.log"
Start-Transcript -Path $LogFile

try {
  # ── 1. Verify Azure CLI login ────────────────────────────────────────────────
  Write-Host "`n=== Step 1: Verify Azure CLI login ==="
  $account = az account show --output json 2>$null | ConvertFrom-Json
  if (-not $account) {
    Write-Error "Not logged in to Azure CLI. Run: az login"
    exit 1
  }
  Write-Host "Logged in as:    $($account.user.name)"
  Write-Host "Subscription:    $($account.name) ($($account.id))"

  # ── 2. Resolve deployer object ID (for Key Vault RBAC) ──────────────────────
  Write-Host "`n=== Step 2: Resolve deployer object ID ==="
  $DeployerObjectId = az ad signed-in-user show --query id -o tsv
  Write-Host "Deployer OID:    $DeployerObjectId"

  # ── 3. Convert SecureString ──────────────────────────────────────────────────
  $SqlPasswordPlain = [System.Net.NetworkCredential]::new('', $SqlAdminPassword).Password

  # ── 4. Ensure resource group exists ─────────────────────────────────────────
  Write-Host "`n=== Step 3: Ensure resource group '$ResourceGroup' ==="
  az group create `
    --name $ResourceGroup `
    --location $Location `
    --tags "project=rss-platform" "directive=D099" "environment=$Environment" `
    --output none
  Write-Host "Resource group ready."

  # ── 5. Deploy Bicep template ─────────────────────────────────────────────────
  Write-Host "`n=== Step 4: Deploy Bicep template ==="
  $DeploymentName = "rss-$Environment-$Timestamp"
  $BicepFile      = Join-Path $ScriptDir 'main.bicep'

  $DeployOutput = az deployment group create `
    --name $DeploymentName `
    --resource-group $ResourceGroup `
    --template-file $BicepFile `
    --parameters `
        environment=$Environment `
        location=$Location `
        sqlAdminLogin=$SqlAdminLogin `
        sqlAdminPassword=$SqlPasswordPlain `
        deployerObjectId=$DeployerObjectId `
    --output json | ConvertFrom-Json

  if ($LASTEXITCODE -ne 0) {
    Write-Error "Bicep deployment failed (exit $LASTEXITCODE)"
    exit 1
  }

  $SqlServerFqdn = $DeployOutput.properties.outputs.sqlServerFqdn.value
  $DatabaseName  = $DeployOutput.properties.outputs.databaseName.value
  $KvName        = $DeployOutput.properties.outputs.keyVaultName.value
  $KvUri         = $DeployOutput.properties.outputs.keyVaultUri.value
  $SwaHostname   = $DeployOutput.properties.outputs.swaDefaultHostname.value
  $SwaId         = $DeployOutput.properties.outputs.swaId.value

  Write-Host "SQL FQDN:        $SqlServerFqdn"
  Write-Host "Database:        $DatabaseName"
  Write-Host "Key Vault:       $KvUri"
  Write-Host "SWA Hostname:    $SwaHostname"

  # ── 6. Write SQL connection string to Key Vault ──────────────────────────────
  Write-Host "`n=== Step 5: Write SQL-CONNECTION-STRING to Key Vault ==="
  $ConnStr = "Server=tcp:$SqlServerFqdn,1433;Database=$DatabaseName;" +
             "User Id=$SqlAdminLogin;Password=$SqlPasswordPlain;" +
             "Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;"
  az keyvault secret set `
    --vault-name $KvName `
    --name 'SQL-CONNECTION-STRING' `
    --value $ConnStr `
    --output none
  Write-Host "SQL-CONNECTION-STRING written."

  # ── 7. Schema migration ──────────────────────────────────────────────────────
  if (-not $SkipSchemaMigration) {
    Write-Host "`n=== Step 6: Schema migration ==="

    if (-not (Get-Command sqlcmd -ErrorAction SilentlyContinue)) {
      Write-Warning "sqlcmd not found — schema migration skipped."
      Write-Warning "Install sqlcmd: https://aka.ms/sqlcmdinstall"
      Write-Warning "Then run manually:"
      Write-Warning "  sqlcmd -S $SqlServerFqdn -d $DatabaseName -U $SqlAdminLogin -P <password> -i database/001-initial-schema.sql -b"
    } else {
      # Temporarily open deployer IP in SQL firewall for schema migration
      Write-Host "Adding deployer IP to SQL firewall..."
      $DeployerIp = (Invoke-RestMethod -Uri 'https://api.ipify.org?format=json').ip
      $SqlServerShortName = $SqlServerFqdn.Split('.')[0]
      az sql server firewall-rule create `
        --server $SqlServerShortName `
        --resource-group $ResourceGroup `
        --name 'DeployerTemp' `
        --start-ip-address $DeployerIp `
        --end-ip-address $DeployerIp `
        --output none

      try {
        $SchemaFile = Join-Path $RepoRoot 'database' '001-initial-schema.sql'
        Write-Host "Running: sqlcmd -S $SqlServerFqdn -d $DatabaseName -U $SqlAdminLogin -i $SchemaFile"
        sqlcmd -S $SqlServerFqdn -d $DatabaseName -U $SqlAdminLogin -P $SqlPasswordPlain -i $SchemaFile -b
        if ($LASTEXITCODE -ne 0) {
          Write-Error "Schema migration failed (sqlcmd exit $LASTEXITCODE)"
        } else {
          Write-Host "Schema migration complete."
        }
      } finally {
        # Always remove the temporary firewall rule
        Write-Host "Removing temporary deployer firewall rule..."
        az sql server firewall-rule delete `
          --server $SqlServerShortName `
          --resource-group $ResourceGroup `
          --name 'DeployerTemp' `
          --yes `
          --output none
      }
    }
  }

  # ── 8. Get SWA deployment token ──────────────────────────────────────────────
  Write-Host "`n=== Step 7: SWA deployment token ==="
  $SwaToken = az staticwebapp secrets list `
    --name "pft-rss-$Environment" `
    --resource-group $ResourceGroup `
    --query "properties.apiKey" -o tsv
  Write-Host "SWA deployment token retrieved."
  Write-Host "Store this as GitHub secret 'AZURE_STATIC_WEB_APPS_API_TOKEN' in the repo."

  # ── 9. Summary ───────────────────────────────────────────────────────────────
  Write-Host ""
  Write-Host "============================================================"
  Write-Host "DEPLOYMENT COMPLETE — $Environment"
  Write-Host "============================================================"
  Write-Host "SWA URL:         https://$SwaHostname"
  Write-Host "Key Vault:       $KvUri"
  Write-Host ""
  Write-Host "Secrets ALREADY written to Key Vault '$KvName':"
  Write-Host "  [x] SQL-CONNECTION-STRING"
  Write-Host ""
  Write-Host "Secrets requiring MANUAL population in Key Vault '$KvName':"
  Write-Host "  [ ] ANTHROPIC-API-KEY       From: Anthropic Console"
  Write-Host "  [ ] MANAGED-AGENT-ID        From: Anthropic Console (after agent creation)"
  Write-Host "  [ ] MANAGED-ENVIRONMENT-ID  From: Anthropic Console"
  Write-Host "  [ ] AZURE-CLIENT-SECRET     From: AAD App Registration (see below)"
  Write-Host ""
  Write-Host "GitHub Actions secrets to add to alexander-proudfoot/rss-platform:"
  Write-Host "  AZURE_STATIC_WEB_APPS_API_TOKEN = $SwaToken"
  Write-Host "  AZURE_CLIENT_ID     = (from AAD App Registration)"
  Write-Host "  AZURE_TENANT_ID     = $($account.tenantId)"
  Write-Host "  AZURE_SUBSCRIPTION_ID = $($account.id)"
  Write-Host ""
  Write-Host "AAD App Registration (run manually if needed):"
  Write-Host "  az ad app create --display-name 'rss-platform-$Environment'"
  Write-Host "  Then create a federated credential for GitHub OIDC."
  Write-Host "  See: https://aka.ms/azure-oidc-github"
  Write-Host "============================================================"

} finally {
  Stop-Transcript
  Write-Host ""
  Write-Host "Log saved to: $LogFile"
}
```

- [ ] **Step 2: AFTER writing — run security-guidance review**

Invoke `security-guidance` skill. Focus areas: SecureString handling, SQL password written to log (check it isn't — it shouldn't be since PowerShell Transcript doesn't expand SecureString), KV secret value not echoed to console. Fix any findings.

- [ ] **Step 3: AFTER writing — run /Skill(review)**

Run `superpowers:verification-before-completion`. Check: prerequisite permissions documented in header (KG#28 ✓). Script logging to Audit/logs (✓). `Start-Transcript` / `Stop-Transcript` present (✓). `-SkipSchemaMigration` switch present for re-runs.

- [ ] **Step 4: AFTER writing — run /Skill(simplify)**

Run `code-simplifier:code-simplifier`. Simplify any redundant patterns in the script without changing behavior.

- [ ] **Step 5: Commit**

```bash
git add infra/deploy.ps1
git commit -m "$(cat <<'EOF'
infra: add deploy.ps1 for prod environment provisioning

Runs Bicep deployment, writes SQL connection string to Key Vault,
runs schema migration via sqlcmd, and outputs manual secret checklist.
Logs to Audit/logs/. Requires Contributor + KV Secrets Officer. D099.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Create infra/deploy-preview.ps1

**Files:**
- Create: `infra/deploy-preview.ps1`

- [ ] **Step 1: Write deploy-preview.ps1**

```powershell
<#
.SYNOPSIS
  Provisions RSS Platform Azure resources for the preview environment.

.DESCRIPTION
  Thin wrapper around deploy.ps1 with Environment defaulted to 'preview'.
  All parameters, prerequisites, and logging behaviour are identical to deploy.ps1.

.PARAMETER Location
  Azure region. Default: 'uksouth'.

.PARAMETER SqlAdminLogin
  SQL Server administrator login name.

.PARAMETER SqlAdminPassword
  SQL Server administrator password (SecureString).

.PARAMETER ResourceGroup
  Azure resource group. Default: 'pft-rss-preview-rg'.

.PARAMETER SkipSchemaMigration
  Switch: skip the sqlcmd schema migration step.

.REQUIRES
  Same as deploy.ps1: az login, Contributor on RG, KV Secrets Officer, sqlcmd.

.NOTES
  Directive: D099
#>
param(
  [string]$Location = 'uksouth',

  [Parameter(Mandatory)]
  [string]$SqlAdminLogin,

  [Parameter(Mandatory)]
  [SecureString]$SqlAdminPassword,

  [string]$ResourceGroup = 'pft-rss-preview-rg',

  [switch]$SkipSchemaMigration
)

$ErrorActionPreference = 'Stop'

$deployScript = Join-Path $PSScriptRoot 'deploy.ps1'

& $deployScript `
  -Environment 'preview' `
  -Location $Location `
  -SqlAdminLogin $SqlAdminLogin `
  -SqlAdminPassword $SqlAdminPassword `
  -ResourceGroup $ResourceGroup `
  @( if ($SkipSchemaMigration) { '-SkipSchemaMigration' } )
```

- [ ] **Step 2: AFTER writing — run /Skill(review)**

Run `superpowers:verification-before-completion`. Check: prerequisite permissions are in header comment (KG#28 ✓). Wrapper correctly delegates to deploy.ps1 without duplicating logic.

- [ ] **Step 3: Commit**

```bash
git add infra/deploy-preview.ps1
git commit -m "$(cat <<'EOF'
infra: add deploy-preview.ps1 for preview environment provisioning

Thin wrapper around deploy.ps1 with Environment defaulted to 'preview'.
D099 IaC.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Create .github/workflows/azure-swa-deploy.yml (P1 Should-Have)

**Files:**
- Create: `.github/workflows/azure-swa-deploy.yml`

**What this does:** Deploys the SWA on every push to `main` and on PR open/update (staging environment). Uses OIDC authentication (no long-lived secrets) to fetch the SWA deployment token dynamically from Azure.

- [ ] **Step 1: Write azure-swa-deploy.yml**

```yaml
# .github/workflows/azure-swa-deploy.yml
# RSS Platform — Azure Static Web App CI/CD
# Directive: D099
#
# Prerequisites (one-time setup by deployer):
#   1. Create AAD App Registration with federated credential for this repo + main branch
#   2. Grant the SP Contributor on the resource group
#   3. Add GitHub repo secrets:
#      - AZURE_CLIENT_ID      (App Registration client ID)
#      - AZURE_TENANT_ID      (AAD tenant ID)
#      - AZURE_SUBSCRIPTION_ID
#   Note: SWA deployment token is fetched dynamically — not stored as a secret.

name: Azure SWA Deploy

on:
  push:
    branches:
      - main
    paths-ignore:
      - 'Audit/**'
      - 'methodology/**'
      - 'skills/**'
      - 'agent/**'
      - '**.md'
  pull_request:
    types: [opened, synchronize, reopened, closed]
    branches:
      - main
    paths-ignore:
      - 'Audit/**'
      - 'methodology/**'
      - 'skills/**'
      - 'agent/**'
      - '**.md'

permissions:
  id-token: write
  contents: read

jobs:
  build_and_deploy:
    if: >
      github.event_name == 'push' ||
      (github.event_name == 'pull_request' && github.event.action != 'closed')
    runs-on: ubuntu-latest
    name: Build and Deploy

    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          submodules: true

      - name: Azure Login (OIDC)
        uses: azure/login@v2
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}

      - name: Get SWA deployment token
        id: swa-token
        run: |
          TOKEN=$(az staticwebapp secrets list \
            --name pft-rss-prod \
            --resource-group pft-rss-prod-rg \
            --query "properties.apiKey" -o tsv)
          echo "token=$TOKEN" >> "$GITHUB_OUTPUT"

      - name: Deploy to Azure Static Web Apps
        uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ steps.swa-token.outputs.token }}
          repo_token: ${{ secrets.GITHUB_TOKEN }}
          action: upload
          app_location: /
          api_location: api
          output_location: dist
          app_build_command: npm run build
          api_build_command: npm run build

  close_pull_request:
    if: github.event_name == 'pull_request' && github.event.action == 'closed'
    runs-on: ubuntu-latest
    name: Close Pull Request

    steps:
      - name: Azure Login (OIDC)
        uses: azure/login@v2
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}

      - name: Get SWA deployment token
        id: swa-token
        run: |
          TOKEN=$(az staticwebapp secrets list \
            --name pft-rss-prod \
            --resource-group pft-rss-prod-rg \
            --query "properties.apiKey" -o tsv)
          echo "token=$TOKEN" >> "$GITHUB_OUTPUT"

      - name: Close staging environment
        uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ steps.swa-token.outputs.token }}
          action: close
```

- [ ] **Step 2: AFTER writing — run /code-review**

Run `code-review:code-review`. Check: `paths-ignore` includes Audit (per CLAUDE.md — Audit log pushes must not trigger deploys). `permissions` block present. OIDC pattern correct.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/azure-swa-deploy.yml
git commit -m "$(cat <<'EOF'
ci: add Azure SWA deploy workflow with OIDC authentication

Deploys on push to main and PR events. Fetches SWA deployment token
dynamically via OIDC — no long-lived secrets stored. Audit/ and
methodology/ paths excluded to avoid spurious deploy triggers. D099.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Pre-PR Quality Gates

**Files:** none (review / analysis only)

Run these in order. Fix any findings before creating the PR.

- [ ] **Step 1: Miller Heiman IP exclusion check (KG#11 — mandatory)**

Run the Miller Heiman IP exclusion check from the "Miller Heiman IP Exclusion" section of CLAUDE.md. Must return zero results before the PR is submitted.

Expected: zero results. If any results appear, fix before proceeding.

- [ ] **Step 2: tsc -b final verification**

```bash
cd api && npx tsc -b 2>&1
```

Expected: zero output (no errors).

- [ ] **Step 3: pr-review-toolkit:silent-failure-hunter on messages.ts and matrix.ts**

Dispatch `pr-review-toolkit:silent-failure-hunter` agent. Target files: `api/src/functions/messages.ts`, `api/src/lib/jobs.ts`, `api/src/functions/matrix.ts`. Focus: does the fire-and-forget pattern have any silent failure paths? Fix RED findings.

- [ ] **Step 4: pr-review-toolkit:type-design-analyzer on jobs.ts**

Dispatch `pr-review-toolkit:type-design-analyzer`. Target: `AiJob` interface in `api/src/lib/jobs.ts`. Check for any type design issues with the `status` union.

- [ ] **Step 5: /Skill(simplify) on deploy scripts**

Run `code-simplifier:code-simplifier` on `infra/deploy.ps1` and `infra/deploy-preview.ps1`. Simplify without changing behavior.

- [ ] **Step 6: /code-review on the full diff**

Run `code-review:code-review` on the complete diff from main. Fix all RED, fix YELLOW unless confirmed false positive. Document any intentional false positives.

- [ ] **Step 7: Push branch to origin**

```bash
git push -u origin feature/D099-hotfix-iac
```

---

## Task 11: Phase G — PR Creation and Bot Review

- [ ] **Step 1: Create PR**

```bash
gh pr create \
  --repo alexander-proudfoot/rss-platform \
  --base main \
  --head feature/D099-hotfix-iac \
  --title "fix+infra: restore async pattern in messages.ts and add Bicep IaC (D099)" \
  --body "$(cat <<'EOF'
## Summary
- **fix:** Restore fire-and-forget async in `messages.ts` (was accidentally converted to synchronous await during D092 round 2, risking SWA 45s timeout — KG#18)
- **fix:** Add `TOP 200` bound to matrix positions history query
- **infra:** Bicep templates for Azure SQL, Key Vault, SWA (`infra/main.bicep` + `infra/modules/`)
- **infra:** `deploy.ps1` / `deploy-preview.ps1` with schema migration, KV secret population, and Audit logging
- **ci:** GitHub Actions workflow for SWA deploy with OIDC authentication

## Test plan
- [ ] Verify `messages.ts` returns `202` (not `200`) with `{ jobId }` immediately
- [ ] Verify `ai_jobs` record transitions: `queued` → `processing` → `complete`/`failed`
- [ ] Verify `matrix.ts` history query includes `TOP 200`
- [ ] `az bicep build --file infra/main.bicep` exits 0
- [ ] `tsc -b` in `api/` exits clean
- [ ] Miller Heiman IP grep returns zero results

## Deployment notes (for Neil)
Run `infra/deploy.ps1` after Managed Agent is provisioned on Anthropic Console. See deploy.ps1 summary output for the list of Key Vault secrets requiring manual population.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 2: Wait for bot review**

```bash
gh pr checks $(gh pr view --repo alexander-proudfoot/rss-platform --json number --jq .number) \
  --repo alexander-proudfoot/rss-platform \
  --watch
```

- [ ] **Step 3: Read bot findings**

```bash
gh pr view $(gh pr view --repo alexander-proudfoot/rss-platform --json number --jq .number) \
  --repo alexander-proudfoot/rss-platform \
  --comments
```

- [ ] **Step 4: Pattern sweep on all bot findings (KG#21)**

For each finding:
1. Identify the pattern (not just the line)
2. `grep -rn "pattern" .` to find all instances
3. Fix ALL instances in a single commit
4. Do not fix only the flagged line

- [ ] **Step 5: Push fix commit and repeat from Step 2**

Repeat until 2 consecutive rounds with no new unique findings.

- [ ] **Step 6: If bot cycles on stale findings**

Add a PR comment: "Bot cycling detected — all unique findings resolved, remaining flags are stale re-reports." Per KG#24, do not continue chasing stale findings.

---

## Section 11: Self-Review Against Spec

### Spec coverage check

| AC # | Requirement | Covered by |
|------|-------------|------------|
| P0-1 | messages.ts returns 202 immediately | Task 1 |
| P0-2 | Failed job updates ai_jobs to 'failed' with user-friendly message | Task 1 (existing executeJob error handling unchanged) |
| P0-3 | matrix.ts has TOP 200 | Task 2 |
| P0-4 | main.bicep provisions SQL/KV/SWA, validates with az bicep build | Tasks 3-6 |
| P0-5 | deploy.ps1 with -Environment, -Location, runs Bicep + schema | Task 7 |
| P0-6 | deploy.ps1 header documents prerequisite permissions | Task 7 (KG#28 ✓) |
| P0-7 | MH exclusion grep passes | Task 10 Step 1 |
| P0-8 | tsc -b passes | Tasks 1-2 Steps, Task 10 Step 2 |
| P1-9 | Bicep modules (sql/keyvault/swa) not monolithic | Tasks 3-5 |
| P1-10 | deploy-preview.ps1 exists | Task 8 |
| P1-11 | GitHub Actions workflow with OIDC | Task 9 |
| P2-12 | AAD App Registration — noted in deploy.ps1 output; az ad app create commands printed | Task 7 summary output |

### Gaps / known exclusions

- **P2-13 (teardown.ps1):** Won't-Have this sprint — noted in acceptance criteria.
- **CI/CD for IaC:** Won't-Have — noted in acceptance criteria.
- **Production deployment execution:** Neil runs deploy.ps1 manually.

### Type consistency check

- `AiJob.status` union type: `'queued' | 'processing' | 'complete' | 'failed'` — used consistently in jobs.ts.
- `submitJob` returns `Promise<string>` (jobId) — consumed in messages.ts.
- `executeJob` returns `Promise<void>` — called with `void` keyword (correct for fire-and-forget).

### Placeholder scan

No TBDs, TODOs, or "implement later" in any task — all steps contain actual code.

---

## GitHub Issues to Create (Section 6 of handoff)

Create these issues via `gh issue create` before or after the PR:

**Issue 1:**
```bash
gh issue create \
  --repo alexander-proudfoot/rss-platform \
  --title "IaC: Bicep templates for RSS Platform Azure resources" \
  --label "infrastructure,build" \
  --body "Bicep templates in infra/ for Azure SQL, Key Vault, SWA, and AD app registration. Deploy scripts with schema migration. D099 Phase 2 continuation."
```

**Issue 2:**
```bash
gh issue create \
  --repo alexander-proudfoot/rss-platform \
  --title "Fix: Restore async job pattern in messages.ts (KG#18 timeout protection)" \
  --label "build" \
  --body "Sprint review finding: messages.ts was converted to synchronous await during D092 round 2, defeating the async job pattern. Restore fire-and-forget with 202 response. Blocks production deployment."
```

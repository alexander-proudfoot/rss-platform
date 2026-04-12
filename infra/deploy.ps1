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
  SQL Server administrator password (SecureString). If -NonInteractive is not set and this
  parameter is omitted, the script prompts interactively.

.PARAMETER ResourceGroup
  Azure resource group. Default: 'pft-rss-{Environment}-rg'.

.PARAMETER SkipSchemaMigration
  Switch: skip the sqlcmd schema migration step (e.g., if already run).

.PARAMETER NonInteractive
  Switch: auto-generate a cryptographically secure SQL admin password.
  When set, no interactive prompt is issued. Intended for CI/CD use.
  When not set and -SqlAdminPassword is omitted, prompts interactively.

.REQUIRES
  - Azure CLI (az) authenticated via: az login
  - Contributor role on the target resource group
  - Key Vault Secrets Officer on the provisioned Key Vault (assigned by Bicep to the deployer)
  - sqlcmd installed (https://aka.ms/sqlcmdinstall) for schema migration
  - pwsh (PowerShell 7) — do NOT run with powershell.exe 5.1
  - GitHub admin / branch-protection bypass on alexander-proudfoot/rss-platform (for audit log push)
  - (CI only) AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_TENANT_ID env vars set for SP auth

.NOTES
  Output is logged to Audit/logs/deploy-{timestamp}.log, then committed and pushed to the repo.
  Secrets (passwords, connection strings, SWA token) are never written to the log.
  Security: when using AZURE_CLIENT_SECRET for SP auth, the secret is passed as a
  process-level command-line argument to az login. This is visible in the process list
  for the duration of the login call. Use OIDC federated credentials (the default for
  GitHub Actions via azure-swa-deploy.yml) in shared or untrusted environments.
  Directive: D099
#>
param(
  [ValidateSet('prod', 'preview')]
  [string]$Environment = 'prod',

  [ValidatePattern('^[a-z0-9]+$')]
  [string]$Location = 'uksouth',

  [Parameter(Mandatory)]
  [ValidatePattern('^[a-zA-Z][a-zA-Z0-9\-_]{0,127}$')]
  [string]$SqlAdminLogin,

  [SecureString]$SqlAdminPassword,

  [ValidatePattern('^[a-zA-Z0-9\-_\.]+$')]
  [string]$ResourceGroup = '',

  [switch]$SkipSchemaMigration,

  [switch]$NonInteractive
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# Resolve resource group default
if ([string]::IsNullOrEmpty($ResourceGroup)) {
  $ResourceGroup = "pft-rss-$Environment-rg"
}

# ── 0. Optional service-principal login (CI) ─────────────────────────────────
# Runs before Start-Transcript so SP credentials are not captured in the audit log.
if ($env:AZURE_CLIENT_ID -and $env:AZURE_CLIENT_SECRET -and $env:AZURE_TENANT_ID) {
  Write-Host "=== Step 0: Service-principal login ==="
  az login --service-principal `
    --username $env:AZURE_CLIENT_ID `
    --password $env:AZURE_CLIENT_SECRET `
    --tenant $env:AZURE_TENANT_ID `
    --output none
  if ($LASTEXITCODE -ne 0) { throw "az login --service-principal failed (exit $LASTEXITCODE)" }
  Write-Host "SP login OK."
}

# ── Resolve SQL admin password ────────────────────────────────────────────────
# Runs before Start-Transcript so the generated password is never captured in the audit log.
if ($NonInteractive) {
  # Auto-generate a cryptographically secure 64-character password.
  # Character classes: uppercase, lowercase, digit, special — all guaranteed present.
  $charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()-_=+'
  $bytes   = [System.Security.Cryptography.RandomNumberGenerator]::GetBytes(64)  # static; returns new byte[64]
  # Map each byte to a charset character (76-char charset; 256 % 76 = 28 → bias < 1 bit for 64-char password)
  $pwChars = [char[]]($bytes | ForEach-Object { $charset[$_ % $charset.Length] })
  # Guarantee at least one of each character class in positions 0-3
  $pwChars[0] = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[[System.Security.Cryptography.RandomNumberGenerator]::GetInt32(26)]
  $pwChars[1] = 'abcdefghijklmnopqrstuvwxyz'[[System.Security.Cryptography.RandomNumberGenerator]::GetInt32(26)]
  $pwChars[2] = '0123456789'[[System.Security.Cryptography.RandomNumberGenerator]::GetInt32(10)]
  $pwChars[3] = '!@#$%^&*()-_=+'[[System.Security.Cryptography.RandomNumberGenerator]::GetInt32(14)]
  # Fisher-Yates shuffle using cryptographic random
  for ($i = $pwChars.Count - 1; $i -gt 0; $i--) {
    $j = [System.Security.Cryptography.RandomNumberGenerator]::GetInt32($i + 1)
    $tmp = $pwChars[$i]; $pwChars[$i] = $pwChars[$j]; $pwChars[$j] = $tmp
  }
  $SqlAdminPassword = ConvertTo-SecureString (-join $pwChars) -AsPlainText -Force
  Remove-Variable pwChars, bytes -ErrorAction SilentlyContinue
} elseif (-not $SqlAdminPassword) {
  $SqlAdminPassword = Read-Host -AsSecureString 'SQL Admin Password'
}
# Validate: Read-Host can return a zero-length SecureString in non-interactive contexts.
$_pwCheck = [System.Net.NetworkCredential]::new('', $SqlAdminPassword)
if ([string]::IsNullOrEmpty($_pwCheck.Password)) {
  throw "SQL admin password is empty. Supply -SqlAdminPassword or use -NonInteractive for auto-generation."
}
Remove-Variable _pwCheck

# Script logging — per CLAUDE.md script logging protocol
# Secrets (passwords, connection strings, SWA token) are kept out of transcript
# by using temp params files, env vars, and stdin piping rather than CLI args.
$ScriptDir  = $PSScriptRoot
$RepoRoot   = Resolve-Path (Join-Path $ScriptDir '..')
$LogDir     = Join-Path $RepoRoot 'Audit' 'logs'
if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir | Out-Null }
$Timestamp  = Get-Date -Format 'yyyyMMdd-HHmmss'
$LogFile    = Join-Path $LogDir "deploy-$Timestamp.log"
$TempParamsFile = $null   # Initialised to $null; assigned inside try so finally guard is always valid
Start-Transcript -Path $LogFile

try {
  $TempParamsFile = [System.IO.Path]::GetTempFileName()
  # ── 1. Verify Azure CLI login ────────────────────────────────────────────────
  Write-Host "`n=== Step 1: Verify Azure CLI login ==="
  $accountJson = az account show --output json 2>$null
  if ($LASTEXITCODE -ne 0) {
    throw "Not logged in to Azure CLI (exit $LASTEXITCODE). Run: az login (or set SP env vars for CI)."
  }
  $account = $accountJson | ConvertFrom-Json
  if (-not $account) {
    throw "Azure CLI returned empty account response. Run: az login"
  }
  Write-Host "Logged in as:    $($account.user.name)"
  Write-Host "Subscription:    $($account.name) ($($account.id))"

  # ── 2. Resolve deployer object ID for Key Vault RBAC ────────────────────────
  Write-Host "`n=== Step 2: Resolve deployer object ID ==="
  if ($env:AZURE_CLIENT_ID) {
    # Logged in as service principal — resolve SP object ID by app (client) ID
    $DeployerObjectId = az ad sp show --id $env:AZURE_CLIENT_ID --query id -o tsv
    if ($LASTEXITCODE -ne 0) {
      throw "az ad sp show failed (exit $LASTEXITCODE). Verify AZURE_CLIENT_ID '$($env:AZURE_CLIENT_ID)' is a valid SP app ID and the caller has Application.Read.All permission."
    }
  } else {
    $DeployerObjectId = az ad signed-in-user show --query id -o tsv
    if ($LASTEXITCODE -ne 0) {
      throw "az ad signed-in-user show failed (exit $LASTEXITCODE). Verify az login succeeded and the account has User.Read."
    }
  }
  if ([string]::IsNullOrWhiteSpace($DeployerObjectId)) {
    throw "Deployer object ID resolved to empty string — KV RBAC role assignment will fail. Re-run: az ad sp show --id '$($env:AZURE_CLIENT_ID)' --query id -o tsv"
  }
  Write-Host "Deployer OID:    $DeployerObjectId"

  # ── 3. Write Bicep parameters to a temp file (keeps password out of CLI args / transcript) ──
  Write-Host "`n=== Step 3: Prepare deployment parameters ==="
  $SqlPasswordPlain = [System.Net.NetworkCredential]::new('', $SqlAdminPassword).Password
  $paramsJson = @{
    '$schema'      = 'https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#'
    contentVersion = '1.0.0.0'
    parameters     = @{
      environment       = @{ value = $Environment }
      location          = @{ value = $Location }
      sqlAdminLogin     = @{ value = $SqlAdminLogin }
      sqlAdminPassword  = @{ value = $SqlPasswordPlain }
      deployerObjectId  = @{ value = $DeployerObjectId }
    }
  } | ConvertTo-Json -Depth 5
  Set-Content -Path $TempParamsFile -Value $paramsJson -Encoding UTF8
  Write-Host "Parameters written to temp file (not logged)."
  # Clear all in-memory variables that held the plain-text password.
  Remove-Variable SqlPasswordPlain, paramsJson

  # ── 4. Ensure resource group exists ─────────────────────────────────────────
  Write-Host "`n=== Step 4: Ensure resource group '$ResourceGroup' ==="
  az group create `
    --name $ResourceGroup `
    --location $Location `
    --tags "project=rss-platform" "directive=D099" "environment=$Environment" `
    --output none
  if ($LASTEXITCODE -ne 0) {
    throw "az group create failed (exit $LASTEXITCODE). Verify Contributor access on subscription '$($account.id)'."
  }
  Write-Host "Resource group ready."

  # ── 5. Deploy Bicep template ─────────────────────────────────────────────────
  Write-Host "`n=== Step 5: Deploy Bicep template ==="
  $DeploymentName = "rss-$Environment-$Timestamp"
  $BicepFile      = Join-Path $ScriptDir 'main.bicep'

  $DeployOutput = az deployment group create `
    --name $DeploymentName `
    --resource-group $ResourceGroup `
    --template-file $BicepFile `
    --parameters "@$TempParamsFile" `
    --output json | ConvertFrom-Json

  if ($LASTEXITCODE -ne 0) {
    throw "Bicep deployment failed (exit $LASTEXITCODE). Check the deployment output above for ARM error details."
  }

  $SqlServerFqdn = $DeployOutput.properties.outputs.sqlServerFqdn.value
  $DatabaseName  = $DeployOutput.properties.outputs.databaseName.value
  $KvName        = $DeployOutput.properties.outputs.keyVaultName.value
  $KvUri         = $DeployOutput.properties.outputs.keyVaultUri.value
  $SwaHostname   = $DeployOutput.properties.outputs.swaDefaultHostname.value

  Write-Host "SQL FQDN:        $SqlServerFqdn"
  Write-Host "Database:        $DatabaseName"
  Write-Host "Key Vault:       $KvUri"
  Write-Host "SWA Hostname:    $SwaHostname"

  # ── 6. Write SQL connection string to Key Vault via temp file ───────────────
  # az keyvault secret set --file reads the secret value from a file.
  # Using a temp file keeps the connection string out of CLI args and transcript.
  Write-Host "`n=== Step 6: Write SQL-CONNECTION-STRING to Key Vault ==="
  $paramsObj    = Get-Content $TempParamsFile | ConvertFrom-Json
  $Login        = $paramsObj.parameters.sqlAdminLogin.value
  $Password     = $paramsObj.parameters.sqlAdminPassword.value
  # Use SqlConnectionStringBuilder (indexer form) to safely handle special characters.
  # Raw string interpolation would allow passwords containing ';' to inject extra key=value pairs.
  # Note: property-based access (e.g. .DataSource) is unsupported in System.Data.SqlClient
  # on .NET 7 — use string-keyed indexer form which works correctly.
  $builder = [System.Data.SqlClient.SqlConnectionStringBuilder]::new()
  $builder['Data Source']           = "tcp:$SqlServerFqdn,1433"
  $builder['Initial Catalog']       = $DatabaseName
  $builder['User ID']               = $Login
  $builder['Password']              = $Password
  $builder['Encrypt']               = $true
  $builder['TrustServerCertificate'] = $false
  $builder['Connect Timeout']       = 30
  $ConnStr = $builder.ConnectionString
  $builder['Password'] = ''  # clear password from builder before releasing the reference
  Remove-Variable builder
  $ConnStrFile  = [System.IO.Path]::GetTempFileName()
  try {
    Set-Content -Path $ConnStrFile -Value $ConnStr -NoNewline -Encoding UTF8
    az keyvault secret set `
      --vault-name $KvName `
      --name 'SQL-CONNECTION-STRING' `
      --file $ConnStrFile `
      --output none
    # az CLI exit codes are not promoted by $ErrorActionPreference = Stop — check explicitly.
    if ($LASTEXITCODE -ne 0) { throw "az keyvault secret set failed (exit $LASTEXITCODE). Verify Key Vault Secrets Officer role on '$KvName'." }
  } finally {
    # Clear sensitive variables in finally so they are removed even if Set-Content throws.
    Remove-Variable ConnStr, Password -ErrorAction SilentlyContinue
    Remove-Item $ConnStrFile -Force -ErrorAction SilentlyContinue
  }
  Write-Host "SQL-CONNECTION-STRING written."

  # ── 7. Schema migration ──────────────────────────────────────────────────────
  if (-not $SkipSchemaMigration) {
    Write-Host "`n=== Step 7: Schema migration ==="

    if (-not (Get-Command sqlcmd -ErrorAction SilentlyContinue)) {
      Write-Warning "sqlcmd not found — schema migration skipped."
      Write-Warning "Install sqlcmd: https://aka.ms/sqlcmdinstall"
      Write-Warning "Then run manually (set SQLCMDPASSWORD env var, do not use -P flag):"
      Write-Warning "  `$env:SQLCMDPASSWORD = '<password>'"
      Write-Warning "  sqlcmd -S $SqlServerFqdn -d $DatabaseName -U $Login -i database/001-initial-schema.sql -b"
    } else {
      # Resolve schema file path before touching the firewall
      $SchemaFile = Join-Path $RepoRoot 'database' '001-initial-schema.sql'
      if (-not (Test-Path $SchemaFile)) {
        throw "Schema file not found: $SchemaFile. Verify database/001-initial-schema.sql exists in the repo root."
      }

      # Temporarily open deployer IP in SQL firewall for schema migration
      Write-Host "Resolving deployer public IP..."
      $DeployerIp = (Invoke-RestMethod -Uri 'https://api.ipify.org?format=json').ip
      $SqlServerShortName = $SqlServerFqdn.Split('.')[0]
      Write-Host "Adding $DeployerIp to SQL firewall (temporary)..."
      az sql server firewall-rule create `
        --server $SqlServerShortName `
        --resource-group $ResourceGroup `
        --name 'DeployerTemp' `
        --start-ip-address $DeployerIp `
        --end-ip-address $DeployerIp `
        --output none
      if ($LASTEXITCODE -ne 0) {
        throw "az sql server firewall-rule create failed (exit $LASTEXITCODE). Verify Contributor access on SQL Server '$SqlServerShortName'."
      }

      try {
        # Use SQLCMDPASSWORD env var — keeps password out of process args and transcript
        $env:SQLCMDPASSWORD = $paramsObj.parameters.sqlAdminPassword.value
        Write-Host "Running schema migration: $SchemaFile"
        sqlcmd -S $SqlServerFqdn -d $DatabaseName -U $Login -i $SchemaFile -b
        if ($LASTEXITCODE -ne 0) {
          throw "Schema migration failed (sqlcmd exit $LASTEXITCODE). Review sqlcmd output above for SQL errors."
        } else {
          Write-Host "Schema migration complete."
        }
      } finally {
        # Clear env var and in-memory params object that contains the plain-text password.
        # SetEnvironmentVariable($null) removes the variable from the process block entirely;
        # $env:SQLCMDPASSWORD = $null only sets it to an empty string.
        [System.Environment]::SetEnvironmentVariable('SQLCMDPASSWORD', $null)
        Remove-Variable paramsObj -ErrorAction SilentlyContinue
        # Always remove the temporary firewall rule, even on failure
        Write-Host "Removing temporary deployer firewall rule..."
        az sql server firewall-rule delete `
          --server $SqlServerShortName `
          --resource-group $ResourceGroup `
          --name 'DeployerTemp' `
          --yes `
          --output none
        if ($LASTEXITCODE -ne 0) { Write-Warning "Firewall rule 'DeployerTemp' deletion failed (exit $LASTEXITCODE) — remove manually" }
      }
    }
  }
  # Clear paramsObj if it was not already cleared inside step 7's finally block
  # (i.e. when -SkipSchemaMigration was set or sqlcmd was not found).
  Remove-Variable paramsObj -ErrorAction SilentlyContinue

  # ── 8. Note SWA deployment token retrieval command ──────────────────────────
  # The token is NOT retrieved here to avoid it appearing in the audit log.
  # Neil retrieves it post-deploy using the command shown in the summary below.
  $SwaName = "pft-rss-$Environment"
  Write-Host "`n=== Step 8: SWA deployment token ==="
  Write-Host "Token retrieval deferred — see summary below for the command."

  # ── 9. Summary (transcript still running — audit log captures this block) ────
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
  Write-Host "  AZURE_STATIC_WEB_APPS_API_TOKEN:"
  Write-Host "    az staticwebapp secrets list --name $SwaName --resource-group $ResourceGroup --query 'properties.apiKey' -o tsv"
  Write-Host "  AZURE_CLIENT_ID      = (from AAD App Registration)"
  Write-Host "  AZURE_TENANT_ID      = $($account.tenantId)"
  Write-Host "  AZURE_SUBSCRIPTION_ID = $($account.id)"
  Write-Host ""
  Write-Host "AAD App Registration (run manually):"
  Write-Host "  az ad app create --display-name 'rss-platform-$Environment'"
  Write-Host "  # Then create a federated credential for GitHub OIDC."
  Write-Host "  # See: https://learn.microsoft.com/azure/active-directory/workload-identities/workload-identity-federation-create-trust"
  Write-Host "============================================================"
  Write-Host ""
  Write-Host "Log saved to: $LogFile"

} finally {
  # Clear paramsObj if Step 6 threw after assigning it (covers exception paths
  # where the inner finally in Step 6 did not run).
  Remove-Variable paramsObj -ErrorAction SilentlyContinue
  # Clean up temp params file containing the plain-text password
  if (Test-Path $TempParamsFile) {
    Remove-Item $TempParamsFile -Force -ErrorAction SilentlyContinue
  }
  # Stop-Transcript is idempotent — safe to call even if already stopped above
  try { Stop-Transcript } catch { Write-Host "Stop-Transcript skipped: $_" }
  # Commit the audit log to the repo — per CLAUDE.md Script Logging protocol.
  # Requires branch protection bypass (deployer must have admin access to push main directly).
  $LogRelPath = "Audit/logs/deploy-$Timestamp.log"
  try {
    git -C $RepoRoot add $LogRelPath
    git -C $RepoRoot commit -m "Log: D099 $Environment deployment $Timestamp"
    git -C $RepoRoot push
    Write-Host "Audit log committed: $LogRelPath"
  } catch {
    Write-Warning "Audit log push failed (admin branch bypass required): $_"
    Write-Warning "Push manually: git add '$LogRelPath' && git commit -m 'Log: D099 $Environment deployment $Timestamp' && git push"
  }
}

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

.PARAMETER SkipSchemaMigration
  Switch: skip the sqlcmd schema migration step (e.g., if already run).

.REQUIRES
  - Azure CLI (az) authenticated via: az login
  - Contributor role on the target resource group
  - Key Vault Secrets Officer on the provisioned Key Vault (assigned by Bicep to the deployer)
  - sqlcmd installed (https://aka.ms/sqlcmdinstall) for schema migration
  - pwsh (PowerShell 7) — do NOT run with powershell.exe 5.1

.NOTES
  Output is logged to Audit/logs/deploy-{timestamp}.log and committed to the repo.
  Secrets (passwords, connection strings, SWA token) are never written to the log.
  Directive: D099
#>
param(
  [ValidateSet('prod', 'preview')]
  [string]$Environment = 'prod',

  [ValidatePattern('^[a-zA-Z0-9\-]+$')]
  [string]$Location = 'uksouth',

  [Parameter(Mandatory)]
  [ValidatePattern('^[a-zA-Z][a-zA-Z0-9\-_]{0,127}$')]
  [string]$SqlAdminLogin,

  [Parameter(Mandatory)]
  [SecureString]$SqlAdminPassword,

  [ValidatePattern('^[a-zA-Z0-9\-_\.]+$')]
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
# Secrets (passwords, connection strings, SWA token) are kept out of transcript
# by using temp params files, env vars, and stdin piping rather than CLI args.
$ScriptDir  = $PSScriptRoot
$RepoRoot   = Resolve-Path (Join-Path $ScriptDir '..')
$LogDir     = Join-Path $RepoRoot 'Audit' 'logs'
if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir | Out-Null }
$Timestamp  = Get-Date -Format 'yyyyMMdd-HHmmss'
$LogFile    = Join-Path $LogDir "deploy-$Timestamp.log"
$TempParamsFile = [System.IO.Path]::GetTempFileName()
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

  # ── 2. Resolve deployer object ID for Key Vault RBAC ────────────────────────
  Write-Host "`n=== Step 2: Resolve deployer object ID ==="
  $DeployerObjectId = az ad signed-in-user show --query id -o tsv
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
  # Password plain-text is only needed in the temp file now; clear the variable.
  Remove-Variable SqlPasswordPlain

  # ── 4. Ensure resource group exists ─────────────────────────────────────────
  Write-Host "`n=== Step 4: Ensure resource group '$ResourceGroup' ==="
  az group create `
    --name $ResourceGroup `
    --location $Location `
    --tags "project=rss-platform" "directive=D099" "environment=$Environment" `
    --output none
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
    Write-Error "Bicep deployment failed (exit $LASTEXITCODE)"
    exit 1
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
  # az keyvault secret set supports --value @filepath to read from a file.
  # Using a temp file keeps the connection string out of CLI args and transcript.
  Write-Host "`n=== Step 6: Write SQL-CONNECTION-STRING to Key Vault ==="
  $paramsObj    = Get-Content $TempParamsFile | ConvertFrom-Json
  $Login        = $paramsObj.parameters.sqlAdminLogin.value
  $Password     = $paramsObj.parameters.sqlAdminPassword.value
  $ConnStr      = "Server=tcp:$SqlServerFqdn,1433;Database=$DatabaseName;" +
                  "User Id=$Login;Password=$Password;" +
                  "Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;"
  $ConnStrFile  = [System.IO.Path]::GetTempFileName()
  try {
    Set-Content -Path $ConnStrFile -Value $ConnStr -NoNewline -Encoding UTF8
    Remove-Variable ConnStr, Password
    az keyvault secret set `
      --vault-name $KvName `
      --name 'SQL-CONNECTION-STRING' `
      --file $ConnStrFile `
      --output none
  } finally {
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
        Write-Error "Schema file not found: $SchemaFile"
        exit 1
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

      try {
        # Use SQLCMDPASSWORD env var — keeps password out of process args and transcript
        $env:SQLCMDPASSWORD = $paramsObj.parameters.sqlAdminPassword.value
        Write-Host "Running schema migration: $SchemaFile"
        sqlcmd -S $SqlServerFqdn -d $DatabaseName -U $Login -i $SchemaFile -b
        if ($LASTEXITCODE -ne 0) {
          Write-Error "Schema migration failed (sqlcmd exit $LASTEXITCODE)"
        } else {
          Write-Host "Schema migration complete."
        }
      } finally {
        # Clear env var and in-memory params object that contains the plain-text password
        $env:SQLCMDPASSWORD = $null
        Remove-Variable paramsObj -ErrorAction SilentlyContinue
        # Always remove the temporary firewall rule, even on failure
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
  # Clean up temp params file containing the plain-text password
  if (Test-Path $TempParamsFile) {
    Remove-Item $TempParamsFile -Force
  }
  # Stop-Transcript is idempotent — safe to call even if already stopped above
  try { Stop-Transcript } catch { }
}

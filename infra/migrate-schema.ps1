<#
.SYNOPSIS
  Applies the initial database schema to the RSS Platform Azure SQL database.

.DESCRIPTION
  Reads the SQL admin connection string from Key Vault, then runs
  database/001-initial-schema.sql via sqlcmd. Idempotency: objects are created
  with IF NOT EXISTS guards where SQL Server supports it; re-running against a
  database that already has the schema will fail on duplicate objects — run
  once only, or wrap individual statements in IF NOT EXISTS before re-running.

.PARAMETER Environment
  Target environment: 'prod' or 'preview'. Default: 'prod'.

.PARAMETER ResourceGroup
  Azure resource group. Default: 'pft-rss-{Environment}-rg'.

.PARAMETER KvName
  Key Vault name. Default: 'pft-kv-rss-{Environment}'.

.REQUIRES
  - Azure CLI (az) authenticated (interactive or service principal)
  - Reader on Key Vault secrets
  - sqlcmd (Go edition v1.x — https://aka.ms/sqlcmdinstall)
  - Network access to the Azure SQL server (firewall rule for the caller's IP)
  - pwsh (PowerShell 7) — do NOT run with powershell.exe 5.1

.NOTES
  Directive: D099
  The SQL admin password is passed via the SQLCMDPASSWORD environment variable
  (not as a command-line argument) to avoid process-list exposure.
  Secret values are never written to the audit log.
#>
param(
  [ValidateSet('prod', 'preview')]
  [string]$Environment = 'prod',

  [string]$ResourceGroup = '',

  [string]$KvName = ''
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# Resolve defaults
if ([string]::IsNullOrEmpty($ResourceGroup)) { $ResourceGroup = "pft-rss-$Environment-rg" }
if ([string]::IsNullOrEmpty($KvName))        { $KvName = "pft-kv-rss-$Environment" }

# Script logging
$ScriptDir = $PSScriptRoot
$RepoRoot  = Resolve-Path (Join-Path $ScriptDir '..')
$LogDir    = Join-Path $RepoRoot 'Audit' 'logs'
if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir | Out-Null }
$Timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$LogFile   = Join-Path $LogDir "migrate-schema-$Timestamp.log"
Start-Transcript -Path $LogFile

try {
  Write-Host "=== RSS Platform Schema Migration ==="
  Write-Host "Environment:    $Environment"
  Write-Host "Resource Group: $ResourceGroup"
  Write-Host "Key Vault:      $KvName"

  # ── 1. Read SQL connection string from Key Vault ─────────────────────────────
  Write-Host "`n=== Step 1: Reading SQL-CONNECTION-STRING from Key Vault '$KvName' ==="
  $connStr = az keyvault secret show `
    --vault-name $KvName `
    --name SQL-CONNECTION-STRING `
    --query value `
    --output tsv 2>$null
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to read SQL-CONNECTION-STRING from Key Vault '$KvName' (exit $LASTEXITCODE). Verify the secret exists and the caller has Key Vault Secrets Reader role."
  }
  if ([string]::IsNullOrWhiteSpace($connStr)) {
    throw "SQL-CONNECTION-STRING is empty in Key Vault '$KvName'. Populate the secret and re-run."
  }
  Write-Host "Connection string read OK."

  # ── 2. Parse connection string ───────────────────────────────────────────────
  Write-Host "`n=== Step 2: Parsing connection string ==="
  $builder = [System.Data.SqlClient.SqlConnectionStringBuilder]::new($connStr)
  $server   = $builder['Data Source'] -replace '^tcp:', ''       # strip tcp: prefix
  $database = $builder['Initial Catalog']
  $userId   = $builder['User ID']
  $password = $builder['Password']

  # Remove secret from builder and connection string var immediately
  $builder.Clear()
  Remove-Variable connStr -ErrorAction SilentlyContinue

  if ([string]::IsNullOrEmpty($server) -or [string]::IsNullOrEmpty($database) -or
      [string]::IsNullOrEmpty($userId) -or [string]::IsNullOrEmpty($password)) {
    throw "Failed to parse required fields (Data Source, Initial Catalog, User ID, Password) from connection string."
  }

  Write-Host "Server:   $server"
  Write-Host "Database: $database"
  Write-Host "User:     $userId"
  Write-Host "Password: [redacted]"

  # ── 3. Locate schema file ────────────────────────────────────────────────────
  Write-Host "`n=== Step 3: Locating schema file ==="
  $SchemaFile = Join-Path $RepoRoot 'database' '001-initial-schema.sql'
  if (-not (Test-Path $SchemaFile)) {
    throw "Schema file not found: $SchemaFile"
  }
  Write-Host "Schema file: $SchemaFile"

  # ── 4. Run sqlcmd ────────────────────────────────────────────────────────────
  # Password delivered via SQLCMDPASSWORD env var to avoid command-line exposure.
  Write-Host "`n=== Step 4: Running sqlcmd ==="
  [System.Environment]::SetEnvironmentVariable('SQLCMDPASSWORD', $password)
  Remove-Variable password -ErrorAction SilentlyContinue

  try {
    sqlcmd -S $server -d $database -U $userId `
           -i $SchemaFile `
           -b `
           -v ErrorLevel=1 2>&1
    if ($LASTEXITCODE -ne 0) {
      throw "sqlcmd exited with code $LASTEXITCODE. Check output above for SQL errors."
    }
  } finally {
    [System.Environment]::SetEnvironmentVariable('SQLCMDPASSWORD', $null)
  }

  Write-Host ""
  Write-Host "============================================================"
  Write-Host "SCHEMA MIGRATION COMPLETE — $Environment"
  Write-Host "============================================================"
  Write-Host "Log: $LogFile"

} finally {
  try { Stop-Transcript } catch { Write-Host "Stop-Transcript skipped: $_" }
  $LogRelPath = "Audit/logs/migrate-schema-$Timestamp.log"
  try {
    git -C $RepoRoot add $LogRelPath
    git -C $RepoRoot commit -m "Log: D099 schema migration $Environment $Timestamp"
    git -C $RepoRoot push
    Write-Host "Audit log committed: $LogRelPath"
  } catch {
    Write-Warning "Audit log push failed: $_"
    Write-Warning "Push manually: git add '$LogRelPath' && git commit && git push"
  }
}

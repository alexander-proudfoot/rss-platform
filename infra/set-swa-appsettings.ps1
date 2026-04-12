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
  - Reader on Key Vault secrets (to read secret values)
  - Contributor on the SWA resource (to set app settings)
  - pwsh (PowerShell 7) — do NOT run with powershell.exe 5.1
  - (CI only) AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_TENANT_ID env vars set for SP auth

.NOTES
  Output is logged to Audit/logs/set-swa-appsettings-{timestamp}.log, then
  committed and pushed to the repo. Secret values are never written to the log.
  Security: (1) when using AZURE_CLIENT_SECRET for SP auth, the secret is passed as
  a process argument to az login — visible in the process list for the login call.
  (2) az staticwebapp appsettings set passes all secret values as process arguments
  (no file/stdin alternative exists in the CLI). Both exposures are limited to the
  duration of each CLI call. Only run this script on isolated single-user agents.
  Use OIDC federated credentials (GitHub Actions default) to eliminate exposure (1).
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

$appSettings = $null   # Declared outside try so finally can safely test it under StrictMode

try {
  Write-Host "=== RSS Platform SWA App Settings Delivery ==="
  Write-Host "Environment:    $Environment"
  Write-Host "Resource Group: $ResourceGroup"
  Write-Host "Key Vault:      $KvName"
  Write-Host "SWA:            $SwaName"

  # Secret map: SWA setting name => Key Vault secret name
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
    if ($LASTEXITCODE -ne 0) {
      Write-Warning "  NOT FOUND: $kvSecretName could not be read from Key Vault '$KvName' (exit $LASTEXITCODE) — skipping '$settingName'. Verify the secret exists and the caller has Key Vault Secrets Reader role."
      $missing.Add($kvSecretName)
    } elseif ([string]::IsNullOrWhiteSpace($secretValue)) {
      Write-Warning "  EMPTY: $kvSecretName exists in Key Vault '$KvName' but has an empty value — skipping '$settingName'. Populate the secret and re-run."
      $missing.Add($kvSecretName)
    } else {
      $appSettings[$settingName] = $secretValue
      Write-Host "  OK:      $kvSecretName -> $settingName"
    }
    # Clear secret value from variable immediately after storing in hashtable
    Remove-Variable secretValue -ErrorAction SilentlyContinue
  }

  if ($appSettings.Count -eq 0) {
    throw "No secrets found in Key Vault '$KvName'. Cannot configure SWA. Verify KV name and that the caller has Key Vault Secrets Reader role."
  }

  # ── 2. Set app settings on SWA ──────────────────────────────────────────────
  # az staticwebapp appsettings set accepts --setting-names KEY=VALUE KEY=VALUE ...
  # Security note: secret values appear as process-level command-line arguments for the
  # duration of the az call. They are visible in the OS process list (ps/Task Manager)
  # on multi-user systems. This is a known limitation of the az staticwebapp CLI surface
  # (no --file or --stdin equivalent). Only run this script on isolated single-user agents.
  Write-Host "`n=== Step 2: Setting $($appSettings.Count) app setting(s) on SWA '$SwaName' ==="
  $settingArgs = @($appSettings.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" })
  az staticwebapp appsettings set `
    --name $SwaName `
    --resource-group $ResourceGroup `
    --setting-names @settingArgs `
    --output none
  if ($LASTEXITCODE -ne 0) {
    throw "az staticwebapp appsettings set failed (exit $LASTEXITCODE). Verify Contributor role on SWA '$SwaName' in resource group '$ResourceGroup'."
  }
  # Clear in-memory settings so secret values don't linger
  $appSettings.Clear()
  Write-Host "App settings set OK."

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
  # Clear settings hashtable if it wasn't cleared in the try block (covers exception paths)
  if ($null -ne $appSettings) { $appSettings.Clear() }
  try { Stop-Transcript } catch { Write-Host "Stop-Transcript skipped: $_" }
  # Commit audit log per CLAUDE.md script logging protocol
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

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
  SQL Server administrator password (SecureString). If -NonInteractive is not set and this
  parameter is omitted, deploy.ps1 prompts interactively.

.PARAMETER ResourceGroup
  Azure resource group. Default: 'pft-rss-preview-rg'.

.PARAMETER SkipSchemaMigration
  Switch: skip the sqlcmd schema migration step.

.PARAMETER NonInteractive
  Switch: auto-generate a cryptographically secure SQL admin password.
  When set, no interactive prompt is issued. Intended for CI/CD use.
  Passed through to deploy.ps1.

.REQUIRES
  - Azure CLI (az) authenticated via: az login
  - Contributor role on the target resource group
  - Key Vault Secrets Officer on the provisioned Key Vault (assigned by Bicep to the deployer)
  - sqlcmd installed (https://aka.ms/sqlcmdinstall) for schema migration
  - pwsh (PowerShell 7) — do NOT run with powershell.exe 5.1
  - (CI only) AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_TENANT_ID env vars set for SP auth

.NOTES
  Directive: D099
#>
param(
  [string]$Location = 'uksouth',

  [Parameter(Mandatory)]
  [string]$SqlAdminLogin,

  [SecureString]$SqlAdminPassword,

  [string]$ResourceGroup = 'pft-rss-preview-rg',

  [switch]$SkipSchemaMigration,

  [switch]$NonInteractive
)

$ErrorActionPreference = 'Stop'

$deployScript = Join-Path $PSScriptRoot 'deploy.ps1'

$params = @{
  Environment   = 'preview'
  Location      = $Location
  SqlAdminLogin = $SqlAdminLogin
  ResourceGroup = $ResourceGroup
}
if ($SqlAdminPassword)    { $params['SqlAdminPassword']    = $SqlAdminPassword }
if ($SkipSchemaMigration) { $params['SkipSchemaMigration'] = [switch]$true }
if ($NonInteractive)      { $params['NonInteractive']      = [switch]$true }

& $deployScript @params

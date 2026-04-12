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
  SQL Server administrator password (SecureString — prompted if not supplied).

.PARAMETER ResourceGroup
  Azure resource group. Default: 'pft-rss-preview-rg'.

.PARAMETER SkipSchemaMigration
  Switch: skip the sqlcmd schema migration step.

.REQUIRES
  - Azure CLI (az) authenticated via: az login
  - Contributor role on the target resource group
  - Key Vault Secrets Officer on the provisioned Key Vault (assigned by Bicep to the deployer)
  - sqlcmd installed (https://aka.ms/sqlcmdinstall) for schema migration
  - pwsh (PowerShell 7) — do NOT run with powershell.exe 5.1

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

$params = @{
  Environment      = 'preview'
  Location         = $Location
  SqlAdminLogin    = $SqlAdminLogin
  SqlAdminPassword = $SqlAdminPassword
  ResourceGroup    = $ResourceGroup
}
if ($SkipSchemaMigration) { $params['SkipSchemaMigration'] = [switch]$true }

& $deployScript @params

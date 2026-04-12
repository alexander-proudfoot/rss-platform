// infra/main.bicep
// RSS Platform — Main Bicep orchestration template
// Directive: D099
//
// Resources provisioned:
//   - Azure SQL Server + Database  (pft-sql-rss-{env})
//   - Azure Key Vault              (pft-kv-rss-{env})
//   - Azure Static Web App         (pft-rss-{env})
//
// Usage (run from repo root):
//   az deployment group create \
//     --resource-group pft-rss-prod-rg \
//     --template-file infra/main.bicep \
//     --parameters environment=prod \
//                  sqlAdminLogin=rssadmin \
//                  sqlAdminPassword=<secret> \
//                  deployerObjectId=$(az ad signed-in-user show --query id -o tsv)
//
// After deployment, run infra/deploy.ps1 to complete:
//   schema migration, Key Vault secret population, SWA token retrieval.

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

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
// Key Vault Secrets Officer built-in role definition ID
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
    softDeleteRetentionInDays: environment == 'prod' ? 90 : 7
    publicNetworkAccess: 'Enabled'
  }
}

// Grant deployer Key Vault Secrets Officer so deploy.ps1 can write secrets post-deploy
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

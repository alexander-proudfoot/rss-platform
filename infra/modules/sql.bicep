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

resource sqlServer 'Microsoft.Sql/servers@2023-08-01' = {
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

resource sqlDatabase 'Microsoft.Sql/servers/databases@2023-08-01' = {
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

// Allow all Azure-hosted IPs (0.0.0.0/0.0.0.0) so the Functions runtime can reach the database.
// KNOWN LIMITATION: this permits any Azure tenant's workload, not just this subscription.
// Phase 2 scope decision: private endpoint / VNet integration is deferred to Phase 3 hardening.
resource firewallAzureServices 'Microsoft.Sql/servers/firewallRules@2023-08-01' = {
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

// infra/modules/swa.bicep
// RSS Platform — Azure Static Web App (Standard tier)
// Directive: D099
//
// The SWA is created without a repositoryUrl to avoid requiring a GitHub PAT
// at Bicep deploy time. The deployment token is retrieved in deploy.ps1 and
// stored as a GitHub Actions secret for the CI/CD workflow.

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
    buildProperties: {
      skipGithubActionWorkflowGeneration: true
    }
  }
}

output swaName string = swaName
output swaDefaultHostname string = staticWebApp.properties.defaultHostname
output swaId string = staticWebApp.id

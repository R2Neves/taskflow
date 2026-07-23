param(
  [switch]$IAuthorizeSchema
)

$ErrorActionPreference = "Stop"

if (-not $IAuthorizeSchema) {
  throw "Aplicacao de schema bloqueada. Execute com -IAuthorizeSchema apos autorizacao explicita."
}

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $projectRoot
$sqlPath = Join-Path $projectRoot "scripts\lan\apply-checklist-schema.sql"

Write-Host "Aplicando schema Checklist..."
Get-Content $sqlPath -Raw |
  docker exec -i taskflow-postgres psql -U taskflow -d taskflow -v ON_ERROR_STOP=1

Write-Host "Schema Checklist aplicado."

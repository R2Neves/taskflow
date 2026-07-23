$ErrorActionPreference = "Stop"
$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $projectRoot

$sqlFile = Join-Path $PSScriptRoot "apply-team-invites-schema.sql"
if (-not (Test-Path $sqlFile)) {
  throw "Arquivo SQL ausente: $sqlFile"
}

Write-Host "Aplicando schema de convites de equipe..."
Get-Content $sqlFile -Raw | docker exec -i taskflow-postgres psql -U taskflow -d taskflow
Write-Host "Schema de convites aplicado."

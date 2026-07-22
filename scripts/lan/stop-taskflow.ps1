$ErrorActionPreference = "Stop"

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $projectRoot

# Mantém o volume e todos os dados do PostgreSQL.
docker compose down

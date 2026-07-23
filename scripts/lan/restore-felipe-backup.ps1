param(
  [Parameter(Mandatory = $true)]
  [string]$Path,
  [switch]$IAuthorizeRestore
)

# HUMAN / EXPLICIT AUTHORIZATION ONLY.
# This script mutates the central PostgreSQL database.
# The Cursor agent must not run it without the operator passing -IAuthorizeRestore
# after an explicit written authorization.

$ErrorActionPreference = "Stop"

if (-not $IAuthorizeRestore) {
  throw "Restauracao bloqueada. Execute com -IAuthorizeRestore somente apos autorizacao explicita."
}

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $projectRoot

$source = Get-Item (Resolve-Path $Path)
$preparedDir = Join-Path $projectRoot "backups"
New-Item -ItemType Directory -Force -Path $preparedDir | Out-Null
$prepared = Join-Path $preparedDir ("felipe-restore-prepared-{0}.sql" -f (Get-Date -Format "yyyyMMdd-HHmmss"))

# Remove pg_dump 16+ \restrict line and keep the rest intact.
Get-Content $source.FullName |
  Where-Object { $_ -notmatch '^\\restrict\s' } |
  Set-Content -Path $prepared -Encoding utf8

Write-Host "SQL preparado: $prepared"
Write-Host "Parando API e Web..."
docker compose stop api web | Out-Null

Write-Host "Recriando schema public no banco central..."
@"
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO taskflow;
GRANT ALL ON SCHEMA public TO public;
"@ | docker exec -i taskflow-postgres psql -U taskflow -d taskflow -v ON_ERROR_STOP=1

Write-Host "Restaurando backup do Felipe..."
Get-Content $prepared -Raw | docker exec -i taskflow-postgres psql -U taskflow -d taskflow -v ON_ERROR_STOP=1

Write-Host "Reaplicando role readonly..."
Get-Content (Join-Path $projectRoot "docker\postgres\init\01-readonly-role.sql") -Raw |
  docker exec -i taskflow-postgres psql -U taskflow -d taskflow -v ON_ERROR_STOP=1

Write-Host "Subindo API e Web..."
docker compose up -d api web | Out-Null
Start-Sleep -Seconds 8
docker compose ps

Write-Host ""
Write-Host "Validacao somente leitura:"
& (Join-Path $PSScriptRoot "validate-migrated-data.ps1")

$ErrorActionPreference = "Stop"

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $projectRoot

if (-not (Test-Path ".env")) {
  throw "Arquivo .env ausente. Copie .env.example, defina segredos fortes e tente novamente."
}

docker version | Out-Null
docker compose version | Out-Null
docker compose config --quiet
docker compose up -d --build

Write-Host ""
docker compose ps
Write-Host ""
Write-Host "TaskFlow iniciado. Execute scripts\lan\status-taskflow.ps1 para ver o endereco da rede."

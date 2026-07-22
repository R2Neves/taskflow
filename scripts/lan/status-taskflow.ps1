$ErrorActionPreference = "Stop"

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $projectRoot

docker compose ps

$addresses = Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object {
    $_.IPAddress -ne "127.0.0.1" -and
    $_.IPAddress -notlike "169.254.*" -and
    $_.AddressState -eq "Preferred"
  } |
  Select-Object -ExpandProperty IPAddress -Unique

Write-Host ""
foreach ($address in $addresses) {
  Write-Host "Acesso na rede: http://${address}:3080"
}

$health = Invoke-RestMethod -Uri "http://127.0.0.1:3080/api/v1/health" -TimeoutSec 10
Write-Host "API: $($health.status)"

# Requer PowerShell executado como Administrador.
$ErrorActionPreference = "Stop"

$ruleName = "TaskFlow LAN (TCP 3080)"
$existing = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue

if ($existing) {
  Set-NetFirewallRule -DisplayName $ruleName -Enabled True -Profile Private
} else {
  New-NetFirewallRule `
    -DisplayName $ruleName `
    -Direction Inbound `
    -Action Allow `
    -Protocol TCP `
    -LocalPort 3080 `
    -Profile Private | Out-Null
}

# Remove regra antiga da porta 3000, se existir.
$legacy = Get-NetFirewallRule -DisplayName "TaskFlow LAN (TCP 3000)" -ErrorAction SilentlyContinue
if ($legacy) {
  Remove-NetFirewallRule -DisplayName "TaskFlow LAN (TCP 3000)"
}

Write-Host "Firewall configurado: somente TCP 3080 no perfil de rede Privada."

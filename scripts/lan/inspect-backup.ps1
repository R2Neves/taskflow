param(
  [Parameter(Mandatory = $true)]
  [string]$Path
)

$ErrorActionPreference = "Stop"
$file = Get-Item (Resolve-Path $Path)
$hash = Get-FileHash -Algorithm SHA256 $file.FullName
$stream = [System.IO.File]::OpenRead($file.FullName)
$header = New-Object byte[] 5
$null = $stream.Read($header, 0, $header.Length)
$stream.Dispose()
$signature = [System.Text.Encoding]::ASCII.GetString($header)

Write-Host "Arquivo: $($file.FullName)"
Write-Host "Tamanho: $($file.Length) bytes"
Write-Host "SHA-256: $($hash.Hash)"

if ($signature -eq "PGDMP") {
  Write-Host "Formato: PostgreSQL custom archive"
  $directory = $file.DirectoryName
  docker run --rm `
    --volume "${directory}:/backup:ro" `
    postgres:16-alpine `
    pg_restore --list "/backup/$($file.Name)"
} else {
  $firstLine = Get-Content -Path $file.FullName -TotalCount 1
  if ($firstLine -match "PostgreSQL database dump") {
    Write-Host "Formato: PostgreSQL SQL text"
  } else {
    throw "O arquivo não foi reconhecido como backup PostgreSQL."
  }
}

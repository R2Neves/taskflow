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
  $sample = Get-Content -Path $file.FullName -TotalCount 20 | Out-String
  if ($sample -match "PostgreSQL database dump" -or $sample -match 'COPY public\.') {
    Write-Host "Formato: PostgreSQL SQL text"
    if ($sample -match "\\restrict") {
      Write-Host "Aviso: dump contem \\restrict (pg_dump 16+). Remova essa linha antes de restaurar."
    }
  } else {
    throw "O arquivo nao foi reconhecido como backup PostgreSQL."
  }
}

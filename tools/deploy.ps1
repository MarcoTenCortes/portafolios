# Despliegue: construye con Vite y sube dist/ al servidor por scp.
# Uso:  powershell -ExecutionPolicy Bypass -File tools/deploy.ps1 -Target usuario@servidor:/var/www/portafolios [-DryRun] [-SkipBuild]
# Requiere un cliente ssh/scp en el PATH (OpenSSH de Windows sirve). El servidor debe servir dist/ como raíz.
param(
  [Parameter(Mandatory = $true)][string]$Target,
  [switch]$DryRun,
  [switch]$SkipBuild
)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

if (-not $SkipBuild) {
  Write-Host "== npm run build" -ForegroundColor Cyan
  npm run build
  if ($LASTEXITCODE -ne 0) { throw "La build ha fallado" }
}
if (-not (Test-Path "dist/index.html")) { throw "No existe dist/index.html; ejecuta npm run build" }

$files = Get-ChildItem -Recurse -File dist
$size = [math]::Round(($files | Measure-Object Length -Sum).Sum / 1KB)
Write-Host "== dist/: $($files.Count) ficheros, $size KB" -ForegroundColor Cyan
if ($DryRun) {
  $files | ForEach-Object { $_.FullName.Substring((Resolve-Path dist).Path.Length + 1) }
  Write-Host "(DryRun: no se sube nada)"
  exit 0
}

Write-Host "== scp -r dist/* $Target" -ForegroundColor Cyan
scp -r dist/* "$Target"
if ($LASTEXITCODE -ne 0) { throw "scp ha fallado" }
Write-Host "Desplegado. Comprueba https://portafolios.mtcor.es/ (Ctrl+F5 para saltarte la caché)." -ForegroundColor Green

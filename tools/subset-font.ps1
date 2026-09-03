# Regenera src/assets/fonts/inter-latin-var.woff2 a partir de InterVariable.woff2 (release rsms/inter).
# Requiere: pip install fonttools brotli
# Uso: powershell -File tools/subset-font.ps1 -Source C:\ruta\InterVariable.woff2
param(
  [Parameter(Mandatory = $true)][string]$Source
)
$unicodes = "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD"
pyftsubset $Source `
  --unicodes="$unicodes" `
  --layout-features="kern,liga,calt,ss03,cv11,tnum" `
  --flavor=woff2 `
  --output-file="src/assets/fonts/inter-latin-var.woff2"
Get-Item src/assets/fonts/inter-latin-var.woff2 | Select-Object Name, Length

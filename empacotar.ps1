# Gera os pacotes do Volume Turbo em dist\ (Chrome .zip e Firefox .xpi) e copia o .xpi para Documentos.
# Antes, copia o código para a pasta firefox\. Lembre de subir a "version" nos dois manifest.json.
#   powershell -ExecutionPolicy Bypass -File .\empacotar.ps1
$ErrorActionPreference = 'Stop'
$raiz = $PSScriptRoot
& (Join-Path $raiz 'sincronizar-firefox.ps1')

Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem
function New-Pacote([string]$base, [string[]]$itens, [string]$destino) {
  if (Test-Path $destino) { [IO.File]::Delete($destino) }
  $zip = [IO.Compression.ZipFile]::Open($destino, 'Create')
  try {
    foreach ($item in $itens) {
      $caminho = Join-Path $base $item
      $arquivos = if (Test-Path $caminho -PathType Container) { Get-ChildItem $caminho -Recurse -File } else { Get-Item $caminho }
      foreach ($a in $arquivos) {
        $nome = $a.FullName.Substring($base.Length + 1).Replace('\', '/')
        [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $a.FullName, $nome, 'Optimal') | Out-Null
      }
    }
  } finally { $zip.Dispose() }
}

$versao = ([IO.File]::ReadAllText((Join-Path $raiz 'manifest.json')) | ConvertFrom-Json).version
$versaoFx = ([IO.File]::ReadAllText((Join-Path $raiz 'firefox\manifest.json')) | ConvertFrom-Json).version
if ($versao -ne $versaoFx) { throw "Versões diferentes: Chrome $versao, Firefox $versaoFx" }

$dist = Join-Path $raiz 'dist'
New-Item -ItemType Directory -Force $dist | Out-Null
$itens = 'manifest.json', 'background.js', 'content.js', 'popup', 'icons'
New-Pacote $raiz $itens (Join-Path $dist "volume-turbo-chrome-$versao.zip")
$xpi = Join-Path $dist "volume-turbo-firefox-$versao.xpi"
New-Pacote (Join-Path $raiz 'firefox') $itens $xpi
Copy-Item $xpi ([Environment]::GetFolderPath('MyDocuments')) -Force
"Pronto: Volume Turbo $versao (dist\ e cópia do .xpi em Documentos)"

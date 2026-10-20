# Copia o código compartilhado da versão do Chrome (esta pasta) para a pasta firefox/.
# Cada navegador mantém o seu próprio manifest.json. Rode depois de editar qualquer arquivo:
#   powershell -ExecutionPolicy Bypass -File .\sincronizar-firefox.ps1
$root = $PSScriptRoot
$firefox = Join-Path $root 'firefox'

foreach ($file in 'content.js', 'background.js') {
  Copy-Item -Force (Join-Path $root $file) (Join-Path $firefox $file)
}
foreach ($dir in 'popup', 'icons') {
  $target = Join-Path $firefox $dir
  if (Test-Path $target) { Remove-Item -Recurse -Force $target }
  Copy-Item -Recurse (Join-Path $root $dir) $target
}

Write-Host 'Pasta firefox/ atualizada.'

$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# Git: commita e envia para o GitHub
$status = git status --porcelain
if ($status) {
  $msg = Read-Host "Mensagem do commit (Enter = 'update')"
  if (-not $msg) { $msg = "update" }
  git add .
  git commit -m $msg
}
git push
Write-Host "✅ Código enviado para o GitHub. Para publicar no Netlify, rode: .\publish.ps1" -ForegroundColor Green

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
git push pages master:master
Write-Host "✅ Código enviado para o GitHub e publicado no GitHub Pages (https://luizvaccaro-dev.github.io/jusfy-ads-dashboard-pages/)." -ForegroundColor Green

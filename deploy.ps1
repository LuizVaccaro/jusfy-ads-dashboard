$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
$env:NETLIFY_AUTH_TOKEN = [System.Environment]::GetEnvironmentVariable("NETLIFY_AUTH_TOKEN","User")

# Git: commita e envia para o GitHub
$status = git status --porcelain
if ($status) {
  $msg = Read-Host "Mensagem do commit (Enter = 'update')"
  if (-not $msg) { $msg = "update" }
  git add .
  git commit -m $msg
}
git push

# Netlify: publica em produção
npx netlify-cli deploy --prod

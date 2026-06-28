$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
$env:NETLIFY_AUTH_TOKEN = [System.Environment]::GetEnvironmentVariable("NETLIFY_AUTH_TOKEN","User")
npx netlify-cli deploy --prod

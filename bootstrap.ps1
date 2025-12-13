# Bootstrap script for Gapin setup on Windows

Write-Host "Installing global tools..." -ForegroundColor Green
npm install -g typescript ts-node

Write-Host "Installing workspace dependencies..." -ForegroundColor Green
npm install --workspaces

Write-Host "Starting Docker services..." -ForegroundColor Green
docker compose -f infra/docker-compose.yml up -d

Write-Host "Waiting for services to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

Write-Host "Initializing database..." -ForegroundColor Green
Push-Location packages/gateway
npm run db:init
Pop-Location

Write-Host "Setup complete!" -ForegroundColor Cyan
Write-Host "Run 'npm run dev --workspace=@gapin/gateway' to start the gateway." -ForegroundColor Cyan

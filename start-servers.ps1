# 두 API 서버를 동시에 실행
Write-Host "API 서버들을 시작합니다..." -ForegroundColor Green
Write-Host ""

# cite_api (포트 8000) 백그라운드 실행
Write-Host "[1/2] cite_api 시작 중... (포트 8000)" -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit -Command `"cd '$PSScriptRoot'; python -m uvicorn api.cite_api:app --port 8000`""

# 1초 대기
Start-Sleep -Seconds 1

# changeup (포트 8010) 백그라운드 실행
Write-Host "[2/2] changeup 시뮬 엔진 시작 중... (포트 8010)" -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit -Command `"cd '$PSScriptRoot'; python -m uvicorn api.changeup:app --host 127.0.0.1 --port 8010`""

Write-Host ""
Write-Host "✓ 두 서버 모두 시작되었습니다!" -ForegroundColor Green
Write-Host ""
Write-Host "웹 서버를 시작하려면:" -ForegroundColor Yellow
Write-Host "  cd web" -ForegroundColor White
Write-Host "  npm run dev -- --port 5174" -ForegroundColor White
Write-Host ""
Write-Host "브라우저: http://localhost:5174" -ForegroundColor Green

# ERP System Startup Script
# Run this in an admin PowerShell to start PostgreSQL + backend

$pgCtl = "C:\Program Files\PostgreSQL\17\bin\pg_ctl.exe"
$pgData = "C:\Program Files\PostgreSQL\17\data"
$projectRoot = "E:\gitdv\erpsys"

# Start PostgreSQL if not already running
$pgRunning = netstat -ano | Select-String ":5433.*LISTENING"
if ($pgRunning) {
    Write-Host "[OK] PostgreSQL already running on port 5433"
} else {
    Write-Host "Starting PostgreSQL..."
    & $pgCtl start -D $pgData -l "C:\Temp\pg_start.log" -w
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] PostgreSQL started on port 5433"
    } else {
        Write-Host "[ERROR] Failed to start PostgreSQL. Check C:\Temp\pg_start.log"
        exit 1
    }
}

# Start backend in a new window
Write-Host "Starting backend..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$projectRoot'; node backend/src/index.js" -WindowStyle Normal
Write-Host "[OK] Backend starting on http://localhost:3001"
Write-Host ""
Write-Host "Run 'npm run dev' in $projectRoot\frontend to start the frontend."

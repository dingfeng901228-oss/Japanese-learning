# verify-realshadow-merge-2026-08-22.ps1
# Wait for Vercel deploy, then confirm:
# 1. /shadowing redirects to /listening?mode=realShadow
# 2. /listening still renders (status 200, no broken imports)

$ErrorActionPreference = "Stop"
Write-Host "[verify] waiting 50s for Vercel deploy..." -ForegroundColor Yellow
Start-Sleep -Seconds 50

$headers = @{ "Cache-Control" = "no-cache" }

# 1. /shadowing redirect
$shadowResp = Invoke-WebRequest -Uri "https://jp.frank2025.com/shadowing" -Headers $headers -UseBasicParsing -MaximumRedirection 0
$shadowStatus = $shadowResp.StatusCode
$shadowLocation = $shadowResp.Headers["Location"]

Write-Host "[verify] /shadowing status=$shadowStatus"
Write-Host "[verify] /shadowing Location=$shadowLocation"

$redirectOk = ($shadowStatus -eq 307 -or $shadowStatus -eq 308 -or $shadowStatus -eq 301 -or $shadowStatus -eq 302) -and $shadowLocation -match "/listening\?mode=realShadow"

# 2. /listening still renders
$listeningResp = Invoke-WebRequest -Uri "https://jp.frank2025.com/listening" -Headers $headers -UseBasicParsing
$listeningStatus = $listeningResp.StatusCode
$listeningHtml = $listeningResp.Content

Write-Host "[verify] /listening status=$listeningStatus length=$($listeningHtml.Length)"

# Both pages should not 500 (auth-gated may still respond 200 with login redirect content for curl)
$listeningOk = $listeningStatus -eq 200

Write-Host ""
Write-Host "[verify] results:"
Write-Host "  /shadowing redirects to /listening?mode=realShadow: $redirectOk"
Write-Host "  /listening still renders (status 200)              : $listeningOk"
Write-Host ""

if ($redirectOk -and $listeningOk) {
    Write-Host "[verify] PASS - shadowing merged into listening" -ForegroundColor Green
    exit 0
} else {
    Write-Host "[verify] FAIL - see above" -ForegroundColor Red
    exit 1
}
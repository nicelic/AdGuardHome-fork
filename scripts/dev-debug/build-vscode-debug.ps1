[CmdletBinding()]
param(
    [string]$WorkspaceRoot = (Join-Path $PSScriptRoot "..\..")
)

$ErrorActionPreference = "Stop"

$workspaceRoot = (Resolve-Path -LiteralPath $WorkspaceRoot).Path
$prepareScript = Join-Path $PSScriptRoot "prepare-vscode-debug.ps1"
$debugBinaryPath = Join-Path $workspaceRoot ".vscode\bin\AdGuardHome-debug.exe"

& $prepareScript -WorkspaceRoot $workspaceRoot

Push-Location $workspaceRoot
try {
    if (-not (Test-Path -LiteralPath (Join-Path $workspaceRoot "client\node_modules"))) {
        Write-Host "Installing frontend dependencies with npm ci..."
        & npm.cmd --prefix client ci
        if ($LASTEXITCODE -ne 0) {
            throw "npm ci failed with exit code $LASTEXITCODE"
        }
    }

    Write-Host "Building frontend bundle..."
    & npm.cmd --prefix client run build-prod
    if ($LASTEXITCODE -ne 0) {
        throw "npm run build-prod failed with exit code $LASTEXITCODE"
    }

    Write-Host "Building backend debug binary..."
    & go build -gcflags "all=-N -l" -o $debugBinaryPath .
    if ($LASTEXITCODE -ne 0) {
        throw "go build failed with exit code $LASTEXITCODE"
    }
}
finally {
    Pop-Location
}

Write-Host "Ready for F5 debug."
Write-Host "  Binary: $debugBinaryPath"

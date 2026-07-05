[CmdletBinding()]
param(
    [string]$WorkspaceRoot = (Join-Path $PSScriptRoot "..\.."),
    [string]$WebHost = "127.0.0.1",
    [int]$WebPort = 8888,
    [string]$DnsHost = "127.0.0.1",
    [int]$DnsPort = 8853,
    [string]$Username = "admin",
    [string]$Password = "admin"
)

$ErrorActionPreference = "Stop"

$workspaceRoot = (Resolve-Path -LiteralPath $WorkspaceRoot).Path
$vscodeDir = Join-Path $workspaceRoot ".vscode"
$binDir = Join-Path $vscodeDir "bin"
$workDir = Join-Path $vscodeDir "dev-workdir"
$dataDir = Join-Path $workDir "data"
$configPath = Join-Path $vscodeDir "AdGuardHome.dev.yaml"
$markerPath = Join-Path $vscodeDir "dev-debug.json"
$sessionDbPath = Join-Path $dataDir "sessions.db"

$null = New-Item -ItemType Directory -Force -Path $vscodeDir, $binDir, $workDir, $dataDir

# Reset sessions so each F5 launch starts from a predictable login state.
Remove-Item -LiteralPath $sessionDbPath -Force -ErrorAction SilentlyContinue

$passwordHash = '$2a$10$KZJyNSrElKhP/YPDSL7sCek/nfIHzLiBBdFFMK0swb8RHakIQRhjC'

$configYaml = @"
http:
  address: $($WebHost):$($WebPort)
  pprof:
    enabled: true
    port: 6061
users:
  - name: $($Username)
    password: $passwordHash
dns:
  bind_hosts:
    - $($DnsHost)
  port: $($DnsPort)
schema_version: 35
log:
  verbose: true
"@

[System.IO.File]::WriteAllText($configPath, $configYaml, [System.Text.Encoding]::ASCII)

$marker = [ordered]@{
    dev_debug = $true
    generated_at = (Get-Date).ToString("o")
    config_path = $configPath
    work_dir = $workDir
    web_url = "http://$($WebHost):$($WebPort)"
    dns_address = "$($DnsHost):$($DnsPort)"
    credentials = [ordered]@{
        username = $Username
        password = $Password
    }
}

$markerJson = $marker | ConvertTo-Json -Depth 4
[System.IO.File]::WriteAllText($markerPath, $markerJson + [Environment]::NewLine, [System.Text.Encoding]::ASCII)

Write-Host "Prepared AdGuard Home VSCode debug profile."
Write-Host "  Config : $configPath"
Write-Host "  Workdir: $workDir"
Write-Host "  Panel  : http://$($WebHost):$($WebPort)"
Write-Host "  Login  : $($Username) / $($Password)"

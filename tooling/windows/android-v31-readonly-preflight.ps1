# Negresco Finance V3.1 - Windows PowerShell 5.1 read-only Samsung preflight.
# No adb install, uninstall, clear, or device mutations. Never requests bank data.
[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [string]$ApkPath
)
$ErrorActionPreference = "Stop"
$packageName = "com.negresco.finance"

Write-Host "=== NEGRESCO FINANCE V3.1 | DIAGNOSTICO SOMENTE LEITURA ===" -ForegroundColor Cyan
Write-Host "Nenhuma instalacao, desinstalacao ou limpeza sera executada."

# Examining a downloaded APK does not require connecting a device.
if (-not [string]::IsNullOrWhiteSpace($ApkPath)) {
    $resolved = (Resolve-Path -LiteralPath $ApkPath -ErrorAction Stop).ProviderPath
    $file = Get-Item -LiteralPath $resolved -ErrorAction Stop
    if (-not $file.PSIsContainer -and $file.Extension -ieq ".apk" -and $file.Length -gt 0) {
        $digest = Get-FileHash -LiteralPath $resolved -Algorithm SHA256
        Write-Host ("APK SHA256: {0}" -f $digest.Hash.ToLowerInvariant()) -ForegroundColor Green
        Write-Host ("APK tamanho: {0} bytes" -f $file.Length)
    } else {
        throw "O arquivo informado deve ser um APK valido e nao vazio."
    }

    # Optional locally-installed Android SDK tool: only verifies APK bytes.
    $signer = Get-Command "apksigner.bat" -ErrorAction SilentlyContinue
    if (-not $signer) { $signer = Get-Command "apksigner" -ErrorAction SilentlyContinue }
    if ($signer) {
        $certificateInfo = @(& $signer.Source verify --print-certs $resolved)
        if ($LASTEXITCODE -ne 0) {
            throw "O APK nao passou na verificacao local do apksigner."
        }
        $fingerprints = @($certificateInfo | Where-Object { $_ -match 'certificate SHA-256 digest:' })
        if ($fingerprints.Count -gt 0) {
            $fingerprints | ForEach-Object { Write-Host $_ }
        } else {
            Write-Host "Assinatura verificada; digest nao foi exibido pela ferramenta."
        }
    } else {
        Write-Host "apksigner indisponivel no PATH: compare o APK-SIGNATURE.txt do GitHub Releases."
    }
} else {
    Write-Host "Nenhum APK informado; verificacao do arquivo ignorada."
}

$adb = Get-Command "adb.exe" -ErrorAction SilentlyContinue
if (-not $adb) { $adb = Get-Command "adb" -ErrorAction SilentlyContinue }
if (-not $adb) {
    Write-Host "[PENDENTE] Android Platform Tools (adb) nao encontrado no PATH." -ForegroundColor Yellow
    Write-Host "Instale as Platform Tools oficiais e habilite depuracao USB somente para o teste."
    exit 2
}

$devices = @(& $adb.Source devices -l)
if ($LASTEXITCODE -ne 0) { throw "ADB nao conseguiu listar dispositivos." }
$authorized = @($devices | Where-Object { $_ -match '^\s*\S+\s+device(?:\s|$)' })
if ($authorized.Count -ne 1) {
    Write-Host "Dispositivos conectados (sem detalhes privados):" -ForegroundColor Yellow
    $devices | ForEach-Object { Write-Host $_ }
    throw "Conecte exatamente um dispositivo ADB autorizado. Verifique o aviso de autorizacao no Samsung."
}
$serial = ($authorized[0].Trim() -split '\s+')[0]
$model = (& $adb.Source -s $serial shell getprop ro.product.model | Out-String).Trim()
if ($LASTEXITCODE -ne 0) { throw "Nao foi possivel consultar o modelo Android." }
$android = (& $adb.Source -s $serial shell getprop ro.build.version.release | Out-String).Trim()
if ($LASTEXITCODE -ne 0) { throw "Nao foi possivel consultar a versao do Android." }
Write-Host ("Dispositivo: {0}" -f $model) -ForegroundColor Green
Write-Host ("Android: {0}" -f $android)

$installedPath = @(& $adb.Source -s $serial shell pm path $packageName)
if ($LASTEXITCODE -ne 0) { throw "Nao foi possivel consultar o pacote no Samsung." }
if ($installedPath -match '^package:') {
    Write-Host ("[INSTALADO] {0}" -f $packageName) -ForegroundColor Green
    $details = @(& $adb.Source -s $serial shell dumpsys package $packageName)
    if ($LASTEXITCODE -eq 0) {
        $versionName = @($details | Where-Object { $_ -match '^\s*versionName=' } | Select-Object -First 1)
        $versionCode = @($details | Where-Object { $_ -match '^\s*versionCode=' } | Select-Object -First 1)
        if ($versionName.Count -gt 0) { Write-Host $versionName[0].Trim() }
        if ($versionCode.Count -gt 0) { Write-Host $versionCode[0].Trim() }
    }
    Write-Host "Atualizar sobre esta instalacao exige conferir previamente o certificado de ambos os APKs."
} else {
    Write-Host "[NAO INSTALADO] Pacote ainda nao encontrado no dispositivo." -ForegroundColor Yellow
}

Write-Host "[OK] Preflight somente leitura concluido." -ForegroundColor Green
Write-Host "Nenhuma alteracao foi realizada no dispositivo. Nao desinstale o app para trocar de APK sem preservar os dados."

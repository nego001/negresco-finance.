# Negresco Finance - Android APK signing compatibility PRECHECK, read-only on device.
# PowerShell 5.1+, Android SDK platform-tools and build-tools required.
# Copies only installed application's base.apk to a temporary file on PC.
# It never installs/uninstalls/clears anything or reads private app data.
[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)]
  [ValidateNotNullOrEmpty()]
  [string]$ApkPath
)
$ErrorActionPreference='Stop'
$packageName='com.negresco.finance'
$localCopy=$null

function Find-AndroidTool([string]$name) {
  foreach($suffix in @('.exe','.bat','')) {
    $command=Get-Command "$name$suffix" -ErrorAction SilentlyContinue
    if($command) { return $command.Source }
  }
  $sdkPaths=@()
  if($env:ANDROID_HOME) {$sdkPaths+= $env:ANDROID_HOME}
  if($env:ANDROID_SDK_ROOT) {$sdkPaths+= $env:ANDROID_SDK_ROOT}
  if($env:LOCALAPPDATA) {$sdkPaths+= (Join-Path $env:LOCALAPPDATA 'Android\Sdk')}
  foreach($sdk in ($sdkPaths | Select-Object -Unique)) {
    if(-not (Test-Path -LiteralPath $sdk -PathType Container)) { continue }
    if($name -eq 'adb') {
      $candidate=Join-Path $sdk 'platform-tools\adb.exe'
      if(Test-Path -LiteralPath $candidate) { return $candidate }
      continue
    }
    $toolsDir=Join-Path $sdk 'build-tools'
    if(-not (Test-Path -LiteralPath $toolsDir -PathType Container)) { continue }
    foreach($dir in (Get-ChildItem -LiteralPath $toolsDir -Directory | Sort-Object Name -Descending)) {
      foreach($extension in @('.exe','.bat')) {
        $candidate=Join-Path $dir.FullName "$name$extension"
        if(Test-Path -LiteralPath $candidate) { return $candidate }
      }
    }
  }
  throw "Ferramenta Android nao encontrada: $name. Configure Android Platform Tools/Build Tools no PATH ou Android SDK."
}
function Apk-ManifestInfo([string]$aapt,[string]$file) {
  $output=@(& $aapt dump badging $file 2>&1)
  if($LASTEXITCODE -ne 0) { throw 'Nao foi possivel verificar os metadados do APK.' }
  $line=@($output | Where-Object {$_ -match "^package: name="} | Select-Object -First 1)
  if($line.Count -ne 1) { throw 'Metadados do APK incompletos.' }
  $match=[regex]::Match($line[0],"^package: name='([^']+)' versionCode='(\d+)' versionName='([^']*)'")
  if(-not $match.Success) { throw 'Formato de metadados do APK inesperado.' }
  return @{
    Package=$match.Groups[1].Value
    VersionCode=[long]$match.Groups[2].Value
    VersionName=$match.Groups[3].Value
  }
}
function Apk-Certificate([string]$apksigner,[string]$file) {
  $output=@(& $apksigner verify --verbose --print-certs $file 2>&1)
  if($LASTEXITCODE -ne 0) { throw 'Assinatura APK invalida ou verificacao indisponivel.' }
  $text=$output -join "`n"
  $match=[regex]::Match($text,'Signer #1 certificate SHA-256 digest:\s*([0-9a-fA-F]{64})',[System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  if(-not $match.Success) { throw 'Impossivel identificar o certificado SHA-256 do APK.' }
  return $match.Groups[1].Value.ToLowerInvariant()
}

try {
  $apk=(Resolve-Path -LiteralPath $ApkPath -ErrorAction Stop).ProviderPath
  $info=Get-Item -LiteralPath $apk
  if($info.PSIsContainer -or $info.Extension -ine '.apk' -or $info.Length -le 0) {
    throw 'Selecione um arquivo APK valido, nao vazio.'
  }
  $adb=Find-AndroidTool 'adb'
  $aapt=Find-AndroidTool 'aapt'
  $signer=Find-AndroidTool 'apksigner'
  $candidate=Apk-ManifestInfo $aapt $apk
  if($candidate.Package -cne $packageName) { throw 'Pacote APK diferente de com.negresco.finance.' }
  $candidateCert=Apk-Certificate $signer $apk
  $sha=(Get-FileHash -LiteralPath $apk -Algorithm SHA256).Hash.ToLowerInvariant()
  Write-Host '=== NEGRESCO FINANCE | ANALISE SOMENTE LEITURA ===' -ForegroundColor Cyan
  Write-Host ("Arquivo candidato: versao {0}, codigo {1}" -f $candidate.VersionName,$candidate.VersionCode)
  Write-Host ("SHA256 do arquivo: {0}" -f $sha)
  Write-Host ("SHA256 do certificado candidato: {0}" -f $candidateCert)

  $devices=@(& $adb devices)
  if($LASTEXITCODE -ne 0) { throw 'Falha ao enumerar dispositivos Android.' }
  $authorized=@($devices | Where-Object { $_ -match '^\s*\S+\s+device(?:\s|$)' })
  if($authorized.Count -ne 1) {
    # Device serial is deliberately not displayed.
    throw 'Conecte exatamente um aparelho ADB autorizado. Numeros de serie nao sao publicados.'
  }
  $serial=([regex]::Match($authorized[0],'^\s*(\S+)\s+device')).Groups[1].Value
  $paths=@(& $adb -s $serial shell pm path $packageName)
  if($LASTEXITCODE -ne 0) { throw 'Falha ao consultar se o app esta instalado.' }
  $baseLine=@($paths | Where-Object { $_ -match '^package:.*/base\.apk\s*$' } | Select-Object -First 1)
  if($baseLine.Count -eq 0) {
    if(@($paths | Where-Object {$_ -match '^package:'}).Count -gt 0) {
      throw 'App encontrado, mas nao foi possivel identificar o base.apk. Comparacao interrompida.'
    }
    Write-Host '[NAO INSTALADO] Nenhuma instalacao existente. Este nao e um teste de atualizacao.' -ForegroundColor Yellow
    exit 0
  }
  $deviceApk=($baseLine[0] -replace '^package:','').Trim()
  $localCopy=Join-Path ([IO.Path]::GetTempPath()) ("negresco-inspected-"+[Guid]::NewGuid().ToString('N')+".apk")
  # adb pull reads the installed application's PUBLIC code bundle, not its data directory.
  $pull=@(& $adb -s $serial pull $deviceApk $localCopy 2>&1)
  if($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $localCopy)) {
    throw 'Falha ao copiar somente o base.apk para a pasta temporaria do PC.'
  }
  $installed=Apk-ManifestInfo $aapt $localCopy
  if($installed.Package -cne $packageName) { throw 'Pacote instalado inesperado.' }
  $installedCert=Apk-Certificate $signer $localCopy
  Write-Host ("Instalado: versao {0}, codigo {1}" -f $installed.VersionName,$installed.VersionCode)
  Write-Host ("SHA256 do certificado instalado: {0}" -f $installedCert)

  if($installedCert -cne $candidateCert) {
    Write-Host '[BLOQUEADO] Certificados diferentes: o APK nao deve ser instalado sobre esta versao.' -ForegroundColor Red
    exit 3
  }
  if($candidate.VersionCode -le $installed.VersionCode) {
    Write-Host '[BLOQUEADO] A nova versao nao possui versionCode maior do que o instalado.' -ForegroundColor Red
    exit 4
  }
  Write-Host '[COMPATIBILIDADE PROVAVEL] Mesmo certificado e versionCode crescente.' -ForegroundColor Green
  Write-Host 'Ainda pode haver outras restricoes Android; isso NAO instala ou preserva dados por si so.'
  Write-Host 'Nao desinstale o aplicativo para contornar uma falha de atualizacao.'
}
finally {
  if($localCopy -and (Test-Path -LiteralPath $localCopy)) {
    Remove-Item -LiteralPath $localCopy -Force -ErrorAction SilentlyContinue
  }
}

# Builds a signed Android APK of Roblox Studio Android Edition
# without Gradle, using the plain Android SDK toolchain:
#   aapt2 (compile/link) -> javac -> d8 -> zipalign -> apksigner
#
# Usage:  powershell -ExecutionPolicy Bypass -File tools\build_apk.ps1
#
# Inputs:
#   docs/                     web build (copied into assets/)
#   tools/opencloud.key       Open Cloud API key baked into the APK (gitignored)
#   android/AndroidManifest.xml, java sources, res/
# Output:
#   dist/RobloxStudioAE-1.0.0.apk   (also signed, ready for release upload)

$ErrorActionPreference = 'Stop'

$Root     = Split-Path -Parent $PSScriptRoot
$Sdk      = 'C:\Users\RhysC\Android\Sdk'
$Bt       = Join-Path $Sdk 'build-tools\35.0.0'
$Jar      = Join-Path $Sdk 'platforms\android-35\android.jar'
$Aapt2    = Join-Path $Bt 'aapt2.exe'
$D8       = Join-Path $Bt 'd8.bat'
$Zipalign = Join-Path $Bt 'zipalign.exe'
$Apksign  = Join-Path $Bt 'apksigner.bat'

$Manifest = Join-Path $Root 'android\AndroidManifest.xml'
$ResDir   = Join-Path $Root 'android\app\src\main\res'
$JavaDir  = Join-Path $Root 'android\app\src\main\java'
$Assets   = Join-Path $Root 'android\app\src\main\assets'
$Out      = Join-Path $Root 'android\out'

$Version  = '1.0.0'
$ApkName  = "RobloxStudioAE-$Version.apk"
$Store    = Join-Path $Root 'android\rsa.keystore'
$Alias    = 'rsa'
$Pass     = 'gostudio-ae'

function Need($p) { if (-not (Test-Path $p)) { throw "Missing: $p" } }

Write-Host '== prereqs ==' -ForegroundColor Cyan
@($Aapt2, $D8, $Zipalign, $Apksign, $Jar, $Manifest) | ForEach-Object { Need $_ }
if (-not (Get-Command javac -ErrorAction SilentlyContinue)) { throw 'javac not on PATH (install a JDK)' }
if (-not (Test-Path (Join-Path $Root 'tools\opencloud.key'))) { throw 'tools/opencloud.key not found' }
Need (Join-Path $Root 'docs\index.html')

# 1. assets -----------------------------------------------------------------
Write-Host '== staging assets ==' -ForegroundColor Cyan
$Adocs = Join-Path $Assets 'docs'
if (Test-Path $Adocs) { Remove-Item $Adocs -Recurse -Force }
New-Item -ItemType Directory -Force -Path $Adocs | Out-Null
robocopy (Join-Path $Root 'docs') $Adocs /E /NFL /NDL /NJH /NJS /NP | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy failed ($LASTEXITCODE)" }

# Bake the real API key into the APK copy of secrets.js (gitignored)
$key = (Get-Content (Join-Path $Root 'tools\opencloud.key') -Raw).Trim()
$secrets = @"
// Baked secrets for the APK build (this copy is gitignored).
window.RSAE_SECRETS = { openCloudApiKey: "$key" };
"@
Set-Content -Path (Join-Path $Adocs 'js\secrets.js') -Value $secrets -Encoding UTF8 -NoNewline
$b = [IO.File]::ReadAllBytes((Join-Path $Adocs 'js\secrets.js'))
if ($b.Length -gt 3 -and $b[0] -eq 0xEF -and $b[1] -eq 0xBB -and $b[2] -eq 0xBF) {
  [IO.File]::WriteAllBytes((Join-Path $Adocs 'js\secrets.js'), $b[3..($b.Length - 1)])
}

# 2. clean + res ------------------------------------------------------------
Write-Host '== resources ==' -ForegroundColor Cyan
if (Test-Path $Out) { Remove-Item $Out -Recurse -Force }
New-Item -ItemType Directory -Force -Path $Out | Out-Null
& $Aapt2 compile --dir $ResDir -o (Join-Path $Out 'res.zip')
if ($LASTEXITCODE -ne 0) { throw 'aapt2 compile failed' }

# 3. link -------------------------------------------------------------------
$Base = Join-Path $Out 'base.apk'
& $Aapt2 link -o $Base -I $Jar --manifest $Manifest `
    --min-sdk-version 26 --target-sdk-version 35 `
    --version-code 1 --version-name $Version `
    -A $Assets (Join-Path $Out 'res.zip')
if ($LASTEXITCODE -ne 0) { throw 'aapt2 link failed' }

# 4. javac ------------------------------------------------------------------
Write-Host '== javac ==' -ForegroundColor Cyan
$Classes = Join-Path $Out 'classes'
New-Item -ItemType Directory -Force -Path $Classes | Out-Null
$sources = @(Get-ChildItem -Path $JavaDir -Recurse -Filter *.java | ForEach-Object { $_.FullName })
javac --release 11 -classpath $Jar -d $Classes @sources
if ($LASTEXITCODE -ne 0) { throw 'javac failed' }

# 5. d8 -> dex --------------------------------------------------------------
Write-Host '== d8 ==' -ForegroundColor Cyan
$DexOut = Join-Path $Out 'dex'
New-Item -ItemType Directory -Force -Path $DexOut | Out-Null
$classesFiles = @(Get-ChildItem -Path $Classes -Recurse -Filter *.class | ForEach-Object { $_.FullName })
& $D8 --release --min-api 26 --lib $Jar --output $DexOut @classesFiles
if ($LASTEXITCODE -ne 0) { throw 'd8 failed' }

# 6. normalise zip entry names + inject classes.dex --------------------------
# (aapt2 on Windows writes nested assets with backslashes, which Android
#  cannot open — fix_zip.py rewrites everything to forward slashes.)
Write-Host '== zip fixup ==' -ForegroundColor Cyan
$Fixed = Join-Path $Out 'fixed.apk'
python (Join-Path $Root 'tools\fix_zip.py') $Base $Fixed --add (Join-Path $DexOut 'classes.dex')
if ($LASTEXITCODE -ne 0) { throw 'fix_zip failed' }

# 7. zipalign ---------------------------------------------------------------
$Aligned = Join-Path $Out 'aligned.apk'
& $Zipalign -f -p 4 $Fixed $Aligned
if ($LASTEXITCODE -ne 0) { throw 'zipalign failed' }

# 8. keystore + sign --------------------------------------------------------
if (-not (Test-Path $Store)) {
  Write-Host '== generating keystore ==' -ForegroundColor Cyan
  keytool -genkeypair -keystore $Store -alias $Alias -keyalg RSA -keysize 2048 `
    -validity 10000 -storepass $Pass -keypass $Pass `
    -dname 'CN=Roblox Studio Android Edition, OU=GoStudios, O=GoStudios, L=Internet, S=Online, C=US'
  if ($LASTEXITCODE -ne 0) { throw 'keytool failed' }
}

Write-Host '== signing ==' -ForegroundColor Cyan
$Dist = Join-Path $Root 'dist'
New-Item -ItemType Directory -Force -Path $Dist | Out-Null
$Final = Join-Path $Dist $ApkName
& $Apksign sign --ks $Store --ks-key-alias $Alias --ks-pass "pass:$Pass" --key-pass "pass:$Pass" --out $Final $Aligned
if ($LASTEXITCODE -ne 0) { throw 'apksigner failed' }
& $Apksign verify $Final
if ($LASTEXITCODE -ne 0) { throw 'apksigner verify failed' }

$size = [math]::Round((Get-Item $Final).Length / 1MB, 2)
Write-Host "== done: $Final ($size MB) ==" -ForegroundColor Green

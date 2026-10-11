param([switch]$EnableGoogle, [switch]$EnablePush)

$ErrorActionPreference = 'Stop'
$taskMobileRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../apps/mobile'))
$taskJavaRoot = 'C:\Program Files\Android\Android Studio\jbr'
$taskAndroidSdk = 'C:\Users\Caleb\AppData\Local\Android\Sdk'
if (!(Test-Path -LiteralPath (Join-Path $taskJavaRoot 'bin/java.exe'))) { throw 'Configura el JDK de Android Studio.' }
if (!(Test-Path -LiteralPath $taskAndroidSdk)) { throw 'Configura el SDK de Android.' }

# Child build only: no private dotenv, no SMTP/JWT/AI keys in the APK.
$env:JAVA_HOME = $taskJavaRoot
$env:ANDROID_HOME = $taskAndroidSdk
$env:EXPO_NO_DOTENV = '1'
$env:EXPO_NO_METRO_WORKSPACE_ROOT = '1' # Windows Gradle sends entry paths relative to apps/mobile.
$env:NODE_ENV = 'production'
$env:JUNTO_QA_KEYSTORE_PATH = ''
$env:JUNTO_WEB_BASE_PATH = ''
$env:EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = ''
$env:GOOGLE_SERVICES_JSON = ''
if ($EnablePush) {
  $taskFirebasePath = Join-Path $taskMobileRoot 'credentials/google-services.json'
  if (!(Test-Path -LiteralPath $taskFirebasePath)) { throw 'Falta credentials/google-services.json de JUNTO.' }
  $taskFirebase = Get-Content -LiteralPath $taskFirebasePath -Raw | ConvertFrom-Json
  if ($taskFirebase.private_key -or $taskFirebase.type -eq 'service_account') { throw 'Nunca incluyas la clave privada FCM en la app.' }
  if ($taskFirebase.project_info.project_id -ne 'junto-510905' -or !($taskFirebase.client | Where-Object { $_.client_info.android_client_info.package_name -eq 'com.junto.app' })) { throw 'La configuración Firebase no corresponde a JUNTO.' }
  $env:GOOGLE_SERVICES_JSON = $taskFirebasePath
}
if ($EnableGoogle) {
  # Public OAuth identifiers only. No client secret or private dotenv is needed.
  $taskGoogle = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'google-beta.public.json') -Raw | ConvertFrom-Json
  $taskApp = Get-Content -LiteralPath (Join-Path $taskMobileRoot 'app.json') -Raw | ConvertFrom-Json
  if ($taskGoogle.package -ne $taskApp.expo.android.package) { throw 'El paquete Android no coincide con el cliente Google de beta.' }
  $taskSigner = & (Join-Path $taskJavaRoot 'bin/keytool.exe') -list -v -keystore (Join-Path $taskMobileRoot 'android/app/debug.keystore') -alias androiddebugkey -storepass android 2>&1
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo verificar la firma Android de beta.' }
  $taskSha1 = [regex]::Match(($taskSigner -join "`n"), 'SHA1:\s*([0-9A-F:]+)').Groups[1].Value
  if (!$taskSha1 -or $taskSha1 -ne $taskGoogle.signingSha1) { throw 'La firma cambió. Valida primero su SHA-1 en el cliente Android de Google Cloud.' }
  $env:EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = $taskGoogle.webClientId
  Write-Host 'Google habilitado para validación nativa. El inicio de sesión real sigue siendo una comprobación obligatoria.'
}
$env:EXPO_PUBLIC_API_URL = 'https://junto.lunalav.pe'
$env:EXPO_PUBLIC_WEB_URL = 'https://junto.lunalav.pe'
$env:EXPO_PUBLIC_APP_ENV = 'preview'
$env:EXPO_PUBLIC_PRIVACY_URL = 'https://junto.lunalav.pe/privacidad'
$env:EXPO_PUBLIC_DELETE_ACCOUNT_URL = 'https://junto.lunalav.pe/eliminar-cuenta'
$env:EXPO_PUBLIC_SUPPORT_EMAIL = 'calebluna41@gmail.com'

Push-Location $taskMobileRoot
try {
  & npx expo prebuild --platform android --no-install
  if ($LASTEXITCODE -ne 0) { throw 'Falló Expo prebuild.' }
  Push-Location (Join-Path $taskMobileRoot 'android')
  try {
    & .\gradlew.bat :app:assembleRelease '-PreactNativeArchitectures=arm64-v8a,x86_64' --max-workers=2 --console=plain
    if ($LASTEXITCODE -ne 0) { throw 'Falló la compilación del APK.' }
  } finally { Pop-Location }
} finally { Pop-Location }
# Internal beta only. Native release is non-debuggable and embeds JS, but uses the
# existing local test signer; store publishing needs a protected upload key/EAS.

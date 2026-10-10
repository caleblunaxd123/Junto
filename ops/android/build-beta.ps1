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
$env:EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = '' # Email login works; do not advertise unverified OAuth.
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

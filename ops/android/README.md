# APK beta interna de JUNTO

`build-beta.ps1` genera `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`.
Ejecutar el script en un proceso PowerShell dedicado. Requiere Node, Android Studio,
SDK/NDK y dependencias instaladas. El proyecto nativo es generado e ignorado por Git.

La variante release incluye el bundle Hermes y los recursos; no es debuggable y
no necesita Metro, Expo Go, USB ni que la computadora permanezca encendida. API,
invitaciones y páginas legales usan `https://junto.lunalav.pe`. Sí requiere internet
para cuentas, grupos y envío de correos. Android 7+; ARM64 para celulares y x86_64
para el emulador. No es compatible con celulares exclusivamente ARM de 32 bits.

No cargar dotenv privado en distribución: SMTP, JWT, DeepSeek y llaves SSH nunca
van dentro de la aplicación. Esta beta usa el firmante de pruebas local existente,
no una clave de publicación definitiva de Play Store. Nunca publicar el keystore.
Login/registro/recuperación por correo; Google no se anuncia en esta compilación
porque la configuración OAuth/certificado de distribución aún requiere validación.

Antes de entregar: verificar firma con `apksigner verify`, paquete/minSdk/ausencia de
debug con `aapt dump badging`, bundle `assets/index.android.bundle` y arquitectura.
Comparar SHA-256 del archivo local con la descarga HTTPS publicada. Conservar
versiones anteriores para rollback; no desinstalar una app con datos para cambiar
firmante. Si Android rechaza una actualización, revisar certificados antes de actuar.

En Windows, Gradle pasa la entrada relativa a `apps/mobile`, mientras Expo SDK 54
detecta la raíz del workspace por defecto. La compilación nativa usa
`EXPO_NO_METRO_WORKSPACE_ROOT=1` y hace visibles las dependencias hoisted en Metro.
No se cambia la raíz del servidor de desarrollo ni del export web.

WhatsApp abre un borrador: elegir chat y pulsar enviar sigue siendo responsabilidad
del usuario. Sin WhatsApp se conserva el enlace y se ofrecen correo/copia. El envío
desde JUNTO no necesita Gmail configurado en el celular; lo hace la API por SMTP.

La beta requiere validación en un celular físico. No equivale a publicación en Play
Store ni a una compilación iOS/TestFlight.

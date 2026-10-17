# APK beta interna de JUNTO

Actualización vigente: [beta 1.7.0/código 12](../web/DEPLOY-20261017-BETA170.md),
publicada el 17/10/2026, con Google y el firmante beta existente. Web y descarga
HTTPS verificadas; actualización en emulador conserva sesión. No equivale a Google
físico, push con app cerrada ni publicación en tienda.

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
Login/registro/recuperación por correo. Google se mantiene apagado por defecto.
Para generar una candidata con Google: `powershell -File ops/android/build-beta.ps1 -EnableGoogle`.
El perfil `google-beta.public.json` solo contiene identificadores públicos y la huella
del firmante local; el script rechaza un cambio de paquete o firma. No certifica que
esa huella esté registrada en Cloud: contrastarla allí y completar un inicio de sesión
real antes de anunciar Google como validado. Nunca usar el ID Android como webClientId.
Una clave de publicación Play diferente requiere su propio cliente Android con SHA-1.

La candidata 1.1.3/versionCode 5 añade guía opcional, resumen de cuentas pendientes
y emojis en el chat. Google fue probado por el propietario en 1.1.2; volver a
comprobarlo en cada APK que se entregue.

Push requiere `credentials/google-services.json` del proyecto `junto-510905`,
paquete `com.junto.app`, y credenciales FCM privadas cargadas en Expo/EAS.
Cuando esté verificado: `powershell -File ops/android/build-beta.ps1 -EnableGoogle -EnablePush`.
El script rechaza otro proyecto y archivos de cuenta de servicio. Nunca incluir
la clave FCM privada en el APK. Sin `-EnablePush`, la app no promete entrega push;
conceder el permiso del celular no equivale a tener configurado el servicio.
La configuración Firebase y la entrega real siguen pendientes de verificación.

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

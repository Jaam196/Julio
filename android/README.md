# Aplicación Android Nativa - Lector de Pantalla HIOPOS & Gestor de Tickets

Esta carpeta contiene el proyecto Android completo y compilable con **Gradle**, configurado para capturar la pantalla de la tablet en tiempo real mediante la API nativa `MediaProjection` y un `Foreground Service`, reconociendo los números de ticket de **HIOPOS** con **Gemini OCR** y enviándolos automáticamente al sistema de comandas.

---

## 📱 ¿Cómo funciona en la Tablet?
1. La aplicación se ejecuta en la tablet Android.
2. Inicia un servicio en segundo plano (`MediaProjectionService`) que captura periódicamente la pantalla (incluso cuando HIOPOS u otra aplicación está en pantalla).
3. Transmite los fotogramas recortados (según la zona ROI configurada) al motor OCR inteligente.
4. Detecta el número de ticket (con deduplicación en tiempo real) y lo añade inmediatamente a la lista de espera del restaurante.

---

## 🛠️ Guía Paso a Paso para Compilar e Instalar el APK

### Método 1: Con Android Studio (Recomendado y más sencillo)

1. **Descargar el proyecto:**
   - Descarga el código completo de la aplicación (botón Exportar / ZIP o clonar repositorio).
   - Descomprime el archivo en tu ordenador.

2. **Abrir en Android Studio:**
   - Abre **Android Studio**.
   - Selecciona **"Open"** (Abrir) y elige la carpeta `android/` de este proyecto.
   - Espera a que Gradle descargue las dependencias y sincronice el proyecto automáticamente (tarda 1-2 minutos la primera vez).

3. **Compilar el APK:**
   - En el menú superior, ve a: `Build` ➔ `Build Bundle(s) / APK(s)` ➔ `Build APK(s)`.
   - Cuando termine, aparecerá un aviso en la esquina inferior derecha: *"APK(s) generated successfully"*.
   - Haz clic en **"locate"** para abrir la carpeta donde se ha generado el archivo `app-debug.apk`.

4. **Instalar en la Tablet Android:**
   - **Opción A (Cable USB):** Conecta la tablet al ordenador por USB (con "Depuración USB" activada) y pulsa el botón verde **Run (▶)** en Android Studio.
   - **Opción B (Sin cables / WhatsApp / Google Drive / Email):** Pasa el archivo `app-debug.apk` a la tablet por WhatsApp, Telegram, Google Drive o correo, ábrelo en la tablet y pulsa **Instalar**. (Si te pide permiso para *instalar apps de fuentes desconocidas*, actívalo).

---

### Método 2: Desde la Terminal / Línea de Comandos

Si tienes el SDK de Android instalado en tu máquina:

```bash
# 1. Situarse en la carpeta android
cd android

# 2. Compilar el APK debug
# En Windows:
gradlew assembleDebug

# En Linux / Mac:
./gradlew assembleDebug
```

El archivo APK generado estará en:
`android/app/build/outputs/apk/debug/app-debug.apk`

---

## ⚙️ Permisos y Configuración en Android 10, 11, 12, 13 y 14

Al abrir la aplicación por primera vez y pulsar **"Iniciar Lector Automático"**:
1. El sistema Android mostrará un cuadro de diálogo del sistema: *"¿Permitir que Gestor de Tickets grabe o proyecte la pantalla?"*.
2. Marca la casilla **"No volver a mostrar"** (si está disponible) y pulsa **"Iniciar ahora"** o **"Aceptar"**.
3. Verás un icono de cámara en la barra de notificaciones indicando que el servicio de captura está activo en segundo plano.
4. ¡Listo! Abre HIOPOS y el sistema detectará automáticamente cada comanda.

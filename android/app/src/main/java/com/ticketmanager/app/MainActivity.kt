package com.ticketmanager.app

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.PixelFormat
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.ImageReader
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Base64
import android.util.Log
import android.view.WindowManager
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import java.io.ByteArrayOutputStream

class MainActivity : AppCompatActivity() {

    private val TAG = "MainActivity"
    private lateinit var webView: WebView
    private val REQUEST_MEDIA_PROJECTION = 1002

    private var mediaProjectionManager: MediaProjectionManager? = null
    private var mediaProjection: MediaProjection? = null
    private var virtualDisplay: VirtualDisplay? = null
    private var imageReader: ImageReader? = null

    private val captureHandler = Handler(Looper.getMainLooper())
    private var captureRunnable: Runnable? = null
    private var isCapturing = false
    private var captureIntervalMs: Long = 2000

    private var projectionResultCode: Int = 0
    private var projectionData: Intent? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Keep screen on while the ticket manager / reader is running
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        webView = WebView(this)
        setContentView(webView)

        setupWebView()

        mediaProjectionManager = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager

        // Load local bundled assets or remote host URL
        webView.loadUrl("file:///android_asset/public/index.html")
    }

    private fun setupWebView() {
        val settings: WebSettings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.mediaPlaybackRequiresUserGesture = false
        settings.allowFileAccess = true
        settings.allowContentAccess = true
        settings.loadWithOverviewMode = true
        settings.useWideViewPort = true
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            settings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
        }

        webView.addJavascriptInterface(AndroidBridgeInterface(this), "AndroidBridge")

        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                Log.d(TAG, "WebView page finished loading: $url")
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest?) {
                request?.grant(request.resources)
            }
        }
    }

    fun startScreenCaptureIntent() {
        val manager = mediaProjectionManager ?: return
        startActivityForResult(manager.createScreenCaptureIntent(), REQUEST_MEDIA_PROJECTION)
    }

    fun stopScreenCaptureService() {
        stopContinuousCapture()
        val intent = Intent(this, MediaProjectionService::class.java)
        stopService(intent)
    }

    fun startContinuousCapture(intervalMs: Long = 2000) {
        captureIntervalMs = Math.max(1000, intervalMs)

        if (mediaProjection == null && projectionData != null && projectionResultCode != 0) {
            setupVirtualDisplay(projectionResultCode, projectionData!!)
            return
        }

        if (mediaProjection == null) {
            startScreenCaptureIntent()
            return
        }

        isCapturing = true
        captureRunnable?.let { captureHandler.removeCallbacks(it) }
        captureRunnable = object : Runnable {
            override fun run() {
                if (!isCapturing) return
                captureFrameAndSend()
                captureHandler.postDelayed(this, captureIntervalMs)
            }
        }
        captureHandler.post(captureRunnable!!)
    }

    fun stopContinuousCapture() {
        isCapturing = false
        captureRunnable?.let { captureHandler.removeCallbacks(it) }
        captureRunnable = null

        virtualDisplay?.release()
        virtualDisplay = null
        imageReader?.close()
        imageReader = null
        mediaProjection?.stop()
        mediaProjection = null
    }

    private fun setupVirtualDisplay(resultCode: Int, data: Intent) {
        val manager = mediaProjectionManager ?: return
        mediaProjection = manager.getMediaProjection(resultCode, data)

        val metrics = resources.displayMetrics
        val width = metrics.widthPixels
        val height = metrics.heightPixels
        val density = metrics.densityDpi

        imageReader = ImageReader.newInstance(width, height, PixelFormat.RGBA_8888, 2)
        virtualDisplay = mediaProjection?.createVirtualDisplay(
            "HioposScreenCapture",
            width,
            height,
            density,
            DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
            imageReader?.surface,
            null,
            null
        )

        isCapturing = true
        captureRunnable?.let { captureHandler.removeCallbacks(it) }
        captureRunnable = object : Runnable {
            override fun run() {
                if (!isCapturing) return
                captureFrameAndSend()
                captureHandler.postDelayed(this, captureIntervalMs)
            }
        }
        captureHandler.postDelayed(captureRunnable!!, 500)
    }

    private fun captureFrameAndSend() {
        val reader = imageReader ?: return
        val image = reader.acquireLatestImage() ?: return

        try {
            val planes = image.planes
            val buffer = planes[0].buffer
            val pixelStride = planes[0].pixelStride
            val rowStride = planes[0].rowStride
            val rowPadding = rowStride - pixelStride * image.width

            val bitmap = Bitmap.createBitmap(
                image.width + rowPadding / pixelStride,
                image.height,
                Bitmap.Config.ARGB_8888
            )
            bitmap.copyPixelsFromBuffer(buffer)

            val croppedBitmap = if (rowPadding > 0) {
                Bitmap.createBitmap(bitmap, 0, 0, image.width, image.height)
            } else {
                bitmap
            }

            val outputStream = ByteArrayOutputStream()
            // Compress to JPEG 80% for fast processing
            croppedBitmap.compress(Bitmap.CompressFormat.JPEG, 80, outputStream)
            val byteArray = outputStream.toByteArray()
            val base64 = Base64.encodeToString(byteArray, Base64.NO_WRAP)
            val fullDataUrl = "data:image/jpeg;base64,$base64"

            runOnUiThread {
                webView.evaluateJavascript(
                    "if (window.onAndroidFrameReceived) { window.onAndroidFrameReceived('$fullDataUrl'); }",
                    null
                )
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error capturing screen frame: ${e.message}", e)
        } finally {
            image.close()
        }
    }

    fun discoverServerOnNetwork() {
        val helper = ServerDiscoveryHelper(this, object : ServerDiscoveryHelper.DiscoveryCallback {
            override fun onServerFound(ip: String, port: Int, serverName: String) {
                runOnUiThread {
                    webView.evaluateJavascript(
                        "if (window.onServerDiscovered) { window.onServerDiscovered('$ip', $port); }",
                        null
                    )
                }
            }

            override fun onDiscoveryFailed() {
                runOnUiThread {
                    webView.evaluateJavascript(
                        "if (window.onServerDiscoveryFailed) { window.onServerDiscoveryFailed(); }",
                        null
                    )
                }
            }
        })
        helper.discoverServer()
    }

    fun loadServerUrl(url: String) {
        runOnUiThread {
            webView.loadUrl(url)
        }
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == REQUEST_MEDIA_PROJECTION) {
            if (resultCode == Activity.RESULT_OK && data != null) {
                projectionResultCode = resultCode
                projectionData = data

                // Start Foreground Service required on Android 10+ before creating virtual display
                val serviceIntent = Intent(this, MediaProjectionService::class.java)
                ContextCompat.startForegroundService(this, serviceIntent)

                setupVirtualDisplay(resultCode, data)

                webView.evaluateJavascript(
                    "if (window.onAndroidScreenCapturePermissionGranted) { window.onAndroidScreenCapturePermissionGranted(); }",
                    null
                )
            } else {
                webView.evaluateJavascript(
                    "if (window.onAndroidScreenCapturePermissionDenied) { window.onAndroidScreenCapturePermissionDenied('Permiso de captura denegado por el usuario'); }",
                    null
                )
            }
        }
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        stopContinuousCapture()
    }
}

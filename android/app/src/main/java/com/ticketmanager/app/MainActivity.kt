package com.ticketmanager.app

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.media.projection.MediaProjectionManager
import android.os.Bundle
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private val REQUEST_MEDIA_PROJECTION = 1002

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate()
        
        webView = WebView(this)
        setContentView(webView)

        val settings: WebSettings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.mediaPlaybackRequiresUserGesture = false
        settings.allowFileAccess = true

        webView.addJavascriptInterface(AndroidBridgeInterface(this), "AndroidBridge")
        webView.webViewClient = WebViewClient()

        // Load local assets or Cloud Run dev URL
        webView.loadUrl("file:///android_asset/public/index.html")
    }

    fun startScreenCaptureIntent() {
        val mediaProjectionManager = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
        startActivityForResult(mediaProjectionManager.createScreenCaptureIntent(), REQUEST_MEDIA_PROJECTION)
    }

    fun stopScreenCaptureService() {
        val intent = Intent(this, MediaProjectionService::class.java)
        stopService(intent)
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == REQUEST_MEDIA_PROJECTION) {
            if (resultCode == Activity.RESULT_OK && data != null) {
                // Permission granted by user via official Android dialog
                val intent = Intent(this, MediaProjectionService::class.java)
                startService(intent)
                webView.evaluateJavascript("window.onAndroidScreenCapturePermissionGranted && window.onAndroidScreenCapturePermissionGranted();", null)
            } else {
                webView.evaluateJavascript("window.onAndroidScreenCapturePermissionDenied && window.onAndroidScreenCapturePermissionDenied('Permiso de captura denegado por el usuario');", null)
            }
        }
    }
}

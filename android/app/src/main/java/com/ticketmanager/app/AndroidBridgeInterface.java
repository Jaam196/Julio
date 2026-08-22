package com.ticketmanager.app;

import android.webkit.JavascriptInterface;

public class AndroidBridgeInterface {

    private final MainActivity activity;

    public AndroidBridgeInterface(MainActivity activity) {
        this.activity = activity;
    }

    @JavascriptInterface
    public boolean isNativeAndroidAvailable() {
        return true;
    }

    @JavascriptInterface
    public void requestScreenCapturePermission() {
        if (activity != null) {
            activity.startScreenCaptureIntent();
        }
    }

    @JavascriptInterface
    public void startScreenCaptureService() {
        if (activity != null) {
            activity.startContinuousCapture(2000);
        }
    }

    @JavascriptInterface
    public void stopScreenCaptureService() {
        if (activity != null) {
            activity.stopScreenCaptureService();
        }
    }

    @JavascriptInterface
    public void startContinuousCapture(int intervalMs) {
        if (activity != null) {
            activity.startContinuousCapture(intervalMs);
        }
    }

    @JavascriptInterface
    public void stopContinuousCapture() {
        if (activity != null) {
            activity.stopContinuousCapture();
        }
    }

    @JavascriptInterface
    public void postTicketToNative(String ticketNumber) {
        // Logged or synced with Android system notification / state
    }

    @JavascriptInterface
    public void discoverServerOnNetwork() {
        if (activity != null) {
            activity.discoverServerOnNetwork();
        }
    }

    @JavascriptInterface
    public void setServerUrl(String url) {
        if (activity != null && url != null && !url.trim().isEmpty()) {
            activity.loadServerUrl(url.trim());
        }
    }
}

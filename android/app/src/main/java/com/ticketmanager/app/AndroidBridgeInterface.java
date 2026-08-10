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
    public void stopScreenCaptureService() {
        if (activity != null) {
            activity.stopScreenCaptureService();
        }
    }

    @JavascriptInterface
    public void postTicketToNative(String ticketNumber) {
        // Logged or synced with Android system notification / state
    }
}

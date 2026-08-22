# Proguard rules for TicketManager
-keepattributes JavascriptInterface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keep class com.ticketmanager.app.AndroidBridgeInterface { *; }

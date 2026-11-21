# The app is a thin WebView host; keep the JS bridge methods.
-keepclassmembers class cc.gunnac.offline.** {
    @android.webkit.JavascriptInterface <methods>;
}

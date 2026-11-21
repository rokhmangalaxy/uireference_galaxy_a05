package cc.gunnac.offline

import android.annotation.SuppressLint
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.OpenableColumns
import android.view.View
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewAssetLoader.AssetsPathHandler
import java.io.ByteArrayInputStream

/**
 * Thin, fully offline Kotlin host for the web player.
 *
 * - The whole player (HTML/JS/WASM-free JS emulator) lives in
 *   `assets/web/index.html`, loaded through WebViewAssetLoader so it runs on a
 *   proper https origin (service workers, IndexedDB and audio worklets all
 *   behave like they would online) without any network access.
 * - The manifest has no INTERNET permission: nothing can leave the device.
 * - Opening a `.nes` file from a file manager is supported via ACTION_VIEW;
 *   the bytes are handed to the JS layer through [Bridge].
 */
class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var assetLoader: WebViewAssetLoader

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)

        assetLoader = WebViewAssetLoader.Builder()
            .setDomain("appassets.androidplatform.net")
            .addPathHandler("/assets/", AssetsPathHandler(this))
            .addPathHandler("/roms/", RomPathHandler(this))
            .build()

        webView = WebView(this).apply {
            layoutParams = android.view.ViewGroup.LayoutParams(
                android.view.ViewGroup.LayoutParams.MATCH_PARENT,
                android.view.ViewGroup.LayoutParams.MATCH_PARENT,
            )
            setBackgroundColor(0xFF0B0F14.toInt())
            overScrollMode = View.OVER_SCROLL_NEVER
            isHapticFeedbackEnabled = true
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                databaseEnabled = true
                allowFileAccess = false
                allowContentAccess = false
                mediaPlaybackRequiresUserGesture = false
                cacheMode = WebSettings.LOAD_DEFAULT
                useWideViewPort = true
                loadWithOverviewMode = true
                mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            }
            addJavascriptInterface(Bridge(), "AndroidBridge")
            webViewClient = object : WebViewClient() {
                override fun shouldInterceptRequest(
                    view: WebView,
                    request: WebResourceRequest,
                ): WebResourceResponse? =
                    assetLoader.shouldInterceptRequest(request.url)

                override fun shouldOverrideUrlLoading(
                    view: WebView,
                    request: WebResourceRequest,
                ): Boolean {
                    // Never leave the app for anything (the app is offline).
                    return !request.url.toString().startsWith(BASE_URL)
                }
            }
        }

        setContentView(webView)
        webView.loadUrl("$BASE_URL/index.html")

        // Keep the screen on while a game is running.
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        handleRomIntent(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleRomIntent(intent)
    }

    /**
     * ACTION_VIEW with a .nes file: read it (with a size guard), base64-encode
     * and push it into the player once the page has finished loading.
     */
    private fun handleRomIntent(intent: Intent?) {
        val uri: Uri = intent?.data ?: return
        val name = queryDisplayName(uri) ?: "game.nes"
        if (!name.lowercase().endsWith(".nes")) {
            toast(getString(R.string.not_a_rom))
            return
        }
        val bytes = try {
            contentResolver.openInputStream(uri)?.use { input ->
                val buffer = input.readBytes()
                if (buffer.size > MAX_ROM_BYTES) {
                    toast(getString(R.string.rom_too_big))
                    return
                }
                buffer
            }
        } catch (e: Exception) {
            null
        } ?: run {
            toast(getString(R.string.rom_unreadable))
            return
        }

        val payload = android.util.Base64.encodeToString(bytes, android.util.Base64.NO_WRAP)
        webView.postDelayed({
            webView.evaluateJavascript(
                "window.__gunNacOpenRom('${name.replace("'", "")}', '$payload');",
                null,
            )
        }, 800)
    }

    private fun queryDisplayName(uri: Uri): String? =
        contentResolver.query(uri, null, null, null, null)?.use { cursor ->
            val index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
            if (index >= 0 && cursor.moveToFirst()) cursor.getString(index) else null
        }

    private fun toast(msg: String) = Toast.makeText(this, msg, Toast.LENGTH_LONG).show()

    override fun onPause() {
        super.onPause()
        webView.evaluateJavascript("window.__gunNacPause && window.__gunNacPause();", null)
    }

    override fun onResume() {
        super.onResume()
        webView.evaluateJavascript("window.__gunNacResume && window.__gunNacResume();", null)
    }

    override fun onDestroy() {
        webView.destroy()
        super.onDestroy()
    }

    override fun onBackPressed() {
        // Back exits the app rather than navigating the (single-page) player.
        if (webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }

    /** Optional JS -> Kotlin entry points (haptics, safe-area info, etc.). */
    inner class Bridge {
        @JavascriptInterface
        fun vibrate(ms: Long) = webView.performHapticFeedback(
            android.view.HapticFeedbackConstants.VIRTUAL_KEY,
        )

        @JavascriptInterface
        fun isNativeShell(): Boolean = true

        @JavascriptInterface
        fun toast(message: String) {
            runOnUiThread { toast(message) }
        }
    }

    /**
     * Serves ROMs bundled in assets/roms/ (e.g. test.nes, or a personal dump
     * you placed there before building). Files are read-only and local.
     */
    private class RomPathHandler(private val activity: MainActivity) :
        WebViewAssetLoader.PathHandler {
        override fun handle(path: String): WebResourceResponse? {
            val clean = path.trimStart('/')
            if (clean.isEmpty() || clean.contains("..")) return null
            val bytes = try {
                activity.assets.open("web/roms/$clean").use { it.readBytes() }
            } catch (e: Exception) {
                return null
            }
            return WebResourceResponse(
                "application/octet-stream",
                null,
                200,
                "OK",
                mapOf("Cache-Control" to "no-store"),
                ByteArrayInputStream(bytes),
            )
        }
    }

    companion object {
        private const val BASE_URL = "https://appassets.androidplatform.net/assets/web"
        private const val MAX_ROM_BYTES = 8 * 1024 * 1024
    }
}

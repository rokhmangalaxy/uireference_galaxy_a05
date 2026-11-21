package com.rokhmangalaxy.pocketnes

import android.annotation.SuppressLint
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.OpenableColumns
import android.util.Base64
import android.util.Log
import android.view.View
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewAssetLoader.AssetsPathHandler
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.util.zip.ZipInputStream

/**
 * Fully offline Kotlin host for the NES player.
 *
 * ROM import works three ways, because WebView file pickers are the usual
 * failure point on Android:
 *   1. In-page "Import ROM" -> <input type=file> -> [onShowFileChooser] opens
 *      the Android document picker (this is the piece that was missing before).
 *   2. ACTION_VIEW / "Open with" on a .nes file from any file manager.
 *   3. ROMs dropped into assets/web/roms/ at build time (served read-only).
 */
class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var assetLoader: WebViewAssetLoader
    private var filePathCallback: ValueCallback<Array<Uri>>? = null

    /** Code queued until the page has signalled that app.js is live. */
    private val pendingJs = ArrayDeque<String>()
    private var webReady = false

    private val pickRom: ActivityResultLauncher<Array<String>> =
        registerForActivityResult(ActivityResultContracts.OpenMultipleDocuments()) { uris ->
            val callback = filePathCallback
            filePathCallback = null
            if (uris.isNullOrEmpty()) {
                callback?.onReceiveValue(null)
                return@registerForActivityResult
            }
            if (callback != null) {
                // Coming from <input type=file>: hand the first URI to the
                // page, load any extras ourselves.
                callback.onReceiveValue(arrayOf(uris.first()))
                uris.drop(1).forEach { sendRomToWebView(it) }
            } else {
                // Coming from AndroidBridge.openRomPicker(): there is no
                // <input> callback, so every URI (including the FIRST one, which
                // used to be dropped here) must be loaded by us.
                uris.forEach { sendRomToWebView(it) }
            }
        }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)

        assetLoader = WebViewAssetLoader.Builder()
            .setDomain(DOMAIN)
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
            // The page owns all scrolling; the WebView itself must never be
            // able to scroll horizontally (that was the "scroll to the left"
            // symptom) nor bounce vertically.
            isHorizontalScrollBarEnabled = false
            isVerticalScrollBarEnabled = false
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                databaseEnabled = true
                allowFileAccess = false
                allowContentAccess = false
                mediaPlaybackRequiresUserGesture = false
                cacheMode = WebSettings.LOAD_DEFAULT
                // WebView used to grow the layout viewport whenever the page
                // was even slightly too wide, which let the whole UI be panned
                // sideways. The page is already responsive, so the viewport
                // must simply match the device width.
                useWideViewPort = false
                loadWithOverviewMode = false
                // Keep 100dvh == the real visible height while the on-screen
                // keyboard or system bars resize the window.
                setSupportZoom(false)
                builtInZoomControls = false
                displayZoomControls = false
                textZoom = 100
                mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            }
            addJavascriptInterface(Bridge(), "AndroidBridge")

            // ---- THE IMPORT FIX ----------------------------------------
            // Without a WebChromeClient, <input type=file> is inert in a
            // WebView: tapping "Import ROM" does nothing at all.
            webChromeClient = object : WebChromeClient() {
                override fun onShowFileChooser(
                    view: WebView,
                    callback: ValueCallback<Array<Uri>>,
                    params: FileChooserParams,
                ): Boolean {
                    filePathCallback?.onReceiveValue(null)
                    filePathCallback = callback
                    return try {
                        pickRom.launch(
                            arrayOf(
                                "application/octet-stream",
                                "application/x-nes-rom",
                                "application/zip",
                                "application/x-zip-compressed",
                                "application/x-unif-rom",
                                "*/*",
                            ),
                        )
                        true
                    } catch (e: Exception) {
                        filePathCallback = null
                        toast(getString(R.string.no_file_picker))
                        false
                    }
                }
            }

            webViewClient = object : WebViewClient() {
                override fun shouldInterceptRequest(
                    view: WebView,
                    request: WebResourceRequest,
                ): WebResourceResponse? = assetLoader.shouldInterceptRequest(request.url)

                override fun shouldOverrideUrlLoading(
                    view: WebView,
                    request: WebResourceRequest,
                ): Boolean = !request.url.toString().startsWith(BASE_URL)

                override fun onPageFinished(view: WebView, url: String) {
                    // Fallback: if app.js never calls onWebReady() (older build,
                    // JS error), flush anyway after the page settles.
                    view.postDelayed({ if (!webReady) flushPendingJs() }, 1500)
                }
            }
        }

        setContentView(webView)
        webView.loadUrl("$BASE_URL/index.html")

        // Rotation, system bars, split-screen and the keyboard all resize the
        // WebView without a JS "resize" event we can rely on. Refit the canvas
        // whenever the view's own bounds change so it never overflows again.
        webView.addOnLayoutChangeListener { _, left, top, right, bottom, oL, oT, oR, oB ->
            if (right - left != oR - oL || bottom - top != oB - oT) {
                runJs("window.__gunNacResize && window.__gunNacResize();")
            }
        }

        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleRomIntent(intent)
    }

    @Deprecated("Requires Android 13+ media permissions to read arbitrary files")
    override fun onResume() {
        super.onResume()
        handleRomIntent(intent)
        runJs("window.__gunNacResume && window.__gunNacResume();")
    }

    override fun onPause() {
        super.onPause()
        runJs("window.__gunNacPause && window.__gunNacPause();")
    }

    /** "Open with" on a .nes file: read, unzip if needed, hand to JS. */
    private fun handleRomIntent(intent: Intent?) {
        val uri: Uri = intent?.data ?: return
        // Only handle each intent once.
        if (intent.hasExtra(HANDLED_EXTRA)) return
        intent.putExtra(HANDLED_EXTRA, true)

        val name = queryDisplayName(uri) ?: "game.nes"
        val lower = name.lowercase()
        if (!SUPPORTED.any { lower.endsWith(it) }) {
            toast(getString(R.string.not_a_rom, name))
            return
        }
        sendRomToWebView(uri, name)
    }

    private fun sendRomToWebView(uri: Uri, displayName: String? = null) {
        val name = displayName ?: queryDisplayName(uri) ?: "game.nes"
        val bytes = try {
            readRomBytes(uri)
        } catch (e: Exception) {
            null
        }
        if (bytes == null || bytes.isEmpty()) {
            toast(getString(R.string.rom_unreadable))
            return
        }
        if (bytes.size > MAX_ROM_BYTES) {
            toast(getString(R.string.rom_too_big))
            return
        }
        val safeName = name.substringAfterLast('/').replace("'", "").replace("\\", "")
        val payload = Base64.encodeToString(bytes, Base64.NO_WRAP)
        // Large ROMs are sent in chunks: some WebView builds choke on a single
        // multi-hundred-KB evaluateJavascript argument.
        val chunks = payload.chunked(CHUNK_CHARS)
        runJs("window.__gunNacRomBegin && window.__gunNacRomBegin('$safeName', ${chunks.size});")
        chunks.forEachIndexed { index, chunk ->
            runJs("window.__gunNacRomChunk && window.__gunNacRomChunk('$safeName', $index, '$chunk');")
        }
        runJs("window.__gunNacRomEnd && window.__gunNacRomEnd('$safeName');")
        toast(getString(R.string.rom_loading, name))
    }

    /** Runs JS now if the page is ready, otherwise as soon as it is. */
    private fun runJs(code: String) {
        if (webReady) {
            webView.post { webView.evaluateJavascript(code, null) }
        } else {
            pendingJs.addLast(code)
            if (pendingJs.size > 64) pendingJs.removeFirst()
        }
    }

    private fun flushPendingJs() {
        webReady = true
        while (pendingJs.isNotEmpty()) {
            webView.evaluateJavascript(pendingJs.removeFirst(), null)
        }
    }

    /** Reads a ROM, transparently unpacking the first .nes entry of a .zip. */
    private fun readRomBytes(uri: Uri): ByteArray? {
        val raw = contentResolver.openInputStream(uri)?.use { it.readBytes() } ?: return null
        val isZip = raw.size > 4 && raw[0] == 'P'.code.toByte() && raw[1] == 'K'.code.toByte()
        if (!isZip) return raw
        ZipInputStream(ByteArrayInputStream(raw)).use { zip ->
            while (true) {
                val entry = zip.nextEntry ?: break
                val entryName = entry.name.lowercase()
                if (SUPPORTED.any { entryName.endsWith(it) }) {
                    val out = ByteArrayOutputStream()
                    val buf = ByteArray(64 * 1024)
                    var total = 0
                    while (true) {
                        val read = zip.read(buf)
                        if (read <= 0) break
                        total += read
                        if (total > MAX_ROM_BYTES) return null
                        out.write(buf, 0, read)
                    }
                    return out.toByteArray()
                }
            }
        }
        return null
    }

    private fun queryDisplayName(uri: Uri): String? =
        contentResolver.query(uri, null, null, null, null)?.use { cursor ->
            val index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
            if (index >= 0 && cursor.moveToFirst()) cursor.getString(index) else null
        }

    private fun toast(msg: String) = Toast.makeText(this, msg, Toast.LENGTH_LONG).show()

    override fun onDestroy() {
        filePathCallback?.onReceiveValue(null)
        filePathCallback = null
        webView.destroy()
        super.onDestroy()
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }

    /** Optional JS -> Kotlin entry points. */
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

        /**
         * JS fallback for browsers/WebViews where <input type=file> is not
         * available: window.AndroidBridge.openRomPicker() opens the same
         * Android document picker.
         */
        @JavascriptInterface
        fun openRomPicker() {
            runOnUiThread {
                try {
                    pickRom.launch(arrayOf("*/*"))
                } catch (e: Exception) {
                    toast(getString(R.string.no_file_picker))
                }
            }
        }

        @JavascriptInterface
        fun sdkInt(): Int = Build.VERSION.SDK_INT

        /** app.js calls this when the player is constructed and listening. */
        @JavascriptInterface
        fun onWebReady() {
            runOnUiThread { flushPendingJs() }
        }

        /** JS-side diagnostics land in logcat so "nothing happens" is debuggable. */
        @JavascriptInterface
        fun log(message: String) {
            Log.i("PocketNesBridge", message)
        }
    }

    /** Serves ROMs bundled in assets (roms/test.nes, or a personal dump). */
    private class RomPathHandler(@Suppress("unused") private val activity: MainActivity) :
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
        private const val DOMAIN = "appassets.androidplatform.net"
        private const val BASE_URL = "https://$DOMAIN/assets/web"
        private const val MAX_ROM_BYTES = 8 * 1024 * 1024
        private const val HANDLED_EXTRA = "cc.rom.handled"
        private const val CHUNK_CHARS = 60_000
        private val SUPPORTED = listOf(".nes", ".fds", ".unf", ".unif")
    }
}

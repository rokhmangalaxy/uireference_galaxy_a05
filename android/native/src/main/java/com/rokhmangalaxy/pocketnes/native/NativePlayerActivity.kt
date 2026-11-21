package com.rokhmangalaxy.pocketnes.native

import android.graphics.Bitmap
import android.os.Bundle
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.widget.Button
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import android.window.OnBackInvokedDispatcher
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import kotlin.concurrent.thread

/**
 * Minimal native player: Bitmap-scaled ImageView + Kotlin touch controls,
 * driven by the FCEUmm core through [NativeNes].
 *
 * Everything here is Kotlin; the C++ part is only the emulator core. That is
 * the answer to "bisa native kotlin?" — the *glue* is Kotlin, the *core* stays
 * C because every accurate NES core is C/C++ (and GPL).
 */
class NativePlayerActivity : AppCompatActivity() {

    private lateinit var screen: ImageView
    private lateinit var status: TextView
    private var session: NativeNes.Session? = null
    private var buttons = 0
    private var running = false

    private val pickRom = registerForActivityResult(
        ActivityResultContracts.OpenDocument(),
    ) { uri ->
        if (uri == null) return@registerForActivityResult
        val bytes = contentResolver.openInputStream(uri)?.use { it.readBytes() }
        if (bytes == null) {
            status.text = getString(R.string.rom_unreadable)
            return@registerForActivityResult
        }
        loadRom(bytes)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val root = FrameLayout(this).apply { setBackgroundColor(0xFF0B0F14.toInt()) }

        screen = ImageView(this).apply {
            scaleType = ImageView.ScaleType.FIT_CENTER
            setBackgroundColor(0xFF000000.toInt())
        }
        root.addView(
            screen,
            FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT,
            ),
        )

        status = TextView(this).apply {
            setTextColor(0xFFE7EEF7.toInt())
            textSize = 13f
            text = getString(R.string.choose_rom)
            setPadding(28, 28, 28, 28)
        }
        root.addView(
            status,
            FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.WRAP_CONTENT,
                FrameLayout.LayoutParams.WRAP_CONTENT,
                Gravity.CENTER,
            ),
        )

        root.addView(buildControls(), FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.WRAP_CONTENT,
            Gravity.BOTTOM,
        ))

        setContentView(root)

        if (!NativeNes.isAvailable) {
            status.text = getString(R.string.core_missing)
            return
        }
        pickRom.launch(arrayOf("*/*"))

        if (android.os.Build.VERSION.SDK_INT >= 33) {
            onBackInvokedDispatcher.registerOnBackInvokedCallback(
                OnBackInvokedDispatcher.PRIORITY_DEFAULT,
            ) { finish() }
        }
    }

    // ------------------------------------------------------------- controls --
    private fun buildControls(): View {
        val row = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            setPadding(24, 16, 24, 48)
            gravity = Gravity.BOTTOM
        }

        fun pad(label: String, mask: Int): Button = Button(this).apply {
            text = label
            textSize = 14f
            setOnTouchListener { v, event ->
                when (event.actionMasked) {
                    MotionEvent.ACTION_DOWN -> {
                        v.isPressed = true
                        buttons = buttons or mask
                    }
                    MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                        v.isPressed = false
                        buttons = buttons and mask.inv()
                    }
                }
                true
            }
        }

        val dpad = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        dpad.addView(pad("▲", NativeNes.Buttons.UP))
        val mid = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        mid.addView(pad("◀", NativeNes.Buttons.LEFT))
        mid.addView(pad("▶", NativeNes.Buttons.RIGHT))
        dpad.addView(mid)
        dpad.addView(pad("▼", NativeNes.Buttons.DOWN))
        row.addView(dpad, LinearLayout.LayoutParams(0, -2, 1f))

        val face = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.BOTTOM or Gravity.END
        }
        face.addView(pad("B", NativeNes.Buttons.B))
        face.addView(pad("A", NativeNes.Buttons.A))
        face.addView(pad("Start", NativeNes.Buttons.START))
        face.addView(pad("Select", NativeNes.Buttons.SELECT))
        row.addView(face, LinearLayout.LayoutParams(0, -2, 1f))

        return row
    }

    // ------------------------------------------------------------ emulation --
    private fun loadRom(bytes: ByteArray) {
        if (!NativeNes.isAvailable) {
            status.text = getString(R.string.core_missing)
            return
        }
        session?.close()
        session = NativeNes.open(bytes, filesDir.absolutePath)
        val s = session
        if (s == null || !s.isValid) {
            status.text = getString(R.string.rom_unreadable)
            return
        }
        status.text = ""
        running = true
        thread(name = "nes-core", isDaemon = true) {
            val frameMs = 1000L / 60L
            var last = System.nanoTime()
            while (running) {
                val bmp: Bitmap? = s.step(buttons)
                if (bmp != null) runOnUiThread { screen.setImageBitmap(bmp) }
                val now = System.nanoTime()
                val elapsed = (now - last) / 1_000_000
                last = now
                val sleep = frameMs - elapsed
                if (sleep > 0) Thread.sleep(sleep) else Thread.yield()
            }
        }
    }

    override fun onDestroy() {
        running = false
        session?.close()
        session = null
        super.onDestroy()
    }
}

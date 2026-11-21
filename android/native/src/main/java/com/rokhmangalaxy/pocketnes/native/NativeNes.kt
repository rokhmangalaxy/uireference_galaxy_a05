package com.rokhmangalaxy.pocketnes.native

import android.graphics.Bitmap
import android.util.Log

/**
 * Kotlin facade over the FCEUmm JNI shim (see nes/src/main/cpp/nes_jni.cpp).
 *
 * The native library is loaded lazily so the app still starts on devices/ABIs
 * where the core was not packaged.
 */
object NativeNes {

    private const val TAG = "NativeNes"

    val isAvailable: Boolean by lazy {
        try {
            System.loadLibrary("pocketnes_native")
            true
        } catch (e: UnsatisfiedLinkError) {
            Log.w(TAG, "native core unavailable: ${e.message}")
            false
        }
    }

    // ------------------------------------------------------------------- ABI --
    external fun create(libDir: String?): Long
    external fun loadRom(handle: Long, rom: ByteArray): Boolean
    external fun runFrame(handle: Long)
    external fun videoBuffer(handle: Long): IntArray?
    external fun setButtons(handle: Long, mask: Int)
    external fun reset(handle: Long)
    external fun saveState(handle: Long): ByteArray?
    external fun loadState(handle: Long, state: ByteArray): Boolean
    external fun destroy(handle: Long)

    // --------------------------------------------------------------- session --
    /** One emulator instance bound to a loaded ROM. Not thread-safe by design. */
    class Session(private val handle: Long) {

        val isValid: Boolean get() = handle != 0L

        private var bitmap: Bitmap? = null

        /** Runs one frame and returns the 256x240 picture, reusing one Bitmap. */
        fun step(buttons: Int = 0): Bitmap? {
            if (handle == 0L) return null
            setButtons(handle, buttons)
            runFrame(handle)
            val pixels = videoBuffer(handle) ?: return null
            val bmp = bitmap ?: Bitmap.createBitmap(SCREEN_W, SCREEN_H, Bitmap.Config.ARGB_8888)
                .also { bitmap = it }
            bmp.setPixels(pixels, 0, SCREEN_W, 0, 0, SCREEN_W, SCREEN_H)
            return bmp
        }

        fun saveState(): ByteArray? = if (handle != 0L) saveState(handle) else null
        fun loadState(state: ByteArray): Boolean = handle != 0L && loadState(handle, state)

        fun close() {
            if (handle != 0L) destroy(handle)
        }
    }

    fun open(rom: ByteArray, libDir: String? = null): Session? {
        if (!isAvailable) return null
        val handle = create(libDir) ?: 0L
        if (handle == 0L) return null
        if (!loadRom(handle, rom)) {
            destroy(handle)
            return null
        }
        return Session(handle)
    }

    /**
     * Compact controller bitmask shared with the JNI shim:
     * 0=A? no — bit0 B, bit1 A, bit2 Select, bit3 Start, bit4 Up, bit5 Down,
     * bit6 Left, bit7 Right.
     */
    object Buttons {
        const val B = 1 shl 0
        const val A = 1 shl 1
        const val SELECT = 1 shl 2
        const val START = 1 shl 3
        const val UP = 1 shl 4
        const val DOWN = 1 shl 5
        const val LEFT = 1 shl 6
        const val RIGHT = 1 shl 7
    }

    const val SCREEN_W = 256
    const val SCREEN_H = 240
}

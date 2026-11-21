# "Native Kotlin" — jawaban lengkap

Pertanyaan: *apakah bisa native Kotlin, atau adakah repository publik emulator?*

## Ringkasnya

| Pendekatan | Bahasa | Lisensi | Status di repo ini |
|---|---|---|---|
| **WebView + jsnes** (build default) | JS + Kotlin host | Apache-2.0 jsnes, MIT kode kita | ✅ jalan, APK `apk-6` |
| **JNI + libretro FCEUmm** | C core + **Kotlin** UI | GPLv2 core | 🧩 modul `android/native` (butuh NDK + submodule) |
| FCEUmm/Nestopia/Mesen di RetroArch | C/C++ | GPLv2/GPLv3 | ❌ bukan app sendiri, tapi tersedia & stabil |
| [Nestalgia](https://github.com/tiagohm/nestalgia) | Kotlin, Mesen port | GPLv3 | ⚠️ JVM/JavaFX, belum Android |
| [Nostalgia.NES](https://github.com/NostalgiaEmulators) | Java + FCEUX | GPLv3 | ⚠️ arsip, sumber via goo.gl mati |
| [NESlop](https://github.com/RemagOfficial/NESlop) | Kotlin + Compose | — | ⚠️ hanya mapper 0 & 4 (cukup untuk Gun Nac) |
| [nestlin](https://github.com/alondero/nestlin) | Kotlin, 12 mapper | — | ⚠️ desktop (JavaFX) |
| [kNES](https://github.com/ArturSkowronski/kNES) | Kotlin, vNES port | — | ⚠️ mapper 0/1 saja |

**Kesimpulan jujur:** tidak ada emulator NES *pure Kotlin* yang akurat, aktif,
dan siap Android. Yang ada: (a) core C/C++ GPL — cepat & akurat; atau
(b) proyek Kotlin eksperimental dengan 1–12 mapper. Gun Nac memakai **MMC3
(mapper 4)**, jadi NESlop secara teknis cukup — tapi untuk koleksi ROM, FCEUmm
jauh lebih aman.

## Kalau mau build native (modul `android/native`)

```bash
git submodule update --init --recursive      # ambil libretro-fceumm
cd android
./gradlew -PenableNative=true :native:assembleDebug
```

Yang sudah ada di repo:

- `android/nes/src/main/cpp/CMakeLists.txt` — compile core + shim JNI
- `android/nes/src/main/cpp/nes_jni.cpp` — binding libretro → JNI
  (`create`, `loadRom`, `runFrame`, `videoBuffer`, `setButtons`, `saveState`,
  `loadState`, `reset`, `destroy`)
- `android/native/.../NativeNes.kt` — facade Kotlin + bitmask tombol
- `android/native/.../NativePlayerActivity.kt` — ImageView + kontrol sentuh,
  loop 60 fps di thread terpisah

Yang belum: audio native (AudioTrack) dan surface GLES. Keduanya "tinggal
sambung": shim sudah punya `audio_batch_cb` dan buffer ARGB.

## Konsekuensi lisensi (penting kalau mau dipublikasikan)

FCEUmm GPLv2, Nestopia GPLv2, Mesen GPLv3. APK yang menautkannya **wajib**
menyediakan source lengkap aplikasi (repo ini sudah publik — biarkan begitu),
menyertakan teks lisensi, dan tidak boleh menambah DRM/IAP yang bertentangan.
Build WebView (`:app`) tidak terkena kewajiban ini.

## Rekomendasi

1. **Sekarang:** pakai build WebView yang sudah jalan (`apk-6`), import ROM
   sudah diperbaiki (native file picker + ZIP + Open-with).
2. **Kalau butuh akurasi/kecepatan ekstra:** aktifkan modul native + FCEUmm.
3. **Kalau butuh "tanpa C, tanpa JS":** fork NESlop (Kotlin, mapper 0+4) dan
   tambahkan mapper sesuai kebutuhan — realistis, tapi Anda memelihara CPU/PPU
   sendiri.

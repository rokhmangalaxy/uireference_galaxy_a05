# Gun Nac Offline Player

Jawaban singkat untuk pertanyaan **"bisakah offline atau Kotlin?"**: **bisa
dua-duanya**, dan sudah ada di repo ini.

| | |
|---|---|
| **Offline** | Player NES berbasis jsnes yang berjalan 100% di perangkat. Setelah dibuka sekali, aplikasi bisa jalan tanpa internet (service worker + PWA). ROM disimpan di IndexedDB perangkat, tidak pernah diunggah. |
| **Kotlin** | Wrapper Android native (`android/`) yang men-host player yang sama di WebView, **tanpa izin INTERNET** sama sekali. Mendukung buka file `.nes` dari file manager, gamepad, kontrol sentuh, dan keep-screen-on. |

Yang **tidak** ada di repo ini — dan tidak boleh ditambahkan — adalah ROM
komersialnya. Gun Nac (1990 Compile / 1991 ASCII) masih berhak cipta. Aplikasi
ini adalah *player*; Anda memasukkan dump cartridge milik sendiri
(`gun-nac-usa.nes`). Retrogames.cc memutar game itu di server mereka; repo ini
memutarnya secara lokal dari file Anda.

---

## 1. Coba sekarang (web, offline)

```bash
npm install
npm run build          # bundle emulator + build ROM uji legal
npm run serve          # http://localhost:8080
```

Buka di browser → tombol **☰** → **Import ROM** → pilih file `.nes` Anda.
Tombol **▶ Test ROM** memutar ROM buatan sendiri untuk memastikan emulator
sehat tanpa file berhak cipta.

### Benar-benar offline?

1. Buka aplikasi sekali saat server masih hidup (service worker meng-cache
   `index.html`, `app.js`, `emulator.js`, ikon, test ROM).
2. Matikan server / putus jaringan, lalu reload — aplikasi tetap jalan.
3. Di Android/Chrome: menu browser → *Add to Home screen* memasangnya sebagai
   app (manifest PWA lengkap).

Build satu file untuk dibagikan/di-double-click:

```
dist/gun-nac-offline.html   # JS di-inline, cukup buka di browser
```

## 2. Unduh APK siap pakai

APK debug sudah dibangun otomatis oleh GitHub Actions dan diterbitkan sebagai
release asset (tidak perlu login):

**https://github.com/rokhmangalaxy/uireference_galaxy_a05/releases**

- Paket `com.rokhmangalaxy.pocketnes` · minSdk 24 (Android 7+) · targetSdk 35
- Ukuran 3.671.754 byte (± 3,5 MB) · **tanpa izin INTERNET**
- Release terbaru: **apk-8** — sha256
  `7519fae3d133fe988acd0e2e43c0c989f57acdadc7677d70c8b36ee047f5d6ac`
  (dibuat & diverifikasi CI, termasuk `apksigner verify`). Ini build pertama
  yang import ROM-nya benar-benar jalan; apk-7 dan sebelumnya **jangan**
  dipakai lagi.
- Install: unduh di HP → izinkan *Install unknown apps* untuk browser → buka
  APK. Buka file `.nes` dari file manager → *Open with* → **Pocket NES**.

Setiap push yang mengubah `android/`, `src/`, atau `tools/` memicu build baru
(`.github/workflows/android-apk.yml`), mengunggah artifact
`gun-nac-offline-debug-apk`, dan membuat release `apk-<nomor>`.

## 3. Import ROM di APK (diperbaiki total di apk-8)

- **Import ROM** memakai *Android document picker* lewat
  `WebChromeClient.onShowFileChooser` — inilah yang hilang sebelumnya, sehingga
  menekan tombol tidak melakukan apa pun di WebView.
- Bisa memilih **beberapa file** sekaligus, termasuk `.zip` (entry `.nes`
  pertama diekstrak di Kotlin).
- Alternatif: buka `.nes` dari file manager → *Open with* → **Pocket NES**.
- Kalau picker tidak tersedia, fallback `AndroidBridge.openRomPicker()`.
- Save state slot 1/2 kini benar-benar menyimpan (listener sebelumnya
  terpasang pada elemen yang sudah dihapus).

## 4. Build aplikasi Kotlin (Android) dari sumber

```bash
npm install && npm run build     # menyalin dist/ ke android/app/src/main/assets/web
cd android
./gradlew assembleDebug          # butuh JDK 17 + Android SDK
adb install app/build/outputs/apk/debug/app-debug.apk
```

Atau buka folder `android/` di Android Studio (Gradle wrapper 8.11, AGP 8.7,
Kotlin 2.0, minSdk 24, targetSdk 35).

**Cara kerja wrapper Kotlin** (`android/app/src/main/java/cc/gunnac/offline/MainActivity.kt`):

- `WebViewAssetLoader` menyajikan `assets/web/` lewat origin
  `https://appassets.androidplatform.net` — jadi IndexedDB, audio worklet, dan
  service worker bekerja normal tanpa server dan tanpa jaringan.
- `AndroidManifest.xml` **tidak** meminta `android.permission.INTERNET`.
- `ACTION_VIEW` pada file `.nes` (dari file manager / share sheet) dibaca,
  di-base64, dikirim ke `window.__gunNacOpenRom()`, dan dimuat sebagai game.
- Siklus hidup activity mem-pause/resume emulator; layar tetap menyala saat main.
- `assets/web/roms/` bisa memuat ROM pribadi agar ikut di APK; file itu
  di-*serve* oleh `RomPathHandler` (read-only, tanpa path traversal).

## 5. Yang sudah diuji

| Uji | Perintah | Hasil |
|---|---|---|
| Core jsnes: boot ROM → frame berisi piksel | `npm test` → `test/smoke.mjs` | PASS (466 piksel, counter frame naik) |
| Bundle produksi (`dist/emulator.js`) di DOM stub: load → start → render → save state | `node test/bundle.test.mjs` | PASS (31 frame digambar) |
| ROM uji legal bisa dirakit ulang dari sumber 6502 | `node tools/make-test-rom.mjs` | 32 KB, NROM, layar "EMULATOR OK" |

`test/smoke.mjs` dan `test/bundle.test.mjs` juga menerima path ROM Anda
sendiri untuk memastikan game-nya boot:

```bash
node test/smoke.mjs "roms/gun-nac-usa.nes"
```

Build Android dikompilasi di GitHub Actions (JDK 17 + Android SDK 35).
Release `apk-8` adalah build yang lolos: `assembleDebug` sukses, `apksigner
verify` lolos, dan APK memuat `assets/web/` (index.html, emulator.js, app.js,
roms/test.nes) dengan paket `com.rokhmangalaxy.pocketnes`.

Sebelum build, `npm test` menjalankan tiga lapis uji: smoke core (mapper 0 **dan
mapper 4/MMC3** — mapper yang dipakai Gun Nac), uji bundle hasil build, dan
`test/e2e-import.test.mjs` yang meniru alur import di WebView (baik lewat
`<input type=file>` maupun lewat bridge Kotlin, termasuk ROM yang dikirim
bertahap 60 ribu karakter).

## 6. Fitur

- Kontrol sentuh: D-pad radial (geser jempol tanpa lepas), A/B, Start, Select.
- Keyboard: panah, `Z`/`X` (A/B), `Enter` Start, `Shift` Select, `Tab` Select.
- Gamepad standar (USB/Bluetooth) terdeteksi otomatis.
- 2 slot save state + screenshot PNG + battery save (`.sav`) otomatis per ROM.
- Mute, pause, reset, fullscreen, thumbnail library, drag & drop file.
- Info mapper: build ini mendukung mapper 0/1/2/3/4/5/7/9/11/34/38/66/71/79/94/118/119/140/180/240/241 (Gun Nac memakai MMC3/mapper 4).

## 7. Opsi emulator native & repository publik

Ringkasan lengkap: [`docs/EMULATOR-NATIVE.md`](docs/EMULATOR-NATIVE.md).
Modul `android/native/` sudah berisi integrasi **JNI + libretro FCEUmm**
(C core GPLv2, UI Kotlin), diaktifkan dengan
`./gradlew -PenableNative=true :native:assembleDebug`.

## 7b. Kenapa build default bukan native Kotlin?

Build default sengaja tetap WebView + jsnes: satu codebase untuk web & APK,
tanpa NDK, dan tanpa kewajiban GPL. Jalur native tetap tersedia (bagian 7) dan
memakai kontrak JNI yang bersih di `android/nes/src/main/cpp/nes_jni.cpp`.

## 8. Struktur

```
android/native/                           # modul native (JNI + FCEUmm, UI Kotlin)
android/nes/src/main/cpp/                 # CMakeLists + nes_jni.cpp (shim libretro)
docs/EMULATOR-NATIVE.md                   # riset emulator Kotlin & core GPL
index.html, manifest.webmanifest, sw.js   # shell PWA
src/emulator.js                           # glue jsnes: canvas, audio, input, SRAM
src/app.js                                # UI, library, save state, bridge Kotlin
tools/build.mjs                           # esbuild → dist/ + mirror ke assets Android
tools/asm6502.mjs, tools/make-test-rom.mjs, tools/font8x8.mjs  # ROM uji legal
test/smoke.mjs, test/bundle.test.mjs      # uji headless
android/                                  # aplikasi Kotlin (WebView, offline-total)
roms/                                     # tempat Anda menaruh ROM sendiri (gitignored)
docs/UNDUH-DAN-BERMAIN.md                 # panduan hosting/memasang
```

## Lisensi & hak cipta

Kode di repo ini: MIT (lihat `LICENSE`). jsnes: Apache-2.0. Gun Nac © Compile /
ASCII — tidak disertakan, tidak didistribusikan. Gunakan hanya ROM hasil dump
cartridge Anda sendiri; unduh dari situs pihak ketiga (termasuk retrogames.cc)
berisiko melanggar hukum di banyak yurisdiksi.

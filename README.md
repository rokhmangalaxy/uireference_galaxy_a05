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

## 2. Build aplikasi Kotlin (Android)

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

## 3. Yang sudah diuji

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

Build Android tidak bisa dikompilasi di sandbox ini (tidak ada JDK/Android
SDK), jadi langkah Gradle belum dieksekusi — semua source-nya lengkap dan
mengikuti API stabil.

## 4. Fitur

- Kontrol sentuh: D-pad radial (geser jempol tanpa lepas), A/B, Start, Select.
- Keyboard: panah, `Z`/`X` (A/B), `Enter` Start, `Shift` Select, `Tab` Select.
- Gamepad standar (USB/Bluetooth) terdeteksi otomatis.
- 2 slot save state + screenshot PNG + battery save (`.sav`) otomatis per ROM.
- Mute, pause, reset, fullscreen, thumbnail library, drag & drop file.
- Info mapper: build ini mendukung mapper 0/1/2/3/4/5/7/9/11/34/38/66/71/79/94/118/119/140/180/240/241 (Gun Nac memakai MMC3/mapper 4).

## 5. Struktur

```
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

## 6. Kenapa bukan emulator native Kotlin?

Bisa saja (mis. core libretro/Nostalgia.NES via NDK), tapi jsnes memberi hasil
identik untuk NES, jauh lebih mudah diaudit, dan satu codebase dipakai di web +
Android. Jika Anda ingin core Kotlin murni, `android/` siap diganti: kontrak
JS-nya cuma `__gunNacOpenRom`, `__gunNacPause`, `__gunNacResume`.

## Lisensi & hak cipta

Kode di repo ini: MIT (lihat `LICENSE`). jsnes: Apache-2.0. Gun Nac © Compile /
ASCII — tidak disertakan, tidak didistribusikan. Gunakan hanya ROM hasil dump
cartridge Anda sendiri; unduh dari situs pihak ketiga (termasuk retrogames.cc)
berisiko melanggar hukum di banyak yurisdiksi.

# UI Style Gallery

Proyek Android Kotlin + Jetpack Compose untuk membandingkan 20 gaya UI pada layar dan komponen yang sama. Buka menu hamburger di kiri atas, lalu pilih gaya untuk langsung menerapkannya ke aplikasi. Pilihan gaya disimpan di perangkat. Status bar dan navigation bar Android tetap ditampilkan; aplikasi tidak menggunakan mode fullscreen.

## Nama yang digunakan

- **Folder:** `android_ui20`
- **Nama aplikasi:** UI Style Gallery
- **Package / application ID:** `com.emrobinso.uistylegallery`

Alternatif nama: **UI Twenty** (`com.emrobinso.uitwenty`) atau **Style Catalog** (`com.emrobinso.stylecatalog`). ID paket di atas adalah yang benar-benar dipakai proyek ini.

## Menjalankan

1. Buka folder `android_ui20` sebagai proyek di Android Studio versi terbaru.
2. Siapkan JDK 17 dan Android SDK Platform 35; biarkan Android Studio menyinkronkan Gradle dan mengunduh dependensi.
3. Jalankan konfigurasi `app` pada emulator atau perangkat Android 7.0 (API 24) atau lebih baru.

Alternatif melalui terminal, dengan JDK 17 dan Android SDK sudah dikonfigurasi:

```sh
./gradlew :app:assembleDebug
```

APK debug tersedia di `app/build/outputs/apk/debug/`. Untuk melihat Compose Preview di Android Studio, buka `MainActivity.kt` dan pilih **Split** atau **Design**. Ada preview Material Design 3 dan Neon; seluruh 20 gaya dapat dicoba melalui menu aplikasi.

## Build APK dengan GitHub Actions

Workflow `.github/workflows/android-ui20-apk.yml` berjalan pada push, pull request, atau secara manual melalui **Actions → Build Android UI20 APK → Run workflow** (setelah workflow tersedia di branch default). Workflow memasang JDK 17 dan Android SDK 35, lalu menjalankan `:app:assembleDebug`.

Setelah job berhasil, buka halaman run tersebut di tab **Actions**, lalu unduh artifact **ui-style-gallery-debug-apk**. Artifact disimpan selama 14 hari dan berisi `app-debug.apk`. APK ini ditandatangani dengan debug key otomatis, sehingga cocok untuk pengujian, bukan untuk dipublikasikan ke Play Store. Pull request dan push pada branch juga menghasilkan run masing-masing jika Actions aktif di repository.

## Isi dan batasan

Contoh mencakup Material Design 3, Minimalis, Dark Mode, Glassmorphism, Neumorphism, Bento Grid, Flat, Gradient, Brutalist, Pastel, Editorial, Illustration-First, Card-Based, Data-Dense Dashboard, Nature-Inspired, Neon, Retro, Gamified, Luxury, dan Conversational UI.

Setiap gaya mengubah palet, bentuk, dan tipografi komponen yang sama. Layar menyediakan tab, kartu, indikator progres, tombol, dialog, kolom teks, dropdown, radio, switch, slider, checkbox, chip, dan snackbar. Kontrol dapat dicoba dan status formulir dipertahankan saat mengganti gaya, tetapi data rencana hanya contoh dan tidak disimpan atau dikirim ke layanan. Efek kaca dan neumorphism merupakan interpretasi visual sederhana, bukan simulasi blur atau bayangan realistis. Ikon bawaan Material digunakan agar proyek tidak bergantung pada aset gambar eksternal.

Untuk menjalankan tes UI pada emulator atau perangkat yang terhubung:

```sh
./gradlew :app:connectedDebugAndroidTest
```

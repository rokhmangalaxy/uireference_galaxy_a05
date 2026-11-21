# UI Style Gallery

Proyek Android Kotlin + Jetpack Compose yang menampilkan 20 inspirasi gaya UI dalam satu aplikasi. Pilih kartu di galeri untuk melihat contoh layar; gunakan panah kembali atau tombol Back Android untuk kembali ke galeri.

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

APK debug tersedia di `app/build/outputs/apk/debug/`. Untuk melihat Compose Preview di Android Studio, buka `MainActivity.kt` dan pilih **Split** atau **Design**. Ada preview galeri, Bento Grid, dan Dark Mode; seluruh 20 contoh dapat dilihat melalui aplikasi.

## Build APK dengan GitHub Actions

Workflow `.github/workflows/android-ui20-apk.yml` berjalan pada push, pull request, atau secara manual melalui **Actions → Build Android UI20 APK → Run workflow** (setelah workflow tersedia di branch default). Workflow memasang JDK 17 dan Android SDK 35, lalu menjalankan `:app:assembleDebug`.

Setelah job berhasil, buka halaman run tersebut di tab **Actions**, lalu unduh artifact **ui-style-gallery-debug-apk**. Artifact disimpan selama 14 hari dan berisi `app-debug.apk`. APK ini ditandatangani dengan debug key otomatis, sehingga cocok untuk pengujian, bukan untuk dipublikasikan ke Play Store. Pull request dan push pada branch juga menghasilkan run masing-masing jika Actions aktif di repository.

## Isi dan batasan

Contoh mencakup Material Design 3, Minimalis, Dark Mode, Glassmorphism, Neumorphism, Bento Grid, Flat, Gradient, Brutalist, Pastel, Editorial, Illustration-First, Card-Based, Data-Dense Dashboard, Nature-Inspired, Neon, Retro, Gamified, Luxury, dan Conversational UI.

Semua konten, angka, kontrol, dan percakapan di layar contoh adalah **mockup statis** untuk inspirasi visual, bukan fitur aplikasi yang terhubung ke layanan. Navigasi galeri dan tombol kembali berfungsi. Efek kaca dan neumorphism merupakan interpretasi visual sederhana, bukan simulasi blur atau bayangan realistis. Ikon bawaan Material digunakan agar proyek tidak bergantung pada aset gambar eksternal.

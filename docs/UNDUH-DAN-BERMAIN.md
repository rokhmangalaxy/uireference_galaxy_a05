# Panduan: dari repo ke layar game

## Opsi A — main di laptop/HP lewat browser (paling cepat)

1. `npm install && npm run build`
2. `npm run serve`
3. Buka `http://<IP-laptop>:8080` di HP (satu jaringan Wi-Fi) atau
   `http://localhost:8080` di laptop.
4. Tap **☰ → Import ROM**, pilih `gun-nac-usa.nes` hasil dump Anda.
5. Untuk offline penuh: setelah halaman terbuka sekali, tekan *Add to Home
   screen* / *Install app*. Setelah itu Wi-Fi boleh dimatikan.

Alternatif tanpa server: kirim `dist/gun-nac-offline.html` ke HP, buka dengan
browser (semua JS sudah inline; ROM tetap harus diimpor manual karena
keterbatasan keamanan `file://`).

## Opsi B — APK Kotlin (offline total, tanpa browser)

```bash
npm install && npm run build
cd android && ./gradlew assembleDebug
```

APK ada di `android/app/build/outputs/apk/debug/app-debug.apk`. Tidak ada izin
internet, jadi aplikasi ini tidak mungkin mengirim data ke mana pun.

Ingin game langsung terbuka saat app dijalankan? Taruh ROM Anda di
`roms/` **sebelum** `npm run build`; build menyalinnya ke
`android/app/src/main/assets/web/roms/` dan web player bisa memuatnya dari
library lokal (atau buka file `.nes` dari file manager → *Open with* → Gun Nac
Offline).

## Tentang retrogames.cc

Situs itu menjalankan EmulatorJS di browsernya dan memuat ROM dari server
mereka. Itu bukan unduhan offline, dan Anda tidak punya lisensi atas salinan
ROM tersebut. Repo ini sengaja tidak mengunduh atau menyertakan ROM apa pun:
yang disediakan adalah *pemutar* yang sah dipakai dengan dump pribadi.

## Kontrol

| Aksi | Sentuh | Keyboard | Gamepad |
|---|---|---|---|
| Gerak | geser di D-pad | panah | D-pad / stik kiri |
| Tembak (A) | tombol A | `Z` atau `S` | A / B bawah |
| Bom (B) | tombol B | `X` atau `A` | B / A kiri |
| Start | Start | `Enter` | Start |
| Select | Select | `Shift` / `Tab` | Select |
| Pause | ⏸ di bar atas | — | — |
| Save/Load | ☰ → Slot 1/2 | — | — |

Di Gun Nac: A menembak, B memakai bom, Start memulai, Select memilih
senjata/bom di layar status.

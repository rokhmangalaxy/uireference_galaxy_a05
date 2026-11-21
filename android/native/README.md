# Native Kotlin + FCEUmm core (GPLv3)

This directory is the **native** flavour of Pocket NES: the game is emulated by
a C++ core (libretro **FCEUmm**) through JNI, rendered with OpenGL ES and played
through `AudioTrack`. Kotlin is the whole UI and control layer.

The default `:app` (WebView + jsnes) stays the "just works" build; this module
is for people who want zero JavaScript and maximum accuracy/speed.

## Why a C++ core and not "Kotlin only"?

| Option | Language | Licence | Mappers | Verdict |
|---|---|---|---|---|
| **libretro/fceumm** | C | GPLv2 | hundreds (unlicensed incl.) | ✅ accuracy + speed, tiny work |
| libretro/nestopia | C++ | GPLv2 | ~100 % licensed titles | ✅ alternative |
| libretro/Mesen | C++ | GPLv3 | 220+ | ✅ heaviest, best accuracy |
| [Nestalgia](https://github.com/tiagohm/nestalgia) | Kotlin | GPLv3 | 300+ | ⚠️ desktop/JVM (JavaFX), needs port |
| Nostalgia.NES | Java + FCEUX | GPLv3 | FCEUX set | ⚠️ old Android app, abandoned |
| [NESlop](https://github.com/RemagOfficial/NESlop) | Kotlin/Compose | — | NROM + MMC3 | ⚠️ only 2 mappers |

A pure-JVM NES emulator runs at 60 fps on modern phones (jsnes proves it), but
Kotlin-native cores that are both *accurate* and *maintained* on Android barely
exist. Gun Nac itself is MMC3, so a toy core would work — but FCEUmm costs
~1 week of integration and gives you every mapper.

## Setup

```bash
# 1. Core sources (GPLv2). Nothing is vendored into this repo.
git submodule add https://github.com/libretro/libretro-fceumm \
  nes/src/main/cpp/fceumm
git submodule update --init --recursive

# 2. Build (needs NDK r27+; GitHub Actions runners have it).
cd android
./gradlew -PenableNative=true :native:assembleDebug
```

`nes/src/main/cpp/CMakeLists.txt` builds `libfceumm_libretro.so` from those
sources and links the JNI shim `nes/src/main/cpp/nes_jni.cpp`.

## JNI contract (implemented in `nes/src/main/cpp/nes_jni.cpp`)

```kotlin
external fun create(): Long                       // returns core handle
external fun loadRom(handle: Long, data: ByteArray): Boolean
external fun runFrame(handle: Long): Boolean      // returns false when done
external fun videoBuffer(handle: Long): IntArray  // 256x240 ARGB
external fun setButtons(handle: Long, mask: Int)  // bitmask, see NES_BTN_*
external fun reset(handle: Long)
external fun saveState(handle: Long): ByteArray
external fun loadState(handle: Long, state: ByteArray)
external fun destroy(handle: Long)
```

## Licence obligations (read this before publishing)

FCEUmm and Nestopia are **GPLv2**, Mesen is **GPLv3**. Shipping an APK that
links them means:

1. You must publish the complete corresponding source of **your app** under the
   same licence (this repo already is public — keep it that way), and
2. keep the licence texts + a written offer to provide source in the APK
   (put them in `assets/licenses/`), and
3. you cannot add Google Play in-app purchases / DRM that conflicts with the
   GPL, and some stores treat GPL apps carefully.

If you need a permissively licensed core, there is currently **no** accurate
NES core under MIT/BSD/Apache; the closest is writing your own (see NESlop and
nestlin for references) or using jsnes (MIT-ish Apache-2.0, what `:app` does).

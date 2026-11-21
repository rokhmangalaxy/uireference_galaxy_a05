// JNI shim around the libretro FCEUmm core.
//
// This is the *integration* layer, not the emulator. It resolves the libretro
// entry points from libfceumm_libretro.so at runtime, feeds ROM bytes to the
// core, converts 0RGB1555 video to ARGB ints for Kotlin, and maps our compact
// button bitmask onto libretro JOYPAD ids.
//
// The emulator itself (GPLv2) lives in the fceumm/ git submodule — never here.
#include <jni.h>
#include <android/log.h>
#include <dlfcn.h>

#include <cstdint>
#include <cstring>
#include <vector>

#define LOG_TAG "PocketNES"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)

// ------------------------------------------------------------- libretro ABI --
// Declared locally so this file compiles even before the submodule is added.
// Values are stable per the libretro API (see libretro.h).
extern "C" {
struct retro_game_info {
    const char* path;
    const void* data;
    size_t size;
    const char* meta;
};

typedef bool (*retro_environment_t)(unsigned cmd, void* data);
typedef void (*retro_video_refresh_t)(const void* data, unsigned width,
                                      unsigned height, size_t pitch);
typedef void (*retro_audio_sample_t)(int16_t left, int16_t right);
typedef size_t (*retro_audio_sample_batch_t)(const int16_t* data, size_t frames);
typedef void (*retro_input_poll_t)(void);
typedef int16_t (*retro_input_state_t)(unsigned port, unsigned device,
                                       unsigned index, unsigned id);
}

namespace {

constexpr unsigned ENV_GET_CAN_DUPE = 3;
constexpr unsigned ENV_SET_PIXEL_FORMAT = 10;
constexpr unsigned ENV_GET_SYSTEM_DIRECTORY = 9;
constexpr unsigned ENV_GET_SAVE_DIRECTORY = 31;

constexpr unsigned DEVICE_JOYPAD = 1;
constexpr unsigned ID_B = 0;
constexpr unsigned ID_A = 8;
constexpr unsigned ID_SELECT = 2;
constexpr unsigned ID_START = 3;
constexpr unsigned ID_UP = 4;
constexpr unsigned ID_DOWN = 5;
constexpr unsigned ID_LEFT = 6;
constexpr unsigned ID_RIGHT = 7;

constexpr int SCREEN_W = 256;
constexpr int SCREEN_H = 240;

struct Core {
    std::vector<uint32_t> frame = std::vector<uint32_t>(SCREEN_W * SCREEN_H, 0xFF000000u);
    uint16_t buttons = 0;
    bool loaded = false;

    void (*init)() = nullptr;
    void (*deinit)() = nullptr;
    void (*set_environment)(retro_environment_t) = nullptr;
    void (*set_video)(retro_video_refresh_t) = nullptr;
    void (*set_audio)(retro_audio_sample_t) = nullptr;
    void (*set_audio_batch)(retro_audio_sample_batch_t) = nullptr;
    void (*set_input_poll)(retro_input_poll_t) = nullptr;
    void (*set_input_state)(retro_input_state_t) = nullptr;
    bool (*load_game)(const retro_game_info*) = nullptr;
    void (*unload_game)() = nullptr;
    void (*run)() = nullptr;
    size_t (*serialize_size)() = nullptr;
    bool (*serialize)(void*, size_t) = nullptr;
    bool (*unserialize)(const void*, size_t) = nullptr;
};

Core* g_core = nullptr;

bool environment(unsigned cmd, void* data) {
    switch (cmd) {
        case ENV_SET_PIXEL_FORMAT:
            // We convert 0RGB1555 ourselves; accept whatever the core picks.
            return true;
        case ENV_GET_CAN_DUPE:
            if (data) *static_cast<bool*>(data) = true;
            return data != nullptr;
        case ENV_GET_SAVE_DIRECTORY:
        case ENV_GET_SYSTEM_DIRECTORY:
            if (data) *static_cast<const char**>(data) = nullptr;
            return data != nullptr;
        default:
            return false;
    }
}

void video_cb(const void* data, unsigned width, unsigned height, size_t pitch) {
    if (!g_core || !data) return;
    if (width == 0 || height == 0) return;
    const auto* base = static_cast<const uint8_t*>(data);
    for (unsigned y = 0; y < height && y < SCREEN_H; y++) {
        const auto* row = reinterpret_cast<const uint16_t*>(base + y * pitch);
        for (unsigned x = 0; x < width && x < SCREEN_W; x++) {
            const uint16_t c = row[x];
            const uint32_t r = static_cast<uint32_t>((c >> 10) & 0x1F) << 3;
            const uint32_t g = static_cast<uint32_t>((c >> 5) & 0x1F) << 3;
            const uint32_t b = static_cast<uint32_t>(c & 0x1F) << 3;
            g_core->frame[y * SCREEN_W + x] = 0xFF000000u | (r << 16) | (g << 8) | b;
        }
    }
}

void audio_cb(int16_t, int16_t) {}

size_t audio_batch_cb(const int16_t* data, size_t frames) {
    // Kotlin pulls audio with its own AudioTrack buffer; the shim only has to
    // keep the core running. Wire this to a ring buffer if you want the exact
    // mixing path rather than the per-frame pull.
    (void)data;
    return frames;
}

void input_poll_cb() {}

int16_t input_state_cb(unsigned port, unsigned device, unsigned, unsigned id) {
    if (!g_core || port != 0 || device != DEVICE_JOYPAD) return 0;
    switch (id) {
        case ID_A: return (g_core->buttons & (1 << 1)) ? 1 : 0;
        case ID_B: return (g_core->buttons & (1 << 0)) ? 1 : 0;
        case ID_SELECT: return (g_core->buttons & (1 << 2)) ? 1 : 0;
        case ID_START: return (g_core->buttons & (1 << 3)) ? 1 : 0;
        case ID_UP: return (g_core->buttons & (1 << 4)) ? 1 : 0;
        case ID_DOWN: return (g_core->buttons & (1 << 5)) ? 1 : 0;
        case ID_LEFT: return (g_core->buttons & (1 << 6)) ? 1 : 0;
        case ID_RIGHT: return (g_core->buttons & (1 << 7)) ? 1 : 0;
        default: return 0;
    }
}

template <typename T>
bool bind(T& fn, void* lib, const char* name) {
    fn = reinterpret_cast<T>(dlsym(lib, name));
    if (!fn) LOGE("missing symbol: %s", name);
    return fn != nullptr;
}

}  // namespace

extern "C" JNIEXPORT jlong JNICALL
Java_com_rokhmangalaxy_pocketnes_native_NativeNes_create(JNIEnv*, jobject, jstring libDir) {
    (void)libDir;
    // RTLD_GLOBAL so the core's own dependencies resolve.
    void* lib = dlopen("libfceumm_libretro.so", RTLD_NOW | RTLD_GLOBAL);
    if (!lib) {
        LOGE("dlopen failed: %s", dlerror());
        return 0;
    }
    auto* core = new Core();
    bool ok = bind(core->init, lib, "retro_init") &&
              bind(core->deinit, lib, "retro_deinit") &&
              bind(core->set_environment, lib, "retro_set_environment") &&
              bind(core->set_video, lib, "retro_set_video_refresh") &&
              bind(core->set_audio, lib, "retro_set_audio_sample") &&
              bind(core->set_audio_batch, lib, "retro_set_audio_sample_batch") &&
              bind(core->set_input_poll, lib, "retro_set_input_poll") &&
              bind(core->set_input_state, lib, "retro_set_input_state") &&
              bind(core->load_game, lib, "retro_load_game") &&
              bind(core->unload_game, lib, "retro_unload_game") &&
              bind(core->run, lib, "retro_run");
    if (!ok) {
        delete core;
        return 0;
    }
    // Optional: save states.
    bind(core->serialize_size, lib, "retro_serialize_size");
    bind(core->serialize, lib, "retro_serialize");
    bind(core->unserialize, lib, "retro_unserialize");

    g_core = core;
    core->set_environment(environment);
    core->set_video(video_cb);
    core->set_audio(audio_cb);
    core->set_audio_batch(audio_batch_cb);
    core->set_input_poll(input_poll_cb);
    core->set_input_state(input_state_cb);
    core->init();
    LOGI("core created");
    return reinterpret_cast<jlong>(core);
}

extern "C" JNIEXPORT jboolean JNICALL
Java_com_rokhmangalaxy_pocketnes_native_NativeNes_loadRom(
    JNIEnv* env, jobject, jlong handle, jbyteArray rom) {
    auto* core = reinterpret_cast<Core*>(handle);
    if (!core || !rom) return JNI_FALSE;
    const jsize len = env->GetArrayLength(rom);
    std::vector<uint8_t> bytes(static_cast<size_t>(len));
    env->GetByteArrayRegion(rom, 0, len, reinterpret_cast<jbyte*>(bytes.data()));

    retro_game_info info{};
    info.path = nullptr;
    info.data = bytes.data();
    info.size = bytes.size();
    info.meta = nullptr;
    core->loaded = core->load_game(&info);
    LOGI("loadRom %d bytes -> %s", len, core->loaded ? "ok" : "failed");
    return core->loaded ? JNI_TRUE : JNI_FALSE;
}

extern "C" JNIEXPORT void JNICALL
Java_com_rokhmangalaxy_pocketnes_native_NativeNes_runFrame(
    JNIEnv*, jobject, jlong handle) {
    auto* core = reinterpret_cast<Core*>(handle);
    if (core && core->loaded && core->run) core->run();
}

extern "C" JNIEXPORT jintArray JNICALL
Java_com_rokhmangalaxy_pocketnes_native_NativeNes_videoBuffer(
    JNIEnv* env, jobject, jlong handle) {
    auto* core = reinterpret_cast<Core*>(handle);
    if (!core) return nullptr;
    jintArray out = env->NewIntArray(SCREEN_W * SCREEN_H);
    if (!out) return nullptr;
    env->SetIntArrayRegion(out, 0, SCREEN_W * SCREEN_H,
                           reinterpret_cast<const jint*>(core->frame.data()));
    return out;
}

extern "C" JNIEXPORT void JNICALL
Java_com_rokhmangalaxy_pocketnes_native_NativeNes_setButtons(
    JNIEnv*, jobject, jlong handle, jint mask) {
    auto* core = reinterpret_cast<Core*>(handle);
    if (core) core->buttons = static_cast<uint16_t>(mask);
}

extern "C" JNIEXPORT void JNICALL
Java_com_rokhmangalaxy_pocketnes_native_NativeNes_reset(
    JNIEnv*, jobject, jlong handle) {
    auto* core = reinterpret_cast<Core*>(handle);
    // Easiest portable reset: re-init the core. FCEUmm also exposes
    // retro_reset, but re-init keeps this shim independent of optional symbols.
    if (core && core->init) {
        if (core->deinit) core->deinit();
        core->init();
        core->loaded = true;
    }
}

extern "C" JNIEXPORT jbyteArray JNICALL
Java_com_rokhmangalaxy_pocketnes_native_NativeNes_saveState(
    JNIEnv* env, jobject, jlong handle) {
    auto* core = reinterpret_cast<Core*>(handle);
    if (!core || !core->serialize_size || !core->serialize) return nullptr;
    const size_t size = core->serialize_size();
    if (size == 0) return nullptr;
    std::vector<uint8_t> buffer(size);
    if (!core->serialize(buffer.data(), size)) return nullptr;
    jbyteArray out = env->NewByteArray(static_cast<jsize>(size));
    env->SetByteArrayRegion(out, 0, static_cast<jsize>(size),
                            reinterpret_cast<const jbyte*>(buffer.data()));
    return out;
}

extern "C" JNIEXPORT jboolean JNICALL
Java_com_rokhmangalaxy_pocketnes_native_NativeNes_loadState(
    JNIEnv* env, jobject, jlong handle, jbyteArray state) {
    auto* core = reinterpret_cast<Core*>(handle);
    if (!core || !core->unserialize || !state) return JNI_FALSE;
    const jsize len = env->GetArrayLength(state);
    std::vector<uint8_t> buffer(static_cast<size_t>(len));
    env->GetByteArrayRegion(state, 0, len, reinterpret_cast<jbyte*>(buffer.data()));
    return core->unserialize(buffer.data(), buffer.size()) ? JNI_TRUE : JNI_FALSE;
}

extern "C" JNIEXPORT void JNICALL
Java_com_rokhmangalaxy_pocketnes_native_NativeNes_destroy(
    JNIEnv*, jobject, jlong handle) {
    auto* core = reinterpret_cast<Core*>(handle);
    if (!core) return;
    if (core->loaded && core->unload_game) core->unload_game();
    if (core->deinit) core->deinit();
    g_core = nullptr;
    delete core;
}

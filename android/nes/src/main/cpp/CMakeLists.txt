# Builds (1) the GPLv2 FCEUmm libretro core and (2) a small JNI shim that
# exposes it to Kotlin. Core sources are a git submodule (see native/README.md).
cmake_minimum_required(VERSION 3.22.1)
project(pocketnes_native C CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

set(CORE_DIR ${CMAKE_CURRENT_SOURCE_DIR}/fceumm)
if(NOT EXISTS ${CORE_DIR}/Makefile)
    message(FATAL_ERROR
        "FCEUmm sources missing. Run:\n"
        "  git submodule add https://github.com/libretro/libretro-fceumm \\\n"
        "    android/nes/src/main/cpp/fceumm\n"
        "  git submodule update --init --recursive")
endif()

# ------------------------------------------------------------------ core ----
# libretro-fceumm ships a plain Makefile (no CMake), so we list its sources the
# same way the upstream Makefile does.
file(GLOB FCEUMM_SRC
    ${CORE_DIR}/src/*.c
    ${CORE_DIR}/src/boards/*.c
    ${CORE_DIR}/src/input/*.c
    ${CORE_DIR}/src/utils/*.c
    ${CORE_DIR}/src/video/*.c
    ${CORE_DIR}/src/sound/*.c)

add_library(fceumm_libretro SHARED ${FCEUMM_SRC})
target_include_directories(fceumm_libretro PRIVATE
    ${CORE_DIR}/src
    ${CORE_DIR}/src/libretro-common/include)
target_compile_definitions(fceumm_libretro PRIVATE
    __LIBRETRO__
    HAVE_STRL)
target_link_libraries(fceumm_libretro PRIVATE log)

# ------------------------------------------------------------------- shim ---
add_library(pocketnes_native SHARED nes_jni.cpp)
target_include_directories(pocketnes_native PRIVATE
    ${CORE_DIR}/src/libretro-common/include)
target_link_libraries(pocketnes_native PRIVATE android log dl)

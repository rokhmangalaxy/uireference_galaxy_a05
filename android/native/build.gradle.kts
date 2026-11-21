plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.rokhmangalaxy.pocketnes.native"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.rokhmangalaxy.pocketnes.native"
        minSdk = 24
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0-native"

        ndk { abiFilters += listOf("arm64-v8a", "armeabi-v7a", "x86_64") }
        externalNativeBuild {
            cmake {
                cppFlags += listOf("-O2", "-fexceptions", "-frtti")
            }
        }
    }

    externalNativeBuild {
        cmake {
            // NES core sources live in ../nes/src/main/cpp (libretro-fceumm).
            path = file("../nes/src/main/cpp/CMakeLists.txt")
            version = "3.22.1"
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("debug")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    buildFeatures { buildConfig = true }
}

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.appcompat:appcompat:1.7.0")
}

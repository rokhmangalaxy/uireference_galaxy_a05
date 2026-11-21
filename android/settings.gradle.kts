pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "PocketNES"

// WebView player (default, no native code) and the optional-native flavour.
include(":app")
// Needs the Android NDK (r27+) and libretro-fceumm sources; see native/README.md.
// Enable with: ./gradlew -PenableNative=true :native:assembleDebug
if (providers.gradleProperty("enableNative").orNull == "true") {
    include(":native")
}

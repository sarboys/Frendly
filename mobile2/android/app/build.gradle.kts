import java.util.Base64

plugins {
    id("com.android.application")
    id("kotlin-android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

fun dartDefine(name: String): String? {
    val raw = findProperty("dart-defines")?.toString().orEmpty()
    if (raw.isEmpty()) return null

    return raw.split(",")
        .mapNotNull { encoded ->
            runCatching {
                String(Base64.getDecoder().decode(encoded), Charsets.UTF_8)
            }.getOrNull()
        }
        .firstNotNullOfOrNull { define ->
            val parts = define.split("=", limit = 2)
            if (parts.size == 2 && parts[0] == name) parts[1] else null
        }
}

fun buildConfigString(value: String): String {
    return "\"${value.replace("\\", "\\\\").replace("\"", "\\\"")}\""
}

val yandexClientId = findProperty("YANDEX_CLIENT_ID")?.toString()
    ?: System.getenv("BIG_BREAK_YANDEX_CLIENT_ID")
    ?: dartDefine("BIG_BREAK_YANDEX_CLIENT_ID")
    ?: ""

val mapkitApiKey = findProperty("BIG_BREAK_MAPKIT_API_KEY")?.toString()
    ?: System.getenv("BIG_BREAK_MAPKIT_API_KEY")
    ?: dartDefine("BIG_BREAK_MAPKIT_API_KEY")
    ?: ""

android {
    namespace = "com.sergeypolyakov.dateasy.mobile2"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    buildFeatures {
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = JavaVersion.VERSION_17.toString()
    }

    defaultConfig {
        // TODO: Specify your own unique Application ID (https://developer.android.com/studio/build/application-id.html).
        applicationId = "com.sergeypolyakov.dateasy.mobile2.dev"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = 26
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
        manifestPlaceholders["YANDEX_CLIENT_ID"] = yandexClientId
        buildConfigField("String", "MAPKIT_API_KEY", buildConfigString(mapkitApiKey))
    }

    buildTypes {
        release {
            // TODO: Add your own signing config for the release build.
            // Signing with the debug keys for now, so `flutter run --release` works.
            signingConfig = signingConfigs.getByName("debug")
        }
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("com.yandex.android:maps.mobile:4.22.0-full")
    implementation("com.yandex.android:authsdk:3.1.3")
}

flutter {
    source = "../.."
}

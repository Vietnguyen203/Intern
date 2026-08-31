plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("com.google.gms.google-services")
}

android {
    namespace = "com.food.order"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.food.order"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        vectorDrawables.useSupportLibrary = true
    }

    buildTypes {
        // Dev / Emulator → gọi BE ở host qua 10.0.2.2
        getByName("debug") {
            buildConfigField("String", "BASE_URL", "\"http://10.0.2.2:8080/foodordersystem/api/\"")
            buildConfigField("String", "FILE_BASE_URL", "\"http://10.0.2.2:8080/\"")

            manifestPlaceholders["usesCleartext"] = "true"
        }
        // Release nội bộ / LAN
        getByName("release") {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            buildConfigField("String", "BASE_URL", "\"http://192.168.1.6:8080/foodordersystem/api/\"")
            buildConfigField("String", "FILE_BASE_URL", "\"http://192.168.1.6:8080/\"")
            manifestPlaceholders["usesCleartext"] = "false"
        }
    }

    // Tránh xung đột META-INF khi merge tài nguyên
    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1,LICENSE*,LICENSE,NOTICE*,DEPENDENCIES,INDEX.LIST}"
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
        // coreLibraryDesugaringEnabled = true // chỉ cần nếu dùng API Java mới ở minSdk thấp
    }
    kotlinOptions { jvmTarget = "17" }

    buildFeatures {
        buildConfig = true
        viewBinding = true
    }
}

dependencies {
    // AndroidX cơ bản (dùng version catalog của bạn)
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.appcompat)
    implementation(libs.material)
    implementation(libs.androidx.constraintlayout)

    // Lifecycle + ViewModel
    implementation(libs.androidx.lifecycle.livedata.ktx)
    implementation(libs.androidx.lifecycle.viewmodel.ktx)
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.6") // bổ sung runtime-ktx

    // Fragment / Navigation
    implementation("androidx.fragment:fragment-ktx:1.8.2")            // bổ sung fragment-ktx
    implementation(libs.androidx.navigation.fragment.ktx)
    implementation(libs.androidx.navigation.ui.ktx)

    // UI & Recycler
    implementation("androidx.recyclerview:recyclerview:1.3.2")       // bổ sung RecyclerView
    implementation("androidx.swiperefreshlayout:swiperefreshlayout:1.1.0") // cho SwipeRefreshLayout
    implementation(libs.lottie)
    implementation(libs.glide)

    // Retrofit + Gson
    implementation(libs.retrofit)
    implementation(libs.converter.gson.v290)

    // Coroutines
    implementation(libs.kotlinx.coroutines.core)
    implementation(libs.kotlinx.coroutines.android)

    // Firebase BOM — quản lý version tập trung
    implementation(platform("com.google.firebase:firebase-bom:33.1.0"))
    implementation("com.google.firebase:firebase-messaging-ktx")

    // HTTP logging (debug tiện)
    implementation("com.squareup.okhttp3:logging-interceptor:4.12.0")

    // AndroidX Security — EncryptedSharedPreferences để lưu JWT (thay vì SharedPreferences thường)
    implementation("androidx.security:security-crypto:1.1.0-alpha06")

    // AnyChart (loại bỏ support v4 cũ)
    implementation("com.github.AnyChart:AnyChart-Android:1.1.2") {
        exclude(group = "com.android.support")
        exclude(module = "support-v4")
        exclude(module = "support-compat")
    }

    testImplementation(libs.junit)
    androidTestImplementation(libs.androidx.junit)
    androidTestImplementation(libs.androidx.espresso.core)

    // Đồng bộ phiên bản để tránh Duplicate classes nếu có lib kéo version khác
    constraints {
        implementation("com.google.code.gson:gson:2.10.1") {
            because("Avoid duplicate classes due to transitive gson from multiple libs")
        }
        implementation("com.squareup.okio:okio:3.6.0")
        implementation("com.squareup.okhttp3:okhttp:4.12.0")
    }

    // Nếu bật desugaring:
    // coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.0.4")
}

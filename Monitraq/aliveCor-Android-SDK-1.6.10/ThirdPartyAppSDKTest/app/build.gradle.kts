plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "com.alivecor.testapp"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.alivecor.testapp"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "1.6.10-test"

        multiDexEnabled = true

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        debug {
            // The Testing Mixpanel Project
            buildConfigField("Boolean", "LOG_ENABLED", "true")
            buildConfigField("Boolean", "LOG_REMOTE", "true")
            buildConfigField("Boolean", "ALLOW_STAGING", "true")
            buildConfigField("Boolean", "ENABLE_TEST_PREFS", "true")

            buildConfigField("String", "BUNDLE_ID_V1", "\"${project.findProperty("BUNDLE_ID_V1") ?: ""}\"")
            buildConfigField("String", "BUNDLE_ID_V2", "\"${project.findProperty("BUNDLE_ID_V2") ?: ""}\"")
            buildConfigField("String", "PARTNER_ID", "\"${project.findProperty("PARTNER_ID") ?: ""}\"")
            buildConfigField("String", "TEAM_ID", "\"${project.findProperty("TEAM_ID") ?: ""}\"")
            buildConfigField("String", "AUTH_TOKEN", "\"${project.findProperty("AUTH_TOKEN") ?: ""}\"")
        }
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )

            buildConfigField("String", "BUNDLE_ID_V1", "\"${project.findProperty("BUNDLE_ID_V1") ?: ""}\"")
            buildConfigField("String", "BUNDLE_ID_V2", "\"${project.findProperty("BUNDLE_ID_V2") ?: ""}\"")
            buildConfigField("String", "PARTNER_ID", "\"${project.findProperty("PARTNER_ID") ?: ""}\"")
            buildConfigField("String", "TEAM_ID", "\"${project.findProperty("TEAM_ID") ?: ""}\"")
            buildConfigField("String", "AUTH_TOKEN", "\"${project.findProperty("AUTH_TOKEN") ?: ""}\"")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        compose = true
        viewBinding = true
        dataBinding = true
        buildConfig = true
    }

}

dependencies {
    val multidex_version = "2.0.1"
    implementation("androidx.multidex:multidex:$multidex_version")

    implementation(project(":AliveCorKitLite-release"))

    // implementation("androidx.core:core-ktx:1.17.0")
    // implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.9.4")
    // implementation("androidx.activity:activity-compose:1.11.0")

    implementation(platform("androidx.compose:compose-bom:2024.09.00"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("com.google.android.material:material:1.13.0")

    // External Dependencies, must have
    implementation("androidx.localbroadcastmanager:localbroadcastmanager:1.1.0")

    implementation("io.reactivex.rxjava2:rxandroid:${rootProject.ext["rxAndroidVersion"]}")
    implementation("io.reactivex.rxjava2:rxjava:${rootProject.ext["rxJavaVersion"]}")

    implementation("com.google.code.gson:gson:${rootProject.ext["gsonVersion"]}")
    implementation("com.github.bosphere.android-filelogger:filelogger:1.0.7")

    implementation("androidx.navigation:navigation-fragment-ktx:2.8.1")
    implementation("androidx.navigation:navigation-ui-ktx:2.8.1")
    implementation("androidx.security:security-crypto:1.1.0-alpha06") // must be in apk

    implementation("com.jakewharton.timber:timber:${rootProject.ext["timberVersion"]}")
    implementation("androidx.preference:preference-ktx:1.2.1")

    implementation("com.squareup.retrofit2:retrofit:${rootProject.ext["retrofitVersion"]}")
    implementation("com.squareup.retrofit2:converter-gson:${rootProject.ext["retrofitVersion"]}")
    implementation("com.squareup.retrofit2:adapter-rxjava2:${rootProject.ext["retrofitVersion"]}")
    implementation("com.squareup.retrofit2:converter-scalars:${rootProject.ext["retrofitVersion"]}")
    implementation("com.squareup.okhttp3:logging-interceptor:${rootProject.ext["okhttp3"]}")

    implementation("com.airbnb.android:lottie:6.6.10")
    implementation("net.danlew:android.joda:${rootProject.ext["jodaVersion"]}")
    implementation("org.joda:joda-convert:3.0.1")

    // Room DB
    implementation("androidx.room:room-runtime:${rootProject.ext["roomVersion"]}")
    implementation("androidx.room:room-common:${rootProject.ext["roomVersion"]}")
    annotationProcessor("androidx.room:room-compiler:${rootProject.ext["roomVersion"]}")
    implementation("androidx.room:room-ktx:${rootProject.ext["roomVersion"]}")
    implementation("androidx.room:room-rxjava2:${rootProject.ext["roomVersion"]}")

    // dependency injection
    api("com.google.dagger:dagger:${rootProject.ext["daggerVersion"]}")
    api("com.google.dagger:dagger-android:${rootProject.ext["daggerVersion"]}")
    api("com.google.dagger:dagger-android-support:${rootProject.ext["daggerVersion"]}")
    annotationProcessor("com.google.dagger:dagger-android-processor:${rootProject.ext["daggerVersion"]}")
    annotationProcessor("com.google.dagger:dagger-compiler:${rootProject.ext["daggerVersion"]}")

    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.3.0")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.7.0")
    androidTestImplementation(platform("androidx.compose:compose-bom:2024.09.00"))
    androidTestImplementation("androidx.compose.ui:ui-test-junit4")
    debugImplementation("androidx.compose.ui:ui-tooling")
    debugImplementation("androidx.compose.ui:ui-test-manifest")
}

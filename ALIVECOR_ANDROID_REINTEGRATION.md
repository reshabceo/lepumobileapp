# AliveCor SDK Android Re-integration Guide

This document details the step-by-step instructions required to re-integrate the AliveCor SDK and restore the `AliveCorSDK` Capacitor plugin in the Android project.

---

## 🛠 Re-integration Steps

### 1. Restore the Binary AAR SDK
Copy the SDK library from the vendor zip to the local libs folder:
```bash
unzip -j Monitraq/Android-SDK-1.7.3.zip "Android-SDK-1.7.3/AliveCorKitLite-core-1.7.3-ec954cb3.aar" -d android/app/libs/
```

### 2. Re-enable the Capacitor Plugin File
Rename the disabled java plugin file back to `.java` to include it in the compilation:
```bash
mv android/app/src/main/java/com/monitraq/mobile/plugins/AliveCorPlugin.java.disabled android/app/src/main/java/com/monitraq/mobile/plugins/AliveCorPlugin.java
```

### 3. Re-enable Build Dependencies
In [android/app/build.gradle](file:///Users/mdsahil/development/lepumobileapp/android/app/build.gradle), uncomment both of the commented out AliveCor dependencies blocks (search for `AliveCor SDK integration` and `AliveCor transitive dependencies`).

Uncomment these sections:
```gradle
    // AliveCor SDK integration - REQUIRED dependencies for the AAR (v1.7.3)
    implementation files('libs/AliveCorKitLite-core-1.7.3-ec954cb3.aar')
    implementation 'net.danlew:android.joda:2.12.5'
    implementation 'com.squareup.retrofit2:retrofit:2.9.0'
    implementation 'com.squareup.retrofit2:converter-gson:2.9.0'
    implementation 'com.squareup.retrofit2:converter-scalars:2.9.0'
    implementation 'com.squareup.retrofit2:adapter-rxjava2:2.9.0'
    implementation 'com.squareup.okhttp3:okhttp:4.12.0'
    implementation 'com.squareup.okhttp3:logging-interceptor:4.12.0'
    implementation 'io.reactivex.rxjava2:rxjava:2.2.21'
    implementation 'io.reactivex.rxjava2:rxandroid:2.1.1'
    implementation 'com.jakewharton.timber:timber:5.0.1'
    implementation 'com.google.dagger:dagger:2.51.1'
    annotationProcessor 'com.google.dagger:dagger-compiler:2.51.1'
    implementation 'androidx.room:room-runtime:2.7.1'
    implementation 'androidx.room:room-rxjava2:2.7.1'
    implementation 'androidx.sqlite:sqlite:2.5.1'
    implementation 'androidx.sqlite:sqlite-framework:2.5.1'
    implementation 'com.airbnb.android:lottie:6.4.0'
    implementation 'org.jetbrains.kotlin:kotlin-stdlib:2.2.0'
    implementation 'org.jetbrains.kotlinx:kotlinx-coroutines-android:1.10.2'
    implementation 'org.jetbrains.kotlinx:kotlinx-coroutines-core:1.10.2'

    // AliveCor transitive dependencies
    implementation 'com.github.bosphere.android-filelogger:filelogger:1.0.7'
    implementation 'io.reactivex.rxjava2:rxandroid:2.1.1'
    implementation 'io.reactivex.rxjava2:rxjava:2.2.21'
    implementation 'com.squareup.okhttp3:logging-interceptor:4.12.0'
```

### 4. Restore MainActivity Plugin Registration
In [android/app/src/main/java/com/monitraq/mobile/MainActivity.java](file:///Users/mdsahil/development/lepumobileapp/android/app/src/main/java/com/monitraq/mobile/MainActivity.java):
- Uncomment the import statement:
  ```java
  import com.monitraq.mobile.plugins.AliveCorPlugin;
  ```
- Uncomment the registration block inside `onCreate`:
  ```java
  try {
      initialPlugins.add(AliveCorPlugin.class);
      Log.d(TAG, "✅ AliveCorPlugin added to initialPlugins");
  } catch (Exception e) {
      Log.e(TAG, "❌ Failed to add AliveCorPlugin: " + e.getMessage(), e);
  }
  ```

### 5. Restore MainApplication SDK Joda-Time Init
In [android/app/src/main/java/com/monitraq/mobile/MainApplication.java](file:///Users/mdsahil/development/lepumobileapp/android/app/src/main/java/com/monitraq/mobile/MainApplication.java):
- Uncomment the import statement:
  ```java
  import net.danlew.android.joda.JodaTimeAndroid;
  ```
- Uncomment the initialization block inside `onCreate`:
  ```java
  // Initialize Joda-Time for AliveCor SDK
  JodaTimeAndroid.init(this);
  ```

### 6. Restore Manifest Permissions
In [android/app/src/main/AndroidManifest.xml](file:///Users/mdsahil/development/lepumobileapp/android/app/src/main/AndroidManifest.xml), uncomment the AliveCor-specific permissions block:
```xml
    <!-- AliveCor SDK specific permissions -->
    <uses-permission android:name="android.permission.NFC" />
    <uses-permission android:name="android.permission.BODY_SENSORS" />
    <uses-permission android:name="android.permission.ACTIVITY_RECOGNITION" />
```

### 7. Clean and Rebuild Project
Run clean and build Gradle commands to ensure a fresh build context:
```bash
cd android
./gradlew clean assembleDebug
```

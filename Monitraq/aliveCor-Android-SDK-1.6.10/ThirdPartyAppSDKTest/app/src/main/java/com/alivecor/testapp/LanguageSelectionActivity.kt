package com.alivecor.testapp

import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.Spinner
import androidx.appcompat.app.AppCompatActivity
import com.alivecor.api.AliveCorKitLite
import com.alivecor.common.LanguageUtils
import java.util.Locale

class LanguageSelectionActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.setDecorFitsSystemWindows(true)
        }

        setContentView(R.layout.activity_language_selection)

        // Spinner initialization
        val languageSpinner: Spinner = findViewById(R.id.language_spinner)
        val context = applicationContext

        // List<String> supportedLanguages = LanguageUtils.INSTANCE.getSupportedLanguages(context);
        val supportedLanguages: List<LanguageUtils.Language> = AliveCorKitLite.getSupportedLanguages(context)
        for (language in supportedLanguages) {
            Log.d("MainApp", "Supported Language :" + language.toString())
        }

        // Create an adapter for the Spinner
        val adapter = ArrayAdapter(this, android.R.layout.simple_spinner_item, supportedLanguages)
        adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
        languageSpinner.adapter = adapter

        // Button to select the language and open MainActivity
        val selectLanguageButton: Button = findViewById(R.id.select_language_button)
        selectLanguageButton.setOnClickListener {
            // Get the selected language from the Spinner
            val selectedLanguage = languageSpinner.selectedItem as LanguageUtils.Language

            // Change the locale to the selected language
            LanguageUtils.setAppLocale(context, selectedLanguage.code, resources)

            // Open MainActivity and pass the selected language
            val intent = Intent(this, MainActivity::class.java).apply {
                putExtra("SELECTED_LANGUAGE_CODE", selectedLanguage.code)
                putExtra("SELECTED_LANGUAGE_NAME", selectedLanguage.name)
            }
            startActivity(intent)
        }
    }

    /**
     * Function to set the application's locale
     * languageCode: String could be two symbols or five for example "cs" "pt-rPT"
      */
    private fun setAppLocale(languageCode: String) {
        Log.d("MainApp", "SELECTED_LANGUAGE_CODE :" + languageCode)
        // Split language and country from the locale code
        val parts = languageCode.split("-")
        val language = parts[0]
        val country = if (parts.size > 1) parts[1] else ""

        // Create a Locale object with language and country
        val locale = if (country.isNotEmpty()) Locale(language, country) else Locale(language)

        // Set locale
        Locale.setDefault(locale)
        val config = resources.configuration
        config.setLocale(locale)
        config.setLayoutDirection(locale) // Optional: Set layout direction if needed

        // Update the configuration for the application's context
        val context = createConfigurationContext(config)
        resources.updateConfiguration(config, resources.displayMetrics)
    }

}

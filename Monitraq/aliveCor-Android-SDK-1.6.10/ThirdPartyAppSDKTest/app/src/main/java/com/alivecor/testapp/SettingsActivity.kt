package com.alivecor.testapp

import android.os.Build
import android.os.Bundle
import android.os.PersistableBundle
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.preference.Preference
import androidx.preference.PreferenceFragmentCompat
import androidx.preference.PreferenceManager
import com.alivecor.api.AliveCorKitLite
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import timber.log.Timber

class SettingsActivity : AppCompatActivity(),
    PreferenceFragmentCompat.OnPreferenceStartFragmentCallback {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.setDecorFitsSystemWindows(true)
        }

        setContentView(R.layout.activity_preference)

        if (savedInstanceState == null) {
            supportFragmentManager
                .beginTransaction()
                .replace(R.id.content_preference, GeneralPreferenceFragment())
                .commit()
        } else {
            title = savedInstanceState.getCharSequence(TAG_TITLE)
        }

        supportFragmentManager.addOnBackStackChangedListener {
            if (supportFragmentManager.backStackEntryCount == 0) {
                setTitle(R.string.settings)
            }
        }

        setUpToolbar()
    }

    override fun onSaveInstanceState(outState: Bundle, outPersistentState: PersistableBundle) {
        super.onSaveInstanceState(outState, outPersistentState)
        outState.putCharSequence(TAG_TITLE, title)
    }

    override fun onSupportNavigateUp(): Boolean {
        if (supportFragmentManager.popBackStackImmediate()) {
            return true
        }
        return super.onSupportNavigateUp()
    }

    private fun setUpToolbar() {
        supportActionBar?.setTitle(R.string.settings)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)
        supportActionBar?.setDisplayShowHomeEnabled(true)
    }

    class GeneralPreferenceFragment : PreferenceFragmentCompat() {

        override fun onCreatePreferences(savedInstanceState: Bundle?, rootkey: String?) {
            setPreferencesFromResource(R.xml.preferences, rootkey)
            val devicePref: Preference? = findPreference(KEY_DEVICE)
            var vPrefs = PreferenceManager.getDefaultSharedPreferences(requireActivity())
                .getString(KEY_DEVICE, "NOT_FOUND")
            devicePref?.summary = vPrefs
            Timber.d("Saved KEY_DEVICE: $vPrefs")
            devicePref?.onPreferenceChangeListener =
                Preference.OnPreferenceChangeListener { preference, value ->
                    Timber.d("OnPreferenceChangeListener selected: $value")
                    preference.summary = value.toString()
                    true
                }

            val durationPref: Preference? = findPreference(KEY_DURATION)
            vPrefs = PreferenceManager.getDefaultSharedPreferences(requireActivity())
                .getString(KEY_DURATION, "NOT_FOUND")
            Timber.d("Saved KEY_DURATION: $vPrefs")
            durationPref?.summary = vPrefs
            durationPref?.onPreferenceChangeListener =
                Preference.OnPreferenceChangeListener { preference, value ->
                    Timber.d("OnPreferenceChangeListener selected: $value")
                    preference.summary = value.toString()
                    true
                }

            val mainsPref: Preference? = findPreference(KEY_MAINS_FILTER)
            vPrefs = PreferenceManager.getDefaultSharedPreferences(requireActivity())
                .getString(KEY_MAINS_FILTER, "NOT_FOUND")
            Timber.d("Saved KEY_MAINS_FILTER: $vPrefs")
            mainsPref?.summary = vPrefs
            mainsPref?.onPreferenceChangeListener =
                Preference.OnPreferenceChangeListener { preference, value ->
                    Timber.d("OnPreferenceChangeListener selected: $value")
                    preference.summary = value.toString()
                    true
                }

            val leadsPref: Preference? = findPreference(KEY_LEADS)
            vPrefs = PreferenceManager.getDefaultSharedPreferences(requireActivity())
                .getString(KEY_LEADS, "NOT_FOUND")
            Timber.d("Saved KEY_LEADS: $vPrefs")
            leadsPref?.summary = vPrefs
            leadsPref?.onPreferenceChangeListener =
                Preference.OnPreferenceChangeListener { preference, value ->
                    Timber.d("OnPreferenceChangeListener selected: $value")
                    preference.summary = value.toString()
                    true
                }

            val filterPref: Preference? = findPreference(KEY_FILTER)
            var vPrefsBool = PreferenceManager.getDefaultSharedPreferences(requireActivity())
                .getBoolean(KEY_FILTER, true)
            Timber.d("Saved KEY_FILTER: $vPrefsBool")
            filterPref?.summary = if (vPrefsBool) {
                getString(R.string.filter_enhanced)
            } else {
                getString(R.string.filter_original)
            }
            filterPref?.onPreferenceChangeListener =
                Preference.OnPreferenceChangeListener { preference, value ->
                    Timber.d("OnPreferenceChangeListener selected: $value")
                    if (value == true) {
                        preference.summary = getString(R.string.filter_enhanced)
                    } else {
                        preference.summary = getString(R.string.filter_original)
                    }
                    true
                }

            val lockLeadsPref: Preference? = findPreference(KEY_LOCK_LEADS)
            vPrefsBool = PreferenceManager.getDefaultSharedPreferences(requireActivity())
                .getBoolean(KEY_LOCK_LEADS, false)
            Timber.d("Saved KEY_LOCK_LEADS: $vPrefsBool")
            lockLeadsPref?.summary = if (vPrefsBool) {
                getString(R.string.on)
            } else {
                getString(R.string.off)
            }

            lockLeadsPref?.onPreferenceChangeListener =
                Preference.OnPreferenceChangeListener { preference, value ->
                    Timber.d("OnPreferenceChangeListener selected: $value")
                    val fPrefs = PreferenceManager.getDefaultSharedPreferences(requireActivity())
                    val editor = fPrefs.edit()
                    if (value == true) {
                        preference.summary = getString(R.string.on)
                    } else {
                        preference.summary = getString(R.string.off)
                    }
                    editor.apply()
                    true
                }

            val aboutRegionEUPref: Preference? = findPreference(KEY_ABOUT_REGION)
            vPrefsBool = PreferenceManager.getDefaultSharedPreferences(requireActivity())
                .getBoolean(KEY_ABOUT_REGION, false)
            Timber.d("Saved KEY_ABOUT_REGION: $vPrefsBool")
            aboutRegionEUPref?.summary = if (vPrefsBool) {
                "EU"
            } else {
                ""
            }

            aboutRegionEUPref?.onPreferenceChangeListener =
                Preference.OnPreferenceChangeListener { preference, value ->
                    Timber.d("OnPreferenceChangeListener selected: $value")
                    val fPrefs = PreferenceManager.getDefaultSharedPreferences(requireActivity())
                    val editor = fPrefs.edit()
                    if (value == true) {
                        preference.summary = "EU"
                    } else {
                        preference.summary = ""
                    }
                    editor.apply()
                    true
                }


            val libV1 = AliveCorKitLite.getVersionV1()
            val libV2 = AliveCorKitLite.getVersionV2()

            val kardiaPref: Preference? = findPreference(KEY_KARDIA)
            vPrefsBool = PreferenceManager.getDefaultSharedPreferences(requireActivity())
                .getBoolean(KEY_KARDIA, false)
            Timber.d("Saved KEY_KARDIA: $vPrefsBool")
            kardiaPref?.summary = if (vPrefsBool) {
                getString(R.string.kardia_v2) + " " + libV2
            } else {
                getString(R.string.kardia_v1) + " " + libV1
            }
            kardiaPref?.onPreferenceChangeListener =
                Preference.OnPreferenceChangeListener { preference, value ->
                    Timber.d("OnPreferenceChangeListener selected: $value")
                    val fPrefs = PreferenceManager.getDefaultSharedPreferences(requireActivity())
                    val editor = fPrefs.edit()
                    if (value == true) {
                        preference.summary = getString(R.string.kardia_v2) + " " + libV2
                    } else {
                        preference.summary = getString(R.string.kardia_v1) + " " + libV1
                    }
                    editor.apply()
                    lifecycleScope.launch(Dispatchers.Default) {
                        try {
                            AliveCorKitLite.get().deleteAllData(context)
                        } catch (e: Exception) {
                            Timber.e(e)
                        }
                    }
                    true
                }

            val skipResultScreenPref: Preference? = findPreference(KEY_SKIP_RESULT_SCREEN)
            vPrefsBool = PreferenceManager.getDefaultSharedPreferences(requireActivity())
                .getBoolean(KEY_SKIP_RESULT_SCREEN, false)
            Timber.d("Saved KEY_SKIP_RESULT_SCREEN: $vPrefsBool")
            skipResultScreenPref?.summary = if (vPrefsBool) {
                getString(R.string.on)
            } else {
                getString(R.string.off)
            }
            skipResultScreenPref?.onPreferenceChangeListener =
                Preference.OnPreferenceChangeListener { preference, value ->
                    Timber.d("OnPreferenceChangeListener selected: $value")
                    val fPrefs = PreferenceManager.getDefaultSharedPreferences(requireActivity())
                    val editor = fPrefs.edit()
                    if (value == true) {
                        preference.summary = getString(R.string.on)
                    } else {
                        preference.summary = getString(R.string.off)
                    }
                    editor.apply()
                    true
                }
        }

        override fun onDetach() {

            var vPrefs = PreferenceManager.getDefaultSharedPreferences(requireActivity())
                .getString(KEY_DEVICE, "NOT_FOUND")
            Timber.d("Saved KEY_DEVICE: $vPrefs")

            vPrefs = PreferenceManager.getDefaultSharedPreferences(requireActivity())
                .getString(KEY_DURATION, "NOT_FOUND")
            Timber.d("Saved KEY_DURATION: $vPrefs")

            vPrefs = PreferenceManager.getDefaultSharedPreferences(requireActivity())
                .getString(KEY_MAINS_FILTER, "NOT_FOUND")
            Timber.d("Saved KEY_MAINS_FILTER: $vPrefs")

            vPrefs = PreferenceManager.getDefaultSharedPreferences(requireActivity())
                .getString(KEY_LEADS, "NOT_FOUND")
            Timber.d("Saved KEY_LEADS: $vPrefs")

            var vPrefsBool = PreferenceManager.getDefaultSharedPreferences(requireActivity())
                .getBoolean(KEY_FILTER, true)
            Timber.d("Saved KEY_FILTER: $vPrefsBool")

            vPrefsBool = PreferenceManager.getDefaultSharedPreferences(requireActivity())
                .getBoolean(KEY_LOCK_LEADS, false)
            Timber.d("Saved KEY_LOCK_LEADS: $vPrefsBool")

            vPrefsBool = PreferenceManager.getDefaultSharedPreferences(requireActivity())
                .getBoolean(KEY_SKIP_RESULT_SCREEN, false)
            Timber.d("Saved KEY_SKIP_RESULT_SCREEN: $vPrefsBool")

            super.onDetach()
        }

    }

    override fun onPreferenceStartFragment(
        caller: PreferenceFragmentCompat,
        pref: Preference
    ): Boolean {
        //initiate the new fragment
        val args = pref.extras

        val fragment = pref.fragment?.let {
            supportFragmentManager.fragmentFactory.instantiate(
                classLoader,
                it
            ).apply {
                arguments = args
                setTargetFragment(caller, 0)
            }
        }

        fragment?.let {
            supportFragmentManager.beginTransaction()
                .replace(R.id.content_preference, it)
                .addToBackStack(null)
                .commit()
        }

        title = pref.title
        return true
    }

    companion object {
        private const val TAG_TITLE = "SettingsActivity"
        const val KEY_DEVICE = "key_device"
        const val KEY_DURATION = "key_duration"
        const val KEY_MAINS_FILTER = "key_mains_filter"
        const val KEY_LEADS = "key_leads"
        const val KEY_LOCK_LEADS = "key_lock_leads"
        const val KEY_SKIP_RESULT_SCREEN = "key_slip_result_screen"
        const val KEY_FILTER = "key_filter"
        const val KEY_KARDIA = "key_kardia"
        const val KEY_ABOUT_REGION = "key_about_eu_screen"

        const val KARDIA_AI_V1_VALUE = "KardiaAI v1"
        const val KARDIA_AI_V2_VALUE = "KardiaAI v2"
    }
}

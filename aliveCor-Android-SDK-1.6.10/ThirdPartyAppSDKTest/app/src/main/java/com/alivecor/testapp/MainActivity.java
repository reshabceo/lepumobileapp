package com.alivecor.testapp;

import android.annotation.SuppressLint;
import android.app.ProgressDialog;
import android.content.Context;
import android.content.Intent;
import android.content.res.Configuration;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.preference.PreferenceManager;

import com.alivecor.api.AliveCorKitLite;
import com.alivecor.api.AliveCorDevice;
import com.alivecor.api.AliveCorServer;
import com.alivecor.api.EkgAnalyzer;
import com.alivecor.api.InitListener;
import com.alivecor.api.LeadConfiguration;
import com.alivecor.api.RecordingConfiguration;
import com.alivecor.api.SampleRate;
import com.alivecor.common.LanguageUtils;
import com.alivecor.ecg.core.model.MainsFilterFrequency;
import com.alivecor.ecg.record.RecordActivityResult;
import com.alivecor.ecg.record.RecordEkgConstants;
import com.alivecor.ecg.record.RecordingHelpUrls;

import com.alivecor.testapp.BuildConfig;
import com.alivecor.testapp.rest.RestClient;
import com.alivecor.testapp.rest.TokenRequest;
import com.alivecor.testapp.rest.TokenResponse;
import com.alivecor.universal_monitor.Filter;
import com.google.android.material.snackbar.Snackbar;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Scanner;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;
import timber.log.Timber;

public class MainActivity extends AppCompatActivity {

    private static final int REQUEST_RECORD_EKG = 101;
    private boolean mAliveCorKitLiteInitialized = false;
    private ProgressDialog dialog = null;
    private String selectedLanguageCode;
    private String selectedLanguageName;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            getWindow().setDecorFitsSystemWindows(true);
        }

        // Get the selected language from the intent,
        selectedLanguageCode = getIntent().getStringExtra("SELECTED_LANGUAGE_CODE");
        selectedLanguageName = getIntent().getStringExtra("SELECTED_LANGUAGE_NAME");
        // todo save it if you need to use it for any reason
        // Set locale if there's a saved language
        LanguageUtils.setAppLocale(this, selectedLanguageCode, getResources());

        setContentView(R.layout.activity_main);

        // Log or use the selected language information to initialize SDK
        Log.d("MainActivity", "Selected Language: $selectedLanguageName ($selectedLanguageCode)");

        findViewById(R.id.test_ekg_analyzer).setOnClickListener(new DebouncingOnClickListener() {
            @Override
            public void doClick(@NonNull View var1) {
                testEkgAnalyzer();
            }
        });
        findViewById(R.id.start_recording_default).setOnClickListener(new DebouncingOnClickListener() {
            @Override
            public void doClick(@NonNull View var1) {
                startDefaultRecording();
            }
        });
        findViewById(R.id.start_recording_custom).setOnClickListener(new DebouncingOnClickListener() {
            @Override
            public void doClick(@NonNull View var1) {
                startCustomRecording();
            }
        });
        findViewById(R.id.view_recorded_ecgs).setOnClickListener(new DebouncingOnClickListener() {
            @Override
            public void doClick(@NonNull View var1) {
                startViewEcgs();
            }
        });
        findViewById(R.id.view_last_ecg).setOnClickListener(new DebouncingOnClickListener() {
            @Override
            public void doClick(@NonNull View var1) {
                viewLastEcg();
            }
        });
        findViewById(R.id.settings).setOnClickListener(new DebouncingOnClickListener() {
            @Override
            public void doClick(@NonNull View var1) {
                openSettings();
            }
        });
        findViewById(R.id.about).setOnClickListener(new DebouncingOnClickListener() {
            @Override
            public void doClick(@NonNull View var1) {
                startAboutScreen();
            }
        });

        ((TextView) findViewById(R.id.versionNum)).setText("Version " + BuildConfig.VERSION_NAME);
    }

    @Override
    public void onConfigurationChanged(@NonNull Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        // Apply the selected language when configuration changes
        String selectedLanguageCode = getIntent().getStringExtra("SELECTED_LANGUAGE_CODE");
        LanguageUtils.setAppLocale(this, selectedLanguageCode, getResources());
    }

    @SuppressLint("TimberArgCount")
    private void prepareToRecord(Runnable onInit) {

        // Otherwise you need to initialize AliveCorKitLite first
        dialog = new ProgressDialog(this);
        dialog.setCancelable(false);
        if (!isFinishing() && !isDestroyed()) {
            dialog.show();
        }

        // Get Kardia V1/V2 from the api
        TokenRequest tokenRequest = new TokenRequest();
        boolean vPrefsBool = PreferenceManager.getDefaultSharedPreferences(this)
                .getBoolean(SettingsActivity.KEY_KARDIA, false);
        if (!vPrefsBool) {
            tokenRequest.setBundleId(BuildConfig.BUNDLE_ID_V1);
        } else {
            tokenRequest.setBundleId(BuildConfig.BUNDLE_ID_V2);
        }
        tokenRequest.setPartnerId(BuildConfig.PARTNER_ID);
        tokenRequest.setTeamId(BuildConfig.TEAM_ID);
        tokenRequest.setPatientMrn("patient-mrn-12345"); // mandatory
        String authToken = BuildConfig.AUTH_TOKEN;

        Call<TokenResponse> call = new RestClient().getApi().token(authToken, tokenRequest);
        call.enqueue(new Callback<TokenResponse>() {
            @Override
            public void onResponse(Call<TokenResponse> call, Response<TokenResponse> response) {
                Timber.d("MainActivity Response is %s", response);
                if (response.body() != null) {
                    Timber.d("MainActivity Response is %s", response.body());

                    // Check if mAliveCorKit already Initialized
                    try {
                        if (AliveCorKitLite.get() != null) {
                            Timber.d("AliveCorKit already initialized, call onInit.run()");
                            dialogDismiss();
                            onInit.run();
                            return;
                        }
                    } catch (IllegalStateException exception) {
                        Timber.d("AliveCorKit already is not initialized yet, call AliveCorKitLite.initialize");
                    }

                    // RecordServerApi.getInstance().onAvailableTest();
                    AliveCorKitLite.initialize(MainActivity.this,
                            response.body().getJwt(),
                            new InitListener() {
                                @Override
                                public void onInitComplete() {
                                    Timber.d("AliveCorKitLite initialized version %s", AliveCorKitLite.getVersion());
                                    mAliveCorKitLiteInitialized = true;
                                    dialogDismiss();
                                    onInit.run();
                                }

                                @Override
                                public void onInitError(Throwable throwable) {
                                    dialogDismiss();
                                    Timber.d("SDK Version is %s", AliveCorKitLite.getVersion());
                                    Timber.e(throwable, "Error initializing AliveCorKitLite");
                                }
                            },
                            AliveCorServer.STAGING_US,
                            "ECGtestApp",
                            tokenRequest.getBundleId(),
                            tokenRequest.getPartnerId(),
                            true);
                } else {
                    View view = findViewById(R.id.mainLayout);
                    Snackbar.make(view, "Get jwt token call failed", Snackbar.LENGTH_LONG).show();
                    Timber.e("Get jwt token call failed");
                    dialogDismiss();
                }
            }

            @Override
            public void onFailure(Call<TokenResponse> call, Throwable t) {
                dialogDismiss();
                Timber.e(t, "MainActivity Error ");
            }
        });
    }

    private void dialogDismiss() {
        if (dialog != null && dialog.isShowing()) {
            dialog.dismiss();
            dialog = null;
        }
    }

    @Override
    protected void onDestroy() {
        dialogDismiss();
        super.onDestroy();
    }

    public void testEkgAnalyzer() {
        Runnable testRunner = () -> {
            List<Integer> samples = new ArrayList<>();
            InputStream in = getResources().openRawResource(R.raw.ecg);
            Scanner scanner = new Scanner(in);
            while (scanner.hasNextLine()) {
                String line = scanner.nextLine();
                line = line.split(",")[0];
                samples.add(Integer.parseInt(line));
                Log.d("MainActivity", "Read Sample: " + line);
            }

            double[] samplesArray = new double[samples.size()];
            for (int i = 0; i < samples.size(); i++) {
                samplesArray[i] = samples.get(i);
            }
            try {
                EkgAnalyzer.Result result = AliveCorKitLite.get().getClassifier()
                        .classifySamples(samplesArray,
                                samplesArray.length,
                                MainsFilterFrequency.MAINS_60_HZ.ordinal(),
                                SampleRate.SAMPLE_RATE_300_HZ);
                Timber.d("testEkgAnalyzer: %s", result);
            } catch (Exception e) {
                Timber.e("testEkgAnalyzer %s", e.getMessage());
            }
        };

        prepareToRecord(() -> new Thread(testRunner).start());
    }

    private RecordingHelpUrls createHelpUrls() {
        return new RecordingHelpUrls(
                "https://www.logitech.com",
                "https://www.marriott.com",
                "https://microcenter.com",
                "https://nfc.com",
                "https://google.com",
                "https://google.com",
                "https://bluetooth.com",
                "https://www.google.com",
                "https://www.apple.com");
    }

    public void startDefaultRecording() {

        final AliveCorDevice aliveCorDevice;
        LeadConfiguration leadsConfig = LeadConfiguration.SINGLE;
        final Filter filterType;
        final int mainsFilter;
        final int recordingMaxDurationSec;

        Context context = getApplicationContext();
        String vPrefsDevice = PreferenceManager.getDefaultSharedPreferences(context).getString(SettingsActivity.KEY_DEVICE, "NOT_FOUND");
        String vPrefsLeads = PreferenceManager.getDefaultSharedPreferences(context).getString(SettingsActivity.KEY_LEADS, "NOT_FOUND");
        String vPrefsDuration = PreferenceManager.getDefaultSharedPreferences(context).getString(SettingsActivity.KEY_DURATION, "NOT_FOUND");
        String vPrefsMainFilter = PreferenceManager.getDefaultSharedPreferences(context).getString(SettingsActivity.KEY_MAINS_FILTER, "NOT_FOUND");
        boolean vPrefsFilter = PreferenceManager.getDefaultSharedPreferences(context).getBoolean(SettingsActivity.KEY_FILTER, true);
        boolean vLockLeads = PreferenceManager.getDefaultSharedPreferences(context).getBoolean(SettingsActivity.KEY_LOCK_LEADS, false);
        boolean vPrefsSkipResult = PreferenceManager.getDefaultSharedPreferences(context).getBoolean(SettingsActivity.KEY_SKIP_RESULT_SCREEN, false);

        if (vPrefsDevice.equals(getString(R.string.kardia_mobile))) {
            aliveCorDevice = AliveCorDevice.KARDIA_MOBILE;
            leadsConfig = LeadConfiguration.SINGLE;

        } else if (vPrefsDevice.equals(getString(R.string.triangle))) {
            aliveCorDevice = AliveCorDevice.TRIANGLE;
            if (vPrefsLeads.equals(getString(R.string.single_lead))) {
                leadsConfig = LeadConfiguration.SINGLE;
            } else if (vPrefsLeads.equals(getString(R.string.six_lead))) {
                leadsConfig = LeadConfiguration.SIX;
            }

        } else if (vPrefsDevice.equals(getString(R.string.omron_complete))) {
            aliveCorDevice = AliveCorDevice.OMRON_COMPLETE;
            leadsConfig = LeadConfiguration.SINGLE;

        } else if (vPrefsDevice.equals(getString(R.string.kardia_card))) {
            aliveCorDevice = AliveCorDevice.KARDIA_CARD;
            leadsConfig = LeadConfiguration.SINGLE;

        } else {
            aliveCorDevice = AliveCorDevice.TRIANGLE;
            leadsConfig = LeadConfiguration.SINGLE;
        }

        if (vPrefsDuration.equals(getString(R.string.sec_30))) {
            recordingMaxDurationSec = 30;
        } else if (vPrefsDuration.equals(getString(R.string.min_1))) {
            recordingMaxDurationSec = 60;
        } else if (vPrefsDuration.equals(getString(R.string.min_2))) {
            recordingMaxDurationSec = 120;
        } else if (vPrefsDuration.equals(getString(R.string.min_3))) {
            recordingMaxDurationSec = 180;
        } else if (vPrefsDuration.equals(getString(R.string.min_4))) {
            recordingMaxDurationSec = 240;
        } else if (vPrefsDuration.equals(getString(R.string.min_5))) {
            recordingMaxDurationSec = 300;
        } else {
            recordingMaxDurationSec = 30;
        }


        if (vPrefsMainFilter.equals("50")) {
            mainsFilter = 50;
        } else if (vPrefsMainFilter.equals("60")) {
            mainsFilter = 60;
        } else {
            mainsFilter = -1;
        }

        if (vPrefsFilter) {
            filterType = Filter.ENHANCED;
        } else {
            filterType = Filter.ORIGINAL;
        }

        LeadConfiguration finalLeadsConfig = leadsConfig;
        prepareToRecord(() -> {
            Intent intent = AliveCorKitLite.get().getRecordIntent(aliveCorDevice);
            intent.putExtra(RecordEkgConstants.EXTRA_LEADS_CONFIG, finalLeadsConfig.name());
            intent.putExtra(RecordEkgConstants.EXTRA_MAX_DURATION, recordingMaxDurationSec);
            intent.putExtra(RecordEkgConstants.EXTRA_FILTER_TYPE, filterType.name());
            if (vLockLeads) {
                intent.putExtra(RecordEkgConstants.EXTRA_ENABLE_LEADS_BUTTONS, false);
            } else {
                intent.putExtra(RecordEkgConstants.EXTRA_ENABLE_LEADS_BUTTONS, true);
            }

            if (mainsFilter != -1) {
                intent.putExtra(RecordEkgConstants.EXTRA_REC_FREQUENCY, mainsFilter);
            }
            intent.putExtra(RecordEkgConstants.EXTRA_HELP_URLS, createHelpUrls());

            // set EXTRA_SHOW_RECORDING_RESULT to false to skip the result screen
            intent.putExtra(RecordEkgConstants.EXTRA_SHOW_RECORDING_RESULT, !vPrefsSkipResult);

            startActivityForResult(intent, REQUEST_RECORD_EKG);
        });
    }

    public void startCustomRecording() {
        final AliveCorDevice device = AliveCorDevice.KARDIA_MOBILE;
        final LeadConfiguration leadsConfig = LeadConfiguration.SINGLE;
        final int recordingMaxDurationSec = 30;
        final Filter filterType = Filter.ENHANCED;

        Context context = getApplicationContext();
        boolean vLockLeads = PreferenceManager.getDefaultSharedPreferences(context).getBoolean(SettingsActivity.KEY_LOCK_LEADS, false);
        boolean vPrefsSkipResult = PreferenceManager.getDefaultSharedPreferences(context).getBoolean(SettingsActivity.KEY_SKIP_RESULT_SCREEN, false);

        prepareToRecord(() -> {
            Intent intent = new Intent(this, CustomFlowActivity.class);
            intent.putExtra(RecordEkgConstants.EXTRA_DEVICE, device);
            intent.putExtra(RecordEkgConstants.EXTRA_LEADS_CONFIG, leadsConfig.name());
            intent.putExtra(RecordEkgConstants.EXTRA_MAX_DURATION, recordingMaxDurationSec);
            intent.putExtra(RecordEkgConstants.EXTRA_FILTER_TYPE, filterType);
            intent.putExtra(RecordEkgConstants.EXTRA_REC_FREQUENCY, RecordingConfiguration.MAINS_FREQUENCY_50Hz);
            intent.putExtra(RecordEkgConstants.EXTRA_HELP_URLS, createHelpUrls());

            // set EXTRA_SHOW_RECORDING_RESULT to false to skip the result screen
            intent.putExtra(RecordEkgConstants.EXTRA_SHOW_RECORDING_RESULT, !vPrefsSkipResult);

            // example to setup language for fragment in CustomFlowActivity
            intent.putExtra("SELECTED_LANGUAGE_CODE", selectedLanguageCode);
            intent.putExtra("SELECTED_LANGUAGE_NAME", selectedLanguageName);

            if (vLockLeads) {
                intent.putExtra(RecordEkgConstants.EXTRA_ENABLE_LEADS_BUTTONS, false);
            } else {
                intent.putExtra(RecordEkgConstants.EXTRA_ENABLE_LEADS_BUTTONS, true);
            }
            startActivity(intent);
        });
    }

    public void startViewEcgs() {
        startActivity(new Intent(this, RecordingListActivity.class));
    }

    public void viewLastEcg() {
        startActivity(new Intent(this, LastResultActivity.class));
    }

    public void openSettings() {
        startActivity(new Intent(this, SettingsActivity.class));
    }

    public void startAboutScreen() {
        // Starting from SDK 1.5.0
        boolean vAboutRegion = PreferenceManager.getDefaultSharedPreferences(this)
                .getBoolean(SettingsActivity.KEY_ABOUT_REGION, false);

        String ABOUT_REGION_EU = "REGION_EU";
        String ABOUT_REGION_NONE_EU = "REGION_NONE_EU";
        AliveCorKitLite.showAboutFragment(this, vAboutRegion ? ABOUT_REGION_EU : ABOUT_REGION_NONE_EU);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, @Nullable Intent data) {
        super.onActivityResult(requestCode, resultCode, data);

        if (requestCode == REQUEST_RECORD_EKG) {
            RecordActivityResult result = AliveCorKitLite.get().getRecordActivityResult(data);
            Timber.i("Back from EKG Recording. Result: %d/%s", resultCode, result);
            // Can save the recording from the default flow here
            if (result != null && result.getSuccessfulResult() != null) {
                EcgFileRepository.getInstance(this).saveEcg(result.getSuccessfulResult());
            }
        }
    }
}

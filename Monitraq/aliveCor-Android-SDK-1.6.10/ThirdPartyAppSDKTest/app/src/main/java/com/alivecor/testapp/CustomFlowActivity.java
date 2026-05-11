package com.alivecor.testapp;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.FileProvider;
import androidx.fragment.app.Fragment;
import androidx.lifecycle.LiveData;
import androidx.preference.PreferenceManager;

import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.text.TextUtils;
import android.util.Log;
import android.view.View;
import android.widget.ArrayAdapter;
import android.widget.TextView;
import android.widget.Toast;

import com.alivecor.api.AliveCorKitLite;
import com.alivecor.api.AliveCorDevice;
import com.alivecor.api.AliveCorEcg;
import com.alivecor.api.FilterType;
import com.alivecor.api.LeadConfiguration;
import com.alivecor.api.RecordingConfiguration;
import com.alivecor.common.LanguageUtils;
import com.alivecor.ecg.record.AliveCorPdfHelper;
import com.alivecor.ecg.record.InvalidArgumentException;
import com.alivecor.ecg.record.RecordEkgFragment;
import com.alivecor.ecg.record.RecordEkgListener;
import com.alivecor.ecg.record.RecordingError;
import com.alivecor.ecg.record.RecordingHelpUrls;
import com.alivecor.ecg.record.ResultEkgFragment;
import com.alivecor.ecg.record.ResultEkgListener;
import com.alivecor.ecg.record.ResultError;
import com.alivecor.universal_monitor.LeadValues;
import com.alivecor.view.RhythmStripView;

import org.joda.time.DateTime;

import java.io.File;
import java.util.List;

/**
 * Provides a custom Recording UI flow, which does one recording with a device of the user's choice and shows the analysis result to the user.
 * <p>
 * The entire Recording Screen is provided by the SDK.
 * <p>
 * Part of the Result Screen is also provided by the SDK, but there it also contains some additional Views that show the ECG trace in a different way,
 * and present some extra technical information.
 * <p>
 * This Activity also saves the recorded ECGs to disk once analysis is complete.
 */
public class CustomFlowActivity extends AppCompatActivity implements RecordEkgListener, ResultEkgListener {

    private static final String TAG = CustomFlowActivity.class.getSimpleName();

    private static boolean SINGLE_DEVICE = false;

    private static final String STATE_RECORDED_ECG = "recorded ecg";
    private static final String STATE_CHOSEN_DEVICE = "chosen device";

    private RecordEkgFragment recordEkgFragment;
    private ResultEkgFragment resultEkgFragment;

    private AliveCorEcg recordedEcg;
    private AliveCorDevice chosenDevice;

    private RhythmStripView previewRhythmStrip;
    private TextView additionalRecordingInfo;
    private View additionalInfoContainer;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            getWindow().setDecorFitsSystemWindows(true);
        }

        String selectedLanguageCode = getIntent().getStringExtra("SELECTED_LANGUAGE_CODE");
        String selectedLanguageName = getIntent().getStringExtra("SELECTED_LANGUAGE_NAME");
        LanguageUtils.setAppLocale(this, selectedLanguageCode, getResources());

        setContentView(R.layout.activity_custom_flow);

        additionalRecordingInfo = findViewById(R.id.custom_flow_additional_info);
        additionalInfoContainer = findViewById(R.id.custom_flow_additional_scrollview);
        previewRhythmStrip = findViewById(R.id.custom_flow_preview_strip);

        if (findViewById(R.id.pdfButton) != null) {
            findViewById(R.id.pdfButton).setOnClickListener(new DebouncingOnClickListener() {
                @Override
                public void doClick(@NonNull View var1) {
                    generatePdf(recordedEcg);
                }
            });
        }

        if (savedInstanceState != null) {
            // Resuming state: Figure out whether the Record or Result Fragment is being shown and setup listeners accordingly
            String deviceName = savedInstanceState.getString(STATE_CHOSEN_DEVICE, null);
            if (!TextUtils.isEmpty(deviceName)) {
                chosenDevice = AliveCorDevice.valueOf(deviceName);
            }
            recordedEcg = (AliveCorEcg) savedInstanceState.getSerializable(STATE_RECORDED_ECG);

            if (chosenDevice == null) {
                showChangeDevice();
            } else {
                // Had a chosen device, must be at  recording or result
                Fragment activeFragment = getSupportFragmentManager().findFragmentById(R.id.custom_flow_fragment_container);
                if (activeFragment instanceof RecordEkgFragment) {
                    recordEkgFragment = (RecordEkgFragment) activeFragment;
                    setRecordListener(recordEkgFragment);
                } else if (activeFragment instanceof ResultEkgFragment) {
                    resultEkgFragment = (ResultEkgFragment) activeFragment;
                    setResultListener(resultEkgFragment);
                    showAdditionalRecordInfo(recordedEcg);
                }
            }
        } else {
            // Starting fresh: Show the device chooser
            showChangeDevice();
        }
    }

    @Override
    protected void onSaveInstanceState(@NonNull Bundle savedState) {
        super.onSaveInstanceState(savedState);

        savedState.putSerializable(STATE_RECORDED_ECG, recordedEcg);
        if (chosenDevice != null) {
            savedState.putString(STATE_CHOSEN_DEVICE, chosenDevice.name());
        }
    }

    @Override
    protected void onStop() {
        // removeListeners();
        super.onStop();
    }

    private void generatePdf(AliveCorEcg recordedEcg) {
        // PDF Reports can be generated into any file.  The SDK will overwrite any data in this file
        File pdfFile = new File(recordedEcg.getFilesDirectory(), recordedEcg.getUuid() + ".pdf");

        // PDF Reports can be generated for any fully-populated AliveCorEcg.  The recording files
        // must be present within the directory indicated by AliveCorEcg's getFilesDirectory()
        // PDFs can be letter-size or A4, depending on preference.
        AliveCorPdfHelper pdfHelper = AliveCorKitLite.get().getPdfHelper();
        pdfHelper.setForceInvert(false);
        // pdfHelper.setLanguage(false);
        pdfHelper.createPdfWithEncryptionPrompt(this,
                recordedEcg,
                AliveCorPdfHelper.Size.LETTER,
                pdfFile,
                // Logo and Patient Info are nullable.
                "images/alivecor_logo.png",
                // Each field of PatientInfo is nullable
                new AliveCorPdfHelper.PatientInfo("Jane", "Doe",
                        DateTime.now().minusYears(50).getMillis(),
                        "123457890", "M", "MRN 1001-102-103"),
                // Tags and Notes are also Nullable
                "Symptom1, Symptom2, Symptom3",
                "Patient presents with some symptoms",
                new AliveCorPdfHelper.PdfListener() {
                    private void showPdf(File file) {
                        Intent target = new Intent(Intent.ACTION_VIEW);
                        target.setDataAndType(FileProvider.getUriForFile(CustomFlowActivity.this, BuildConfig.APPLICATION_ID + ".fileprovider", file), "application/pdf");
                        target.setFlags(Intent.FLAG_ACTIVITY_NO_HISTORY | Intent.FLAG_GRANT_READ_URI_PERMISSION);

                        Intent sharing = Intent.createChooser(target, "Open PDF");
                        startActivity(sharing);
                    }

                    @Override
                    public void onEncryptPdf(@NonNull File file, @NonNull String s) {
                        Toast.makeText(CustomFlowActivity.this, "Encryption is not implemented", Toast.LENGTH_SHORT).show();
                        // Fill in your own encryption logic here.  The SDK does not come with any tool for this.
                        showPdf(file);
                    }

                    @Override
                    public void onShowPdf(@NonNull File file) {
                        showPdf(file);
                    }

                    @Override
                    public void onError() {

                    }
                }, true, false);
    }

    private void setRecordListener(RecordEkgFragment fragment) {
        if (fragment != null){
            fragment.addListener(this);
        }
    }

    private void setResultListener(ResultEkgFragment fragment) {
        fragment.addListener(this);
    }

    private void removeListeners() {
        if (recordEkgFragment != null) {
            recordEkgFragment.removeListener(this);
        }

        if (resultEkgFragment != null) {
            resultEkgFragment.removeListener(this);
        }
    }

    private void showChangeDevice() {
        List<AliveCorDevice> devices = AliveCorKitLite.get().getSupportedDevices();
        ArrayAdapter<AliveCorDevice> deviceAdapter = new ArrayAdapter<>(this, android.R.layout.simple_list_item_1, devices);
        AlertDialog dlg = new AlertDialog.Builder(this)
                .setAdapter(deviceAdapter, (dialog, which) -> {
                    chosenDevice = devices.get(which);
                    removeListeners();
                    replaceRecordFragment(chosenDevice);
                }).create();;
        dlg.setOnCancelListener(v -> finish());
        dlg.show();
    }

    private RecordEkgFragment createRecordFragment(@NonNull AliveCorDevice device) {
        // RecordEkgFragment requires a RecordingConfiguration object, which contains all the configuration data needed to make a recording.
        RecordingConfiguration configuration = new RecordingConfiguration();
        configuration.setDevice(device);
        configuration.setLeads(LeadConfiguration.SINGLE);
        configuration.setFilterType(FilterType.ENHANCED);
        configuration.setMaxDurationSeconds(30);
        configuration.setResetDurationSeconds(10);

        // You may need to set this to 50 depending on your location
        configuration.setMainsFrequency(RecordingConfiguration.MAINS_FREQUENCY_60Hz);

        // The name of the device, as shown in the Recording UI, can be overridden.
        // The default is simply the market name of the device
        //configuration.setOverrideDeviceName("Heart-O-Tron");

        // The Trace can be hidden from the user during recording.
        // This may be required for certain flows, depending on your requirements
        //configuration.setHideTrace(true);

        // Lock leads selector buttons if required, set flag as "false".
        // This will affect 6L only
        boolean vLockLeads = PreferenceManager.getDefaultSharedPreferences(getApplicationContext())
                .getBoolean(SettingsActivity.KEY_LOCK_LEADS, false);
        configuration.setEnableLeadsButtons(!vLockLeads);

        // The RecordEkgFragment must be instantiated with the configuration it will use.
        // In order to record with a different configuration, it is necessary replace the RecordEkgFragment with a new one.
        RecordEkgFragment fragment = null;
        try {
            fragment = RecordEkgFragment.newInstance(configuration, createHelpUrls(), SINGLE_DEVICE);
        } catch (InvalidArgumentException e) {
            Log.e(TAG, "Error creating Record Fragment!!");
        }

        // The RecordEkgFragment will call back with a variety of events requiring handling by the caller.
        // The full interface is documented in the SDK docs.
        // Most importantly, once a finished recording has been made and analyzed, this Listener will be called.
        setRecordListener(fragment);
        return fragment;
    }

    private RecordingHelpUrls createHelpUrls() {
        return new RecordingHelpUrls("https://www.google.com",
                "https://www.google.com",
                "https://www.google.com",
                "https://www.google.com",
                "https://www.google.com",
                "https://www.google.com",
                "https://www.google.com",
                "https://www.google.com",
                "https://www.google.com");
    }

    private ResultEkgFragment createResultFragment(@NonNull AliveCorEcg result) {
        // The ResultEkgFragment can be created from any AliveCorEcg.  It must be fully-populated.
        // By default, the Result Fragment shows a Kardia-branded Toolbar with a 'Done' action that the user can press.
        // This toolbar can be disabled if not required
        // ResultEkgFragment fragment = ResultEkgFragment.newInstance(result, false) // Show without the built-in Toolbar
        ResultEkgFragment fragment = null;
        try {
            fragment = ResultEkgFragment.newInstance(result);
        } catch (InvalidArgumentException e) {
            Log.e(TAG, "Error creating Result Fragment!", e);
        }

        // The ResultEkgFragment will call back when the user signals that they are done with this ECG.  If you are not using the built-in Toolbar, you will
        // not receive this callback and must handle this casein some other way
        setResultListener(fragment);

        return fragment;
    }

    private void replaceRecordFragment(@NonNull AliveCorDevice device) {
        RecordEkgFragment fragment = createRecordFragment(device);
        getSupportFragmentManager().beginTransaction()
                .replace(R.id.custom_flow_fragment_container, fragment)
                .commitNowAllowingStateLoss();

        recordEkgFragment = fragment;
    }

    private void replaceResultFragment(@NonNull AliveCorEcg result) {
        ResultEkgFragment fragment = createResultFragment(result);
        getSupportFragmentManager().beginTransaction()
                .replace(R.id.custom_flow_fragment_container, fragment)
                .commitNowAllowingStateLoss();

        resultEkgFragment = fragment;
    }

    private void showAdditionalRecordInfo(AliveCorEcg recordResult) {
        additionalInfoContainer.setVisibility(View.VISIBLE);

        String recordInfo = "Test Custom Flow and Custom Result\n"
                + "Technical Information:\n\n"
                + "Recording Device: " + recordResult.getDeviceInfo() + "\n\n"
                + "Evaluation Details: " + recordResult.getEcgEvaluation();
        additionalRecordingInfo.setText(recordInfo);

        previewRhythmStrip.setEcgRecord(recordResult);
    }

    @Override
    public void onEcgFrame(LeadValues leadValue) {
        if (leadValue != null) {
            Log.d(TAG, "Lead Value = " + leadValue);
        }
    }

    @Override
    public void onRecordSettings() {
        Toast.makeText(this, "Implement your own EKG Setting for CustomFlowActivity. \n But this is where you would nav to it.", Toast.LENGTH_LONG).show();
        finish();
        startActivity(new Intent(this, SettingsActivity.class));
    }

    @Override
    public void onLeadConfigUpdated(LeadConfiguration leadConfiguration) {
        Toast.makeText(this, "You chose Leads: " + leadConfiguration, Toast.LENGTH_SHORT).show();
    }

    /**
     *  *** Begin RecordEkgListener
     */

    @Override
    public void onRecordCompleted(AliveCorEcg recordResult) {
        Log.d(TAG, "onRecordCompleted: " + recordResult);

        recordedEcg = recordResult;

        // A Recording has been completed and analyzed. Show the Result data, and Custom info.
        showAdditionalRecordInfo(recordResult);
        replaceResultFragment(recordResult);
        findViewById(R.id.pdfButton).setVisibility(View.VISIBLE);

        // At this point in the recording flow, the record can be saved.  Do so while the user views the results
        LiveData<Boolean> saveData = EcgFileRepository.getInstance(this).saveEcg(recordResult);
        saveData.observe(this, success -> {
            if (success) {
                Toast.makeText(this, "This ECG has been saved", Toast.LENGTH_SHORT).show();
            } else {
                Toast.makeText(this, "ECG could not be saved to disk", Toast.LENGTH_SHORT).show();
            }
        });
    }

    @Override
    public void onRecordError(RecordingError recordingError) {
        Log.d(TAG, "onRecordError: " + recordingError);
        Toast.makeText(this, "Looks like something went wrong.  See the HUD display for more info", Toast.LENGTH_SHORT).show();
    }

    @Override
    public void onUserCancel() {
        Log.d(TAG, "onUserCancel: ");
        Toast.makeText(this, "You can try to record again whenever you like", Toast.LENGTH_LONG).show();
        finish();
    }

    @Override
    public void onBTPairingCancel() {
        Log.d(TAG, "onBTPairingCancel: User cancel BT System Pairing Dlg");
        Toast.makeText(this, "User cancel BT System Pairing Dlg", Toast.LENGTH_LONG).show();
    }

    @Override
    public void onChangeDevice() {
        Log.d(TAG, "onChangeDevice: ");
        showChangeDevice();
    }

    @Override
    public void onDeviceId(@Nullable String deviceId) {
        Log.d(TAG, "onDeviceId: deviceId");
    }

    @Override
    public void onBPMUpdated(String bpm) {
        // Log.d(TAG, "onBPMUpdated: bpm");
    }
    // End RecordEkgListener


    /**
     * *** Begin ResultEkgListener ***
     */
    @Override
    public void onSuccess() {
        Log.d(TAG, "onResultSuccess: ");
        Toast.makeText(this, "Congratulations! You recorded an Ekg!", Toast.LENGTH_SHORT).show();
        finish();
    }

    @Override
    public void onFailure(ResultError resultError) {
        Log.d(TAG, "onResultFailure: ");
        Toast.makeText(this, "Something went wrong...", Toast.LENGTH_SHORT).show();
    }

    @Override
    public void onPointerCaptureChanged(boolean hasCapture) {
        super.onPointerCaptureChanged(hasCapture);
    }
    // *** End ResultEkgListener ***
}

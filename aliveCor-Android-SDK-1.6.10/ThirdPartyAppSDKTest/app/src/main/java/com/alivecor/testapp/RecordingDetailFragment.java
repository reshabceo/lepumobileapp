package com.alivecor.testapp;

import android.app.Activity;
import android.content.DialogInterface;
import android.content.Intent;
import android.graphics.Point;
import android.os.Build;
import android.os.Bundle;

import com.alivecor.api.AliveCorEcg;
import com.alivecor.api.AliveCorKitLite;
import com.alivecor.api.FilterType;
import com.alivecor.common.LanguageUtils;
import com.alivecor.ecg.record.AliveCorPdfHelper;
import com.alivecor.view.RhythmStripView;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AlertDialog;
import androidx.core.content.FileProvider;
import androidx.fragment.app.Fragment;

import android.view.Display;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.widget.TextView;
import android.widget.Toast;

import org.joda.time.DateTime;

import java.io.File;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;

import timber.log.Timber;

/**
 * A fragment representing a single Recording detail screen.
 * This fragment is either contained in a {@link RecordingListActivity}
 * in two-pane mode (on tablets) or a {@link RecordingDetailActivity}
 * on handsets.
 */
public class RecordingDetailFragment extends Fragment implements AliveCorPdfHelper.PdfListener {
    /**
     * The fragment argument representing the item ID that this fragment
     * represents.
     */
    public static final String ARG_ITEM = "item_id";

    /**
     * The dummy content this fragment is presenting.
     */
    private AliveCorEcg mItem;

    private boolean inverted;

    private boolean enhanced = true;

    /**
     * Mandatory empty constructor for the fragment manager to instantiate the
     * fragment (e.g. upon screen orientation changes).
     */
    public RecordingDetailFragment() {
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            requireActivity().getWindow().setDecorFitsSystemWindows(true);
        }
        if (getArguments().containsKey(ARG_ITEM)) {
            // AliveCorEcg implements Serializable for easy marshalling
            mItem = (AliveCorEcg) getArguments().getSerializable(ARG_ITEM);
        }
    }

    @Override
    public View onCreateView(LayoutInflater inflater, ViewGroup container,
                             Bundle savedInstanceState) {
        View rootView = inflater.inflate(R.layout.recording_detail, container, false);

        if (mItem != null) {
            // The RhythmStripView can be configured in a number of ways.
            RhythmStripView strip = rootView.findViewById(R.id.recording_detail_strip);
            strip.setFilterType(FilterType.ENHANCED);
            strip.setInverted(false);
            // This will cause the RhythmStripView to load ATC files associated with this AliveCorEcg
            strip.setEcgRecord(mItem);

            rootView.<TextView>findViewById(R.id.recording_detail_date).setText(new Date(mItem.getRecordedAtMs()).toString());
            if (mItem.getEcgEvaluation() != null) {
                rootView.<TextView>findViewById(R.id.recording_detail_finding_txt).setText(mItem.getEcgEvaluation().getAlgorithmResultText());
                rootView.findViewById(R.id.recording_detail_finding_indicator).setBackgroundResource(mItem.getEcgEvaluation().getResultColor());

                strip.setInverted(mItem.getEcgEvaluation().isInverted());
            }

            rootView.findViewById(R.id.recording_detail_invert).setOnClickListener(v -> {
                inverted = !inverted;
                strip.setInverted(inverted);
            });

            rootView.findViewById(R.id.recording_detail_filter).setOnClickListener(v -> {
                enhanced = !enhanced;
                strip.setFilterType(enhanced ? FilterType.ENHANCED : FilterType.ORIGINAL);
            });

            rootView.findViewById(R.id.recording_detail_pdf).setOnClickListener(v -> {
                showSingleChoiceDialog(this.requireActivity());
                // generatePdf(); moved to dlg language selection as an example
            });
        }

        return rootView;
    }

    private void showSingleChoiceDialog(Activity context) {
        // final String[] items = {"Option 1", "Option 2", "Option 3"};
        List<LanguageUtils.Language> supportedLanguages = AliveCorKitLite.getSupportedLanguages(context);
        List<String> languageNames = new ArrayList<>();
        for (LanguageUtils.Language language : supportedLanguages) {
            languageNames.add("(" + language.getCode() + ") " + language.getName()); // or language.getCode()
        }
        // Variable to hold the selected language index
        final int[] selectedItemIndex = {0};  // To store the selected item index
        // Convert List<String> to a simple array of Strings for the AlertDialog
        final String[] languagesArray = languageNames.toArray(new String[0]);

        AlertDialog.Builder builder = new AlertDialog.Builder(context);
        builder.setTitle("Select Language");

        // Show the list of languages with single choice options
        builder.setSingleChoiceItems(languagesArray, selectedItemIndex[0], new DialogInterface.OnClickListener() {
            @Override
            public void onClick(DialogInterface dialog, int which) {
                // Update the selected item index when the user clicks on an option
                selectedItemIndex[0] = which;
            }
        });

        // Handle the "OK" button click
        builder.setPositiveButton("OK", new DialogInterface.OnClickListener() {
            @Override
            public void onClick(DialogInterface dialog, int which) {
                // Get the selected language code based on the selected index
                String selectedLanguageCode = supportedLanguages.get(selectedItemIndex[0]).getCode();
                Toast.makeText(context, "Selected language code: " + selectedLanguageCode, Toast.LENGTH_SHORT).show();
                Timber.d("Selected language code: %s", selectedLanguageCode);
                // Pass the selected language code to generatePdf
                generatePdf(selectedLanguageCode);
                dialog.dismiss();
                // You can now use this selected language in your app, for example, to change the locale
            }
        });

        // Add a "Cancel" button to dismiss the dialog
        builder.setNegativeButton("Cancel", null);

        // Create and show the dialog
        AlertDialog dialog = builder.create();
        dialog.show();

        // Get the screen height and set the dialog height to half of the screen
        WindowManager windowManager = context.getWindowManager();
        Display display = windowManager.getDefaultDisplay();
        Point size = new Point();
        display.getSize(size);
        int screenHeight = size.y;

        // Set the height to half of the screen height
        dialog.getWindow().setLayout(WindowManager.LayoutParams.MATCH_PARENT, screenHeight / 2);
    }

    private void generatePdf(String pdfLanguage) {
        // PDF Reports can be generated into any file.  The SDK will overwrite any data in this file
        File pdfFile = new File(mItem.getFilesDirectory(), mItem.getUuid() + ".pdf");

        // PDF Reports can be generated for any fully-populated AliveCorEcg.  The recording files
        // must be present within the directory indicated by AliveCorEcg's getFilesDirectory()
        // PDFs can be letter-size or A4, depending on preference.
        AliveCorPdfHelper pdfHelper = AliveCorKitLite.get().getPdfHelper();
        pdfHelper.setForceInvert(false);
        // new method to select any-supported language in SDK for PDF report
        // set to pdfHelper.setLanguage(null); to reset back to default device Locale
        if (pdfLanguage != null) {
            pdfHelper.setLanguage(pdfLanguage);
        }

        AliveCorPdfHelper.PatientInfo patientInfo = new AliveCorPdfHelper.PatientInfo("Jane", "Doe",
                DateTime.now().minusYears(50).getMillis(), "123456789", "M", "PatientID: 123456789\nMRN 1001-102-103");

                pdfHelper.createPdfWithEncryptionPrompt(requireActivity(),
                mItem,
                AliveCorPdfHelper.Size.LETTER,
                pdfFile,
                // Logo and Patient Info are nullable.
                "images/alivecor_logo.png",
                // Each field of PatientInfo is nullable
                patientInfo,
                // Tags and Notes are also Nullable
                "Symptom1, Symptom2, Symptom3",
                "Patient presents with some symptoms",
                this, true, false);
    }

    private void showPdf(File file) {
        Intent target = new Intent(Intent.ACTION_VIEW);
        target.setDataAndType(FileProvider.getUriForFile(requireActivity(), BuildConfig.APPLICATION_ID + ".fileprovider", file), "application/pdf");
        target.setFlags(Intent.FLAG_ACTIVITY_NO_HISTORY | Intent.FLAG_GRANT_READ_URI_PERMISSION);

        Intent sharing = Intent.createChooser(target, "Open PDF");
        startActivity(sharing);
    }

    @Override
    public void onEncryptPdf(@NonNull File file, @NonNull String s) {
        Toast.makeText(requireActivity(), "Encryption is not implemented", Toast.LENGTH_SHORT).show();
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
}

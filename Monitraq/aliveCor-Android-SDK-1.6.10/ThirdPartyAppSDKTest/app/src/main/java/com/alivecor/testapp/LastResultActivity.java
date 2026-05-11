package com.alivecor.testapp;

import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import androidx.lifecycle.LiveData;

import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.widget.TextView;
import android.widget.Toast;

import com.alivecor.api.AliveCorEcg;
import com.alivecor.ecg.record.determination.DeterminationActivity;
import com.alivecor.view.EcgResultView;

import java.util.List;

public class LastResultActivity extends AppCompatActivity {

    private EcgResultView resultView;
    private TextView empty;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            getWindow().setDecorFitsSystemWindows(true);
        }
                
        setContentView(R.layout.activity_last_result);
        resultView = findViewById(R.id.last_result_view);
        empty = findViewById(R.id.last_result_empty);
    }

    @Override
    protected void onResume() {
        super.onResume();

        LiveData<List<AliveCorEcg>> listData = EcgFileRepository.getInstance(this).loadEcgs();
        listData.observe(this, this::onListLoaded);
    }

    private void onListLoaded(List<AliveCorEcg> list) {
        if (list == null || list.isEmpty()) {
            empty.setVisibility(View.VISIBLE);
            resultView.setVisibility(View.GONE);
        } else {
            empty.setVisibility(View.GONE);
            resultView.setVisibility(View.VISIBLE);

            AliveCorEcg ecg = list.get(0);
            resultView.setEcgRecord(ecg);
            resultView.setCpomInfoListener(() -> new AlertDialog.Builder(this)
                    .setTitle(ecg.getEcgEvaluation().getAlgorithmResultText())
                    .setMessage(ecg.getEcgEvaluation().getAlgorithmResultDescription())
                    .setPositiveButton(android.R.string.ok, null)
                    .setNegativeButton("LEARN MORE", (dialog, which) -> {
                        Intent launch = new Intent(getApplicationContext(), DeterminationActivity.class);
                        launch.putExtra(DeterminationActivity.KARDIA_AI_VERSION_KEY, SettingsActivity.KARDIA_AI_V2_VALUE);
                        startActivity(launch);
                    })
                    .create()
                    .show());

            resultView.setInversionStateListener(inverted ->
                    Toast.makeText(this,
                        inverted ? "ECG IS inverted" : "ECG IS NOT inverted",
                        Toast.LENGTH_SHORT).show());
        }
    }
}

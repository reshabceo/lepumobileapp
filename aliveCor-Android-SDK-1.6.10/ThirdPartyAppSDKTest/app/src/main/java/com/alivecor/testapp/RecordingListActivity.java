package com.alivecor.testapp;

import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.lifecycle.LiveData;
import androidx.recyclerview.widget.RecyclerView;
import androidx.appcompat.widget.Toolbar;

import com.alivecor.api.AliveCorEcg;
import com.alivecor.view.RhythmStripView;
import com.google.android.material.floatingactionbutton.FloatingActionButton;
import com.google.android.material.snackbar.Snackbar;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;
import android.widget.Toast;

import java.util.Date;
import java.util.List;

import timber.log.Timber;

/**
 * An activity representing a list of Recordings. This activity
 * has different presentations for handset and tablet-size devices. On
 * handsets, the activity presents a list of items, which when touched,
 * lead to a {@link RecordingDetailActivity} representing
 * item details. On tablets, the activity presents the list of items and
 * item details side-by-side using two vertical panes.
 */
public class RecordingListActivity extends AppCompatActivity {

    /**
     * Whether or not the activity is in two-pane mode, i.e. running on a tablet
     * device.
     */
    private boolean mTwoPane;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            getWindow().setDecorFitsSystemWindows(true);
        }

        setContentView(R.layout.activity_recording_list);

        Toolbar toolbar = findViewById(R.id.toolbar);
        setSupportActionBar(toolbar);
        toolbar.setTitle(getTitle());

        FloatingActionButton fab = findViewById(R.id.fab);
        fab.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                Snackbar.make(view, "Replace with your own action", Snackbar.LENGTH_LONG)
                        .setAction("Action", null).show();
            }
        });

        if(findViewById(R.id.recording_detail_container) != null) {
            // The detail container view will be present only in the
            // large-screen layouts (res/values-w900dp).
            // If this view is present, then the
            // activity should be in two-pane mode.
            mTwoPane = true;
        }

        View recyclerView = findViewById(R.id.recording_list);
        assert recyclerView != null;
    }

    @Override
    protected void onStart() {
        super.onStart();

        refreshData();
    }

    private void refreshData() {
        LiveData<List<AliveCorEcg>> listdata = EcgFileRepository.getInstance(this).loadEcgs();
        listdata.observe(this, list -> setupRecyclerView(findViewById(R.id.recording_list), list));
    }

    private void setupRecyclerView(@NonNull RecyclerView recyclerView, List<AliveCorEcg> ecgs) {
        Timber.d("Loaded ECG List: " + ecgs);

        if(ecgs != null && !ecgs.isEmpty()) {
            recyclerView.setAdapter(new SimpleItemRecyclerViewAdapter(this, ecgs, mTwoPane));
        } else {
            Toast.makeText(this, "Nothing to show!", Toast.LENGTH_SHORT).show();
        }
    }

    public static class SimpleItemRecyclerViewAdapter
            extends RecyclerView.Adapter<SimpleItemRecyclerViewAdapter.ViewHolder> {

        private final RecordingListActivity mParentActivity;
        private final List<AliveCorEcg> mValues;
        private final boolean mTwoPane;
        private final View.OnClickListener mOnClickListener = new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                AliveCorEcg item = (AliveCorEcg) view.getTag();
                if(mTwoPane) {
                    Bundle arguments = new Bundle();
                    arguments.putSerializable(RecordingDetailFragment.ARG_ITEM, item);
                    RecordingDetailFragment fragment = new RecordingDetailFragment();
                    fragment.setArguments(arguments);
                    mParentActivity.getSupportFragmentManager().beginTransaction()
                                   .replace(R.id.recording_detail_container, fragment)
                                   .commit();
                } else {
                    Context context = view.getContext();
                    Intent intent = new Intent(context, RecordingDetailActivity.class);
                    intent.putExtra(RecordingDetailFragment.ARG_ITEM, item);

                    context.startActivity(intent);
                }
            }
        };

        SimpleItemRecyclerViewAdapter(RecordingListActivity parent,
                                      List<AliveCorEcg> items,
                                      boolean twoPane) {
            mValues = items;
            mParentActivity = parent;
            mTwoPane = twoPane;
        }

        @Override
        public ViewHolder onCreateViewHolder(ViewGroup parent, int viewType) {
            View view = LayoutInflater.from(parent.getContext())
                                      .inflate(R.layout.recording_list_content, parent, false);
            return new ViewHolder(view);
        }

        @Override
        public void onBindViewHolder(final ViewHolder holder, int position) {
            AliveCorEcg ecg = mValues.get(position);
            holder.itemView.setTag(ecg);
            holder.itemView.setOnClickListener(mOnClickListener);

            if(ecg.getEcgEvaluation() != null) {
                holder.finding.setText(ecg.getEcgEvaluation().getAlgorithmResultText());
                holder.colorIndicator.setBackgroundResource(ecg.getEcgEvaluation().getResultColor());
            } else {
                holder.finding.setText("----");
                holder.colorIndicator.setBackgroundResource(android.R.color.transparent);
            }

            holder.date.setText(new Date(ecg.getRecordedAtMs()).toString());
            holder.ecgView.setEcgRecord(ecg);
        }

        @Override
        public int getItemCount() {
            return mValues.size();
        }

        class ViewHolder extends RecyclerView.ViewHolder {
            final RhythmStripView ecgView;
            final View colorIndicator;
            final TextView finding;
            final TextView date;

            ViewHolder(View view) {
                super(view);
                ecgView = view.findViewById(R.id.recording_list_content_strip);
                colorIndicator = view.findViewById(R.id.recording_list_content_finding_indicator);
                finding = view.findViewById(R.id.recording_list_content_finding_txt);
                date = view.findViewById(R.id.recording_list_content_date);
            }
        }
    }
}

package com.alivecor.testapp;

import android.content.Context;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.annotation.WorkerThread;
import androidx.lifecycle.LiveData;
import androidx.lifecycle.MutableLiveData;

import com.alivecor.api.AliveCorEcg;
import com.alivecor.ecg.record.RecordEkgConstants;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.ObjectInputStream;
import java.io.ObjectOutputStream;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Objects;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import timber.log.Timber;

/**
 * Stores {@link AliveCorEcg} objects as files on-disk
 * <p>
 * This Repository just stores them as Serializable blobs for brevity's sake but the SDK is not opinionated about storage strategy
 */
public class EcgFileRepository {

    private static final String FMT_ECG_DATA_FILENAME = "ecgdata-%s.bin";
    private static final String TAG = EcgFileRepository.class.getSimpleName();

    private static EcgFileRepository INSTANCE;

    // Single-threaded to eliminate race conditions between write/write or read/write
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    private final Context appContext;

    public static EcgFileRepository getInstance(@NonNull Context context) {
        if (INSTANCE == null) {
            INSTANCE = new EcgFileRepository(context);
        }

        return INSTANCE;
    }

    private EcgFileRepository(@NonNull Context context) {
        this.appContext = context.getApplicationContext();
    }

    /**
     * Asynchronously saves the given ECG to disk.  The LiveData will emit once, true for success or false for failure.
     *
     * @param ecg
     */
    public LiveData<Boolean> saveEcg(AliveCorEcg ecg) {
        MutableLiveData<Boolean> resultData = new MutableLiveData<>();

        executor.submit(() -> resultData.postValue(doSaveEcg(ecg)));

        return resultData;
    }

    /**
     * Asynchrnously load all ECGs stored in the default storage directory;
     *
     * @return
     */
    public LiveData<List<AliveCorEcg>> loadEcgs() {
        return loadEcgs(RecordEkgConstants.defaultEcgDir());
    }

    /**
     * Asynchrnously load all ECGs stored in the given directory.
     *
     * @param directory
     * @return
     * @see RecordEkgConstants#defaultEcgDir()
     */
    public LiveData<List<AliveCorEcg>> loadEcgs(File directory) {
        MutableLiveData<List<AliveCorEcg>> resultData = new MutableLiveData<>();

        executor.submit(() -> resultData.postValue(doLoadEcgs(directory)));

        return resultData;
    }

    @NonNull
    @WorkerThread
    private List<AliveCorEcg> doLoadEcgs(@NonNull File ecgDir) {
        if (!ecgDir.isDirectory()) {
            throw new IllegalArgumentException("ecgDir must be a directory");
        }

        List<AliveCorEcg> ecgList = new ArrayList<>();
        for (File ecgFile : Objects.requireNonNull(ecgDir.listFiles())) {
            if (ecgFile.getName().endsWith(".bin")) {
                AliveCorEcg ecg = doLoadEcg(ecgFile);
                Timber.tag(TAG).v("Loaded ECG %s", ecg);
                if (ecg != null) {
                    ecgList.add(ecg);
                }
            }
        }

        Collections.sort(ecgList, (o1, o2) -> (int) (o2.getRecordedAtMs() - o1.getRecordedAtMs()));

        return ecgList;
    }

    @Nullable
    @WorkerThread
    private AliveCorEcg doLoadEcg(File ecgFile) {
        Timber.d("Loading %s", ecgFile);
        try (ObjectInputStream inStream = new ObjectInputStream(new BufferedInputStream(new FileInputStream(ecgFile)))) {
            return (AliveCorEcg) inStream.readObject();
        } catch (Exception e) {
            Timber.e(e, "Couldn't load ECG");
            return null;
        }
    }

    @NonNull
    @WorkerThread
    private Boolean doSaveEcg(AliveCorEcg ecg) {
        File ecgFile = getEcgFile(ecg);
        ecgFile.getParentFile().mkdirs();
        if (ecgFile.exists()) {
            ecgFile.delete();
        }

        try (ObjectOutputStream outStream = new ObjectOutputStream(new BufferedOutputStream(new FileOutputStream(ecgFile)))) {
            outStream.writeObject(ecg);
            Timber.tag(TAG).v("Wrote ECG %s", ecgFile);
            return Boolean.TRUE;
        } catch (Exception e) {
            Timber.e(e, "Error saving ECG");
            return Boolean.FALSE;
        }
    }

    private File getEcgFile(AliveCorEcg ecg) {
        return new File(ecg.getFilesDirectory(), getDataFilename(ecg));
    }

    private String getDataFilename(AliveCorEcg ecg) {
        return String.format(FMT_ECG_DATA_FILENAME, ecg.getUuid());
    }
}

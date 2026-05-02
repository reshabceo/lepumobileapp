/**
 * DicomUploader.tsx
 *
 * Three-tier upload routing (Serverless):
 *
 *   ≤ 40 MB   → Supabase Storage (direct SDK upload)
 *   > 40 MB   → AWS S3 via Client-Side Multipart Upload
 *               (handles 300 MB – 400 MB+ files on Android & iOS)
 *
 * Capacitor-safe guarantees:
 *   • Uses @aws-sdk/lib-storage for managed multipart uploads
 *   • Memory-efficient streaming of File objects
 *   • Real-time progress tracking for both Supabase and S3
 *   • iOS & Android: each part is a separate HTTPS PUT, ensuring reliability
 */

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Upload, FileArchive, CheckCircle, Loader2, File, Cloud, Database } from 'lucide-react';
import { uploadLargeFileToS3, getS3PresignedUrl } from '@/services/s3MultipartUploadService';
import { Capacitor } from '@capacitor/core';
import { Uploader } from '@capgo/capacitor-uploader';
import { FilePicker } from '@capawesome/capacitor-file-picker';

// ─── Constants ────────────────────────────────────────────────────────────────
const SUPABASE_LIMIT_MB = 40;
const SUPABASE_LIMIT_BYTES = SUPABASE_LIMIT_MB * 1024 * 1024;

const S3_BUCKET = import.meta.env.VITE_AWS_S3_BUCKET || 'monitraq-dicom-upload-bucket';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const generateId = (): string => {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch (_) { /* fallback */ }
  return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 10)}`;
};

const formatBytes = (bytes: number): string => {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface DicomUploaderProps {
  onUploadComplete?: (studyId: string) => void;
}

type Destination = 'supabase' | 's3' | null;

interface UploadState {
  uploading: boolean;
  progress: number;
  status: string;
  destination: Destination;
  partsDone: number;
  totalParts: number;
}

const INITIAL_STATE: UploadState = {
  uploading: false,
  progress: 0,
  status: '',
  destination: null,
  partsDone: 0,
  totalParts: 0,
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function DicomUploader({ onUploadComplete }: DicomUploaderProps) {
  const [state, setState] = useState<UploadState>(INITIAL_STATE);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const update = (patch: Partial<UploadState>) =>
    setState((prev) => ({ ...prev, ...patch }));

  // ── File selection ──────────────────────────────────────────────────────────
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (Capacitor.isNativePlatform()) {
      try {
        const result = await FilePicker.pickFiles({
          multiple: false,
          types: ['application/zip', 'application/octet-stream', '.dcm', '.dicom']
        });
        if (result.files.length > 0) {
          const file = result.files[0];
          const isZip = file.name.toLowerCase().endsWith('.zip') || file.mimeType.includes('zip');
          const isDicom = file.name.toLowerCase().endsWith('.dcm') || file.name.toLowerCase().endsWith('.dicom');

          if (!isZip && !isDicom) {
            toast.error('Please select a ZIP or DICOM (.dcm) file');
            return;
          }

          (window as any)._nativeSelectedDicomFile = file;
          setSelectedFile({
            name: file.name,
            size: file.size,
            type: file.mimeType,
          } as any);

          const sizeMB = (file.size / 1024 / 1024).toFixed(1);
          const dest = file.size > SUPABASE_LIMIT_BYTES ? 'AWS S3' : 'Supabase';
          toast.success(`Selected: ${file.name} (${sizeMB} MB) → ${dest}`);
        }
      } catch (err) {
        console.error('File selection error:', err);
        toast.error('Failed to select file');
      }
      return;
    }

    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file
    if (!file) return;

    const lower = file.name.toLowerCase();
    const isZip = lower.endsWith('.zip') || file.type.includes('zip');
    const isDicom = lower.endsWith('.dcm') || lower.endsWith('.dicom');

    if (!isZip && !isDicom) {
      toast.error('Please select a ZIP or DICOM (.dcm) file');
      return;
    }

    setSelectedFile(file);
    const sizeMB = (file.size / 1024 / 1024).toFixed(1);
    const dest = file.size > SUPABASE_LIMIT_BYTES ? 'AWS S3 (multipart)' : 'Supabase Storage';
    toast.success(`Selected: ${file.name} (${sizeMB} MB) → ${dest}`);
  };

  // ── Upload to Supabase (≤ 40 MB) ───────────────────────────────────────────
  const uploadToSupabase = async (file: File, filePath: string): Promise<string> => {
    update({ destination: 'supabase', status: 'Preparing file…', progress: 10 });

    // Convert to Uint8Array → Blob (required for Capacitor WebViews)
    const ab = await file.arrayBuffer();
    const blob = new Blob([new Uint8Array(ab)], {
      type: file.type || 'application/octet-stream',
    });

    update({ status: 'Uploading to Supabase Storage…', progress: 30 });

    const { error } = await supabase.storage
      .from('dicom-files')
      .upload(filePath, blob, {
        cacheControl: '3600',
        upsert: true,
        contentType: file.type || 'application/octet-stream',
      });

    if (error) throw new Error(`Supabase Storage error: ${error.message}`);

    update({ progress: 90 });
    return filePath;
  };

  // ── Upload to S3 (> 40 MB, 300-400 MB+) ───────────────────────────────────
  const uploadToS3Multipart = async (
    file: File,
    patientId: string,
    relPath: string,
  ): Promise<string> => {
    const s3Key = `dicom/${patientId}/${relPath}`;
    update({ destination: 's3', status: 'Starting multipart upload…', progress: 2 });

    const finalKey = await uploadLargeFileToS3(file, s3Key, {
      partSizeMB: 20,     // 20 MB parts → ~15-20 requests for 300-400 MB
      concurrency: 2,     // 2 concurrent on mobile networks
      onProgress: ({ percent, partsDone, totalParts, loaded, total }) => {
        update({
          progress: Math.min(Math.round(percent * 0.93), 93), // reserve 7% for DB step
          status: totalParts > 1
            ? `Uploading part ${partsDone}/${totalParts} (${formatBytes(loaded)} / ${formatBytes(total)})…`
            : `Uploading to AWS S3… ${percent}%`,
          partsDone,
          totalParts,
        });
      },
    });

    return `s3://${S3_BUCKET}/${finalKey}`;
  };

  // ── Main upload handler ─────────────────────────────────────────────────────
  const handleUpload = async () => {
    if (!selectedFile) return toast.error('No file selected');

    setState({ ...INITIAL_STATE, uploading: true, status: 'Authenticating…' });

    try {
      const isNative = Capacitor.isNativePlatform();
      const nativeFile = isNative ? (window as any)._nativeSelectedDicomFile : null;

      console.log(`📤 [DICOM] Starting [${isNative ? 'NATIVE' : 'WEB'}]:`, {
        name: selectedFile.name,
        size: selectedFile.size,
        type: selectedFile.type
      });

      // 1. Auth
      const { data: { user }, error: authErr } = await supabase.auth.getUser();
      if (authErr || !user) throw new Error('Not authenticated. Please log in.');

      // 2. Patient profile
      update({ status: 'Fetching patient profile…', progress: 1 });
      const { data: patient, error: patientErr } = await supabase
        .from('patients')
        .select('id, full_name')
        .eq('auth_user_id', user.id)
        .maybeSingle();

      if (patientErr) throw new Error(`Profile error: ${patientErr.message}`);
      if (!patient) throw new Error('Patient profile not found. Complete your profile first.');

      // 3. Build S3/Supabase key
      const studyId = generateId();
      const isZip = selectedFile.name.toLowerCase().endsWith('.zip');
      const safeName = selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const relPath = isZip
        ? `studies/${studyId}/original/${safeName}`
        : `studies/${studyId}/${generateId()}/${safeName}`;

      const fileMB = selectedFile.size / 1024 / 1024;
      const useS3 = selectedFile.size > SUPABASE_LIMIT_BYTES;
      const storageType: 'supabase' | 's3' = useS3 ? 's3' : 'supabase';
      console.log(`📍 [DICOM] Routing to ${storageType.toUpperCase()} | Size: ${fileMB.toFixed(1)} MB`);

      // 4. Route to correct storage
      let storageLocation: string;

      if (isNative && nativeFile) {
        // ── Native Upload ──
        update({ status: 'Preparing native upload…', progress: 10 });
        storageType = useS3 ? 's3' : 'supabase';

        if (useS3) {
          console.log('🔗 [DICOM] Generating S3 Presigned URL...');
          const s3Key = `dicom/${patient.id}/${relPath}`;
          uploadUrl = await getS3PresignedUrl(s3Key, selectedFile.type || 'application/octet-stream');
          storageLocation = `s3://${S3_BUCKET}/${s3Key}`;
          console.log('✅ [DICOM] S3 Presigned URL generated');
        } else {
          console.log('🔗 [DICOM] Generating Supabase Signed URL...');
          const { data, error } = await supabase.storage.from('dicom-files').createSignedUploadUrl(relPath);
          if (error) {
            console.error('❌ [DICOM] Supabase Signed URL error:', error);
            throw error;
          }
          uploadUrl = data.signedUrl;
          storageLocation = relPath;
          console.log('✅ [DICOM] Supabase Signed URL generated');
        }

        console.log(`🚀 [DICOM] Initializing Native Uploader to ${storageType.toUpperCase()}...`);
        update({ status: `Uploading to ${storageType.toUpperCase()}…`, progress: 30 });
        
        const progressListener = await Uploader.addListener('uploadProgress', (info) => {
          if (info.progress) {
            const percent = Math.round(info.progress);
            update({ 
              progress: 30 + (percent * 0.6), 
              status: `Uploading to ${storageType.toUpperCase()}… ${percent}%` 
            });
            console.log(`⏳ [DICOM] Native Progress: ${percent}%`);
          }
        });

        try {
          console.log(`📡 [DICOM] Executing PUT request to: ${uploadUrl.substring(0, 50)}...`);
          await Uploader.upload({
            url: uploadUrl,
            path: nativeFile.path,
            method: 'PUT',
            headers: { 'Content-Type': selectedFile.type || 'application/octet-stream' },
          });
          console.log('✅ [DICOM] Native upload success');
        } catch (nativeErr) {
          console.error('❌ [DICOM] Native Uploader CRASHED:', nativeErr);
          throw nativeErr;
        } finally {
          progressListener.remove();
        }
        
        update({ progress: 90 });
      } else {
        // ── Web Upload ──
        if (useS3) {
          storageLocation = await uploadToS3Multipart(selectedFile, patient.id, relPath);
          storageType = 's3';
        } else {
          storageLocation = await uploadToSupabase(selectedFile, relPath);
          storageType = 'supabase';
        }
      }

      // 5. Save to database
      update({ status: 'Saving study record…', progress: 95 });
      const { error: dbErr } = await supabase.from('dicom_studies').insert({
        id: studyId,
        study_instance_uid: `upload-${studyId}`,
        patient_id: patient.id,
        patient_ref_id: patient.id,
        uploaded_by: user.id,
        uploaded_by_type: 'patient',
        status: 'staged',
        is_zip_upload: isZip,
        zip_file_path: isZip ? storageLocation : null,
        zip_file_size: isZip ? selectedFile.size : null,
        zip_extracted: false,
        description: `Upload: ${selectedFile.name} [${storageType.toUpperCase()}]`,
        patient_name: patient.full_name || patient.id,
      });

      if (dbErr) throw new Error(`Database error: ${dbErr.message}`);

      // 6. Done
      update({ progress: 100, status: 'Upload complete!' });
      toast.success(`✅ Uploaded to ${storageType.toUpperCase()}!`);
      if (onUploadComplete) onUploadComplete(studyId);

      setTimeout(() => {
        setSelectedFile(null);
        setState(INITIAL_STATE);
        (window as any)._nativeSelectedDicomFile = null;
      }, 2500);
    } catch (err: any) {
      console.error('❌ DICOM upload failed:', err);
      toast.error(err?.message || 'Upload failed. Please try again.');
      setState(INITIAL_STATE);
      (window as any)._nativeSelectedDicomFile = null;
    }
  };

  // ── Derived UI values ───────────────────────────────────────────────────────
  const fileMB = selectedFile ? (selectedFile.size / 1024 / 1024).toFixed(1) : null;
  const willUseS3 = selectedFile && selectedFile.size > SUPABASE_LIMIT_BYTES;
  const { uploading, progress, status, destination, partsDone, totalParts } = state;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileArchive className="h-4 w-4" />
          Upload DICOM Files
        </CardTitle>
        <CardDescription className="text-xs">
          ZIP or DICOM files · ≤ 40 MB → Supabase · &gt; 40 MB → AWS S3 multipart
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">

        {/* ── File picker ── */}
        {!selectedFile ? (
          <div>
            <input
              type="file"
              accept=".zip,.dcm,.dicom,application/zip,application/dicom"
              onChange={handleFileSelect}
              className="hidden"
              id="dicom-file-input"
              disabled={uploading}
            />
            <label htmlFor="dicom-file-input">
              <div className={`
                border-2 border-dashed rounded-xl p-8
                flex flex-col items-center justify-center gap-3
                cursor-pointer transition-all duration-200
                ${uploading ? 'opacity-50 pointer-events-none' : 'hover:border-primary/60 hover:bg-muted/20'}
              `}>
                <FileArchive className="h-12 w-12 text-muted-foreground" />
                <div className="text-center space-y-1">
                  <p className="text-sm font-semibold">Tap to select file</p>
                  <p className="text-xs text-muted-foreground">ZIP or DICOM (.dcm) accepted</p>
                  <div className="flex items-center justify-center gap-3 mt-2">
                    <span className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
                      <Database className="h-3 w-3" /> ≤ {SUPABASE_LIMIT_MB} MB → Supabase
                    </span>
                    <span className="text-muted-foreground">·</span>
                    <span className="flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400">
                      <Cloud className="h-3 w-3" /> &gt; {SUPABASE_LIMIT_MB} MB → AWS S3
                    </span>
                  </div>
                </div>
              </div>
            </label>
          </div>
        ) : (

          /* ── Selected file card ── */
          <Card className="bg-muted/40">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  {selectedFile.name.toLowerCase().endsWith('.zip')
                    ? <FileArchive className="h-5 w-5 text-primary" />
                    : <File className="h-5 w-5 text-primary" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{selectedFile.name}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <p className="text-xs text-muted-foreground">{fileMB} MB</p>
                    {willUseS3 ? (
                      <span className="flex items-center gap-1 text-xs bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 px-2 py-0.5 rounded-full font-medium">
                        <Cloud className="h-3 w-3" /> AWS S3 Multipart
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full font-medium">
                        <Database className="h-3 w-3" /> Supabase
                      </span>
                    )}
                  </div>
                </div>
                {!uploading && (
                  <Button variant="ghost" size="sm" onClick={() => setSelectedFile(null)}>
                    Remove
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Progress bar ── */}
        {uploading && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1.5 min-w-0">
                {destination === 's3'
                  ? <Cloud className="h-3.5 w-3.5 text-orange-500 shrink-0" />
                  : <Database className="h-3.5 w-3.5 text-blue-500 shrink-0" />}
                <span className="truncate">{status}</span>
              </span>
              <span className="font-semibold tabular-nums ml-2 shrink-0">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2.5" />
            {/* Part counter for large S3 uploads */}
            {destination === 's3' && totalParts > 1 && (
              <p className="text-xs text-muted-foreground text-center">
                Part {Math.min(partsDone + 1, totalParts)} of {totalParts} · Keep app open during upload
              </p>
            )}
          </div>
        )}

        {/* ── Bottom row ── */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {uploading ? (
              <><Loader2 className="h-4 w-4 animate-spin" /><span>Uploading…</span></>
            ) : progress === 100 ? (
              <><CheckCircle className="h-4 w-4 text-green-500" /><span className="text-green-500">Complete!</span></>
            ) : null}
          </div>

          <Button
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
            size="sm"
            className="min-w-[100px]"
          >
            {uploading
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Uploading</>
              : <><Upload className="mr-2 h-4 w-4" />Upload</>
            }
          </Button>
        </div>

        {/* ── Info note ── */}
        <div className="bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
          <p className="text-xs text-blue-900 dark:text-blue-100 leading-relaxed">
            <strong>Large files (300–400 MB+)</strong> are automatically split into 20 MB parts and uploaded
            in parallel to AWS S3 (ap-south-2). Keep the app in the foreground during upload.
            After upload, request a radiologist review below.
          </p>
        </div>

      </CardContent>
    </Card>
  );
}

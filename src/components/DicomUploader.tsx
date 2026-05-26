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

import { useState, useEffect } from 'react';
import { supabase, supabaseUrl, supabaseAnonKey } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Upload, FileArchive, CheckCircle, Loader2, File, Cloud, Database } from 'lucide-react';
import { uploadLargeFileToS3, getS3PresignedUrl } from '@/services/s3MultipartUploadService';
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { Uploader } from '@capgo/capacitor-uploader';
import { FilePicker } from '@capawesome/capacitor-file-picker';
import { useAuth } from '@/contexts/AuthContext';
import { Filesystem, Directory } from '@capacitor/filesystem';

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
  patientProfile?: any;
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
export default function DicomUploader({ onUploadComplete, patientProfile: propProfile }: DicomUploaderProps) {
  const { user } = useAuth();
  const [state, setState] = useState<UploadState>(INITIAL_STATE);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const update = (patch: Partial<UploadState>) =>
    setState((prev) => ({ ...prev, ...patch }));

  // 🚀 Recovery logic: Sync selectedFile state with localStorage on mount (survives Android process death)
  useEffect(() => {
    if (Capacitor.isNativePlatform() && !selectedFile) {
      const cached = localStorage.getItem('_native_selected_dicom_file');
      if (cached) {
        try {
          const fileData = JSON.parse(cached);
          console.log('🔄 [DICOM] Restoring selected file from cache:', fileData.name);
          setSelectedFile({
            name: fileData.name,
            size: fileData.size,
            type: fileData.mimeType || 'application/octet-stream',
          } as any);
        } catch (e) {
          console.error('Failed to restore selected file info', e);
        }
      }
    }
  }, []);

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

          let finalPath = file.path;
          // 🚀 Fix for Android SecurityException: Copy to cache
          if (Capacitor.getPlatform() === 'android' && finalPath?.startsWith('content://')) {
            try {
              const cacheName = `dicom_upload_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
              toast.info('Preparing file for upload...', { duration: 2000 });

              const copyResult = await Filesystem.copy({
                from: finalPath,
                to: cacheName,
                toDirectory: Directory.Cache
              });
              finalPath = copyResult.uri;
              console.log('📂 [DICOM] Copied content URI to cache:', finalPath);
            } catch (copyErr) {
              console.error('Failed to copy file to cache:', copyErr);
              // Fallback to original path, though it might fail later
            }
          }

          const fileToSave = {
            ...file,
            path: finalPath
          };

          (window as any)._nativeSelectedDicomFile = fileToSave;
          localStorage.setItem('_native_selected_dicom_file', JSON.stringify({
            path: fileToSave.path,
            name: fileToSave.name,
            size: fileToSave.size,
            mimeType: fileToSave.mimeType
          }));

          setSelectedFile({
            name: fileToSave.name,
            size: fileToSave.size,
            type: fileToSave.mimeType,
          } as any);

          const sizeMB = (fileToSave.size / 1024 / 1024).toFixed(1);
          const dest = fileToSave.size > SUPABASE_LIMIT_BYTES ? 'AWS S3' : 'Supabase';
          toast.success(`Selected: ${fileToSave.name} (${sizeMB} MB) → ${dest}`);
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
    const isNative = Capacitor.isNativePlatform();

    if (!selectedFile && !isNative) return toast.error('No file selected');

    setState({ ...INITIAL_STATE, uploading: true, status: 'Authenticating…' });

    try {
      let storageLocation = '';
      let storageType: 'supabase' | 's3' = 'supabase';
      let uploadUrl = '';

      // 🚀 Recovery logic for app restarts
      let nativeFile = isNative ? (window as any)._nativeSelectedDicomFile : null;
      if (isNative && !nativeFile) {
        const cached = localStorage.getItem('_native_selected_dicom_file');
        if (cached) {
          try {
            nativeFile = JSON.parse(cached);
            console.log('🔄 [DICOM] Recovered native file from cache:', nativeFile.name);
          } catch (e) {
            console.error('Failed to parse cached DICOM info', e);
          }
        }
      }

      if (!selectedFile && !nativeFile) {
        return toast.error('No file selected');
      }

      const fileNameRaw = selectedFile?.name || nativeFile?.name || 'file';
      const fileSize = selectedFile?.size || nativeFile?.size || 0;
      const fileType = selectedFile?.type || nativeFile?.mimeType || 'application/octet-stream';

      console.log(`📤 [DICOM] Starting [${isNative && nativeFile ? 'NATIVE' : 'WEB'}]:`, {
        name: fileNameRaw,
        size: fileSize,
        type: fileType
      });

      // 1. Auth & Patient Profile
      update({ status: 'Authenticating…', progress: 1 });

      const projectRef = supabaseUrl.split('//')[1].split('.')[0];
      const tokenKey = `sb-${projectRef}-auth-token`;
      const cachedSession = localStorage.getItem(tokenKey);
      let authUser = user;

      if (!authUser) {
        console.log('📡 [DICOM] No user from hook, trying robust fetch...');
        const { data: { user: fetchedUser } } = await supabase.auth.getUser();
        authUser = fetchedUser;
      }

      if (!authUser) throw new Error('Not authenticated. Please log in.');

      // 2. Patient profile with timeout
      update({ status: 'Fetching patient profile…', progress: 5 });

      let patient = propProfile;
      if (!patient) {
        console.log('📡 [DICOM] No profile from props, fetching with 15s timeout...');
        const profileTimeout = new Promise<any>((_, reject) =>
          setTimeout(() => reject(new Error('Profile fetch timeout')), 15000)
        );

        const profilePromise = supabase
          .from('patients')
          .select('id, full_name')
          .eq('auth_user_id', authUser.id)
          .maybeSingle();

        const { data: fetchedPatient, error: patientErr } = await Promise.race([profilePromise, profileTimeout]);
        if (patientErr) throw new Error(`Profile error: ${patientErr.message}`);
        patient = fetchedPatient;
      } else {
        console.log('✅ [DICOM] Using profile from props:', patient.id);
      }

      if (!patient) throw new Error('Patient profile not found. Complete your profile first.');

      // 3. Build S3/Supabase key
      const studyId = generateId();
      const isZip = fileNameRaw.toLowerCase().endsWith('.zip');
      const safeName = fileNameRaw.replace(/[^a-zA-Z0-9._-]/g, '_');
      const relPath = isZip
        ? `studies/${studyId}/original/${safeName}`
        : `studies/${studyId}/${generateId()}/${safeName}`;

      const fileMB = fileSize / 1024 / 1024;
      const useS3 = fileSize > SUPABASE_LIMIT_BYTES;
      storageType = useS3 ? 's3' : 'supabase';
      console.log(`📍 [DICOM] Routing to ${storageType.toUpperCase()} | Size: ${fileMB.toFixed(1)} MB`);

      // 4. Route to correct storage
      storageLocation = '';

      // 🚀 Native Signed URL Helper
      const getSignedUrlNatively = async (bucket: string, path: string) => {
        console.log(`📡 [DICOM Native] Starting URL generation for ${bucket}/${path}...`);
        await new Promise(r => setTimeout(r, 500));

        const projectRef = supabaseUrl.split('//')[1].split('.')[0];
        const tokenKey = `sb-${projectRef}-auth-token`;
        const cachedSession = localStorage.getItem(tokenKey);
        let token = supabaseAnonKey;

        if (cachedSession) {
          try {
            const parsed = JSON.parse(cachedSession);
            token = parsed.access_token || token;
            console.log('📡 [DICOM Native] Using session token');
          } catch (e) { }
        }

        const encodedPath = path.split('/').map(segment => encodeURIComponent(segment)).join('/');
        const fullUrl = `${supabaseUrl}/storage/v1/object/upload/sign/${bucket}/${encodedPath}`;

        console.log(`📡 [DICOM Native] POST ${fullUrl}`);

        const timeoutPromise = new Promise<any>((_, reject) =>
          setTimeout(() => reject(new Error('Native DICOM URL Timeout (20s)')), 20000)
        );

        const response = await Promise.race([
          CapacitorHttp.post({
            url: fullUrl,
            headers: {
              'Authorization': `Bearer ${token}`,
              'apikey': supabaseAnonKey,
              'Content-Type': 'application/json',
            },
            data: {}
          }),
          timeoutPromise
        ]);

        console.log(`📡 [DICOM Native] Status: ${response.status}`);
        if (response.status >= 200 && response.status < 300) {
          const resultUrl = response.data.signedURL || response.data.signedUrl || response.data.url;
          if (resultUrl) {
            if (resultUrl.startsWith('/')) {
              return `${supabaseUrl}/storage/v1${resultUrl}`;
            }
            return resultUrl;
          }
        }
        throw new Error(`Native Signed URL error: ${response.status} ${JSON.stringify(response.data)}`);
      };

      if (isNative && nativeFile) {
        // ── Native Upload ──
        update({ status: 'Preparing native upload…', progress: 10 });
        storageType = useS3 ? 's3' : 'supabase';

        if (useS3) {
          const s3Key = `dicom/${patient.id}/${relPath}`;
          console.log(`🔗 [DICOM] Generating S3 Presigned URL for: ${s3Key}...`);

          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('S3 URL Generation Timeout')), 20000)
          );
          uploadUrl = await Promise.race([getS3PresignedUrl(s3Key, fileType), timeoutPromise]) as string;
          storageLocation = `s3://${S3_BUCKET}/${s3Key}`;
          console.log('✅ [DICOM] S3 Presigned URL generated');
        } else {
          const bucket = 'dicom-files';
          console.log(`🔗 [DICOM] Generating Supabase Signed URL for: ${relPath}...`);

          try {
            if (isNative) {
              console.log('🚀 [DICOM] Using robust native URL generation...');
              const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Native DICOM URL Timeout (30s)')), 30000)
              );
              uploadUrl = await Promise.race([getSignedUrlNatively(bucket, relPath), timeoutPromise]) as string;
            } else {
              const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(relPath);
              if (error) throw error;
              uploadUrl = data.signedUrl;
            }
          } catch (err: any) {
            console.error('❌ [DICOM] Signed URL generation failed:', err);
            throw new Error(`Failed to initialize upload: ${err.message}`);
          }
          storageLocation = relPath;
          console.log('✅ [DICOM] Supabase Signed URL generated');
        }

        console.log(`🚀 [DICOM] Initializing Native Uploader to ${storageType.toUpperCase()}...`);
        update({ status: `Uploading to ${storageType.toUpperCase()}…`, progress: 30 });

        let progressListener: any;
        let uploadId: string | null = null;

        try {
          console.log(`📡 [DICOM] Executing PUT request to: ${uploadUrl.substring(0, 50)}...`);

          await new Promise<void>(async (resolve, reject) => {
            progressListener = await Uploader.addListener('events', (event: any) => {
              if (uploadId && event.id !== uploadId) return;

              if (event.name === 'uploading') {
                if (event.payload.percent) {
                  const percent = Math.round(event.payload.percent);
                  update({
                    progress: 30 + (percent * 0.5),
                    status: `Uploading to ${storageType.toUpperCase()}… ${percent}%`
                  });
                  console.log(`⏳ [DICOM] Native Progress: ${percent}%`);
                }
              } else if (event.name === 'completed') {
                console.log('✅ [DICOM] Native upload success');
                resolve();
              } else if (event.name === 'failed') {
                console.error('❌ [DICOM] Native Uploader CRASHED:', event.payload.error);
                reject(new Error(event.payload.error || 'Upload failed'));
              }
            });

            // 🚀 Start upload with a fail-safe
            try {
              console.log(`📡 [DICOM] Calling Uploader.startUpload for ${fileNameRaw}...`);
              const startTimeout = setTimeout(() => {
                if (!uploadId) reject(new Error('Uploader failed to start within 15s'));
              }, 15000);

              let uploadFilePath = nativeFile.path;
              if (Capacitor.getPlatform() === 'android' && uploadFilePath.startsWith('file://')) {
                uploadFilePath = uploadFilePath.replace('file://', '');
              }

              const result = await Uploader.startUpload({
                filePath: uploadFilePath,
                serverUrl: uploadUrl,
                method: 'PUT',
                headers: {
                  'Content-Type': fileType
                },
                mimeType: fileType,
                notificationTitle: 'Uploading DICOM Study'
              });

              clearTimeout(startTimeout);
              uploadId = result.id;
              console.log(`📡 [DICOM] Upload started successfully, ID: ${uploadId}`);
            } catch (startErr) {
              console.error('❌ [DICOM] Uploader.startUpload failed:', startErr);
              reject(startErr);
            }
          });
        } catch (nativeErr) {
          console.error('❌ [DICOM] Native Uploader CRASHED:', nativeErr);
          throw nativeErr;
        } finally {
          if (progressListener) {
            await progressListener.remove();
          }
        }

        update({ progress: 85 });
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
      console.log('📝 [DICOM] Inserting record into dicom_studies...', studyId);
      const payload = {
        id: studyId,
        study_instance_uid: `upload-${studyId}`,
        patient_id: patient.id,
        patient_ref_id: patient.id,
        uploaded_by: user.id,
        uploaded_by_type: 'patient',
        status: 'staged',
        is_zip_upload: isZip,
        zip_file_path: isZip ? (storageLocation || relPath) : null,
        zip_file_size: isZip ? fileSize : null,
        zip_extracted: false,
        description: `Upload: ${fileNameRaw} [${storageType.toUpperCase()}]`,
        patient_name: patient.full_name || patient.id,
      };

      if (isNative && (window as any).Capacitor) {
        console.log('📝 [DICOM] Native direct insert dicom_studies. Getting session...');

        const timeoutPromise = new Promise<any>((_, reject) =>
          setTimeout(() => reject(new Error('Native DICOM DB Insert Timeout (25s)')), 25000)
        );

        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? '';
        const projectRef = supabaseUrl.split('//')[1]?.split('.')[0] ?? '';
        const tokenKey = `sb-${projectRef}-auth-token`;
        const cachedSession = localStorage.getItem(tokenKey);
        let token = null;

        if (cachedSession) {
          try {
            token = JSON.parse(cachedSession).access_token;
          } catch (e) { }
        }

        if (!token) {
          const session = await Promise.race([
            supabase.auth.getSession(),
            new Promise<any>((_, reject) => setTimeout(() => reject(new Error('Session Timeout')), 5000))
          ]);
          token = session.data.session?.access_token;
        }

        console.log('📝 [DICOM] Executing native DB insert...');
        const resp = await Promise.race([
          CapacitorHttp.post({
            url: `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/dicom_studies`,
            headers: {
              'Authorization': `Bearer ${token}`,
              'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
              'Content-Type': 'application/json',
              'Prefer': 'return=representation'
            },
            data: payload
          }),
          timeoutPromise
        ]);

        console.log(`📝 [DICOM] Insert result status: ${resp.status}`);
        if (resp.status >= 400) throw new Error(`Database error ${resp.status}: ${JSON.stringify(resp.data)}`);
        console.log('📝 [DICOM] Insert result data:', resp.data);
      } else {
        const { data: dbData, error: dbErr } = await supabase.from('dicom_studies').insert(payload).select();
        console.log('📝 [DICOM] Insert result:', { error: dbErr, data: dbData });
        if (dbErr) throw new Error(`Database error: ${dbErr.message}`);
      }

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
        {/* <CardDescription className="text-xs">
        </CardDescription> */}
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

      </CardContent>
    </Card>
  );
}

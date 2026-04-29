import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Upload, FileArchive, CheckCircle, Loader2, File } from 'lucide-react';

interface DicomUploaderProps {
  onUploadComplete?: (studyId: string) => void;
}

export default function DicomUploader({ onUploadComplete }: DicomUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check if ZIP or DICOM file
    const isZip = file.name.endsWith('.zip') || file.type.includes('zip');
    const isDicom = file.name.endsWith('.dcm') || file.name.endsWith('.dicom');

    if (!isZip && !isDicom) {
      toast.error('Please select a ZIP or DICOM file');
      return;
    }

    setSelectedFile(file);
    toast.success('File selected. Click Upload to proceed.');
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('No file selected');
      return;
    }

    setUploading(true);
    setProgress(0);
    setStatus('Preparing upload...');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated. Please log in.');

      setStatus('Fetching profile...');
      const { data: patient, error: patientError } = await supabase
        .from('patients')
        .select('id, full_name')
        .eq('auth_user_id', user.id)
        .maybeSingle();

      if (patientError) throw patientError;
      if (!patient) throw new Error('Patient profile not found. Please complete your profile first.');

      // Robust ID generation
      const generateId = () => {
        try {
          if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
        } catch (e) { /* fallback */ }
        return Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
      };

      const studyId = generateId();
      const isZip = selectedFile.name.toLowerCase().endsWith('.zip');
      
      // Sanitize filename to avoid issues with storage paths
      const safeFileName = selectedFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      
      let filePath: string;
      if (isZip) {
        filePath = `studies/${studyId}/original/${safeFileName}`;
      } else {
        const seriesId = generateId();
        filePath = `studies/${studyId}/${seriesId}/${safeFileName}`;
      }

      setStatus('Processing file...');
      // Convert to Blob for better compatibility across platforms (especially Mobile)
      let fileToUpload: Blob | File = selectedFile;
      
      try {
        const arrayBuffer = await selectedFile.arrayBuffer();
        fileToUpload = new Blob([arrayBuffer], { type: selectedFile.type || 'application/octet-stream' });
      } catch (err) {
        console.warn('Failed to convert to Blob, using original file:', err);
      }

      setStatus('Uploading to cloud storage...');
      const { error: uploadError } = await supabase.storage
        .from('dicom-files')
        .upload(filePath, fileToUpload, {
          cacheControl: '3600',
          upsert: true,
          contentType: selectedFile.type || 'application/octet-stream'
        });

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        throw new Error(`Cloud storage error: ${uploadError.message}`);
      }

      setProgress(80);
      setStatus('Finalizing study record...');

      const { error: dbError } = await supabase
        .from('dicom_studies')
        .insert({
          id: studyId,
          study_instance_uid: `upload-${studyId}`,
          patient_id: patient.id,
          patient_ref_id: patient.id,
          uploaded_by: user.id,
          uploaded_by_type: 'patient',
          status: 'staged',
          is_zip_upload: isZip,
          zip_file_path: isZip ? filePath : null,
          zip_file_size: isZip ? selectedFile.size : null,
          zip_extracted: false,
          description: `Upload: ${selectedFile.name}`,
          patient_name: patient.full_name || patient.id
        });

      if (dbError) {
        console.error('Database insertion error:', dbError);
        throw new Error(`Database error: ${dbError.message}`);
      }

      setProgress(100);
      setStatus('Done!');
      
      toast.success('Study uploaded successfully!');
      
      if (onUploadComplete) {
        onUploadComplete(studyId);
      }

      setTimeout(() => {
        setSelectedFile(null);
        setProgress(0);
        setStatus('');
        setUploading(false);
      }, 2000);

    } catch (error: any) {
      console.error('Upload process failed:', error);
      toast.error(error.message || 'Upload failed');
      setUploading(false);
      setProgress(0);
      setStatus('');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileArchive className="h-4 w-4" />
          Upload DICOM Files
        </CardTitle>
        <CardDescription className="text-xs">
          Upload ZIP or DICOM files for radiologist review
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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
                border-2 border-dashed rounded-lg p-6
                flex flex-col items-center justify-center
                cursor-pointer transition-colors
                ${uploading ? 'opacity-50 pointer-events-none' : 'hover:border-primary/50'}
              `}>
                <FileArchive className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-center text-sm text-muted-foreground mb-2">
                  Tap to select file
                </p>
                <p className="text-xs text-muted-foreground">
                  ZIP or DICOM files
                </p>
              </div>
            </label>
          </div>
        ) : (
          <Card className="bg-muted/50">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  {selectedFile.name.endsWith('.zip') ? (
                    <FileArchive className="h-5 w-5 text-primary" />
                  ) : (
                    <File className="h-5 w-5 text-primary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                {!uploading && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedFile(null)}
                  >
                    Remove
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {uploading && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{status}</span>
              <span className="font-medium">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Processing...</span>
              </>
            ) : progress === 100 ? (
              <>
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-green-500">Complete!</span>
              </>
            ) : null}
          </div>
          
          <Button
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
            size="sm"
          >
            <Upload className="mr-2 h-4 w-4" />
            Upload
          </Button>
        </div>

        <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mt-4">
          <p className="text-xs text-blue-900 dark:text-blue-100">
            <strong>Note:</strong> ZIP files will be extracted automatically. 
            After upload, you can request a radiologist to review your DICOM files.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}


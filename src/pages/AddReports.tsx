
import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, FilePlus2, Search, Upload, Camera, ChevronDown, FolderArchive } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { MobileAppContainer } from '../components/MobileAppContainer';
import { useToast } from '../hooks/use-toast';
import { supabase, db, supabaseUrl } from '@/lib/supabase';
import { useRealTimeVitals } from '@/hooks/useRealTimeVitals';
import { useAuth } from '@/contexts/AuthContext';
import { Camera as CapacitorCamera, CameraResultType, CameraSource } from '@capacitor/camera';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Network } from '@capacitor/network';

// Main Add Report Component
export default function AddReports() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { patientProfile: hookProfile } = useRealTimeVitals();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dicomFileInputRef = useRef<HTMLInputElement>(null);
  
  // State for form inputs
  const [reportType, setReportType] = useState('');
  const [reportName, setReportName] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedDicomFiles, setSelectedDicomFiles] = useState<File[]>([]);
  const [isDicomUpload, setIsDicomUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectingFile, setSelectingFile] = useState(false);
  const [patientProfile, setPatientProfile] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Fetch patient profile directly on mount
  useEffect(() => {
    if (!user) {
      setProfileLoading(false);
      return;
    }

    const fetchProfile = async () => {
      try {
        setProfileLoading(true);
        console.log('🔍 Fetching patient profile for user:', user.id);
        
        // Try hook first (might be faster if already loaded)
        if (hookProfile) {
          console.log('✅ Using profile from hook');
          setPatientProfile(hookProfile);
          setProfileLoading(false);
          return;
        }

        // Fetch directly from database
        const profileData = await db.getPatientProfile(user.id);
        if (profileData.error) {
          console.error('❌ Error fetching profile:', profileData.error);
          toast({
            title: "Error",
            description: "Failed to load profile: " + profileData.error.message,
            variant: "destructive",
          });
        } else if (profileData.data) {
          console.log('✅ Profile fetched directly:', profileData.data);
          setPatientProfile(profileData.data);
        } else {
          console.warn('⚠️ No profile data returned');
        }
      } catch (err) {
        console.error('❌ Exception fetching profile:', err);
        toast({
          title: "Error",
          description: "Failed to load patient profile",
          variant: "destructive",
        });
      } finally {
        setProfileLoading(false);
      }
    };

    fetchProfile();
  }, [user, hookProfile, toast]);

  // Update profile when hook profile changes
  useEffect(() => {
    if (hookProfile && !patientProfile) {
      console.log('✅ Profile loaded from hook');
      setPatientProfile(hookProfile);
      setProfileLoading(false);
    }
  }, [hookProfile, patientProfile]);

  const handleBack = () => {
    navigate('/reports');
  };

  const handleFileUpload = () => {
    try {
      if (fileInputRef.current) fileInputRef.current.value = '';
      setSelectingFile(true);
      fileInputRef.current?.click();
      setTimeout(() => setSelectingFile(false), 500);
    } catch (error) {
      console.error('Error opening file picker:', error);
      setSelectingFile(false);
      toast({ title: "Error", description: "Failed to open file picker.", variant: "destructive" });
    }
  };

  const handleDicomOrZipUpload = () => {
    try {
      if (dicomFileInputRef.current) dicomFileInputRef.current.value = '';
      setSelectingFile(true);
      dicomFileInputRef.current?.click();
      setTimeout(() => setSelectingFile(false), 500);
    } catch (error) {
      console.error('Error opening file picker:', error);
      setSelectingFile(false);
      toast({ title: "Error", description: "Failed to open file picker.", variant: "destructive" });
    }
  };

  const handleDicomFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSelectingFile(false);
    const files = event.target.files ? Array.from(event.target.files) : [];
    if (files.length === 0) return;
    const maxSize = Capacitor.isNativePlatform() ? 20 * 1024 * 1024 : 50 * 1024 * 1024;
    const totalSize = files.reduce((s, f) => s + f.size, 0);
    if (totalSize > maxSize) {
      toast({ title: "Too Large", description: `Total ${(totalSize / (1024 * 1024)).toFixed(2)}MB exceeds ${maxSize / (1024 * 1024)}MB`, variant: "destructive" });
      if (dicomFileInputRef.current) dicomFileInputRef.current.value = '';
      return;
    }
    const allZipOrDcm = files.every(f => {
      const n = f.name.toLowerCase();
      return n.endsWith('.zip') || n.endsWith('.dcm') || n.endsWith('.dicom');
    });
    if (!allZipOrDcm) {
      toast({ title: "Invalid", description: "Select only ZIP or DCM (.dcm) files.", variant: "destructive" });
      if (dicomFileInputRef.current) dicomFileInputRef.current.value = '';
      return;
    }
    setIsDicomUpload(true);
    setSelectedDicomFiles(files);
    setSelectedFile(files.length === 1 ? files[0] : null);
    toast({
      title: "DICOM / ZIP selected",
      description: files.length === 1 ? `${files[0].name}` : `${files.length} files (e.g. folder of DCM). Request radiologist from Reports → DICOM.`,
    });
    if (dicomFileInputRef.current) dicomFileInputRef.current.value = '';
  };

  const isDicomOrZip = (f: File) => {
    const ext = f.name.split('.').pop()?.toLowerCase();
    return ext === 'zip' || ext === 'dcm' || ext === 'dicom' || f.type === 'application/zip';
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setSelectingFile(false);
      const files = event.target.files ? Array.from(event.target.files) : [];
      
      if (files.length === 0) {
        console.log('No file selected');
        return;
      }

      const maxSize = Capacitor.isNativePlatform() 
        ? 20 * 1024 * 1024 // 20MB for native
        : 50 * 1024 * 1024; // 50MB for web

      // DICOM path: single ZIP, single DCM, or multiple DCM (folder)
      const singleFile = files.length === 1 ? files[0] : null;
      const allDcm = files.length > 0 && files.every(f => f.name.toLowerCase().endsWith('.dcm') || f.name.toLowerCase().endsWith('.dicom'));
      const singleZipOrDcm = singleFile && (singleFile.name.toLowerCase().endsWith('.zip') || singleFile.name.toLowerCase().endsWith('.dcm') || singleFile.name.toLowerCase().endsWith('.dicom'));

      if (singleZipOrDcm || (files.length > 1 && allDcm)) {
        const toCheck = singleFile ? [singleFile] : files;
        const totalSize = toCheck.reduce((s, f) => s + f.size, 0);
        if (totalSize > maxSize) {
          toast({
            title: "Too Large",
            description: `Total size ${(totalSize / (1024 * 1024)).toFixed(2)}MB exceeds ${maxSize / (1024 * 1024)}MB limit`,
            variant: "destructive",
          });
          if (fileInputRef.current) fileInputRef.current.value = '';
          setSelectedFile(null);
          setSelectedDicomFiles([]);
          setIsDicomUpload(false);
          return;
        }
        setIsDicomUpload(true);
        setSelectedFile(singleFile || null);
        setSelectedDicomFiles(singleFile ? [singleFile] : files);
        toast({
          title: "DICOM / ZIP Selected",
          description: files.length === 1
            ? `${files[0].name} — will be added to imaging. Request radiologist from Reports → DICOM.`
            : `${files.length} DCM files — one study. Request radiologist from Reports → DICOM.`,
        });
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      // Single file for regular report
      const file = files[0];
      if (files.length > 1) {
        toast({
          title: "One file for reports",
          description: "For regular reports use one file. For DICOM use ZIP or multiple .dcm files.",
          variant: "default",
        });
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      setIsDicomUpload(false);
      setSelectedDicomFiles([]);

      if (file.size > maxSize) {
        toast({
          title: "File Too Large",
          description: `Maximum file size is ${maxSize / (1024 * 1024)}MB on mobile. Your file is ${(file.size / (1024 * 1024)).toFixed(2)}MB`,
          variant: "destructive",
        });
        if (fileInputRef.current) fileInputRef.current.value = '';
        setSelectedFile(null);
        return;
      }

      const allowedTypes = [
        'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ];
      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      const allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'doc', 'docx'];
      
      if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension || '')) {
        toast({
          title: "Invalid File Type",
          description: "Use images (JPG, PNG), documents (PDF, DOC), or for imaging use ZIP / DICOM via the DICOM button below.",
          variant: "destructive",
        });
        if (fileInputRef.current) fileInputRef.current.value = '';
        setSelectedFile(null);
        return;
      }

      setSelectedFile(file);
      toast({
        title: "File Selected",
        description: `${file.name} (${(file.size / (1024 * 1024)).toFixed(2)}MB) is ready to upload`,
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error) {
      console.error('Error handling file selection:', error);
      setSelectingFile(false);
      toast({
        title: "Error",
        description: "Failed to process selected file. Please try again.",
        variant: "destructive",
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
      setSelectedFile(null);
      setSelectedDicomFiles([]);
      setIsDicomUpload(false);
    }
  };

  const handleTakePhoto = async () => {
    try {
      // Check if we're on a native platform (iOS/Android)
      if (Capacitor.isNativePlatform()) {
        try {
          // Use Capacitor Camera plugin for native platforms
          const image = await CapacitorCamera.getPhoto({
            quality: 90,
            allowEditing: false,
            resultType: CameraResultType.DataUrl,
            source: CameraSource.Camera,
          });

          if (image.dataUrl) {
            // Convert data URL to File object
            const response = await fetch(image.dataUrl);
            const blob = await response.blob();
            const fileName = `photo_${Date.now()}.jpg`;
            const file = new File([blob], fileName, { type: 'image/jpeg' });
            
            setSelectedFile(file);
            toast({
              title: "Photo Captured",
              description: "Photo is ready to upload",
            });
          }
        } catch (cameraError: any) {
          console.error('Camera error:', cameraError);
          
          // Check if permission was denied
          if (cameraError.message?.includes('permission') || 
              cameraError.message?.includes('denied') ||
              cameraError.code === 'PERMISSION_DENIED') {
            // Show dialog to open settings
            const shouldOpenSettings = window.confirm(
              'Camera permission is required to take photos. Would you like to open app settings to grant permission?'
            );
            
            if (shouldOpenSettings) {
              try {
                // Open app settings using platform-specific URL schemes
                if (Capacitor.getPlatform() === 'ios') {
                  // iOS: Try to open app settings
                  try {
                    window.location.href = 'app-settings:';
                  } catch {
                    // If that doesn't work, show instructions
                    toast({
                      title: "Open Settings",
                      description: "Please go to Settings > Monitraq > Camera and enable access",
                      variant: "default",
                    });
                  }
                } else if (Capacitor.getPlatform() === 'android') {
                  // Android: Try to open app info in settings
                  try {
                    // Use Android intent URL to open app settings
                    window.open('intent:#Intent;action=android.settings.APPLICATION_DETAILS_SETTINGS;data=package:com.monitraq.app;end', '_system');
                  } catch {
                    // Fallback: show instructions
                    toast({
                      title: "Open Settings",
                      description: "Please go to Settings > Apps > Monitraq > Permissions > Camera and enable it",
                      variant: "default",
                    });
                  }
                } else {
                  // Web or other platform
                  toast({
                    title: "Camera Permission Required",
                    description: "Please allow camera access in your browser settings",
                    variant: "default",
                  });
                }
              } catch (settingsError) {
                // Final fallback: show instructions
                toast({
                  title: "Open Settings Manually",
                  description: "Please go to your device Settings > Apps > Monitraq > Permissions and enable Camera",
                  variant: "default",
                });
              }
            }
            
            toast({
              title: "Camera Permission Required",
              description: "Please grant camera permission in app settings",
              variant: "destructive",
            });
          } else {
            toast({
              title: "Camera Error",
              description: cameraError.message || "Failed to capture photo. Please try again.",
              variant: "destructive",
            });
          }
        }
      } else {
        // Web platform - use browser API with better error handling
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          toast({
            title: "Camera Not Supported",
            description: "Camera access is not supported in this browser",
            variant: "destructive",
          });
          return;
        }

        try {
          // Request camera permission
          const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
              facingMode: 'environment' // Prefer back camera on mobile
            } 
          });
          
          // Create video element to capture frame
          const video = document.createElement('video');
          video.srcObject = stream;
          video.play();
          
          // Wait for video to be ready
          await new Promise((resolve) => {
            video.onloadedmetadata = () => {
              video.width = video.videoWidth;
              video.height = video.videoHeight;
              resolve(true);
            };
          });

          // Create canvas to capture image
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(video, 0, 0);
          
          // Stop the stream
          stream.getTracks().forEach(track => track.stop());
          
          // Convert canvas to blob and create file
          canvas.toBlob((blob) => {
            if (blob) {
              const fileName = `photo_${Date.now()}.jpg`;
              const file = new File([blob], fileName, { type: 'image/jpeg' });
              setSelectedFile(file);
              toast({
                title: "Photo Captured",
                description: "Photo is ready to upload",
              });
            }
          }, 'image/jpeg', 0.9);
        } catch (webError: any) {
          console.error('Web camera error:', webError);
          
          if (webError.name === 'NotAllowedError' || webError.name === 'PermissionDeniedError') {
            toast({
              title: "Camera Permission Denied",
              description: "Please allow camera access in your browser settings and try again",
              variant: "destructive",
            });
          } else if (webError.name === 'NotFoundError' || webError.name === 'DevicesNotFoundError') {
            toast({
              title: "No Camera Found",
              description: "No camera device was found on your device",
              variant: "destructive",
            });
          } else {
            toast({
              title: "Camera Error",
              description: webError.message || "Failed to access camera. Please try again.",
              variant: "destructive",
            });
          }
        }
      }
    } catch (error: any) {
      console.error('Unexpected camera error:', error);
      toast({
        title: "Camera Error",
        description: error.message || "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Network status check helper
  const checkNetworkStatus = async () => {
    try {
      const status = await Network.getStatus();
      console.log('🌐 Network status:', status);
      
      if (!status.connected) {
        toast({
          title: "No Internet Connection",
          description: "Please check your connection and try again",
          variant: "destructive",
        });
        return false;
      }
      
      if (status.connectionType === 'cellular') {
        toast({
          title: "Using Mobile Data",
          description: "Large files may take longer on mobile data",
          variant: "default",
        });
      }
      
      return true;
    } catch (error) {
      console.error('Error checking network status:', error);
      // Continue anyway if network check fails
      return true;
    }
  };

  // Upload logic extracted to avoid duplication
  const performUpload = async (profile: any) => {
    const filesToUse = isDicomUpload ? selectedDicomFiles : (selectedFile ? [selectedFile] : []);
    if (filesToUse.length === 0) {
      toast({ title: "No File Selected", description: "Please select a file to upload", variant: "destructive" });
      return false;
    }

    // DICOM / ZIP path: upload to dicom-files and dicom_studies
    if (isDicomUpload) {
      setUploading(true);
      setUploadProgress(0);
      const studyId = crypto.randomUUID();
      const isZip = filesToUse.length === 1 && (filesToUse[0].name.toLowerCase().endsWith('.zip') || filesToUse[0].type === 'application/zip');
      try {
        setUploadProgress(20);
        if (isZip) {
          const { error: uploadError } = await supabase.storage
            .from('dicom-files')
            .upload(`studies/${studyId}/original/${filesToUse[0].name}`, filesToUse[0], { cacheControl: '3600', upsert: false });
          if (uploadError) throw uploadError;
        } else {
          for (let i = 0; i < filesToUse.length; i++) {
            const f = filesToUse[i];
            const seriesId = crypto.randomUUID();
            const path = `studies/${studyId}/${seriesId}/${f.name}`;
            const { error: uploadError } = await supabase.storage.from('dicom-files').upload(path, f, { cacheControl: '3600', upsert: false });
            if (uploadError) throw uploadError;
            setUploadProgress(20 + Math.round((60 * (i + 1)) / filesToUse.length));
          }
        }
        setUploadProgress(80);
        const { error: dbError } = await supabase.from('dicom_studies').insert({
          id: studyId,
          study_instance_uid: `upload-${studyId}`,
          patient_id: profile.id,
          patient_ref_id: profile.id,
          uploaded_by: user!.id,
          uploaded_by_type: 'patient',
          status: 'staged',
          is_zip_upload: isZip,
          zip_file_path: isZip && filesToUse[0] ? `studies/${studyId}/original/${filesToUse[0].name}` : null,
          zip_file_size: isZip && filesToUse[0] ? filesToUse[0].size : null,
          zip_extracted: false,
          description: filesToUse.length === 1 ? `Upload: ${filesToUse[0].name}` : `${filesToUse.length} DICOM files`,
          patient_name: profile.id,
        });
        if (dbError) throw dbError;
        setUploadProgress(100);
        toast({
          title: "DICOM uploaded",
          description: "Go to Reports → DICOM tab to request a radiologist review.",
        });
        setSelectedDicomFiles([]);
        setSelectedFile(null);
        setIsDicomUpload(false);
        setTimeout(() => navigate('/reports'), 1500);
        return true;
      } catch (err: any) {
        console.error('DICOM upload error:', err);
        toast({ title: "Upload failed", description: err.message || "DICOM upload failed.", variant: "destructive" });
        return false;
      } finally {
        setUploading(false);
        setUploadProgress(0);
      }
    }

    if (!profile.assigned_doctor_id) {
      toast({
        title: "No Assigned Doctor",
        description: "You don't have an assigned doctor. Please contact support.",
        variant: "destructive",
      });
      return false;
    }

    setUploading(true);
    setUploadProgress(0);

    // Declare progress interval at function scope so it can be cleared in finally
    let progressInterval: NodeJS.Timeout | null = null;

    try {
      console.log('📤 Starting file upload...', {
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
        fileType: selectedFile.type,
        platform: Capacitor.getPlatform(),
        isNative: Capacitor.isNativePlatform(),
      });

      // Generate file name with patient ID prefix
      const fileExt = selectedFile.name.split('.').pop()?.toLowerCase() || 'jpg';
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(7);
      const fileName = `${profile.id}/report_${timestamp}_${randomId}.${fileExt}`;

      try {
        // Use Supabase Storage client API (works better on native platforms)
        console.log('🚀 Uploading to Supabase Storage...');
        
        // Start progress simulation
        progressInterval = setInterval(() => {
          setUploadProgress((prev) => {
            // Gradually increase progress, but don't go above 90% until upload completes
            if (prev < 90) {
              return Math.min(prev + 5, 90);
            }
            return prev;
          });
        }, 500);
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('patient-reports')
          .upload(fileName, selectedFile, {
            cacheControl: '3600',
            upsert: false,
            contentType: selectedFile.type || 'application/octet-stream',
          });

        // Clear progress interval once upload completes
        if (progressInterval) {
          clearInterval(progressInterval);
          progressInterval = null;
        }

        if (uploadError) {
          console.error('❌ Upload error:', uploadError);
          
          let errorMessage = uploadError.message || 'Upload failed';
          
          // Provide user-friendly error messages
          if (errorMessage.includes('timeout') || errorMessage.includes('Network request failed')) {
            errorMessage = "Upload took too long. Check your internet connection and try again.";
          } else if (errorMessage.includes('Failed to fetch') || errorMessage.includes('Network error')) {
            errorMessage = "Network connection issue. Please check your internet and try again.";
          } else if (errorMessage.includes('413') || errorMessage.includes('too large') || errorMessage.includes('Payload too large')) {
            errorMessage = "File is too large. Maximum size is 20MB on mobile.";
          } else if (errorMessage.includes('JWT') || errorMessage.includes('token') || errorMessage.includes('auth')) {
            errorMessage = "Authentication error. Please sign in again.";
          } else if (errorMessage.includes('duplicate') || errorMessage.includes('already exists')) {
            // Retry with a new filename if duplicate
            const retryFileName = `${profile.id}/report_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
            console.log('🔄 Retrying with new filename:', retryFileName);
            
            const { data: retryData, error: retryError } = await supabase.storage
              .from('patient-reports')
              .upload(retryFileName, selectedFile, {
                cacheControl: '3600',
                upsert: false,
                contentType: selectedFile.type || 'application/octet-stream',
              });

            if (retryError) {
              throw retryError;
            }
            
            // Use retry filename for database entry
            const finalFileName = retryFileName;
            const { error: insertError } = await supabase
              .from('patient_reports')
              .insert({
                patient_id: profile.id,
                doctor_id: profile.assigned_doctor_id,
                title: `${reportName} (by Dr. ${doctorName})`,
                description: `Uploaded by patient. Consulted with: ${doctorName}`,
                report_type: reportType,
                file_url: finalFileName,
                file_name: selectedFile.name,
                file_size: selectedFile.size,
                mime_type: selectedFile.type,
                uploaded_by_patient: true,
              });

            if (insertError) {
              console.error('❌ Database error:', insertError);
              throw insertError;
            }

            setUploadProgress(100);
            toast({
              title: "Success!",
              description: "Report uploaded successfully",
            });

            setTimeout(() => navigate('/reports'), 1000);
            return true;
          }

          throw new Error(errorMessage);
        }

        console.log('✅ File uploaded successfully:', uploadData);

        // Save to database
        const { error: insertError } = await supabase
          .from('patient_reports')
          .insert({
            patient_id: profile.id,
            doctor_id: profile.assigned_doctor_id,
            title: `${reportName} (by Dr. ${doctorName})`,
            description: `Uploaded by patient. Consulted with: ${doctorName}`,
            report_type: reportType,
            file_url: fileName,
            file_name: selectedFile.name,
            file_size: selectedFile.size,
            mime_type: selectedFile.type,
            uploaded_by_patient: true,
          });

        if (insertError) {
          console.error('❌ Database error:', insertError);
          throw insertError;
        }

        setUploadProgress(100);
        toast({
          title: "Success!",
          description: "Report uploaded successfully",
        });

        setTimeout(() => navigate('/reports'), 1000);
        return true;

      } catch (uploadError: any) {
        // Clear progress interval on error
        if (progressInterval) {
          clearInterval(progressInterval);
          progressInterval = null;
        }
        
        console.error('❌ Upload failed:', uploadError);
        
        let errorMessage = uploadError.message || 'Upload failed';
        
        // Provide user-friendly messages
        if (errorMessage.includes('timeout') || errorMessage.includes('Network request failed')) {
          errorMessage = "Upload took too long. Check your internet connection and try again.";
        } else if (errorMessage.includes('Failed to fetch') || errorMessage.includes('Network error')) {
          errorMessage = "Network connection issue. Please check your internet and try again.";
        } else if (errorMessage.includes('413') || errorMessage.includes('too large') || errorMessage.includes('Payload too large')) {
          errorMessage = "File is too large. Maximum size is 20MB on mobile.";
        } else if (errorMessage.includes('JWT') || errorMessage.includes('token') || errorMessage.includes('auth')) {
          errorMessage = "Authentication error. Please sign in again.";
        }

        toast({
          title: "Upload Failed",
          description: errorMessage,
          variant: "destructive",
          duration: 7000,
        });
        return false;
      }

    } catch (error: any) {
      console.error('❌ Unexpected error:', error);
      toast({
        title: "Error",
        description: error.message || "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
      return false;
    } finally {
      // Clear progress interval if still running
      if (progressInterval) {
        clearInterval(progressInterval);
      }
      // Ensure uploading state is always reset
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleSave = async () => {
    // DICOM path: only require DICOM files selected
    if (isDicomUpload) {
      if (selectedDicomFiles.length === 0) {
        toast({
          title: "No DICOM Selected",
          description: "Use «Upload DICOM / ZIP or Folder» and select a ZIP or .dcm files",
          variant: "destructive",
        });
        return;
      }
    } else {
      // Regular report: require form fields and single file
      if (!reportType || !reportName || !doctorName || !selectedFile) {
        toast({
          title: "Missing Information",
          description: "Please fill in all required fields and select a file",
          variant: "destructive",
        });
        return;
      }
    }

    // Wait for profile to load if still loading
    if (profileLoading) {
      toast({
        title: "Loading",
        description: "Please wait while we load your profile...",
        variant: "default",
      });
      return;
    }

    // Check network before upload
    const isConnected = await checkNetworkStatus();
    if (!isConnected) return;

    // Get profile - try state first, then fetch if needed
    let profileToUse = patientProfile;
    
    if (!profileToUse) {
      // Try fetching one more time before showing error
      console.log('🔄 Profile not found, attempting direct fetch...');
      try {
        const profileData = await db.getPatientProfile(user!.id);
        if (profileData.data) {
          console.log('✅ Profile found on retry');
          setPatientProfile(profileData.data);
          profileToUse = profileData.data;
        }
      } catch (err) {
        console.error('❌ Direct fetch failed:', err);
      }
    }

    if (!profileToUse) {
      toast({
        title: "Error",
        description: "Patient profile not found. Please try again.",
        variant: "destructive",
      });
      return;
    }

    // Perform the upload
    await performUpload(profileToUse);
  };

  return (
    <MobileAppContainer>
      <div className="bg-[#161B22] min-h-screen text-white font-inter">
        <div className="max-w-sm mx-auto min-h-screen bg-[#1C2128] flex flex-col relative">
          
          {/* Status Bar Spacing */}
          <div className="h-6"></div>
          
          {/* Header */}
          <header className="flex items-center justify-between p-4 border-b border-gray-700 flex-shrink-0">
            <div className="flex items-center">
              <button onClick={handleBack} className="text-gray-300 hover:text-white">
                <ArrowLeft size={24} />
              </button>
              <FilePlus2 size={24} className="mx-3 text-gray-400" />
              <h1 className="text-lg font-semibold text-white">Add Reports</h1>
            </div>
            <button className="text-gray-300 hover:text-white">
              <Search size={22} />
            </button>
          </header>

          {/* Main Content */}
          <main className="flex-grow p-5">
            {/* Loading State */}
            {profileLoading && (
              <div className="text-center py-12">
                <div className="inline-block bg-teal-500/20 p-4 rounded-full mb-3">
                  <div className="bg-teal-500/40 p-3 rounded-full">
                    <div className="w-7 h-7 border-2 border-teal-300 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                </div>
                <p className="text-gray-300">Loading your profile...</p>
              </div>
            )}

            {/* Error State - No Profile */}
            {!profileLoading && !patientProfile && (
              <div className="text-center py-12">
                <div className="inline-block bg-red-500/20 p-4 rounded-full mb-3">
                  <div className="bg-red-500/40 p-3 rounded-full">
                    <FilePlus2 className="text-red-300" size={28} />
                  </div>
                </div>
                <p className="text-red-300 font-semibold mb-2">Profile Not Found</p>
                <p className="text-gray-400 text-sm mb-4">Unable to load your patient profile. Please try refreshing the page.</p>
                <button
                  onClick={() => window.location.reload()}
                  className="bg-teal-500 text-white px-6 py-2 rounded-lg hover:bg-teal-600 transition-colors"
                >
                  Refresh Page
                </button>
              </div>
            )}

            {/* Form Content - Only show when profile is loaded */}
            {!profileLoading && patientProfile && (
              <>
                <div className="text-center mb-6">
                  <div className="inline-block bg-teal-500/20 p-4 rounded-full mb-3">
                      <div className="bg-teal-500/40 p-3 rounded-full">
                          <FilePlus2 className="text-teal-300" size={28} />
                      </div>
                  </div>
                  <p className="text-gray-300">Upload your medical report</p>
                  {(selectedFile || selectedDicomFiles.length > 0) && (
                    <div className="mt-3 p-3 bg-teal-500/10 border border-teal-500/30 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          {isDicomUpload && selectedDicomFiles.length > 0 ? (
                            <>
                              <p className="text-teal-300 text-sm font-medium">
                                {selectedDicomFiles.length === 1
                                  ? selectedDicomFiles[0].name
                                  : `${selectedDicomFiles.length} DCM files (imaging study)`}
                              </p>
                              <p className="text-teal-400/70 text-xs mt-1">
                                {(selectedDicomFiles.reduce((s, f) => s + f.size, 0) / (1024 * 1024)).toFixed(2)} MB total • DICOM
                              </p>
                            </>
                          ) : (
                            <>
                              <p className="text-teal-300 text-sm font-medium truncate">{selectedFile?.name}</p>
                              <p className="text-teal-400/70 text-xs mt-1">
                                {selectedFile && (selectedFile.size / (1024 * 1024)).toFixed(2)} MB • {selectedFile?.type || 'Unknown type'}
                              </p>
                            </>
                          )}
                        </div>
                        <button
                          onClick={() => {
                            setSelectedFile(null);
                            setSelectedDicomFiles([]);
                            setIsDicomUpload(false);
                            if (fileInputRef.current) fileInputRef.current.value = '';
                            if (dicomFileInputRef.current) dicomFileInputRef.current.value = '';
                            toast({
                              title: "File Removed",
                              description: "You can select a different file",
                            });
                          }}
                          className="ml-2 p-1 text-red-400 hover:text-red-300 transition-colors"
                          title="Remove file"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  )}
                </div>

            {/* Hidden file input - regular reports (single file) */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf,.doc,.docx,.zip,.dcm,.dicom"
              onChange={handleFileChange}
              onClick={(e) => {
                (e.target as HTMLInputElement).value = '';
              }}
              className="hidden"
            />
            {/* Hidden file input - DICOM: ZIP or multiple .dcm (folder) */}
            <input
              ref={dicomFileInputRef}
              type="file"
              accept=".zip,.dcm,.dicom"
              multiple
              onChange={handleDicomFileChange}
              onClick={(e) => {
                (e.target as HTMLInputElement).value = '';
              }}
              className="hidden"
            />

            {/* Upload Buttons */}
            <div className="space-y-3 mb-4">
              <button 
                onClick={handleFileUpload}
                disabled={selectingFile || uploading}
                className="w-full bg-[#30363D] text-gray-200 font-semibold py-3 rounded-lg flex items-center justify-center space-x-2 hover:bg-[#3C444C] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {selectingFile ? (
                  <>
                    <div className="w-5 h-5 border-2 border-gray-200/30 border-t-gray-200 rounded-full animate-spin"></div>
                    <span>Opening file picker...</span>
                  </>
                ) : (
                  <>
                    <Upload size={20} />
                    <span>Upload from Files</span>
                  </>
                )}
              </button>
              <button 
                onClick={handleDicomOrZipUpload}
                disabled={selectingFile || uploading}
                className="w-full bg-teal-500/20 text-teal-300 font-semibold py-3 rounded-lg flex items-center justify-center space-x-2 border border-teal-500/40 hover:bg-teal-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FolderArchive size={20} />
                <span>Upload DICOM / ZIP or Folder</span>
              </button>
              <button 
                onClick={handleTakePhoto}
                disabled={selectingFile || uploading}
                className="w-full bg-[#30363D] text-gray-200 font-semibold py-3 rounded-lg flex items-center justify-center space-x-2 hover:bg-[#3C444C] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Camera size={20} />
                <span>Take Photo</span>
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-6">
              Imaging studies: upload a <strong>ZIP</strong> or select multiple <strong>.dcm</strong> files (e.g. folder of DICOM). Then go to Reports → DICOM to request a radiologist review.
            </p>

                {/* Form */}
                <form className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-400 mb-2 block">Report Type *</label>
                    <div className="relative">
                      <select
                        key="report-type-select"
                        value={reportType}
                        onChange={(e) => {
                          console.log('🔍 Form change - selected value:', e.target.value);
                          setReportType(e.target.value);
                        }}
                        className="w-full appearance-none bg-[#2D333B] text-white border border-gray-600 rounded-lg py-3 px-4 focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                      >
                        <option value="" disabled>Select report type</option>
                        <option value="medical_report">Medical Report</option>
                        <option value="test_results">Test Results</option>
                        <option value="prescription">Prescription</option>
                        <option value="consultation_notes">Consultation Notes</option>
                        <option value="discharge_summary">Discharge Summary</option>
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={20} />
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-400 mb-2 block">Report Name *</label>
                    <input
                      type="text"
                      value={reportName}
                      onChange={(e) => setReportName(e.target.value)}
                      placeholder="Enter report name"
                      className="w-full bg-[#2D333B] text-white border border-gray-600 rounded-lg py-3 px-4 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 placeholder-gray-500"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-400 mb-2 block">Doctor Name *</label>
                    <input
                      type="text"
                      value={doctorName}
                      onChange={(e) => setDoctorName(e.target.value)}
                      placeholder="Enter the doctor who provided this report"
                      className="w-full bg-[#2D333B] text-white border border-gray-600 rounded-lg py-3 px-4 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 placeholder-gray-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">Name of the doctor who provided this report (will be visible to your assigned doctor)</p>
                  </div>
                </form>

                {/* Upload Progress Indicator */}
                {uploading && (
                  <div className="mt-4">
                    <div className="flex justify-between text-sm text-gray-400 mb-1">
                      <span>Uploading...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div 
                        className="bg-teal-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </>
            )}
          </main>

          {/* Save Button Footer */}
          <footer className="p-4 flex-shrink-0">
            <button 
              onClick={handleSave}
              disabled={uploading || profileLoading || !patientProfile}
              className="w-full bg-teal-500 text-white font-bold py-3 rounded-lg hover:bg-teal-600 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#1C2128] focus:ring-teal-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? (
                <div className="flex items-center justify-center">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                  Uploading...
                </div>
              ) : profileLoading ? (
                <div className="flex items-center justify-center">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                  Loading...
                </div>
              ) : !patientProfile ? (
                'Profile Not Available'
              ) : isDicomUpload && selectedDicomFiles.length > 0 ? (
                'Upload DICOM Study'
              ) : (
                'Save Report'
              )}
            </button>
          </footer>
        </div>
      </div>
    </MobileAppContainer>
  );
}

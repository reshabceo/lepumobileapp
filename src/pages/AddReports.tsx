
import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, FilePlus2, Search, Upload, Camera, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { MobileAppContainer } from '../components/MobileAppContainer';
import { useToast } from '../hooks/use-toast';
import { supabase, db } from '@/lib/supabase';
import { useRealTimeVitals } from '@/hooks/useRealTimeVitals';
import { useAuth } from '@/contexts/AuthContext';
import { Camera as CapacitorCamera, CameraResultType, CameraSource } from '@capacitor/camera';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

// Main Add Report Component
export default function AddReports() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { patientProfile: hookProfile } = useRealTimeVitals();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // State for form inputs
  const [reportType, setReportType] = useState('');
  const [reportName, setReportName] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectingFile, setSelectingFile] = useState(false);
  const [patientProfile, setPatientProfile] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(true);

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
      // Reset file input to allow selecting the same file again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setSelectingFile(true);
      fileInputRef.current?.click();
      
      // Reset selecting state after a short delay (file picker opens)
      setTimeout(() => {
        setSelectingFile(false);
      }, 500);
    } catch (error) {
      console.error('Error opening file picker:', error);
      setSelectingFile(false);
      toast({
        title: "Error",
        description: "Failed to open file picker. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setSelectingFile(false);
      const file = event.target.files?.[0];
      
      if (!file) {
        console.log('No file selected');
        return;
      }

      // Validate file size (max 50MB)
      const maxSize = 50 * 1024 * 1024; // 50MB
      if (file.size > maxSize) {
        toast({
          title: "File Too Large",
          description: `File size must be less than 50MB. Your file is ${(file.size / (1024 * 1024)).toFixed(2)}MB`,
          variant: "destructive",
        });
        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        setSelectedFile(null);
        return;
      }

      // Validate file type
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
          description: "Please select an image (JPG, PNG, GIF) or document (PDF, DOC, DOCX)",
          variant: "destructive",
        });
        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        setSelectedFile(null);
        return;
      }

      // File is valid, set it
      setSelectedFile(file);
      toast({
        title: "File Selected",
        description: `${file.name} (${(file.size / (1024 * 1024)).toFixed(2)}MB) is ready to upload`,
      });
    } catch (error) {
      console.error('Error handling file selection:', error);
      setSelectingFile(false);
      toast({
        title: "Error",
        description: "Failed to process selected file. Please try again.",
        variant: "destructive",
      });
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setSelectedFile(null);
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

  // Upload logic extracted to avoid duplication
  const performUpload = async (profile: any) => {
    // Validate inputs again before upload
    if (!selectedFile) {
      toast({
        title: "No File Selected",
        description: "Please select a file to upload",
        variant: "destructive",
      });
      return false;
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

    try {
      console.log('📤 Starting file upload...', {
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
        fileType: selectedFile.type,
      });

      // Upload file to Supabase Storage
      const fileExt = selectedFile.name.split('.').pop() || 'bin';
      const fileName = `${profile.id}/${Date.now()}.${fileExt}`;

      console.log('📤 Uploading to:', fileName);

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('patient-reports')
        .upload(fileName, selectedFile, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('❌ File upload error:', uploadError);
        toast({
          title: "Upload Failed",
          description: "Failed to upload file: " + uploadError.message,
          variant: "destructive",
        });
        setUploading(false);
        return false;
      }

      console.log('✅ File uploaded successfully:', uploadData);

      const insertData = {
        patient_id: profile.id,
        doctor_id: profile.assigned_doctor_id,
        title: `${reportName} (by Dr. ${doctorName})`,
        description: `Uploaded by patient. Consulted with: ${doctorName}`,
        report_type: reportType,
        file_url: fileName,
        file_name: selectedFile.name,
        file_size: selectedFile.size,
        mime_type: selectedFile.type,
        uploaded_by_patient: true
      };
      
      console.log('💾 Saving report to database...', insertData);

      const { error: insertError } = await supabase
        .from('patient_reports')
        .insert(insertData);

      if (insertError) {
        console.error('❌ Database insert error:', insertError);
        toast({
          title: "Save Failed",
          description: "Failed to save report: " + insertError.message,
          variant: "destructive",
        });
        setUploading(false);
        return false;
      }

      console.log('✅ Report saved successfully');

      toast({
        title: "Report Saved",
        description: "Your medical report has been saved successfully",
      });
      
      // Small delay before navigation to ensure toast is visible
      setTimeout(() => {
        navigate('/reports');
      }, 500);
      
      return true;
    } catch (error: any) {
      console.error('❌ Upload error:', error);
      toast({
        title: "Upload Failed",
        description: error.message || "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
      return false;
    } finally {
      // Ensure uploading state is always reset
      setUploading(false);
    }
  };

  const handleSave = async () => {
    // Validate required fields
    if (!reportType || !reportName || !doctorName || !selectedFile) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields and select a file",
        variant: "destructive",
      });
      return;
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
                  {selectedFile && (
                    <div className="mt-3 p-3 bg-teal-500/10 border border-teal-500/30 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-teal-300 text-sm font-medium truncate">{selectedFile.name}</p>
                          <p className="text-teal-400/70 text-xs mt-1">
                            {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • {selectedFile.type || 'Unknown type'}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedFile(null);
                            if (fileInputRef.current) {
                              fileInputRef.current.value = '';
                            }
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

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf,.doc,.docx"
              onChange={handleFileChange}
              onClick={(e) => {
                // Reset value to allow selecting the same file again
                (e.target as HTMLInputElement).value = '';
              }}
              className="hidden"
            />

            {/* Upload Buttons */}
            <div className="space-y-3 mb-8">
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
                onClick={handleTakePhoto}
                disabled={selectingFile || uploading}
                className="w-full bg-[#30363D] text-gray-200 font-semibold py-3 rounded-lg flex items-center justify-center space-x-2 hover:bg-[#3C444C] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Camera size={20} />
                <span>Take Photo</span>
              </button>
            </div>

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

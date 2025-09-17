
import React, { useState, useRef } from 'react';
import { ArrowLeft, FilePlus2, Search, Upload, Camera, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { MobileAppContainer } from '../components/MobileAppContainer';
import { useToast } from '../hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { useRealTimeVitals } from '@/hooks/useRealTimeVitals';

// Main Add Report Component
export default function AddReports() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { patientProfile } = useRealTimeVitals();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // State for form inputs
  const [reportType, setReportType] = useState('');
  const [reportName, setReportName] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleBack = () => {
    navigate('/reports');
  };

  const handleFileUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      toast({
        title: "File Selected",
        description: `${file.name} is ready to upload`,
      });
    }
  };

  const handleTakePhoto = async () => {
    try {
      // Check if the browser supports camera access
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast({
          title: "Camera Not Supported",
          description: "Camera access is not supported in this browser",
          variant: "destructive",
        });
        return;
      }

      // Request camera permission
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      
      // Stop the stream immediately (we're just checking permission)
      stream.getTracks().forEach(track => track.stop());
      
      toast({
        title: "Camera Ready",
        description: "Camera access granted. Photo capture functionality would be implemented here.",
      });
    } catch (error) {
      toast({
        title: "Camera Access Denied",
        description: "Please allow camera access to take photos",
        variant: "destructive",
      });
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

    if (!patientProfile) {
      toast({
        title: "Error",
        description: "Patient profile not found. Please try again.",
        variant: "destructive",
      });
      return;
    }

    if (!patientProfile.assigned_doctor_id) {
      toast({
        title: "No Assigned Doctor",
        description: "You don't have an assigned doctor. Please contact support.",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      // Upload file to Supabase Storage
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${patientProfile.id}/${Date.now()}.${fileExt}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('patient-reports')
        .upload(fileName, selectedFile);

      if (uploadError) {
        console.error('File upload error:', uploadError);
        toast({
          title: "Upload Failed",
          description: "Failed to upload file: " + uploadError.message,
          variant: "destructive",
        });
        return;
      }

      // Use the patient's assigned doctor instead of looking up by name
      console.log('🔍 Debug - reportType value:', reportType);
      console.log('🔍 Debug - reportType type:', typeof reportType);
      
      const insertData = {
        patient_id: patientProfile.id,
        doctor_id: patientProfile.assigned_doctor_id, // Use assigned doctor
        title: `${reportName} (by Dr. ${doctorName})`,
        description: `Uploaded by patient. Consulted with: ${doctorName}`,
        report_type: reportType,
        file_url: fileName,
        file_name: selectedFile.name,
        file_size: selectedFile.size,
        mime_type: selectedFile.type,
        uploaded_by_patient: true
      };
      
      console.log('🔍 Debug - Full insert data:', insertData);
      
      const { error: insertError } = await supabase
        .from('patient_reports')
        .insert(insertData);

      if (insertError) {
        console.error('Database insert error:', insertError);
        toast({
          title: "Save Failed",
          description: "Failed to save report: " + insertError.message,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Report Saved",
        description: "Your medical report has been saved successfully",
      });
      
      navigate('/reports');
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload Failed",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
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
            <div className="text-center mb-6">
              <div className="inline-block bg-teal-500/20 p-4 rounded-full mb-3">
                  <div className="bg-teal-500/40 p-3 rounded-full">
                      <FilePlus2 className="text-teal-300" size={28} />
                  </div>
              </div>
              <p className="text-gray-300">Upload your medical report</p>
              {selectedFile && (
                <p className="text-teal-300 text-sm mt-2">Selected: {selectedFile.name}</p>
              )}
            </div>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf,.doc,.docx"
              onChange={handleFileChange}
              className="hidden"
            />

            {/* Upload Buttons */}
            <div className="space-y-3 mb-8">
              <button 
                onClick={handleFileUpload}
                className="w-full bg-[#30363D] text-gray-200 font-semibold py-3 rounded-lg flex items-center justify-center space-x-2 hover:bg-[#3C444C] transition-colors"
              >
                <Upload size={20} />
                <span>Upload from Files</span>
              </button>
              <button 
                onClick={handleTakePhoto}
                className="w-full bg-[#30363D] text-gray-200 font-semibold py-3 rounded-lg flex items-center justify-center space-x-2 hover:bg-[#3C444C] transition-colors"
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
          </main>

          {/* Save Button Footer */}
          <footer className="p-4 flex-shrink-0">
            <button 
              onClick={handleSave}
              disabled={uploading}
              className="w-full bg-teal-500 text-white font-bold py-3 rounded-lg hover:bg-teal-600 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#1C2128] focus:ring-teal-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? (
                <div className="flex items-center justify-center">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                  Uploading...
                </div>
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

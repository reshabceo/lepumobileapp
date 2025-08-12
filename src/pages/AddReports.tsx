
import React, { useState, useRef } from 'react';
import { ArrowLeft, FilePlus2, Search, Upload, Camera, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { MobileAppContainer } from '../components/MobileAppContainer';
import { useToast } from '../hooks/use-toast';

// Main Add Report Component
export default function AddReports() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // State for form inputs
  const [reportType, setReportType] = useState('');
  const [reportName, setReportName] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

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

  const handleSave = () => {
    // Validate required fields
    if (!reportType || !reportName || !doctorName) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    // Handle save logic here
    console.log('Saving report:', { reportType, reportName, doctorName, file: selectedFile });
    
    toast({
      title: "Report Saved",
      description: "Your medical report has been saved successfully",
    });
    
    navigate('/reports');
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
                    value={reportType}
                    onChange={(e) => setReportType(e.target.value)}
                    className="w-full appearance-none bg-[#2D333B] text-white border border-gray-600 rounded-lg py-3 px-4 focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  >
                    <option value="" disabled>Select report type</option>
                    <option value="blood_test">Blood Test</option>
                    <option value="xray">X-Ray</option>
                    <option value="mri">MRI Scan</option>
                    <option value="consultation">Consultation Notes</option>
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
                  placeholder="Enter doctor name"
                  className="w-full bg-[#2D333B] text-white border border-gray-600 rounded-lg py-3 px-4 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 placeholder-gray-500"
                />
              </div>
            </form>
          </main>

          {/* Save Button Footer */}
          <footer className="p-4 flex-shrink-0">
            <button 
              onClick={handleSave}
              className="w-full bg-teal-500 text-white font-bold py-3 rounded-lg hover:bg-teal-600 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#1C2128] focus:ring-teal-500"
            >
              Save Report
            </button>
          </footer>
        </div>
      </div>
    </MobileAppContainer>
  );
}

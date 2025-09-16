import React, { useState, useEffect, useRef } from 'react';
import { FileText, Download, Calendar, User, ArrowLeft, Upload, Plus, Trash2, CheckCircle, Eye } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useRealTimeVitals } from '@/hooks/useRealTimeVitals';

interface PatientReport {
    id: string;
    title: string;
    description: string;
    report_type: string;
    file_url: string;
    file_name: string;
    file_size: number;
    created_at: string;
    doctor_name: string;
    uploaded_by_patient?: boolean;
    upload_status?: string;
    doctor_downloaded_at?: string;
    patient_notes?: string;
}

const PatientReportsView: React.FC = () => {
    const navigate = useNavigate();
    const { patientProfile } = useRealTimeVitals();
    const [reports, setReports] = useState<PatientReport[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeSection, setActiveSection] = useState<'uploaded' | 'doctor'>('uploaded');
    const [uploading, setUploading] = useState(false);
    const [previewingReport, setPreviewingReport] = useState<PatientReport | null>(null);
    const [showReportTypeModal, setShowReportTypeModal] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [customReportType, setCustomReportType] = useState('');
    const [showCustomInput, setShowCustomInput] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const reportTypes = [
        { id: 'mri', label: 'MRI' },
        { id: 'prescription', label: 'Prescription' },
        { id: 'lab_report', label: 'Lab Report' },
        { id: 'bp_report', label: 'BP Report' },
        { id: 'others', label: 'Others' }
    ];

    useEffect(() => {
        if (patientProfile) {
            fetchReports();
        }
    }, [patientProfile]);

    const fetchReports = async () => {
        if (!patientProfile) {
            console.log('No patient profile available');
            return;
        }

        try {
            setLoading(true);
            console.log('Patient profile ID:', patientProfile.id);
            
            // First, let's try to get ALL records from patient_uploads table
            console.log('Fetching ALL reports from patient_uploads table...');
            const { data: allUploads, error: allError } = await supabase
                .from('patient_uploads')
                .select('*')
                .order('created_at', { ascending: false });
            
            console.log('ALL uploads query result:', { allUploads, allError });
            console.log('Number of records found:', allUploads?.length || 0);

            if (allError) {
                console.error('Error fetching uploads:', allError);
                alert('Error fetching reports: ' + allError.message);
                return;
            }

            console.log('Fetched all uploads:', allUploads);
            console.log('Number of uploads found:', allUploads?.length || 0);

            // Process reports based on upload_source field
            const allReports = (allUploads || []).map(upload => {
                console.log('Processing report:', upload.title, 'upload_source:', upload.upload_source);
                return {
                    ...upload,
                    doctor_name: upload.upload_source === 'patient' ? 'You' : 'Dr. Doctor',
                    doctor_avatar: null,
                    // Ensure we have all required fields
                    report_type: upload.report_type || 'medical_report',
                    file_size: upload.file_size || 0
                };
            });

            console.log('Processed reports:', allReports);
            console.log('Setting reports state with:', allReports.length, 'reports');
            setReports(allReports);
        } catch (err) {
            console.error('Error in fetchReports:', err);
            alert('Error fetching reports: ' + err);
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        
        if (!file || !patientProfile) {
            alert('No file selected or patient profile missing');
            return;
        }

        // Store the selected file and show the report type modal
        setSelectedFile(file);
        setShowReportTypeModal(true);
        
        // Clear the file input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleReportTypeSelection = async (reportType: string) => {
        if (!selectedFile || !patientProfile) {
            alert('No file selected or patient profile missing');
            return;
        }

        // If "Others" is selected, show custom input
        if (reportType === 'others') {
            setShowCustomInput(true);
            return;
        }

        await uploadFile(reportType);
    };

    const handleCustomReportTypeSubmit = async () => {
        console.log('Custom report type submitted:', customReportType);
        
        if (!customReportType.trim()) {
            alert('Please specify the report type');
            return;
        }

        const processedType = `custom_${customReportType.trim().toLowerCase().replace(/\s+/g, '_')}`;
        console.log('Processed custom type:', processedType);
        
        await uploadFile(processedType);
    };

    const uploadFile = async (reportType: string) => {
        if (!selectedFile || !patientProfile) {
            alert('No file selected or patient profile missing');
            return;
        }

        console.log('=== UPLOAD DEBUG START ===');
        console.log('File selected:', selectedFile);
        console.log('Report type selected:', reportType);
        console.log('Patient profile:', patientProfile);

        try {
            setUploading(true);
            setShowReportTypeModal(false);
            setShowCustomInput(false);
            setCustomReportType('');
            console.log('Starting upload process...');
            
            // Upload file to Supabase Storage
            const fileExt = selectedFile.name.split('.').pop();
            const fileName = `${Date.now()}.${fileExt}`;
            const filePath = `patient-uploads/${patientProfile.id}/${fileName}`;
            
            console.log('Upload details:', {
                fileExt,
                fileName,
                filePath,
                bucket: 'patient-reports'
            });

            console.log('Uploading to Supabase Storage...');
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('patient-reports')
                .upload(filePath, selectedFile);

            console.log('Storage upload result:', { uploadData, uploadError });

            if (uploadError) {
                console.error('Upload error:', uploadError);
                alert('Failed to upload file: ' + uploadError.message);
                return;
            }

            console.log('File uploaded successfully to storage');

            // Create upload record in patient_uploads table
            const reportData = {
                patient_id: patientProfile.id,
                title: selectedFile.name.split('.')[0],
                description: 'Uploaded by patient',
                file_url: filePath,
                file_name: selectedFile.name,
                file_size: selectedFile.size,
                mime_type: selectedFile.type,
                upload_source: 'patient',
                report_type: reportType
            };
            
            console.log('Inserting report record:', reportData);
            const { data, error } = await supabase
                .from('patient_uploads')
                .insert(reportData);

            console.log('Report insert result:', { data, error });

            if (error) {
                console.error('Error creating report:', error);
                alert('Failed to create report record: ' + error.message);
                return;
            }

            console.log('Report record created successfully');

            // Refresh reports
            console.log('Refreshing reports...');
            await fetchReports();
            alert('Report uploaded successfully!');
            console.log('=== UPLOAD DEBUG END - SUCCESS ===');
            
        } catch (err) {
            console.error('Upload error:', err);
            alert('Failed to upload report: ' + err);
            console.log('=== UPLOAD DEBUG END - ERROR ===');
        } finally {
            setUploading(false);
            setSelectedFile(null);
        }
    };

    const deleteUploadedReport = async (reportId: string) => {
        if (!confirm('Are you sure you want to delete this report?')) return;

        try {
            const { error } = await supabase
                .from('patient_uploads')
                .delete()
                .eq('id', reportId);

            if (error) {
                console.error('Error deleting report:', error);
                alert('Failed to delete report: ' + error.message);
                return;
            }

            await fetchReports();
            alert('Report deleted successfully!');
        } catch (err) {
            console.error('Delete error:', err);
            alert('Failed to delete report');
        }
    };

    const previewReport = async (report: PatientReport) => {
        try {
            console.log('Previewing report:', report.title);
            console.log('Original file_url:', report.file_url);
            
            // Determine the bucket based on upload source
            const bucket = 'patient-reports';
            
            // Try multiple path variations to find the correct file
            const pathsToTry = [
                report.file_url, // Original path
                report.file_name, // Just the filename
                `patient-uploads/${patientProfile?.id}/${report.file_name}`, // Patient uploads path
                `patient-uploads/${report.file_name}`, // Patient uploads without ID
                report.file_url.replace('patient-reports/', ''), // Remove bucket prefix
                report.file_url.replace('doctor-reports/', ''), // Remove doctor bucket prefix
                report.file_url.replace('patient-uploads/', ''), // Remove patient uploads prefix
            ];

            console.log('Trying paths:', pathsToTry);

            let signedUrl = null;
            let lastError = null;

            // Try each path until one works
            for (const path of pathsToTry) {
                if (!path) continue;
                
                console.log(`Trying path: ${path}`);
                
                try {
                    const { data: urlData, error: urlError } = await supabase.storage
                        .from(bucket)
                        .createSignedUrl(path, 300); // 5 minutes expiry

                    if (!urlError && urlData && urlData.signedUrl) {
                        console.log(`Success with path: ${path}`);
                        signedUrl = urlData.signedUrl;
                        break;
                    } else {
                        console.log(`Failed with path ${path}:`, urlError?.message);
                        lastError = urlError;
                    }
                } catch (pathError) {
                    console.log(`Error with path ${path}:`, pathError.message);
                    lastError = pathError;
                }
            }

            if (!signedUrl) {
                throw new Error(`File not found. Tried ${pathsToTry.length} different paths. Last error: ${lastError?.message || 'Unknown error'}`);
            }

            console.log('Signed URL created successfully:', signedUrl);

            // Set the report for preview with the signed URL
            setPreviewingReport({
                ...report,
                file_url: signedUrl
            });
            
        } catch (error) {
            console.error('Error previewing report:', error);
            alert(`Failed to preview report: ${error.message}. Please try again.`);
        }
    };

    const downloadReport = async (report: PatientReport) => {
        try {
            console.log('=== DOWNLOAD DEBUG START ===');
            console.log('Downloading report:', report);
            console.log('File URL:', report.file_url);
            console.log('File name:', report.file_name);
            console.log('Report type:', report.report_type);
            console.log('Upload source:', report.upload_source);
            
            if (!report.file_url) {
                alert('No file URL found for this report');
                return;
            }
            
            // Try multiple approaches to find the file
            let filePath = report.file_url;
            let data = null;
            let error = null;
            
            console.log('Original file URL:', filePath);
            console.log('Upload source:', report.upload_source);
            
            // List of buckets to try - only patient-reports exists
            const bucketsToTry = ['patient-reports'];
            
            // List of file paths to try - handle all the different URL formats
            const pathsToTry = [
                filePath, // original path
                filePath.replace('doctor-reports/', ''), // remove doctor-reports prefix
                filePath.replace('patient-uploads/', ''), // remove patient-uploads prefix
                filePath.replace('patient-reports/', ''), // remove patient-reports prefix
                // Handle patient-uploads with UUID folder structure
                filePath.replace('patient-uploads/e97f8ddd-6129-4a17-9ee7-e8cdf75d0c45/', ''),
                // Try with different folder structures
                `e97f8ddd-6129-4a17-9ee7-e8cdf75d0c45/${filePath}`,
                `patient-uploads/${filePath}`,
                `patient-uploads/e97f8ddd-6129-4a17-9ee7-e8cdf75d0c45/${filePath}`,
            ];
            
            console.log('Trying buckets:', bucketsToTry);
            console.log('Trying paths:', pathsToTry);
            
            // First, let's see what files actually exist in each bucket
            for (const bucket of bucketsToTry) {
                try {
                    const { data: listData, error: listError } = await supabase.storage
                        .from(bucket)
                        .list('', { limit: 20 });
                    
                    if (!listError && listData) {
                        console.log(`📁 Files in ${bucket} bucket:`, listData.map(f => f.name));
                        
                        // Check inside folders too
                        for (const item of listData) {
                            if (item.name === 'patient-uploads' || item.name.includes('-')) {
                                console.log(`📁 Checking inside folder: ${item.name}`);
                                const { data: folderData, error: folderError } = await supabase.storage
                                    .from(bucket)
                                    .list(item.name, { limit: 20 });
                                
                                if (!folderError && folderData) {
                                    console.log(`📁 Files in ${bucket}/${item.name}:`, folderData.map(f => f.name));
                                }
                            }
                        }
                    } else {
                        console.log(`❌ Could not list files in ${bucket}:`, listError?.message);
                    }
                } catch (err) {
                    console.log(`❌ Exception listing ${bucket}:`, err.message);
                }
            }
            
            // First, let's try to get the file directly to see if it exists
            console.log('🔍 Testing direct file access...');
            try {
                const { data: directData, error: directError } = await supabase.storage
                    .from('patient-reports')
                    .download('Heidi-Medical-Report-Template-PDF.pdf');
                
                if (!directError && directData) {
                    console.log('✅ File exists and can be downloaded directly!');
                } else {
                    console.log('❌ Direct download failed:', directError?.message);
                }
            } catch (err) {
                console.log('❌ Direct download exception:', err.message);
            }

            // Try each combination
            for (const bucket of bucketsToTry) {
                console.log(`Trying bucket: ${bucket}`);
                
                for (const path of pathsToTry) {
                    if (!path) continue; // skip empty paths
                    
                    console.log(`  Trying path: ${path}`);
                    
                    try {
                        const { data: urlData, error: urlError } = await supabase.storage
                            .from(bucket)
                            .createSignedUrl(path, 300);
                        
                        if (!urlError && urlData && urlData.signedUrl) {
                            console.log(`✅ SUCCESS! Found file in bucket: ${bucket}, path: ${path}`);
                            console.log(`✅ Signed URL: ${urlData.signedUrl}`);
                            data = urlData;
                            error = null;
                            break;
                        } else {
                            console.log(`❌ Failed: ${urlError?.message || 'No data returned'}`);
                        }
                    } catch (err) {
                        console.log(`❌ Exception: ${err.message}`);
                    }
                }
                
                if (data && !error) break; // Found the file, stop trying
            }
            
            if (!data || error) {
                console.error('All attempts failed. File not found in any bucket.');
                alert('File not found in storage. The file may have been moved or deleted.');
                return;
            }

            console.log('Signed URL created successfully:', data.signedUrl);

            // Use native iOS share sheet
            console.log('Opening native share sheet...');
            
            try {
                // Import Share plugin dynamically
                const { Share } = await import('@capacitor/share');
                
                await Share.share({
                    title: report.title || 'Medical Report',
                    text: `Download ${report.file_name || 'report.pdf'}`,
                    url: data.signedUrl,
                    dialogTitle: 'Save Medical Report'
                });
                
                console.log('Native share sheet opened successfully');
            } catch (shareError) {
                console.error('Share failed:', shareError);
                // Fallback: open in new tab
                window.open(data.signedUrl, '_blank');
                console.log('Opened in new tab as fallback');
            }
            console.log('=== DOWNLOAD DEBUG END ===');
        } catch (err) {
            console.error('Download error:', err);
            alert('Failed to download report: ' + err);
        }
    };

    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const getReportTypeLabel = (type: string) => {
        const types = {
            mri: 'MRI',
            prescription: 'Prescription',
            lab_report: 'Lab Report',
            bp_report: 'BP Report',
            others: 'Others',
            medical_report: 'Medical Report',
            test_results: 'Test Results',
            consultation_notes: 'Consultation Notes',
            discharge_summary: 'Discharge Summary'
        };
        
        // Handle custom types (prefixed with 'custom_')
        if (type.startsWith('custom_')) {
            return type.replace('custom_', '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        }
        
        return types[type as keyof typeof types] || type;
    };

    const getReportTypeColor = (type: string) => {
        const colors = {
            mri: 'bg-indigo-500/20 border-indigo-500/30 text-indigo-300',
            prescription: 'bg-purple-500/20 border-purple-500/30 text-purple-300',
            lab_report: 'bg-green-500/20 border-green-500/30 text-green-300',
            bp_report: 'bg-orange-500/20 border-orange-500/30 text-orange-300',
            others: 'bg-gray-500/20 border-gray-500/30 text-gray-300',
            medical_report: 'bg-blue-500/20 border-blue-500/30 text-blue-300',
            test_results: 'bg-green-500/20 border-green-500/30 text-green-300',
            consultation_notes: 'bg-yellow-500/20 border-yellow-500/30 text-yellow-300',
            discharge_summary: 'bg-red-500/20 border-red-500/30 text-red-300'
        };
        
        // Handle custom types (prefixed with 'custom_')
        if (type.startsWith('custom_')) {
            return 'bg-cyan-500/20 border-cyan-500/30 text-cyan-300';
        }
        
        return colors[type as keyof typeof colors] || 'bg-gray-500/20 border-gray-500/30 text-gray-300';
    };

    if (!patientProfile) {
        return (
            <div className="bg-gradient-to-br from-gray-900 via-black to-gray-900 min-h-screen text-white flex items-center justify-center">
                <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-8 text-center">
                    <p className="text-gray-300">Loading patient profile...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-gradient-to-br from-gray-900 via-black to-gray-900 min-h-screen text-white p-4">
            <div className="max-w-sm mx-auto">
                {/* Status Bar Spacing (match scanner) */}
                <div className="h-12"></div>

                {/* Header (match scanner style) */}
                <div className="flex items-center gap-4 mb-6">
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 p-2 rounded-xl transition-all duration-200"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                    <div className="flex items-center">
                        <FileText className="h-5 w-5 text-blue-400 mr-3" />
                        <div>
                            <h1 className="text-2xl font-bold text-white">My Reports</h1>
                            <p className="text-sm text-gray-300">Upload and view medical reports</p>
                        </div>
                    </div>
                </div>

                {/* Upload Button */}
                <div className="mb-6">
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-blue-800 disabled:to-purple-800 text-white px-4 py-3 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 backdrop-blur-sm border border-white/20 shadow-lg"
                    >
                        {uploading ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                <span>Uploading...</span>
                            </>
                        ) : (
                            <>
                                <Upload className="h-4 w-4" />
                                <span>Upload New Report or Prescription</span>
                            </>
                        )}
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*,application/pdf,.pdf,.jpg,.jpeg,.png,.doc,.docx"
                        onChange={handleFileUpload}
                        className="hidden"
                        multiple={false}
                    />
                </div>

                {/* Section Toggle */}
                <div className="flex bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-1 mb-6">
                    <button
                        onClick={() => setActiveSection('uploaded')}
                        className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all duration-200 ${
                            activeSection === 'uploaded'
                                ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                                : 'text-gray-300 hover:text-white hover:bg-white/10'
                        }`}
                    >
                        <div className="flex items-center justify-center gap-2">
                            <Upload className="h-4 w-4" />
                            <span>Uploaded by You</span>
                        </div>
                    </button>
                    <button
                        onClick={() => setActiveSection('doctor')}
                        className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all duration-200 ${
                            activeSection === 'doctor'
                                ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                                : 'text-gray-300 hover:text-white hover:bg-white/10'
                        }`}
                    >
                        <div className="flex items-center justify-center gap-2">
                            <Download className="h-4 w-4" />
                            <span>From Your Doctor</span>
                        </div>
                    </button>
                </div>


                {/* Loading State */}
                {loading && (
                    <div className="text-center py-8">
                        <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto"></div>
                            <p className="text-gray-300 mt-2">Loading reports...</p>
                        </div>
                    </div>
                )}

                {/* Filter reports by section */}
                {(() => {
                    const filteredReports = reports.filter(report => {
                        if (activeSection === 'uploaded') {
                            return report.upload_source === 'patient';
                        } else {
                            return report.upload_source === 'doctor';
                        }
                    });

                    return (
                        <>
                {/* No Reports */}
                {!loading && filteredReports.length === 0 && (
                    <div className="text-center py-12">
                        <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-8">
                            <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                            <h3 className="text-lg font-semibold text-white mb-2">
                                {activeSection === 'uploaded' ? 'No Uploaded Reports' : 'No Doctor Reports'}
                            </h3>
                            <p className="text-gray-300">
                                {activeSection === 'uploaded' 
                                    ? 'You haven\'t uploaded any reports yet.' 
                                    : 'Your doctor hasn\'t uploaded any reports yet.'
                                }
                            </p>
                        </div>
                    </div>
                )}

                {/* Reports List */}
                {!loading && filteredReports.length > 0 && (
                    <div className="space-y-4">
                        {filteredReports.map((report) => (
                            <div
                                key={report.id}
                                className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 hover:bg-white/15 hover:border-white/30 transition-all duration-200 shadow-lg"
                            >
                                            <div className="flex items-start justify-between mb-3">
                                                <div className="flex-1">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <FileText className="h-5 w-5 text-blue-400" />
                                                            <h3 className="font-semibold text-white">{report.title}</h3>
                                                            {report.upload_source === 'patient' && (
                                                                <span className="text-xs bg-green-500/20 backdrop-blur-sm border border-green-500/30 text-green-300 px-2 py-1 rounded-full">
                                                                    Uploaded
                                                                </span>
                                                            )}
                                                        </div>

                                                        <div className="flex items-center gap-2 mb-2">
                                                            <span className={`inline-block px-2 py-1 text-xs rounded-full backdrop-blur-sm border ${getReportTypeColor(report.report_type)}`}>
                                                                {getReportTypeLabel(report.report_type)}
                                                            </span>
                                                            {report.upload_status && (
                                                                <span className={`text-xs px-2 py-1 rounded-full backdrop-blur-sm border ${
                                                                    report.upload_status === 'downloaded' 
                                                                        ? 'bg-green-500/20 border-green-500/30 text-green-300' 
                                                                        : report.upload_status === 'processing'
                                                                        ? 'bg-yellow-500/20 border-yellow-500/30 text-yellow-300'
                                                                        : 'bg-blue-500/20 border-blue-500/30 text-blue-300'
                                                                }`}>
                                                                    {report.upload_status}
                                                                </span>
                                                            )}
                                                        </div>
                                                </div>
                                            </div>

                                            {report.description && (
                                                <p className="text-gray-400 text-sm mb-3">{report.description}</p>
                                            )}

                                            {report.patient_notes && (
                                                <p className="text-blue-300 text-sm mb-3 italic">"{report.patient_notes}"</p>
                                            )}

                                            <div className="flex items-center justify-between">
                                                <div className="space-y-1">
                                                    <div className="flex items-center text-xs text-gray-500">
                                                        <User className="h-3 w-3 mr-1" />
                                                        <span>
                                                            {report.upload_source === 'patient' ? 'You' : `Dr. ${report.doctor_name}`}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center text-xs text-gray-500">
                                                        <Calendar className="h-3 w-3 mr-1" />
                                                        <span>{new Date(report.created_at).toLocaleDateString()}</span>
                                                    </div>
                                                    <div className="text-xs text-gray-500">
                                                        {formatFileSize(report.file_size)}
                                                    </div>
                                                    {report.doctor_downloaded_at && (
                                                        <div className="flex items-center text-xs text-green-400">
                                                            <CheckCircle className="h-3 w-3 mr-1" />
                                                            <span>Downloaded by doctor</span>
                                                        </div>
                                                    )}
                                                </div>

                                                    <div className="flex items-center gap-2">
                                                        {report.upload_source === 'patient' ? (
                                                            <>
                                                                <button
                                                                    onClick={() => previewReport(report)}
                                                                    className="flex items-center gap-1 bg-blue-500/20 backdrop-blur-sm border border-blue-500/30 hover:bg-blue-500/30 text-blue-300 px-3 py-2 rounded-lg transition-all duration-200 text-sm"
                                                                >
                                                                    <Eye className="h-3 w-3" />
                                                                    <span>Preview</span>
                                                                </button>
                                                                <button
                                                                    onClick={() => deleteUploadedReport(report.id)}
                                                                    className="flex items-center gap-1 bg-red-500/20 backdrop-blur-sm border border-red-500/30 hover:bg-red-500/30 text-red-300 px-3 py-2 rounded-lg transition-all duration-200 text-sm"
                                                                >
                                                                    <Trash2 className="h-3 w-3" />
                                                                    <span>Delete</span>
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <button
                                                                onClick={() => downloadReport(report)}
                                                                className="flex items-center gap-2 bg-blue-500/20 backdrop-blur-sm border border-blue-500/30 hover:bg-blue-500/30 text-blue-300 px-4 py-2 rounded-lg transition-all duration-200"
                                                            >
                                                                <Download className="h-4 w-4" />
                                                                <span className="text-sm">Download</span>
                                                            </button>
                                                        )}
                                                    </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    );
                })()}
            </div>

            {/* Report Type Selection Modal */}
            {showReportTypeModal && !showCustomInput && (
                <div className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center p-4">
                    <div className="bg-gradient-to-br from-gray-900 via-black to-gray-900 backdrop-blur-md border border-white/20 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
                        <div className="text-center mb-6">
                            <h3 className="text-xl font-bold text-white mb-2">Select Report Type</h3>
                            <p className="text-gray-300 text-sm">Choose the type of report you're uploading</p>
                            {selectedFile && (
                                <p className="text-blue-300 text-xs mt-2">File: {selectedFile.name}</p>
                            )}
                        </div>

                        <div className="space-y-3">
                            {reportTypes.map((type) => (
                                <button
                                    key={type.id}
                                    onClick={() => handleReportTypeSelection(type.id)}
                                    className="w-full bg-gradient-to-r from-blue-600/20 to-purple-600/20 backdrop-blur-sm border border-white/20 hover:from-blue-600/30 hover:to-purple-600/30 text-white px-4 py-3 rounded-xl transition-all duration-200 flex items-center justify-center shadow-lg"
                                >
                                    <span className="font-medium">{type.label}</span>
                                </button>
                            ))}
                        </div>

                        <button
                            onClick={() => {
                                setShowReportTypeModal(false);
                                setSelectedFile(null);
                            }}
                            className="w-full mt-4 bg-gray-500/20 backdrop-blur-sm border border-gray-500/30 hover:bg-gray-500/30 text-gray-300 px-4 py-3 rounded-xl transition-all duration-200"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Custom Report Type Input Modal */}
            {showCustomInput && (
                <div className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center p-4">
                    <div className="bg-gradient-to-br from-gray-900 via-black to-gray-900 backdrop-blur-md border border-white/20 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
                        <div className="text-center mb-6">
                            <h3 className="text-xl font-bold text-white mb-2">Specify Report Type</h3>
                            <p className="text-gray-300 text-sm">What type of report is this?</p>
                            {selectedFile && (
                                <p className="text-blue-300 text-xs mt-2">File: {selectedFile.name}</p>
                            )}
                        </div>

                        <div className="space-y-4">
                            <input
                                type="text"
                                value={customReportType}
                                onChange={(e) => setCustomReportType(e.target.value)}
                                placeholder="e.g., X-Ray, Ultrasound, CT Scan..."
                                className="w-full bg-white/10 backdrop-blur-sm border border-white/20 text-white px-4 py-3 rounded-xl placeholder-gray-400 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20"
                                autoFocus
                            />
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => {
                                    setShowCustomInput(false);
                                    setCustomReportType('');
                                }}
                                className="flex-1 bg-gray-500/20 backdrop-blur-sm border border-gray-500/30 hover:bg-gray-500/30 text-gray-300 px-4 py-3 rounded-xl transition-all duration-200"
                            >
                                Back
                            </button>
                            <button
                                onClick={handleCustomReportTypeSubmit}
                                className="flex-1 bg-gradient-to-r from-blue-600/20 to-purple-600/20 backdrop-blur-sm border border-blue-500/30 hover:from-blue-600/30 hover:to-purple-600/30 text-blue-300 px-4 py-3 rounded-xl transition-all duration-200 shadow-lg"
                            >
                                Upload
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Preview Modal */}
            {previewingReport && (
                <div className="fixed inset-0 z-50 bg-black bg-opacity-90 flex flex-col">
                    {/* Status bar spacer */}
                    <div className="h-12 flex-shrink-0"></div>
                    
                    {/* Header */}
                    <div className="h-12 flex-shrink-0 bg-gray-900/80 backdrop-blur-sm border-b border-gray-700 flex items-center justify-between px-4">
                        <button
                            onClick={() => setPreviewingReport(null)}
                            className="flex items-center gap-2 text-white hover:text-gray-300 transition-colors"
                        >
                            <ArrowLeft className="h-5 w-5" />
                            <span className="text-sm font-medium">Back</span>
                        </button>
                        <h3 className="text-white text-sm font-medium truncate max-w-48">
                            {previewingReport.title}
                        </h3>
                        <div className="w-16"></div> {/* Spacer for centering */}
                    </div>

                    {/* Preview Content */}
                    <div className="flex-1 overflow-hidden bg-gray-900">
                        {previewingReport.file_name?.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/) ? (
                            // Image preview
                            <div className="h-full flex items-center justify-center p-4">
                                <img
                                    src={previewingReport.file_url}
                                    alt={previewingReport.title}
                                    className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                                    onError={(e) => {
                                        console.error('Image load error:', e);
                                        e.currentTarget.style.display = 'none';
                                    }}
                                />
                            </div>
                        ) : previewingReport.file_name?.toLowerCase().match(/\.(pdf)$/) ? (
                            // PDF preview
                            <div className="h-full">
                                <iframe
                                    src={previewingReport.file_url}
                                    className="w-full h-full border-0"
                                    title={previewingReport.title}
                                    onError={(e) => {
                                        console.error('PDF load error:', e);
                                    }}
                                />
                            </div>
                        ) : (
                            // Generic file preview
                            <div className="h-full flex items-center justify-center p-4">
                                <div className="text-center text-white">
                                    <FileText className="h-16 w-16 mx-auto mb-4 text-gray-400" />
                                    <h3 className="text-lg font-medium mb-2">{previewingReport.title}</h3>
                                    <p className="text-gray-400 mb-4">Preview not available for this file type</p>
                                    <button
                                        onClick={() => window.open(previewingReport.file_url, '_blank')}
                                        className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors"
                                    >
                                        Open in Browser
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default PatientReportsView;

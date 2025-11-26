import React, { useState, useEffect, useRef } from 'react';
import { FileText, Download, Calendar, User, ArrowLeft, Upload, Stethoscope, Plus, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase, db } from '@/lib/supabase';
import { useRealTimeVitals } from '@/hooks/useRealTimeVitals';
import { useAuth } from '@/contexts/AuthContext';

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
    uploaded_by_patient: boolean;
}

const PatientReportsView: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { patientProfile: hookProfile, loading: hookLoading } = useRealTimeVitals();
    const [patientProfile, setPatientProfile] = useState<any>(null);
    const [reports, setReports] = useState<PatientReport[]>([]);
    const [loading, setLoading] = useState(true);
    const [profileLoading, setProfileLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'from-doctor' | 'my-uploads'>('from-doctor');
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    // 🚀 OPTIMIZED: Fetch profile with instant cache + direct fetch
    useEffect(() => {
        // Check cache first for instant load
        if (user) {
            const cacheKey = `patient_profile_${user.id}`;
            const cachedProfile = localStorage.getItem(cacheKey);
            if (cachedProfile) {
                try {
                    const parsed = JSON.parse(cachedProfile);
                    const cacheTime = parsed._cached_at || 0;
                    if (Date.now() - cacheTime < 5 * 60 * 1000) {
                        console.log('✅ Using cached profile (instant)');
                        setPatientProfile(parsed);
                        setProfileLoading(false);
                    }
                } catch (e) {
                    // Ignore cache parse errors
                }
            }
        }

        // Use hook profile if available
        if (hookProfile) {
            setPatientProfile(hookProfile);
            setProfileLoading(false);
            return;
        }

        // Fetch directly if hook doesn't have it yet
        if (user && !hookProfile) {
            const fetchProfile = async () => {
                try {
                    setProfileLoading(true);
                    const profileData = await db.getPatientProfile(user.id);
                    if (profileData.data) {
                        setPatientProfile(profileData.data);
                    }
                } catch (err) {
                    console.error('❌ Failed to fetch profile:', err);
                } finally {
                    setProfileLoading(false);
                }
            };
            fetchProfile();
        }

        // Fast timeout - 3 seconds max
        timeoutRef.current = setTimeout(() => {
            setProfileLoading(false);
        }, 3000);

        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [hookProfile, user]);

    useEffect(() => {
        if (patientProfile) {
            fetchReports();
        }
    }, [patientProfile]);

    const fetchReports = async () => {
        if (!patientProfile) return;

        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('patient_reports')
                .select(`
          *,
          doctors(full_name)
        `)
                .eq('patient_id', patientProfile.id)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error fetching reports:', error);
            } else {
                const formattedReports = data?.map(report => ({
                    ...report,
                    doctor_name: report.doctors?.full_name || 'Unknown Doctor'
                })) || [];
                setReports(formattedReports);
            }
        } catch (err) {
            console.error('Error:', err);
        } finally {
            setLoading(false);
        }
    };

    // Filter reports based on active tab
    const filteredReports = reports.filter(report => {
        if (activeTab === 'from-doctor') {
            return !report.uploaded_by_patient; // Reports uploaded by doctor
        } else {
            return report.uploaded_by_patient; // Reports uploaded by patient
        }
    });

    const downloadReport = async (report: PatientReport) => {
        try {
            // Generate signed URL for secure download from private bucket
            const { data, error } = await supabase.storage
                .from('patient-reports')
                .createSignedUrl(report.file_url, 60); // 60 seconds expiry

            if (error) {
                console.error('Error creating signed URL:', error);
                alert('Failed to generate download link: ' + error.message);
                return;
            }

            // Create a temporary download link with signed URL
            const link = document.createElement('a');
            link.href = data.signedUrl;
            link.download = report.file_name;
            link.target = '_blank';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (err) {
            console.error('Download error:', err);
            alert('Failed to download report');
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
            medical_report: 'Medical Report',
            test_results: 'Test Results',
            prescription: 'Prescription',
            consultation_notes: 'Consultation Notes',
            discharge_summary: 'Discharge Summary'
        };
        return types[type as keyof typeof types] || type;
    };

    const getReportTypeColor = (type: string) => {
        const colors = {
            medical_report: 'bg-blue-100 text-blue-800',
            test_results: 'bg-green-100 text-green-800',
            prescription: 'bg-purple-100 text-purple-800',
            consultation_notes: 'bg-yellow-100 text-yellow-800',
            discharge_summary: 'bg-red-100 text-red-800'
        };
        return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800';
    };

    // Show loading state
    if (profileLoading || hookLoading) {
        return (
            <div className="bg-[#101010] min-h-screen text-white flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                    <p className="text-gray-400">Loading patient profile...</p>
                </div>
            </div>
        );
    }

    // Show error state if no profile after loading
    if (!patientProfile) {
        return (
            <div className="bg-[#101010] min-h-screen text-white flex items-center justify-center p-4">
                <div className="max-w-sm mx-auto text-center">
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-6">
                        <FileText className="h-12 w-12 text-red-500 mx-auto mb-4" />
                        <h2 className="text-xl font-bold text-red-400 mb-2">
                            Profile Not Found
                        </h2>
                        <p className="text-gray-300 mb-4">
                            Unable to load your patient profile. Please try again.
                        </p>
                        <button
                            onClick={() => window.location.reload()}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
                        >
                            Refresh Page
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-[#101010] min-h-screen text-white p-4">
            <div className="max-w-sm mx-auto">
                {/* Status Bar Spacing (match scanner) */}
                <div className="h-6"></div>

                {/* Header (match scanner style) */}
                <div className="flex items-center gap-4 mb-6">
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="bg-gray-700/80 hover:bg-gray-600 p-2 rounded-lg transition-all duration-200"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                    <div className="flex items-center flex-1">
                        <FileText className="h-5 w-5 text-blue-500 mr-3" />
                        <div className="flex-1">
                            <h1 className="text-2xl font-bold text-white">My Reports</h1>
                            <p className="text-sm text-gray-400">Medical reports and uploads</p>
                        </div>
                    </div>
                    {/* Upload Button - Always visible when on "My Uploads" tab */}
                    {activeTab === 'my-uploads' && (
                        <button
                            onClick={() => navigate('/add-reports')}
                            className="bg-blue-600 hover:bg-blue-700 text-white p-2.5 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl"
                            title="Upload New Report"
                        >
                            <Plus className="h-5 w-5" />
                        </button>
                    )}
                </div>

                {/* Tabs */}
                <div className="flex bg-gray-800/50 rounded-lg p-1 mb-6">
                    <button
                        onClick={() => setActiveTab('from-doctor')}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-md transition-all duration-200 ${
                            activeTab === 'from-doctor'
                                ? 'bg-blue-600 text-white shadow-lg'
                                : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                        }`}
                    >
                        <Stethoscope className="h-4 w-4" />
                        <span className="font-medium">From Doctor</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('my-uploads')}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-md transition-all duration-200 ${
                            activeTab === 'my-uploads'
                                ? 'bg-blue-600 text-white shadow-lg'
                                : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                        }`}
                    >
                        <Upload className="h-4 w-4" />
                        <span className="font-medium">My Uploads</span>
                    </button>
                </div>

                {/* Loading State */}
                {loading && (
                    <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                        <p className="text-gray-400 mt-2">Loading reports...</p>
                    </div>
                )}

                {/* No Reports */}
                {!loading && filteredReports.length === 0 && (
                    <div className="text-center py-12">
                        <FileText className="h-16 w-16 text-gray-600 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-gray-300 mb-2">
                            {activeTab === 'from-doctor' ? 'No Reports from Doctor' : 'No Uploads Yet'}
                        </h3>
                        <p className="text-gray-500">
                            {activeTab === 'from-doctor' 
                                ? 'Your doctor hasn\'t uploaded any reports yet.' 
                                : 'You haven\'t uploaded any reports yet.'
                            }
                        </p>
                        {activeTab === 'my-uploads' && (
                            <button
                                onClick={() => navigate('/add-reports')}
                                className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                Upload Report
                            </button>
                        )}
                    </div>
                )}

                {/* Reports List */}
                {!loading && filteredReports.length > 0 && (
                    <div className="space-y-4 mb-20">
                        {filteredReports.map((report) => (
                            <div
                                key={report.id}
                                className="bg-[#1A1A1A] border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-all"
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            {report.uploaded_by_patient ? (
                                                <Upload className="h-5 w-5 text-green-500" />
                                            ) : (
                                                <Stethoscope className="h-5 w-5 text-blue-500" />
                                            )}
                                            <h3 className="font-semibold text-white">{report.title}</h3>
                                            {report.uploaded_by_patient && (
                                                <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-full">
                                                    My Upload
                                                </span>
                                            )}
                                        </div>

                                        <span className={`inline-block px-2 py-1 text-xs rounded-full ${getReportTypeColor(report.report_type)}`}>
                                            {getReportTypeLabel(report.report_type)}
                                        </span>
                                    </div>
                                </div>

                                {report.description && (
                                    <p className="text-gray-400 text-sm mb-3">{report.description}</p>
                                )}

                                <div className="flex items-center justify-between">
                                    <div className="space-y-1">
                                        <div className="flex items-center text-xs text-gray-500">
                                            <User className="h-3 w-3 mr-1" />
                                            <span>Dr. {report.doctor_name}</span>
                                        </div>
                                        <div className="flex items-center text-xs text-gray-500">
                                            <Calendar className="h-3 w-3 mr-1" />
                                            <span>{new Date(report.created_at).toLocaleDateString()}</span>
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            {formatFileSize(report.file_size)}
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => downloadReport(report)}
                                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                                    >
                                        <Download className="h-4 w-4" />
                                        <span className="text-sm">Download</span>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Floating Action Button - Always visible when on "My Uploads" tab */}
                {activeTab === 'my-uploads' && (
                    <button
                        onClick={() => navigate('/add-reports')}
                        className="fixed bottom-6 right-1/2 transform translate-x-1/2 max-w-sm w-[calc(100%-2rem)] bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-6 py-4 rounded-full shadow-2xl hover:shadow-blue-500/50 transition-all duration-300 hover:scale-105 flex items-center justify-center gap-2 font-semibold z-50"
                    >
                        <Plus className="h-5 w-5" />
                        <span>Upload New Report</span>
                    </button>
                )}
            </div>
        </div>
    );
};

export default PatientReportsView;

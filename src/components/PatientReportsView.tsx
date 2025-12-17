import React, { useState, useEffect, useRef } from 'react';
import { FileText, Download, Calendar, User, ArrowLeft, Upload, Stethoscope, Plus, Loader2, FileDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase, db } from '@/lib/supabase';
import { useRealTimeVitals } from '@/hooks/useRealTimeVitals';
import { useAuth } from '@/contexts/AuthContext';
import jsPDF from 'jspdf';

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
    sent_to_patient?: boolean;
    analysis_data?: any;
    analysis_status?: 'pending' | 'processing' | 'completed' | 'failed';
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
          doctors!doctor_id(full_name)
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
            // Show only reports uploaded by doctor (not by patient)
            return !report.uploaded_by_patient;
        } else {
            // Show all reports uploaded by patient (regardless of analysis status)
            return report.uploaded_by_patient;
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

    const downloadAnalysisAsPDF = (report: PatientReport) => {
        if (!report.analysis_data) {
            alert('No analysis data available');
            return;
        }

        try {
            const doc = new jsPDF();
            const pageHeight = doc.internal.pageSize.height;
            const pageWidth = doc.internal.pageSize.width;
            const margin = 20;
            const lineHeight = 7;
            const maxLineWidth = pageWidth - 2 * margin;
            let yPosition = margin;

            const addText = (text: string, fontSize: number = 10, isBold: boolean = false) => {
                doc.setFontSize(fontSize);
                doc.setFont(undefined, isBold ? 'bold' : 'normal');
                const lines = doc.splitTextToSize(String(text || ''), maxLineWidth);
                for (const line of lines) {
                    if (yPosition + lineHeight > pageHeight - margin) {
                        doc.addPage();
                        yPosition = margin;
                    }
                    doc.text(line, margin, yPosition);
                    yPosition += lineHeight;
                }
                yPosition += lineHeight * 0.5;
            };

            const addSection = (title: string, content: string | string[] | undefined) => {
                if (!content) return;
                addText(title, 11, true);
                if (Array.isArray(content)) {
                    content.forEach(item => addText(`• ${item}`, 9));
                } else {
                    addText(content, 9);
                }
                yPosition += 3;
            };

            // Header
            addText('Medical Analysis Report', 18, true);
            addText(report.title, 12);
            yPosition += 5;

            const data = report.analysis_data;

            // Patient Data
            if (data.patientData) {
                addText('Patient Information', 14, true);
                if (data.patientData.fullName) addText(`Name: ${data.patientData.fullName}`, 10);
                if (data.patientData.age) addText(`Age: ${data.patientData.age}`, 10);
                if (data.patientData.sex) addText(`Sex: ${data.patientData.sex}`, 10);
                yPosition += 5;
            }

            // Analysis Summary
            if (data.analysis) {
                addText('Analysis Summary', 14, true);
                if (data.analysis.summary) addText(data.analysis.summary, 10);
                addSection('Key Findings:', data.analysis.keyFindings);
                if (data.analysis.impression) {
                    addText('Clinical Impression:', 11, true);
                    addText(data.analysis.impression, 10);
                }
                addSection('Recommendations:', data.analysis.recommendations);
                yPosition += 5;
            }

            // Lab Results
            if (data.labResults && data.labResults.length > 0) {
                addText('Lab Results', 14, true);
                data.labResults.forEach((result: any) => {
                    addText(`${result.testName}: ${result.result} ${result.unit || ''} (${result.flag || 'NORMAL'})`, 9);
                });
                yPosition += 5;
            }

            // Advanced Report
            if (data.advancedReport) {
                const adv = data.advancedReport;
                if (adv.clinicalSummary) {
                    addText('Clinical Summary (Advanced)', 14, true);
                    addText(adv.clinicalSummary, 10);
                    yPosition += 5;
                }
                addSection('Critical Risks:', adv.criticalRisks);
                if (adv.patientSummary) {
                    addText('Patient-Friendly Summary', 14, true);
                    if (adv.patientSummary.explanation) {
                        addText('What This Means:', 11, true);
                        addText(adv.patientSummary.explanation);
                        yPosition += 3;
                    }
                    addSection('Key Points:', adv.patientSummary.keyPoints);
                    addSection('Next Steps:', adv.patientSummary.nextSteps);
                }
            }

            // Footer
            doc.setFontSize(8);
            doc.setFont(undefined, 'italic');
            const disclaimerY = pageHeight - 15;
            doc.text('⚠️ Medical Disclaimer:', margin, disclaimerY);
            const disclaimerText = 'This AI analysis is for informational purposes only and should not replace professional medical advice.';
            const disclaimerLines = doc.splitTextToSize(disclaimerText, maxLineWidth);
            disclaimerLines.forEach((line: string, idx: number) => {
                doc.text(line, margin, disclaimerY + 4 + (idx * 3));
            });

            // Save
            const fileName = `${report.title.replace(/[^a-z0-9]/gi, '_')}_analysis.pdf`;
            doc.save(fileName);
        } catch (error: any) {
            console.error('Error generating PDF:', error);
            alert(`Failed to generate PDF: ${error.message}`);
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
                                            {report.uploaded_by_patient && !report.sent_to_patient && (
                                                <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-full">
                                                    My Upload
                                                </span>
                                            )}
                                            {report.sent_to_patient && report.analysis_status === 'completed' && (
                                                <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded-full">
                                                    Analyzed
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

                                <div className="flex flex-col items-start justify-between">
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

                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => downloadReport(report)}
                                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                                        >
                                            <Download className="h-4 w-4" />
                                            <span className="text-sm">Download</span>
                                        </button>
                                        {report.sent_to_patient && report.analysis_status === 'completed' && report.analysis_data && (
                                            <button
                                                onClick={() => downloadAnalysisAsPDF(report)}
                                                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg transition-colors"
                                            >
                                                <FileDown className="h-4 w-4" />
                                                <span className="text-sm">Analysis PDF</span>
                                            </button>
                                        )}
                                    </div>
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

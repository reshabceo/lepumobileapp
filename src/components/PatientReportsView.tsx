import React, { useState, useEffect } from 'react';
import { FileText, Download, Calendar, User, ArrowLeft } from 'lucide-react';
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
}

const PatientReportsView: React.FC = () => {
    const navigate = useNavigate();
    const { patientProfile } = useRealTimeVitals();
    const [reports, setReports] = useState<PatientReport[]>([]);
    const [loading, setLoading] = useState(true);

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
          doctors!inner(full_name)
        `)
                .eq('patient_id', patientProfile.id)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error fetching reports:', error);
            } else {
                const formattedReports = data?.map(report => ({
                    ...report,
                    doctor_name: report.doctors?.full_name
                })) || [];
                setReports(formattedReports);
            }
        } catch (err) {
            console.error('Error:', err);
        } finally {
            setLoading(false);
        }
    };

    const downloadReport = async (report: PatientReport) => {
        try {
            // Create a temporary download link
            const link = document.createElement('a');
            link.href = report.file_url;
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

    if (!patientProfile) {
        return (
            <div className="bg-[#101010] min-h-screen text-white flex items-center justify-center">
                <div className="text-center">
                    <p className="text-gray-400">Loading patient profile...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-[#101010] min-h-screen text-white">
            <div className="max-w-md mx-auto p-4">
                {/* Header */}
                <div className="flex items-center mb-6">
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="mr-4 p-2 hover:bg-gray-800 rounded-lg transition-colors"
                    >
                        <ArrowLeft className="h-6 w-6" />
                    </button>
                    <div className="flex items-center">
                        <FileText className="h-6 w-6 text-blue-500 mr-3" />
                        <div>
                            <h1 className="text-xl font-bold">My Reports</h1>
                            <p className="text-sm text-gray-400">Medical reports from your doctor</p>
                        </div>
                    </div>
                </div>

                {/* Loading State */}
                {loading && (
                    <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                        <p className="text-gray-400 mt-2">Loading reports...</p>
                    </div>
                )}

                {/* No Reports */}
                {!loading && reports.length === 0 && (
                    <div className="text-center py-12">
                        <FileText className="h-16 w-16 text-gray-600 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-gray-300 mb-2">No Reports Yet</h3>
                        <p className="text-gray-500">Your doctor hasn't uploaded any reports yet.</p>
                    </div>
                )}

                {/* Reports List */}
                {!loading && reports.length > 0 && (
                    <div className="space-y-4">
                        {reports.map((report) => (
                            <div
                                key={report.id}
                                className="bg-[#1A1A1A] border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-all"
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <FileText className="h-5 w-5 text-blue-500" />
                                            <h3 className="font-semibold text-white">{report.title}</h3>
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
            </div>
        </div>
    );
};

export default PatientReportsView;

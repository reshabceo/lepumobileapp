import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FileText, Download, Calendar, User, ArrowLeft, Upload, Stethoscope, Plus, Loader2, FileDown, Image, Send, RotateCcw, Brain, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase, db, supabaseUrl, supabaseAnonKey, resolvePatientId } from '@/lib/supabase';
import { useRealTimeVitals } from '@/hooks/useRealTimeVitals';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import html2pdf from 'html2pdf.js';
import DicomUploader from './DicomUploader';
import RequestRadiologistModal from './RequestRadiologistModal';
import { getRadiologistReports } from '@/lib/supabase';

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

interface DicomStudy {
    id: string;
    modality: string | null;
    body_part_examined: string | null;
    study_date: string | null;
    created_at: string;
}

const generateReportHTML = (analysisData: any, reportTitle: string): string => {
    const currentDate = new Date();
    const formatDate = currentDate.toLocaleDateString();
    const formatTime = currentDate.toLocaleTimeString();

    // Helper function to convert markdown to HTML
    const markdownToHtml = (text: string): string => {
        if (!text) return '';
        return text
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') // Bold **text**
            .replace(/\*(.+?)\*/g, '<em>$1</em>') // Italic *text*
            .replace(/\n/g, '<br>'); // Line breaks
    };

    // Helper function to generate lab results table
    const generateLabResultsTable = () => {
        if (!Array.isArray(analysisData.labResults) || analysisData.labResults.length === 0) return '';

        return `
      <div class="section">
        <div class="section-header success">
          <span class="icon">🧪</span>
          Laboratory Results
        </div>
        <div class="card">
          <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
            <thead>
              <tr style="border-bottom: 2px solid #e5e7eb;">
                <th style="text-align: left; padding: 8px; font-weight: 600;">Test Name</th>
                <th style="text-align: left; padding: 8px; font-weight: 600;">Result</th>
                <th style="text-align: left; padding: 8px; font-weight: 600;">Unit</th>
                <th style="text-align: left; padding: 8px; font-weight: 600;">Reference Range</th>
                <th style="text-align: left; padding: 8px; font-weight: 600;">Flag</th>
              </tr>
            </thead>
            <tbody>
              ${analysisData.labResults.map((result: any) => `
                <tr style="border-bottom: 1px solid #f3f4f6;">
                  <td style="padding: 8px; font-weight: 500;">${result.testName || 'N/A'}</td>
                  <td style="padding: 8px;">${result.result || 'N/A'}</td>
                  <td style="padding: 8px; color: #6b7280;">${result.unit || 'N/A'}</td>
                  <td style="padding: 8px; color: #6b7280;">${result.referenceRange || 'N/A'}</td>
                  <td style="padding: 8px;">
                    <span style="padding: 4px 8px; border-radius: 12px; font-size: 12px; font-weight: 500; ${result.flag === 'CRITICAL' ? 'background-color: #fee2e2; color: #991b1b;' :
                result.flag === 'HIGH' ? 'background-color: #fed7aa; color: #c2410c;' :
                    result.flag === 'LOW' ? 'background-color: #dbeafe; color: #1e40af;' :
                        'background-color: #dcfce7; color: #166534;'
            }">${result.flag || 'NORMAL'}</span>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
    };

    // Helper function to generate findings list
    const generateFindingsList = () => {
        if (!Array.isArray(analysisData.analysis?.keyFindings) || analysisData.analysis.keyFindings.length === 0) return '';

        return `
      <div class="section">
        <div class="section-header success">
          <span class="icon">🔍</span>
          Key Findings
        </div>
        <div class="card">
          <ul style="list-style: none; padding: 0; margin: 0;">
            ${analysisData.analysis.keyFindings.map((finding: string) => `
              <li style="display: flex; align-items: flex-start; gap: 8px; margin-bottom: 8px;">
                <div style="width: 6px; height: 6px; border-radius: 50%; background-color: #3b82f6; margin-top: 8px; flex-shrink: 0;"></div>
                <span style="font-size: 14px; line-height: 1.5;">${markdownToHtml(finding)}</span>
              </li>
            `).join('')}
          </ul>
        </div>
      </div>`;
    };

    // Helper function to generate critical risks
    const generateCriticalRisks = () => {
        if (!Array.isArray(analysisData.advancedReport?.criticalRisks) || analysisData.advancedReport.criticalRisks.length === 0) return '';

        return `
      <div class="section">
        <div class="section-header danger">
          <span class="icon">⚠️</span>
          Critical Risks & Alerts
        </div>
        <div class="card">
          <ul style="list-style: none; padding: 0; margin: 0;">
            ${analysisData.advancedReport.criticalRisks.map((risk: string) => `
              <li style="display: flex; align-items: flex-start; gap: 8px; margin-bottom: 8px; padding: 12px; background-color: #fef2f2; border-left: 4px solid #ef4444; border-radius: 0 8px 8px 0;">
                <span style="color: #ef4444; font-size: 16px; margin-top: 2px;">🚨</span>
                <span style="font-size: 14px; line-height: 1.5; color: #991b1b;">${markdownToHtml(risk)}</span>
              </li>
            `).join('')}
          </ul>
        </div>
      </div>`;
    };

    // Helper function to generate recommendations
    const generateRecommendations = () => {
        if (!Array.isArray(analysisData.analysis?.recommendations) || analysisData.analysis.recommendations.length === 0) return '';

        return `
      <div class="section">
        <div class="section-header success">
          <span class="icon">💊</span>
          Recommendations
        </div>
        <div class="card">
          <ul style="list-style: none; padding: 0; margin: 0;">
            ${analysisData.analysis.recommendations.map((recommendation: string) => `
              <li style="display: flex; align-items: flex-start; gap: 8px; margin-bottom: 8px;">
                <div style="width: 6px; height: 6px; border-radius: 50%; background-color: #22c55e; margin-top: 8px; flex-shrink: 0;"></div>
                <span style="font-size: 14px; line-height: 1.5;">${markdownToHtml(recommendation)}</span>
              </li>
            `).join('')}
          </ul>
        </div>
      </div>`;
    };

    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${reportTitle}</title>
      <style>
        * {
          box-sizing: border-box;
        }
        
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          line-height: 1.6;
          color: #374151;
          margin: 0;
          padding: 15px;
          background-color: #f9fafb;
          max-width: 100%;
          overflow-x: hidden;
        }
        
        .header {
          background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
          color: white;
          padding: 20px 15px;
          border-radius: 12px;
          margin-bottom: 20px;
          text-align: center;
          box-shadow: 0 10px 25px rgba(59, 130, 246, 0.3);
          word-wrap: break-word;
          overflow-wrap: break-word;
        }
        
        .header h1 {
          margin: 0;
          font-size: 1.8rem;
          font-weight: 700;
          text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
          word-wrap: break-word;
        }
        
        .header .subtitle {
          margin-top: 8px;
          font-size: 0.95rem;
          opacity: 0.9;
          word-wrap: break-word;
        }
        
        .section {
          margin-bottom: 20px;
          page-break-inside: avoid;
        }
        
        .section-header {
          display: flex;
          align-items: center;
          padding: 12px 15px;
          border-radius: 8px 8px 0 0;
          color: white;
          font-weight: 600;
          font-size: 1.1rem;
          text-shadow: 1px 1px 2px rgba(0,0,0,0.3);
          word-wrap: break-word;
        }
        
        .section-header.primary { background: linear-gradient(135deg, #3b82f6, #1e40af); }
        .section-header.success { background: linear-gradient(135deg, #22c55e, #15803d); }
        .section-header.warning { background: linear-gradient(135deg, #f59e0b, #d97706); }
        .section-header.danger { background: linear-gradient(135deg, #ef4444, #dc2626); }
        
        .section-header .icon {
          margin-right: 10px;
          font-size: 1.4rem;
        }
        
        .card {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 0 0 12px 12px;
          padding: 15px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
          word-wrap: break-word;
          overflow-wrap: break-word;
          max-width: 100%;
        }
        
        .card p, .card li, .card span {
          word-wrap: break-word;
          overflow-wrap: break-word;
          max-width: 100%;
        }
        
        .patient-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-top: 12px;
        }
        
        .patient-item {
          padding: 10px;
          background: #f8fafc;
          border-radius: 8px;
          border-left: 4px solid #3b82f6;
          word-wrap: break-word;
          overflow-wrap: break-word;
        }
        
        .patient-label {
          font-size: 0.85rem;
          color: #6b7280;
          margin-bottom: 4px;
        }
        
        .patient-value {
          font-weight: 600;
          color: #111827;
          font-size: 0.95rem;
          word-wrap: break-word;
          overflow-wrap: break-word;
        }
        
        .disclaimer {
          background: #fef2f2;
          border: 2px solid #fca5a5;
          border-radius: 12px;
          padding: 15px;
          margin-top: 30px;
          word-wrap: break-word;
          overflow-wrap: break-word;
          page-break-inside: avoid;
        }
        
        .disclaimer-title {
          color: #b91c1c;
          font-weight: 700;
          font-size: 1.1rem;
          margin-bottom: 12px;
          display: flex;
          align-items: center;
        }
        
        .disclaimer-text {
          color: #7f1d1d;
          line-height: 1.6;
          font-size: 0.9rem;
        }
        
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 10px;
          table-layout: fixed;
        }
        
        table td, table th {
          word-wrap: break-word;
          overflow-wrap: break-word;
          padding: 6px;
        }
        
        ul, ol {
          padding-left: 20px;
          margin: 10px 0;
        }
        
        li {
          margin-bottom: 6px;
          word-wrap: break-word;
          overflow-wrap: break-word;
          line-height: 1.5;
        }
        
        @media print {
          body { 
            background: white; 
            padding: 10px;
            max-width: 100%;
          }
          .header { box-shadow: none; }
          .card { box-shadow: none; border: 1px solid #ccc; }
          .section { page-break-inside: avoid; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🏥 ${reportTitle}</h1>
        <div class="subtitle">Generated on ${formatDate} at ${formatTime}</div>
      </div>

      <!-- Patient Information Section -->
      ${analysisData.patientData ? `
      <div class="section">
        <div class="section-header primary">
          <span class="icon">👤</span>
          Patient Information
        </div>
        <div class="card">
          <div class="patient-grid">
            ${[
                { label: '📋 Full Name', value: analysisData.patientData.fullName },
                { label: '🆔 Patient ID', value: analysisData.patientData.patientId },
                { label: '📄 MRN', value: analysisData.patientData.mrn },
                { label: '🎂 Age', value: analysisData.patientData.age },
                { label: '⚧ Gender', value: analysisData.patientData.sex },
                { label: '📅 Date of Birth', value: analysisData.patientData.dateOfBirth },
                { label: '🔬 Study Date', value: analysisData.patientData.studyDate },
                { label: '📊 Report Date', value: analysisData.patientData.reportDate }
            ].filter(item => item.value).map(item => `
              <div class="patient-item">
                <div class="patient-label">${item.label}:</div>
                <div class="patient-value">${item.value}</div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
      ` : ''}

      ${analysisData.analysis?.summary ? `
      <div class="section">
        <div class="section-header primary">
          <span class="icon">📋</span>
          Analysis Summary
        </div>
        <div class="card">
          <p style="white-space: pre-line; line-height: 1.7;">${markdownToHtml(analysisData.analysis.summary)}</p>
        </div>
      </div>
      ` : ''}

      ${generateLabResultsTable()}

      ${generateFindingsList()}

      ${analysisData.analysis?.impression ? `
      <div class="section">
        <div class="section-header primary">
          <span class="icon">👩‍⚕️</span>
          Clinical Impression
        </div>
        <div class="card">
          <p style="white-space: pre-line; line-height: 1.7;">${markdownToHtml(analysisData.analysis.impression)}</p>
        </div>
      </div>
      ` : ''}

      ${generateRecommendations()}

      ${generateCriticalRisks()}

      ${analysisData.advancedReport?.clinicalSummary ? `
      <div class="section">
        <div class="section-header success">
          <span class="icon">🩺</span>
          Clinical Summary (Advanced Analysis)
        </div>
        <div class="card">
          <p style="white-space: pre-line; line-height: 1.7;">${markdownToHtml(analysisData.advancedReport.clinicalSummary)}</p>
        </div>
      </div>
      ` : ''}

      ${analysisData.advancedReport?.patientSummary ? `
      <div class="section">
        <div class="section-header success">
          <span class="icon">👤</span>
          Patient-Friendly Summary
        </div>
        <div class="card">
          ${analysisData.advancedReport.patientSummary.explanation ? `
            <div style="margin-bottom: 20px;">
              <h3 style="color: #3b82f6; display: flex; align-items: center;">💡 What This Means for You:</h3>
              <p style="line-height: 1.7;">${markdownToHtml(analysisData.advancedReport.patientSummary.explanation)}</p>
            </div>
          ` : ''}

          ${Array.isArray(analysisData.advancedReport.patientSummary.keyPoints) && analysisData.advancedReport.patientSummary.keyPoints.length > 0 ? `
            <div style="margin-bottom: 20px;">
              <h3 style="color: #22c55e; display: flex; align-items: center;">🔑 Key Points:</h3>
              ${analysisData.advancedReport.patientSummary.keyPoints.map((point: string) => `
                <div style="display: flex; align-items: flex-start; gap: 8px; margin-bottom: 8px; padding: 12px; background-color: #f0fdf4; border-left: 4px solid #22c55e; border-radius: 0 8px 8px 0;">
                  <span style="color: #22c55e; font-size: 16px; margin-top: 2px;">✨</span>
                  <span style="font-size: 14px; line-height: 1.5;">${markdownToHtml(point)}</span>
                </div>
              `).join('')}
            </div>
          ` : ''}

          ${Array.isArray(analysisData.advancedReport.patientSummary.nextSteps) && analysisData.advancedReport.patientSummary.nextSteps.length > 0 ? `
            <div>
              <h3 style="color: #3b82f6; display: flex; align-items: center;">👣 Next Steps:</h3>
              ${analysisData.advancedReport.patientSummary.nextSteps.map((step: string) => `
                <div style="display: flex; align-items: flex-start; gap: 8px; margin-bottom: 8px; padding: 12px; background-color: #f0fdf4; border-left: 4px solid #22c55e; border-radius: 0 8px 8px 0;">
                  <span style="color: #22c55e; font-size: 16px; margin-top: 2px;">▶️</span>
                  <span style="font-size: 14px; line-height: 1.5;">${markdownToHtml(step)}</span>
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>
      </div>
      ` : ''}

      <div class="disclaimer">
        <div class="disclaimer-title">
          ⚠️ Medical Disclaimer
        </div>
        <div class="disclaimer-text">
          This AI analysis is for informational purposes only and should not replace professional medical advice, diagnosis, or treatment. Always consult with qualified healthcare professionals for medical decisions.
        </div>
      </div>
    </body>
    </html>
  `;
};

const PatientReportsView: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { toast } = useToast();
    const { user } = useAuth();
    // We still pull hookProfile to benefit from its cache, but we don't block the UI on hookLoading
    const { patientProfile: hookProfile } = useRealTimeVitals();
    const [patientProfile, setPatientProfile] = useState<any>(null);
    const [reports, setReports] = useState<PatientReport[]>([]);
    const [dicomStudies, setDicomStudies] = useState<DicomStudy[]>([]);
    const [dicomLoading, setDicomLoading] = useState(false);
    // Start loading=false — we only show the spinner once we actually start a fetch
    const [loading, setLoading] = useState(false);
    const [radiologistReports, setRadiologistReports] = useState<any[]>([]);
    const [radiologistLoading, setRadiologistLoading] = useState(false);
    const [profileLoading, setProfileLoading] = useState(true);
    const [reportsLoaded, setReportsLoaded] = useState(false);
    const [activeTab, setActiveTab] = useState<'from-doctor' | 'my-uploads' | 'dicom' | 'dicom-by-doctor'>(
        (location.state as any)?.activeTab || localStorage.getItem('reports_active_tab') || 'from-doctor'
    );
    const [requestRadiologistOpen, setRequestRadiologistOpen] = useState(false);
    const [selectedStudyForRequest, setSelectedStudyForRequest] = useState<DicomStudy | null>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    // ── Resolve patient profile ──────────────────────────────────────────────────
    useEffect(() => {
        if (!user) {
            setProfileLoading(false);
            return;
        }
        let cancelled = false;

        // FAST PATH: a minimal { id } is all the report queries need. Resolve the
        // patient id directly (deduped, ~200ms) so the Reports UI loads immediately
        // and never hangs waiting on the heavy/slow full-profile fetch (which can be
        // delayed for seconds while big libs like AWS SDK / jspdf parse on this page).
        resolvePatientId(user.id).then((id) => {
            if (!cancelled && id) {
                setPatientProfile((prev: any) => (prev?.id ? prev : { id }));
                setProfileLoading(false);
            }
        });

        // ENRICH with the full profile when available (hook → cache → DB).
        if (hookProfile) {
            setPatientProfile(hookProfile);
            setProfileLoading(false);
            return () => { cancelled = true; };
        }

        const cacheKey = `patient_profile_${user.id}`;
        const cachedProfile = localStorage.getItem(cacheKey);
        if (cachedProfile) {
            try {
                const parsed = JSON.parse(cachedProfile);
                if (Date.now() - (parsed._cached_at || 0) < 5 * 60 * 1000) {
                    setPatientProfile(parsed);
                    setProfileLoading(false);
                }
            } catch (e) { /* ignore */ }
        }

        (async () => {
            try {
                const profileData = await db.getPatientProfile(user.id);
                if (!cancelled && profileData.data) setPatientProfile(profileData.data);
            } catch (err) {
                console.error('❌ Failed to fetch profile:', err);
            } finally {
                if (!cancelled) setProfileLoading(false);
            }
        })();

        // Safety timeout — at most 4 s of profile loading
        timeoutRef.current = setTimeout(() => { if (!cancelled) setProfileLoading(false); }, 4000);

        return () => {
            cancelled = true;
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [hookProfile, user]);

    // ── Fetch reports whenever the profile becomes available ─────────────────────
    useEffect(() => {
        if (patientProfile && !reportsLoaded) {
            fetchReports(patientProfile);
        }
        // Reset the loaded flag when the component unmounts so re-navigation re-fetches
        return () => {
            setReportsLoaded(false);
        };
    }, [patientProfile]);

    // ── Real-time subscription: update report status as analysis completes ────────
    useEffect(() => {
        if (!patientProfile?.id) return;

        const channel = supabase
            .channel(`patient_reports_status_${patientProfile.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'patient_reports',
                    filter: `patient_id=eq.${patientProfile.id}`,
                },
                (payload) => {
                    const updated = payload.new as PatientReport;
                    setReports(prev =>
                        prev.map(r => r.id === updated.id
                            ? { ...r,
                                analysis_status: updated.analysis_status,
                                analysis_data: updated.analysis_data ?? r.analysis_data,
                                sent_to_patient: updated.sent_to_patient ?? r.sent_to_patient,
                                analyzed_at: (updated as any).analyzed_at ?? (r as any).analyzed_at,
                              }
                            : r
                        )
                    );
                    // Toast when analysis finishes
                    if (updated.analysis_status === 'completed' && updated.uploaded_by_patient) {
                        toast({ title: 'Analysis complete', description: `"${updated.title}" has been analysed.` });
                    }
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [patientProfile?.id]);

    // 🚀 Persist active tab to handle Android process death/restarts
    useEffect(() => {
        localStorage.setItem('reports_active_tab', activeTab);
    }, [activeTab]);

    const fetchRadiologistReports = async () => {
        if (!patientProfile) return;
        setRadiologistLoading(true);
        try {
            const { data, error } = await getRadiologistReports(patientProfile.id);
            if (error) {
                console.error('Error fetching radiologist reports:', error);
            } else {
                setRadiologistReports(data || []);
            }
        } catch (err) {
            console.error('Error:', err);
        } finally {
            setRadiologistLoading(false);
        }
    };

    const fetchDicomStudies = async () => {
        if (!patientProfile) return;
        setDicomLoading(true);
        try {
            const { data, error } = await supabase
                .from('dicom_studies')
                .select('id, modality, body_part_examined, study_date, created_at')
                .eq('patient_id', patientProfile.id)
                .order('created_at', { ascending: false });
            if (error) {
                console.error('Error fetching DICOM studies:', error);
            } else {
                setDicomStudies(data || []);
            }
        } catch (err) {
            console.error('Error:', err);
        } finally {
            setDicomLoading(false);
        }
    };

    useEffect(() => {
        if (patientProfile && activeTab === 'dicom') {
            fetchDicomStudies();
        }
        if (patientProfile && activeTab === 'dicom-by-doctor') {
            fetchRadiologistReports();
        }
    }, [patientProfile, activeTab]);

    const fetchReports = async (profile?: any) => {
        const activeProfile = profile || patientProfile;
        if (!activeProfile) return;

        setLoading(true);
        const { data } = await supabase
            .from('patient_reports')
            .select(`
                *,
                doctors!doctor_id(full_name)
            `)
            .eq('patient_id', activeProfile.id)
            .order('created_at', { ascending: false });

        const formattedReports = (data || []).map((report: any) => ({
            ...report,
            doctor_name: report.doctors?.full_name || 'Unknown Doctor'
        }));
        setReports(formattedReports);
        setReportsLoaded(true);
        setLoading(false);
    };

    // Filter reports based on active tab
    const filteredReports = reports.filter(report => {
        if (activeTab === 'from-doctor') {
            // Show reports uploaded by doctor OR patient uploads that are fully analyzed
            return !report.uploaded_by_patient || (report.uploaded_by_patient && report.sent_to_patient && report.analysis_status === 'completed' && !!report.analysis_data);
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
                .createSignedUrl(report.file_url, 300); // 5 minutes expiry for better reliability

            if (error) {
                console.error('Error creating signed URL:', error);
                alert('Failed to generate download link: ' + error.message);
                return;
            }

            // Fetch the file as a blob
            const response = await fetch(data.signedUrl);
            if (!response.ok) {
                throw new Error('Failed to fetch file');
            }
            const blob = await response.blob();

            // Handle download based on platform
            if (Capacitor.isNativePlatform()) {
                // Native platform - use Filesystem and Share
                try {
                    // Convert blob to base64
                    const reader = new FileReader();
                    const base64Data = await new Promise<string>((resolve, reject) => {
                        reader.onloadend = () => {
                            const base64String = reader.result as string;
                            // Remove data URL prefix
                            const base64 = base64String.split(',')[1];
                            resolve(base64);
                        };
                        reader.onerror = reject;
                        reader.readAsDataURL(blob);
                    });

                    // Determine file extension and MIME type
                    const fileExt = report.file_name.split('.').pop() || 'bin';
                    const fileName = report.file_name.replace(/[^a-zA-Z0-9._-]/g, '_');
                    const safeFileName = `patient_report_${Date.now()}_${fileName}`;

                    // Check if file is text-based (for proper encoding)
                    const isTextFile = ['txt', 'json', 'xml', 'csv', 'html', 'css', 'js'].includes(fileExt.toLowerCase());
                    
                    // Save to Documents directory
                    // For binary files (PDF, images, etc.), we need to use base64 without UTF8 encoding
                    const filePath = await Filesystem.writeFile({
                        path: safeFileName,
                        data: base64Data,
                        directory: Directory.Documents,
                        encoding: isTextFile ? Encoding.UTF8 : undefined, // Binary files don't need encoding
                    });

                    // Get URI for sharing
                    const uri = await Filesystem.getUri({
                        path: safeFileName,
                        directory: Directory.Documents,
                    });

                    // Share the file (opens native share dialog)
                    try {
                        await Share.share({
                            title: report.file_name,
                            text: `Medical Report: ${report.title}`,
                            url: (uri as any).uri || String(uri),
                            dialogTitle: 'Share Medical Report',
                        });
                    } catch (shareError) {
                        // If share fails, at least the file is saved
                        console.log('Share dialog not available, file saved to:', (uri as any).uri || String(uri));
                        alert(`File saved successfully. Location: ${(uri as any).uri || String(uri)}`);
                    }
                } catch (fsError: any) {
                    console.error('Filesystem error:', fsError);
                    // Fallback to web download method
                    downloadBlobInApp(blob, report.file_name);
                }
            } else {
                // Web platform - use in-app download without opening new tab
                downloadBlobInApp(blob, report.file_name);
            }
        } catch (err: any) {
            console.error('Download error:', err);
            alert('Failed to download report: ' + (err.message || 'Unknown error'));
        }
    };

    // Helper function for web-based downloads that stay in-app
    const downloadBlobInApp = (blob: Blob, fileName: string) => {
        // Create object URL from blob
        const url = window.URL.createObjectURL(blob);
        
        // Create a temporary anchor element
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.style.display = 'none';
        
        // Append to body, click, and remove immediately
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Clean up the object URL after a short delay
        setTimeout(() => {
            window.URL.revokeObjectURL(url);
        }, 100);
    };

    const downloadAnalysisAsPDF = async (report: PatientReport) => {
        if (!report.analysis_data) {
            alert('No analysis data available');
            return;
        }

        try {
            console.log('Generating PDF... Please wait.');

            // Parse analysis_data if Supabase returned it as a JSON string
            let analysisData = report.analysis_data;
            if (typeof analysisData === 'string') {
                try {
                    analysisData = JSON.parse(analysisData);
                } catch {
                    alert('Analysis data is corrupted and cannot be exported.');
                    return;
                }
            }

            // Generate HTML content
            const htmlContent = generateReportHTML(analysisData, report.title);

            // Create a temporary element to hold the HTML
            const element = document.createElement('div');
            element.innerHTML = htmlContent;
            element.style.width = '190mm'; // A4 width minus margins
            element.style.maxWidth = '190mm';
            element.style.margin = '0 auto';
            element.style.padding = '0';
            element.style.boxSizing = 'border-box';
            element.style.overflowX = 'hidden';

            // Configure PDF options
            const opt = {
                margin: [10, 10, 10, 10] as [number, number, number, number],
                filename: `${report.title.replace(/[^a-z0-9]/gi, '_')}_Analysis.pdf`,
                image: { type: 'jpeg' as const, quality: 0.98 },
                html2canvas: {
                    scale: 2,
                    useCORS: true,
                    logging: false,
                    letterRendering: true,
                    windowWidth: 794, // A4 width in pixels at 96 DPI
                    width: 794
                },
                jsPDF: {
                    unit: 'mm',
                    format: 'a4',
                    orientation: 'portrait' as const,
                    compress: true
                },
                pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
            };

            // Generate and download PDF
            await html2pdf().set(opt).from(element).save();

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
        const types: Record<string, string> = {
            medical_report: 'Medical Report',
            test_results: 'Test Results',
            prescription: 'Prescription',
            consultation_notes: 'Consultation Notes',
            discharge_summary: 'Discharge Summary',
            weekly_vitals_report: 'Weekly Vitals Report',
            rpm_compliance_report: 'RPM Compliance Report',
            combined_weekly_report: 'Combined Weekly Report',
        };
        return types[type] || type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    };

    const getReportTypeColor = (type: string) => {
        const colors: Record<string, string> = {
            medical_report: 'bg-blue-100 text-blue-800',
            test_results: 'bg-green-100 text-green-800',
            prescription: 'bg-purple-100 text-purple-800',
            consultation_notes: 'bg-yellow-100 text-yellow-800',
            discharge_summary: 'bg-red-100 text-red-800',
            weekly_vitals_report: 'bg-cyan-100 text-cyan-800',
            rpm_compliance_report: 'bg-orange-100 text-orange-800',
            combined_weekly_report: 'bg-violet-100 text-violet-800',
        };
        return colors[type] || 'bg-gray-100 text-gray-800';
    };

    // ── Render analysis status badge for patient-uploaded reports ─────────────────
    const renderAnalysisStatus = (report: PatientReport) => {
        if (!report.uploaded_by_patient) return null;
        switch (report.analysis_status) {
            case 'processing':
                return (
                    <span className="flex items-center gap-1 text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded-full">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Analysing…
                    </span>
                );
            case 'completed':
                return (
                    <span className="flex items-center gap-1 text-xs bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded-full">
                        <CheckCircle2 className="h-3 w-3" />
                        AI Analysed
                    </span>
                );
            case 'failed':
                return (
                    <span className="flex items-center gap-1 text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded-full">
                        <XCircle className="h-3 w-3" />
                        Analysis failed
                    </span>
                );
            case 'pending':
                return (
                    <span className="flex items-center gap-1 text-xs bg-gray-500/20 text-gray-400 px-2 py-1 rounded-full">
                        <Clock className="h-3 w-3" />
                        Pending
                    </span>
                );
            default:
                return null;
        }
    };

    // Show loading state — only block if we're still fetching the profile AND have nothing cached
    if (profileLoading && !patientProfile) {
        return (
            <div className="bg-[#080D1A] min-h-screen text-white flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
                    <p className="text-gray-400">Loading patient profile...</p>
                </div>
            </div>
        );
    }

    // Show error state if no profile after loading
    if (!patientProfile) {
        return (
            <div className="bg-[#080D1A] min-h-screen text-white flex items-center justify-center p-4">
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
        <div className="bg-[#080D1A] min-h-screen text-white p-4">
            <div className="max-w-sm mx-auto">
                {/* Status Bar Spacing (match scanner) */}
                <div className="h-6"></div>

                {/* Header */}
                <header className="flex items-center gap-3 mb-6">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors active:scale-95"
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div className="flex items-center gap-3 flex-1">
                        <div className="h-10 w-10 rounded-2xl bg-purple-900/70 flex items-center justify-center border border-purple-400/50">
                            <FileText className="h-6 w-6 text-purple-300" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold">My Reports</h1>
                            <p className="text-xs text-gray-400">Medical reports and uploads</p>
                        </div>
                    </div>
                    {/* Upload Button - Always visible when on "My Uploads" tab */}
                    {activeTab === 'my-uploads' && (
                        <button
                            onClick={() => navigate('/add-reports')}
                            className="p-2 bg-blue-600 hover:bg-blue-500 rounded-full transition-all text-white border border-blue-400/30 flex items-center justify-center shadow-lg shadow-blue-600/25 active:scale-95"
                            style={{ minHeight: "36px", minWidth: "36px" }}
                            title="Upload New Report"
                        >
                            <Plus className="h-4 w-4" />
                        </button>
                    )}
                </header>

                {/* Tabs - Responsive Grid */}
                <div className="grid grid-cols-2 gap-2 bg-gray-800/50 rounded-lg p-1 mb-6">
                    <button
                        onClick={() => setActiveTab('from-doctor')}
                        className={`flex items-center justify-center gap-1.5 py-3 px-2 rounded-md transition-all duration-200 text-xs sm:text-sm ${activeTab === 'from-doctor'
                            ? 'bg-blue-600 text-white shadow-lg'
                            : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                            }`}
                    >
                        <Stethoscope className="h-3.5 w-3.5 flex-shrink-0" />
                        <span className="font-medium truncate">From Doctor</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('my-uploads')}
                        className={`flex items-center justify-center gap-1.5 py-3 px-2 rounded-md transition-all duration-200 text-xs sm:text-sm ${activeTab === 'my-uploads'
                            ? 'bg-blue-600 text-white shadow-lg'
                            : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                            }`}
                    >
                        <Upload className="h-3.5 w-3.5 flex-shrink-0" />
                        <span className="font-medium truncate">My Uploads</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('dicom')}
                        className={`flex items-center justify-center gap-1.5 py-3 px-2 rounded-md transition-all duration-200 text-xs sm:text-sm ${activeTab === 'dicom'
                            ? 'bg-blue-600 text-white shadow-lg'
                            : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                            }`}
                    >
                        <Image className="h-3.5 w-3.5 flex-shrink-0" />
                        <span className="font-medium truncate">DICOM</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('dicom-by-doctor')}
                        className={`flex items-center justify-center gap-1.5 py-3 px-2 rounded-md transition-all duration-200 text-xs sm:text-sm ${activeTab === 'dicom-by-doctor'
                            ? 'bg-blue-600 text-white shadow-lg'
                            : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                            }`}
                    >
                        <Stethoscope className="h-3.5 w-3.5 flex-shrink-0" />
                        <span className="font-medium truncate">DICOM (Doctor)</span>
                    </button>
                </div>

                {/* DICOM Tab: Upload + list + Request radiologist */}
                {activeTab === 'dicom' && (
                    <div className="space-y-6 mb-20">
                        <DicomUploader
                            patientProfile={patientProfile}
                            onUploadComplete={(studyId) => {
                                fetchDicomStudies();
                            }}
                        />
                        {dicomLoading && (
                            <div className="text-center py-6">
                                <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto" />
                                <p className="text-gray-400 mt-2">Loading DICOM studies...</p>
                            </div>
                        )}
                        {!dicomLoading && dicomStudies.length > 0 && (
                            <div>
                                <h3 className="text-sm font-semibold text-gray-300 mb-3">Your DICOM studies</h3>
                                <p className="text-xs text-gray-500 mb-3">Request a radiologist to review any study.</p>
                                <div className="space-y-3">
                                    {dicomStudies.map((study) => (
                                        <div
                                            key={study.id}
                                            className="bg-[#1A1A1A] border border-gray-800 rounded-xl p-4 flex items-center justify-between gap-3"
                                        >
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-white truncate">
                                                    {study.modality || 'Imaging'} {study.body_part_examined ? `• ${study.body_part_examined}` : ''}
                                                </p>
                                                <p className="text-xs text-gray-500 mt-0.5">
                                                    {study.study_date ? new Date(study.study_date).toLocaleDateString() : new Date(study.created_at).toLocaleDateString()}
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    setSelectedStudyForRequest(study);
                                                    setRequestRadiologistOpen(true);
                                                }}
                                                className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-lg text-sm font-medium shrink-0"
                                            >
                                                <Send className="h-4 w-4" />
                                                Request radiologist
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {!dicomLoading && dicomStudies.length === 0 && (
                            <p className="text-sm text-gray-500 text-center py-4">Upload a DICOM or ZIP file above, then request a radiologist review.</p>
                        )}
                    </div>
                )}

                {/* DICOM by Doctor Tab */}
                {activeTab === 'dicom-by-doctor' && (
                    <div className="space-y-4 mb-20">
                        {radiologistLoading ? (
                            <div className="text-center py-20 flex flex-col items-center gap-4">
                                <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
                                <p className="text-gray-400">Loading radiologist reports...</p>
                            </div>
                        ) : radiologistReports.length > 0 ? (
                            radiologistReports.map((report) => (
                                <div
                                    key={report.id}
                                    className="bg-[#1A1A1A] border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-all"
                                >
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="bg-blue-500/10 p-2 rounded-lg">
                                            <FileText className="h-5 w-5 text-blue-500" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-semibold text-white truncate">{report.report_title || 'Radiologist Report'}</h3>
                                            <p className="text-xs text-gray-500">
                                                {new Date(report.created_at).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                    <p className="text-gray-400 text-sm mb-4 line-clamp-3">
                                        {report.findings || report.report_content || 'No findings available.'}
                                    </p>
                                    <div className="flex items-center justify-between border-t border-gray-800 pt-3">
                                        <div className="flex items-center text-xs text-gray-500">
                                            <User className="h-3 w-3 mr-1" />
                                            <span>Dr. {report.radiologists?.full_name || 'Radiologist'}</span>
                                        </div>
                                        <button 
                                            onClick={() => {
                                                toast({
                                                    title: report.report_title || "Radiologist Report",
                                                    description: report.impression || "Opening detailed view...",
                                                });
                                            }}
                                            className="text-blue-400 text-xs font-semibold hover:text-blue-300"
                                        >
                                            View Details
                                        </button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-20">
                                <Stethoscope className="h-16 w-16 text-gray-700 mx-auto mb-4" />
                                <p className="text-gray-400 font-medium">No DICOM Reports from Doctor</p>
                                <p className="text-sm text-gray-500 mt-2 max-w-[250px] mx-auto">
                                    Reports shared by radiologists will appear here.
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {/* Loading State (reports tabs) */}
                {activeTab !== 'dicom' && loading && (
                    <div className="text-center py-20 flex flex-col items-center gap-4">
                        <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
                        <div className="space-y-1">
                            <p className="text-gray-300 font-medium text-lg">Loading reports...</p>
                            <p className="text-gray-500 text-sm">Please wait while we fetch your documents</p>
                        </div>
                    </div>
                )}

                {/* Error / Retry State */}
                {activeTab !== 'dicom' && !loading && !reportsLoaded && (
                    <div className="text-center py-20 flex flex-col items-center gap-4">
                        <div className="bg-red-500/10 p-4 rounded-full">
                            <RotateCcw className="h-8 w-8 text-red-500" />
                        </div>
                        <div className="space-y-2">
                            <p className="text-gray-300 font-medium text-lg">Failed to load reports</p>
                            <p className="text-gray-500 text-sm max-w-[250px] mx-auto">This could be due to a slow connection or a temporary issue.</p>
                        </div>
                        <button
                            onClick={() => {
                                setReportsLoaded(false);
                                if (patientProfile) fetchReports(patientProfile);
                            }}
                            className="mt-2 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-all"
                        >
                            <RotateCcw className="h-4 w-4" />
                            <span>Try Again</span>
                        </button>
                    </div>
                )}

                {/* No Reports */}
                {activeTab !== 'dicom' && !loading && reportsLoaded && filteredReports.length === 0 && (
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
                {activeTab !== 'dicom' && !loading && filteredReports.length > 0 && (
                    <div className="space-y-4 mb-20">
                        {filteredReports.map((report) => (
                            <div
                                key={report.id}
                                className="bg-[#1A1A1A] border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-all"
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                                            {report.uploaded_by_patient ? (
                                                <Upload className="h-5 w-5 text-green-500 shrink-0" />
                                            ) : (
                                                <Stethoscope className="h-5 w-5 text-blue-500 shrink-0" />
                                            )}
                                            <h3 className="font-semibold text-white flex-1 min-w-0 truncate">{report.title}</h3>
                                            {/* Live analysis status for patient uploads */}
                                            {renderAnalysisStatus(report)}
                                            {report.sent_to_patient && report.analysis_status === 'completed' && !report.uploaded_by_patient && (
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

                                    <div className="flex gap-2 flex-wrap">
                                        {/* Download original file */}
                                        <button
                                            onClick={() => downloadReport(report)}
                                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                                        >
                                            <Download className="h-4 w-4" />
                                            <span className="text-sm">Download</span>
                                        </button>
                                        {/* Analysis PDF — for doctor-shared reports */}
                                        {activeTab === 'from-doctor' && report.sent_to_patient && report.analysis_status === 'completed' && report.analysis_data && (
                                            <button
                                                onClick={() => downloadAnalysisAsPDF(report)}
                                                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg transition-colors"
                                            >
                                                <FileDown className="h-4 w-4" />
                                                <span className="text-sm">Analysis PDF</span>
                                            </button>
                                        )}
                                        {/* Analysis PDF — for patient's own completed uploads */}
                                        {activeTab === 'my-uploads' && report.analysis_status === 'completed' && report.analysis_data && (
                                            <button
                                                onClick={() => downloadAnalysisAsPDF(report)}
                                                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg transition-colors"
                                            >
                                                <Brain className="h-4 w-4" />
                                                <span className="text-sm">AI Analysis</span>
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

                {/* Request Radiologist Modal (DICOM tab) */}
                {selectedStudyForRequest && (
                    <RequestRadiologistModal
                        open={requestRadiologistOpen}
                        onOpenChange={(open) => {
                            setRequestRadiologistOpen(open);
                            if (!open) setSelectedStudyForRequest(null);
                        }}
                        studyId={selectedStudyForRequest.id}
                        studyInfo={{
                            modality: selectedStudyForRequest.modality || 'Imaging',
                            body_part_examined: selectedStudyForRequest.body_part_examined || '—'
                        }}
                    />
                )}
            </div>
        </div>
    );
};

export default PatientReportsView;

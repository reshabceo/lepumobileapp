import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { Pill, Clock, Calendar, AlertCircle, CheckCircle, Bell, BellOff, ArrowLeft, Edit2, Save, X, Download } from 'lucide-react';
import { format, isPast, parseISO } from 'date-fns';
import jsPDF from 'jspdf';

interface Prescription {
  id: string;
  medication_name: string;
  dosage: string | null;
  frequency: string;
  duration_days: number;
  instructions: string | null;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at: string;
  doctor?: {
    full_name: string;
    specialty?: string | null;
    hospital?: string | null;
    national_medical_council_number?: string | null;
    signature_data_url?: string | null;
  };
}

interface Reminder {
  id: string;
  prescription_id: string;
  reminder_time: string;
  is_active: boolean;
}

const loadMonitraqLogoDataUrl = async (): Promise<string | null> => {
  const candidates = ['/monitraq-logo.png', '/logo.png'];
  for (const path of candidates) {
    try {
      const res = await fetch(path);
      if (!res.ok) continue;
      const blob = await res.blob();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(String(reader.result || ''));
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      if (dataUrl) return dataUrl;
    } catch {
      // Try next candidate.
    }
  }
  return null;
};

const normalizeImageToPngDataUrl = async (sourceDataUrl: string): Promise<string> => {
  if (!sourceDataUrl) throw new Error('No image source');
  if (sourceDataUrl.startsWith('data:image/png')) return sourceDataUrl;

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = sourceDataUrl;
  });

  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width || 800;
  canvas.height = img.naturalHeight || img.height || 300;
  const ctx = canvas.getContext('2d');
  if (!ctx) return sourceDataUrl;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0);
  return canvas.toDataURL('image/png', 0.95);
};

export const PatientPrescriptions = () => {
  const navigate = useNavigate();
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'active' | 'expired'>('active');
  const [editingReminder, setEditingReminder] = useState<string | null>(null);
  const [newReminderTime, setNewReminderTime] = useState<string>('');

  useEffect(() => {
    fetchPrescriptions();
    fetchReminders();
  }, []);

  const fetchPrescriptions = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error('Please login to view prescriptions');
        setLoading(false);
        return;
      }

      // Get patient ID
      const { data: patientData } = await supabase
        .from('patients')
        .select('id')
        .eq('auth_user_id', user.id)
        .single();

      if (!patientData) {
        toast.error('Patient profile not found');
        setLoading(false);
        return;
      }

      // Fetch prescriptions with doctor info
      const { data, error } = await supabase
        .from('prescriptions')
        .select(`
          *,
          doctor:doctors!doctor_id(full_name, specialty, hospital, national_medical_council_number, signature_data_url)
        `)
        .eq('patient_id', patientData.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching prescriptions:', error);
        toast.error('Failed to load prescriptions');
        return;
      }

      setPrescriptions(data || []);
    } catch (err) {
      console.error('Error:', err);
      toast.error('Failed to load prescriptions');
    } finally {
      setLoading(false);
    }
  };

  const fetchReminders = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: patientData } = await supabase
        .from('patients')
        .select('id')
        .eq('auth_user_id', user.id)
        .single();

      if (!patientData) return;

      const { data, error } = await supabase
        .from('medication_reminders')
        .select('*')
        .eq('patient_id', patientData.id)
        .eq('is_active', true);

      if (error) {
        console.error('Error fetching reminders:', error);
        return;
      }

      setReminders(data || []);
    } catch (err) {
      console.error('Error fetching reminders:', err);
    }
  };

  const toggleReminders = async (prescriptionId: string, currentlyActive: boolean) => {
    try {
      const prescriptionReminders = reminders.filter(r => r.prescription_id === prescriptionId);
      
      const { error } = await supabase
        .from('medication_reminders')
        .update({ is_active: !currentlyActive })
        .in('id', prescriptionReminders.map(r => r.id));

      if (error) {
        console.error('Error toggling reminders:', error);
        toast.error('Failed to update reminders');
        return;
      }

      // Update local state
      setReminders(reminders.map(r => 
        r.prescription_id === prescriptionId 
          ? { ...r, is_active: !currentlyActive }
          : r
      ));

      toast.success(currentlyActive ? 'Reminders disabled' : 'Reminders enabled');
    } catch (err) {
      console.error('Error:', err);
      toast.error('Failed to update reminders');
    }
  };

  const startEditingReminder = (reminderId: string, currentTime: string) => {
    setEditingReminder(reminderId);
    setNewReminderTime(currentTime);
  };

  const cancelEditingReminder = () => {
    setEditingReminder(null);
    setNewReminderTime('');
  };

  const updateReminderTime = async (reminderId: string) => {
    if (!newReminderTime) {
      toast.error('Please enter a valid time');
      return;
    }

    try {
      const [hours, minutes] = newReminderTime.split(':').map((s) => s.trim());
      const h = parseInt(hours, 10);
      const m = parseInt(minutes, 10);
      if (Number.isNaN(h) || Number.isNaN(m)) {
        toast.error('Please use HH:MM format');
        return;
      }

      const now = new Date();
      const nextReminder = new Date();
      nextReminder.setHours(h, m, 0, 0);
      if (nextReminder <= now) {
        nextReminder.setDate(nextReminder.getDate() + 1);
      }

      const { error } = await supabase
        .from('medication_reminders')
        .update({
          reminder_time: newReminderTime,
          next_reminder_at: nextReminder.toISOString(),
          is_sent: false,
        })
        .eq('id', reminderId);

      if (error) {
        console.error('Error updating reminder time:', error);
        toast.error('Failed to update reminder time');
        return;
      }

      // Update local state
      setReminders(reminders.map(r => 
        r.id === reminderId 
          ? { ...r, reminder_time: newReminderTime, next_reminder_at: nextReminder.toISOString(), is_sent: false }
          : r
      ));

      setEditingReminder(null);
      setNewReminderTime('');
      toast.success('Reminder time updated successfully');
    } catch (err) {
      console.error('Error:', err);
      toast.error('Failed to update reminder time');
    }
  };

  const isExpired = (endDate: string) => {
    return isPast(parseISO(endDate));
  };

  const downloadPrescriptionPdf = async (prescription: Prescription) => {
    try {
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const logoDataUrl = await loadMonitraqLogoDataUrl();

      doc.setFillColor(0, 10, 55);
      doc.rect(0, 0, pageW, 30, 'F');
      doc.setFillColor(0, 170, 170);
      doc.rect(0, 27, pageW, 3, 'F');
      if (logoDataUrl) {
        try {
          doc.addImage(logoDataUrl, 'PNG', 12, 7, 11, 11);
        } catch {
          // Keep going with text-only brand fallback.
        }
      }
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('Monitraq', 26, 13);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text('Digital Prescription', 26, 18);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text('PRESCRIPTION', pageW - 10, 14, { align: 'right' });

      let y = 40;
      doc.setTextColor(20, 20, 20);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.text('Patient', 12, y);
      y += 5.5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.text(`Name: ${'You'}`, 12, y);
      y += 5;
      doc.text(`Written at: ${new Date(prescription.created_at).toLocaleString()}`, 12, y);
      y += 7;

      doc.setFont('helvetica', 'bold');
      doc.text('Doctor', 12, y);
      y += 5.5;
      doc.setFont('helvetica', 'normal');
      doc.text(`Dr. ${prescription.doctor?.full_name || 'Not specified'}`, 12, y);
      y += 5;
      doc.text(`NMC No.: ${prescription.doctor?.national_medical_council_number || 'Not provided'}`, 12, y);
      y += 5;
      doc.text(`Specialty: ${prescription.doctor?.specialty || 'Not specified'}`, 12, y);
      y += 5;
      doc.text(`Hospital: ${prescription.doctor?.hospital || 'Not specified'}`, 12, y);
      y += 7;

      doc.setFillColor(235, 241, 250);
      doc.rect(12, y - 4.5, pageW - 24, 8, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.text('Medicine', 14, y);
      doc.text('Dosage', 86, y);
      doc.text('Frequency', 118, y);
      doc.text('Duration', 152, y);
      y += 6;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(doc.splitTextToSize(prescription.medication_name || '-', 68), 14, y);
      doc.text(doc.splitTextToSize(prescription.dosage || '-', 28), 86, y);
      doc.text(doc.splitTextToSize(prescription.frequency || '-', 32), 118, y);
      doc.text(`${prescription.duration_days || '-'} days`, 152, y);
      y += 8;

      if (prescription.instructions) {
        doc.setTextColor(80, 80, 80);
        const instructions = doc.splitTextToSize(`Instructions: ${prescription.instructions}`, pageW - 30);
        doc.text(instructions, 14, y);
        y += instructions.length * 4.5 + 1;
      }

      // Always place signature at bottom-right after medicine section ends.
      let signatureY = y + 12;
      if (signatureY > pageH - 28) {
        doc.addPage();
        signatureY = 30;
      }
      const signatureLineX1 = pageW - 68;
      const signatureLineX2 = pageW - 14;
      const signatureImageX = pageW - 66;

      doc.setTextColor(70, 70, 70);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.text('Doctor Signature', signatureLineX2, signatureY, { align: 'right' });
      doc.setDrawColor(130, 130, 130);
      doc.line(signatureLineX1, signatureY + 2, signatureLineX2, signatureY + 2);

      const signatureDataUrl = prescription.doctor?.signature_data_url || '';
      if (signatureDataUrl) {
        try {
          const pngSignature = await normalizeImageToPngDataUrl(signatureDataUrl);
          doc.addImage(pngSignature, 'PNG', signatureImageX, signatureY - 12, 50, 12);
        } catch {
          doc.setFontSize(7.5);
          doc.text('Signature unavailable', signatureLineX2, signatureY - 3, { align: 'right' });
        }
      } else {
        doc.setFontSize(7.5);
        doc.text('Not uploaded', signatureLineX2, signatureY - 3, { align: 'right' });
      }

      doc.setFontSize(8);
      doc.text(`Generated on ${new Date().toLocaleString()}`, pageW - 12, pageH - 8, { align: 'right' });
      doc.text('Monitraq branded prescription', 12, pageH - 8);

      const safeName = (prescription.medication_name || 'prescription').replace(/\s+/g, '-');
      doc.save(`monitraq-prescription-${safeName}.pdf`);
      toast.success('Prescription PDF downloaded');
    } catch (err: any) {
      console.error('Prescription PDF error:', err);
      toast.error('Failed to download prescription PDF');
    }
  };

  const activePrescriptions = prescriptions.filter(p => !isExpired(p.end_date));
  const expiredPrescriptions = prescriptions.filter(p => isExpired(p.end_date));

  const displayPrescriptions = activeTab === 'active' ? activePrescriptions : expiredPrescriptions;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080D1A] text-white flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080D1A] text-white font-inter select-none p-4 pt-safe-top">
      <div className="max-w-4xl mx-auto pb-20">
        {/* Standardized Header */}
        <header className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors active:scale-95 text-white"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-purple-900/70 flex items-center justify-center border border-purple-400/50">
              <Pill className="h-6 w-6 text-purple-300" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Prescriptions</h1>
              <p className="text-xs text-gray-400">View and manage your medication prescriptions</p>
            </div>
          </div>
        </header>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('active')}
            className={`flex-1 py-3 px-4 rounded-2xl font-semibold transition-all duration-300 border ${
              activeTab === 'active'
                ? 'bg-purple-500/20 text-purple-300 border-purple-500/40 shadow-sm'
                : 'bg-[#1A243D] text-gray-400 border-slate-700/40 hover:text-gray-200'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <CheckCircle className="w-5 h-5" />
              Active ({activePrescriptions.length})
            </div>
          </button>
          <button
            onClick={() => setActiveTab('expired')}
            className={`flex-1 py-3 px-4 rounded-2xl font-semibold transition-all duration-300 border ${
              activeTab === 'expired'
                ? 'bg-red-500/20 text-red-300 border-red-500/40 shadow-sm'
                : 'bg-[#1A243D] text-gray-400 border-slate-700/40 hover:text-gray-200'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Expired ({expiredPrescriptions.length})
            </div>
          </button>
        </div>

        {/* Prescriptions List */}
        {displayPrescriptions.length === 0 ? (
          <div className="bg-[#1A243D] border border-slate-700/40 rounded-3xl p-8 text-center">
            <Pill className="w-16 h-16 text-purple-400/50 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">
              {activeTab === 'active' 
                ? 'No active prescriptions'
                : 'No expired prescriptions'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {displayPrescriptions.map((prescription) => {
              const prescriptionReminders = reminders.filter(r => r.prescription_id === prescription.id);
              const hasActiveReminders = prescriptionReminders.some(r => r.is_active);
              const expired = isExpired(prescription.end_date);

              return (
                <div
                  key={prescription.id}
                  className={`bg-[#1A243D] border border-slate-700/40 shadow-sm rounded-3xl p-4 sm:p-6 transition-all duration-300 ${
                    expired
                      ? 'border-red-500/30 bg-red-500/5'
                      : 'hover:border-purple-500/30'
                  }`}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Pill className={`w-5 h-5 ${expired ? 'text-red-400' : 'text-purple-400'}`} />
                        <h3 className="text-lg font-bold text-white">{prescription.medication_name}</h3>
                      </div>
                      {prescription.doctor && (
                        <p className="text-xs text-gray-400">
                          Prescribed by Dr. {prescription.doctor.full_name}
                        </p>
                      )}
                    </div>

                    {/* Status Badges */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => downloadPrescriptionPdf(prescription)}
                        className="p-2 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-300 hover:bg-purple-500/25 transition-colors"
                        title="Download prescription PDF"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      {expired ? (
                        <div className="px-2.5 py-0.5 rounded-full bg-red-500/15 border border-red-500/30">
                          <span className="text-[10px] font-semibold text-red-300">EXPIRED</span>
                        </div>
                      ) : (
                        <div className="px-2.5 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30">
                          <span className="text-[10px] font-semibold text-purple-300">ACTIVE</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Details */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 text-sm">
                    {prescription.dosage && (
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-purple-400"></div>
                        <span className="text-gray-400">Dosage:</span>
                        <span className="text-white font-medium">{prescription.dosage}</span>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-purple-400" />
                      <span className="text-gray-400">Frequency:</span>
                      <span className="text-white font-medium">{prescription.frequency}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-purple-400" />
                      <span className="text-gray-400">Duration:</span>
                      <span className="text-white font-medium">{prescription.duration_days} days</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-purple-400" />
                      <span className="text-gray-400">End Date:</span>
                      <span className="text-white font-medium">
                        {format(parseISO(prescription.end_date), 'MMM dd, yyyy')}
                      </span>
                    </div>
                  </div>

                  {/* Instructions */}
                  {prescription.instructions && (
                    <div className="mb-4 p-3 rounded-xl bg-[#121B32] border border-slate-700/40">
                      <p className="text-[11px] text-gray-400 mb-1">Instructions:</p>
                      <p className="text-sm text-gray-200">{prescription.instructions}</p>
                    </div>
                  )}

                  {/* Reminders */}
                  {!expired && prescriptionReminders.length > 0 && (
                    <div className="pt-4 border-t border-slate-700/40">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Bell className="w-4 h-4 text-purple-400" />
                          <span className="text-sm font-semibold text-purple-300">
                            Medication Reminders
                          </span>
                        </div>

                        {/* Toggle Reminders */}
                        <button
                          onClick={() => toggleReminders(prescription.id, hasActiveReminders)}
                          className={`p-2 rounded-xl transition-all duration-300 ${
                            hasActiveReminders
                              ? 'bg-purple-500/20 text-purple-300 hover:bg-purple-500/30'
                              : 'bg-red-500/20 text-red-300 hover:bg-red-500/30'
                          }`}
                        >
                          {hasActiveReminders ? (
                            <Bell className="w-4 h-4" />
                          ) : (
                            <BellOff className="w-4 h-4" />
                          )}
                        </button>
                      </div>

                      <div className="space-y-2">
                        {prescriptionReminders.map((reminder) => (
                          <div
                            key={reminder.id}
                            className="flex items-center justify-between p-2.5 rounded-xl bg-[#121B32] border border-slate-700/40"
                          >
                            {editingReminder === reminder.id ? (
                              // Edit mode
                              <div className="flex items-center gap-2 flex-1">
                                <input
                                  type="time"
                                  value={newReminderTime}
                                  onChange={(e) => setNewReminderTime(e.target.value)}
                                  className="px-2 py-1 rounded-lg bg-[#1A243D] border border-slate-700/40 text-white text-sm"
                                />
                                <button
                                  onClick={() => updateReminderTime(reminder.id)}
                                  className="p-1 rounded-lg bg-purple-600/20 text-purple-300 hover:bg-purple-600/30"
                                >
                                  <Save className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={cancelEditingReminder}
                                  className="p-1 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              // View mode
                              <>
                                <span className="text-sm text-gray-200">
                                  {format(new Date(`2000-01-01T${reminder.reminder_time}`), 'h:mm a')}
                                </span>
                                <button
                                  onClick={() => startEditingReminder(reminder.id, reminder.reminder_time)}
                                  className="p-1.5 rounded-lg bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 transition-colors"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        ))}
                      </div>

                      <p className="text-xs text-gray-500 mt-2">
                        You'll receive notifications 30 minutes before each time. Click edit to change reminder times.
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};






















import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { Pill, Clock, Calendar, AlertCircle, CheckCircle, Bell, BellOff, ArrowLeft, Edit2, Save, X } from 'lucide-react';
import { format, isPast, parseISO } from 'date-fns';

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
  };
}

interface Reminder {
  id: string;
  prescription_id: string;
  reminder_time: string;
  is_active: boolean;
}

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
          doctor:doctors!doctor_id(full_name)
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






















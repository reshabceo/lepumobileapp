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
      const { error } = await supabase
        .from('medication_reminders')
        .update({ reminder_time: newReminderTime })
        .eq('id', reminderId);

      if (error) {
        console.error('Error updating reminder time:', error);
        toast.error('Failed to update reminder time');
        return;
      }

      // Update local state
      setReminders(reminders.map(r => 
        r.id === reminderId 
          ? { ...r, reminder_time: newReminderTime }
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
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-emerald-900 to-slate-900 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-emerald-900 to-slate-900">
      {/* Header with Back Button */}
      <div className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700">
        <div className="relative flex items-center justify-between p-4" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 px-3 py-2 text-white bg-blue-600 hover:bg-blue-700 transition-colors touch-manipulation rounded-lg"
            style={{ minHeight: '40px', minWidth: '70px' }}
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">Back</span>
          </button>
          <h1 className="absolute left-1/2 transform -translate-x-1/2 text-xl font-semibold text-white">Prescriptions</h1>
          <div className="w-16" />
        </div>
      </div>

      <div className="p-4 pb-20">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <p className="text-emerald-200/80 mt-2">View and manage your medication prescriptions</p>
          </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('active')}
            className={`flex-1 py-3 px-4 rounded-xl font-semibold transition-all duration-300 ${
              activeTab === 'active'
                ? 'bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-lg'
                : 'bg-white/10 text-emerald-200 hover:bg-white/20'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <CheckCircle className="w-5 h-5" />
              Active ({activePrescriptions.length})
            </div>
          </button>
          <button
            onClick={() => setActiveTab('expired')}
            className={`flex-1 py-3 px-4 rounded-xl font-semibold transition-all duration-300 ${
              activeTab === 'expired'
                ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-lg'
                : 'bg-white/10 text-emerald-200 hover:bg-white/20'
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
          <div className="glass-card p-8 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-center">
            <Pill className="w-16 h-16 text-emerald-400/50 mx-auto mb-4" />
            <p className="text-emerald-200/60 text-lg">
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
                  className={`glass-card p-4 sm:p-6 rounded-xl border transition-all duration-300 ${
                    expired
                      ? 'border-red-500/30 bg-red-500/10'
                      : 'border-emerald-500/30 bg-emerald-500/10 hover:border-emerald-400/50'
                  }`}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Pill className={`w-5 h-5 ${expired ? 'text-red-400' : 'text-emerald-400'}`} />
                        <h3 className="text-xl font-bold text-white">{prescription.medication_name}</h3>
                      </div>
                      {prescription.doctor && (
                        <p className="text-sm text-emerald-200/70">
                          Prescribed by Dr. {prescription.doctor.full_name}
                        </p>
                      )}
                    </div>

                    {/* Expired Badge */}
                    {expired && (
                      <div className="px-3 py-1 rounded-full bg-red-500/20 border border-red-500/30">
                        <span className="text-xs font-semibold text-red-300">EXPIRED</span>
                      </div>
                    )}

                    {/* Active Badge */}
                    {!expired && (
                      <div className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30">
                        <span className="text-xs font-semibold text-emerald-300">ACTIVE</span>
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                    {prescription.dosage && (
                      <div className="flex items-center gap-2 text-sm">
                        <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                        <span className="text-emerald-200/70">Dosage:</span>
                        <span className="text-white font-semibold">{prescription.dosage}</span>
                      </div>
                    )}

                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="w-4 h-4 text-emerald-400" />
                      <span className="text-emerald-200/70">Frequency:</span>
                      <span className="text-white font-semibold">{prescription.frequency}</span>
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="w-4 h-4 text-emerald-400" />
                      <span className="text-emerald-200/70">Duration:</span>
                      <span className="text-white font-semibold">{prescription.duration_days} days</span>
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="w-4 h-4 text-emerald-400" />
                      <span className="text-emerald-200/70">End Date:</span>
                      <span className="text-white font-semibold">
                        {format(parseISO(prescription.end_date), 'MMM dd, yyyy')}
                      </span>
                    </div>
                  </div>

                  {/* Instructions */}
                  {prescription.instructions && (
                    <div className="mb-4 p-3 rounded-lg bg-white/5 border border-white/10">
                      <p className="text-xs text-emerald-200/70 mb-1">Instructions:</p>
                      <p className="text-sm text-emerald-200/90">{prescription.instructions}</p>
                    </div>
                  )}

                  {/* Reminders */}
                  {!expired && prescriptionReminders.length > 0 && (
                    <div className="pt-4 border-t border-emerald-500/20">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Bell className="w-4 h-4 text-emerald-400" />
                          <span className="text-sm font-semibold text-emerald-200">
                            Medication Reminders
                          </span>
                        </div>

                        {/* Toggle Reminders */}
                        <button
                          onClick={() => toggleReminders(prescription.id, hasActiveReminders)}
                          className={`p-2 rounded-lg transition-all duration-300 ${
                            hasActiveReminders
                              ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                              : 'bg-red-500/20 text-red-300 hover:bg-red-500/30'
                          }`}
                        >
                          {hasActiveReminders ? (
                            <Bell className="w-5 h-5" />
                          ) : (
                            <BellOff className="w-5 h-5" />
                          )}
                        </button>
                      </div>

                      <div className="space-y-2">
                        {prescriptionReminders.map((reminder) => (
                          <div
                            key={reminder.id}
                            className="flex items-center justify-between p-2 rounded-md bg-emerald-500/10 border border-emerald-500/20"
                          >
                            {editingReminder === reminder.id ? (
                              // Edit mode
                              <div className="flex items-center gap-2 flex-1">
                                <input
                                  type="time"
                                  value={newReminderTime}
                                  onChange={(e) => setNewReminderTime(e.target.value)}
                                  className="px-2 py-1 rounded bg-emerald-950/40 border border-emerald-500/30 text-emerald-100 text-sm"
                                />
                                <button
                                  onClick={() => updateReminderTime(reminder.id)}
                                  className="p-1 rounded bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30"
                                >
                                  <Save className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={cancelEditingReminder}
                                  className="p-1 rounded bg-red-500/20 text-red-300 hover:bg-red-500/30"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              // View mode
                              <>
                                <span className="text-sm text-emerald-200">
                                  {format(new Date(`2000-01-01T${reminder.reminder_time}`), 'h:mm a')}
                                </span>
                                <button
                                  onClick={() => startEditingReminder(reminder.id, reminder.reminder_time)}
                                  className="p-1 rounded bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        ))}
                      </div>

                      <p className="text-xs text-emerald-200/60 mt-2">
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
    </div>
  );
};






















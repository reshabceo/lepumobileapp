import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Mail, Phone, Calendar, MapPin, Droplet, Heart, AlertCircle, Pill, UserCircle, LogOut, Ruler, Scale, Edit2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { toast } from 'sonner';

interface PatientProfile {
  id: string;
  full_name: string;
  email: string;
  phone_number?: string;
  date_of_birth?: string;
  gender?: string;
  address?: string;
  blood_type?: string;
  allergies?: string[];
  medical_conditions?: string[];
  current_medications?: string[];
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  profile_picture_url?: string;
  patient_code?: string;
  height_cm?: number | null;
  weight_kg?: number | null;
}

const Profile = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Modal states
  const [personalModalOpen, setPersonalModalOpen] = useState(false);
  const [medicalModalOpen, setMedicalModalOpen] = useState(false);
  const [emergencyModalOpen, setEmergencyModalOpen] = useState(false);
  const [heightModalOpen, setHeightModalOpen] = useState(false);
  const [weightModalOpen, setWeightModalOpen] = useState(false);

  // Form states
  const [personalForm, setPersonalForm] = useState({
    full_name: '',
    phone_number: '',
    date_of_birth: '',
    gender: '',
    address: ''
  });
  const [medicalForm, setMedicalForm] = useState({
    blood_type: '',
    allergies: '',
    medical_conditions: '',
    current_medications: ''
  });
  const [emergencyForm, setEmergencyForm] = useState({
    emergency_contact_name: '',
    emergency_contact_phone: ''
  });
  const [heightInput, setHeightInput] = useState('');
  const [weightInput, setWeightInput] = useState('');

  useEffect(() => {
    if (user) {
      loadProfile();
    } else {
      setLoading(false);
    }
  }, [user]);

  // Safety timeout - prevent infinite loading
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (loading) {
        console.warn('Profile loading timeout - stopping loading');
        setLoading(false);
      }
    }, 5000); // 5 second timeout

    return () => clearTimeout(timeoutId);
  }, [loading]);

  const loadProfile = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('auth_user_id', user.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          console.log('No patient profile found, showing user info only');
          setProfile(null);
          setLoading(false);
          return;
        }
        console.error('Error loading profile:', error);
        toast.error('Failed to load profile');
        setProfile(null);
        setLoading(false);
        return;
      }

      setProfile(data);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to load profile');
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Logged out successfully');
      navigate('/');
    } catch (error) {
      console.error('Logout failed:', error);
      toast.error('Failed to logout');
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Not provided';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  // Modal Open Handlers
  const handleOpenPersonalModal = () => {
    setPersonalForm({
      full_name: profile?.full_name || '',
      phone_number: profile?.phone_number || '',
      date_of_birth: profile?.date_of_birth || '',
      gender: profile?.gender || '',
      address: profile?.address || ''
    });
    setPersonalModalOpen(true);
  };

  const handleOpenMedicalModal = () => {
    setMedicalForm({
      blood_type: profile?.blood_type || '',
      allergies: profile?.allergies?.join(', ') || '',
      medical_conditions: profile?.medical_conditions?.join(', ') || '',
      current_medications: profile?.current_medications?.join(', ') || ''
    });
    setMedicalModalOpen(true);
  };

  const handleOpenEmergencyModal = () => {
    setEmergencyForm({
      emergency_contact_name: profile?.emergency_contact_name || '',
      emergency_contact_phone: profile?.emergency_contact_phone || ''
    });
    setEmergencyModalOpen(true);
  };

  const handleOpenHeightModal = () => {
    setHeightInput(profile?.height_cm?.toString() || '');
    setHeightModalOpen(true);
  };

  const handleOpenWeightModal = () => {
    setWeightInput(profile?.weight_kg?.toString() || '');
    setWeightModalOpen(true);
  };

  // Save Handlers
  const handleUpdateProfile = async (updates: Partial<PatientProfile>, successMsg: string, setModal: (open: boolean) => void) => {
    if (!user || !profile?.id) {
      toast.error('User not found');
      return;
    }

    try {
      setSaving(true);
      const { error } = await supabase
        .from('patients')
        .update(updates)
        .eq('id', profile.id);

      if (error) {
        console.error('Error updating profile:', error);
        toast.error('Failed to save changes');
        return;
      }

      setProfile({ ...profile, ...updates });
      setModal(false);
      toast.success(successMsg);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleSavePersonal = () => {
    handleUpdateProfile(personalForm, 'Personal information updated', setPersonalModalOpen);
  };

  const handleSaveMedical = () => {
    const updates = {
      blood_type: medicalForm.blood_type,
      allergies: medicalForm.allergies.split(',').map(s => s.trim()).filter(Boolean),
      medical_conditions: medicalForm.medical_conditions.split(',').map(s => s.trim()).filter(Boolean),
      current_medications: medicalForm.current_medications.split(',').map(s => s.trim()).filter(Boolean)
    };
    handleUpdateProfile(updates, 'Medical information updated', setMedicalModalOpen);
  };

  const handleSaveEmergency = () => {
    handleUpdateProfile(emergencyForm, 'Emergency contact updated', setEmergencyModalOpen);
  };

  const handleSaveHeight = () => {
    const val = parseFloat(heightInput);
    if (isNaN(val) || val <= 0 || val > 300) {
      toast.error('Enter valid height (1-300 cm)');
      return;
    }
    handleUpdateProfile({ height_cm: val }, 'Height updated', setHeightModalOpen);
  };

  const handleSaveWeight = () => {
    const val = parseFloat(weightInput);
    if (isNaN(val) || val <= 0 || val > 500) {
      toast.error('Enter valid weight (1-500 kg)');
      return;
    }
    handleUpdateProfile({ weight_kg: val }, 'Weight updated', setWeightModalOpen);
  };

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
          <h1 className="absolute left-1/2 transform -translate-x-1/2 text-xl font-semibold text-white">Profile</h1>
          <div className="w-16" />
        </div>
      </div>

      <div className="p-4 pb-20">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Profile Header Card */}
          <Card className="glass-card border-emerald-500/30 bg-emerald-500/10">
            <CardContent className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500 to-green-500 flex items-center justify-center border-4 border-emerald-400/30">
                  {profile?.profile_picture_url ? (
                    <img
                      src={profile.profile_picture_url}
                      alt={profile.full_name}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <UserCircle className="w-10 h-10 text-white" />
                  )}
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-white mb-1">{profile?.full_name || 'User'}</h2>
                  {profile?.patient_code && (
                    <p className="text-sm text-emerald-200/70">Patient ID: {profile.patient_code}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Personal Information */}
          <Card className="glass-card border-emerald-500/30 bg-emerald-500/10">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <User className="w-5 h-5 text-emerald-400" />
                  Personal Information
                </h3>
                <button
                  onClick={handleOpenPersonalModal}
                  className="p-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 transition-colors"
                >
                  <Edit2 className="w-4 h-4 text-emerald-400" />
                </button>
              </div>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Mail className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs text-emerald-200/60 mb-1">Email</p>
                    <p className="text-white">{profile?.email || user?.email || 'Not provided'}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Phone className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs text-emerald-200/60 mb-1">Phone Number</p>
                    <p className="text-white">{profile?.phone_number || 'Not provided'}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Calendar className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs text-emerald-200/60 mb-1">Date of Birth</p>
                    <p className="text-white">{profile?.date_of_birth ? formatDate(profile.date_of_birth) : 'Not provided'}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <User className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs text-emerald-200/60 mb-1">Gender</p>
                    <p className="text-white capitalize">{profile?.gender || 'Not provided'}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs text-emerald-200/60 mb-1">Address</p>
                    <p className="text-white">{profile?.address || 'Not provided'}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Physical Information */}
          <Card className="glass-card border-emerald-500/30 bg-emerald-500/10">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Ruler className="w-5 h-5 text-emerald-400" />
                Physical Information
              </h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Ruler className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs text-emerald-200/60 mb-1">Height</p>
                    <div className="flex items-center gap-2">
                      <p className="text-white">
                        {profile?.height_cm ? `${profile.height_cm} cm` : 'Not set'}
                      </p>
                      <button
                        onClick={handleOpenHeightModal}
                        className="p-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-emerald-400" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Scale className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs text-emerald-200/60 mb-1">Weight</p>
                    <div className="flex items-center gap-2">
                      <p className="text-white">
                        {profile?.weight_kg ? `${profile.weight_kg} kg` : 'Not set'}
                      </p>
                      <button
                        onClick={handleOpenWeightModal}
                        className="p-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-emerald-400" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Medical Information */}
          <Card className="glass-card border-emerald-500/30 bg-emerald-500/10">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Heart className="w-5 h-5 text-emerald-400" />
                  Medical Information
                </h3>
                <button
                  onClick={handleOpenMedicalModal}
                  className="p-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 transition-colors"
                >
                  <Edit2 className="w-4 h-4 text-emerald-400" />
                </button>
              </div>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Droplet className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs text-emerald-200/60 mb-1">Blood Type</p>
                    <p className="text-white">{profile?.blood_type || 'Not provided'}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs text-emerald-200/60 mb-1">Allergies</p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {profile?.allergies && profile.allergies.length > 0 ? (
                        profile.allergies.map((allergy, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-1 rounded-md bg-red-500/20 border border-red-500/30 text-sm text-red-200"
                          >
                            {allergy}
                          </span>
                        ))
                      ) : (
                        <p className="text-gray-400 text-sm">None reported</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Heart className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs text-emerald-200/60 mb-1">Medical Conditions</p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {profile?.medical_conditions && profile.medical_conditions.length > 0 ? (
                        profile.medical_conditions.map((condition, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-1 rounded-md bg-emerald-500/20 border border-emerald-500/30 text-sm text-emerald-200"
                          >
                            {condition}
                          </span>
                        ))
                      ) : (
                        <p className="text-gray-400 text-sm">None reported</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Pill className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs text-emerald-200/60 mb-1">Current Medications</p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {profile?.current_medications && profile.current_medications.length > 0 ? (
                        profile.current_medications.map((medication, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-1 rounded-md bg-blue-500/20 border border-blue-500/30 text-sm text-blue-200"
                          >
                            {medication}
                          </span>
                        ))
                      ) : (
                        <p className="text-gray-400 text-sm">None reported</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Emergency Contact */}
          <Card className="glass-card border-emerald-500/30 bg-emerald-500/10">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-emerald-400" />
                  Emergency Contact
                </h3>
                <button
                  onClick={handleOpenEmergencyModal}
                  className="p-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 transition-colors"
                >
                  <Edit2 className="w-4 h-4 text-emerald-400" />
                </button>
              </div>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <User className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs text-emerald-200/60 mb-1">Contact Name</p>
                    <p className="text-white">{profile?.emergency_contact_name || 'Not provided'}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Phone className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs text-emerald-200/60 mb-1">Contact Phone</p>
                    <p className="text-white">{profile?.emergency_contact_phone || 'Not provided'}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Logout Button */}
          <Card className="glass-card border-red-500/30 bg-red-500/10">
            <CardContent className="p-6">
              <Button
                onClick={handleLogout}
                className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-semibold py-6 flex items-center justify-center gap-2"
              >
                <LogOut className="w-5 h-5" />
                Sign Out
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Personal Info Modal */}
      <Dialog open={personalModalOpen} onOpenChange={setPersonalModalOpen}>
        <DialogContent className="bg-slate-900 border-emerald-500/30 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle>Personal Information</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-xs text-emerald-200/60">Full Name</label>
              <Input
                value={personalForm.full_name}
                onChange={e => setPersonalForm({...personalForm, full_name: e.target.value})}
                className="bg-slate-800 border-emerald-500/20"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-emerald-200/60">Phone Number</label>
              <Input
                value={personalForm.phone_number}
                onChange={e => setPersonalForm({...personalForm, phone_number: e.target.value})}
                className="bg-slate-800 border-emerald-500/20"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-emerald-200/60">Date of Birth</label>
              <Input
                type="date"
                value={personalForm.date_of_birth}
                onChange={e => setPersonalForm({...personalForm, date_of_birth: e.target.value})}
                className="bg-slate-800 border-emerald-500/20"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-emerald-200/60">Gender</label>
              <select
                value={personalForm.gender}
                onChange={e => setPersonalForm({...personalForm, gender: e.target.value})}
                className="w-full bg-slate-800 border border-emerald-500/20 rounded-md p-2 text-sm"
              >
                <option value="">Select Gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs text-emerald-200/60">Address</label>
              <textarea
                value={personalForm.address}
                onChange={e => setPersonalForm({...personalForm, address: e.target.value})}
                className="w-full bg-slate-800 border border-emerald-500/20 rounded-md p-2 text-sm h-20 resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPersonalModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSavePersonal} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Medical Info Modal */}
      <Dialog open={medicalModalOpen} onOpenChange={setMedicalModalOpen}>
        <DialogContent className="bg-slate-900 border-emerald-500/30 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle>Medical Information</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-xs text-emerald-200/60">Blood Type</label>
              <select
                value={medicalForm.blood_type}
                onChange={e => setMedicalForm({...medicalForm, blood_type: e.target.value})}
                className="w-full bg-slate-800 border border-emerald-500/20 rounded-md p-2 text-sm"
              >
                <option value="">Select Blood Type</option>
                {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs text-emerald-200/60">Allergies (comma separated)</label>
              <textarea
                value={medicalForm.allergies}
                onChange={e => setMedicalForm({...medicalForm, allergies: e.target.value})}
                className="w-full bg-slate-800 border border-emerald-500/20 rounded-md p-2 text-sm h-20 resize-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-emerald-200/60">Conditions (comma separated)</label>
              <textarea
                value={medicalForm.medical_conditions}
                onChange={e => setMedicalForm({...medicalForm, medical_conditions: e.target.value})}
                className="w-full bg-slate-800 border border-emerald-500/20 rounded-md p-2 text-sm h-20 resize-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-emerald-200/60">Medications (comma separated)</label>
              <textarea
                value={medicalForm.current_medications}
                onChange={e => setMedicalForm({...medicalForm, current_medications: e.target.value})}
                className="w-full bg-slate-800 border border-emerald-500/20 rounded-md p-2 text-sm h-20 resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setMedicalModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveMedical} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Emergency Contact Modal */}
      <Dialog open={emergencyModalOpen} onOpenChange={setEmergencyModalOpen}>
        <DialogContent className="bg-slate-900 border-emerald-500/30 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle>Emergency Contact</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-xs text-emerald-200/60">Contact Name</label>
              <Input
                value={emergencyForm.emergency_contact_name}
                onChange={e => setEmergencyForm({...emergencyForm, emergency_contact_name: e.target.value})}
                className="bg-slate-800 border-emerald-500/20"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-emerald-200/60">Contact Phone</label>
              <Input
                value={emergencyForm.emergency_contact_phone}
                onChange={e => setEmergencyForm({...emergencyForm, emergency_contact_phone: e.target.value})}
                className="bg-slate-800 border-emerald-500/20"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEmergencyModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveEmergency} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Height Modal */}
      <Dialog open={heightModalOpen} onOpenChange={setHeightModalOpen}>
        <DialogContent className="bg-slate-900 border-emerald-500/30 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle>Update Height</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input
              type="number"
              value={heightInput}
              onChange={e => setHeightInput(e.target.value)}
              className="bg-slate-800 border-emerald-500/20"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setHeightModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveHeight} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Weight Modal */}
      <Dialog open={weightModalOpen} onOpenChange={setWeightModalOpen}>
        <DialogContent className="bg-slate-900 border-emerald-500/30 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle>Update Weight</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input
              type="number"
              value={weightInput}
              onChange={e => setWeightInput(e.target.value)}
              className="bg-slate-800 border-emerald-500/20"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setWeightModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveWeight} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Profile;

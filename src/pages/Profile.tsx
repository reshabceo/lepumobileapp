import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Mail, Phone, Calendar, MapPin, Droplet, Heart, AlertCircle, Pill, UserCircle, LogOut, Ruler, Scale, Edit2, Crown, ExternalLink, BookOpen } from 'lucide-react';
import { ABHALinking } from '../components/ABHALinking';
import { useAuth } from '../contexts/AuthContext';
import { supabase, getPatientRiskCriteria } from '../lib/supabase';
import { useSubscriptionTier } from '@/hooks/useSubscriptionTier';
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
import { MobileAppContainer } from '../components/MobileAppContainer';

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
  abha_id?: string | null;
  abha_address?: string | null;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  profile_picture_url?: string;
  patient_code?: string;
  height_cm?: number | null;
  weight_kg?: number | null;
  category?: 'REMOTE' | 'OPD' | 'IPD' | 'ICU' | null;
  subscription_tier?: 'free' | 'monitraq_plus' | null;
  subscription_valid_until?: string | null;
}

const Profile = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { tier, validUntil, planCode, isInGrace, cancelAtPeriodEnd } = useSubscriptionTier();
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [riskCriteria, setRiskCriteria] = useState<any | null>(null);
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

  // Realtime: when the doctor edits this patient's row (medical_conditions, category,
  // allergies, etc.) we want it reflected here without a re-login or manual refresh.
  // Subscribe to `patients` UPDATE filtered by our own auth_user_id.
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`patient-self-profile:${user.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'patients', filter: `auth_user_id=eq.${user.id}` },
        () => {
          // Refresh on any change to our own row — and invalidate the localStorage cache so
          // the next mount doesn't show the pre-edit version.
          try { localStorage.removeItem(`patient_profile_${user.id}`); } catch { /* ignore */ }
          loadProfile();
        }
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

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

    const cacheKey = `patient_profile_${user.id}`;
    // Instant: show last-known cached profile so the page never sits on an empty
    // "Not provided" state while the (sometimes main-thread-blocked) fetch runs.
    let hadCache = false;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        setProfile(JSON.parse(cached));
        setLoading(false);
        hadCache = true;
      }
    } catch { /* ignore */ }

    try {
      if (!hadCache) setLoading(true);
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('auth_user_id', user.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          console.log('No patient profile found, showing user info only');
          if (!hadCache) setProfile(null);
          setLoading(false);
          return;
        }
        console.error('Error loading profile:', error);
        if (!hadCache) { toast.error('Failed to load profile'); setProfile(null); }
        setLoading(false);
        return;
      }

      setProfile(data);
      try { localStorage.setItem(cacheKey, JSON.stringify({ ...data, _cached_at: Date.now() })); } catch { /* ignore */ }

      // Load risk criteria
      const { data: riskData } = await getPatientRiskCriteria(data.id);
      if (riskData) {
        setRiskCriteria(riskData);
      }
    } catch (error) {
      console.error('Error:', error);
      if (!hadCache) { toast.error('Failed to load profile'); setProfile(null); }
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
      <div className="min-h-screen bg-[#080D1A] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <MobileAppContainer>
      <div className="min-h-screen bg-[#080D1A] text-white font-inter select-none">

        {/* Header */}
        <div className="p-4 pt-safe-top">
          <header className="flex items-center gap-3 mb-6">
            <button
              onClick={() => navigate(-1)}
              className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors active:scale-95 text-white"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-blue-900/70 flex items-center justify-center border border-blue-400/50">
                <User className="h-6 w-6 text-blue-300" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Profile</h1>
                <p className="text-xs text-gray-400">Manage your account and vitals thresholds</p>
              </div>
            </div>
          </header>
        </div>

        <div className="p-4 pb-20">
          <div className="max-w-2xl mx-auto space-y-6">
            {/* Profile Header Card */}
            <Card className="bg-[#1A243D] border border-slate-700/40 shadow-sm rounded-3xl">
              <CardContent className="p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center border-4 border-blue-400/30">
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
                      <p className="text-sm text-blue-200/70">Patient ID: {profile.patient_code}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Billing & Subscription */}
            <Card className="bg-[#1A243D] border border-slate-700/40 shadow-sm rounded-3xl">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Crown className="w-5 h-5 text-amber-300" />
                    Billing & Subscription
                  </h3>
                  <Button
                    size="sm"
                    className={`${tier === 'monitraq_plus' ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-amber-400 hover:bg-amber-300 text-black'} font-semibold`}
                    onClick={() => navigate('/subscription')}
                  >
                    {tier === 'monitraq_plus' ? 'Manage plan' : 'Upgrade plan'}
                  </Button>
                </div>
                <div className="rounded-xl border border-slate-700/50 bg-[#121B32] p-4">
                  <p className="text-xs text-slate-400 mb-1">Current plan</p>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex px-2 py-1 rounded-md text-sm font-medium border ${tier === 'monitraq_plus'
                        ? 'bg-amber-500/20 text-amber-100 border-amber-400/40'
                        : 'bg-white/5 text-slate-200 border-white/15'
                      }`}>
                      {tier === 'monitraq_plus' ? 'Monitraq+' : 'Free'}
                    </span>
                    {isInGrace && (
                      <span className="inline-flex px-2 py-1 rounded-md text-xs font-medium border bg-red-500/20 text-red-200 border-red-400/40">
                        Renewal pending
                      </span>
                    )}
                  </div>
                  <p className="text-[12px] text-slate-400 mt-2">
                    {tier === 'monitraq_plus'
                      ? `${cancelAtPeriodEnd ? 'Cancelled' : 'Active'} ${planCode ? `(${planCode.replace('monitraq_plus_', '').toUpperCase()})` : ''}${validUntil ? ` · ${cancelAtPeriodEnd ? 'Access until' : 'Valid till'} ${new Date(validUntil).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}${cancelAtPeriodEnd ? ' · Auto-renew off' : ''}`
                      : 'You are on Free plan. Upgrade to unlock premium monitoring and reports.'}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Personal Information */}
            <Card className="bg-[#1A243D] border border-slate-700/40 shadow-sm rounded-3xl">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <User className="w-5 h-5 text-blue-400" />
                    Personal Information
                  </h3>
                  <button
                    onClick={handleOpenPersonalModal}
                    className="p-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 transition-colors"
                  >
                    <Edit2 className="w-4 h-4 text-blue-400" />
                  </button>
                </div>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <Mail className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs text-slate-400 mb-1">Email</p>
                      <p className="text-white">{profile?.email || user?.email || 'Not provided'}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Phone className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs text-slate-400 mb-1">Phone Number</p>
                      <p className="text-white">{profile?.phone_number || 'Not provided'}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Calendar className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs text-slate-400 mb-1">Date of Birth</p>
                      <p className="text-white">{profile?.date_of_birth ? formatDate(profile.date_of_birth) : 'Not provided'}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <User className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs text-slate-400 mb-1">Gender</p>
                      <p className="text-white capitalize">{profile?.gender || 'Not provided'}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs text-slate-400 mb-1">Address</p>
                      <p className="text-white">{profile?.address || 'Not provided'}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Physical Information */}
            <Card className="bg-[#1A243D] border border-slate-700/40 shadow-sm rounded-3xl">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Ruler className="w-5 h-5 text-blue-400" />
                  Physical Information
                </h3>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <Ruler className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs text-slate-400 mb-1">Height</p>
                      <div className="flex items-center gap-2">
                        <p className="text-white">
                          {profile?.height_cm ? `${profile.height_cm} cm` : 'Not set'}
                        </p>
                        <button
                          onClick={handleOpenHeightModal}
                          className="p-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-blue-400" />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Scale className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs text-slate-400 mb-1">Weight</p>
                      <div className="flex items-center gap-2">
                        <p className="text-white">
                          {profile?.weight_kg ? `${profile.weight_kg} kg` : 'Not set'}
                        </p>
                        <button
                          onClick={handleOpenWeightModal}
                          className="p-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-blue-400" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Medical Information */}
            <Card className="bg-[#1A243D] border border-slate-700/40 shadow-sm rounded-3xl">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Heart className="w-5 h-5 text-blue-400" />
                    Medical Information
                  </h3>
                  <button
                    onClick={handleOpenMedicalModal}
                    className="p-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 transition-colors"
                  >
                    <Edit2 className="w-4 h-4 text-blue-400" />
                  </button>
                </div>
                <div className="space-y-3">
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Information below is entered by you or your care team. It is not a diagnosis.
                    {' '}
                    <button
                      type="button"
                      onClick={() => navigate('/medical-disclaimer')}
                      className="text-blue-400 underline underline-offset-2 hover:text-blue-300"
                    >
                      Medical Disclaimer
                    </button>
                  </p>
                  {/* Care setting — set at signup; only your doctor can change it. */}
                  <div className="flex items-start gap-3">
                    <Heart className="w-5 h-5 text-violet-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs text-slate-400 mb-1">Care Setting</p>
                      {(() => {
                        const cat = (profile?.category || 'REMOTE') as 'REMOTE' | 'OPD' | 'IPD' | 'ICU';
                        const style: Record<string, string> = {
                          ICU: 'bg-red-500/20 text-red-200 border-red-400/40',
                          IPD: 'bg-orange-500/20 text-orange-200 border-orange-400/40',
                          OPD: 'bg-sky-500/15 text-sky-200 border-sky-400/40',
                          REMOTE: 'bg-violet-500/15 text-violet-200 border-violet-400/40',
                        };
                        const label = cat === 'REMOTE' ? 'Remote monitoring' : cat;
                        return (
                          <>
                            <span className={`inline-flex px-2 py-1 rounded-md text-sm font-medium border ${style[cat]}`}>
                              {label}
                            </span>
                            <p className="text-[11px] text-slate-500 mt-1">
                              Your doctor can change this. You can't.
                            </p>
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Droplet className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs text-slate-400 mb-1">Blood Type</p>
                      <p className="text-white">{profile?.blood_type || 'Not provided'}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs text-slate-400 mb-1">Allergies</p>
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
                    <Heart className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs text-slate-400 mb-1">Medical Conditions</p>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {profile?.medical_conditions && profile.medical_conditions.length > 0 ? (
                          profile.medical_conditions.map((condition, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-1 rounded-md bg-blue-500/20 border border-blue-500/30 text-sm text-blue-200"
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
                    <Pill className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs text-slate-400 mb-1">Current Medications</p>
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

            {/* Vital High Risk Section */}
            <Card className="bg-[#1A243D] border border-red-500/30 shadow-sm rounded-3xl">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-400" />
                  Vital High Risk Thresholds
                </h3>
                <p className="text-[11px] text-slate-400 mb-4 leading-relaxed">
                  {riskCriteria
                    ? 'Limits set by your assigned doctor for remote monitoring alerts.'
                    : 'Default monitoring limits shown until your doctor sets custom values.'}
                  {' '}These are alert thresholds, not medical advice.
                </p>
                <div className="space-y-4">
                  {riskCriteria ? (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-[#121B32] p-3 rounded-lg border border-red-500/20">
                          <p className="text-xs text-red-200/60 mb-1">Blood Pressure</p>
                          <p className="text-white font-medium">
                            &gt;{riskCriteria.systolic_high || 140}/{riskCriteria.diastolic_high || 90} mmHg
                          </p>
                        </div>
                        <div className="bg-[#121B32] p-3 rounded-lg border border-red-500/20">
                          <p className="text-xs text-red-200/60 mb-1">Heart Rate</p>
                          <p className="text-white font-medium">
                            &gt;{riskCriteria.heart_rate_high || 100} BPM
                          </p>
                        </div>
                        <div className="bg-[#121B32] p-3 rounded-lg border border-red-500/20">
                          <p className="text-xs text-red-200/60 mb-1">SpO2</p>
                          <p className="text-white font-medium">
                            &lt;{riskCriteria.spo2_low || 95}%
                          </p>
                        </div>
                        <div className="bg-[#121B32] p-3 rounded-lg border border-red-500/20">
                          <p className="text-xs text-red-200/60 mb-1">Risk Status</p>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${riskCriteria.is_high_risk ? 'bg-red-500 text-white' : 'bg-green-500 text-white'
                            }`}>
                            {riskCriteria.is_high_risk ? 'HIGH RISK' : 'STABLE'}
                          </span>
                        </div>
                      </div>
                      {riskCriteria.doctor_notes && (
                        <div className="bg-red-500/5 border border-red-500/20 p-3 rounded-lg">
                          <p className="text-xs text-red-200/60 mb-1">Doctor's Risk Notes</p>
                          <p className="text-sm text-white italic">"{riskCriteria.doctor_notes}"</p>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-[#121B32] p-3 rounded-lg border border-red-500/20">
                          <p className="text-xs text-red-200/60 mb-1">Blood Pressure (default)</p>
                          <p className="text-white font-medium">&gt;140/90 mmHg</p>
                        </div>
                        <div className="bg-[#121B32] p-3 rounded-lg border border-red-500/20">
                          <p className="text-xs text-red-200/60 mb-1">Heart Rate (default)</p>
                          <p className="text-white font-medium">&gt;100 BPM</p>
                        </div>
                        <div className="bg-[#121B32] p-3 rounded-lg border border-red-500/20">
                          <p className="text-xs text-red-200/60 mb-1">SpO2 (default)</p>
                          <p className="text-white font-medium">&lt;95%</p>
                        </div>
                      </div>
                      <div className="text-center py-2">
                        <p className="text-sm text-gray-400 italic">No custom risk criteria set by doctor yet.</p>
                      </div>
                    </>
                  )}

                  {/* Medical source citations — Guideline 1.4.1 */}
                  <div className="bg-[#121B32] border border-slate-700/40 rounded-xl p-4 space-y-2">
                    <div className="flex items-center gap-2 text-slate-300">
                      <BookOpen className="w-4 h-4 text-blue-400 shrink-0" />
                      <p className="text-xs font-semibold uppercase tracking-wide">Sources & References</p>
                    </div>
                    <ul className="text-[11px] text-slate-400 space-y-2 leading-relaxed">
                      <li>
                        <span className="text-slate-300">Blood pressure (140/90 mmHg default):</span>{' '}
                        American Heart Association —{' '}
                        <a
                          href="https://www.heart.org/en/health-topics/high-blood-pressure/understanding-blood-pressure-readings"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 inline-flex items-center gap-0.5 hover:text-blue-300"
                        >
                          Understanding Blood Pressure Readings <ExternalLink className="w-3 h-3" />
                        </a>
                      </li>
                      <li>
                        <span className="text-slate-300">Heart rate (&gt;100 BPM default):</span>{' '}
                        American Heart Association —{' '}
                        <a
                          href="https://www.heart.org/en/health-topics/arrhythmia/about-arrhythmia/tachycardia"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 inline-flex items-center gap-0.5 hover:text-blue-300"
                        >
                          Tachycardia (fast heart rate) <ExternalLink className="w-3 h-3" />
                        </a>
                      </li>
                      <li>
                        <span className="text-slate-300">SpO2 (&lt;95% default):</span>{' '}
                        WHO —{' '}
                        <a
                          href="https://www.who.int/health-topics/pulse-oximetry"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 inline-flex items-center gap-0.5 hover:text-blue-300"
                        >
                          Pulse Oximetry <ExternalLink className="w-3 h-3" />
                        </a>
                      </li>
                    </ul>
                    <button
                      type="button"
                      onClick={() => navigate('/medical-disclaimer')}
                      className="text-[11px] text-blue-400 underline underline-offset-2 hover:text-blue-300"
                    >
                      View full Medical Disclaimer & device regulatory information
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Emergency Contact */}
            <Card className="bg-[#1A243D] border border-slate-700/40 shadow-sm rounded-3xl">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-blue-400" />
                    Emergency Contact
                  </h3>
                  <button
                    onClick={handleOpenEmergencyModal}
                    className="p-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 transition-colors"
                  >
                    <Edit2 className="w-4 h-4 text-blue-400" />
                  </button>
                </div>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <User className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs text-slate-400 mb-1">Contact Name</p>
                      <p className="text-white">{profile?.emergency_contact_name || 'Not provided'}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Phone className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs text-slate-400 mb-1">Contact Phone</p>
                      <p className="text-white">{profile?.emergency_contact_phone || 'Not provided'}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Logout Button */}
            <Card className="bg-[#1A243D] border border-slate-700/40 shadow-sm rounded-3xl">
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
          <DialogContent className="bg-[#1A243D] border border-slate-700/40 text-white max-w-sm rounded-3xl">
            <DialogHeader>
              <DialogTitle>Personal Information</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-xs text-slate-400">Full Name</label>
                <Input
                  value={personalForm.full_name}
                  onChange={e => setPersonalForm({ ...personalForm, full_name: e.target.value })}
                  className="bg-[#121B32] border border-slate-700/40 text-white placeholder-gray-500 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-slate-400">Phone Number</label>
                <Input
                  value={personalForm.phone_number}
                  onChange={e => setPersonalForm({ ...personalForm, phone_number: e.target.value })}
                  className="bg-[#121B32] border border-slate-700/40 text-white placeholder-gray-500 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-slate-400">Date of Birth</label>
                <Input
                  type="date"
                  value={personalForm.date_of_birth}
                  onChange={e => setPersonalForm({ ...personalForm, date_of_birth: e.target.value })}
                  className="bg-[#121B32] border border-slate-700/40 text-white placeholder-gray-500 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-slate-400">Gender</label>
                <select
                  value={personalForm.gender}
                  onChange={e => setPersonalForm({ ...personalForm, gender: e.target.value })}
                  className="w-full bg-[#121B32] border border-slate-700/40 text-white rounded-xl p-2.5 text-sm"
                >
                  <option value="">Select Gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs text-slate-400">Address</label>
                <textarea
                  value={personalForm.address}
                  onChange={e => setPersonalForm({ ...personalForm, address: e.target.value })}
                  className="w-full bg-[#121B32] border border-slate-700/40 text-white rounded-xl p-2.5 text-sm h-20 resize-none"
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
          <DialogContent className="bg-[#1A243D] border border-slate-700/40 text-white max-w-sm rounded-3xl">
            <DialogHeader>
              <DialogTitle>Medical Information</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-xs text-slate-400">Blood Type</label>
                <select
                  value={medicalForm.blood_type}
                  onChange={e => setMedicalForm({ ...medicalForm, blood_type: e.target.value })}
                  className="w-full bg-[#121B32] border border-slate-700/40 text-white rounded-xl p-2.5 text-sm"
                >
                  <option value="">Select Blood Type</option>
                  {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs text-slate-400">Allergies (comma separated)</label>
                <textarea
                  value={medicalForm.allergies}
                  onChange={e => setMedicalForm({ ...medicalForm, allergies: e.target.value })}
                  className="w-full bg-[#121B32] border border-slate-700/40 text-white rounded-xl p-2.5 text-sm h-20 resize-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-slate-400">Conditions (comma separated)</label>
                <textarea
                  value={medicalForm.medical_conditions}
                  onChange={e => setMedicalForm({ ...medicalForm, medical_conditions: e.target.value })}
                  className="w-full bg-[#121B32] border border-slate-700/40 text-white rounded-xl p-2.5 text-sm h-20 resize-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-slate-400">Medications (comma separated)</label>
                <textarea
                  value={medicalForm.current_medications}
                  onChange={e => setMedicalForm({ ...medicalForm, current_medications: e.target.value })}
                  className="w-full bg-[#121B32] border border-slate-700/40 text-white rounded-xl p-2.5 text-sm h-20 resize-none"
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
          <DialogContent className="bg-[#1A243D] border border-slate-700/40 text-white max-w-sm rounded-3xl">
            <DialogHeader>
              <DialogTitle>Emergency Contact</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-xs text-slate-400">Contact Name</label>
                <Input
                  value={emergencyForm.emergency_contact_name}
                  onChange={e => setEmergencyForm({ ...emergencyForm, emergency_contact_name: e.target.value })}
                  className="bg-[#121B32] border border-slate-700/40 text-white placeholder-gray-500 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-slate-400">Contact Phone</label>
                <Input
                  value={emergencyForm.emergency_contact_phone}
                  onChange={e => setEmergencyForm({ ...emergencyForm, emergency_contact_phone: e.target.value })}
                  className="bg-[#121B32] border border-slate-700/40 text-white placeholder-gray-500 rounded-xl"
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
          <DialogContent className="bg-[#1A243D] border border-slate-700/40 text-white max-w-sm rounded-3xl">
            <DialogHeader>
              <DialogTitle>Update Height</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Input
                type="number"
                value={heightInput}
                onChange={e => setHeightInput(e.target.value)}
                className="bg-[#121B32] border border-slate-700/40 text-white placeholder-gray-500 rounded-xl"
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
          <DialogContent className="bg-[#1A243D] border border-slate-700/40 text-white max-w-sm rounded-3xl">
            <DialogHeader>
              <DialogTitle>Update Weight</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Input
                type="number"
                value={weightInput}
                onChange={e => setWeightInput(e.target.value)}
                className="bg-[#121B32] border border-slate-700/40 text-white placeholder-gray-500 rounded-xl"
              />
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setWeightModalOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveWeight} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MobileAppContainer>
  );
};

export default Profile;

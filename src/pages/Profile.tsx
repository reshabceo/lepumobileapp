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
  const [heightModalOpen, setHeightModalOpen] = useState(false);
  const [weightModalOpen, setWeightModalOpen] = useState(false);
  const [heightInput, setHeightInput] = useState('');
  const [weightInput, setWeightInput] = useState('');
  const [saving, setSaving] = useState(false);

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
        // Handle "not found" error gracefully - user might not have patient profile yet
        if (error.code === 'PGRST116') {
          console.log('No patient profile found, showing user info only');
          // Set profile to null but still show the page with user email
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

  const handleOpenHeightModal = () => {
    setHeightInput(profile?.height_cm?.toString() || '');
    setHeightModalOpen(true);
  };

  const handleOpenWeightModal = () => {
    setWeightInput(profile?.weight_kg?.toString() || '');
    setWeightModalOpen(true);
  };

  const handleSaveHeight = async () => {
    if (!user || !profile?.id) {
      toast.error('User not found');
      return;
    }

    const heightValue = parseFloat(heightInput);
    if (isNaN(heightValue) || heightValue <= 0 || heightValue > 300) {
      toast.error('Please enter a valid height between 1-300 cm');
      return;
    }

    try {
      setSaving(true);
      const { error } = await supabase
        .from('patients')
        .update({ height_cm: heightValue })
        .eq('id', profile.id);

      if (error) {
        console.error('Error updating height:', error);
        toast.error('Failed to save height');
        return;
      }

      setProfile({ ...profile, height_cm: heightValue });
      setHeightModalOpen(false);
      toast.success('Height saved successfully');
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to save height');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveWeight = async () => {
    if (!user || !profile?.id) {
      toast.error('User not found');
      return;
    }

    const weightValue = parseFloat(weightInput);
    if (isNaN(weightValue) || weightValue <= 0 || weightValue > 500) {
      toast.error('Please enter a valid weight between 1-500 kg');
      return;
    }

    try {
      setSaving(true);
      const { error } = await supabase
        .from('patients')
        .update({ weight_kg: weightValue })
        .eq('id', profile.id);

      if (error) {
        console.error('Error updating weight:', error);
        toast.error('Failed to save weight');
        return;
      }

      setProfile({ ...profile, weight_kg: weightValue });
      setWeightModalOpen(false);
      toast.success('Weight saved successfully');
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to save weight');
    } finally {
      setSaving(false);
    }
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
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-emerald-400" />
                Personal Information
              </h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Mail className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs text-emerald-200/60 mb-1">Email</p>
                    <p className="text-white">{profile?.email || user?.email || 'Not provided'}</p>
                  </div>
                </div>

                {profile?.phone_number && (
                  <div className="flex items-start gap-3">
                    <Phone className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs text-emerald-200/60 mb-1">Phone Number</p>
                      <p className="text-white">{profile.phone_number}</p>
                    </div>
                  </div>
                )}

                {profile?.date_of_birth && (
                  <div className="flex items-start gap-3">
                    <Calendar className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs text-emerald-200/60 mb-1">Date of Birth</p>
                      <p className="text-white">{formatDate(profile.date_of_birth)}</p>
                    </div>
                  </div>
                )}

                {profile?.gender && (
                  <div className="flex items-start gap-3">
                    <User className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs text-emerald-200/60 mb-1">Gender</p>
                      <p className="text-white capitalize">{profile.gender}</p>
                    </div>
                  </div>
                )}

                {profile?.address && (
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs text-emerald-200/60 mb-1">Address</p>
                      <p className="text-white">{profile.address}</p>
                    </div>
                  </div>
                )}
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
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Heart className="w-5 h-5 text-emerald-400" />
                Medical Information
              </h3>
              <div className="space-y-3">
                {profile?.blood_type && (
                  <div className="flex items-start gap-3">
                    <Droplet className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs text-emerald-200/60 mb-1">Blood Type</p>
                      <p className="text-white">{profile.blood_type}</p>
                    </div>
                  </div>
                )}

                {profile?.allergies && profile.allergies.length > 0 && (
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs text-emerald-200/60 mb-1">Allergies</p>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {profile.allergies.map((allergy, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-1 rounded-md bg-red-500/20 border border-red-500/30 text-sm text-red-200"
                          >
                            {allergy}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {profile?.medical_conditions && profile.medical_conditions.length > 0 && (
                  <div className="flex items-start gap-3">
                    <Heart className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs text-emerald-200/60 mb-1">Medical Conditions</p>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {profile.medical_conditions.map((condition, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-1 rounded-md bg-emerald-500/20 border border-emerald-500/30 text-sm text-emerald-200"
                          >
                            {condition}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {profile?.current_medications && profile.current_medications.length > 0 && (
                  <div className="flex items-start gap-3">
                    <Pill className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs text-emerald-200/60 mb-1">Current Medications</p>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {profile.current_medications.map((medication, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-1 rounded-md bg-blue-500/20 border border-blue-500/30 text-sm text-blue-200"
                          >
                            {medication}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Emergency Contact */}
          {(profile?.emergency_contact_name || profile?.emergency_contact_phone) && (
            <Card className="glass-card border-emerald-500/30 bg-emerald-500/10">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-emerald-400" />
                  Emergency Contact
                </h3>
                <div className="space-y-3">
                  {profile.emergency_contact_name && (
                    <div className="flex items-start gap-3">
                      <User className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs text-emerald-200/60 mb-1">Contact Name</p>
                        <p className="text-white">{profile.emergency_contact_name}</p>
                      </div>
                    </div>
                  )}

                  {profile.emergency_contact_phone && (
                    <div className="flex items-start gap-3">
                      <Phone className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs text-emerald-200/60 mb-1">Contact Phone</p>
                        <p className="text-white">{profile.emergency_contact_phone}</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

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

      {/* Height Modal */}
      <Dialog open={heightModalOpen} onOpenChange={setHeightModalOpen}>
        <DialogContent className="bg-gradient-to-br from-slate-900 via-emerald-900 to-slate-900 border-emerald-500/30 text-white">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Ruler className="w-5 h-5 text-emerald-400" />
              Update Height
            </DialogTitle>
            <DialogDescription className="text-emerald-200/70">
              Enter your height in centimeters (cm)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium text-emerald-200/80 mb-2 block">
                Height (cm)
              </label>
              <Input
                type="number"
                placeholder="e.g., 175"
                value={heightInput}
                onChange={(e) => setHeightInput(e.target.value)}
                className="bg-slate-800/50 border-emerald-500/30 text-white placeholder:text-emerald-300/50 focus:border-emerald-400"
                min="1"
                max="300"
                step="0.1"
              />
              <p className="text-xs text-emerald-200/60 mt-2">
                Enter a value between 1-300 cm
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setHeightModalOpen(false)}
              className="border-emerald-500/30 text-emerald-200 hover:bg-emerald-500/20"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveHeight}
              disabled={saving || !heightInput}
              className="bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white"
            >
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Weight Modal */}
      <Dialog open={weightModalOpen} onOpenChange={setWeightModalOpen}>
        <DialogContent className="bg-gradient-to-br from-slate-900 via-emerald-900 to-slate-900 border-emerald-500/30 text-white">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Scale className="w-5 h-5 text-emerald-400" />
              Update Weight
            </DialogTitle>
            <DialogDescription className="text-emerald-200/70">
              Enter your weight in kilograms (kg)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium text-emerald-200/80 mb-2 block">
                Weight (kg)
              </label>
              <Input
                type="number"
                placeholder="e.g., 70"
                value={weightInput}
                onChange={(e) => setWeightInput(e.target.value)}
                className="bg-slate-800/50 border-emerald-500/30 text-white placeholder:text-emerald-300/50 focus:border-emerald-400"
                min="1"
                max="500"
                step="0.1"
              />
              <p className="text-xs text-emerald-200/60 mt-2">
                Enter a value between 1-500 kg
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setWeightModalOpen(false)}
              className="border-emerald-500/30 text-emerald-200 hover:bg-emerald-500/20"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveWeight}
              disabled={saving || !weightInput}
              className="bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white"
            >
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Profile;

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import PatientWebRTCInterface from './PatientWebRTCInterface';

export const GlobalPatientWebRTC: React.FC = () => {
  const { user } = useAuth();
  const [patientId, setPatientId] = useState<string | null>(null);

  // Get patient ID from auth user
  useEffect(() => {
    if (!user?.id) return;
    
    const getPatientId = async () => {
      const { data, error } = await supabase
        .from('patients')
        .select('id')
        .eq('auth_user_id', user.id)
        .single();
      
      if (error) {
        console.error('[GlobalPatientWebRTC] Failed to get patient ID:', error);
        return;
      }
      
      if (data) {
        setPatientId(data.id);
      }
    };
    
    getPatientId();
  }, [user?.id]);

  if (!patientId) {
    return null;
  }

  return <PatientWebRTCInterface patientId={patientId} />;
};

export default GlobalPatientWebRTC;

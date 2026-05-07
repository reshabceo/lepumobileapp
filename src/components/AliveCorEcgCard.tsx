import React, { useCallback, useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import {
  getAliveCorToken,
  storeAliveCorRecording,
  supabase,
  triggerEcgAiAnalysis,
} from '@/lib/supabase';
import { buildAliveCorIngestPayload } from '@/lib/aliveCorKardia';
import { aliveCorSDK } from '@/lib/alivecor-sdk-bridge';
import { useToast } from '@/hooks/use-toast';
import { Activity, Stethoscope } from 'lucide-react';

/**
 * Kardia / AliveCor recording entry on ECG screen (native iOS & Android only).
 */
export const AliveCorEcgCard: React.FC = () => {
  const { toast } = useToast();
  const [patientId, setPatientId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const native = Capacitor.isNativePlatform();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { data: row } = await supabase
        .from('patients')
        .select('id')
        .eq('auth_user_id', user.id)
        .maybeSingle();
      if (!cancelled) setPatientId(row?.id ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onRecord = useCallback(async () => {
    if (!patientId) {
      toast({
        title: 'Patient profile required',
        description: 'Complete onboarding so a patient record is linked to your account.',
        variant: 'destructive',
      });
      return;
    }
    if (!native) {
      toast({
        title: 'Available on device',
        description:
          'AliveCor runs in the iOS/Android app. Build with Capacitor and ensure the native SDK is linked.',
      });
      return;
    }

    setBusy(true);
    try {
      const jwt = await getAliveCorToken(patientId);
      await aliveCorSDK.initialize(jwt, import.meta.env.DEV);
      const result = await aliveCorSDK.startSixLeadRecording({
        jwt,
        mainsFrequencyHz: 50,
        patientId,
      });
      const payload = buildAliveCorIngestPayload(patientId, result);
      const stored = await storeAliveCorRecording(payload);
      if (stored?.id) {
        triggerEcgAiAnalysis(stored.id);
      }
      toast({
        title: 'ECG saved',
        description: 'Your Kardia recording is available in the doctor dashboard.',
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({
        title: 'Kardia recording failed',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  }, [native, patientId, toast]);

  return (
    <div
      className="rounded-2xl p-4 mb-4"
      style={{
        background: 'rgba(6, 78, 59, 0.25)',
        border: '1px solid rgba(52, 211, 153, 0.35)',
        backdropFilter: 'blur(10px)',
      }}
    >
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-full bg-emerald-600/80 flex items-center justify-center">
          <Stethoscope className="h-5 w-5 text-white" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-white">Kardia (AliveCor)</h3>
          <p className="text-xs text-gray-400">
            Six-lead recording · same Supabase account as clinic dashboard
          </p>
        </div>
      </div>
      {!native && (
        <p className="text-sm text-amber-200/90 mb-3">
          Open this screen in the installed iOS/Android app after native SDK setup.
        </p>
      )}
      <button
        type="button"
        onClick={onRecord}
        disabled={busy || !patientId}
        className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium touch-manipulation"
        style={{ minHeight: 48 }}
      >
        {busy ? (
          <>
            <Activity className="h-5 w-5 animate-spin" />
            Recording / uploading…
          </>
        ) : (
          <>
            <Activity className="h-5 w-5" />
            Record with Kardia device
          </>
        )}
      </button>
    </div>
  );
};

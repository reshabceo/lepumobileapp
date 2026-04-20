import type { AliveCorEcgData } from '@/lib/supabase';
import type { AliveCorEcgResult } from '@/plugins/alivecor';

/**
 * Map native AliveCor plugin result → FastAPI ingest body.
 * If the plugin later returns per-lead arrays, pass them through as waveform_leads.
 */
export function buildAliveCorIngestPayload(
  patientId: string,
  result: AliveCorEcgResult
): AliveCorEcgData {
  const leads = result.waveformLeads;
  if (leads && Object.keys(leads).length >= 2) {
    return {
      patient_id: patientId,
      waveform_leads: leads,
      sample_rate: result.sampleRate,
      duration_seconds: result.durationSeconds,
      heart_rate: result.heartRate || undefined,
      quality_score: result.qualityScore,
      determination: result.determination,
      modifier: result.modifier,
      algorithm_package: result.algorithmPackage,
      lead_config: result.leadConfig?.toLowerCase().includes('single')
        ? 'single'
        : 'six',
      device_type: result.deviceType,
      is_inverted: result.isInverted,
      raw_sdk_response: result.rawResponse
        ? { raw: result.rawResponse }
        : undefined,
      notes: 'AliveCor Kardia recording',
    };
  }

  const mv = result.mvData || [];
  const six =
    String(result.leadConfig || '')
      .toLowerCase()
      .includes('six') &&
    mv.length % 6 === 0 &&
    mv.length >= 18;

  return {
    patient_id: patientId,
    waveform_mv: mv,
    sample_rate: result.sampleRate,
    duration_seconds: result.durationSeconds,
    heart_rate: result.heartRate || undefined,
    quality_score: result.qualityScore,
    determination: result.determination,
    modifier: result.modifier,
    algorithm_package: result.algorithmPackage,
    lead_config: six ? 'six' : 'single',
    device_type: result.deviceType,
    is_inverted: result.isInverted,
    raw_sdk_response: result.rawResponse
      ? { raw: result.rawResponse }
      : undefined,
    notes: 'AliveCor Kardia recording',
  };
}

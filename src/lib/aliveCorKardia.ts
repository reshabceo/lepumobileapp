import type { AliveCorEcgData } from '@/lib/supabase';
import type { AliveCorEcgResult } from '@/plugins/alivecor';

/**
 * Map native AliveCor plugin result → FastAPI ingest body.
 * If the plugin returns per-lead arrays, pass them through as waveform_leads.
 *
 * IMPORTANT: When the ATCReader native JNI library is unavailable
 * (UnsatisfiedLinkError), extractWaveformFromAtc() silently fails and both
 * waveformLeads and mvData will be empty/undefined.  In that case we return
 * a metadata-only payload (no waveform fields).  storeAliveCorRecording()
 * detects this and injects a zero-filled placeholder strip so the backend
 * schema constraint is satisfied while still persisting the clinically
 * meaningful data (BPM, determination, recordedAt, etc.).
 */
export function buildAliveCorIngestPayload(
  patientId: string,
  result: AliveCorEcgResult
): AliveCorEcgData {
  const leads = result.waveformLeads;

  // ── Case 1: Full multi-lead waveform available ─────────────────────────────
  if (leads && Object.keys(leads).length >= 2) {
    const leadNames = ['I', 'II', 'III', 'aVR', 'aVL', 'aVF'];
    const leadArrays = leadNames.map((name) => leads[name] || []);
    const minLength = Math.min(...leadArrays.map((arr) => arr.length));

    const interleaved: number[] = [];
    for (let i = 0; i < minLength; i++) {
      for (let j = 0; j < 6; j++) {
        interleaved.push(leadArrays[j][i]);
      }
    }

    return {
      patient_id: patientId,
      waveform_mv: interleaved,
      sample_rate: result.sampleRate || 300,
      duration_seconds: result.durationSeconds || 30,
      heart_rate: result.heartRate || undefined,
      quality_score: result.qualityScore,
      determination: result.determination,
      modifier: result.modifier,
      algorithm_package: result.algorithmPackage,
      lead_config: 'six',
      device_type: result.deviceType,
      is_inverted: result.isInverted,
      raw_sdk_response: result.rawResponse ? { raw: result.rawResponse } : undefined,
      notes: 'AliveCor Kardia recording (interleaved 6-lead)',
    };
  }

  const mv = result.mvData || [];

  // ── Case 2: No waveform data (ATCReader JNI unavailable) ──────────────────
  // storeAliveCorRecording() will inject a zero-filled placeholder strip.
  if (mv.length === 0) {
    console.warn(
      '[buildAliveCorIngestPayload] No waveform data in result — metadata-only payload. ' +
      'This is expected when the ATCReader JNI library is not loaded (UnsatisfiedLinkError).'
    );
    return {
      patient_id: patientId,
      // Deliberately omit waveform_mv and waveform_leads.
      // storeAliveCorRecording() detects this and injects a placeholder strip.
      sample_rate: result.sampleRate && result.sampleRate > 0 ? result.sampleRate : 300,
      duration_seconds: result.durationSeconds && result.durationSeconds > 0 ? result.durationSeconds : 30,
      heart_rate: result.heartRate || undefined,
      quality_score: result.qualityScore,
      determination: result.determination,
      modifier: result.modifier,
      algorithm_package: result.algorithmPackage,
      lead_config: 'six',
      device_type: result.deviceType,
      is_inverted: result.isInverted,
      raw_sdk_response: result.rawResponse ? { raw: result.rawResponse } : undefined,
      notes: 'AliveCor Kardia recording (waveform unavailable — ATCReader JNI not loaded)',
    } as AliveCorEcgData;
  }

  // ── Case 3: Flat interleaved mv strip available ────────────────────────────
  const six =
    String(result.leadConfig || '').toLowerCase().includes('six') &&
    mv.length % 6 === 0 &&
    mv.length >= 18;

  return {
    patient_id: patientId,
    waveform_mv: mv,
    sample_rate: result.sampleRate || 300,
    duration_seconds: result.durationSeconds || 30,
    heart_rate: result.heartRate || undefined,
    quality_score: result.qualityScore,
    determination: result.determination,
    modifier: result.modifier,
    algorithm_package: result.algorithmPackage,
    lead_config: six ? 'six' : 'single',
    device_type: result.deviceType,
    is_inverted: result.isInverted,
    raw_sdk_response: result.rawResponse ? { raw: result.rawResponse } : undefined,
    notes: 'AliveCor Kardia recording',
  };
}

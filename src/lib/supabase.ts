import { createClient, processLock } from '@supabase/supabase-js'
import { Capacitor, CapacitorHttp } from '@capacitor/core'

// Get environment variables
// Export Supabase credentials for direct REST uploads when needed (e.g., native file uploads)
export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Validate environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase environment variables:')
  console.error('VITE_SUPABASE_URL:', supabaseUrl)
  console.error('VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? '***' : 'missing')
  throw new Error('Missing Supabase environment variables. Please check your .env.local file.')
}

console.log('🔍 Supabase Debug - URL:', supabaseUrl)
console.log('🔍 Supabase Debug - Anon Key:', supabaseAnonKey.substring(0, 20) + '...')

// Hardened fetch: no Supabase request can hang forever. The DB/API are fast
// (verified ~0.1ms / ~90ms), but the JS client occasionally stalls a request in
// its pipeline → the UI gets stuck loading with no error until a full reload.
// This aborts any request that stalls past the timeout and retries idempotent
// (GET/HEAD) requests once, so the app self-recovers instead of freezing.
// Storage requests (large DICOM / report uploads) are exempt.
const SUPABASE_FETCH_TIMEOUT_MS = 20000
const fetchWithTimeout: typeof fetch = async (input, init) => {
  const url =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : (input as Request).url

  // Don't time out storage uploads/downloads — medical files can be large/slow.
  if (url && url.includes('/storage/v1/')) {
    return fetch(input as any, init)
  }

  const method = (init?.method || 'GET').toUpperCase()
  const isIdempotent = method === 'GET' || method === 'HEAD'

  const run = async (): Promise<Response> => {
    const controller = new AbortController()
    let timeoutId: NodeJS.Timeout

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        controller.abort() // Attempt standard abort signal abort
        const abortError = typeof DOMException !== 'undefined'
          ? new DOMException('The user aborted a request.', 'AbortError')
          : new Error('The user aborted a request.');
        (abortError as any).name = 'AbortError';
        reject(abortError);
      }, SUPABASE_FETCH_TIMEOUT_MS)
    })

    // Respect caller-provided signal
    if (init?.signal) {
      if (init.signal.aborted) controller.abort()
      else init.signal.addEventListener('abort', () => controller.abort(), { once: true })
    }

    const fetchPromise = (async () => {
      try {
        return await fetch(input as RequestInfo, { ...init, signal: controller.signal })
      } finally {
        clearTimeout(timeoutId)
      }
    })()

    return Promise.race([fetchPromise, timeoutPromise])
  }

  try {
    return await run()
  } catch (err) {
    // Retry GET/HEAD once on abort/network error; never auto-retry writes.
    if (isIdempotent) {
      console.warn('⚠️ [Supabase] request stalled/aborted — retrying once')
      return await run()
    }
    throw err
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // CRITICAL: use the in-memory processLock, NOT the default navigator.locks.
    // The Web Locks API deadlocks in long-lived tabs / mobile webviews — a lock held
    // by a throttled or destroyed context is never released, so every getSession (and
    // therefore every query) blocks forever and the whole app freezes until a hard
    // reload. processLock serializes auth ops within THIS tab only and can never wedge
    // across contexts. This is the root-cause fix for the "stuck after a few minutes"
    // freeze. See: github.com/supabase/auth-js — Web Locks issues in webviews.
    lock: processLock,
  },
  global: {
    fetch: fetchWithTimeout,
  },
});

/**
 * Deduplicated patient-id resolution.
 * Many always-mounted components (video-call notification, incoming-call overlay,
 * WebRTC) each resolve the patient row from the auth user id on every load — that's
 * ~10 identical `patients?select=id` requests firing at once. This shares ONE
 * in-flight/cached result per auth user id (the id never changes during a session),
 * collapsing those duplicates into a single request.
 */
const _patientIdCache = new Map<string, Promise<string | null>>();
export function resolvePatientId(authUserId: string | null | undefined): Promise<string | null> {
  if (!authUserId) return Promise.resolve(null);
  const cached = _patientIdCache.get(authUserId);
  if (cached) return cached;
  const p = (async (): Promise<string | null> => {
    try {
      // Never let a single hung query wedge the whole app forever. Because this
      // promise is SHARED across every component (video notification, WebRTC,
      // Reports, ECG history), a hang here used to freeze all of them until reload.
      // Race against a timeout and always clear the cache on failure so the next
      // call (re-render / poll) retries with a fresh request.
      const queryPromise = supabase
        .from('patients')
        .select('id')
        .eq('auth_user_id', authUserId)
        .single();
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('resolvePatientId timeout')), 8000)
      );
      const { data, error } = await Promise.race([queryPromise, timeoutPromise]) as any;
      if (error) { _patientIdCache.delete(authUserId); return null; }
      return (data?.id as string) ?? null;
    } catch {
      _patientIdCache.delete(authUserId); // allow retry — never cache a dead promise
      return null;
    }
  })();
  _patientIdCache.set(authUserId, p);
  return p;
}

// ECG Data Storage Functions
export async function storeEcgRecording(ecgData: {
    patient_id: string;
    device_id?: string;
    recorded_at: string;
    sample_rate: number;
    scale_uv_per_lsb: number;
    duration_seconds: number;
    raw_data_base64?: string;
    mv_data_json?: number[];
    heart_rate?: number;
    quality_score?: number;
    notes?: string;
}) {
    try {
        const { data, error } = await supabase
            .from('ecg_recordings')
            .insert(ecgData);

        if (error) {
            console.error('❌ Failed to store ECG recording:', error);
            throw error;
        }

        console.log('✅ ECG recording stored successfully:', data);
        return data;
    } catch (error) {
        console.error('❌ Error storing ECG recording:', error);
        throw error;
    }
}

// --- AliveCor / Kardia SDK integration ---

const ALIVECOR_BACKEND_URL = (
  import.meta.env.VITE_ALIVECOR_BACKEND_URL || 'https://alivecor.monitraq.com'
).replace(/\/$/, '');

/** Use either waveform_mv (single strip / interleaved) or waveform_leads (I–aVF object). */
export interface AliveCorEcgData {
  patient_id: string;
  device_id?: string;
  waveform_mv?: number[];
  /** Per-lead mV samples; use null for gaps. Keys: I, II, III, aVR, aVL, aVF */
  waveform_leads?: Record<string, (number | null)[]>;
  sample_rate: number;
  /** Required for waveform_mv; optional for waveform_leads (derived from length / sample_rate) */
  duration_seconds?: number;
  heart_rate?: number;
  quality_score?: number;
  determination?: string;
  modifier?: string;
  algorithm_package?: string;
  lead_config?: 'single' | 'six';
  device_type?: string;
  is_inverted?: boolean;
  raw_sdk_response?: Record<string, unknown>;
  notes?: string;
}

async function aliveCorFetch(path: string, body: Record<string, unknown>) {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new Error('Not authenticated');

  const url = `${ALIVECOR_BACKEND_URL}${path}`;

  if (Capacitor.isNativePlatform()) {
    try {
      const response = await CapacitorHttp.post({
        url,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        data: body,
      });

      if (response.status < 200 || response.status >= 300) {
        const errBody = response.data || {};
        const msg =
          errBody.error ||
          (Array.isArray(errBody.detail) ? errBody.detail.join(', ') : errBody.detail) ||
          `AliveCor backend error ${response.status}`;
        throw new Error(msg);
      }
      return response.data;
    } catch (err: any) {
      console.error('[aliveCorFetch] Native HTTP POST error:', err, 'url:', url);
      const code = err?.code || err?.errorMessage || err?.message;
      if (code === 'NSURLErrorDomain' || String(code).includes('-1004') || String(code).includes('Could not connect')) {
        throw new Error(
          `Cannot reach AliveCor backend at ${ALIVECOR_BACKEND_URL}. Check network and rebuild the app after updating VITE_ALIVECOR_BACKEND_URL.`,
        );
      }
      throw err;
    }
  } else {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10-second timeout

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({})) as { error?: string; detail?: string | string[] };
        const msg =
          errBody.error ||
          (Array.isArray(errBody.detail) ? errBody.detail.join(', ') : errBody.detail) ||
          `AliveCor backend error ${res.status}`;
        throw new Error(msg);
      }
      return res.json();
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

/** GET helper for the AliveCor backend (no request body) */
export async function aliveCorGet(path: string) {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new Error('Not authenticated');

  const url = `${ALIVECOR_BACKEND_URL}${path}`;

  if (Capacitor.isNativePlatform()) {
    try {
      const response = await CapacitorHttp.get({
        url,
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (response.status < 200 || response.status >= 300) {
        const errBody = response.data || {};
        const msg =
          errBody.error ||
          (Array.isArray(errBody.detail) ? errBody.detail.join(', ') : errBody.detail) ||
          `AliveCor backend error ${response.status}`;
        throw new Error(msg);
      }
      return response.data;
    } catch (err: any) {
      console.error('[aliveCorGet] Native HTTP GET error:', err, 'url:', url);
      const code = err?.code || err?.errorMessage || err?.message;
      if (code === 'NSURLErrorDomain' || String(code).includes('-1004') || String(code).includes('Could not connect')) {
        throw new Error(
          `Cannot reach AliveCor backend at ${ALIVECOR_BACKEND_URL}. Check network and rebuild the app after updating VITE_ALIVECOR_BACKEND_URL.`,
        );
      }
      throw err;
    }
  } else {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: controller.signal,
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({})) as { error?: string; detail?: string | string[] };
        const msg =
          errBody.error ||
          (Array.isArray(errBody.detail) ? errBody.detail.join(', ') : errBody.detail) ||
          `AliveCor backend error ${res.status}`;
        throw new Error(msg);
      }
      return res.json();
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * Request a Kardia SDK JWT via the AliveCor backend proxy.
 * The backend forwards the request to the kardia-auth-server container.
 */
export async function getAliveCorToken(patientId: string): Promise<{ jwt: string; patientMrn: string }> {
  console.log(`[getAliveCorToken] Using backend: ${ALIVECOR_BACKEND_URL}`);
  const result = await aliveCorFetch('/api/alivecor/token', { patientId });
  return {
    jwt: result.jwt,
    patientMrn: result.patientMrn || patientId.replace(/-/g, '') // Fallback to stripping hyphens just in case
  };
}

/**
 * Store an AliveCor ECG recording through the backend, which writes to
 * ecg_recordings, alivecor_recordings, and vital_signs in Supabase.
 *
 * IMPORTANT: waveform data (waveform_mv / waveform_leads) is OPTIONAL.
 * When the ATCReader native JNI library is unavailable (UnsatisfiedLinkError),
 * the native plugin cannot extract waveform samples — but the recording metadata
 * (BPM, determination, timestamp, etc.) is still fully valid and must be stored.
 * In that case the caller should pass neither field and we inject a minimal
 * placeholder flat strip so the backend schema constraint is satisfied.
 */
export async function storeAliveCorRecording(
  data: AliveCorEcgData
): Promise<{ id: string }> {
  const hasMv = data.waveform_mv && data.waveform_mv.length > 0
  const hasLeads =
    data.waveform_leads && Object.keys(data.waveform_leads).length > 0

  if (!hasMv && !hasLeads) {
    const durationSec = data.duration_seconds && data.duration_seconds > 0
      ? data.duration_seconds
      : 30;
    const sampleRate = data.sample_rate && data.sample_rate > 0 ? data.sample_rate : 300;
    const sampleCount = Math.round(durationSec * sampleRate);
    
    // Flat baseline at 0 mV — analytically meaningless but schema-valid
    const placeholder: number[] = Array(Math.max(sampleCount, 2)).fill(0);
    console.warn(
      '[storeAliveCorRecording] No waveform data available (ATCReader JNI missing?). ' +
      'Storing metadata-only record with a placeholder flat strip in waveform_mv.'
    );
    data = { ...data, waveform_mv: placeholder, duration_seconds: durationSec };
  }

  if (hasMv && hasLeads) {
    throw new Error('AliveCor ECG: use only one of waveform_mv or waveform_leads')
  }

  const finalHasMv = data.waveform_mv && data.waveform_mv.length > 0;
  if (finalHasMv && (data.duration_seconds == null || data.duration_seconds <= 0)) {
    data = { ...data, duration_seconds: 30 };
  }

  return aliveCorFetch('/api/alivecor/ecg', data as unknown as Record<string, unknown>)
}

/**
 * Fetch past ECG recordings for a patient from the AliveCor backend.
 */
export async function getAliveCorRecordings(patientId: string, limit: number = 20): Promise<any> {
  const mrn = patientId.replace(/-/g, '');
  return aliveCorGet(`/api/alivecor/recordings/${mrn}?limit=${limit}`);
}

/**
 * Fetch detailed ECG recording (including waveform) for a specific record ID.
 */
export async function getAliveCorRecordingDetail(patientId: string, recordingId: string): Promise<any> {
  const mrn = patientId.replace(/-/g, '');
  return aliveCorGet(`/api/alivecor/recordings/${mrn}/${recordingId}`);
}

/**
 * Fetch radiologist reports for a patient from the radiologist_reports table.
 */
export async function getRadiologistReports(patientId: string) {
  // radiologist_reports is authored by a RADIOLOGIST (radiologist_id → radiologists),
  // not a doctor. Embedding doctors!doctor_id fails with PGRST200 (no such FK).
  return supabase
    .from('radiologist_reports')
    .select('*, radiologists!radiologist_id(full_name)')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false });
}

/**
 * Fetch patient specific vital risk criteria.
 */
export async function getPatientRiskCriteria(patientId: string) {
  return supabase
    .from('patient_vital_risk_criteria')
    .select('*')
    .eq('patient_id', patientId)
    .maybeSingle();
}

/**
 * Check if the AliveCor backend is reachable (no auth required).
 * Uses: GET {VITE_ALIVECOR_BACKEND_URL}/api/health
 */
export async function checkAliveCorBackendHealth(): Promise<{ ok: boolean; configured: boolean }> {
  try {
    const res = await fetch(`${ALIVECOR_BACKEND_URL}/api/health`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return { ok: false, configured: false };
    const data = await res.json();
    return { ok: true, configured: data.alivecor_configured === true };
  } catch {
    return { ok: false, configured: false };
  }
}

const ECG_AI_ANALYZE_URL =
  import.meta.env.VITE_ECG_AI_ANALYZE_URL || 'https://ecg.monitraq.com'

function buildEcgCsvFromMvJson(
  mv: unknown,
  sampleRate: number
): { csv: string; filename: string } | null {
  if (Array.isArray(mv) && mv.length > 0) {
    const lines = ['t,value']
    for (let i = 0; i < mv.length; i++) {
      const t = (i / Math.max(sampleRate, 1)).toFixed(6)
      lines.push(`${t},${Number(mv[i])}`)
    }
    return { csv: lines.join('\n'), filename: 'ecg_strip.csv' }
  }
  if (mv && typeof mv === 'object' && !Array.isArray(mv)) {
    const leads = mv as Record<string, (number | null)[]>
    const keys = Object.keys(leads).filter(
      (k) => Array.isArray(leads[k]) && leads[k]!.length > 0
    )
    if (keys.length === 0) return null
    const n = Math.min(...keys.map((k) => leads[k]!.length))
    const header = keys.join(',')
    const rows = [header]
    for (let i = 0; i < n; i++) {
      rows.push(keys.map((k) => leads[k]![i] ?? '').join(','))
    }
    return { csv: rows.join('\n'), filename: 'ecg_multilead.csv' }
  }
  return null
}

function isAbnormalEcgPrediction(pred: { label?: string; details?: unknown }, rawText: string): boolean {
  const lbl = (pred?.label || '').toLowerCase()
  if (lbl.includes('abnormal') || lbl.includes('af')) return true
  const t = rawText.toLowerCase()
  const keys = [
    'abnormal',
    'arrhythm',
    'afib',
    'atrial fibrillation',
    'vt ',
    'ventricular tachycardia',
    'st elevation',
    'ischemia',
    'infarct',
    'heart block',
    'long qt',
    'brugada',
  ]
  return keys.some((k) => t.includes(k))
}

/**
 * After a Kardia recording is stored, run ECG AI on the backend and persist results.
 * Notifies the assigned doctor when findings are abnormal (fire-and-forget).
 */
export function triggerEcgAiAnalysis(recordingId: string): void {
  void (async () => {
    try {
      const { data: rec, error: recErr } = await supabase
        .from('ecg_recordings')
        .select('id, patient_id, mv_data_json, sample_rate, duration_seconds')
        .eq('id', recordingId)
        .maybeSingle()

      if (recErr || !rec?.mv_data_json) {
        console.warn('[ECG AI] skip: no recording or mv_data_json', recErr)
        return
      }

      const built = buildEcgCsvFromMvJson(rec.mv_data_json, rec.sample_rate || 500)
      if (!built) {
        console.warn('[ECG AI] skip: could not build CSV from recording')
        return
      }

      const blob = new Blob([built.csv], { type: 'text/csv' })
      const form = new FormData()
      form.append('file', blob, built.filename)

      const res = await fetch(`${ECG_AI_ANALYZE_URL.replace(/\/$/, '')}/analyze`, {
        method: 'POST',
        body: form,
        signal: AbortSignal.timeout(90_000), // 90s — covers Render cold start
      })
      if (!res.ok) {
        const txt = await res.text().catch(() => '')
        console.error('[ECG AI] analyze failed', res.status, txt)
        return
      }

      const json = (await res.json()) as {
        meta?: Record<string, unknown>
        features?: Record<string, unknown>
        prediction?: { label?: string; score?: number; details?: unknown }
      }

      const openai = (json.features?.openai_analysis || {}) as {
        raw_text?: string
        deterministic_summary?: { rhythm?: string }
      }
      const rawText = openai.raw_text || ''
      const pred = json.prediction || {}
      const abnormal = isAbnormalEcgPrediction(pred, rawText)
      const rhythmType =
        (openai.deterministic_summary?.rhythm as string | undefined) ||
        (typeof pred.details === 'string' ? pred.details : undefined) ||
        null

      const meta = json.meta || {}
      const { error: insErr } = await supabase.from('ecg_analyses').insert({
        recording_id: recordingId,
        findings: rawText.slice(0, 12000),
        has_arrhythmia: abnormal,
        rhythm_type: rhythmType,
        model_label: pred.label ?? null,
        model_score: pred.score ?? null,
        features: json.features as object,
        sampling_rate_hz: meta.sampling_rate_hz as number | undefined,
        duration_sec: meta.duration_sec as number | undefined,
        uploaded_filename: built.filename,
      })

      if (insErr) {
        console.error('[ECG AI] ecg_analyses insert failed', insErr)
      }

      if (!abnormal) return

      const { data: patient } = await supabase
        .from('patients')
        .select('id, assigned_doctor_id, full_name')
        .eq('id', rec.patient_id)
        .maybeSingle()

      const docId = patient?.assigned_doctor_id
      if (!docId) return

      const { data: doctor } = await supabase
        .from('doctors')
        .select('id, auth_user_id, full_name')
        .eq('id', docId)
        .maybeSingle()

      const authUid = doctor?.auth_user_id
      if (authUid) {
        const snippet = rawText.slice(0, 500) || 'Abnormal ECG detected on Kardia recording.'
        await supabase.from('notifications').insert({
          user_id: authUid,
          title: 'ECG alert',
          message: `${patient?.full_name || 'Patient'}: possible abnormal ECG. Review Kardia recording.`,
          type: 'ecg_alert',
          is_read: false,
          data: { recording_id: recordingId, patient_id: rec.patient_id },
        })
      }

      await supabase.from('emergency_alerts').insert({
        patient_id: rec.patient_id,
        doctor_id: docId,
        alert_type: 'ecg_abnormal',
        severity: 'high',
        title: 'Abnormal ECG (Kardia)',
        description: (rawText || pred.label || 'Abnormal ECG').toString().slice(0, 2000),
      })
    } catch (e) {
      console.error('[ECG AI] triggerEcgAiAnalysis error', e)
    }
  })()
}

// Auth helper functions
export const auth = {
  // Sign up
  signUp: async (email: string, password: string, userData: any) => {
    console.log('🔍 Auth Debug - Signing up user:', email)
    
    // IMPORTANT: Use emailRedirectTo to prevent auto-confirmation
    // This ensures OTP verification is required before user can sign in
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: userData,
        emailRedirectTo: undefined, // Don't use email link confirmation, use OTP instead
        // Explicitly disable auto-confirm - user must verify OTP
      }
    })

    if (error) {
      console.error('❌ Signup error:', error)
    } else {
      console.log('✅ Signup successful:', data.user?.email)
      console.log('🔍 User confirmed?', data.user?.email_confirmed_at ? 'YES' : 'NO')
      console.log('🔍 Session created?', data.session ? 'YES' : 'NO')
      
      // CRITICAL: If a session was created, sign out immediately
      // This prevents auto-login before OTP verification
      if (data.session) {
        console.log('⚠️ Session created during signup - signing out to prevent auto-login')
        await supabase.auth.signOut()
      }
    }

    return { data, error }
  },

  // Sign in
  signIn: async (email: string, password: string) => {
    console.log('🔍 Auth Debug - Signing in user:', email)
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) {
      console.error('❌ Signin error:', error)
    } else {
      console.log('✅ Signin successful:', data.user?.email)
    }

    return { data, error }
  },

  // Sign out
  signOut: async () => {
    console.log('🔍 Auth Debug - Signing out user')
    const { error } = await supabase.auth.signOut()

    if (error) {
      console.error('❌ Signout error:', error)
    } else {
      console.log('✅ Signout successful')
    }

    return { error }
  },

  // Get current user
  getCurrentUser: async () => {
    try {
      const { data: { user }, error } = await supabase.auth.getUser()

      if (error) {
        // Handle auth session missing gracefully
        if (error.message && error.message.includes('Auth session missing')) {
          console.log('ℹ️ No active session found (normal on first load)')
          return { user: null, error: null }
        } else {
          console.error('❌ Get user error:', error)
          return { user: null, error }
        }
      } else {
        console.log('🔍 Auth Debug - Current user:', user?.email)
        return { user, error: null }
      }
    } catch (err) {
      // Handle any unexpected errors
      if (err instanceof Error && err.message.includes('Auth session missing')) {
        console.log('ℹ️ No active session found (normal on first load)')
        return { user: null, error: null }
      } else {
        console.error('❌ Get user error:', err)
        return { user: null, error: err }
      }
    }
  },

  // Listen to auth changes
  onAuthStateChange: (callback: (event: string, session: any) => void) => {
    return supabase.auth.onAuthStateChange(callback)
  }
}

// Check if an auth user is a doctor (patient app must block doctors)
export const isDoctorByAuthId = async (authUserId: string): Promise<boolean> => {
  try {
    // Remove the aggressive timeout entirely. Let the network handle it.
    const { data, error } = await supabase
      .from('doctors')
      .select('id')
      .eq('auth_user_id', authUserId)
      .maybeSingle();
    
    if (error) {
      console.warn('❌ isDoctor check error:', error);
      return false; 
    }
    return !!data;
  } catch (err) {
    console.warn('⚠️ isDoctor check failed, defaulting to patient role');
    return false;
  }
};

// Database helper functions
export const db = {
  // Get patient profile — NO TIMEOUT.
  // The hook that calls this (useRealTimeVitals) uses stale-while-revalidate:
  // cached profile renders instantly and this fetch runs in the background.
  // A slow query never blocks the UI, so we let it run to completion.
  getPatientProfile: async (authUserId: string) => {
    try {
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('auth_user_id', authUserId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') return { data: null, error: null }
        console.error('❌ Get patient profile error:', error)
        return { data: null, error }
      }

      return { data: data ?? null, error: null }
    } catch (err) {
      console.error('❌ Exception getting patient profile:', err)
      return {
        data: null,
        error: err instanceof Error ? err.message : 'Failed to get patient profile'
      }
    }
  },

  // Create patient profile
  createPatientProfile: async (
    authUserId: string,
    fullName: string,
    email: string,
    doctorCode: string,
    additionalData?: {
      dateOfBirth: string;
      gender: string;
      bloodType: string;
      address: string;
      phoneNumber: string;
      emergencyContactName: string;
      emergencyContactPhone: string;
      allergies?: string;
      medicalConditions?: string;
      currentMedications?: string;
      profilePictureUrl?: string;
    }
  ) => {
    console.log('🔍 DB Debug - Creating patient profile:', { authUserId, fullName, email, doctorCode, additionalData })

    try {
      const { data, error } = await supabase.rpc('create_patient_profile_enhanced', {
        auth_user_id: authUserId,
        full_name: fullName,
        email: email,
        doctor_code_input: doctorCode,
        date_of_birth: additionalData?.dateOfBirth || null,
        gender: additionalData?.gender || null,
        blood_type: additionalData?.bloodType || null,
        address: additionalData?.address || null,
        phone_number: additionalData?.phoneNumber || null,
        emergency_contact_name: additionalData?.emergencyContactName || null,
        emergency_contact_phone: additionalData?.emergencyContactPhone || null,
        profile_picture_url: additionalData?.profilePictureUrl || null,
        allergies: additionalData?.allergies ? additionalData.allergies.split(',').map(s => s.trim()).filter(s => s) : null,
        medical_conditions: additionalData?.medicalConditions ? additionalData.medicalConditions.split(',').map(s => s.trim()).filter(s => s) : null,
        current_medications: additionalData?.currentMedications ? additionalData.currentMedications.split(',').map(s => s.trim()).filter(s => s) : null
      })

      if (error) {
        console.error('❌ Create patient profile error:', error)
        return { data: null, error }
      }

      console.log('✅ Patient profile created:', data)
      return { data, error: null }
    } catch (err) {
      console.error('❌ Create patient profile exception:', err)
      return { data: null, error: err }
    }
  },

  // Insert vital signs data
  insertVitalSigns: async (vitalSignsData: any) => {
    // Get current user's patient profile to find assigned doctor
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { data: null, error: new Error('User not authenticated') }
    }

    // Get patient profile to find assigned doctor
    const { data: patientProfile } = await supabase
      .from('patients')
      .select('id, assigned_doctor_id')
      .eq('auth_user_id', user.id)
      .single()

    if (!patientProfile) {
      return { data: null, error: new Error('Patient profile not found') }
    }

    // Add patient_id and doctor_id to vital signs data
    const dataWithPatientAndDoctor = {
      ...vitalSignsData,
      patient_id: patientProfile.id,
      doctor_id: patientProfile.assigned_doctor_id,
      reading_timestamp: vitalSignsData.timestamp || new Date().toISOString()
    }

    // Remove the old timestamp field if it exists
    delete dataWithPatientAndDoctor.timestamp

    const { data, error } = await supabase
      .from('vital_signs')
      .insert(dataWithPatientAndDoctor)
      .select()

    if (!error && data?.[0]) {
      import('@/services/recommendationsService')
        .then((m) =>
          m.evaluateThresholdsAfterVitalInsert(patientProfile.id, {
            measurement_type: data[0].measurement_type,
            data: data[0].data as Record<string, unknown>,
          })
        )
        .catch(() => {
          /* non-fatal */
        })
    }

    return { data, error }
  },

  // Get vital signs for user
  getUserVitalSigns: async (userId: string, limit = 100) => {
    const { data, error } = await supabase
      .from('vital_signs')
      .select('*')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false })
      .limit(limit)

    return { data, error }
  },

  // Get vital signs for doctor's patients
  getDoctorPatientsVitalSigns: async (doctorId: string, limit = 100) => {
    const { data, error } = await supabase
      .from('vital_signs')
      .select(`
        *,
        user_profiles!user_id (
          name,
          role
        )
      `)
      .eq('doctor_id', doctorId)
      .order('timestamp', { ascending: false })
      .limit(limit)

    return { data, error }
  },

  // Assign doctor to patient (current schema uses doctors/patients tables)
  assignDoctorToPatient: async (authUserId: string, doctorCode: string) => {
    // 1) lookup doctor by code
    const { data: doctor, error: docErr } = await supabase
      .from('doctors')
      .select('id, doctor_code')
      .eq('doctor_code', doctorCode)
      .single()

    if (docErr || !doctor) {
      return { data: false, error: docErr || new Error('Doctor not found') }
    }

    // 2) update patient's assigned_doctor_id by auth user id
    const { error: updErr } = await supabase
      .from('patients')
      .update({ assigned_doctor_id: doctor.id })
      .eq('auth_user_id', authUserId)

    if (updErr) {
      return { data: false, error: updErr }
    }

    return { data: true, error: null }
  },

  // Generate doctor code for new doctors
  generateDoctorCode: async () => {
    const { data, error } = await supabase.rpc('generate_doctor_code')
    return { data, error }
  },

  // Get doctor's patients
  getDoctorPatients: async (doctorId: string) => {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, name, role, created_at')
      .eq('doctor_id', doctorId)
      .eq('role', 'user')

    return { data, error }
  },

  // Get patient's assigned doctor (current schema: patients -> assigned_doctor_id -> doctors)
  getPatientDoctor: async (authUserId: string) => {
    // 1) fetch patient's assigned_doctor_id
    const { data: patientRow, error: patientErr } = await supabase
      .from('patients')
      .select('assigned_doctor_id')
      .eq('auth_user_id', authUserId)
      .single()

    if (patientErr) {
      return { data: null as any, error: patientErr }
    }

    if (!patientRow?.assigned_doctor_id) {
      return { data: { doctor: null }, error: null }
    }

    // 2) fetch doctor info
    const { data: doctorRow, error: doctorErr } = await supabase
      .from('doctors')
      .select('id, full_name, doctor_code')
      .eq('id', patientRow.assigned_doctor_id)
      .single()

    if (doctorErr) {
      return { data: null as any, error: doctorErr }
    }

    return { data: { doctor: doctorRow }, error: null }
  }
}

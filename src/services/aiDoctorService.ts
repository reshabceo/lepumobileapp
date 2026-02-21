import { supabase } from "@/lib/supabase";

export type AIDoctorTriageLevel = "emergency" | "urgent" | "routine";

export interface AIDoctorMessage {
  role: "patient" | "ai";
  content: string;
  timestamp?: string;
  type?: "text" | "voice";
  audioData?: string;
  audioMimeType?: string;
  audioDuration?: number;
}

export interface AIDoctorConsultResponse {
  response?: string;
  answerForPatient?: string;
  possibleConditions?: {
    name: string;
    likelihood: "low" | "medium" | "high";
    why: string;
    warningSigns: string[];
  }[];
  triageLevel?: AIDoctorTriageLevel;
  triageAdvice?: string;
  redFlagSymptoms?: string[];
  followUpQuestions?: string[];
  recommendSeeingDoctor?: boolean;
  disclaimer?: string;
  audioData?: string;
  audioMimeType?: string;
}

export interface UploadedFile {
  mimeType: string;
  data: string;
}

export interface AIDoctorConsultRequest {
  patientId?: string;
  patientName?: string;
  age?: number;
  sex?: string;
  symptoms?: string;
  duration?: string;
  medicalHistory?: string;
  medications?: string;
  reportsSummary?: string;
  messages?: AIDoctorMessage[];
  files?: UploadedFile[];
  isVoiceMode?: boolean;
  previousVisits?: string[];
}

// =============================================
//  SESSION PERSISTENCE
// =============================================

export interface AIDoctorSession {
  id: string;
  patient_id: string;
  title: string;
  summary: string | null;
  is_active: boolean;
  payment_status: "unpaid" | "paid" | "expired";
  expires_at: string | null;
  consult_mode: "text" | "voice" | null;
  paid_amount_paise: number | null;
  created_at: string;
  updated_at: string;
}

export type SessionPaymentStatus = "unpaid" | "paid" | "expired";

export interface SessionState {
  sessionId: string;
  paymentStatus: SessionPaymentStatus;
  expiresAt: string | null;
  consultMode: "text" | "voice" | null;
}

/**
 * Get or create a NEW unpaid session (no 24h reuse — each session needs its own payment).
 * Reuse a paid non-expired session if one exists.
 */
export async function getOrCreateSession(patientId: string): Promise<SessionState> {
  // Look for a paid, non-expired session first
  const now = new Date().toISOString();
  const { data: paidSession } = await supabase
    .from("ai_doctor_sessions")
    .select("id, payment_status, expires_at, consult_mode, paid_amount_paise")
    .eq("patient_id", patientId)
    .eq("is_active", true)
    .eq("payment_status", "paid")
    .gt("expires_at", now)
    .order("expires_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (paidSession) {
    return {
      sessionId: paidSession.id,
      paymentStatus: "paid",
      expiresAt: paidSession.expires_at,
      consultMode: paidSession.consult_mode,
    };
  }

  // Look for an existing unpaid session (pending payment) created recently (last 30 min)
  const recentCutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data: unpaidSession } = await supabase
    .from("ai_doctor_sessions")
    .select("id, payment_status, expires_at, consult_mode")
    .eq("patient_id", patientId)
    .eq("is_active", true)
    .eq("payment_status", "unpaid")
    .gte("created_at", recentCutoff)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (unpaidSession) {
    return {
      sessionId: unpaidSession.id,
      paymentStatus: "unpaid",
      expiresAt: null,
      consultMode: null,
    };
  }

  // Create a fresh session
  const { data: created, error } = await supabase
    .from("ai_doctor_sessions")
    .insert({ patient_id: patientId, payment_status: "unpaid" })
    .select("id")
    .single();

  if (error) throw error;
  return {
    sessionId: created.id,
    paymentStatus: "unpaid",
    expiresAt: null,
    consultMode: null,
  };
}

/**
 * Mark a session as expired (called when expires_at has passed).
 */
export async function expireSession(sessionId: string): Promise<void> {
  await supabase
    .from("ai_doctor_sessions")
    .update({ payment_status: "expired", is_active: false })
    .eq("id", sessionId);
}

/**
 * Load all messages from a session, ordered chronologically.
 */
export async function loadSessionMessages(
  sessionId: string
): Promise<AIDoctorMessage[]> {
  const { data, error } = await supabase
    .from("ai_doctor_messages")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  return (data || []).map((m: any) => ({
    role: m.role as "patient" | "ai",
    content: m.content,
    type: (m.message_type || "text") as "text" | "voice",
    timestamp: m.created_at,
    audioDuration: m.audio_duration ?? undefined,
  }));
}

/**
 * Persist a single message to the DB.
 * Also updates the session's `updated_at` and stores the last AI response as summary.
 */
export async function saveMessage(
  sessionId: string,
  message: AIDoctorMessage
): Promise<void> {
  await supabase.from("ai_doctor_messages").insert({
    session_id: sessionId,
    role: message.role,
    content: message.content,
    message_type: message.type || "text",
    audio_duration: message.audioDuration ?? null,
  });

  const updates: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };
  if (message.role === "ai") {
    updates.summary = message.content.substring(0, 500);
  }
  await supabase
    .from("ai_doctor_sessions")
    .update(updates)
    .eq("id", sessionId);
}

/**
 * Close a session (mark inactive) so next visit creates a new one.
 */
export async function closeSession(sessionId: string): Promise<void> {
  await supabase
    .from("ai_doctor_sessions")
    .update({ is_active: false })
    .eq("id", sessionId);
}

/**
 * Load summaries from previous sessions for AI context.
 */
export async function getPreviousSessionSummaries(
  patientId: string,
  excludeSessionId?: string
): Promise<string[]> {
  let query = supabase
    .from("ai_doctor_sessions")
    .select("summary, created_at")
    .eq("patient_id", patientId)
    .not("summary", "is", null)
    .order("created_at", { ascending: false })
    .limit(5);

  if (excludeSessionId) {
    query = query.neq("id", excludeSessionId);
  }

  const { data } = await query;
  return (data || []).map(
    (s: any) =>
      `[${new Date(s.created_at).toLocaleDateString()}]: ${s.summary}`
  );
}

/**
 * Load all sessions for a patient (for history list).
 */
export async function getPatientSessions(
  patientId: string
): Promise<AIDoctorSession[]> {
  const { data, error } = await supabase
    .from("ai_doctor_sessions")
    .select("*")
    .eq("patient_id", patientId)
    .order("updated_at", { ascending: false })
    .limit(20);

  if (error) throw error;
  return (data || []) as AIDoctorSession[];
}

// =============================================
//  AI CONSULT API
// =============================================

const FUNCTION_NAME = "med-gemini-consult";

export async function runAIDoctorConsult(
  payload: AIDoctorConsultRequest
): Promise<AIDoctorConsultResponse> {
  try {
    const { data, error } = await supabase.functions.invoke(FUNCTION_NAME, {
      body: payload,
    });

    if (error) {
      console.error("AI Doctor consult error:", error);
      throw new Error(
        (error as any)?.message ||
          "AI doctor is temporarily unavailable. Please try again."
      );
    }

    if (!data) {
      throw new Error(
        "AI doctor did not return any information. Please try again."
      );
    }

    return data as AIDoctorConsultResponse;
  } catch (err) {
    console.error("AI Doctor consult unexpected error:", err);
    throw err instanceof Error
      ? err
      : new Error("Failed to contact AI doctor. Please try again.");
  }
}












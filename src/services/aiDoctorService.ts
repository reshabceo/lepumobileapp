import { supabase } from "@/lib/supabase";

export type AIDoctorTriageLevel = "emergency" | "urgent" | "routine";

export interface AIDoctorMessage {
  role: "patient" | "ai";
  content: string;
  timestamp?: string;
}

export interface AIDoctorConsultResponse {
  answerForPatient: string;
  possibleConditions: {
    name: string;
    likelihood: "low" | "medium" | "high";
    why: string;
    warningSigns: string[];
  }[];
  triageLevel: AIDoctorTriageLevel;
  triageAdvice: string;
  redFlagSymptoms: string[];
  followUpQuestions: string[];
  recommendSeeingDoctor: boolean;
  disclaimer: string;
}

export interface AIDoctorConsultRequest {
  patientId?: string;
  age?: number;
  sex?: string;
  symptoms?: string;
  duration?: string;
  medicalHistory?: string;
  medications?: string;
  reportsSummary?: string;
  messages?: AIDoctorMessage[];
}

const FUNCTION_NAME = "med-gemini-consult";

export async function runAIDoctorConsult(
  payload: AIDoctorConsultRequest
): Promise<AIDoctorConsultResponse> {
  try {
    // Use Supabase edge function invoke for better routing on mobile
    const { data, error } = await supabase.functions.invoke(FUNCTION_NAME, {
      body: payload,
    });

    if (error) {
      console.error("❌ AI Doctor consult error:", error);
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
    console.error("❌ AI Doctor consult unexpected error:", err);
    throw err instanceof Error
      ? err
      : new Error("Failed to contact AI doctor. Please try again.");
  }
}








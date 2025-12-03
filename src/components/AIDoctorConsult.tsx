import React, { useEffect, useRef, useState } from "react";
import { runAIDoctorConsult, AIDoctorMessage } from "@/services/aiDoctorService";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import {
  AlertTriangle,
  Loader2,
  Stethoscope,
  Send,
  ShieldAlert,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";

interface PatientContext {
  id?: string;
  age?: number;
  sex?: string;
  medicalHistory?: string;
  medications?: string;
}

export const AIDoctorConsult: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [patientContext, setPatientContext] = useState<PatientContext>({});
  const [messages, setMessages] = useState<AIDoctorMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Load basic patient context for better answers
  useEffect(() => {
    const loadContext = async () => {
      try {
        if (!user?.id) return;
        const { data: patient, error } = await db.getPatientProfile(user.id);
        if (error) {
          console.error("Failed to load patient profile for AI doctor:", error);
          return;
        }
        if (patient) {
          setPatientContext({
            id: patient.id,
            age: patient.date_of_birth
              ? Math.floor(
                  (Date.now() -
                    new Date(patient.date_of_birth as string).getTime()) /
                    (1000 * 60 * 60 * 24 * 365.25)
                )
              : undefined,
            sex:
              (patient.gender as string | null) ||
              (patient.sex as string | null) ||
              undefined,
            medicalHistory:
              (patient.chronic_conditions as string | null) || undefined,
            medications:
              (patient.current_medications as string | null) || undefined,
          });
        }
      } catch (err) {
        console.error("Error loading patient context for AI doctor:", err);
      }
    };
    loadContext();
  }, [user?.id]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading]);

  const addMessage = (msg: AIDoctorMessage) => {
    setMessages((prev) => [...prev, { ...msg, timestamp: new Date().toISOString() }]);
  };

  const handleQuickStart = (text: string) => {
    setInput(text);
    setTimeout(() => {
      void handleSend();
    }, 0);
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const patientMessage: AIDoctorMessage = {
      role: "patient",
      content: input.trim(),
    };

    addMessage(patientMessage);
    setInput("");
    setIsLoading(true);
    setHasStarted(true);

    try {
      const response = await runAIDoctorConsult({
        patientId: patientContext.id,
        age: patientContext.age,
        sex: patientContext.sex,
        symptoms: input.trim(),
        medicalHistory: patientContext.medicalHistory,
        medications: patientContext.medications,
        messages,
      });

      const aiText =
        response.answerForPatient ||
        "I was not able to clearly understand your situation. Please describe your symptoms again with as much detail as possible.";

      const safetyPrefix =
        response.triageLevel === "emergency"
          ? "This sounds potentially serious. If you have severe symptoms, difficulty breathing, chest pain, confusion, or feel very unwell, seek emergency medical care immediately.\n\n"
          : response.triageLevel === "urgent"
          ? "Your symptoms may need prompt evaluation by a doctor. Please contact your doctor or local clinic as soon as you can.\n\n"
          : "";

      addMessage({
        role: "ai",
        content: `${safetyPrefix}${aiText}\n\n${
          response.disclaimer ||
          "This information is provided by an AI medical assistant and is not a diagnosis or a substitute for seeing a real doctor."
        }`,
      });
    } catch (err) {
      console.error("AI doctor consult failed:", err);
      toast({
        title: "AI doctor unavailable",
        description:
          err instanceof Error
            ? err.message
            : "Something went wrong while contacting the AI doctor.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#050816] via-[#050816] to-black text-white flex flex-col">
      <div className="px-4 pt-4 pb-2 border-b border-white/5 bg-black/40 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400">
            <Stethoscope className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm uppercase tracking-[0.25em] text-emerald-400/80">
              Med-Gemini AI Doctor
            </span>
            <span className="text-lg font-semibold">
              Understand your symptoms safely
            </span>
          </div>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <Card className="bg-white/5 border-white/10 p-3">
            <div className="flex items-center gap-2 text-xs text-emerald-300">
              <Activity className="w-3 h-3" />
              <span>What this does</span>
            </div>
            <p className="mt-1 text-xs text-white/80">
              Helps you understand possible causes of your symptoms, how urgent
              they might be, and which type of doctor to see.
            </p>
          </Card>
          <Card className="bg-white/5 border-white/10 p-3">
            <div className="flex items-center gap-2 text-xs text-amber-300">
              <ShieldAlert className="w-3 h-3" />
              <span>What it does not do</span>
            </div>
            <p className="mt-1 text-xs text-white/80">
              Does not prescribe or recommend any medications, doses, or
              treatment plans. It is not a diagnosis or medical care.
            </p>
          </Card>
          <Card className="bg-white/5 border-white/10 p-3">
            <div className="flex items-center gap-2 text-xs text-red-300">
              <AlertTriangle className="w-3 h-3" />
              <span>Emergency safety</span>
            </div>
            <p className="mt-1 text-xs text-white/80">
              If you have severe chest pain, trouble breathing, confusion,
              stroke symptoms, very high fever, or feel in danger, call your
              local emergency number immediately.
            </p>
          </Card>
        </div>
      </div>

      {!hasStarted && (
        <div className="px-4 pt-3 pb-2">
          <p className="text-xs text-white/70 mb-2">
            You can type your symptoms in your own words, or start with one of
            these:
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              className="border-emerald-500/40 bg-emerald-500/5 text-xs text-emerald-100 hover:bg-emerald-500/20"
              onClick={() =>
                handleQuickStart(
                  "I have had fever and cough for 3 days with body pain."
                )
              }
            >
              Fever and cough
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-emerald-500/40 bg-emerald-500/5 text-xs text-emerald-100 hover:bg-emerald-500/20"
              onClick={() =>
                handleQuickStart(
                  "I have chest discomfort and shortness of breath when walking."
                )
              }
            >
              Chest discomfort
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-emerald-500/40 bg-emerald-500/5 text-xs text-emerald-100 hover:bg-emerald-500/20"
              onClick={() =>
                handleQuickStart(
                  "I feel very tired all the time and have lost weight without trying."
                )
              }
            >
              Tired and weight loss
            </Button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${
              msg.role === "patient" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm whitespace-pre-line leading-relaxed ${
                msg.role === "patient"
                  ? "bg-emerald-500 text-black rounded-br-sm"
                  : "bg-white/5 text-white border border-white/10 rounded-bl-sm"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-2xl bg-white/5 border border-white/10 px-3 py-2 text-xs text-white/80">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>The AI doctor is thinking...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-white/10 bg-black/60 backdrop-blur-md px-3 py-2">
        <div className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe your symptoms in as much detail as you can..."
            className="min-h-[52px] max-h-32 resize-none bg-[#050816]/80 border-white/10 text-sm text-white placeholder:text-gray-500"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
          />
          <Button
            size="icon"
            className="h-[52px] w-[52px] rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black"
            onClick={() => void handleSend()}
            disabled={isLoading || !input.trim()}
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </div>
        <p className="mt-1 text-[10px] text-white/50">
          This AI doctor uses Google DeepMind Med-Gemini for medical reasoning.
          It is for information only and does not replace seeing a real doctor
          or emergency services.
        </p>
      </div>
    </div>
  );
};





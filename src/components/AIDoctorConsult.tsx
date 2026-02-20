import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  runAIDoctorConsult,
  AIDoctorMessage,
  UploadedFile,
  getOrCreateSession,
  loadSessionMessages,
  saveMessage,
  getPreviousSessionSummaries,
  getPatientSessions,
  AIDoctorSession,
  closeSession,
  expireSession,
} from "@/services/aiDoctorService";
import { fetchAIDoctorPricing, payAndFulfil, AIDoctorPricing } from "@/lib/payment";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import {
  AlertTriangle,
  Loader2,
  Stethoscope,
  Send,
  ShieldAlert,
  Activity,
  ArrowLeft,
  Paperclip,
  X,
  FileText,
  Mic,
  Square,
  Play,
  Pause,
  Volume2,
  Keyboard,
  Clock,
  Plus,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Lock,
  Timer,
  CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";

interface PatientContext {
  id?: string;
  fullName?: string;
  age?: number;
  sex?: string;
  medicalHistory?: string;
  medications?: string;
}

interface AttachedFile {
  name: string;
  type: string;
  data: string;
  preview?: string;
}

type ConsultMode = "text" | "voice";
type RecordingState = "idle" | "recording" | "processing";

const MAX_RECORDING_SECONDS = 60;

function getSupportedMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "audio/webm";
  const types = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  for (const t of types) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return "audio/webm";
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatSessionDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours < 1) return "Just now";
  if (diffHours < 24) return `${Math.floor(diffHours)}h ago`;
  if (diffHours < 48) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export const AIDoctorConsult: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  // --- Core state ---
  const [patientContext, setPatientContext] = useState<PatientContext>({});
  const [messages, setMessages] = useState<AIDoctorMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // --- Session state ---
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [previousVisits, setPreviousVisits] = useState<string[]>([]);
  const [pastSessions, setPastSessions] = useState<AIDoctorSession[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(true);

  // --- Payment state ---
  const [paymentStatus, setPaymentStatus] = useState<"unpaid" | "paid" | "expired">("unpaid");
  const [sessionExpiresAt, setSessionExpiresAt] = useState<string | null>(null);
  const [expiryCountdown, setExpiryCountdown] = useState<string>("");
  const [pricing, setPricing] = useState<AIDoctorPricing | null>(null);
  const [payingMode, setPayingMode] = useState<"text" | "voice" | null>(null);
  const [isPaymentLoading, setIsPaymentLoading] = useState(false);

  // --- History viewer state ---
  const [viewingHistory, setViewingHistory] = useState(false);
  const [viewingSession, setViewingSession] = useState<AIDoctorSession | null>(null);
  const [historyMessages, setHistoryMessages] = useState<AIDoctorMessage[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [allSessions, setAllSessions] = useState<AIDoctorSession[]>([]);

  // --- Voice state ---
  const [consultMode, setConsultMode] = useState<ConsultMode | null>(null);
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [playingAudioIdx, setPlayingAudioIdx] = useState<number | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);

  // --- Patient context ---
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
            fullName: (patient.full_name as string | null) || undefined,
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

  // --- Load/create session + previous visit summaries ---
  useEffect(() => {
    const initSession = async () => {
      if (!patientContext.id) {
        setSessionLoading(false);
        return;
      }

      try {
        // Fetch pricing in parallel with session
        const [sessionState, pricingData] = await Promise.all([
          getOrCreateSession(patientContext.id),
          fetchAIDoctorPricing(),
        ]);

        const { sessionId: sid, paymentStatus: pStatus, expiresAt, consultMode: paidMode } = sessionState;
        setPricing(pricingData);
        setSessionId(sid);
        setPaymentStatus(pStatus);
        setSessionExpiresAt(expiresAt);

        if (pStatus === "paid" && paidMode) {
          setConsultMode(paidMode as "text" | "voice");
        }

        // Only load messages if session is paid
        if (pStatus === "paid") {
          const existingMessages = await loadSessionMessages(sid);
          if (existingMessages.length > 0) {
            setMessages(existingMessages);
            setHasStarted(true);
          }
        }

        // Load previous session summaries (paid sessions only, for AI context)
        const summaries = await getPreviousSessionSummaries(patientContext.id, sid);
        setPreviousVisits(summaries);

        // Load all sessions for history viewer
        const sessions = await getPatientSessions(patientContext.id);
        setAllSessions(sessions);
        setPastSessions(sessions.filter((s) => s.id !== sid));
      } catch (err) {
        console.error("Error initializing AI doctor session:", err);
      } finally {
        setSessionLoading(false);
      }
    };
    initSession();
  }, [patientContext.id]);

  // --- Expiry countdown timer ---
  useEffect(() => {
    if (!sessionExpiresAt || paymentStatus !== "paid") return;

    const tick = () => {
      const ms = new Date(sessionExpiresAt).getTime() - Date.now();
      if (ms <= 0) {
        setExpiryCountdown("Expired");
        setPaymentStatus("expired");
        if (sessionId) expireSession(sessionId).catch(() => {});
        return;
      }
      const h = Math.floor(ms / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      setExpiryCountdown(
        h > 0
          ? `${h}h ${m}m remaining`
          : m > 0
          ? `${m}m ${s}s remaining`
          : `${s}s remaining`
      );
    };

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [sessionExpiresAt, paymentStatus, sessionId]);

  // --- Auto-scroll ---
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading]);

  // --- Cleanup on unmount ---
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
      if (ttsAudioRef.current) {
        ttsAudioRef.current.pause();
      }
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // --- Helpers ---
  const addMessage = useCallback(
    (msg: AIDoctorMessage) => {
      const withTimestamp = { ...msg, timestamp: new Date().toISOString() };
      setMessages((prev) => [...prev, withTimestamp]);

      // Persist to DB if we have a session
      if (sessionId) {
        saveMessage(sessionId, withTimestamp).catch((err) =>
          console.error("Failed to save message:", err)
        );
      }
    },
    [sessionId]
  );

  const handleNewConsultation = async () => {
    if (!patientContext.id) return;

    // Close current session
    if (sessionId) {
      await closeSession(sessionId).catch(() => {});
    }

    try {
      // Force-create a new unpaid session
      const { sessionId: sid } = await getOrCreateSession(patientContext.id);
      setSessionId(sid);
      setMessages([]);
      setHasStarted(false);
      setConsultMode(null);
      setShowHistory(false);
      setAttachedFiles([]);
      setInput("");
      setPaymentStatus("unpaid");
      setSessionExpiresAt(null);
      setExpiryCountdown("");

      const summaries = await getPreviousSessionSummaries(patientContext.id, sid);
      setPreviousVisits(summaries);
      const sessions = await getPatientSessions(patientContext.id);
      setAllSessions(sessions);
      setPastSessions(sessions.filter((s) => s.id !== sid));
    } catch (err) {
      console.error("Failed to create new session:", err);
    }
  };

  const handleLoadSession = async (session: AIDoctorSession) => {
    try {
      const msgs = await loadSessionMessages(session.id);
      setSessionId(session.id);
      setMessages(msgs);
      setHasStarted(msgs.length > 0);
      setShowHistory(false);
      if (msgs.length > 0) {
        const lastVoice = msgs
          .slice()
          .reverse()
          .find((m) => m.type === "voice");
        setConsultMode(lastVoice ? "voice" : "text");
      }
    } catch (err) {
      console.error("Failed to load session:", err);
      toast({
        title: "Failed to load conversation",
        description: "Could not load this session. Please try again.",
        variant: "destructive",
      });
    }
  };

  // --- Payment ---
  const handlePayForConsult = async (mode: "text" | "voice") => {
    if (!patientContext.id || !sessionId || !pricing) return;

    setPayingMode(mode);
    setIsPaymentLoading(true);

    const amountPaise = mode === "voice" ? pricing.price_voice_paise : pricing.price_text_paise;
    const paymentType = mode === "voice" ? "ai_doctor_voice" : "ai_doctor_text";

    try {
      await payAndFulfil({
        type: paymentType as any,
        amount_paise: amountPaise,
        metadata: {
          session_id: sessionId,
          patient_id: patientContext.id,
          amount_paise: amountPaise,
        },
        onSuccess: async () => {
          // Refresh session state after payment
          const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
          setPaymentStatus("paid");
          setSessionExpiresAt(expiresAt);
          setConsultMode(mode);
          toast({
            title: "Payment successful",
            description: `AI Doctor ${mode} consultation unlocked for 24 hours.`,
          });
        },
        onDismiss: () => {
          toast({
            title: "Payment cancelled",
            description: "You can pay anytime to start your consultation.",
          });
        },
        onError: (err) => {
          toast({
            title: "Payment failed",
            description: err.message || "Something went wrong. Please try again.",
            variant: "destructive",
          });
        },
      });
    } catch (err) {
      // Errors already shown via onError callback
    } finally {
      setIsPaymentLoading(false);
      setPayingMode(null);
    }
  };

  // --- History viewer ---
  const openHistoryViewer = () => {
    setViewingHistory(true);
    setViewingSession(null);
    setHistoryMessages([]);
  };

  const viewSessionDetail = async (session: AIDoctorSession) => {
    setHistoryLoading(true);
    setViewingSession(session);
    try {
      const msgs = await loadSessionMessages(session.id);
      setHistoryMessages(msgs);
    } catch (err) {
      console.error("Failed to load session history:", err);
      toast({
        title: "Failed to load",
        description: "Could not load this consultation. Please try again.",
        variant: "destructive",
      });
      setHistoryMessages([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const continueSession = (session: AIDoctorSession) => {
    setViewingHistory(false);
    setViewingSession(null);
    setHistoryMessages([]);
    void handleLoadSession(session);
  };

  const handleQuickStart = (text: string) => {
    setInput(text);
    setTimeout(() => {
      void handleSend();
    }, 0);
  };

  // =============================================
  //  FILE HANDLING (shared between text and voice)
  // =============================================
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newFiles: AttachedFile[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: `${file.name} is ${(file.size / (1024 * 1024)).toFixed(2)}MB. Please compress or use a file smaller than 5MB.`,
          variant: "destructive",
        });
        continue;
      }

      const allowedTypes = [
        "image/jpeg", "image/jpg", "image/png", "image/webp",
        "application/pdf", "text/plain",
      ];

      let fileType = file.type;
      if (file.name.toLowerCase().endsWith(".jpg") && file.type === "image/jpeg") {
        fileType = "image/jpeg";
      }

      if (!allowedTypes.includes(fileType)) {
        toast({
          title: "Unsupported file type",
          description: `${file.name} is not supported. Please use: JPEG, PNG, WebP images, PDF, or text files.`,
          variant: "destructive",
        });
        continue;
      }

      try {
        const base64 = await fileToBase64(file);
        if (!base64 || base64.length === 0) throw new Error("Failed to convert");

        const attached: AttachedFile = { name: file.name, type: fileType, data: base64 };
        if (fileType.startsWith("image/")) {
          attached.preview = `data:${fileType};base64,${base64}`;
        }
        newFiles.push(attached);
        toast({ title: "File attached", description: `${file.name} is ready to send` });
      } catch {
        toast({
          title: "Upload failed",
          description: `Could not read ${file.name}. Please try a different file.`,
          variant: "destructive",
        });
      }
    }

    if (newFiles.length > 0) setAttachedFiles((prev) => [...prev, ...newFiles]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(",")[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const removeFile = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // =============================================
  //  TEXT SEND
  // =============================================
  const handleSend = async () => {
    if ((!input.trim() && attachedFiles.length === 0) || isLoading) return;

    const patientMessage: AIDoctorMessage = {
      role: "patient",
      content: input.trim() || "(Sent medical files for review)",
      type: "text",
    };

    addMessage(patientMessage);

    const messageCopy = input.trim();
    const filesCopy = [...attachedFiles];

    setInput("");
    setAttachedFiles([]);
    setIsLoading(true);
    setHasStarted(true);

    try {
      const uploadedFiles: UploadedFile[] = filesCopy.map((f) => ({
        mimeType: f.type,
        data: f.data,
      }));

      // Strip audioData from history to keep request small
      const cleanMessages = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const response = await runAIDoctorConsult({
        patientId: patientContext.id,
        patientName: patientContext.fullName,
        age: patientContext.age,
        sex: patientContext.sex,
        symptoms: messageCopy,
        medicalHistory: patientContext.medicalHistory,
        medications: patientContext.medications,
        messages: cleanMessages as AIDoctorMessage[],
        files: uploadedFiles.length > 0 ? uploadedFiles : undefined,
        previousVisits: previousVisits.length > 0 ? previousVisits : undefined,
      });

      const aiText =
        response.response ||
        response.answerForPatient ||
        "I was not able to clearly understand your situation. Please describe your symptoms again with as much detail as possible.";

      const safetyPrefix =
        response.triageLevel === "emergency"
          ? "⚠️ EMERGENCY: This sounds potentially serious. If you have severe symptoms, difficulty breathing, chest pain, confusion, or feel very unwell, seek emergency medical care immediately.\n\n"
          : response.triageLevel === "urgent"
          ? "⚠️ URGENT: Your symptoms may need prompt evaluation by a doctor. Please contact your doctor or local clinic as soon as you can.\n\n"
          : "";

      addMessage({
        role: "ai",
        content: `${safetyPrefix}${aiText}`,
        type: "text",
      });
    } catch (err) {
      console.error("AI doctor consult failed:", err);
      addMessage({
        role: "ai",
        content:
          "I apologize, but I encountered an issue analyzing your request. " +
          (err instanceof Error && err.message.includes("timeout")
            ? "The analysis took too long - this can happen with large files. Please try with a smaller or clearer file."
            : err instanceof Error && err.message.includes("file")
            ? err.message
            : "Please try again, and if the issue persists, try describing your symptoms without attachments first."),
        type: "text",
      });
      toast({
        title: "AI doctor issue",
        description:
          err instanceof Error
            ? err.message.substring(0, 150)
            : "Something went wrong. Please try again.",
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // =============================================
  //  VOICE RECORDING
  // =============================================
  const startRecording = async () => {
    if (typeof MediaRecorder === "undefined") {
      toast({
        title: "Not supported",
        description: "Voice recording is not supported on this device. Please use text mode.",
        variant: "destructive",
      });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;

      const mimeType = getSupportedMimeType();
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        void handleVoiceMessage(blob, mimeType);
      };

      mediaRecorder.start();
      setRecordingState("recording");
      setRecordingDuration(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => {
          if (prev >= MAX_RECORDING_SECONDS - 1) {
            stopRecording();
            return MAX_RECORDING_SECONDS;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      const isDenied = err instanceof DOMException && err.name === "NotAllowedError";
      toast({
        title: isDenied ? "Microphone access denied" : "Microphone unavailable",
        description: isDenied
          ? "Please allow microphone access in your device settings to use voice mode."
          : "Could not access the microphone. Please check your device settings.",
        variant: "destructive",
      });
    }
  };

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((t) => t.stop());
      audioStreamRef.current = null;
    }
    setRecordingState("processing");
  }, []);

  // =============================================
  //  NATURAL TEXT-TO-SPEECH (Multi-language)
  // =============================================
  const cleanTextForSpeech = (text: string): string => {
    return text
      .replace(/⚠️\s*(EMERGENCY|URGENT):\s*/g, "Important notice: ")
      .replace(/#{1,6}\s+/g, "")
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .replace(/\*(.+?)\*/g, "$1")
      .replace(/`(.+?)`/g, "$1")
      .replace(/\[(.+?)\]\(.+?\)/g, "$1")
      .replace(/^\s*[-*+]\s+/gm, ". ")
      .replace(/^\s*\d+\.\s+/gm, ". ")
      .replace(/[📎🚀✅❌🔊🎤📝⚠️🏥💊🩺🔬💉🫀🫁🧠🦴🦷👁️👂🩸🧬]/g, "")
      .replace(/\n{2,}/g, ". ")
      .replace(/\n/g, ". ")
      .trim();
  };

  const detectLanguage = (text: string): string => {
    if (/[\u0900-\u097F]/.test(text)) return "hi-IN";
    if (/[\u0980-\u09FF]/.test(text)) return "bn-IN";
    if (/[\u0A80-\u0AFF]/.test(text)) return "gu-IN";
    if (/[\u0B80-\u0BFF]/.test(text)) return "ta-IN";
    if (/[\u0C00-\u0C7F]/.test(text)) return "te-IN";
    if (/[\u0C80-\u0CFF]/.test(text)) return "kn-IN";
    if (/[\u0D00-\u0D7F]/.test(text)) return "ml-IN";
    if (/[\u0600-\u06FF]/.test(text)) return "ar-SA";
    if (/[\u4E00-\u9FFF]/.test(text)) return "zh-CN";
    if (/[\u3040-\u30FF]/.test(text)) return "ja-JP";
    if (/[\uAC00-\uD7AF]/.test(text)) return "ko-KR";
    if (/[àâæçéèêëïîôœùûüÿ]/i.test(text)) return "fr-FR";
    if (/[äöüß]/i.test(text)) return "de-DE";
    if (/[áéíóúñ¿¡]/i.test(text)) return "es-ES";
    if (/[àèéìíîòóùú]/i.test(text)) return "it-IT";
    if (/[ãçõ]/i.test(text)) return "pt-BR";
    if (/[а-яё]/i.test(text)) return "ru-RU";
    return "en-US";
  };

  const getBestVoice = useCallback((lang: string): SpeechSynthesisVoice | null => {
    const voices = window.speechSynthesis.getVoices();
    if (voices.length === 0) return null;

    const langPrefix = lang.split("-")[0];

    const naturalVoiceKeywords = [
      "premium", "enhanced", "natural", "neural",
      "zira", "samantha", "karen", "moira", "tessa",
      "google", "microsoft",
    ];

    for (const keyword of naturalVoiceKeywords) {
      const match = voices.find(
        (v) => v.lang.startsWith(langPrefix) && v.name.toLowerCase().includes(keyword)
      );
      if (match) return match;
    }

    const langMatch = voices.find((v) => v.lang.startsWith(langPrefix));
    if (langMatch) return langMatch;

    for (const keyword of naturalVoiceKeywords) {
      const match = voices.find(
        (v) => v.lang.startsWith("en") && v.name.toLowerCase().includes(keyword)
      );
      if (match) return match;
    }

    return voices.find((v) => v.lang.startsWith("en")) || voices[0] || null;
  }, []);

  const speakText = useCallback((text: string) => {
    if (!("speechSynthesis" in window)) return;

    window.speechSynthesis.cancel();
    if (ttsAudioRef.current) {
      ttsAudioRef.current.pause();
      ttsAudioRef.current = null;
    }

    const clean = cleanTextForSpeech(text);
    if (!clean) return;

    const detectedLang = detectLanguage(text);

    const sentences = clean
      .split(/(?<=[.!?])\s+/)
      .filter((s) => s.trim().length > 0);

    let currentIdx = 0;

    const speakNext = () => {
      if (currentIdx >= sentences.length) {
        setIsSpeaking(false);
        return;
      }

      const sentence = sentences[currentIdx];
      currentIdx++;

      const utterance = new SpeechSynthesisUtterance(sentence);
      utterance.rate = 0.95;
      utterance.pitch = 1.05;
      utterance.volume = 1.0;
      utterance.lang = detectedLang;

      const bestVoice = getBestVoice(detectedLang);
      if (bestVoice) utterance.voice = bestVoice;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => speakNext();
      utterance.onerror = () => {
        setIsSpeaking(false);
      };

      window.speechSynthesis.speak(utterance);
    };

    setIsSpeaking(true);
    speakNext();
  }, [getBestVoice]);

  const stopSpeaking = useCallback(() => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    if (ttsAudioRef.current) {
      ttsAudioRef.current.pause();
      ttsAudioRef.current = null;
    }
    setIsSpeaking(false);
  }, []);

  // Preload voices
  useEffect(() => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }
  }, []);

  const playNaturalAudio = useCallback((base64Audio: string, mime: string, fallbackText?: string) => {
    try {
      if (ttsAudioRef.current) {
        ttsAudioRef.current.pause();
        ttsAudioRef.current = null;
      }

      const audio = new Audio(`data:${mime};base64,${base64Audio}`);
      ttsAudioRef.current = audio;

      audio.onplay = () => setIsSpeaking(true);
      audio.onended = () => {
        setIsSpeaking(false);
        ttsAudioRef.current = null;
      };
      audio.onerror = () => {
        setIsSpeaking(false);
        ttsAudioRef.current = null;
        if (fallbackText) speakText(fallbackText);
      };

      audio.play().catch(() => {
        if (fallbackText) speakText(fallbackText);
      });
    } catch {
      if (fallbackText) speakText(fallbackText);
    }
  }, [speakText]);

  const handleVoiceMessage = async (blob: Blob, mimeType: string) => {
    try {
      const base64 = await blobToBase64(blob);
      const duration = recordingDuration;

      const audioDataUrl = `data:${mimeType};base64,${base64}`;

      addMessage({
        role: "patient",
        content: "Voice message",
        type: "voice",
        audioData: audioDataUrl,
        audioMimeType: mimeType,
        audioDuration: duration,
      });

      setIsLoading(true);
      setHasStarted(true);
      setRecordingState("idle");
      setRecordingDuration(0);

      const cleanMime = mimeType.split(";")[0];
      const filesCopy = [...attachedFiles];
      setAttachedFiles([]);

      // Strip audioData from conversation history
      const cleanMessages = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      // Build files array: attached docs + audio recording
      const filesToSend: UploadedFile[] = filesCopy.map((f) => ({
        mimeType: f.type,
        data: f.data,
      }));
      filesToSend.push({ mimeType: cleanMime, data: base64 });

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 50000);

      try {
        const response = await runAIDoctorConsult({
          patientId: patientContext.id,
          patientName: patientContext.fullName,
          age: patientContext.age,
          sex: patientContext.sex,
          medicalHistory: patientContext.medicalHistory,
          medications: patientContext.medications,
          messages: cleanMessages as AIDoctorMessage[],
          files: filesToSend,
          isVoiceMode: true,
          previousVisits: previousVisits.length > 0 ? previousVisits : undefined,
        });

        clearTimeout(timeout);

        const aiText =
          response.response ||
          response.answerForPatient ||
          "I was not able to clearly understand. Could you please repeat that?";

        addMessage({
          role: "ai",
          content: aiText,
          type: "voice",
          audioData: response.audioData ? `data:${response.audioMimeType || "audio/mp3"};base64,${response.audioData}` : undefined,
          audioMimeType: response.audioMimeType,
        });

        if (response.audioData && response.audioMimeType) {
          playNaturalAudio(response.audioData, response.audioMimeType, aiText);
        } else {
          speakText(aiText);
        }
      } catch (innerErr) {
        clearTimeout(timeout);
        throw innerErr;
      }
    } catch (err) {
      console.error("Voice message failed:", err);
      setRecordingState("idle");
      setRecordingDuration(0);

      const isTimeout =
        err instanceof DOMException && err.name === "AbortError";

      addMessage({
        role: "ai",
        content: isTimeout
          ? "The request took too long. Please try a shorter voice message or switch to text mode."
          : "I apologize, I could not process your voice message. Please try again or switch to text mode.",
        type: "voice",
      });
      toast({
        title: isTimeout ? "Request timed out" : "Voice processing failed",
        description: isTimeout
          ? "The AI doctor took too long to respond. Try a shorter message."
          : err instanceof Error
          ? err.message.substring(0, 150)
          : "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // =============================================
  //  AUDIO PLAYBACK
  // =============================================
  const toggleAudioPlayback = (idx: number, audioDataUrl: string) => {
    if (playingAudioIdx === idx && audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current = null;
      setPlayingAudioIdx(null);
      return;
    }

    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
    }

    const audio = new Audio(audioDataUrl);
    audioPlayerRef.current = audio;
    setPlayingAudioIdx(idx);

    audio.onended = () => {
      setPlayingAudioIdx(null);
      audioPlayerRef.current = null;
    };
    audio.onerror = () => {
      setPlayingAudioIdx(null);
      audioPlayerRef.current = null;
    };

    audio.play().catch(() => {
      setPlayingAudioIdx(null);
      toast({
        title: "Playback error",
        description: "Could not play audio.",
        variant: "destructive",
      });
    });
  };

  // =============================================
  //  FILE PREVIEW (shared between text & voice)
  // =============================================
  const FilePreviewBar = () => {
    if (attachedFiles.length === 0) return null;
    return (
      <div className="mb-2 flex flex-wrap gap-2">
        {attachedFiles.map((file, idx) => (
          <div
            key={idx}
            className="relative flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-3 py-2 text-xs"
          >
            {file.preview ? (
              <img
                src={file.preview}
                alt={file.name}
                className="h-10 w-10 rounded object-cover"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded bg-white/5">
                <FileText className="h-5 w-5 text-emerald-400" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-white truncate max-w-[120px]">
                {file.name}
              </p>
              <p className="text-white/50 text-[10px]">
                {file.type.split("/")[1]?.toUpperCase()}
              </p>
            </div>
            <button
              onClick={() => removeFile(idx)}
              className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500/20 text-red-400 hover:bg-red-500/30"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
    );
  };

  // =============================================
  //  RENDER
  // =============================================

  // Show loading while session initializes
  if (sessionLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#050816] via-[#050816] to-black text-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
          <p className="text-sm text-white/60">Loading your consultation...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#050816] via-[#050816] to-black text-white flex flex-col">
      {/* ========== HEADER ========== */}
      <div className="px-4 pt-4 pb-2 border-b border-white/5 bg-black/40 backdrop-blur-md">
        <div className="flex items-center gap-3 mb-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => (consultMode ? setConsultMode(null) : navigate("/dashboard"))}
            className="text-emerald-300 hover:bg-emerald-500/20 hover:text-emerald-100 p-2 flex-shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 flex-shrink-0">
            <Stethoscope className="w-5 h-5" />
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm uppercase tracking-[0.25em] text-emerald-400/80 truncate">
                Dr. MonitraQ AI
              </span>
              {paymentStatus === "paid" && expiryCountdown && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-medium whitespace-nowrap flex-shrink-0 flex items-center gap-1">
                  <Timer className="w-2.5 h-2.5" />
                  {expiryCountdown}
                </span>
              )}
              {paymentStatus === "expired" && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400 font-medium flex-shrink-0">
                  Expired
                </span>
              )}
            </div>
            <span className="text-lg font-semibold truncate">
              {consultMode === "voice"
                ? "Voice consultation"
                : consultMode === "text"
                ? "Text consultation"
                : paymentStatus === "unpaid"
                ? "Start a new session"
                : paymentStatus === "expired"
                ? "Session ended"
                : "Understand your symptoms safely"}
            </span>
          </div>
          {/* History + New consultation buttons */}
          {allSessions.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={openHistoryViewer}
              className="text-emerald-300 hover:bg-emerald-500/20 hover:text-emerald-100 p-2 flex-shrink-0"
              title="Visit history"
            >
              <Clock className="w-5 h-5" />
            </Button>
          )}
          {hasStarted && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleNewConsultation}
              className="text-emerald-300 hover:bg-emerald-500/20 hover:text-emerald-100 p-2 flex-shrink-0"
              title="New consultation"
            >
              <Plus className="w-5 h-5" />
            </Button>
          )}
        </div>

        {/* Info cards */}
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

      {/* ========== PAYWALL (session unpaid or expired) ========== */}
      {(paymentStatus === "unpaid" || paymentStatus === "expired") && !viewingHistory && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 overflow-y-auto">
          <div className="text-center mb-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-500/10 text-emerald-400 mx-auto mb-4">
              {paymentStatus === "expired" ? (
                <Timer className="w-8 h-8" />
              ) : (
                <Lock className="w-8 h-8" />
              )}
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">
              {paymentStatus === "expired"
                ? "Your session has expired"
                : "Start your AI consultation"}
            </h2>
            <p className="text-sm text-white/50 max-w-xs mx-auto">
              {paymentStatus === "expired"
                ? "Your 24-hour consultation window has ended. Start a new session to continue chatting with Dr. MonitraQ."
                : "Choose a consultation mode and pay once to unlock a full 24-hour session with Dr. MonitraQ."}
            </p>
          </div>

          {/* Pricing cards */}
          <div className="grid grid-cols-1 gap-3 w-full max-w-sm">
            {/* Text card */}
            <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
                    <Keyboard className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">Text Consultation</p>
                    <p className="text-[11px] text-white/40">Type symptoms, get AI responses</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-white">
                    ₹{pricing ? pricing.price_text_paise / 100 : "…"}
                  </p>
                  <p className="text-[10px] text-white/40">24h access</p>
                </div>
              </div>
              <Button
                className="w-full bg-blue-500 hover:bg-blue-400 text-white h-10"
                disabled={isPaymentLoading || !pricing}
                onClick={() => handlePayForConsult("text")}
              >
                {isPaymentLoading && payingMode === "text" ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing…</>
                ) : (
                  <><CreditCard className="w-4 h-4 mr-2" /> Pay & Start</>
                )}
              </Button>
            </div>

            {/* Voice card */}
            <div className="rounded-2xl bg-white/5 border border-emerald-500/20 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
                    <Mic className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">Voice Consultation</p>
                    <p className="text-[11px] text-white/40">Speak & hear Dr. MonitraQ reply</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-emerald-400">
                    ₹{pricing ? pricing.price_voice_paise / 100 : "…"}
                  </p>
                  <p className="text-[10px] text-white/40">24h access</p>
                </div>
              </div>
              <Button
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-black h-10"
                disabled={isPaymentLoading || !pricing}
                onClick={() => handlePayForConsult("voice")}
              >
                {isPaymentLoading && payingMode === "voice" ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing…</>
                ) : (
                  <><CreditCard className="w-4 h-4 mr-2" /> Pay & Start</>
                )}
              </Button>
            </div>
          </div>

          {/* What you get */}
          <div className="mt-4 w-full max-w-sm rounded-xl bg-white/[0.03] border border-white/5 px-4 py-3 space-y-1.5 text-xs text-white/40">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400/60 flex-shrink-0" />
              <span>Full 24-hour session – unlimited messages</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400/60 flex-shrink-0" />
              <span>Attach X-rays, lab reports, and medical files</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400/60 flex-shrink-0" />
              <span>Conversation saved — view history anytime after</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400/60 flex-shrink-0" />
              <span>Powered by Google Med-Gemini 2.5 Flash</span>
            </div>
          </div>

          {/* View past sessions */}
          {allSessions.filter(s => s.payment_status === "paid").length > 0 && (
            <button
              onClick={openHistoryViewer}
              className="mt-4 flex items-center gap-1.5 text-xs text-emerald-400/70 hover:text-emerald-300 transition-colors"
            >
              <Clock className="w-3.5 h-3.5" />
              View previous consultations (read-only)
            </button>
          )}

          <p className="mt-5 text-[10px] text-white/20 text-center max-w-xs">
            Payments are processed securely via Razorpay. Dr. MonitraQ is an AI assistant, not a substitute for professional medical care.
          </p>
        </div>
      )}

      {/* ========== MODE SELECTION (no mode chosen yet, session is paid) ========== */}
      {paymentStatus === "paid" && !consultMode && (
        <div className="flex-1 flex flex-col items-center px-6 py-6 overflow-y-auto">
          <div className="text-center mb-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-500/10 text-emerald-400 mx-auto mb-4">
              <Stethoscope className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">
              How would you like to consult?
            </h2>
            <p className="text-sm text-white/50">
              Choose your preferred way to describe your symptoms
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 w-full max-w-sm">
            <button
              onClick={() => setConsultMode("text")}
              className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all active:scale-[0.97]"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400">
                <Keyboard className="w-7 h-7" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-white">Text</p>
                <p className="text-[11px] text-white/50 mt-1">
                  Type your symptoms
                </p>
              </div>
            </button>

            <button
              onClick={() => setConsultMode("voice")}
              className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all active:scale-[0.97]"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400">
                <Mic className="w-7 h-7" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-white">Voice</p>
                <p className="text-[11px] text-white/50 mt-1">
                  Speak your symptoms
                </p>
              </div>
            </button>
          </div>

          <p className="mt-4 text-[11px] text-white/30 text-center max-w-xs">
            You can switch between text and voice at any time during the consultation.
          </p>

          {/* ========== PREVIOUS CONSULTATIONS ========== */}
          {pastSessions.length > 0 && (
            <div className="mt-6 w-full max-w-sm">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="flex items-center justify-between w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/[0.07] transition-colors"
              >
                <div className="flex items-center gap-2 text-sm text-white/70">
                  <Clock className="w-4 h-4 text-emerald-400/60" />
                  <span>Previous consultations ({pastSessions.length})</span>
                </div>
                {showHistory ? (
                  <ChevronUp className="w-4 h-4 text-white/40" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-white/40" />
                )}
              </button>

              {showHistory && (
                <div className="mt-2 space-y-1.5 max-h-60 overflow-y-auto">
                  {pastSessions.map((session) => (
                    <button
                      key={session.id}
                      onClick={() => handleLoadSession(session)}
                      className="w-full text-left px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] hover:border-emerald-500/20 transition-all"
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-medium text-white/80 truncate max-w-[70%]">
                          {session.title || "Consultation"}
                        </span>
                        <span className="text-[10px] text-white/40 flex-shrink-0">
                          {formatSessionDate(session.updated_at)}
                        </span>
                      </div>
                      {session.summary && (
                        <p className="text-[11px] text-white/40 line-clamp-2 leading-relaxed">
                          {session.summary}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========== HISTORY VIEWER (full-screen overlay) ========== */}
      {viewingHistory && (
        <div className="fixed inset-0 z-50 bg-gradient-to-b from-[#050816] via-[#050816] to-black text-white flex flex-col">
          {/* History header */}
          <div className="px-4 pt-4 pb-3 border-b border-white/5 bg-black/40 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (viewingSession) {
                    setViewingSession(null);
                    setHistoryMessages([]);
                  } else {
                    setViewingHistory(false);
                  }
                }}
                className="text-emerald-300 hover:bg-emerald-500/20 hover:text-emerald-100 p-2 flex-shrink-0"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 flex-shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-sm uppercase tracking-[0.25em] text-emerald-400/80">
                  Visit History
                </span>
                <span className="text-lg font-semibold truncate">
                  {viewingSession
                    ? new Date(viewingSession.created_at).toLocaleDateString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : `${allSessions.length} consultation${allSessions.length !== 1 ? "s" : ""}`}
                </span>
              </div>
              {viewingSession && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => continueSession(viewingSession)}
                  className="text-emerald-300 hover:bg-emerald-500/20 hover:text-emerald-100 px-3 flex-shrink-0 text-xs"
                >
                  Continue
                </Button>
              )}
            </div>
          </div>

          {/* ---- Session list ---- */}
          {!viewingSession && (
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
              {allSessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <Clock className="w-12 h-12 text-white/10 mb-3" />
                  <p className="text-sm text-white/40">No consultations yet</p>
                  <p className="text-xs text-white/25 mt-1">
                    Your AI doctor visit history will appear here
                  </p>
                </div>
              ) : (
                allSessions.map((session, idx) => {
                  const isCurrent = session.id === sessionId;
                  return (
                    <button
                      key={session.id}
                      onClick={() => viewSessionDetail(session)}
                      className={`w-full text-left px-4 py-3.5 rounded-xl border transition-all active:scale-[0.99] ${
                        isCurrent
                          ? "bg-emerald-500/5 border-emerald-500/20 hover:bg-emerald-500/10"
                          : "bg-white/[0.03] border-white/5 hover:bg-white/[0.06] hover:border-emerald-500/20"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <div className={`flex h-7 w-7 items-center justify-center rounded-lg flex-shrink-0 ${
                              isCurrent
                                ? "bg-emerald-500/20 text-emerald-400"
                                : "bg-emerald-500/10 text-emerald-400"
                            }`}>
                              <Stethoscope className="w-3.5 h-3.5" />
                            </div>
                            <span className="text-sm font-medium text-white/90 truncate">
                              Consultation #{allSessions.length - idx}
                            </span>
                            {isCurrent && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-medium flex-shrink-0">
                                Active
                              </span>
                            )}
                          </div>
                          {session.summary && (
                            <p className="text-xs text-white/40 line-clamp-2 leading-relaxed ml-9">
                              {session.summary}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          <span className="text-[10px] text-white/40">
                            {formatSessionDate(session.updated_at)}
                          </span>
                          <span className="text-[10px] text-emerald-400/50">
                            {new Date(session.created_at).toLocaleTimeString(undefined, {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          )}

          {/* ---- Session detail (messages) ---- */}
          {viewingSession && (
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {historyLoading ? (
                <div className="flex flex-col items-center justify-center h-full">
                  <Loader2 className="w-6 h-6 text-emerald-400 animate-spin mb-2" />
                  <p className="text-xs text-white/50">Loading conversation...</p>
                </div>
              ) : historyMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <p className="text-sm text-white/40">No messages in this session</p>
                </div>
              ) : (
                <>
                  {/* Date banner */}
                  <div className="flex justify-center mb-2">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] text-white/40">
                      <Clock className="w-3 h-3" />
                      <span>
                        {new Date(viewingSession.created_at).toLocaleDateString(undefined, {
                          weekday: "long",
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                  </div>

                  {historyMessages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex ${
                        msg.role === "patient" ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                          msg.role === "patient"
                            ? "bg-emerald-500/80 text-black rounded-br-sm"
                            : "bg-white/5 text-white border border-white/10 rounded-bl-sm"
                        }`}
                      >
                        {/* Voice indicator */}
                        {msg.type === "voice" && msg.role === "patient" && (
                          <div className="flex items-center gap-2 mb-1">
                            <Mic className="w-3 h-3 opacity-60" />
                            <span className="text-xs font-medium opacity-70">
                              {msg.audioDuration
                                ? formatDuration(msg.audioDuration)
                                : "Voice message"}
                            </span>
                          </div>
                        )}
                        {msg.type === "voice" && msg.role === "ai" && (
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <Volume2 className="w-3 h-3 text-emerald-400/60" />
                            <span className="text-[10px] text-emerald-400/60">Voice response</span>
                          </div>
                        )}

                        {/* Message content */}
                        {msg.role === "patient" ? (
                          <div className="whitespace-pre-line">{msg.content}</div>
                        ) : (
                          <div className="markdown-content">
                            <ReactMarkdown
                              components={{
                                p: ({ children }) => (
                                  <p className="mb-2 last:mb-0">{children}</p>
                                ),
                                strong: ({ children }) => (
                                  <strong className="font-bold text-emerald-300">
                                    {children}
                                  </strong>
                                ),
                                em: ({ children }) => (
                                  <em className="italic">{children}</em>
                                ),
                                ul: ({ children }) => (
                                  <ul className="list-disc ml-4 mb-2 space-y-1">
                                    {children}
                                  </ul>
                                ),
                                ol: ({ children }) => (
                                  <ol className="list-decimal ml-4 mb-2 space-y-1">
                                    {children}
                                  </ol>
                                ),
                                li: ({ children }) => (
                                  <li className="ml-1">{children}</li>
                                ),
                                h1: ({ children }) => (
                                  <h1 className="text-lg font-bold mb-2 text-emerald-300">
                                    {children}
                                  </h1>
                                ),
                                h2: ({ children }) => (
                                  <h2 className="text-base font-bold mb-2 text-emerald-300">
                                    {children}
                                  </h2>
                                ),
                                h3: ({ children }) => (
                                  <h3 className="text-sm font-bold mb-1 text-emerald-300">
                                    {children}
                                  </h3>
                                ),
                              }}
                            >
                              {msg.content}
                            </ReactMarkdown>
                          </div>
                        )}

                        {/* Timestamp */}
                        {msg.timestamp && (
                          <p className={`text-[9px] mt-1.5 ${
                            msg.role === "patient" ? "text-black/40" : "text-white/25"
                          }`}>
                            {new Date(msg.timestamp).toLocaleTimeString(undefined, {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* End of conversation marker */}
                  <div className="flex justify-center pt-2 pb-4">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 text-[10px] text-white/30">
                      End of consultation
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========== CHAT AREA (mode selected, session paid or viewing expired) ========== */}
      {consultMode && (paymentStatus === "paid" || paymentStatus === "expired") && (
        <>
          {/* Expired read-only banner */}
          {paymentStatus === "expired" && (
            <div className="mx-4 mt-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-amber-200/80">
                <Timer className="w-4 h-4 flex-shrink-0" />
                <span>This session has expired. Chat is read-only.</span>
              </div>
              <Button
                size="sm"
                className="h-7 px-3 text-xs bg-emerald-500 hover:bg-emerald-400 text-black flex-shrink-0"
                onClick={handleNewConsultation}
              >
                New session
              </Button>
            </div>
          )}

          {/* Quick-start (text mode, not started) */}
          {!hasStarted && consultMode === "text" && paymentStatus === "paid" && (
            <div className="px-4 pt-3 pb-2">
              <p className="text-xs text-white/70 mb-2">
                You can type your symptoms in your own words, or start with one
                of these:
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

          {/* Voice mode prompt (not started) */}
          {!hasStarted && consultMode === "voice" && paymentStatus === "paid" && (
            <div className="px-4 pt-6 pb-2 flex flex-col items-center text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 mb-3">
                <Mic className="w-6 h-6" />
              </div>
              <p className="text-sm text-white/80 mb-1">
                Tap the microphone below and describe your symptoms
              </p>
              <p className="text-xs text-white/40">
                Speak naturally, as if you&apos;re talking to your doctor.
                You can also attach files (X-rays, reports) before recording.
              </p>
            </div>
          )}

          {/* ========== MESSAGES ========== */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {/* Previous visit context banner */}
            {previousVisits.length > 0 && messages.length === 0 && (
              <div className="flex justify-center mb-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-300/80">
                  <Clock className="w-3 h-3" />
                  <span>Dr. MonitraQ remembers your {previousVisits.length} previous visit{previousVisits.length > 1 ? "s" : ""}</span>
                </div>
              </div>
            )}

            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${
                  msg.role === "patient" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                    msg.role === "patient"
                      ? "bg-emerald-500 text-black rounded-br-sm"
                      : "bg-white/5 text-white border border-white/10 rounded-bl-sm"
                  }`}
                >
                  {/* --- Patient voice bubble --- */}
                  {msg.type === "voice" && msg.role === "patient" && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          msg.audioData && toggleAudioPlayback(idx, msg.audioData)
                        }
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-black/20 flex-shrink-0"
                      >
                        {playingAudioIdx === idx ? (
                          <Pause className="w-4 h-4" />
                        ) : (
                          <Play className="w-4 h-4 ml-0.5" />
                        )}
                      </button>
                      <div className="flex items-center gap-1.5">
                        <Mic className="w-3 h-3 opacity-60" />
                        <span className="text-xs font-medium">
                          {msg.audioDuration
                            ? formatDuration(msg.audioDuration)
                            : "Voice"}
                        </span>
                      </div>
                      <div className="flex items-center gap-[2px] ml-1">
                        {[3, 5, 8, 4, 7, 3, 6, 4, 5, 7, 3, 5, 4, 6, 3].map(
                          (h, i) => (
                            <div
                              key={i}
                              className="w-[2px] rounded-full bg-black/30"
                              style={{ height: `${h * 2}px` }}
                            />
                          )
                        )}
                      </div>
                    </div>
                  )}

                  {/* --- AI voice bubble --- */}
                  {msg.type === "voice" && msg.role === "ai" && (
                    <>
                      <div className="flex items-center gap-2 p-2 mb-2 rounded-lg bg-white/5">
                        <button
                          onClick={() => {
                            if (isSpeaking) {
                              stopSpeaking();
                            } else if (msg.audioData && msg.audioMimeType) {
                              const b64 = msg.audioData.includes("base64,")
                                ? msg.audioData.split("base64,")[1]
                                : msg.audioData;
                              playNaturalAudio(b64, msg.audioMimeType, msg.content);
                            } else {
                              speakText(msg.content);
                            }
                          }}
                          className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 flex-shrink-0"
                        >
                          {isSpeaking ? (
                            <Pause className="w-4 h-4" />
                          ) : (
                            <Play className="w-4 h-4 ml-0.5" />
                          )}
                        </button>
                        <div className="flex-1 flex items-center gap-[2px]">
                          {[
                            2, 4, 6, 3, 7, 5, 8, 4, 6, 3, 5, 7, 4, 6, 8, 3,
                            5, 4, 7, 3, 6, 5, 4, 3,
                          ].map((h, i) => (
                            <div
                              key={i}
                              className={`w-[2px] rounded-full transition-colors ${
                                isSpeaking
                                  ? "bg-emerald-400"
                                  : "bg-white/20"
                              }`}
                              style={{ height: `${h * 2}px` }}
                            />
                          ))}
                        </div>
                        <Volume2 className="w-3.5 h-3.5 text-emerald-400/50 flex-shrink-0" />
                      </div>
                      <div className="markdown-content">
                        <ReactMarkdown
                          components={{
                            p: ({ children }) => (
                              <p className="mb-2 last:mb-0">{children}</p>
                            ),
                            strong: ({ children }) => (
                              <strong className="font-bold text-emerald-300">
                                {children}
                              </strong>
                            ),
                            em: ({ children }) => (
                              <em className="italic">{children}</em>
                            ),
                            ul: ({ children }) => (
                              <ul className="list-disc ml-4 mb-2 space-y-1">
                                {children}
                              </ul>
                            ),
                            ol: ({ children }) => (
                              <ol className="list-decimal ml-4 mb-2 space-y-1">
                                {children}
                              </ol>
                            ),
                            li: ({ children }) => (
                              <li className="ml-1">{children}</li>
                            ),
                            h1: ({ children }) => (
                              <h1 className="text-lg font-bold mb-2 text-emerald-300">
                                {children}
                              </h1>
                            ),
                            h2: ({ children }) => (
                              <h2 className="text-base font-bold mb-2 text-emerald-300">
                                {children}
                              </h2>
                            ),
                            h3: ({ children }) => (
                              <h3 className="text-sm font-bold mb-1 text-emerald-300">
                                {children}
                              </h3>
                            ),
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    </>
                  )}

                  {/* --- Text messages --- */}
                  {msg.type !== "voice" && msg.role === "patient" && (
                    <div className="whitespace-pre-line">{msg.content}</div>
                  )}

                  {msg.type !== "voice" && msg.role === "ai" && (
                    <div className="markdown-content">
                      <ReactMarkdown
                        components={{
                          p: ({ children }) => (
                            <p className="mb-2 last:mb-0">{children}</p>
                          ),
                          strong: ({ children }) => (
                            <strong className="font-bold text-emerald-300">
                              {children}
                            </strong>
                          ),
                          em: ({ children }) => (
                            <em className="italic">{children}</em>
                          ),
                          ul: ({ children }) => (
                            <ul className="list-disc ml-4 mb-2 space-y-1">
                              {children}
                            </ul>
                          ),
                          ol: ({ children }) => (
                            <ol className="list-decimal ml-4 mb-2 space-y-1">
                              {children}
                            </ol>
                          ),
                          li: ({ children }) => (
                            <li className="ml-1">{children}</li>
                          ),
                          h1: ({ children }) => (
                            <h1 className="text-lg font-bold mb-2 text-emerald-300">
                              {children}
                            </h1>
                          ),
                          h2: ({ children }) => (
                            <h2 className="text-base font-bold mb-2 text-emerald-300">
                              {children}
                            </h2>
                          ),
                          h3: ({ children }) => (
                            <h3 className="text-sm font-bold mb-1 text-emerald-300">
                              {children}
                            </h3>
                          ),
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Loading */}
            {isLoading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl bg-white/5 border border-white/10 px-3 py-2 text-xs text-white/80">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>
                    {consultMode === "voice"
                      ? "The AI doctor is listening and thinking..."
                      : "The AI doctor is thinking..."}
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* ========== INPUT AREA (hidden when session expired) ========== */}
          {paymentStatus === "expired" && (
            <div className="border-t border-white/10 bg-black/60 backdrop-blur-md px-4 py-4 flex items-center justify-center gap-3">
              <Lock className="w-4 h-4 text-white/30" />
              <span className="text-xs text-white/40">Session expired — start a new session to continue</span>
              <Button
                size="sm"
                className="h-7 px-3 text-xs bg-emerald-500 hover:bg-emerald-400 text-black"
                onClick={handleNewConsultation}
              >
                New session
              </Button>
            </div>
          )}
          <div className={`border-t border-white/10 bg-black/60 backdrop-blur-md px-3 py-2 ${paymentStatus === "expired" ? "hidden" : ""}`}>
            {/* Hidden file input (shared) */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp,.pdf,.txt"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />

            {/* Mode toggle */}
            <div className="flex justify-center mb-2">
              <div className="inline-flex bg-white/5 rounded-lg p-0.5 gap-0.5">
                <button
                  onClick={() => setConsultMode("text")}
                  className={`px-3 py-1.5 rounded-md text-xs flex items-center gap-1.5 transition-all ${
                    consultMode === "text"
                      ? "bg-emerald-500 text-black font-medium"
                      : "text-white/50 hover:text-white/80"
                  }`}
                >
                  <Keyboard className="w-3 h-3" />
                  Text
                </button>
                <button
                  onClick={() => setConsultMode("voice")}
                  className={`px-3 py-1.5 rounded-md text-xs flex items-center gap-1.5 transition-all ${
                    consultMode === "voice"
                      ? "bg-emerald-500 text-black font-medium"
                      : "text-white/50 hover:text-white/80"
                  }`}
                >
                  <Mic className="w-3 h-3" />
                  Voice
                </button>
              </div>
            </div>

            {/* ---------- TEXT INPUT ---------- */}
            {consultMode === "text" && (
              <>
                <FilePreviewBar />
                <div className="flex items-end gap-2">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-[52px] w-[52px] rounded-2xl text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isLoading}
                  >
                    <Paperclip className="h-5 w-5" />
                  </Button>
                  <Textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Describe your symptoms or attach medical reports..."
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
                    disabled={
                      isLoading ||
                      (!input.trim() && attachedFiles.length === 0)
                    }
                  >
                    {isLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Send className="h-5 w-5" />
                    )}
                  </Button>
                </div>
                <p className="mt-1 text-[10px] text-white/50">
                  Attach lab reports, X-rays, or medical documents (max 5MB,
                  JPEG/PNG/PDF/TXT). AI powered by Google Med-Gemini 2.5 Flash.
                </p>
              </>
            )}

            {/* ---------- VOICE INPUT ---------- */}
            {consultMode === "voice" && (
              <div className="py-2">
                {/* File previews for voice mode */}
                <FilePreviewBar />

                {/* Idle */}
                {recordingState === "idle" && !isLoading && (
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex items-center gap-4">
                      {/* Attach file button */}
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="h-12 w-12 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 flex items-center justify-center text-emerald-400 transition-all active:scale-95"
                        title="Attach file"
                      >
                        <Paperclip className="w-5 h-5" />
                      </button>

                      {/* Mic button */}
                      <button
                        onClick={startRecording}
                        className="h-16 w-16 rounded-full bg-emerald-500 hover:bg-emerald-400 flex items-center justify-center text-black shadow-lg shadow-emerald-500/25 transition-all active:scale-95"
                      >
                        <Mic className="w-7 h-7" />
                      </button>

                      {/* Spacer to center mic */}
                      <div className="h-12 w-12" />
                    </div>
                    <p className="text-xs text-white/50">
                      {attachedFiles.length > 0
                        ? `${attachedFiles.length} file${attachedFiles.length > 1 ? "s" : ""} attached — tap mic to describe`
                        : "Tap mic to speak, or attach a file first"}
                    </p>
                  </div>
                )}

                {/* Recording */}
                {recordingState === "recording" && (
                  <div className="flex flex-col items-center gap-3">
                    <div className="relative">
                      <div className="absolute inset-[-8px] rounded-full bg-red-500/20 animate-ping" />
                      <div className="absolute inset-[-4px] rounded-full bg-red-500/10 animate-pulse" />
                      <button
                        onClick={stopRecording}
                        className="relative h-16 w-16 rounded-full bg-red-500 hover:bg-red-400 flex items-center justify-center text-white shadow-lg shadow-red-500/25 transition-all active:scale-95"
                      >
                        <Square className="w-6 h-6 fill-white" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                      <span
                        className={`text-sm font-mono ${
                          recordingDuration >= 50
                            ? "text-orange-400"
                            : "text-red-400"
                        }`}
                      >
                        {formatDuration(recordingDuration)}
                      </span>
                      {recordingDuration >= 50 && (
                        <span className="text-[10px] text-orange-400/70">
                          ({MAX_RECORDING_SECONDS - recordingDuration}s left)
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-white/50">
                      Tap the square to stop recording
                    </p>
                  </div>
                )}

                {/* Processing */}
                {(recordingState === "processing" || isLoading) && (
                  <div className="flex flex-col items-center gap-2">
                    <div className="h-16 w-16 rounded-full bg-white/10 flex items-center justify-center">
                      <Loader2 className="w-7 h-7 text-emerald-400 animate-spin" />
                    </div>
                    <p className="text-xs text-white/50">
                      {isLoading
                        ? "AI doctor is analyzing..."
                        : "Processing voice..."}
                    </p>
                  </div>
                )}

                <p className="mt-3 text-center text-[10px] text-white/40">
                  Speak naturally in any language (max 60s). Attach X-rays or
                  reports before recording. AI powered by Med-Gemini 2.5 Flash.
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

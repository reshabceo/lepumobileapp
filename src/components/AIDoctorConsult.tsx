import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { runAIDoctorConsult, AIDoctorMessage, UploadedFile } from "@/services/aiDoctorService";
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
  Image as ImageIcon,
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

interface AttachedFile {
  name: string;
  type: string;
  data: string; // base64
  preview?: string; // for images
}

export const AIDoctorConsult: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [patientContext, setPatientContext] = useState<PatientContext>({});
  const [messages, setMessages] = useState<AIDoctorMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newFiles: AttachedFile[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Check file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: `${file.name} is larger than 10MB. Please choose a smaller file.`,
          variant: "destructive",
        });
        continue;
      }

      // Check file type
      const allowedTypes = [
        'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain'
      ];

      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "Unsupported file type",
          description: `${file.name} is not a supported format. Please use images, PDFs, or documents.`,
          variant: "destructive",
        });
        continue;
      }

      try {
        const base64 = await fileToBase64(file);
        const attached: AttachedFile = {
          name: file.name,
          type: file.type,
          data: base64,
        };

        // Generate preview for images
        if (file.type.startsWith('image/')) {
          attached.preview = `data:${file.type};base64,${base64}`;
        }

        newFiles.push(attached);
      } catch (err) {
        console.error('Failed to read file:', err);
        toast({
          title: "Upload failed",
          description: `Could not read ${file.name}. Please try again.`,
          variant: "destructive",
        });
      }
    }

    setAttachedFiles((prev) => [...prev, ...newFiles]);
    
    // Clear the input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove the data URL prefix to get just the base64 string
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const removeFile = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSend = async () => {
    if ((!input.trim() && attachedFiles.length === 0) || isLoading) return;

    const patientMessage: AIDoctorMessage = {
      role: "patient",
      content: input.trim() || "(Sent medical files for review)",
    };

    addMessage(patientMessage);
    
    const messageCopy = input.trim();
    const filesCopy = [...attachedFiles];
    
    setInput("");
    setAttachedFiles([]);
    setIsLoading(true);
    setHasStarted(true);

    try {
      const uploadedFiles: UploadedFile[] = filesCopy.map(f => ({
        mimeType: f.type,
        data: f.data,
      }));

      const response = await runAIDoctorConsult({
        patientId: patientContext.id,
        age: patientContext.age,
        sex: patientContext.sex,
        symptoms: messageCopy,
        medicalHistory: patientContext.medicalHistory,
        medications: patientContext.medications,
        messages,
        files: uploadedFiles.length > 0 ? uploadedFiles : undefined,
      });

      // Handle new conversational format OR legacy format
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
        <div className="flex items-center gap-3 mb-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/dashboard')}
            className="text-emerald-300 hover:bg-emerald-500/20 hover:text-emerald-100 p-2 flex-shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 flex-shrink-0">
            <Stethoscope className="w-5 h-5" />
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-sm uppercase tracking-[0.25em] text-emerald-400/80 truncate">
              Med-Gemini AI Doctor
            </span>
            <span className="text-lg font-semibold truncate">
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
              className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                msg.role === "patient"
                  ? "bg-emerald-500 text-black rounded-br-sm"
                  : "bg-white/5 text-white border border-white/10 rounded-bl-sm"
              }`}
            >
              {msg.role === "patient" ? (
                <div className="whitespace-pre-line">{msg.content}</div>
              ) : (
                <div className="markdown-content">
                  <ReactMarkdown
                    components={{
                      p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                      strong: ({ children }) => <strong className="font-bold text-emerald-300">{children}</strong>,
                      em: ({ children }) => <em className="italic">{children}</em>,
                      ul: ({ children }) => <ul className="list-disc ml-4 mb-2 space-y-1">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal ml-4 mb-2 space-y-1">{children}</ol>,
                      li: ({ children }) => <li className="ml-1">{children}</li>,
                      h1: ({ children }) => <h1 className="text-lg font-bold mb-2 text-emerald-300">{children}</h1>,
                      h2: ({ children }) => <h2 className="text-base font-bold mb-2 text-emerald-300">{children}</h2>,
                      h3: ({ children }) => <h3 className="text-sm font-bold mb-1 text-emerald-300">{children}</h3>,
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                </div>
              )}
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
        {/* File Preview Section */}
        {attachedFiles.length > 0 && (
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
                  <p className="text-white truncate max-w-[120px]">{file.name}</p>
                  <p className="text-white/50 text-[10px]">
                    {file.type.split('/')[1]?.toUpperCase()}
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
        )}

        <div className="flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf,.doc,.docx,.txt"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
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
            disabled={isLoading || (!input.trim() && attachedFiles.length === 0)}
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </div>
        <p className="mt-1 text-[10px] text-white/50">
          📎 Attach lab reports, X-rays, or medical documents (max 10MB each). This AI doctor uses Google Med-Gemini 2.5 Flash for medical reasoning.
        </p>
      </div>
    </div>
  );
};
















import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, UserCheck, Users, Loader2, WifiOff, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { MobileAppContainer } from "@/components/MobileAppContainer";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

interface CareTeamMember {
  assignment_id: string;
  doctor_id: string;
  full_name: string;
  specialty: string | null;
  profile_picture_url: string | null;
  doctor_code: string;
  role: "primary" | "secondary" | "tertiary";
  is_on_shift: boolean;
  notes: string | null;
  assigned_by_name: string | null;
  created_at: string;
}

interface AvailabilitySlot {
  day_of_week: number | null;
  specific_date: string | null;
  start_time: string;
  end_time: string;
  is_recurring: boolean;
  is_active: boolean;
  is_available: boolean;
}

function isWithinSchedule(slots: AvailabilitySlot[]): boolean {
  const now = new Date();
  const todayDow = now.getDay();
  const todayDate = now.toISOString().split("T")[0];
  const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  return slots.some((s) => {
    if (!s.is_active || !s.is_available) return false;
    const inWindow = hhmm >= s.start_time && hhmm < s.end_time;
    if (s.is_recurring && s.day_of_week === todayDow) return inWindow;
    if (!s.is_recurring && s.specific_date === todayDate) return inWindow;
    return false;
  });
}

const ROLE_LABEL: Record<string, string> = {
  primary: "1st",
  secondary: "2nd",
  tertiary: "3rd",
  quaternary: "4th",
};

const ROLE_STYLE: Record<string, string> = {
  primary: "bg-indigo-500/20 text-indigo-300 border-indigo-400/30",
  secondary: "bg-sky-500/20 text-sky-300 border-sky-400/30",
  tertiary: "bg-purple-500/20 text-purple-300 border-purple-400/30",
  quaternary: "bg-amber-500/20 text-amber-300 border-amber-400/30",
};

export default function MyCareTeam() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [members, setMembers] = useState<CareTeamMember[]>([]);
  const [onShiftMap, setOnShiftMap] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    const { data: patientRow, error: patientErr } = await supabase
      .from("patients")
      .select("id")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (patientErr || !patientRow) {
      setError("Could not load patient profile.");
      setLoading(false);
      return;
    }

    const { data, error: rpcError } = await supabase.rpc("get_patient_care_team", {
      p_patient_id: patientRow.id,
    });

    if (rpcError) {
      setError("Could not load care team.");
      setLoading(false);
      return;
    }

    const teamMembers = (data as CareTeamMember[]) || [];
    setMembers(teamMembers);

    // Batch-fetch availability to compute real on-shift status from schedule
    const doctorIds = teamMembers.map((m) => m.doctor_id);
    if (doctorIds.length > 0) {
      const { data: slots } = await (supabase as any)
        .from("doctor_availability")
        .select("doctor_id, day_of_week, specific_date, start_time, end_time, is_recurring, is_active, is_available")
        .in("doctor_id", doctorIds)
        .eq("is_active", true);

      const slotsByDoctor: Record<string, AvailabilitySlot[]> = {};
      (slots || []).forEach((s: any) => {
        if (!slotsByDoctor[s.doctor_id]) slotsByDoctor[s.doctor_id] = [];
        slotsByDoctor[s.doctor_id].push(s);
      });

      const shiftMap: Record<string, boolean> = {};
      doctorIds.forEach((id) => {
        shiftMap[id] = isWithinSchedule(slotsByDoctor[id] || []);
      });
      setOnShiftMap(shiftMap);
    }

    setLoading(false);
  }, [user]);

  useEffect(() => { void load(); }, [load]);

  // Realtime — refresh when assignments change
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("care_team_patient_view")
      .on("postgres_changes", { event: "*", schema: "public", table: "patient_doctor_assignments" }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [user, load]);

  const primaryDoctor = members.find((m) => m.role === "primary");
  const backupDoctors = members.filter((m) => m.role !== "primary");
  const currentlyOnShift = members.filter((m) => onShiftMap[m.doctor_id]);

  return (
    <MobileAppContainer>
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
        {/* Header */}
        <div className="sticky top-0 z-20 bg-slate-950/90 backdrop-blur-lg border-b border-white/10 px-4 pt-safe-top pb-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/15 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-white">My Care Team</h1>
            <p className="text-xs text-slate-400">Doctors assigned to your care</p>
          </div>
        </div>

        <div className="px-4 py-6 space-y-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
              <p className="text-sm">Loading your care team…</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-red-400">
              <WifiOff className="w-8 h-8" />
              <p className="text-sm">{error}</p>
            </div>
          ) : members.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
              <Users className="w-10 h-10 text-slate-600" />
              <p className="text-sm font-medium">No doctors assigned yet</p>
              <p className="text-xs text-slate-500 text-center max-w-xs">
                Use the Doctor page to get assigned to a doctor.
              </p>
            </div>
          ) : (
            <>
              {/* Currently on shift banner */}
              {currentlyOnShift.length > 0 && (
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/30 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-emerald-300 text-sm font-semibold">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block" />
                    Currently observing your health
                  </div>
                  {currentlyOnShift.map((m) => (
                    <DoctorCard key={m.assignment_id} member={m} isOnShift />
                  ))}
                </div>
              )}

              {/* Primary doctor */}
              <Section title="Primary Doctor">
                {primaryDoctor
                  ? <DoctorCard member={primaryDoctor} isOnShift={onShiftMap[primaryDoctor.doctor_id] ?? false} />
                  : <p className="text-slate-500 text-sm">No primary doctor assigned.</p>}
              </Section>

              {/* Backup doctors */}
              {backupDoctors.length > 0 && (
                <Section title="Backup Doctors">
                  <div className="space-y-3">
                    {backupDoctors.map((m) => (
                      <DoctorCard key={m.assignment_id} member={m} isOnShift={onShiftMap[m.doctor_id] ?? false} />
                    ))}
                  </div>
                </Section>
              )}

              <p className="text-xs text-slate-600 text-center">
                Backup doctors can view your vitals and provide care when your primary doctor is unavailable.
              </p>
            </>
          )}
        </div>
      </div>
    </MobileAppContainer>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-widest mb-3">{title}</p>
      {children}
    </div>
  );
}

function DoctorCard({ member, isOnShift }: { member: CareTeamMember; isOnShift: boolean }) {
  return (
    <div className="flex items-center gap-4 p-4 rounded-2xl border bg-white/5 border-white/10">
      {/* Avatar */}
      <div className="w-12 h-12 rounded-2xl overflow-hidden bg-white/10 shrink-0 flex items-center justify-center">
        {member.profile_picture_url
          ? <img src={member.profile_picture_url} alt={member.full_name} className="w-full h-full object-cover" />
          : <UserCheck className="w-6 h-6 text-slate-400" />}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-white font-semibold text-sm truncate">{member.full_name}</p>
        {member.specialty && <p className="text-slate-400 text-xs truncate">{member.specialty}</p>}
        {member.notes && <p className="text-slate-500 text-xs truncate mt-0.5">{member.notes}</p>}
      </div>

      {/* Badges */}
      <div className="flex flex-col items-end gap-1.5 shrink-0">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${ROLE_STYLE[member.role] || ROLE_STYLE.secondary}`}>
          {ROLE_LABEL[member.role]}
        </span>
        {isOnShift ? (
          <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
            On shift
          </span>
        ) : (
          <span className="flex items-center gap-1 text-[10px] text-white/30 px-2 py-0.5 rounded-full border border-white/10">
            <Clock className="w-2.5 h-2.5" />
            Off shift
          </span>
        )}
      </div>
    </div>
  );
}

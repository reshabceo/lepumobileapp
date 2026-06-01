/**
 * CareContextHistory.tsx
 *
 * Patient-facing view of all care contexts in their `abha_care_contexts` rows.
 *
 * Shows:
 *   - Each care context (1 per appointment / report / prescription / discharge)
 *   - Whether it's linked to ABHA (✓) or pending (○)
 *
 * Care contexts are auto-populated by DB triggers when the patient has an
 * `abha_address` set (see migration 20260615000003_care_context_auto_population.sql).
 *
 * Linking happens via the ABDM link/init + link/confirm flow — this page just
 * shows the result.
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft, Link2, CheckCircle2, Circle, Loader2,
  Stethoscope, Pill, FileText, ScrollText, Search, RefreshCw
} from 'lucide-react';

interface CareContext {
  id:               string;
  reference_number: string;
  display:          string;
  hi_types:         string[];
  linked_to_abha:   boolean;
  linked_at:        string | null;
  created_at:       string;
}

const HI_TYPE_ICON: Record<string, React.ComponentType<any>> = {
  OPConsultation:   Stethoscope,
  Prescription:     Pill,
  DiagnosticReport: FileText,
  WellnessRecord:   FileText,
  DischargeSummary: ScrollText,
};

const HI_TYPE_LABEL: Record<string, string> = {
  OPConsultation:   'Consultation',
  Prescription:     'Prescription',
  DiagnosticReport: 'Lab / Report',
  WellnessRecord:   'Vitals',
  DischargeSummary: 'Discharge',
};

export const CareContextHistory: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [contexts, setContexts]   = useState<CareContext[]>([]);
  const [loading, setLoading]     = useState(true);
  const [abhaAddress, setAbhaAddress] = useState<string | null>(null);
  const [search, setSearch]       = useState('');

  const loadContexts = async () => {
    setLoading(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user?.user) throw new Error('Not signed in');

      const { data: patient } = await supabase
        .from('patients')
        .select('id, abha_address')
        .eq('auth_user_id', user.user.id)
        .single();
      if (!patient) throw new Error('Patient profile not found');

      setAbhaAddress(patient.abha_address);

      const { data, error } = await supabase
        .from('abha_care_contexts')
        .select('*')
        .eq('patient_id', patient.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setContexts((data as CareContext[]) || []);
    } catch (err: any) {
      toast({ title: 'Could not load care records', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadContexts(); }, []);

  const filtered = search.trim()
    ? contexts.filter(c => c.display.toLowerCase().includes(search.toLowerCase()) ||
                            c.hi_types.some(t => t.toLowerCase().includes(search.toLowerCase())))
    : contexts;

  const linkedCount = contexts.filter(c => c.linked_to_abha).length;
  const totalCount  = contexts.length;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-card border-b shadow-sm px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="font-bold flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            My ABHA Records
          </h1>
          <p className="text-xs text-muted-foreground">
            {abhaAddress ? `Linked to ${abhaAddress}` : 'ABHA not linked yet'}
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={loadContexts}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </header>

      {/* Status */}
      {totalCount > 0 && (
        <div className="bg-primary/5 border-b px-4 py-3 text-sm">
          <span className="font-semibold text-primary">{linkedCount}</span>
          <span className="text-muted-foreground"> of </span>
          <span className="font-semibold">{totalCount}</span>
          <span className="text-muted-foreground"> records linked to your ABHA. </span>
          {linkedCount < totalCount && (
            <span className="text-xs italic text-muted-foreground">
              Unlinked records are visible only inside Monitraq.
            </span>
          )}
        </div>
      )}

      {/* Search */}
      {totalCount > 5 && (
        <div className="px-4 py-3 border-b">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search records..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : totalCount === 0 ? (
        <div className="text-center py-16 px-6">
          <Link2 className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground mb-3">
            No care records yet. As you have consultations or upload reports, they'll appear here
            and be available to link to your ABHA.
          </p>
          {!abhaAddress && (
            <Button onClick={() => navigate('/profile')} variant="outline" size="sm">
              Link ABHA first
            </Button>
          )}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground">
          No matches for "{search}".
        </div>
      ) : (
        <div className="px-4 py-3 space-y-2">
          {filtered.map(cc => (
            <CareContextCard key={cc.id} ctx={cc} />
          ))}
        </div>
      )}

      <div className="px-4 mt-6 text-[10px] text-muted-foreground/70 text-center">
        Powered by Ayushman Bharat Digital Mission · Govt. of India
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Care context card
// ─────────────────────────────────────────────────────────────────────────────
const CareContextCard: React.FC<{ ctx: CareContext }> = ({ ctx }) => {
  const primaryType = ctx.hi_types[0] || 'Unknown';
  const Icon = HI_TYPE_ICON[primaryType] || FileText;
  const typeLabel = HI_TYPE_LABEL[primaryType] || primaryType;

  return (
    <div className={`rounded-lg border p-3 ${
      ctx.linked_to_abha ? 'bg-green-50/20 border-green-300/30 dark:bg-green-950/10' : 'bg-card border-border'
    }`}>
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 ${ctx.linked_to_abha ? 'text-green-600' : 'text-muted-foreground'}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Badge variant="outline" className="text-[10px] h-4">{typeLabel}</Badge>
            {ctx.linked_to_abha ? (
              <span className="text-[10px] flex items-center gap-0.5 text-green-700">
                <CheckCircle2 className="h-3 w-3" /> Linked to ABHA
              </span>
            ) : (
              <span className="text-[10px] flex items-center gap-0.5 text-muted-foreground">
                <Circle className="h-3 w-3" /> Not yet linked
              </span>
            )}
          </div>
          <p className="text-sm font-medium leading-tight">{ctx.display}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {new Date(ctx.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
            {ctx.linked_at && (
              <span> · linked {new Date(ctx.linked_at).toLocaleDateString('en-IN')}</span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
};

export default CareContextHistory;

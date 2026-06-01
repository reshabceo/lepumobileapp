/**
 * ConsentManagement.tsx
 *
 * Patient-facing page where the patient reviews INCOMING HIU consent requests
 * (some hospital / app wants to access their records held by us = HIP) and
 * approves or denies each.
 *
 * Data source: `abha_consent_artifacts` table, filtered to status='REQUESTED'.
 * Approving writes status='GRANTED' + granted_at; denying writes 'DENIED'.
 *
 * Subscribes to realtime so a request notification (from /v0.5/consents/hip/notify)
 * shows up instantly on the patient's phone.
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Shield, CheckCircle2, XCircle, Loader2, ArrowLeft,
  Calendar, Hospital, FileText, Clock, History
} from 'lucide-react';

interface ConsentArtifact {
  id:                  string;
  consent_request_id:  string | null;
  consent_artifact_id: string | null;
  patient_id:          string | null;
  hiu_id:              string | null;
  hip_id:              string | null;
  purpose_code:        string | null;
  hi_types:            string[] | null;
  date_range_from:     string | null;
  date_range_to:       string | null;
  data_erase_at:       string | null;
  status:              string;
  granted_at:          string | null;
  created_at:          string;
  raw_payload:         any;
}

const PURPOSE_DISPLAY: Record<string, { label: string; description: string }> = {
  CAREMGT: { label: 'Care Management',     description: 'For ongoing treatment and care coordination' },
  BTG:     { label: 'Break-the-glass',     description: 'Emergency access for life-saving treatment' },
  PUBHTH:  { label: 'Public Health',       description: 'Anonymized public health monitoring' },
  HPAYMT:  { label: 'Insurance / Billing', description: 'For insurance claim processing or billing' },
  DSRCH:   { label: 'Disease Research',    description: 'For approved medical research' },
};

const HI_TYPE_LABELS: Record<string, string> = {
  OPConsultation:   'Doctor consultations',
  DischargeSummary: 'Discharge summaries',
  Prescription:     'Prescriptions',
  DiagnosticReport: 'Lab / diagnostic reports',
  WellnessRecord:   'Vital signs (BP / HR / etc.)',
  ImmunizationRecord: 'Vaccinations',
};

export const ConsentManagement: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [consents, setConsents] = useState<ConsentArtifact[]>([]);
  const [loading, setLoading]   = useState(true);
  const [actingOnId, setActingOnId] = useState<string | null>(null);
  const [filter, setFilter]     = useState<'pending' | 'all'>('pending');

  // ── Initial load ──────────────────────────────────────────────────────────
  const loadConsents = async () => {
    setLoading(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user?.user) throw new Error('Not signed in');

      const { data: patient } = await supabase
        .from('patients')
        .select('id')
        .eq('auth_user_id', user.user.id)
        .single();
      if (!patient) throw new Error('Patient profile not found');

      let q = supabase
        .from('abha_consent_artifacts')
        .select('*')
        .eq('patient_id', patient.id)
        .order('created_at', { ascending: false });
      if (filter === 'pending') q = q.eq('status', 'REQUESTED');

      const { data, error } = await q;
      if (error) throw error;
      setConsents((data as ConsentArtifact[]) || []);
    } catch (err: any) {
      toast({ title: 'Could not load consents', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadConsents(); }, [filter]);

  // ── Realtime: new consent requests show up instantly ──────────────────────
  useEffect(() => {
    let channel: any;
    (async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user?.user) return;
      const { data: patient } = await supabase
        .from('patients')
        .select('id')
        .eq('auth_user_id', user.user.id)
        .single();
      if (!patient) return;

      channel = supabase
        .channel(`consent-artifacts-${patient.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'abha_consent_artifacts', filter: `patient_id=eq.${patient.id}` },
          () => loadConsents(),
        )
        .subscribe();
    })();
    return () => { if (channel) void supabase.removeChannel(channel); };
  }, [filter]);

  // ── Approve / Deny ────────────────────────────────────────────────────────
  const handleAction = async (consentId: string, action: 'GRANTED' | 'DENIED') => {
    setActingOnId(consentId);
    try {
      const update: any = { status: action };
      if (action === 'GRANTED') update.granted_at = new Date().toISOString();

      const { error } = await supabase
        .from('abha_consent_artifacts')
        .update(update)
        .eq('id', consentId);
      if (error) throw error;

      toast({
        title: action === 'GRANTED' ? 'Consent approved' : 'Consent denied',
        description: action === 'GRANTED'
          ? 'Your records will be shared with the requesting provider.'
          : 'The provider will not be able to access your records.',
      });

      await loadConsents();
    } catch (err: any) {
      toast({ title: 'Action failed', description: err.message, variant: 'destructive' });
    } finally {
      setActingOnId(null);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-card border-b shadow-sm px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="font-bold flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Consent Requests
          </h1>
          <p className="text-xs text-muted-foreground">Approve or deny data sharing requests</p>
        </div>
      </header>

      {/* Filter */}
      <div className="flex gap-2 px-4 py-3">
        <Button
          size="sm"
          variant={filter === 'pending' ? 'default' : 'outline'}
          onClick={() => setFilter('pending')}
        >
          Pending only
        </Button>
        <Button
          size="sm"
          variant={filter === 'all' ? 'default' : 'outline'}
          onClick={() => setFilter('all')}
        >
          <History className="h-3 w-3 mr-1" />
          History
        </Button>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : consents.length === 0 ? (
        <div className="text-center py-16 px-6">
          <Shield className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">
            {filter === 'pending'
              ? 'No pending consent requests. We\'ll notify you when one arrives.'
              : 'No consent requests yet.'}
          </p>
        </div>
      ) : (
        <div className="px-4 space-y-3">
          {consents.map(c => (
            <ConsentCard
              key={c.id}
              consent={c}
              acting={actingOnId === c.id}
              onApprove={() => handleAction(c.id, 'GRANTED')}
              onDeny={() => handleAction(c.id, 'DENIED')}
            />
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
// Sub-component: one consent card
// ─────────────────────────────────────────────────────────────────────────────
const ConsentCard: React.FC<{
  consent:   ConsentArtifact;
  acting:    boolean;
  onApprove: () => void;
  onDeny:    () => void;
}> = ({ consent, acting, onApprove, onDeny }) => {
  const purpose = PURPOSE_DISPLAY[consent.purpose_code || ''] || {
    label: consent.purpose_code || 'Unknown',
    description: 'Purpose not specified',
  };

  const isPending  = consent.status === 'REQUESTED';
  const isGranted  = consent.status === 'GRANTED';
  const isDenied   = consent.status === 'DENIED' || consent.status === 'REVOKED' || consent.status === 'EXPIRED';

  const eraseDate = consent.data_erase_at ? new Date(consent.data_erase_at).toLocaleDateString('en-IN') : '—';

  return (
    <div className={`rounded-xl border p-4 ${
      isPending ? 'bg-yellow-50/30 border-yellow-300/40 dark:bg-yellow-950/20'
      : isGranted ? 'bg-green-50/30 border-green-300/40 dark:bg-green-950/20'
      : 'bg-red-50/30 border-red-300/40 dark:bg-red-950/20 opacity-70'
    }`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <Hospital className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-sm font-semibold">{consent.hiu_id || 'Unknown requester'}</span>
        </div>
        <Badge variant="outline" className={
          isPending ? 'bg-yellow-500/10 text-yellow-700 border-yellow-500/30'
          : isGranted ? 'bg-green-500/10 text-green-700 border-green-500/30'
          : 'bg-red-500/10 text-red-700 border-red-500/30'
        }>
          {consent.status}
        </Badge>
      </div>

      <p className="text-sm font-medium">{purpose.label}</p>
      <p className="text-xs text-muted-foreground mb-3">{purpose.description}</p>

      <div className="space-y-1.5 text-xs mb-3">
        {/* Data types */}
        {consent.hi_types && consent.hi_types.length > 0 && (
          <div className="flex items-start gap-1.5">
            <FileText className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
            <div>
              <span className="text-muted-foreground">Records: </span>
              {consent.hi_types.map(t => HI_TYPE_LABELS[t] || t).join(', ')}
            </div>
          </div>
        )}

        {/* Date range */}
        {(consent.date_range_from || consent.date_range_to) && (
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground">From: </span>
            <span>{consent.date_range_from} → {consent.date_range_to}</span>
          </div>
        )}

        {/* Auto-erase */}
        <div className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-muted-foreground">Data auto-erased after: </span>
          <span>{eraseDate}</span>
        </div>
      </div>

      {/* Actions */}
      {isPending && (
        <div className="flex gap-2 pt-2 border-t">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 border-red-300 text-red-700 hover:bg-red-50"
            disabled={acting}
            onClick={onDeny}
          >
            {acting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <XCircle className="h-3.5 w-3.5 mr-1" />}
            Deny
          </Button>
          <Button
            size="sm"
            className="flex-1"
            disabled={acting}
            onClick={onApprove}
          >
            {acting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1" />}
            Approve
          </Button>
        </div>
      )}

      {isGranted && consent.granted_at && (
        <p className="text-[11px] text-green-700 mt-1">
          Granted on {new Date(consent.granted_at).toLocaleString('en-IN')}
        </p>
      )}
    </div>
  );
};

export default ConsentManagement;

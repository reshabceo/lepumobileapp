import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, supabaseUrl, supabaseAnonKey } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  Shield, CheckCircle2, XCircle, Building2,
  Calendar, RefreshCw, Loader2, Plus, ScanLine, X, ArrowLeft
} from 'lucide-react';
import { InsuranceCardScanner, ScannedInsuranceData } from './InsuranceCardScanner';

interface PatientInsurance {
  id: string;
  policy_number: string;
  plan_name: string | null;
  plan_type: string | null;
  effective_date: string | null;
  expiration_date: string | null;
  coverage_amount: number | null;
  coverage_currency: string | null;
  group_number: string | null;
  subscriber_name: string | null;
  is_primary: boolean | null;
  is_active: boolean | null;
  is_verified: boolean | null;
  cashless_enabled: boolean | null;
  country: string;
  provider_name?: string;
  eligibility_status?: string | null;
  rpm_covered?: boolean | null;
  copay_amount?: number | null;
  deductible_remaining?: number | null;
}

interface AddForm {
  policy_number: string;
  provider_name: string;
  plan_name: string;
  plan_type: string;
  effective_date: string;
  expiration_date: string;
  group_number: string;
  subscriber_name: string;
  cashless_enabled: boolean;
}

const EMPTY_FORM: AddForm = {
  policy_number: '',
  provider_name: '',
  plan_name: '',
  plan_type: '',
  effective_date: '',
  expiration_date: '',
  group_number: '',
  subscriber_name: '',
  cashless_enabled: false,
};

export const PatientInsuranceProfile = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const [insurances, setInsurances] = useState<PatientInsurance[]>([]);
  const [loading, setLoading] = useState(true);
  const [patientId, setPatientId] = useState<string | null>(null);

  // Add flow state
  const [showAdd, setShowAdd]         = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [form, setForm]               = useState<AddForm>(EMPTY_FORM);
  const [saving, setSaving]           = useState(false);

  useEffect(() => {
    if (user) {
      loadInsurances();
    } else if (!authLoading) {
      setLoading(false);
    }
  }, [user, authLoading]);

  const loadInsurances = async () => {
    setLoading(true);
    try {
      if (!user) return;

      // Get fresh token (handles expiry/refresh) then use direct REST to avoid JS-client lock blocking queries
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) return;

      const headers = {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      };
      const base = `${supabaseUrl}/rest/v1`;

      // Resolve auth uid → patient record
      const pRes = await fetch(`${base}/patients?select=id&auth_user_id=eq.${user.id}&limit=1`, { headers });
      const patients: any[] = await pRes.json();
      if (!patients[0]) return;
      const pid = patients[0].id;
      setPatientId(pid);

      // Fetch insurance with provider join
      const iRes = await fetch(
        `${base}/patient_insurance?select=*,insurance_providers(name)&patient_id=eq.${pid}&order=is_primary.desc,created_at.desc`,
        { headers }
      );
      const data: any[] = await iRes.json();

      setInsurances(
        data.map((row: any) => ({
          ...row,
          provider_name: row.insurance_providers?.name ?? null,
        }))
      );
    } catch (err: any) {
      toast({ title: 'Error', description: err.message ?? 'Failed to load insurance', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  /** Called when OCR scanner returns extracted data — pre-fills the form */
  const handleScanned = (data: ScannedInsuranceData) => {
    setShowScanner(false);
    setForm(prev => ({
      ...prev,
      policy_number:    data.policyNumber    ?? prev.policy_number,
      provider_name:    data.providerName    ?? prev.provider_name,
      plan_name:        data.planName        ?? prev.plan_name,
      plan_type:        data.planType        ?? prev.plan_type,
      effective_date:   data.effectiveDate   ?? prev.effective_date,
      expiration_date:  data.expirationDate  ?? prev.expiration_date,
      group_number:     data.groupNumber     ?? prev.group_number,
      subscriber_name:  data.memberName      ?? prev.subscriber_name,
      cashless_enabled: data.cashlessEnabled ?? prev.cashless_enabled,
    }));
    toast({ title: 'Form pre-filled from card', description: 'Review the fields and tap Save.' });
  };

  /** Try to find a matching provider_id by name (case-insensitive partial match) */
  const resolveProviderId = async (name: string): Promise<string | null> => {
    if (!name) return null;
    const { data } = await supabase
      .from('insurance_providers')
      .select('id, name')
      .ilike('name', `%${name}%`)
      .limit(1)
      .single();
    return data?.id ?? null;
  };

  const handleSave = async () => {
    if (!form.policy_number.trim()) {
      toast({ title: 'Policy number is required', variant: 'destructive' });
      return;
    }
    if (!patientId) {
      toast({ title: 'Patient record not found', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const providerId = await resolveProviderId(form.provider_name);

      const { error } = await supabase.from('patient_insurance').insert({
        patient_id:        patientId,
        policy_number:     form.policy_number.trim(),
        provider_id:       providerId,
        plan_name:         form.plan_name   || null,
        plan_type:         form.plan_type   || null,
        effective_date:    form.effective_date   || null,
        expiration_date:   form.expiration_date  || null,
        group_number:      form.group_number || null,
        subscriber_name:   form.subscriber_name  || null,
        cashless_enabled:  form.cashless_enabled,
        is_active:         true,
        is_primary:        insurances.length === 0, // first card = primary
        country:           'India',
      });

      if (error) throw error;

      toast({ title: 'Insurance saved ✓' });
      setForm(EMPTY_FORM);
      setShowAdd(false);
      loadInsurances();
    } catch (err: any) {
      toast({ title: 'Save failed', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const isExpired = (expDate: string | null) => {
    if (!expDate) return false;
    return new Date(expDate) < new Date();
  };

  return (
    <div className="space-y-4">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground transition-colors p-1 -ml-1">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            My Insurance
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadInsurances} className="text-muted-foreground hover:text-foreground transition-colors p-1">
            <RefreshCw className="h-4 w-4" />
          </button>
          <Button size="sm" onClick={() => { setForm(EMPTY_FORM); setShowAdd(v => !v); setShowScanner(false); }}>
            {showAdd ? <X className="h-4 w-4" /> : <><Plus className="h-4 w-4 mr-1" />Add</>}
          </Button>
        </div>
      </div>

      {/* ── Add Insurance Panel ─────────────────────────────────── */}
      {showAdd && (
        <div className="rounded-xl border bg-card overflow-hidden">
          {/* Scanner toggle */}
          {!showScanner ? (
            <button
              onClick={() => setShowScanner(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary/5 border-b hover:bg-primary/10 transition-colors text-sm font-medium text-primary"
            >
              <ScanLine className="h-4 w-4" />
              Scan Insurance Card to Auto-fill
            </button>
          ) : (
            <div className="p-3 border-b">
              <InsuranceCardScanner
                onScanned={handleScanned}
                onCancel={() => setShowScanner(false)}
              />
            </div>
          )}

          {/* Manual form */}
          <div className="p-4 space-y-3">
            <p className="text-xs text-muted-foreground -mt-1 mb-1">
              {showScanner ? 'Or fill in manually below' : 'Fill in the details manually or scan card above'}
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Policy Number *</Label>
                <Input
                  value={form.policy_number}
                  onChange={e => setForm(p => ({ ...p, policy_number: e.target.value }))}
                  placeholder="e.g. P/161234/01/2025"
                  className="h-9 text-sm font-mono"
                />
              </div>

              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Insurance Provider</Label>
                <Input
                  value={form.provider_name}
                  onChange={e => setForm(p => ({ ...p, provider_name: e.target.value }))}
                  placeholder="e.g. Star Health, HDFC ERGO"
                  className="h-9 text-sm"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Plan Name</Label>
                <Input
                  value={form.plan_name}
                  onChange={e => setForm(p => ({ ...p, plan_name: e.target.value }))}
                  placeholder="e.g. Family Health Optima"
                  className="h-9 text-sm"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Plan Type</Label>
                <select
                  value={form.plan_type}
                  onChange={e => setForm(p => ({ ...p, plan_type: e.target.value }))}
                  className="w-full h-9 text-sm rounded-md border border-input bg-background px-3"
                >
                  <option value="">Select…</option>
                  <option value="individual">Individual</option>
                  <option value="family">Family</option>
                  <option value="group">Group</option>
                  <option value="corporate">Corporate</option>
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Valid From</Label>
                <Input
                  type="date"
                  value={form.effective_date}
                  onChange={e => setForm(p => ({ ...p, effective_date: e.target.value }))}
                  className="h-9 text-sm"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Expires</Label>
                <Input
                  type="date"
                  value={form.expiration_date}
                  onChange={e => setForm(p => ({ ...p, expiration_date: e.target.value }))}
                  className="h-9 text-sm"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Group Number</Label>
                <Input
                  value={form.group_number}
                  onChange={e => setForm(p => ({ ...p, group_number: e.target.value }))}
                  placeholder="Optional"
                  className="h-9 text-sm"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Policy Holder Name</Label>
                <Input
                  value={form.subscriber_name}
                  onChange={e => setForm(p => ({ ...p, subscriber_name: e.target.value }))}
                  placeholder="Optional"
                  className="h-9 text-sm"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm cursor-pointer select-none mt-1">
              <input
                type="checkbox"
                checked={form.cashless_enabled}
                onChange={e => setForm(p => ({ ...p, cashless_enabled: e.target.checked }))}
                className="h-4 w-4 rounded"
              />
              Cashless hospitalisation enabled
            </label>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => { setShowAdd(false); setShowScanner(false); setForm(EMPTY_FORM); }}>
                Cancel
              </Button>
              <Button size="sm" className="flex-1" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Insurance'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Insurance cards list ────────────────────────────────── */}
      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : insurances.length === 0 && !showAdd ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
            <Shield className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No insurance on file</p>
            <p className="text-sm mt-1">Tap <strong>Add</strong> to scan or enter your card details</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {insurances.map(ins => {
            const expired = isExpired(ins.expiration_date);
            return (
              <Card
                key={ins.id}
                className={`overflow-hidden ${ins.is_primary ? 'border-primary/50' : ''}`}
              >
                {ins.is_primary && (
                  <div className="bg-primary/10 border-b border-primary/20 px-4 py-1.5 flex items-center gap-1.5 text-xs text-primary font-medium">
                    <Shield className="h-3 w-3" />
                    Primary Insurance
                  </div>
                )}
                <CardContent className="p-4 space-y-3">
                  {/* Header row */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-mono font-bold text-sm">{ins.policy_number}</p>
                      {ins.provider_name && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Building2 className="h-3 w-3" /> {ins.provider_name}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1 justify-end">
                      {ins.is_active && !expired ? (
                        <Badge variant="outline" className="text-xs bg-green-500/10 text-green-700 border-green-500/30 flex items-center gap-1 h-5">
                          <CheckCircle2 className="h-2.5 w-2.5" /> Active
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs bg-red-500/10 text-red-700 border-red-500/30 flex items-center gap-1 h-5">
                          <XCircle className="h-2.5 w-2.5" /> {expired ? 'Expired' : 'Inactive'}
                        </Badge>
                      )}
                      {ins.cashless_enabled && (
                        <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-700 border-blue-500/30 h-5">
                          Cashless
                        </Badge>
                      )}
                      {ins.is_verified && (
                        <Badge variant="outline" className="text-xs bg-teal-500/10 text-teal-700 border-teal-500/30 h-5">
                          Verified
                        </Badge>
                      )}
                      {ins.eligibility_status === 'verified' && (
                        <Badge variant="outline" className="text-xs bg-green-500/10 text-green-700 border-green-500/30 flex items-center gap-1 h-5">
                          <CheckCircle2 className="h-2.5 w-2.5" /> Coverage Verified
                        </Badge>
                      )}
                      {ins.eligibility_status === 'ineligible' && (
                        <Badge variant="outline" className="text-xs bg-red-500/10 text-red-700 border-red-500/30 flex items-center gap-1 h-5">
                          <XCircle className="h-2.5 w-2.5" /> Ineligible
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Details grid */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-muted-foreground">
                    {ins.plan_name && (
                      <div>
                        <p className="text-[10px] uppercase tracking-wide font-medium mb-0.5">Plan</p>
                        <p className="text-foreground font-medium">{ins.plan_name}</p>
                      </div>
                    )}
                    {ins.plan_type && (
                      <div>
                        <p className="text-[10px] uppercase tracking-wide font-medium mb-0.5">Type</p>
                        <p className="text-foreground font-medium capitalize">{ins.plan_type}</p>
                      </div>
                    )}
                    {ins.coverage_amount && (
                      <div>
                        <p className="text-[10px] uppercase tracking-wide font-medium mb-0.5">Coverage</p>
                        <p className="text-foreground font-medium">
                          {ins.coverage_currency} {ins.coverage_amount.toLocaleString('en-IN')}
                        </p>
                      </div>
                    )}
                    {ins.group_number && (
                      <div>
                        <p className="text-[10px] uppercase tracking-wide font-medium mb-0.5">Group No.</p>
                        <p className="text-foreground font-medium">{ins.group_number}</p>
                      </div>
                    )}
                    {ins.subscriber_name && (
                      <div className="col-span-2">
                        <p className="text-[10px] uppercase tracking-wide font-medium mb-0.5">Policy Holder</p>
                        <p className="text-foreground font-medium">{ins.subscriber_name}</p>
                      </div>
                    )}
                  </div>

                  {/* RPM & eligibility details */}
                  {ins.eligibility_status === 'verified' && (
                    <div className="rounded-md bg-green-500/8 border border-green-500/20 px-3 py-2 text-xs space-y-1">
                      <p className="font-semibold text-green-700 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Coverage Verified by Your Doctor
                      </p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground mt-1">
                        <div>
                          <span className="text-[10px] uppercase tracking-wide font-medium">RPM Covered</span>
                          <p className="text-foreground font-medium">{ins.rpm_covered ? 'Yes ✓' : 'No'}</p>
                        </div>
                        {ins.copay_amount != null && ins.copay_amount > 0 && (
                          <div>
                            <span className="text-[10px] uppercase tracking-wide font-medium">Co-pay</span>
                            <p className="text-foreground font-medium">₹{ins.copay_amount.toLocaleString('en-IN')}</p>
                          </div>
                        )}
                        {ins.deductible_remaining != null && ins.deductible_remaining > 0 && (
                          <div>
                            <span className="text-[10px] uppercase tracking-wide font-medium">Deductible Left</span>
                            <p className="text-foreground font-medium">₹{ins.deductible_remaining.toLocaleString('en-IN')}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Validity bar */}
                  {(ins.effective_date || ins.expiration_date) && (
                    <div className={`flex items-center gap-1.5 text-xs rounded-md px-2.5 py-1.5 ${
                      expired
                        ? 'bg-red-500/10 text-red-600'
                        : 'bg-muted/60 text-muted-foreground'
                    }`}>
                      <Calendar className="h-3 w-3 shrink-0" />
                      {ins.effective_date
                        ? `Valid from ${new Date(ins.effective_date).toLocaleDateString('en-IN')}`
                        : 'No start date'}
                      {ins.expiration_date
                        ? ` · Expires ${new Date(ins.expiration_date).toLocaleDateString('en-IN')}`
                        : ''}
                      {expired && <span className="font-semibold ml-1">· EXPIRED</span>}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}

          <p className="text-xs text-center text-muted-foreground pt-1">
            Tap <strong>Add</strong> above to add another policy, or ask your doctor to verify
          </p>
        </div>
      )}
    </div>
  );
};

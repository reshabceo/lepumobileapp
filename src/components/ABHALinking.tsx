/**
 * ABHALinking.tsx
 *
 * 3-step flow:
 *   Step 1 — Enter mobile number → ABDM sends OTP
 *   Step 2 — Enter OTP → get ABHA accounts for that mobile
 *   Step 3 — Confirm / select account → save abha_id to patients table
 *
 * Uses the `abdm-proxy` Supabase edge function so credentials stay server-side.
 */

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Shield, CheckCircle2, Loader2, ArrowRight,
  Phone, Key, User, RefreshCw, X
} from 'lucide-react';

interface AbhaAccount {
  abhaNumber:  string;
  abhaAddress: string;
  name:        string;
  gender:      string;
  dob:         string;
  mobile:      string;
}

interface Props {
  patientId:   string;
  currentAbha?: string | null;
  onLinked:    (abhaNumber: string, abhaAddress: string) => void;
  onCancel?:   () => void;
}

type Step = 'mobile' | 'otp' | 'confirm' | 'done';

export const ABHALinking = ({ patientId, currentAbha, onLinked, onCancel }: Props) => {
  const { toast } = useToast();

  const [step,      setStep]      = useState<Step>(currentAbha ? 'done' : 'mobile');
  const [mobile,    setMobile]    = useState('');
  const [otp,       setOtp]       = useState('');
  const [txnId,     setTxnId]     = useState('');
  const [userToken, setUserToken] = useState('');
  const [accounts,  setAccounts]  = useState<AbhaAccount[]>([]);
  const [selected,  setSelected]  = useState<AbhaAccount | null>(null);
  const [loading,   setLoading]   = useState(false);
  const [saving,    setSaving]    = useState(false);

  // ── Call edge function ──────────────────────────────────────────────────────
  const callProxy = async (action: string, params: Record<string, string>) => {
    const { data, error } = await supabase.functions.invoke('abdm-proxy', {
      body: { action, ...params },
    });
    if (error) throw new Error(error.message);
    if (!data?.ok) throw new Error(data?.error ?? 'ABDM call failed');
    return data.data;
  };

  // ── Step 1: send OTP ────────────────────────────────────────────────────────
  const handleSendOtp = async () => {
    if (!/^[6-9]\d{9}$/.test(mobile)) {
      toast({ title: 'Invalid mobile', description: 'Enter a valid 10-digit Indian mobile number.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const result = await callProxy('generate_otp', { mobile });
      setTxnId(result.txnId);
      setStep('otp');
      toast({ title: 'OTP Sent', description: `OTP sent to +91 ${mobile}` });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: verify OTP ──────────────────────────────────────────────────────
  const handleVerifyOtp = async () => {
    if (otp.length !== 6) {
      toast({ title: 'Invalid OTP', description: 'Enter the 6-digit OTP.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const result = await callProxy('verify_otp', { txnId, otp });

      if (result.noAbha) {
        toast({
          title: 'No ABHA found',
          description: 'No ABHA account linked to this mobile. Create one at abha.abdm.gov.in',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      setUserToken(result.userToken);
      setAccounts(result.accounts);
      // If only one account, auto-select
      if (result.accounts.length === 1) setSelected(result.accounts[0]);
      setStep('confirm');
    } catch (err: any) {
      toast({ title: 'Wrong OTP', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // ── Step 3: save to DB ──────────────────────────────────────────────────────
  const handleConfirm = async () => {
    if (!selected) {
      toast({ title: 'Select account', description: 'Please select an ABHA account.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('patients')
        .update({
          abha_id:        selected.abhaNumber,
          abha_address:   selected.abhaAddress,
          abha_linked_at: new Date().toISOString(),
        })
        .eq('id', patientId);

      if (error) throw error;

      setStep('done');
      onLinked(selected.abhaNumber, selected.abhaAddress);
      toast({ title: 'ABHA Linked ✓', description: `${selected.abhaAddress} linked successfully.` });
    } catch (err: any) {
      toast({ title: 'Save failed', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setStep('mobile');
    setMobile('');
    setOtp('');
    setTxnId('');
    setUserToken('');
    setAccounts([]);
    setSelected(null);
  };

  // ── Already linked ──────────────────────────────────────────────────────────
  if (step === 'done' && currentAbha) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-green-700">ABHA Linked</p>
            <p className="text-xs text-green-600 font-mono">{currentAbha}</p>
          </div>
        </div>
        <button onClick={reset} className="text-xs text-muted-foreground hover:text-foreground underline">
          Relink
        </button>
      </div>
    );
  }

  // ── Step indicator ──────────────────────────────────────────────────────────
  const stepNum = step === 'mobile' ? 1 : step === 'otp' ? 2 : 3;
  const steps = [
    { n: 1, label: 'Mobile', icon: <Phone className="h-3.5 w-3.5" /> },
    { n: 2, label: 'OTP',    icon: <Key  className="h-3.5 w-3.5" /> },
    { n: 3, label: 'Confirm',icon: <User className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <span className="font-semibold text-sm">Link ABHA Health ID</span>
          <Badge variant="outline" className="text-[10px] h-4 bg-blue-500/10 text-blue-700 border-blue-500/20">
            Govt. of India
          </Badge>
        </div>
        {onCancel && (
          <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-0 px-4 pt-4">
        {steps.map((s, i) => (
          <React.Fragment key={s.n}>
            <div className={`flex items-center gap-1.5 text-xs ${stepNum >= s.n ? 'text-primary' : 'text-muted-foreground'}`}>
              <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold
                ${stepNum > s.n  ? 'bg-primary text-primary-foreground' :
                  stepNum === s.n ? 'bg-primary/20 text-primary border border-primary' :
                                    'bg-muted text-muted-foreground'}`}>
                {stepNum > s.n ? <CheckCircle2 className="h-3.5 w-3.5" /> : s.n}
              </div>
              <span className="hidden sm:inline">{s.label}</span>
            </div>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-px mx-2 ${stepNum > s.n ? 'bg-primary' : 'bg-muted'}`} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Body */}
      <div className="p-4 space-y-4">

        {/* ── Step 1: Mobile ── */}
        {step === 'mobile' && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Enter the mobile number linked to your ABHA account. You'll receive an OTP.
            </p>
            <div className="flex gap-2">
              <div className="flex items-center border rounded-l-md px-3 bg-muted text-sm text-muted-foreground shrink-0">
                +91
              </div>
              <Input
                type="tel"
                inputMode="numeric"
                maxLength={10}
                placeholder="9876543210"
                value={mobile}
                onChange={e => setMobile(e.target.value.replace(/\D/g, ''))}
                className="rounded-l-none"
                onKeyDown={e => e.key === 'Enter' && handleSendOtp()}
              />
            </div>
            <Button className="w-full" onClick={handleSendOtp} disabled={loading || mobile.length !== 10}>
              {loading
                ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Sending OTP…</>
                : <><ArrowRight className="h-4 w-4 mr-2" />Send OTP</>}
            </Button>
          </div>
        )}

        {/* ── Step 2: OTP ── */}
        {step === 'otp' && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Enter the 6-digit OTP sent to <span className="font-semibold text-foreground">+91 {mobile}</span>
            </p>
            <Input
              type="tel"
              inputMode="numeric"
              maxLength={6}
              placeholder="123456"
              value={otp}
              onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
              className="text-center text-xl tracking-[0.5em] font-mono"
              onKeyDown={e => e.key === 'Enter' && handleVerifyOtp()}
            />
            <Button className="w-full" onClick={handleVerifyOtp} disabled={loading || otp.length !== 6}>
              {loading
                ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Verifying…</>
                : <><Key className="h-4 w-4 mr-2" />Verify OTP</>}
            </Button>
            <button
              onClick={() => { setOtp(''); handleSendOtp(); }}
              className="w-full text-xs text-muted-foreground hover:text-foreground flex items-center justify-center gap-1"
            >
              <RefreshCw className="h-3 w-3" /> Resend OTP
            </button>
          </div>
        )}

        {/* ── Step 3: Confirm account ── */}
        {step === 'confirm' && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {accounts.length > 1
                ? 'Multiple ABHA accounts found. Select one to link:'
                : 'Confirm your ABHA account:'}
            </p>

            <div className="space-y-2">
              {accounts.map(acc => (
                <button
                  key={acc.abhaNumber}
                  onClick={() => setSelected(acc)}
                  className={`w-full text-left rounded-lg border p-3 transition-colors ${
                    selected?.abhaNumber === acc.abhaNumber
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-sm font-bold text-primary">{acc.abhaNumber}</span>
                    {selected?.abhaNumber === acc.abhaNumber && (
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                    )}
                  </div>
                  <p className="text-sm font-medium">{acc.name}</p>
                  <div className="flex gap-3 text-xs text-muted-foreground mt-0.5">
                    {acc.abhaAddress && <span>@{acc.abhaAddress.replace('@abdm', '')}</span>}
                    {acc.gender && <span>{acc.gender === 'M' ? 'Male' : acc.gender === 'F' ? 'Female' : acc.gender}</span>}
                    {acc.dob && <span>{new Date(acc.dob).toLocaleDateString('en-IN')}</span>}
                  </div>
                </button>
              ))}
            </div>

            <Button className="w-full" onClick={handleConfirm} disabled={saving || !selected}>
              {saving
                ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Linking…</>
                : <><CheckCircle2 className="h-4 w-4 mr-2" />Link ABHA</>}
            </Button>
          </div>
        )}

        {/* ── Done (no currentAbha yet — just confirmed) ── */}
        {step === 'done' && !currentAbha && selected && (
          <div className="flex items-center gap-3 rounded-lg bg-green-500/10 border border-green-500/30 p-3">
            <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-green-700">ABHA Linked Successfully</p>
              <p className="text-xs text-green-600 font-mono">{selected.abhaNumber}</p>
            </div>
          </div>
        )}
      </div>

      {/* Footer note */}
      <div className="px-4 pb-3">
        <p className="text-[10px] text-muted-foreground text-center">
          Powered by Ayushman Bharat Digital Mission (ABDM) · Govt. of India
        </p>
      </div>
    </div>
  );
};

/**
 * PrivacyConsent.tsx
 *
 * DPDP Act 2023 consent screen, in two modes:
 *
 * 1. CAPTURE - first login (or a new notice version): full notice text,
 *    per-purpose choices, one clear affirmative "I agree" action. Required
 *    purposes are fixed on; optional ones default OFF (unbundled consent).
 * 2. MANAGE - afterwards (reached from Profile > Privacy & Consent): shows
 *    each purpose with its current status; withdrawing is a single tap,
 *    followed by a confirm dialog. Withdrawal writes a new ledger row.
 *
 * Backed by the append-only `dpdp_consent_events` table via useDpdpConsent.
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDpdpConsent } from '@/hooks/useDpdpConsent';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Shield, Loader2, ArrowLeft, CheckCircle2, Lock } from 'lucide-react';

export const PrivacyConsent: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const {
    loading, available, notice, needsConsent, isGranted, grant, withdraw,
  } = useDpdpConsent();

  const [choices, setChoices] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [withdrawKey, setWithdrawKey] = useState<string | null>(null);

  // Preselect required purposes; optional purposes start OFF (DPDP: no bundling).
  useEffect(() => {
    if (!notice) return;
    const initial: Record<string, boolean> = {};
    notice.purposes.forEach((p) => {
      initial[p.key] = p.required ? true : isGranted(p.key);
    });
    setChoices(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notice, needsConsent]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-green-500" />
      </div>
    );
  }

  if (!available || !notice) {
    return (
      <div className="min-h-screen bg-background p-6">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-400 mb-6">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <p className="text-slate-400 text-sm">
          The consent system is not enabled yet. Please try again later.
        </p>
      </div>
    );
  }

  const handleAgree = async () => {
    setSaving(true);
    const grantedKeys = notice.purposes
      .filter((p) => p.required || choices[p.key])
      .map((p) => p.key);
    const { error } = await grant(grantedKeys);
    setSaving(false);
    if (error) {
      toast({ title: 'Could not save consent', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Consent saved', description: 'You can change this anytime in Profile.' });
    navigate('/dashboard', { replace: true });
  };

  const handleToggle = async (key: string, next: boolean) => {
    if (needsConsent) {
      // Capture mode: just flip the local choice; nothing stored until "I agree".
      setChoices((c) => ({ ...c, [key]: next }));
      return;
    }
    // Manage mode: granting is immediate; withdrawing asks to confirm first.
    if (next) {
      const { error } = await grant([key]);
      if (error) toast({ title: 'Could not save', description: error.message, variant: 'destructive' });
      else toast({ title: 'Consent granted' });
    } else {
      setWithdrawKey(key);
    }
  };

  const confirmWithdraw = async () => {
    if (!withdrawKey) return;
    const { error } = await withdraw(withdrawKey);
    setWithdrawKey(null);
    if (error) toast({ title: 'Could not withdraw', description: error.message, variant: 'destructive' });
    else toast({ title: 'Consent withdrawn', description: 'We have stopped this processing.' });
  };

  const withdrawingPurpose = notice.purposes.find((p) => p.key === withdrawKey);

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-lg mx-auto p-6 space-y-6">
        {!needsConsent && (
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-400">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
        )}

        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-green-500/10 flex items-center justify-center">
            <Shield className="h-5 w-5 text-green-500" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white">Privacy &amp; Consent</h1>
            <p className="text-xs text-slate-400">
              Notice version {notice.version} &middot; DPDP Act 2023
            </p>
          </div>
        </div>

        <Card className="bg-[#1A243D] border border-slate-700/40 rounded-3xl">
          <CardContent className="p-6">
            <h2 className="font-medium text-white mb-3">{notice.notice_title}</h2>
            <p className="text-sm text-slate-300 whitespace-pre-line leading-relaxed">
              {notice.notice_body}
            </p>
          </CardContent>
        </Card>

        <div className="space-y-3">
          {notice.purposes.map((p) => {
            const checked = needsConsent ? !!choices[p.key] : isGranted(p.key);
            return (
              <Card key={p.key} className="bg-[#1A243D] border border-slate-700/40 rounded-3xl">
                <CardContent className="p-5 flex items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-white text-sm">{p.label}</span>
                      {p.required ? (
                        <Badge variant="outline" className="text-[10px] border-green-500/40 text-green-400">
                          Required
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] border-slate-500/40 text-slate-400">
                          Optional
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">{p.description}</p>
                  </div>
                  {p.required ? (
                    <Lock className="h-4 w-4 text-slate-500 mt-1 shrink-0" />
                  ) : (
                    <Switch
                      checked={checked}
                      onCheckedChange={(v) => handleToggle(p.key, v)}
                      className="mt-1"
                    />
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {needsConsent ? (
          <div className="space-y-3">
            <Button
              onClick={handleAgree}
              disabled={saving}
              className="w-full h-12 rounded-2xl bg-green-600 hover:bg-green-700 text-white"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" /> I agree
                </>
              )}
            </Button>
            <p className="text-[11px] text-slate-500 text-center leading-relaxed">
              Required purposes are needed to provide the service. Optional purposes are
              off unless you switch them on, and you can change everything later in
              Profile &gt; Privacy &amp; Consent.
            </p>
          </div>
        ) : (
          <p className="text-[11px] text-slate-500 text-center leading-relaxed">
            Changes take effect immediately and are recorded with a timestamp.
            Grievance Officer: privacy@monitraq.com
          </p>
        )}
      </div>

      <AlertDialog open={!!withdrawKey} onOpenChange={(open) => !open && setWithdrawKey(null)}>
        <AlertDialogContent className="bg-[#1A243D] border-slate-700/40 rounded-3xl max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">
              Withdraw consent?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400 text-sm">
              We will stop using your data for
              {' '}<span className="text-slate-200">{withdrawingPurpose?.label}</span>.
              Anything already processed lawfully stays only as long as the law requires.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Keep consent</AlertDialogCancel>
            <AlertDialogAction onClick={confirmWithdraw} className="rounded-xl bg-red-600 hover:bg-red-700">
              Withdraw
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PrivacyConsent;

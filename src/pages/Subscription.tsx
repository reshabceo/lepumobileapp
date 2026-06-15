import { useEffect, useState } from 'react';
import { ArrowLeft, Check, Loader2, Lock } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscriptionTier } from '@/hooks/useSubscriptionTier';
import { iapService } from '@/services/iapService';
import { getAppleSubscriptionProductId } from '@/config/iap-products';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface PlanRow {
  code: string;
  display_name: string;
  price_paise: number;
  period_days: number;
  razorpay_plan_id: string | null;
  apple_product_id: string | null;
  is_active: boolean;
}

interface ActiveSub {
  id: string;
  plan_code: string;
  status: string;
  source: 'razorpay' | 'apple_iap';
  valid_until: string | null;
  razorpay_subscription_id: string | null;
  cancel_at_period_end?: boolean;
}

declare global {
  interface Window {
    Razorpay?: any;
  }
}

const RAZORPAY_SCRIPT = 'https://checkout.razorpay.com/v1/checkout.js';
let razorpayScriptPromise: Promise<void> | null = null;

function getAppleProductIdForPlan(plan: PlanRow): string | null {
  return getAppleSubscriptionProductId(plan.code);
}

async function purchaseSubscriptionViaIAP(plan: PlanRow): Promise<void> {
  const productId = getAppleProductIdForPlan(plan);
  if (!productId) throw new Error('No Apple subscription product configured for this plan.');

  await iapService.preloadProducts();
  const available = await iapService.isProductAvailable(productId);
  if (!available) {
    throw new Error(
      `Product not found: ${productId}. Create this auto-renewable subscription in App Store Connect and attach it to the app.`,
    );
  }

  const transaction = await iapService.purchase(productId);
  if (!transaction) return;

  const { data, error } = await supabase.functions.invoke('apple-iap-verify-subscription', {
    body: {
      receipt: transaction.receipt,
      transaction_id: transaction.transactionId,
      product_id: transaction.productId ?? productId,
      plan_code: plan.code,
      expiration_date_ms: transaction.expirationDateMs,
      original_transaction_id: transaction.originalTransactionId,
    },
  });

  if (error) {
    throw new Error(await getFunctionErrorMessage(error, data));
  }
  if (!data?.success) {
    throw new Error(typeof data?.error === 'string' ? data.error : 'Subscription verification failed');
  }
}

function loadRazorpayScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('No window'));
  if (window.Razorpay) return Promise.resolve();
  if (razorpayScriptPromise) return razorpayScriptPromise;

  razorpayScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = RAZORPAY_SCRIPT;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Razorpay checkout script'));
    document.head.appendChild(script);
  });

  return razorpayScriptPromise;
}

function priceLabel(p: PlanRow) {
  const period = p.period_days === 30 ? 'month' : p.period_days === 90 ? 'quarter' : `${p.period_days} days`;
  return { period };
}

async function getFunctionErrorMessage(error: any, data?: any): Promise<string> {
  if (typeof data?.error === 'string' && data.error.trim()) return data.error.trim();
  if (typeof data?.message === 'string' && data.message.trim()) return data.message.trim();

  const ctx = error?.context;
  if (ctx) {
    try {
      const cloned = typeof ctx.clone === 'function' ? ctx.clone() : ctx;
      if (typeof cloned.json === 'function') {
        const payload = await cloned.json();
        if (typeof payload?.error === 'string' && payload.error.trim()) return payload.error.trim();
        if (typeof payload?.message === 'string' && payload.message.trim()) return payload.message.trim();
      }
    } catch {
      // ignore parse failures
    }
    try {
      if (typeof ctx.text === 'function') {
        const text = await ctx.text();
        if (text?.trim()) return text.trim();
      }
    } catch {
      // ignore parse failures
    }
  }

  return error?.message || 'Request failed';
}

export default function Subscription() {
  const { user } = useAuth();
  const { tier, validUntil, cancelAtPeriodEnd } = useSubscriptionTier();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [activeSub, setActiveSub] = useState<ActiveSub | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyCode, setBusyCode] = useState<string | null>(null);
  const [selectedPlanCode, setSelectedPlanCode] = useState<string | null>(null);
  const [externalCheckoutPending, setExternalCheckoutPending] = useState(false);
  const [upgradeIntent, setUpgradeIntent] = useState<{
    plan: PlanRow;
    refundRupees: number;
    newChargeRupees: number;
    currentSubscriptionId: string;
    currentPlanCode: string;
  } | null>(null);
  const lockedFeature = searchParams.get('feature');

  const waitForSubscriptionActivation = async (timeoutMs = 180000, pollMs = 4000): Promise<boolean> => {
    if (!user) return false;
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      try {
        const { data: patientRow } = await (supabase as any)
          .from('patients')
          .select('id')
          .eq('auth_user_id', user.id)
          .maybeSingle();
        if (patientRow?.id) {
          const { data: tierRows, error: tierErr } = await (supabase as any).rpc('get_patient_effective_tier', {
            p_patient_id: patientRow.id,
          });
          if (!tierErr) {
            const row = Array.isArray(tierRows) ? tierRows[0] : tierRows;
            if (row?.tier === 'monitraq_plus') return true;
          }
        }
      } catch {
        // Keep polling; transient network issues should not abort the flow.
      }
      await new Promise((resolve) => setTimeout(resolve, pollMs));
    }

    return false;
  };

  const openCheckoutWithReturnHandling = async (checkoutUrl: string) => {
    if (Capacitor.isNativePlatform()) {
      setExternalCheckoutPending(true);
      toast.info('Complete payment, then close checkout to return to Monitraq.');
      const finishPromise = new Promise<void>((resolve) => {
        let resolved = false;
        Browser.addListener('browserFinished', () => {
          if (resolved) return;
          resolved = true;
          resolve();
        });
        // Safety fallback in case the event is not emitted on some devices.
        setTimeout(() => {
          if (resolved) return;
          resolved = true;
          resolve();
        }, 240000);
      });
      await Browser.open({
        url: checkoutUrl,
        presentationStyle: 'fullscreen',
        toolbarColor: '#080D1A',
      });
      await finishPromise;
      await Browser.removeAllListeners();
    } else {
      setExternalCheckoutPending(true);
      const newTab = window.open(checkoutUrl, '_blank', 'noopener,noreferrer');
      if (!newTab) {
        setExternalCheckoutPending(false);
        // Popup blocked fallback: use same tab as last resort.
        window.location.href = checkoutUrl;
        return;
      }
      toast.info('Complete payment in the opened tab, then return here.');
    }

    const activated = await waitForSubscriptionActivation(180000, 4000);
    if (activated) {
      toast.success('Payment successful. Monitraq+ activated.');
      navigate('/profile', { replace: true });
    } else {
      toast.info('If payment is done, refresh this page in a few moments.');
      setExternalCheckoutPending(false);
    }
  };

  const openWebSubscriptionCheckout = async (keyId: string, subscriptionId: string) => {
    setExternalCheckoutPending(true);
    await loadRazorpayScript();
    if (!window.Razorpay) throw new Error('Razorpay SDK unavailable');

    await new Promise<void>((resolve, reject) => {
      const rzp = new window.Razorpay({
        key: keyId,
        subscription_id: subscriptionId,
        name: 'Monitraq',
        description: 'Monitraq+ subscription',
        prefill: {
          email: user?.email || undefined,
        },
        handler: () => resolve(),
        modal: {
          ondismiss: () => resolve(),
        },
      });
      rzp.on('payment.failed', (err: any) => {
        reject(new Error(err?.error?.description || 'Payment failed'));
      });
      rzp.open();
    });

    const activated = await waitForSubscriptionActivation(180000, 4000);
    if (activated) {
      toast.success('Payment successful. Monitraq+ activated.');
      navigate('/profile', { replace: true });
    } else {
      toast.info('If payment is done, refresh this page in a few moments.');
      setExternalCheckoutPending(false);
    }
  };

  useEffect(() => {
    if (Capacitor.getPlatform() === 'ios') {
      void iapService.preloadProducts();
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [{ data: planRows }, { data: patientRow }] = await Promise.all([
        (supabase as any).from('subscription_plans').select('*').eq('is_active', true).order('period_days'),
        user
          ? (supabase as any).from('patients').select('id').eq('auth_user_id', user.id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      let subRow: ActiveSub | null = null;
      if (patientRow?.id) {
        const { data: subRows } = await (supabase as any)
          .from('patient_subscriptions')
          .select('id, plan_code, status, source, valid_until, razorpay_subscription_id, started_at, cancel_at_period_end')
          .eq('patient_id', patientRow.id)
          .in('status', ['active', 'paused', 'pending'])
          .order('started_at', { ascending: false })
          .limit(10);

        if (Array.isArray(subRows) && subRows.length) {
          const statusPriority: Record<string, number> = { active: 0, paused: 1, pending: 2 };
          const bestRow = [...subRows].sort((a: any, b: any) => {
            const pA = statusPriority[a.status] ?? 99;
            const pB = statusPriority[b.status] ?? 99;
            if (pA !== pB) return pA - pB;
            const tA = a.started_at ? new Date(a.started_at).getTime() : 0;
            const tB = b.started_at ? new Date(b.started_at).getTime() : 0;
            return tB - tA;
          })[0];
          subRow = bestRow as ActiveSub;
        }
      }

      setPlans(
        ((planRows || []) as PlanRow[]).map((p) => ({
          ...p,
          apple_product_id: getAppleSubscriptionProductId(p.code) ?? p.apple_product_id,
        })),
      );
      setActiveSub(subRow);
      setLoading(false);
    };
    load();
  }, [user]);

  const subscribe = async (plan: PlanRow) => {
    if (!user) { toast.error('Sign in to subscribe.'); return; }

    // If patient already has a live sub, run the plan-switch path instead of a fresh subscribe.
    if (activeSub && activeSub.plan_code !== plan.code && (activeSub.status === 'active' || activeSub.status === 'paused')) {
      // Compute what kind of switch this is (upgrade immediate vs downgrade scheduled)
      const { data: patientRow } = await (supabase as any)
        .from('patients').select('id').eq('auth_user_id', user.id).maybeSingle();
      if (!patientRow?.id) { toast.error('Patient row not found.'); return; }

      const { data: switchPlan, error: planErr } = await (supabase as any).rpc('compute_plan_switch', {
        p_patient_id: patientRow.id,
        p_new_plan_code: plan.code,
      });
      if (planErr) { toast.error(`Switch failed: ${planErr.message}`); return; }
      const swRow = Array.isArray(switchPlan) ? switchPlan[0] : switchPlan;
      const action: string = swRow?.action;

      if (action === 'upgrade_immediate') {
        const refundRupees = (swRow.prorated_refund_paise || 0) / 100;
        const newChargeRupees = (swRow.new_charge_paise || 0) / 100;
        setUpgradeIntent({
          plan,
          refundRupees,
          newChargeRupees,
          currentSubscriptionId: swRow.current_subscription_id,
          currentPlanCode: swRow.current_plan_code,
        });
        return;
      }

      if (action === 'downgrade_scheduled') {
        const effectiveDate = swRow.current_period_end
          ? new Date(swRow.current_period_end).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
          : 'end of current period';
        if (!confirm(
          `Downgrade scheduled: you stay on ${swRow.current_plan_code} until ${effectiveDate}, then ${plan.display_name} starts. No charge today. Continue?`
        )) return;
        setBusyCode(plan.code);
        try {
          const { error: schedErr } = await (supabase as any).rpc('schedule_plan_downgrade', {
            p_subscription_id: swRow.current_subscription_id,
            p_new_plan_code: plan.code,
          });
          if (schedErr) throw schedErr;
          toast.success(`Downgrade scheduled for ${effectiveDate}.`);
        } catch (e: any) {
          toast.error(`Schedule failed: ${e?.message || e}`);
        } finally { setBusyCode(null); }
        return;
      }

      if (action === 'same_plan') {
        toast.info('You are already on this plan.');
        return;
      }

      // Patient already cancelled their current sub but still has access until the
      // cycle ends. Razorpay doesn't support "uncancel" — the proper handling is to
      // create a NEW Razorpay subscription with start_at = current cycle's end. The
      // patient authorizes the new mandate now; first charge fires at the handover
      // moment so there's no gap in Monitraq+ access.
      if (action === 'queued_after_cancel') {
        const handoverDate = swRow.current_period_end
          ? new Date(swRow.current_period_end).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
          : 'end of current period';
        if (!confirm(
          `You cancelled your current plan — access continues until ${handoverDate}. Subscribe to ${plan.display_name} now: you authorize today, first charge happens on ${handoverDate} so there's no gap. Continue?`
        )) return;
        const periodEndUnix = swRow.current_period_end
          ? Math.floor(new Date(swRow.current_period_end).getTime() / 1000)
          : undefined;
        setBusyCode(plan.code);
        try {
          const { data, error } = await (supabase as any).functions.invoke('razorpay-subscription-create', {
            body: { plan_code: plan.code, start_at_unix: periodEndUnix },
          });
          if (error) throw new Error(await getFunctionErrorMessage(error, data));
          const checkoutUrl = data?.short_url || data?.checkout_url;
          const keyId = data?.key_id;
          const subscriptionId = data?.subscription_id;
          if (!Capacitor.isNativePlatform() && keyId && subscriptionId) {
            await openWebSubscriptionCheckout(keyId, subscriptionId);
          } else {
            if (!checkoutUrl) throw new Error('No checkout URL returned.');
            await openCheckoutWithReturnHandling(checkoutUrl);
          }
          toast.success(`Authorized — first charge on ${handoverDate}.`);
        } catch (e: any) {
          toast.error(`Resubscribe failed: ${e?.message || e}`);
        } finally { setBusyCode(null); }
        return;
      }

      if (action && action !== 'fresh_subscribe') {
        toast.error(`Unsupported switch action: ${action}`);
        return;
      }
    }

    // Fresh subscribe — Apple IAP on iOS, Razorpay elsewhere
    setBusyCode(plan.code);
    try {
      if (Capacitor.getPlatform() === 'ios' && getAppleProductIdForPlan(plan)) {
        await purchaseSubscriptionViaIAP(plan);
        const activated = await waitForSubscriptionActivation(180000, 4000);
        if (activated) {
          toast.success('Payment successful. Monitraq+ activated.');
          navigate('/profile', { replace: true });
        } else {
          toast.info('If payment is done, refresh this page in a few moments.');
        }
        return;
      }

      const { data, error } = await (supabase as any).functions.invoke('razorpay-subscription-create', {
        body: { plan_code: plan.code },
      });
      if (error) throw new Error(await getFunctionErrorMessage(error, data));
      const checkoutUrl = data?.short_url || data?.checkout_url;
      const keyId = data?.key_id;
      const subscriptionId = data?.subscription_id;
      if (!Capacitor.isNativePlatform() && keyId && subscriptionId) {
        await openWebSubscriptionCheckout(keyId, subscriptionId);
      } else {
        if (!checkoutUrl) throw new Error('No checkout URL returned.');
        await openCheckoutWithReturnHandling(checkoutUrl);
      }
    } catch (e: any) {
      const msg = e?.message || String(e);
      if (msg.toLowerCase().includes('cancel')) {
        toast.info('Purchase cancelled.');
      } else {
        toast.error(`Subscribe failed: ${msg}`);
      }
    } finally {
      setBusyCode(null);
    }
  };

  const cancellationScheduled = cancelAtPeriodEnd || !!activeSub?.cancel_at_period_end;
  const accessUntilDate = validUntil
    ? new Date(validUntil).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  const cancel = async () => {
    if (!activeSub) return;
    if (cancellationScheduled) return;
    if (!confirm('Cancel your Monitraq+ subscription? You will keep access until the current period ends.')) return;
    setBusyCode('__cancel__');
    try {
      if (activeSub.source === 'apple_iap') {
        await Browser.open({ url: 'https://apps.apple.com/account/subscriptions' });
        toast.info('Cancel from the Apple subscriptions screen.');
      } else {
        const { error } = await (supabase as any).functions.invoke('razorpay-subscription-cancel', {
          body: { subscription_id: activeSub.id },
        });
        if (error) throw error;
        setActiveSub((prev) => (prev ? { ...prev, cancel_at_period_end: true } : prev));
        toast.success('Subscription cancelled. Access continues until period end.');
      }
    } catch (e: any) {
      toast.error(`Cancel failed: ${e?.message || e}`);
    } finally {
      setBusyCode(null);
    }
  };

  const benefits = [
    'Live vitals + ECG history',
    'AI-generated weekly reports',
    'Chat directly with your doctor',
    'Live home camera monitoring',
    'Prescriptions + medication reminders',
    'Insurance claims + invoices',
  ];

  useEffect(() => {
    if (!plans.length) return;
    const requestedPlan = searchParams.get('plan');
    const validRequested = requestedPlan && plans.some((p) => p.code === requestedPlan) ? requestedPlan : null;
    const defaultPlan =
      validRequested ||
      activeSub?.plan_code ||
      (plans.find((p) => p.period_days === 90)?.code ?? plans[0].code);
    setSelectedPlanCode((prev) => prev ?? defaultPlan);
  }, [plans, activeSub?.plan_code, searchParams]);

  const selectedPlan = plans.find((p) => p.code === selectedPlanCode) || null;
  const hasPlanSwitchSelection =
    tier === 'monitraq_plus' &&
    !cancellationScheduled &&
    !!activeSub &&
    !!selectedPlan &&
    selectedPlan.code !== activeSub.plan_code;

  const executeUpgradeSwitch = async (
    plan: PlanRow,
    currentSubscriptionId: string,
    _refundRupees: number,
  ) => {
    setBusyCode(plan.code);
    try {
      const { data, error } = await (supabase as any).functions.invoke('razorpay-subscription-switch', {
        body: { action: 'upgrade', new_plan_code: plan.code, current_subscription_id: currentSubscriptionId },
      });
      if (error) throw new Error(await getFunctionErrorMessage(error, data));
      const checkoutUrl = data?.short_url || data?.checkout_url;
      const keyId = data?.key_id;
      const subscriptionId = data?.subscription_id;
      if (!Capacitor.isNativePlatform() && keyId && subscriptionId) {
        await openWebSubscriptionCheckout(keyId, subscriptionId);
      } else if (checkoutUrl) {
        await openCheckoutWithReturnHandling(checkoutUrl);
      } else {
        toast.success(`Upgrade started. Existing plan stays active unless the new payment succeeds.`);
      }
    } catch (e: any) {
      toast.error(`Upgrade failed: ${e?.message || e}`);
    } finally {
      setBusyCode(null);
    }
  };

  const handlePrimarySubscribe = async () => {
    if (!selectedPlan) {
      toast.error('Select a plan first.');
      return;
    }
    await subscribe(selectedPlan);
  };

  return (
    <div className="min-h-screen bg-[#080D1A] text-white pb-safe-bottom">
      <header className="sticky top-0 z-30 bg-[#080D1A]/95 backdrop-blur-md border-b border-white/5 px-4 pt-safe-top pb-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 rounded-xl px-2 py-2 -ml-1 min-h-[44px] min-w-[44px] text-slate-300 hover:text-white hover:bg-white/10 active:bg-white/15 transition-colors touch-manipulation"
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5 shrink-0" />
          <span className="text-sm font-medium">Back</span>
        </button>
      </header>

      <div className="max-w-md mx-auto px-4 py-5 pb-24 space-y-5">
        <div className="text-center space-y-3 rounded-3xl border border-slate-700/40 bg-[#1A243D] p-5 shadow-sm">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-amber-400/15 border border-amber-300/40">
            <img src="/monitraq-logo.png" alt="Monitraq" className="h-8 w-8 object-contain" />
          </div>
          <h1 className="text-3xl font-extrabold text-white">Monitraq+</h1>
          <p className="text-sm text-slate-300 leading-relaxed">
            Premium plan for full monitoring access. Appointments and AI Doctor remain separately paid on all tiers.
          </p>
        </div>

        {tier === 'free' && (
          <Card className="p-4 border-amber-300/40 bg-amber-500/10 rounded-2xl">
            <div>
              <p className="text-xs text-amber-100 font-semibold flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5" /> Current tier: Free
              </p>
              <p className="text-xs text-slate-200 mt-1">
                {lockedFeature
                  ? `${lockedFeature} is locked on Free. Select a plan to continue.`
                  : 'Select a monthly or quarterly plan to unlock premium features.'}
              </p>
            </div>
          </Card>
        )}

        {tier === 'monitraq_plus' && activeSub && (
          <Card className={`p-4 rounded-2xl ${cancellationScheduled ? 'bg-amber-500/10 border-amber-400/30' : 'bg-emerald-500/10 border-emerald-400/30'}`}>
            <div className={`flex items-center gap-2 ${cancellationScheduled ? 'text-amber-100' : 'text-emerald-100'}`}>
              <Check className="h-4 w-4" />
              <span className="font-medium">
                {cancellationScheduled ? 'Monitraq+ (cancelled)' : "You're on Monitraq+"}
              </span>
            </div>
            {accessUntilDate && (
              <p className="text-xs text-slate-200 mt-1">
                {cancellationScheduled
                  ? `Access until ${accessUntilDate} · Auto-renew off`
                  : `Renews ${accessUntilDate}`}
              </p>
            )}
            {!cancellationScheduled && (
              <Button
                variant="outline"
                size="sm"
                className="mt-3 border-white/25 bg-slate-900/45 text-white hover:bg-slate-800 font-semibold"
                onClick={cancel}
                disabled={busyCode === '__cancel__'}
              >
                {busyCode === '__cancel__' ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Cancelling…</> : 'Cancel subscription'}
              </Button>
            )}
          </Card>
        )}

        {/* Plan cards */}
        {externalCheckoutPending ? (
          <Card className="p-5 border-cyan-300/30 bg-cyan-500/10 rounded-2xl">
            <p className="text-sm font-semibold text-cyan-100">Payment in progress</p>
            <p className="text-xs text-slate-200 mt-1">
              Complete the Razorpay step in the opened page. This screen will auto-update once Monitraq+ is activated.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3 border-white/20 bg-slate-900 text-white hover:bg-slate-800"
              onClick={async () => {
                const activated = await waitForSubscriptionActivation(
                  30000,
                  1000,
                );
                if (activated) {
                  toast.success('Payment successful. Monitraq+ activated.');
                  navigate('/profile', { replace: true });
                } else {
                  toast.info('Still waiting for confirmation from payment provider.');
                }
              }}
            >
              I completed payment
            </Button>
          </Card>
        ) : loading ? (
          <Card className="p-6 text-center text-white/45">Loading plans…</Card>
        ) : (
          plans.map(p => {
            const { period } = priceLabel(p);
            const isCurrent = activeSub?.plan_code === p.code && tier === 'monitraq_plus';
            const isQuarterly = p.period_days === 90;
            const isSelected = selectedPlanCode === p.code;
            return (
              <Card
                key={p.code}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedPlanCode(p.code)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedPlanCode(p.code);
                  }
                }}
                className={`p-5 relative cursor-pointer transition ${
                  isSelected
                    ? 'ring-2 ring-amber-300/80 border-amber-300/80 bg-amber-500/15'
                    : isQuarterly
                    ? 'border-amber-400/40 bg-[#1A243D]'
                    : 'border-slate-700/40 bg-[#1A243D]'
                }`}
              >
                {isQuarterly && (() => {
                  const monthly = plans.find((pl) => pl.period_days === 30);
                  const saveRupees = monthly
                    ? Math.max(0, Math.round((monthly.price_paise * 3 - p.price_paise) / 100))
                    : 0;
                  return saveRupees > 0 ? (
                    <span className="absolute -top-2 right-3 text-[10px] uppercase tracking-wide bg-amber-300 text-black px-2 py-0.5 rounded-full font-semibold">
                      Save ₹{saveRupees.toLocaleString('en-IN')}
                    </span>
                  ) : null;
                })()}
                <h3 className="text-lg font-semibold text-snow">{p.display_name}</h3>
                {(() => {
                  const totalRupees = p.price_paise / 100;
                  return (
                    <>
                      <p className="text-3xl font-bold text-snow tabular-nums mt-1">
                        ₹{totalRupees.toLocaleString('en-IN')}
                        <span className="text-sm text-slate-400 font-normal"> / {period}</span>
                      </p>
                      <p className="text-xs text-cyan-300/80 mt-1">
                        Inclusive of applicable taxes
                      </p>
                    </>
                  );
                })()}
                <p className="text-xs text-slate-400 mt-1">Auto-renewing · Cancel anytime</p>
                <Button
                  className={`w-full mt-4 ${isQuarterly ? 'bg-amber-400 hover:bg-amber-300 text-black' : 'bg-slate-700 hover:bg-slate-600 text-white'}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedPlanCode(p.code);
                  }}
                  disabled={isCurrent || busyCode !== null}
                >
                  {isCurrent ? 'Current plan' : isSelected ? 'Selected' : 'Select plan'}
                </Button>
              </Card>
            );
          })
        )}

        {tier === 'free' && !externalCheckoutPending && (
          <Button
            className="w-full bg-amber-400 hover:bg-amber-300 text-black font-semibold"
            onClick={handlePrimarySubscribe}
            disabled={!selectedPlan || busyCode !== null}
          >
            {busyCode ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Starting…</> : `Upgrade to ${selectedPlan?.display_name || 'Monitraq+'}`}
          </Button>
        )}

        {hasPlanSwitchSelection && !externalCheckoutPending && (
          <Button
            className="w-full bg-amber-400 hover:bg-amber-300 text-black font-semibold"
            onClick={handlePrimarySubscribe}
            disabled={!selectedPlan || busyCode !== null}
          >
            {busyCode
              ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Starting…</>
              : `Switch to ${selectedPlan?.display_name}`}
          </Button>
        )}

        <Card className="p-4 bg-[#1A243D] border-slate-700/40 rounded-2xl">
          <p className="text-xs font-semibold text-slate-300 uppercase tracking-wide mb-2">What's included</p>
          <ul className="space-y-1.5">
            {benefits.map(b => (
              <li key={b} className="flex items-center gap-2 text-sm text-slate-200">
                <Check className="h-3.5 w-3.5 text-emerald-300 shrink-0" /> {b}
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-slate-400 mt-3 pt-3 border-t border-slate-700/50">
            Appointments + AI doctor sessions remain separately paid per use, on both Free and Monitraq+.
          </p>
        </Card>
      </div>

      <Dialog open={!!upgradeIntent} onOpenChange={(open) => { if (!open) setUpgradeIntent(null); }}>
        <DialogContent className="bg-[#101B34] border border-amber-300/30 text-white rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-amber-100">Confirm plan switch</DialogTitle>
            <DialogDescription className="text-slate-200">
              Confirm the upgrade details, then continue to Razorpay.
            </DialogDescription>
          </DialogHeader>

          {upgradeIntent && (
            <div className="rounded-xl border border-slate-700/50 bg-[#0B1428] p-3 space-y-2 text-sm">
              <p className="text-slate-300">
                Current plan: <span className="text-white font-semibold">{upgradeIntent.currentPlanCode}</span>
              </p>
              <p className="text-slate-300">
                New plan: <span className="text-white font-semibold">{upgradeIntent.plan.display_name}</span>
              </p>
              <p className="text-emerald-300">
                Refund: ₹{upgradeIntent.refundRupees.toLocaleString('en-IN')}
              </p>
              <p className="text-amber-200">
                New charge: ₹{upgradeIntent.newChargeRupees.toLocaleString('en-IN')}
              </p>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              className="border-white/25 bg-slate-900/45 text-white hover:bg-slate-800"
              onClick={() => setUpgradeIntent(null)}
              disabled={!!busyCode}
            >
              Cancel
            </Button>
            <Button
              className="bg-amber-400 hover:bg-amber-300 text-black font-semibold"
              disabled={!!busyCode || !upgradeIntent}
              onClick={async () => {
                if (!upgradeIntent) return;
                const intent = upgradeIntent;
                setUpgradeIntent(null);
                await executeUpgradeSwitch(
                  intent.plan,
                  intent.currentSubscriptionId,
                  intent.refundRupees,
                );
              }}
            >
              {busyCode ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Starting…</> : Capacitor.getPlatform() === 'ios' ? 'Subscribe with Apple' : 'Proceed to Razorpay'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

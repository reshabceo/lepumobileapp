import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export type SubscriptionTier = 'free' | 'monitraq_plus';

export interface SubscriptionState {
  tier: SubscriptionTier;
  validUntil: string | null;
  graceUntil: string | null;
  isInGrace: boolean;
  planCode: string | null;
  pendingPlanCode: string | null;
  /** Razorpay cancel_at_cycle_end scheduled — access until valid_until, no auto-renew */
  cancelAtPeriodEnd: boolean;
  loading: boolean;
}

/**
 * Resolves the patient's *effective* subscription tier from the DB, on every load
 * + realtime sub-row update. No cron — the `get_patient_effective_tier` RPC checks
 * (valid_until + 24h grace) > now() at read time. Webhook flips status on
 * renewal/cancel/failure; expiry happens lazily here.
 *
 * isInGrace: subscription has expired but we're still within the 24h grace window.
 * Surface this to the patient with a "Renew now" prompt.
 */
export function useSubscriptionTier(): SubscriptionState {
  const { user } = useAuth();
  const [state, setState] = useState<SubscriptionState>({
    tier: 'free', validUntil: null, graceUntil: null, isInGrace: false,
    planCode: null, pendingPlanCode: null, cancelAtPeriodEnd: false, loading: true,
  });

  useEffect(() => {
    if (!user?.id) {
      setState({ tier: 'free', validUntil: null, graceUntil: null, isInGrace: false,
                planCode: null, pendingPlanCode: null, cancelAtPeriodEnd: false, loading: false });
      return;
    }

    let cancelled = false;

    const load = async () => {
      // Resolve patient_id
      const { data: pRow } = await (supabase as any)
        .from('patients').select('id').eq('auth_user_id', user.id).maybeSingle();
      if (cancelled) return;
      if (!pRow?.id) {
        setState({ tier: 'free', validUntil: null, graceUntil: null, isInGrace: false,
                   planCode: null, pendingPlanCode: null, cancelAtPeriodEnd: false, loading: false });
        return;
      }
      const { data, error } = await (supabase as any).rpc('get_patient_effective_tier', { p_patient_id: pRow.id });
      if (cancelled) return;
      const row = Array.isArray(data) ? data[0] : data;
      if (error || !row) {
        setState({ tier: 'free', validUntil: null, graceUntil: null, isInGrace: false,
                   planCode: null, pendingPlanCode: null, cancelAtPeriodEnd: false, loading: false });
      } else {
        setState({
          tier: (row.tier as SubscriptionTier) || 'free',
          validUntil: row.valid_until || null,
          graceUntil: row.grace_until || null,
          isInGrace: !!row.is_in_grace,
          planCode: row.plan_code || null,
          pendingPlanCode: row.pending_plan_code || null,
          cancelAtPeriodEnd: !!row.cancel_at_period_end,
          loading: false,
        });
      }
    };

    load();

    // Realtime: re-resolve whenever the patient's subscription row changes.
    const channel = (supabase as any)
      .channel(`patient-sub-tier:${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'patient_subscriptions',
      }, () => { load(); })
      .subscribe();

    return () => {
      cancelled = true;
      (supabase as any).removeChannel(channel);
    };
  }, [user?.id]);

  return state;
}

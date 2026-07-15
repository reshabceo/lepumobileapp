/**
 * useDpdpConsent
 *
 * DPDP Act 2023 consent state for the signed-in patient.
 *
 * Reads the active notice version (`dpdp_consent_versions`) and the patient's
 * append-only consent ledger (`dpdp_consent_events`). Granting or withdrawing
 * a purpose INSERTS a new event row - the ledger is never updated in place.
 *
 * `needsConsent` is true when any REQUIRED purpose of the active notice
 * version has not been granted at that version, i.e. on first login and again
 * whenever the notice version changes.
 */

import { useCallback, useEffect, useState } from 'react';
import { supabase, resolvePatientId } from '@/lib/supabase';

export interface DpdpPurpose {
  key: string;
  label: string;
  description: string;
  required: boolean;
}

export interface DpdpNoticeVersion {
  version: string;
  language: string;
  notice_title: string;
  notice_body: string;
  purposes: DpdpPurpose[];
}

export interface DpdpConsentState {
  purpose_key: string;
  consent_version: string;
  action: 'granted' | 'withdrawn';
  occurred_at: string;
}

export function useDpdpConsent() {
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState(true); // false when tables not migrated yet
  const [patientId, setPatientId] = useState<string | null>(null);
  const [notice, setNotice] = useState<DpdpNoticeVersion | null>(null);
  const [current, setCurrent] = useState<Record<string, DpdpConsentState>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const authUserId = auth?.user?.id;
      if (!authUserId) {
        setLoading(false);
        return;
      }
      const pid = await resolvePatientId(authUserId);
      setPatientId(pid);

      const { data: versions, error: vErr } = await supabase
        .from('dpdp_consent_versions')
        .select('version, language, notice_title, notice_body, purposes')
        .eq('is_active', true)
        .eq('language', 'en')
        .limit(1);

      if (vErr) {
        // Table missing (migration not applied yet) - treat consent system as disabled.
        setAvailable(false);
        setLoading(false);
        return;
      }
      setAvailable(true);
      const activeNotice = versions?.[0] ?? null;
      setNotice(activeNotice as DpdpNoticeVersion | null);

      if (pid && activeNotice) {
        const { data: events } = await supabase
          .from('dpdp_consent_events')
          .select('purpose_key, consent_version, action, occurred_at')
          .eq('patient_id', pid)
          .order('occurred_at', { ascending: false });

        const latest: Record<string, DpdpConsentState> = {};
        (events ?? []).forEach((e) => {
          if (!latest[e.purpose_key]) latest[e.purpose_key] = e as DpdpConsentState;
        });
        setCurrent(latest);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const isGranted = useCallback(
    (purposeKey: string) => current[purposeKey]?.action === 'granted',
    [current],
  );

  /** Required purposes must be granted at the CURRENT notice version. */
  const needsConsent =
    available &&
    !!notice &&
    notice.purposes.some(
      (p) =>
        p.required &&
        !(
          current[p.key]?.action === 'granted' &&
          current[p.key]?.consent_version === notice.version
        ),
    );

  const record = useCallback(
    async (purposeKeys: string[], action: 'granted' | 'withdrawn') => {
      if (!patientId || !notice || purposeKeys.length === 0) return { error: null };
      const rows = purposeKeys.map((purpose_key) => ({
        patient_id: patientId,
        consent_version: notice.version,
        purpose_key,
        action,
        collected_via: 'mobile_app',
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      }));
      const { error } = await supabase.from('dpdp_consent_events').insert(rows);
      if (!error) await load();
      return { error };
    },
    [patientId, notice, load],
  );

  return {
    loading,
    available,
    notice,
    current,
    needsConsent,
    isGranted,
    grant: (keys: string[]) => record(keys, 'granted'),
    withdraw: (key: string) => record([key], 'withdrawn'),
    reload: load,
  };
}

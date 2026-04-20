import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

export type PatientVideoCall = {
  id: string
  doctor_id: string
  patient_id: string
  channel_name: string
  call_type: 'video' | 'audio'
  status: 'pending' | 'accepted' | 'declined' | 'ended' | 'missed'
  initiated_at: string
  accepted_at?: string
  ended_at?: string
  doctor_token?: string | null
  patient_token?: string | null
}

export type UsePatientVideoCallReturn = {
  currentCall: PatientVideoCall | null
  loading: boolean
  error: string | null
  initiateCall: (callType?: 'video' | 'audio') => Promise<PatientVideoCall | null>
  acceptCall: (callId: string) => Promise<boolean>
  declineCall: (callId: string) => Promise<boolean>
  endCall: (callId?: string) => Promise<boolean>
  loadLatestCall: () => Promise<PatientVideoCall | null>
  refreshToken: (callId: string) => Promise<string | null>
}

export function usePatientVideoCall(authUserId?: string | null): UsePatientVideoCallReturn {
  const [currentCall, setCurrentCall] = useState<PatientVideoCall | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [patientId, setPatientId] = useState<string | null>(null)

  // Resolve patient row once
  useEffect(() => {
    if (!authUserId) return
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase
        .from('patients')
        .select('id')
        .eq('auth_user_id', authUserId)
        .single()
      if (!cancelled) {
        if (error) {
          console.error('[CALL] Resolve patient id failed', authUserId, error)
          setError(error.message)
        } else {
          console.log('[CALL] Resolved patient id', data?.id)
          setPatientId(data?.id ?? null)
        }
      }
    })()
    return () => { cancelled = true }
  }, [authUserId])

  const loadLatestCall = useCallback(async (): Promise<PatientVideoCall | null> => {
    try {
      if (!patientId) return null

      // Prefer pending calls over accepted (pending = new incoming call notification)
      let { data, error } = await supabase
        .from('video_calls')
        .select('id, doctor_id, patient_id, channel_name, call_type, status, initiated_at, accepted_at, ended_at, doctor_token, patient_token')
        .eq('patient_id', patientId)
        .eq('status', 'pending')
        .order('initiated_at', { ascending: false })
        .limit(1)

      // If no pending call, check for accepted
      if (!data?.length) {
        const res = await supabase
          .from('video_calls')
          .select('id, doctor_id, patient_id, channel_name, call_type, status, initiated_at, accepted_at, ended_at, doctor_token, patient_token')
          .eq('patient_id', patientId)
          .eq('status', 'accepted')
          .order('initiated_at', { ascending: false })
          .limit(1)
        data = res.data
        error = res.error
      }

      const row = data?.[0]
      if (error || !row) {
        setCurrentCall(null)
        return null
      }
      const call: PatientVideoCall = {
        id: row.id,
        doctor_id: row.doctor_id,
        patient_id: row.patient_id,
        channel_name: row.channel_name,
        call_type: row.call_type,
        status: row.status,
        initiated_at: row.initiated_at,
        accepted_at: row.accepted_at,
        ended_at: row.ended_at,
        doctor_token: row.doctor_token,
        patient_token: row.patient_token
      }
      setCurrentCall(call)
      return call
    } catch { return null }
  }, [patientId])

  // Auto-expire stale pending/accepted calls older than 2 minutes
  useEffect(() => {
    if (!patientId) return
    const cleanup = async () => {
      const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString()
      await supabase
        .from('video_calls')
        .update({ status: 'missed' })
        .eq('patient_id', patientId)
        .in('status', ['pending', 'accepted'])
        .lt('initiated_at', twoMinAgo)
    }
    cleanup().catch(() => {})
  }, [patientId])

  // Subscribe to video_calls changes for this patient
  useEffect(() => {
    if (!patientId) return
    const pid = patientId
    console.log('[CALL] Setting up video_calls subscription for patient:', pid)

    const channel = supabase
      .channel(`patient_video_calls_${pid}`)
      // New calls inserted for this patient
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'video_calls',
        filter: `patient_id=eq.${pid}`
      }, payload => {
        const row = payload.new as any
        if (!row) return
        if (row.status === 'pending' || row.status === 'accepted') {
          console.log('[CALL] INSERT detected for patient:', row.id)
          setCurrentCall({
            id: row.id,
            doctor_id: row.doctor_id,
            patient_id: row.patient_id,
            channel_name: row.channel_name,
            call_type: row.call_type,
            status: row.status,
            initiated_at: row.initiated_at,
            accepted_at: row.accepted_at,
            ended_at: row.ended_at,
            doctor_token: row.doctor_token ?? null,
            patient_token: row.patient_token ?? null
          })
        }
      })
      // Status changes (accepted/ended/declined)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'video_calls',
        filter: `patient_id=eq.${pid}`
      }, payload => {
        const row = payload.new as any
        if (!row) return
        if (row.status === 'pending' || row.status === 'accepted') {
          console.log('[CALL] UPDATE to active status detected:', row.id, row.status)
          setCurrentCall({
            id: row.id,
            doctor_id: row.doctor_id,
            patient_id: row.patient_id,
            channel_name: row.channel_name,
            call_type: row.call_type,
            status: row.status,
            initiated_at: row.initiated_at,
            accepted_at: row.accepted_at,
            ended_at: row.ended_at,
            doctor_token: row.doctor_token ?? null,
            patient_token: row.patient_token ?? null
          })
        } else if (row.status === 'ended' || row.status === 'declined') {
          console.log('[CALL] UPDATE to ended/declined detected:', row.id)
          setCurrentCall(null)
        }
      })
      .subscribe((status) => {
        console.log('[CALL] Realtime subscription status:', status)
        if (status === 'SUBSCRIBED') {
          // Fetch immediately when socket is ready
          loadLatestCall().catch(() => {})
        }
      })

    return () => { 
      console.log('[CALL] Unsubscribing video_calls for patient:', pid)
      supabase.removeChannel(channel) 
    }
  }, [patientId, loadLatestCall])

  const acceptCall = useCallback(async (callId: string) => {
    try {
      setLoading(true)
      console.log('[CALL] acceptCall', callId)
      const { error } = await supabase
        .from('video_calls')
        .update({ status: 'accepted', accepted_at: new Date().toISOString() })
        .eq('id', callId)
      if (error) { setError(error.message); return false }
      return true
    } finally {
      setLoading(false)
    }
  }, [])

  const initiateCall = useCallback(async (_callType: 'video' | 'audio' = 'video'): Promise<PatientVideoCall | null> => {
    // Patients are not allowed to initiate calls in production
    console.warn('[CALL] Patient-initiated calls are disabled');
    setError('Patients cannot initiate calls');
    return null;
  }, [])

  const declineCall = useCallback(async (callId: string) => {
    try {
      setLoading(true)
      console.log('[CALL] declineCall', callId)
      const { error } = await supabase
        .from('video_calls')
        .update({ status: 'declined' })
        .eq('id', callId)
      if (error) { setError(error.message); return false }
      return true
    } finally {
      setLoading(false)
    }
  }, [])

  const endCall = useCallback(async (callId?: string) => {
    try {
      setLoading(true)
      // If no id provided, try currentCall then fallback to latest
      let idToEnd = callId || currentCall?.id || null
      if (!idToEnd) {
        if (!patientId) { console.warn('[CALL] endCall: patientId not ready'); return false }
        const { data } = await supabase
          .from('video_calls')
          .select('id')
          .eq('patient_id', patientId)
          .in('status', ['pending','accepted'])
          .order('initiated_at', { ascending: false })
          .limit(1)
        idToEnd = data?.[0]?.id ?? null
      }
      if (!idToEnd) { console.warn('[CALL] endCall: no active call found to end'); return false }
      console.log('[CALL] endCall', idToEnd)
      // Use secure RPC so participants can end regardless of RLS edge cases
      const { error } = await supabase
        .rpc('end_video_call', { p_call_id: idToEnd })
      if (error) { setError(error.message); return false }
      return true
    } finally {
      setLoading(false)
    }
  }, [])

  const refreshToken = useCallback(async (callId: string): Promise<string | null> => {
    try {
      // get channel name
      const { data: callRow, error: callErr } = await supabase
        .from('video_calls')
        .select('channel_name')
        .eq('id', callId)
        .single()
      if (callErr || !callRow) { console.error('[CALL] refreshToken call not found', callErr); return null }

      // Use backend function to generate token for patient role
      console.log('[CALL] generate_agora_token for', callRow.channel_name)
      const { data, error } = await supabase
        .rpc('generate_agora_token', {
          channel_name: callRow.channel_name,
          uid_param: 1002
        })
      if (error) { console.error('[CALL] generate_agora_token failed', error); return null }
      return (data as any)?.token ?? null
    } catch {
      return null
    }
  }, [])

  return { currentCall, loading, error, initiateCall, acceptCall, declineCall, endCall, loadLatestCall, refreshToken }
}



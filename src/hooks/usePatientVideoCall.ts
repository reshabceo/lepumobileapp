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

  // Subscribe to video_calls changes for this patient
  useEffect(() => {
    if (!patientId) return
    const pid = patientId
    const channel = supabase
      .channel(`patient_video_calls_${pid}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'video_calls',
        filter: `patient_id=eq.${pid}`
      }, payload => {
        console.log('[CALL] video_calls change', payload.eventType, payload.new)
        const row = payload.new as any
        if (!row) return
        if (['pending', 'accepted'].includes(row.status)) {
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
          console.log('[CALL] Clearing current call; status', row.status)
          setCurrentCall(null)
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [patientId])

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

  const initiateCall = useCallback(async (callType: 'video' | 'audio' = 'video'): Promise<PatientVideoCall | null> => {
    try {
      setLoading(true)
      setError(null)
      let pid = patientId
      // If patient id not yet resolved, fetch it on demand
      if (!pid) {
        if (!authUserId) { setError('Patient not found'); return null }
        const { data: p, error: perr } = await supabase
          .from('patients')
          .select('id')
          .eq('auth_user_id', authUserId)
          .single()
        if (perr || !p?.id) { setError('Patient not found'); return null }
        pid = p.id
        setPatientId(pid)
      }

      // Get assigned doctor id
      const { data: patientRow, error: pErr } = await supabase
        .from('patients')
        .select('assigned_doctor_id')
        .eq('id', pid)
        .single()
      if (pErr || !patientRow?.assigned_doctor_id) {
        console.error('[CALL] No assigned doctor', pErr)
        setError('No assigned doctor');
        return null
      }

      // Use server RPC to create call
      console.log('[CALL] initiate_video_call', { doctor: patientRow.assigned_doctor_id, patient: pid, callType })
      const { data: callResult, error: rpcErr } = await supabase
        .rpc('initiate_video_call', {
          p_doctor_id: patientRow.assigned_doctor_id,
          p_patient_id: pid,
          p_call_type: callType
        })
      if (rpcErr || !callResult?.success) {
        console.error('[CALL] initiate_video_call failed', rpcErr || callResult)
        setError(rpcErr?.message || callResult?.error || 'Failed to initiate call')
        return null
      }

      // Fetch created call with channel name
      console.log('[CALL] created call id', callResult.call_id)
      const { data: fullCall, error: fetchErr } = await supabase
        .from('video_calls')
        .select('id, doctor_id, patient_id, channel_name, call_type, status, initiated_at, accepted_at, ended_at, doctor_token, patient_token')
        .eq('id', callResult.call_id)
        .single()
      if (fetchErr || !fullCall) { console.error('[CALL] fetch created call failed', fetchErr); setError('Call created but not found'); return null }

      const newCall: PatientVideoCall = {
        id: fullCall.id,
        doctor_id: fullCall.doctor_id,
        patient_id: fullCall.patient_id,
        channel_name: fullCall.channel_name,
        call_type: fullCall.call_type,
        status: fullCall.status,
        initiated_at: fullCall.initiated_at,
        accepted_at: fullCall.accepted_at,
        ended_at: fullCall.ended_at,
        doctor_token: fullCall.doctor_token,
        patient_token: fullCall.patient_token
      }
      console.log('[CALL] newCall', newCall)
      setCurrentCall(newCall)
      return newCall
    } finally {
      setLoading(false)
    }
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
          uid_param: 0
        })
      if (error) { console.error('[CALL] generate_agora_token failed', error); return null }
      return (data as any)?.token ?? null
    } catch {
      return null
    }
  }, [])

  const loadLatestCall = useCallback(async (): Promise<PatientVideoCall | null> => {
    try {
      if (!patientId) return null
      const { data, error } = await supabase
        .from('video_calls')
        .select('id, doctor_id, patient_id, channel_name, call_type, status, initiated_at, accepted_at, ended_at, doctor_token, patient_token')
        .eq('patient_id', patientId)
        .in('status', ['pending','accepted'])
        .order('initiated_at', { ascending: false })
        .limit(1)
      const row = data?.[0]
      if (error || !row) return null
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

  return { currentCall, loading, error, initiateCall, acceptCall, declineCall, endCall, loadLatestCall, refreshToken }
}



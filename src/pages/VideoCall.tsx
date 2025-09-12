import React, { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import AgoraRTC, { AgoraRTCProvider, RemoteUser, useJoin, useLocalCameraTrack, useLocalMicrophoneTrack, usePublish, useRTCClient, useRemoteAudioTracks, useRemoteUsers } from 'agora-rtc-react'
import { Button } from '@/components/ui/button'
import { usePatientVideoCall } from '@/hooks/usePatientVideoCall'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

const VideoCallContent: React.FC<{ channel: string; appId: string; token: string | null; callId: string; onEnd: () => void; isVideo: boolean; }>=({ channel, appId, token, callId, onEnd, isVideo })=>{
  const { refreshToken } = usePatientVideoCall(null)
  const { isLoading: micLoading, localMicrophoneTrack } = useLocalMicrophoneTrack()
  const { isLoading: camLoading, localCameraTrack } = useLocalCameraTrack()
  const remoteUsers = useRemoteUsers()
  const { audioTracks } = useRemoteAudioTracks(remoteUsers)

  const [callToken, setCallToken] = useState<string | null>(token)

  useEffect(()=>{ (async()=>{ if(!callToken && callId){ console.log('[CALL] fetching token for', callId); const t = await refreshToken(callId); console.log('[CALL] token fetched?', !!t); setCallToken(t) } })() },[callId, callToken, refreshToken])

  usePublish([ localMicrophoneTrack, isVideo ? localCameraTrack : null ])

  const canJoin = !!callToken && !(micLoading || (isVideo && camLoading))
  useJoin({ appid: appId, channel, token: callToken ?? null }, canJoin)
  useEffect(()=>{ console.log('[CALL] remote users', remoteUsers.map(u=>u.uid)) },[remoteUsers])
  audioTracks.forEach(t=>t.play())

  const noRemote = remoteUsers.length === 0

  return (
    <div className="w-full h-full bg-black relative" style={{ minHeight: '100vh', paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="absolute right-2 z-10" style={{ top: 'calc(env(safe-area-inset-top) + 8px)' }}>
        <Button variant="destructive" size="sm" onClick={onEnd}>End</Button>
      </div>
      <div className="grid w-full h-full" style={{ gridTemplateColumns: remoteUsers.length>0 ? 'repeat(2,1fr)':'1fr' }}>
        {remoteUsers.map(u=> (
          <div key={u.uid} className="relative">
            <RemoteUser user={u} />
          </div>
        ))}
      </div>
      {/* Local preview removed per requirement; publishing still occurs without rendering */}
      {noRemote && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-white opacity-80">
            <div className="mx-auto w-10 h-10 border-4 border-white/40 border-t-white rounded-full animate-spin mb-3" />
            <div>Connecting… waiting for doctor</div>
          </div>
        </div>
      )}
    </div>
  )
}

const VideoCallPage: React.FC = () => {
  const { channel } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { currentCall, endCall, refreshToken } = usePatientVideoCall(user?.id)
  const [fallbackCallId, setFallbackCallId] = useState<string>('')
  const [fallbackToken, setFallbackToken] = useState<string | null>(null)
  const [fallbackType, setFallbackType] = useState<'video'|'audio'>('video')

  const appId = (import.meta.env.VITE_AGORA_APP_ID as string) || ''
  useEffect(()=>{ if(!appId){ console.error('[CALL] Missing VITE_AGORA_APP_ID env. Join will fail.'); } else { console.log('[CALL] Using Agora App ID:', appId) } },[appId])

  useEffect(() => {
    if (!channel) {
      navigate('/call/wait')
    }
  }, [channel, navigate])
  if (!channel) return null

  // If no currentCall from realtime yet, resolve by channel
  useEffect(() => {
    (async () => {
      if (currentCall || !channel) return
      console.log('[CALL] Resolving call by channel', channel)
      const { data, error } = await supabase
        .from('video_calls')
        .select('id, call_type, patient_token')
        .eq('channel_name', channel)
        .in('status', ['pending','accepted'])
        .order('initiated_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) { console.error('[CALL] Failed to resolve call by channel', error); return }
      if (data) {
        console.log('[CALL] Resolved call by channel', data.id)
        setFallbackCallId(data.id)
        setFallbackType((data.call_type as 'video'|'audio') || 'video')
        setFallbackToken(data.patient_token ?? null)
        if (!data.patient_token) {
          const t = await refreshToken(data.id)
          console.log('[CALL] fetched fallback token?', !!t)
          setFallbackToken(t)
        }
      }
    })()
  }, [channel, currentCall, refreshToken])

  const onEnd = async ()=>{ await endCall(fallbackCallId || currentCall?.id); navigate('/dashboard') }

  const client = useRTCClient(AgoraRTC.createClient({ codec:'vp8', mode:'rtc' }))
  return (
    <AgoraRTCProvider client={client}>
      <VideoCallContent
        channel={channel}
        appId={appId}
        token={currentCall?.patient_token ?? fallbackToken}
        callId={currentCall?.id ?? fallbackCallId}
        onEnd={onEnd}
        isVideo={(currentCall?.call_type ?? fallbackType) === 'video'}
      />
    </AgoraRTCProvider>
  )
}

export default VideoCallPage



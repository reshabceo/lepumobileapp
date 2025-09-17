import React, { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import AgoraRTC, { AgoraRTCProvider, RemoteUser, useJoin, useLocalCameraTrack, useLocalMicrophoneTrack, usePublish, useRTCClient, useRemoteAudioTracks, useRemoteUsers } from 'agora-rtc-react'
import { Button } from '@/components/ui/button'
import { usePatientVideoCall } from '@/hooks/usePatientVideoCall'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Mic, MicOff, Video, VideoOff, PhoneOff } from 'lucide-react'

const VideoCallContent: React.FC<{ channel: string; appId: string; token: string | null; callId: string; onEnd: () => void; isVideo: boolean; }>=({ channel, appId, token, callId, onEnd, isVideo })=>{
  const { refreshToken } = usePatientVideoCall(null)
  const { isLoading: micLoading, localMicrophoneTrack } = useLocalMicrophoneTrack()
  const { isLoading: camLoading, localCameraTrack } = useLocalCameraTrack()
  const remoteUsers = useRemoteUsers()
  const { audioTracks } = useRemoteAudioTracks(remoteUsers)

  const [callToken, setCallToken] = useState<string | null>(token)
  const [isMicOn, setIsMicOn] = useState(true)
  const [isCameraOn, setIsCameraOn] = useState(isVideo)

  // Fetch token: try Supabase RPC first, then fallback to local token server
  useEffect(()=>{
    (async()=>{
      if(callToken || !callId) return
      console.log('[CALL] fetching token for', callId)
      let t: string | null = null
      try {
        t = await refreshToken(callId)
      } catch {}
      if(!t){
        try {
          const resp = await fetch(`http://localhost:3002/api/agora/token?channelName=${channel}&uid=1002`)
          if(resp.ok){ const data = await resp.json(); t = data?.token || null }
        } catch {}
      }
      console.log('[CALL] token fetched?', !!t)
      if(t) setCallToken(t)
    })()
  },[callId, callToken, refreshToken, channel])

  usePublish([ localMicrophoneTrack, isVideo ? localCameraTrack : null ])

  // Ensure local tracks start enabled
  useEffect(()=>{ (async()=>{ try{ if(localMicrophoneTrack){ await localMicrophoneTrack.setEnabled(isMicOn) } }catch{}; try{ if(localCameraTrack){ await localCameraTrack.setEnabled(isCameraOn && isVideo) } }catch{} })() },[localMicrophoneTrack, localCameraTrack])

  const canJoin = !(micLoading || (isVideo && camLoading)) && !!callToken
  useJoin({ appid: appId, channel, token: callToken || undefined, uid: 1002 }, canJoin)
  
  useEffect(()=>{ 
    console.log('[CALL] remote users', remoteUsers.map(u=>u.uid))
    console.log('[CALL] remote users count:', remoteUsers.length)
    console.log('[CALL] remote users full objects:', remoteUsers)
    console.log('[CALL] audio tracks:', audioTracks.length)
  },[remoteUsers, audioTracks])
  audioTracks.forEach(t=>t.play())

  const noRemote = remoteUsers.length === 0
  console.log('[CALL] UI state - noRemote:', noRemote, 'remoteUsers.length:', remoteUsers.length)

  return (
        <>
          <style>{`
            .agora-rtc-remote-user-video,
            .agora-rtc-remote-user-video video,
            video {
              width: 100% !important;
              height: 100% !important;
              object-fit: cover !important;
              background: black !important;
            }
            div[data-user-uid],
            div[data-user-uid] > div,
            div[data-user-uid] > div > div {
              width: 100% !important;
              height: 100% !important;
              position: relative !important;
            }
          `}</style>
      <div className="w-full h-full bg-black relative" style={{ minHeight: '100vh', paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="absolute right-2 z-10" style={{ top: 'calc(env(safe-area-inset-top) + 8px)' }}>
        <Button variant="destructive" size="sm" onClick={onEnd}>End</Button>
      </div>
      {/* Layout: show remote full screen when present; local as PiP */}
      <div className="w-full h-full relative">
        {remoteUsers.length > 0 ? (
          <div className="relative w-full h-full bg-black" style={{ minHeight: 'calc(100vh - 64px)' }}>
            {remoteUsers.map((user) => (
              <div key={user.uid} className="absolute inset-0">
                <RemoteUser user={user} />
                <div className="absolute bottom-2 right-2 text-white text-sm bg-black/60 px-2 py-1 rounded z-10">
                  Doctor ({user.uid})
                </div>
              </div>
            ))}

            {/* Local PiP */}
            {isVideo && (
              <div className="absolute bottom-4 right-4 w-28 h-40 bg-gray-800 rounded-lg overflow-hidden shadow-lg z-20">
                {localCameraTrack ? (
                  <div
                    ref={(ref) => { if (ref && localCameraTrack) { localCameraTrack.play(ref) } }}
                    className="w-full h-full"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-white">You</div>
                )}
                <div className="absolute bottom-1 left-1 text-[10px] text-white bg-black/50 px-1 rounded">You</div>
              </div>
            )}

            {/* Controls */}
            <div className="absolute bottom-4 left-0 right-0 flex items-center justify-center space-x-3 z-30">
              <Button
                variant={isMicOn ? 'secondary' : 'destructive'}
                size="sm"
                className="rounded-full h-12 w-12 p-0"
                onClick={async ()=>{ try { const next=!isMicOn; setIsMicOn(next); await localMicrophoneTrack?.setEnabled?.(next) } catch {} }}
              >
                {isMicOn ? <Mic className="h-5 w-5"/> : <MicOff className="h-5 w-5"/>}
              </Button>

              {isVideo && (
                <Button
                  variant={isCameraOn ? 'secondary' : 'destructive'}
                  size="sm"
                  className="rounded-full h-12 w-12 p-0"
                  onClick={async ()=>{ try { const next=!isCameraOn; setIsCameraOn(next); await localCameraTrack?.setEnabled?.(next) } catch {} }}
                >
                  {isCameraOn ? <Video className="h-5 w-5"/> : <VideoOff className="h-5 w-5"/>}
                </Button>
              )}

              <Button
                variant="destructive"
                size="sm"
                className="rounded-full h-12 w-12 p-0"
                onClick={onEnd}
                title="End call"
              >
                <PhoneOff className="h-5 w-5"/>
              </Button>
            </div>
          </div>
        ) : (
          // No remote yet: show local full screen with connecting overlay
          <div className="relative w-full h-full bg-black" style={{ minHeight: 'calc(100vh - 64px)' }}>
            {isVideo && localCameraTrack ? (
              <div
                ref={(ref) => { if (ref && localCameraTrack) { localCameraTrack.play(ref) } }}
                className="w-full h-full"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-white">Preparing camera…</div>
            )}
            <div className="absolute bottom-2 left-2 text-white text-sm bg-black/60 px-2 py-1 rounded">You</div>

            {/* Controls while waiting */}
            <div className="absolute bottom-4 left-0 right-0 flex items-center justify-center space-x-3 z-30">
              <Button
                variant={isMicOn ? 'secondary' : 'destructive'}
                size="sm"
                className="rounded-full h-12 w-12 p-0"
                onClick={async ()=>{ try { const next=!isMicOn; setIsMicOn(next); await localMicrophoneTrack?.setEnabled?.(next) } catch {} }}
              >
                {isMicOn ? <Mic className="h-5 w-5"/> : <MicOff className="h-5 w-5"/>}
              </Button>
              {isVideo && (
                <Button
                  variant={isCameraOn ? 'secondary' : 'destructive'}
                  size="sm"
                  className="rounded-full h-12 w-12 p-0"
                  onClick={async ()=>{ try { const next=!isCameraOn; setIsCameraOn(next); await localCameraTrack?.setEnabled?.(next) } catch {} }}
                >
                  {isCameraOn ? <Video className="h-5 w-5"/> : <VideoOff className="h-5 w-5"/>}
                </Button>
              )}
              <Button
                variant="destructive"
                size="sm"
                className="rounded-full h-12 w-12 p-0"
                onClick={onEnd}
                title="End call"
              >
                <PhoneOff className="h-5 w-5"/>
              </Button>
            </div>
          </div>
        )}
      </div>
      {noRemote && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-white opacity-80">
            <div className="mx-auto w-10 h-10 border-4 border-white/40 border-t-white rounded-full animate-spin mb-3" />
            <div>Connecting… waiting for doctor</div>
          </div>
        </div>
      )}
    </div>
    </>
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

      const appId = import.meta.env.VITE_AGORA_APP_ID as string
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

  // Ensure call ends if the tab/window is closed
  useEffect(() => {
    const activeCallId = currentCall?.id ?? fallbackCallId
    if (!activeCallId) return

    const handleBeforeUnload = async () => {
      try { await endCall(activeCallId) } catch {}
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => { window.removeEventListener('beforeunload', handleBeforeUnload) }
  }, [currentCall?.id, fallbackCallId, endCall])

  // Auto-redirect when the other party ends/declines the call
  useEffect(() => {
    const activeCallId = currentCall?.id ?? fallbackCallId
    if (!activeCallId) return

    const channel = supabase
      .channel(`vc-status-${activeCallId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'video_calls',
        filter: `id=eq.${activeCallId}`,
      }, (payload: any) => {
        const status = payload?.new?.status
        if (status && ['ended','declined','missed','cancelled'].includes(status)) {
          navigate('/dashboard')
        }
      })
      .subscribe()

    return () => { try { supabase.removeChannel(channel) } catch {} }
  }, [currentCall?.id, fallbackCallId, navigate])

  const client = useRTCClient(useMemo(() => AgoraRTC.createClient({ codec:'vp8', mode:'rtc' }), []))
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



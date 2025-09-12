import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { usePatientVideoCall } from '@/hooks/usePatientVideoCall'
import { Button } from '@/components/ui/button'

const WaitingForDoctor: React.FC = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { currentCall, endCall, loadLatestCall } = usePatientVideoCall(user?.id)
  const [secondsLeft, setSecondsLeft] = useState<number>(30)
  const timerRef = useRef<number | null>(null)
  const pollRef = useRef<number | null>(null)

  // Ensure we have the latest call when this screen opens
  useEffect(() => { (async()=>{ await loadLatestCall() })() }, [loadLatestCall])

  // Poll for the latest call until accepted/ended (covers missed realtime INSERT)
  useEffect(() => {
    // Start polling if we have no call or it's still pending
    const shouldPoll = !currentCall || currentCall.status === 'pending'
    if (!shouldPoll) {
      if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null }
      return
    }
    if (pollRef.current) { window.clearInterval(pollRef.current) }
    pollRef.current = window.setInterval(async () => {
      const call = await loadLatestCall()
      if (call && (call.status === 'accepted' || call.status === 'ended' || call.status === 'declined')) {
        if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null }
      }
    }, 1000)
    return () => { if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null } }
  }, [currentCall, loadLatestCall])

  useEffect(() => {
    console.log('[CALL] Waiting screen currentCall=', currentCall)
    if (currentCall?.status === 'accepted' && currentCall.channel_name) {
      console.log('[CALL] Doctor accepted, navigating to', currentCall.channel_name)
      navigate(`/call/${currentCall.channel_name}`)
    } else if (currentCall && (currentCall.status === 'ended' || currentCall.status === 'declined')) {
      console.log('[CALL] Call is no longer active, returning to dashboard')
      navigate('/dashboard')
    }
  }, [currentCall, navigate])

  // Auto-cancel after 30s if still pending
  useEffect(() => {
    if (!currentCall || currentCall.status !== 'pending') {
      if (timerRef.current) { window.clearInterval(timerRef.current); timerRef.current = null }
      setSecondsLeft(30)
      return
    }
    // start countdown
    if (timerRef.current) { window.clearInterval(timerRef.current) }
    const startedAt = Date.now()
    setSecondsLeft(30)
    timerRef.current = window.setInterval(async () => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000)
      const remaining = Math.max(0, 30 - elapsed)
      setSecondsLeft(remaining)
      if (remaining <= 0) {
        console.log('[CALL] Auto-cancel timer reached 30s, ending call')
        try { await endCall(currentCall.id) } catch {}
        window.clearInterval(timerRef.current!)
        timerRef.current = null
        navigate('/dashboard')
      }
    }, 1000)
    return () => { if (timerRef.current) { window.clearInterval(timerRef.current); timerRef.current = null } }
  }, [currentCall, endCall, navigate])

  return (
    <div className="bg-[#101010] min-h-screen text-white flex items-center justify-center p-6">
      <div className="max-w-sm w-full text-center">
        <div className="mx-auto w-16 h-16 rounded-full border-4 border-green-500 border-t-transparent animate-spin mb-4" />
        <h1 className="text-xl font-semibold mb-2">Waiting for doctor…</h1>
        <p className="text-gray-400">Keep this screen open. You will automatically join when your doctor accepts.</p>
        {currentCall?.channel_name && (
          <p className="text-xs text-gray-500 mt-3">Channel: {currentCall.channel_name}</p>
        )}
        {currentCall?.status === 'pending' && (
          <p className="text-xs text-gray-500 mt-2">Auto-cancel in {secondsLeft}s</p>
        )}
        <div className="mt-6">
          <Button
            variant="destructive"
            onClick={async ()=>{ console.log('[CALL] Cancel pressed, ending call'); await endCall(currentCall?.id); navigate('/dashboard') }}
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}

export default WaitingForDoctor



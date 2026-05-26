import React, { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { usePatientVideoCall } from '@/hooks/usePatientVideoCall'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Phone, PhoneOff, Video, Mic } from 'lucide-react'
import { supabase, resolvePatientId } from '@/lib/supabase'

export const GlobalVideoCallNotification: React.FC = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { currentCall, acceptCall, declineCall, loadLatestCall } = usePatientVideoCall(user?.id)
  const [isVisible, setIsVisible] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [patientId, setPatientId] = useState<string | null>(null)
  const pollRef = useRef<number | null>(null)
  // Stable ref so the poll/subscription effects don't re-run on callback identity.
  const loadLatestCallRef = useRef(loadLatestCall)
  useEffect(() => { loadLatestCallRef.current = loadLatestCall }, [loadLatestCall])

  // Resolve patient ID once (shared/deduped across all components).
  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    resolvePatientId(user.id).then((id) => {
      if (!cancelled && id) setPatientId(id)
    })
    return () => { cancelled = true }
  }, [user?.id])

  // Show notification when there's a pending call
  useEffect(() => {
    console.log('[NOTIFICATION] currentCall changed:', currentCall?.id, currentCall?.status)
    if (currentCall?.status === 'pending') {
      console.log('[NOTIFICATION] Showing incoming call notification')
      setIsVisible(true)
      try {
        const audio = new Audio('/notification-sound.mp3')
        audio.play().catch(() => {})
      } catch {}
    } else {
      setIsVisible(false)
      setIsProcessing(false)
    }
  }, [currentCall])

  // Polling fallback -- use a ref so the interval isn't killed by re-renders
  useEffect(() => {
    if (!user?.id) return

    pollRef.current = window.setInterval(async () => {
      if (isVisible) return
      try {
        await loadLatestCallRef.current()
      } catch {}
    }, 20000) // 20s fallback poll — realtime subscription is the primary mechanism; 2s hammered the API

    return () => {
      if (pollRef.current) {
        window.clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [user?.id]) // deliberately exclude isVisible so interval survives

  // Realtime subscription as primary mechanism
  useEffect(() => {
    if (!patientId) return
    const pid = patientId
    // Only fetch once per subscription, not on every reconnect (the realtime socket
    // cycles SUBSCRIBED→CLOSED→SUBSCRIBED; refetching each time floods the API).
    let didInitialLoad = false

    const channel = supabase
      .channel(`vc_global_${pid}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'video_calls',
        filter: `patient_id=eq.${pid}`,
      }, () => {
        loadLatestCallRef.current().catch(() => {})
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'video_calls',
        filter: `patient_id=eq.${pid}`,
      }, (payload) => {
        const row: any = payload.new
        if (['ended', 'declined', 'missed', 'cancelled'].includes(row?.status)) {
          setIsVisible(false)
        }
        loadLatestCallRef.current().catch(() => {})
      })
      .subscribe((status) => {
        console.log('[NOTIFICATION] Realtime subscription status:', status)
        if (status === 'SUBSCRIBED' && !didInitialLoad) {
          didInitialLoad = true
          loadLatestCallRef.current().catch(() => {})
        }
      })

    return () => { try { supabase.removeChannel(channel) } catch {} }
  }, [patientId])

  // On auth sign-in, trigger a load
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        // Defer: never run a query INSIDE the auth-state callback — it executes while
        // GoTrue holds its lock, causing reentrant contention. setTimeout(0) lets the
        // lock release first. Use the ref so this effect doesn't re-subscribe.
        setTimeout(() => { loadLatestCallRef.current().catch(() => {}) }, 0)
      }
    })
    return () => { sub?.subscription?.unsubscribe?.() }
  }, [])

  const handleAccept = async () => {
    if (!currentCall || isProcessing) return
    setIsProcessing(true)
    try {
      const success = await acceptCall(currentCall.id)
      if (success && currentCall.channel_name) {
        // Save call data so the WebRTC hook on the VideoCall page can reconnect
        localStorage.setItem('webrtc_active_call', JSON.stringify({
          id: currentCall.id,
          doctorId: currentCall.doctor_id,
          doctorName: 'Doctor',
          callType: currentCall.call_type || 'video',
          status: 'ringing',
          startedAt: new Date().toISOString()
        }))
        navigate(`/call/${currentCall.channel_name}`)
        setIsVisible(false)
      }
    } catch (error) {
      console.error('Failed to accept call:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDecline = async () => {
    if (!currentCall || isProcessing) return
    setIsProcessing(true)
    try {
      await declineCall(currentCall.id)
      setIsVisible(false)
    } catch (error) {
      console.error('Failed to decline call:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  if (!isVisible || !currentCall || currentCall.status !== 'pending') return null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />

      {/* Notification Card */}
      <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 w-[90%] max-w-sm">
        <Card className="bg-white border-0 shadow-2xl">
          <CardContent className="p-6">
            <div className="text-center space-y-4">
              {/* Pulsing animation */}
              <div className="mx-auto w-20 h-20 bg-green-100 rounded-full flex items-center justify-center animate-pulse">
                {currentCall.call_type === 'video' ? (
                  <Video className="h-10 w-10 text-green-600" />
                ) : (
                  <Phone className="h-10 w-10 text-green-600" />
                )}
              </div>

              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-1">
                  Incoming {currentCall.call_type === 'video' ? 'Video' : 'Audio'} Call
                </h3>
                <p className="text-gray-600">Your doctor is calling you</p>
              </div>

              {/* Doctor Info */}
              <div className="flex items-center justify-center space-x-3 py-2">
                <Avatar className="h-12 w-12">
                  <AvatarImage src="/doctor-placeholder.png" />
                  <AvatarFallback className="bg-blue-100 text-blue-600 font-semibold">Dr</AvatarFallback>
                </Avatar>
                <div className="text-left">
                  <p className="font-semibold text-gray-900">Your Doctor</p>
                  <p className="text-sm text-gray-500">Incoming call</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3 pt-2">
                <Button
                  variant="destructive"
                  className="flex-1 rounded-full h-12"
                  onClick={handleDecline}
                  disabled={isProcessing}
                >
                  <PhoneOff className="h-5 w-5 mr-2" />
                  Decline
                </Button>
                <Button
                  className="flex-1 rounded-full h-12 bg-green-600 hover:bg-green-700"
                  onClick={handleAccept}
                  disabled={isProcessing}
                >
                  <Phone className="h-5 w-5 mr-2" />
                  {isProcessing ? 'Connecting...' : 'Accept'}
                </Button>
              </div>

              {/* Call Type Indicator */}
              <div className="flex items-center justify-center space-x-4 text-sm text-gray-500 pt-2">
                {currentCall.call_type === 'video' && (
                  <div className="flex items-center space-x-1">
                    <Video className="h-4 w-4" />
                    <span>Video enabled</span>
                  </div>
                )}
                <div className="flex items-center space-x-1">
                  <Mic className="h-4 w-4" />
                  <span>Audio enabled</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}

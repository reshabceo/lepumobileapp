import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { usePatientVideoCall } from '@/hooks/usePatientVideoCall'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Phone, PhoneOff, Video, Mic } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export const GlobalVideoCallNotification: React.FC = () => {
  console.log('[CALL][GlobalNotice] COMPONENT LOADING')
  const navigate = useNavigate()
  const { user } = useAuth()
  const { currentCall, acceptCall, declineCall, loadLatestCall } = usePatientVideoCall(user?.id)
  const [isVisible, setIsVisible] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [pollTimer, setPollTimer] = useState<number | null>(null)
  const [debugInfo, setDebugInfo] = useState<string>('')

  // Debug mount
  useEffect(() => { 
    console.log('[CALL][GlobalNotice] mounted, user=', user?.id)
    setDebugInfo(`Mounted with user: ${user?.id || 'null'}`)
  }, [user?.id])

  // Ensure we react immediately after auth state changes (no manual refresh needed)
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'SIGNED_IN') {
        try {
          await loadLatestCall()
        } catch {}
      }
    })
    return () => { sub?.subscription?.unsubscribe?.() }
  }, [loadLatestCall])

  // Show notification when there's a pending call
  useEffect(() => {
    console.log('[CALL][GlobalNotice] currentCall change =', currentCall)
    setDebugInfo(`Call: ${currentCall ? `${currentCall.status} - ${currentCall.id}` : 'null'}`)
    if (currentCall?.status === 'pending') {
      console.log('[CALL][GlobalNotice] SHOWING notification for pending call')
      setIsVisible(true)
      // Stop polling once we have a call
      if (pollTimer) { window.clearInterval(pollTimer); setPollTimer(null) }
      // Play a notification sound if available
      try {
        const audio = new Audio('/notification-sound.mp3')
        audio.play().catch(() => {
          console.log('🔔 Incoming video call notification')
        })
      } catch {
        console.log('🔔 Incoming video call notification')
      }
    } else {
      console.log('[CALL][GlobalNotice] HIDING notification, status:', currentCall?.status)
      setIsVisible(false)
      setIsProcessing(false)
    }
  }, [currentCall])

  // Polling fallback in case realtime insert is missed
  useEffect(() => {
    if (!user?.id) return
    if (isVisible) return
    if (pollTimer) return
    console.log('[CALL][GlobalNotice] Starting poll timer...')
    const timer = window.setInterval(async () => {
      try {
        console.log('[CALL][GlobalNotice] Polling for latest call...')
        const call = await loadLatestCall()
        if (call?.status === 'pending') {
          console.log('[CALL][GlobalNotice] Poll picked up pending call', call.id)
          // setVisible will be handled in currentCall effect once hook updates
        } else {
          console.log('[CALL][GlobalNotice] Poll found no pending calls:', call?.status || 'no call')
        }
      } catch (err) {
        console.warn('[CALL][GlobalNotice] Poll error:', err)
      }
    }, 1000)
    setPollTimer(timer)
    return () => { 
      console.log('[CALL][GlobalNotice] Clearing poll timer')
      if (timer) { window.clearInterval(timer) } 
    }
  }, [user?.id, isVisible, pollTimer, loadLatestCall])

  const handleAccept = async () => {
    if (!currentCall || isProcessing) return
    
    setIsProcessing(true)
    try {
      const success = await acceptCall(currentCall.id)
      if (success && currentCall.channel_name) {
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

  // Debug patient ID resolution
  const [patientInfo, setPatientInfo] = useState<{id: string | null, authId: string | null}>({id: null, authId: null})
  
  useEffect(() => {
    if (!user?.id) return
    ;(async () => {
      const { data, error } = await supabase
        .from('patients')
        .select('id')
        .eq('auth_user_id', user.id)
        .single()
      setPatientInfo({
        id: data?.id || null,
        authId: user.id
      })
    })()
  }, [user?.id])

  // Direct realtime subscription as a safety net (in addition to hook)
  useEffect(() => {
    if (!patientInfo.id) return
    const pid = patientInfo.id
    const channel = supabase
      .channel(`vc_global_${pid}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'video_calls',
        filter: `patient_id=eq.${pid}`,
      }, payload => {
        const row: any = payload.new
        if (row?.status === 'pending') {
          setIsVisible(true)
          setDebugInfo(`INSERT ${row.id}`)
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'video_calls',
        filter: `patient_id=eq.${pid}`,
      }, payload => {
        const row: any = payload.new
        if (row?.status === 'pending') {
          setIsVisible(true)
          setDebugInfo(`UPDATE ${row.id}`)
        }
        if (['ended','declined','missed','cancelled'].includes(row?.status)) {
          setIsVisible(false)
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          loadLatestCall().catch(()=>{})
        }
      })

    return () => { try { supabase.removeChannel(channel) } catch {} }
  }, [patientInfo.id, loadLatestCall])

  return (
    <>
      {/* Temporary debug info (disabled)
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        background: 'black',
        color: 'white',
        padding: '10px',
        fontSize: '12px',
        zIndex: 1000,
        width: '100%'
      }}>
        DEBUG: {debugInfo} | Visible: {isVisible ? 'YES' : 'NO'} | AuthUser: {patientInfo.authId} | PatientID: {patientInfo.id}
      </div>
      */}
      
      {isVisible && currentCall && currentCall.status === 'pending' && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity duration-300"
            onClick={() => setIsVisible(false)}
          />
          
          {/* Notification Card */}
          <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 w-[90%] max-w-sm transition-all duration-300">
            <Card className="bg-white border-0 shadow-2xl">
              <CardContent className="p-6">
                <div className="text-center space-y-4">
                  {/* Pulsing animation for urgent attention */}
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
                    <p className="text-gray-600">
                      Your doctor is calling you
                    </p>
                  </div>

                  {/* Doctor Avatar and Info */}
                  <div className="flex items-center justify-center space-x-3 py-2">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src="/doctor-placeholder.png" />
                      <AvatarFallback className="bg-blue-100 text-blue-600 font-semibold">
                        Dr
                      </AvatarFallback>
                    </Avatar>
                    <div className="text-left">
                      <p className="font-semibold text-gray-900">Dr. Doctor</p>
                      <p className="text-sm text-gray-500">Your assigned doctor</p>
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
      )}
    </>
  )
}

import React, { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import PatientWebRTCInterface from '@/components/PatientWebRTCInterface'
import { Home } from 'lucide-react'

const VideoCallPage: React.FC = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [patientId, setPatientId] = React.useState<string | null>(null)

  // Get patient ID from auth user
  useEffect(() => {
    if (!user?.id) return
    
    const getPatientId = async () => {
      const { data, error } = await supabase
        .from('patients')
        .select('id')
        .eq('auth_user_id', user.id)
        .single()
      
      if (error) {
        console.error('[VideoCall] Failed to get patient ID:', error)
        return
      }
      
      if (data) {
        setPatientId(data.id)
      }
    }
    
    getPatientId()
  }, [user?.id])

  const handleCallEnd = () => {
    console.log('[VideoCall] Call ended, navigating to dashboard')
    navigate('/dashboard')
  }

  if (!patientId) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <Card className="p-6 bg-gray-800 text-white">
          <h2 className="text-xl font-bold mb-4">Loading...</h2>
          <p className="mb-4">Setting up video call...</p>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <PatientWebRTCInterface
        patientId={patientId}
        onCallEnd={handleCallEnd}
      />
    </div>
  )
}

export default VideoCallPage



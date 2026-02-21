/**
 * Call Logs Service
 * Handles logging of all audio/video calls to database
 */

import { supabase } from '@/lib/supabase';

export interface CallLogData {
  callId: string;
  appointmentId?: string;
  doctorId: string;
  patientId: string;
  callType: 'audio' | 'video';
  callMode: 'scheduled' | 'emergency' | 'instant';
  clientInfo?: Record<string, any>;
  networkInfo?: Record<string, any>;
}

export interface CallLogUpdate {
  status?: 'initiated' | 'ringing' | 'connected' | 'reconnecting' | 'ended' | 'failed' | 'missed' | 'declined';
  endedBy?: 'doctor' | 'patient' | 'system' | 'timeout';
  disconnectReason?: string;
  iceConnectionState?: string;
  peerConnectionState?: string;
  errorLog?: any;
}

/**
 * Initialize a new call log
 */
export async function initializeCallLog(data: CallLogData) {
  try {
    const { data: callLog, error } = await supabase
      .from('call_logs')
      .insert({
        call_id: data.callId,
        appointment_id: data.appointmentId || null,
        doctor_id: data.doctorId,
        patient_id: data.patientId,
        call_type: data.callType,
        call_mode: data.callMode,
        status: 'initiated',
        client_info: data.clientInfo || {},
        network_info: data.networkInfo || {},
        initiated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('[CallLogs] Error initializing call log:', error);
      return { success: false, error };
    }

    console.log('[CallLogs] ✅ Call log initialized:', callLog.call_id);
    return { success: true, data: callLog };
  } catch (error) {
    console.error('[CallLogs] Exception initializing call log:', error);
    return { success: false, error };
  }
}

/**
 * Update call status (ringing, connected, etc.)
 */
export async function updateCallStatus(callId: string, update: CallLogUpdate) {
  try {
    const updateData: any = {
      status: update.status,
      updated_at: new Date().toISOString()
    };

    // Add timestamp based on status
    if (update.status === 'ringing') {
      updateData.ringing_at = new Date().toISOString();
    } else if (update.status === 'connected') {
      updateData.connected_at = new Date().toISOString();
    } else if (update.status === 'ended' || update.status === 'failed' || update.status === 'missed' || update.status === 'declined') {
      updateData.disconnected_at = new Date().toISOString();
      updateData.ended_by = update.endedBy;
      updateData.disconnect_reason = update.disconnectReason;
    }

    // Add technical details
    if (update.iceConnectionState) {
      updateData.ice_connection_state = update.iceConnectionState;
    }
    if (update.peerConnectionState) {
      updateData.peer_connection_state = update.peerConnectionState;
    }

    const { data, error } = await supabase
      .from('call_logs')
      .update(updateData)
      .eq('call_id', callId)
      .select()
      .single();

    if (error) {
      console.error('[CallLogs] Error updating call status:', error);
      return { success: false, error };
    }

    console.log(`[CallLogs] ✅ Call ${callId} status updated to: ${update.status}`);
    return { success: true, data };
  } catch (error) {
    console.error('[CallLogs] Exception updating call status:', error);
    return { success: false, error };
  }
}

/**
 * Increment reconnection attempts
 */
export async function incrementReconnectionAttempt(callId: string) {
  try {
    const { data: currentLog } = await supabase
      .from('call_logs')
      .select('reconnection_attempts')
      .eq('call_id', callId)
      .single();

    if (currentLog) {
      await supabase
        .from('call_logs')
        .update({ 
          reconnection_attempts: (currentLog.reconnection_attempts || 0) + 1,
          status: 'reconnecting'
        })
        .eq('call_id', callId);
    }

    console.log(`[CallLogs] ✅ Reconnection attempt logged for call ${callId}`);
    return { success: true };
  } catch (error) {
    console.error('[CallLogs] Exception incrementing reconnection:', error);
    return { success: false, error };
  }
}

/**
 * Add error log to call
 */
export async function addCallErrorLog(callId: string, errorLog: any) {
  try {
    const { data: currentLog } = await supabase
      .from('call_logs')
      .select('error_logs')
      .eq('call_id', callId)
      .single();

    if (currentLog) {
      const errorLogs = Array.isArray(currentLog.error_logs) ? currentLog.error_logs : [];
      errorLogs.push({
        timestamp: new Date().toISOString(),
        error: errorLog
      });

      await supabase
        .from('call_logs')
        .update({ error_logs: errorLogs })
        .eq('call_id', callId);
    }

    console.log(`[CallLogs] ✅ Error logged for call ${callId}`);
    return { success: true };
  } catch (error) {
    console.error('[CallLogs] Exception adding error log:', error);
    return { success: false, error };
  }
}

/**
 * Get active call for current user (for rejoin functionality)
 */
export async function getActiveCallForUser() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    const { data, error } = await supabase
      .rpc('get_active_call_for_user', { user_auth_id: user.id });

    if (error) {
      console.error('[CallLogs] Error getting active call:', error);
      return { success: false, error };
    }

    if (data && data.length > 0) {
      console.log('[CallLogs] ✅ Active call found:', data[0].call_id);
      return { success: true, data: data[0] };
    }

    return { success: true, data: null };
  } catch (error) {
    console.error('[CallLogs] Exception getting active call:', error);
    return { success: false, error };
  }
}

/**
 * Get call history for user
 */
export async function getCallHistory(limit: number = 50) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    // Get user's patient ID
    const { data: patient } = await supabase
      .from('patients')
      .select('id')
      .eq('auth_user_id', user.id)
      .single();

    if (!patient) {
      return { success: false, error: 'Patient not found' };
    }

    // Get call history
    const { data, error } = await supabase
      .from('call_logs')
      .select(`
        *,
        doctor:doctors!doctor_id(id, full_name, specialization),
        patient:patients!patient_id(id, full_name)
      `)
      .eq('patient_id', patient.id)
      .order('initiated_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[CallLogs] Error getting call history:', error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (error) {
    console.error('[CallLogs] Exception getting call history:', error);
    return { success: false, error };
  }
}

/**
 * End a call
 */
export async function endCall(
  callId: string, 
  endedBy: 'doctor' | 'patient' | 'system' | 'timeout',
  reason?: string
) {
  return updateCallStatus(callId, {
    status: 'ended',
    endedBy,
    disconnectReason: reason || 'Call ended normally'
  });
}

/**
 * Mark call as failed
 */
export async function failCall(callId: string, reason: string) {
  return updateCallStatus(callId, {
    status: 'failed',
    endedBy: 'system',
    disconnectReason: reason
  });
}

/**
 * Decline a call
 */
export async function declineCall(callId: string, declinedBy: 'doctor' | 'patient') {
  return updateCallStatus(callId, {
    status: 'declined',
    endedBy: declinedBy,
    disconnectReason: 'Call declined by user'
  });
}

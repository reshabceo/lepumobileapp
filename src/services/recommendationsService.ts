import { supabase } from '@/lib/supabase';

// =====================================================
// TYPES
// =====================================================

export type RecommendationType = 
  | 'medication' 
  | 'lifestyle' 
  | 'diet' 
  | 'exercise' 
  | 'followup' 
  | 'diagnostic' 
  | 'treatment' 
  | 'preventive' 
  | 'monitoring' 
  | 'behavioral'
  | 'threshold';

export type RecommendationPriority = 'low' | 'medium' | 'high' | 'urgent';

export type RecommendationStatus = 'active' | 'in_progress' | 'completed' | 'dismissed' | 'expired';

export type RecommendationSource = 'ai_analysis' | 'doctor' | 'system' | 'risk_assessment' | 'vital_trigger';

export interface HealthRecommendation {
  id: string;
  patient_id: string;
  doctor_id?: string;
  recommendation_type: RecommendationType;
  title: string;
  description: string;
  priority: RecommendationPriority;
  urgency_level: number;
  source: RecommendationSource;
  source_reference?: string;
  ai_confidence?: number;
  status: RecommendationStatus;
  valid_from: string;
  valid_until?: string;
  reminder_frequency?: 'once' | 'daily' | 'weekly' | 'monthly';
  action_items: ActionItem[];
  related_vitals?: Record<string, any>;
  related_conditions?: string[];
  viewed_at?: string;
  completed_at?: string;
  dismissed_at?: string;
  dismissal_reason?: string;
  patient_feedback?: 'helpful' | 'not_helpful' | 'neutral';
  effectiveness_score?: number;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface ActionItem {
  id: string;
  action: string;
  completed: boolean;
  due_date?: string;
}

export interface CarePlan {
  id: string;
  patient_id: string;
  doctor_id: string;
  plan_name: string;
  plan_type: string;
  description?: string;
  primary_goal: string;
  secondary_goals?: string[];
  milestones: Milestone[];
  start_date: string;
  end_date?: string;
  status: string;
  progress_percentage: number;
  adherence_score?: number;
  created_at: string;
}

export interface Milestone {
  name: string;
  target_date: string;
  status: 'pending' | 'in_progress' | 'achieved';
  achieved_date?: string;
}

export interface PatientGoal {
  id: string;
  patient_id: string;
  care_plan_id?: string;
  goal_type: string;
  goal_name: string;
  description?: string;
  metric_name: string;
  metric_unit?: string;
  baseline_value?: number;
  target_value: number;
  current_value?: number;
  target_min?: number;
  target_max?: number;
  start_date: string;
  target_date: string;
  achieved_date?: string;
  status: string;
  progress_percentage: number;
  created_at: string;
}

export interface MedicationAdherence {
  total_doses: number;
  taken_doses: number;
  missed_doses: number;
  adherence_percentage: number;
  on_time_percentage: number;
}

// =====================================================
// RECOMMENDATIONS CRUD
// =====================================================

export const getActiveRecommendations = async (patientId: string): Promise<HealthRecommendation[]> => {
  try {
    const { data, error } = await supabase
      .rpc('get_active_recommendations', { p_patient_id: patientId });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching active recommendations:', error);
    throw error;
  }
};

export const getAllRecommendations = async (patientId: string): Promise<HealthRecommendation[]> => {
  try {
    const { data, error } = await supabase
      .from('health_recommendations')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching all recommendations:', error);
    throw error;
  }
};

export const getRecommendationsByType = async (
  patientId: string, 
  type: RecommendationType
): Promise<HealthRecommendation[]> => {
  try {
    const { data, error } = await supabase
      .from('health_recommendations')
      .select('*')
      .eq('patient_id', patientId)
      .eq('recommendation_type', type)
      .eq('status', 'active')
      .order('priority', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching recommendations by type:', error);
    throw error;
  }
};

export const markRecommendationAsViewed = async (recommendationId: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('health_recommendations')
      .update({ viewed_at: new Date().toISOString() })
      .eq('id', recommendationId);

    if (error) throw error;

    // Track the view action
    await trackRecommendationAction(recommendationId, 'viewed');
  } catch (error) {
    console.error('Error marking recommendation as viewed:', error);
    throw error;
  }
};

export const markRecommendationAsCompleted = async (
  recommendationId: string,
  patientId: string,
  outcomeNotes?: string
): Promise<void> => {
  try {
    const { error } = await supabase
      .from('health_recommendations')
      .update({ 
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', recommendationId);

    if (error) throw error;

    // Track the completion
    await supabase
      .from('recommendation_tracking')
      .insert({
        recommendation_id: recommendationId,
        patient_id: patientId,
        action_type: 'completed',
        outcome: 'successful',
        outcome_notes: outcomeNotes
      });
  } catch (error) {
    console.error('Error marking recommendation as completed:', error);
    throw error;
  }
};

export const dismissRecommendation = async (
  recommendationId: string,
  patientId: string,
  reason?: string
): Promise<void> => {
  try {
    const { error } = await supabase
      .from('health_recommendations')
      .update({ 
        status: 'dismissed',
        dismissed_at: new Date().toISOString(),
        dismissal_reason: reason
      })
      .eq('id', recommendationId);

    if (error) throw error;

    // Track the dismissal
    await supabase
      .from('recommendation_tracking')
      .insert({
        recommendation_id: recommendationId,
        patient_id: patientId,
        action_type: 'dismissed',
        action_details: reason
      });
  } catch (error) {
    console.error('Error dismissing recommendation:', error);
    throw error;
  }
};

export const updateRecommendationFeedback = async (
  recommendationId: string,
  feedback: 'helpful' | 'not_helpful' | 'neutral',
  effectivenessScore?: number
): Promise<void> => {
  try {
    const { error } = await supabase
      .from('health_recommendations')
      .update({ 
        patient_feedback: feedback,
        effectiveness_score: effectivenessScore
      })
      .eq('id', recommendationId);

    if (error) throw error;

    // Track the feedback
    await trackRecommendationAction(recommendationId, 'feedback_given', feedback);
  } catch (error) {
    console.error('Error updating recommendation feedback:', error);
    throw error;
  }
};

// =====================================================
// RECOMMENDATION TRACKING
// =====================================================

export const trackRecommendationAction = async (
  recommendationId: string,
  actionType: string,
  actionDetails?: string
): Promise<void> => {
  try {
    // Get patient ID from the recommendation
    const { data: recommendation } = await supabase
      .from('health_recommendations')
      .select('patient_id')
      .eq('id', recommendationId)
      .single();

    if (!recommendation) return;

    const { error } = await supabase
      .from('recommendation_tracking')
      .insert({
        recommendation_id: recommendationId,
        patient_id: recommendation.patient_id,
        action_type: actionType,
        action_details: actionDetails
      });

    if (error) throw error;
  } catch (error) {
    console.error('Error tracking recommendation action:', error);
    // Don't throw - tracking failures shouldn't break the main flow
  }
};

// =====================================================
// CARE PLANS
// =====================================================

export const getPatientCarePlans = async (patientId: string): Promise<CarePlan[]> => {
  try {
    const { data, error } = await supabase
      .from('care_plans')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching care plans:', error);
    throw error;
  }
};

export const getActiveCarePlan = async (patientId: string): Promise<CarePlan | null> => {
  try {
    const { data, error } = await supabase
      .from('care_plans')
      .select('*')
      .eq('patient_id', patientId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // Ignore "no rows" error
    return data || null;
  } catch (error) {
    console.error('Error fetching active care plan:', error);
    return null;
  }
};

// =====================================================
// PATIENT GOALS
// =====================================================

export const getPatientGoals = async (patientId: string): Promise<PatientGoal[]> => {
  try {
    const { data, error } = await supabase
      .from('patient_goals')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching patient goals:', error);
    throw error;
  }
};

export const getActiveGoals = async (patientId: string): Promise<PatientGoal[]> => {
  try {
    const { data, error } = await supabase
      .from('patient_goals')
      .select('*')
      .eq('patient_id', patientId)
      .in('status', ['active', 'in_progress'])
      .order('target_date', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching active goals:', error);
    throw error;
  }
};

export const updateGoalProgress = async (
  goalId: string,
  currentValue: number,
  progressPercentage: number
): Promise<void> => {
  try {
    const { error } = await supabase
      .from('patient_goals')
      .update({ 
        current_value: currentValue,
        progress_percentage: progressPercentage,
        last_tracked_at: new Date().toISOString()
      })
      .eq('id', goalId);

    if (error) throw error;
  } catch (error) {
    console.error('Error updating goal progress:', error);
    throw error;
  }
};

// =====================================================
// MEDICATION ADHERENCE
// =====================================================

export const getMedicationAdherence = async (
  patientId: string,
  days: number = 30
): Promise<MedicationAdherence> => {
  try {
    const { data, error } = await supabase
      .rpc('calculate_medication_adherence', { 
        p_patient_id: patientId,
        p_days: days
      });

    if (error) throw error;
    
    return data?.[0] || {
      total_doses: 0,
      taken_doses: 0,
      missed_doses: 0,
      adherence_percentage: 0,
      on_time_percentage: 0
    };
  } catch (error) {
    console.error('Error fetching medication adherence:', error);
    throw error;
  }
};

export const recordMedicationTaken = async (
  adherenceId: string,
  takenAt?: Date
): Promise<void> => {
  try {
    const { error } = await supabase
      .from('medication_adherence')
      .update({ 
        taken: true,
        taken_at: (takenAt || new Date()).toISOString(),
        missed: false
      })
      .eq('id', adherenceId);

    if (error) throw error;
  } catch (error) {
    console.error('Error recording medication taken:', error);
    throw error;
  }
};

export const recordMedicationMissed = async (
  adherenceId: string,
  reason?: string,
  notes?: string
): Promise<void> => {
  try {
    const { error } = await supabase
      .from('medication_adherence')
      .update({ 
        missed: true,
        taken: false,
        missed_reason: reason,
        missed_notes: notes
      })
      .eq('id', adherenceId);

    if (error) throw error;
  } catch (error) {
    console.error('Error recording medication missed:', error);
    throw error;
  }
};

// =====================================================
// AI INTEGRATION - CREATE RECOMMENDATIONS FROM ANALYSIS
// =====================================================

export const createRecommendationsFromAIAnalysis = async (
  patientId: string,
  doctorId: string,
  analysisData: any,
  sourceReference: string
): Promise<string[]> => {
  try {
    const recommendations = analysisData.recommendations || [];
    const createdIds: string[] = [];

    for (const rec of recommendations) {
      // Parse recommendation text to extract details
      const title = rec.split(':')[0] || 'Health Recommendation';
      const description = rec.split(':')[1]?.trim() || rec;
      
      // Determine type based on keywords
      let type: RecommendationType = 'treatment';
      if (rec.toLowerCase().includes('medication') || rec.toLowerCase().includes('drug')) {
        type = 'medication';
      } else if (rec.toLowerCase().includes('diet') || rec.toLowerCase().includes('food')) {
        type = 'diet';
      } else if (rec.toLowerCase().includes('exercise') || rec.toLowerCase().includes('activity')) {
        type = 'exercise';
      } else if (rec.toLowerCase().includes('follow') || rec.toLowerCase().includes('appointment')) {
        type = 'followup';
      } else if (rec.toLowerCase().includes('test') || rec.toLowerCase().includes('lab')) {
        type = 'diagnostic';
      } else if (rec.toLowerCase().includes('lifestyle') || rec.toLowerCase().includes('habit')) {
        type = 'lifestyle';
      } else if (rec.toLowerCase().includes('monitor')) {
        type = 'monitoring';
      }

      // Determine priority based on urgency keywords
      let priority: RecommendationPriority = 'medium';
      if (rec.toLowerCase().includes('urgent') || rec.toLowerCase().includes('immediate')) {
        priority = 'urgent';
      } else if (rec.toLowerCase().includes('important') || rec.toLowerCase().includes('critical')) {
        priority = 'high';
      } else if (rec.toLowerCase().includes('consider') || rec.toLowerCase().includes('may')) {
        priority = 'low';
      }

      const { data, error } = await supabase
        .from('health_recommendations')
        .insert({
          patient_id: patientId,
          doctor_id: doctorId,
          recommendation_type: type,
          title: title,
          description: description,
          priority: priority,
          source: 'ai_analysis',
          source_reference: sourceReference,
          ai_confidence: analysisData.confidence || 0.8,
          status: 'active'
        })
        .select('id')
        .single();

      if (error) {
        console.error('Error creating recommendation:', error);
        continue;
      }

      if (data) {
        createdIds.push(data.id);
      }
    }

    return createdIds;
  } catch (error) {
    console.error('Error creating recommendations from AI analysis:', error);
    throw error;
  }
};

// =====================================================
// VITAL SIGN TRIGGERED RECOMMENDATIONS
// =====================================================

/** Parse active per-patient threshold config from health_recommendations (description = JSON). */
export async function evaluateThresholdsAfterVitalInsert(
  patientId: string,
  vitalRow: {
    measurement_type?: string;
    data?: Record<string, unknown>;
  }
): Promise<void> {
  try {
    const { data: rows } = await supabase
      .from('health_recommendations')
      .select('id, description')
      .eq('patient_id', patientId)
      .eq('recommendation_type', 'threshold')
      .eq('status', 'active')
      .limit(5);

    if (!rows?.length) return;

    let limits: Record<string, { min?: number; max?: number }> = {};
    for (const r of rows) {
      try {
        const parsed = JSON.parse(r.description || '{}') as Record<
          string,
          { min?: number; max?: number }
        >;
        limits = { ...limits, ...parsed };
      } catch {
        /* skip malformed */
      }
    }

    const mt = vitalRow.measurement_type || '';
    const d = vitalRow.data || {};

    if (mt === 'heart_rate') {
      const hr = Number(d.pulseRate ?? d.heartRate);
      if (!Number.isFinite(hr)) return;
      const max = limits.heart_rate?.max ?? limits.hr?.max;
      const min = limits.heart_rate?.min ?? limits.hr?.min;
      if (max != null && hr > max) {
        await createRecommendationFromVitalTrigger(patientId, 'heart_rate', hr, 'high');
      }
      if (min != null && hr < min) {
        await createRecommendationFromVitalTrigger(patientId, 'heart_rate', hr, 'low');
      }
    }

    if (mt === 'spo2') {
      const o = Number(d.oxygenSaturation ?? d.spo2);
      if (!Number.isFinite(o)) return;
      const min = limits.spo2?.min;
      if (min != null && o < min) {
        await createRecommendationFromVitalTrigger(patientId, 'spo2', o, 'low');
      }
    }

    if (mt === 'blood_pressure') {
      const sys = Number(d.systolic);
      if (!Number.isFinite(sys)) return;
      const max = limits.systolic?.max ?? limits.blood_pressure?.max;
      if (max != null && sys > max) {
        await createRecommendationFromVitalTrigger(patientId, 'blood_pressure', sys, 'high');
      }
    }
  } catch (e) {
    console.warn('evaluateThresholdsAfterVitalInsert', e);
  }
}

export const createRecommendationFromVitalTrigger = async (
  patientId: string,
  vitalType: string,
  vitalValue: number,
  thresholdBreach: 'high' | 'low'
): Promise<string> => {
  try {
    const { data, error } = await supabase
      .rpc('create_recommendation_from_vital_trigger', {
        p_patient_id: patientId,
        p_vital_type: vitalType,
        p_vital_value: vitalValue,
        p_threshold_breach: thresholdBreach
      });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating recommendation from vital trigger:', error);
    throw error;
  }
};

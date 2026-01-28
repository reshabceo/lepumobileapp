import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Target, Pill, Apple, Dumbbell, Calendar, Stethoscope, Heart, AlertCircle, Activity } from 'lucide-react';

interface RecommendationNotification {
  id: string;
  title: string;
  recommendation_type: string;
  priority: string;
  created_at: string;
}

// Icon mapping for recommendation types
const getRecommendationIcon = (type: string) => {
  switch (type) {
    case 'medication': return '💊';
    case 'diet': return '🍎';
    case 'exercise': return '💪';
    case 'followup': return '📅';
    case 'diagnostic': return '🩺';
    case 'treatment': return '❤️';
    case 'monitoring': return '📊';
    case 'preventive': return '🛡️';
    case 'lifestyle': return '🌟';
    case 'behavioral': return '🧠';
    default: return '🎯';
  }
};

// Priority styling
const getPriorityLabel = (priority: string) => {
  switch (priority) {
    case 'urgent': return '🚨 URGENT';
    case 'high': return '⚡ High Priority';
    case 'medium': return 'Medium';
    case 'low': return 'Low';
    default: return '';
  }
};

export const useHealthRecommendationsNotifications = () => {
  const { toast } = useToast();
  const [unreadCount, setUnreadCount] = useState(0);
  const [latestRecommendation, setLatestRecommendation] = useState<RecommendationNotification | null>(null);

  useEffect(() => {
    let subscription: any;

    const setupNotifications = async () => {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;

      // Get patient ID
      const { data: patient } = await supabase
        .from('patients')
        .select('id')
        .eq('auth_user_id', user.id)
        .single();

      if (!patient) return;

      // Get count of recommendations created in last 24 hours (unread)
      const twentyFourHoursAgo = new Date();
      twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

      const { data: recentRecs, error } = await supabase
        .from('health_recommendations')
        .select('id, title, recommendation_type, priority, created_at')
        .eq('patient_id', patient.id)
        .gte('created_at', twentyFourHoursAgo.toISOString())
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (!error && recentRecs) {
        setUnreadCount(recentRecs.length);
        if (recentRecs.length > 0) {
          setLatestRecommendation(recentRecs[0]);
        }
      }

      // Subscribe to real-time updates for new recommendations
      subscription = supabase
        .channel('health_recommendations_channel')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'health_recommendations',
            filter: `patient_id=eq.${patient.id}`,
          },
          async (payload: any) => {
            console.log('🎯 New health recommendation received:', payload);
            
            const newRec = payload.new;
            
            // Update unread count
            setUnreadCount(prev => prev + 1);
            setLatestRecommendation({
              id: newRec.id,
              title: newRec.title,
              recommendation_type: newRec.recommendation_type,
              priority: newRec.priority,
              created_at: newRec.created_at
            });

            // Show toast notification with icon and priority
            const icon = getRecommendationIcon(newRec.recommendation_type);
            const priorityLabel = getPriorityLabel(newRec.priority);
            
            toast({
              title: `${icon} New Health Recommendation`,
              description: `${priorityLabel ? priorityLabel + ': ' : ''}${newRec.title}`,
              duration: newRec.priority === 'urgent' ? 10000 : 6000, // Longer duration for urgent
              variant: newRec.priority === 'urgent' ? 'destructive' : 'default',
            });
          }
        )
        .subscribe();
    };

    setupNotifications();

    // Cleanup subscription on unmount
    return () => {
      if (subscription) {
        supabase.removeChannel(subscription);
      }
    };
  }, [toast]);

  const markAsRead = () => {
    setUnreadCount(0);
  };

  return {
    unreadCount,
    latestRecommendation,
    markAsRead,
  };
};

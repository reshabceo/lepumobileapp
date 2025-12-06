import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

interface ClaimNotification {
  id: string;
  claim_number: string;
  total_charge: number;
  currency: string;
  created_at: string;
}

export const useInsuranceClaimsNotifications = () => {
  const { toast } = useToast();
  const [unreadCount, setUnreadCount] = useState(0);
  const [latestClaim, setLatestClaim] = useState<ClaimNotification | null>(null);

  useEffect(() => {
    let subscription: any;

    const setupNotifications = async () => {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;

      // Get count of claims created in last 24 hours (unread)
      const twentyFourHoursAgo = new Date();
      twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

      const { data: recentClaims, error } = await supabase
        .from('insurance_claims')
        .select('id, claim_number, total_charge, currency, created_at')
        .eq('patient_id', user.id)
        .gte('created_at', twentyFourHoursAgo.toISOString())
        .order('created_at', { ascending: false });

      if (!error && recentClaims) {
        setUnreadCount(recentClaims.length);
        if (recentClaims.length > 0) {
          setLatestClaim(recentClaims[0]);
        }
      }

      // Subscribe to real-time updates for new claims
      subscription = supabase
        .channel('insurance_claims_channel')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'insurance_claims',
            filter: `patient_id=eq.${user.id}`,
          },
          async (payload: any) => {
            console.log('New insurance claim received:', payload);
            
            const newClaim = payload.new;
            
            // Update unread count
            setUnreadCount(prev => prev + 1);
            setLatestClaim({
              id: newClaim.id,
              claim_number: newClaim.claim_number,
              total_charge: newClaim.total_charge,
              currency: newClaim.currency,
              created_at: newClaim.created_at
            });

            // Show toast notification
            const currencySymbol = newClaim.currency === 'INR' ? '₹' : 'AED';
            toast({
              title: '🏥 New Insurance Claim',
              description: `Claim #${newClaim.claim_number} - ${currencySymbol} ${newClaim.total_charge.toFixed(2)}`,
              duration: 5000,
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
    latestClaim,
    markAsRead,
  };
};





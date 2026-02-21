import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import {
  getActiveRecommendations,
  getAllRecommendations,
  getRecommendationsByType,
  markRecommendationAsViewed,
  markRecommendationAsCompleted,
  dismissRecommendation,
  updateRecommendationFeedback,
  getPatientGoals,
  getActiveGoals,
  getMedicationAdherence,
  HealthRecommendation,
  PatientGoal,
  MedicationAdherence,
  RecommendationType
} from '@/services/recommendationsService';

export const useRecommendations = (patientId?: string) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const effectivePatientId = patientId || user?.id;

  // Query: Get active recommendations
  const {
    data: activeRecommendations = [],
    isLoading: isLoadingActive,
    error: activeError,
    refetch: refetchActive
  } = useQuery({
    queryKey: ['recommendations', 'active', effectivePatientId],
    queryFn: () => getActiveRecommendations(effectivePatientId!),
    enabled: !!effectivePatientId,
    staleTime: 60000, // 1 minute
  });

  // Query: Get all recommendations
  const {
    data: allRecommendations = [],
    isLoading: isLoadingAll,
    error: allError,
    refetch: refetchAll
  } = useQuery({
    queryKey: ['recommendations', 'all', effectivePatientId],
    queryFn: () => getAllRecommendations(effectivePatientId!),
    enabled: !!effectivePatientId,
    staleTime: 60000,
  });

  // Query: Get recommendations by type
  const getByType = (type: RecommendationType) => {
    return useQuery({
      queryKey: ['recommendations', 'type', type, effectivePatientId],
      queryFn: () => getRecommendationsByType(effectivePatientId!, type),
      enabled: !!effectivePatientId,
    });
  };

  // Mutation: Mark as viewed
  const markAsViewedMutation = useMutation({
    mutationFn: markRecommendationAsViewed,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recommendations'] });
    },
  });

  // Mutation: Mark as completed
  const markAsCompletedMutation = useMutation({
    mutationFn: ({ 
      recommendationId, 
      outcomeNotes 
    }: { 
      recommendationId: string; 
      outcomeNotes?: string 
    }) => markRecommendationAsCompleted(recommendationId, effectivePatientId!, outcomeNotes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recommendations'] });
    },
  });

  // Mutation: Dismiss recommendation
  const dismissMutation = useMutation({
    mutationFn: ({ 
      recommendationId, 
      reason 
    }: { 
      recommendationId: string; 
      reason?: string 
    }) => dismissRecommendation(recommendationId, effectivePatientId!, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recommendations'] });
    },
  });

  // Mutation: Update feedback
  const updateFeedbackMutation = useMutation({
    mutationFn: ({ 
      recommendationId, 
      feedback, 
      effectivenessScore 
    }: { 
      recommendationId: string; 
      feedback: 'helpful' | 'not_helpful' | 'neutral';
      effectivenessScore?: number;
    }) => updateRecommendationFeedback(recommendationId, feedback, effectivenessScore),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recommendations'] });
    },
  });

  // Statistics
  const stats = {
    total: allRecommendations.length,
    active: activeRecommendations.length,
    byType: allRecommendations.reduce((acc, rec) => {
      acc[rec.recommendation_type] = (acc[rec.recommendation_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    byPriority: activeRecommendations.reduce((acc, rec) => {
      acc[rec.priority] = (acc[rec.priority] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    completed: allRecommendations.filter(r => r.status === 'completed').length,
    dismissed: allRecommendations.filter(r => r.status === 'dismissed').length,
  };

  return {
    // Data
    activeRecommendations,
    allRecommendations,
    stats,
    
    // Loading states
    isLoading: isLoadingActive || isLoadingAll,
    isLoadingActive,
    isLoadingAll,
    
    // Errors
    error: activeError || allError,
    
    // Actions
    markAsViewed: markAsViewedMutation.mutate,
    markAsCompleted: markAsCompletedMutation.mutate,
    dismiss: dismissMutation.mutate,
    updateFeedback: updateFeedbackMutation.mutate,
    
    // Refetch
    refetch: () => {
      refetchActive();
      refetchAll();
    },
    
    // Query helpers
    getByType,
  };
};

export const usePatientGoals = (patientId?: string) => {
  const { user } = useAuth();
  const effectivePatientId = patientId || user?.id;

  const {
    data: goals = [],
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['patient-goals', effectivePatientId],
    queryFn: () => getPatientGoals(effectivePatientId!),
    enabled: !!effectivePatientId,
  });

  const {
    data: activeGoals = [],
    isLoading: isLoadingActive,
  } = useQuery({
    queryKey: ['patient-goals', 'active', effectivePatientId],
    queryFn: () => getActiveGoals(effectivePatientId!),
    enabled: !!effectivePatientId,
  });

  const stats = {
    total: goals.length,
    active: activeGoals.length,
    achieved: goals.filter(g => g.status === 'achieved').length,
    averageProgress: goals.length > 0 
      ? Math.round(goals.reduce((acc, g) => acc + g.progress_percentage, 0) / goals.length)
      : 0,
  };

  return {
    goals,
    activeGoals,
    stats,
    isLoading: isLoading || isLoadingActive,
    error,
    refetch,
  };
};

export const useMedicationAdherence = (patientId?: string, days: number = 30) => {
  const { user } = useAuth();
  const effectivePatientId = patientId || user?.id;

  const {
    data: adherence,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['medication-adherence', effectivePatientId, days],
    queryFn: () => getMedicationAdherence(effectivePatientId!, days),
    enabled: !!effectivePatientId,
    staleTime: 300000, // 5 minutes
  });

  return {
    adherence,
    isLoading,
    error,
    refetch,
  };
};

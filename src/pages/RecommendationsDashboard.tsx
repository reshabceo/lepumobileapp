import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Target,
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp,
  Heart,
  Apple,
  Dumbbell,
  Pill,
  Stethoscope,
  AlertCircle,
  ThumbsUp,
  ThumbsDown,
  Minus,
  ArrowLeft,
  Filter,
  Calendar,
  Award,
  Activity,
  Loader2,
} from 'lucide-react';
import { useRecommendations, usePatientGoals, useMedicationAdherence } from '@/hooks/useRecommendations';
import { useToast } from '@/hooks/use-toast';
import { HealthRecommendation, RecommendationType, RecommendationPriority } from '@/services/recommendationsService';

// Type icons mapping
const typeIcons: Record<RecommendationType, any> = {
  medication: Pill,
  lifestyle: Activity,
  diet: Apple,
  exercise: Dumbbell,
  followup: Calendar,
  diagnostic: Stethoscope,
  treatment: Heart,
  preventive: AlertCircle,
  monitoring: Activity,
  behavioral: TrendingUp,
  threshold: Target,
};

// Priority colors
const priorityColors: Record<RecommendationPriority, { bg: string; border: string; text: string }> = {
  urgent: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400' },
  high: { bg: 'bg-orange-500/10', border: 'border-orange-500/30', text: 'text-orange-400' },
  medium: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400' },
  low: { bg: 'bg-gray-500/10', border: 'border-gray-500/30', text: 'text-gray-400' },
};

// Status colors
const statusColors: Record<string, { bg: string; text: string; label: string }> = {
  active: { bg: 'bg-blue-500/10', text: 'text-blue-400', label: 'Active' },
  in_progress: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', label: 'In Progress' },
  completed: { bg: 'bg-green-500/10', text: 'text-green-400', label: 'Completed' },
  dismissed: { bg: 'bg-gray-500/10', text: 'text-gray-400', label: 'Dismissed' },
  expired: { bg: 'bg-red-500/10', text: 'text-red-400', label: 'Expired' },
};

export const RecommendationsDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [filterType, setFilterType] = useState<'all' | RecommendationType>('all');
  const [filterPriority, setFilterPriority] = useState<'all' | RecommendationPriority>('all');
  const [showCompleted, setShowCompleted] = useState(false);
  const [selectedRec, setSelectedRec] = useState<HealthRecommendation | null>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'all'>('active');

  const {
    activeRecommendations,
    allRecommendations,
    isLoadingActive,
    isLoadingAll,
    stats,
    error: recommendationsError,
    markAsViewed,
    markAsCompleted,
    dismiss,
    updateFeedback,
    refetch,
  } = useRecommendations();

  const { goals, activeGoals, stats: goalStats, isLoading: isLoadingGoals } = usePatientGoals();
  const { adherence } = useMedicationAdherence();

  const [forceStopLoading, setForceStopLoading] = useState(false);
  const [timeoutError, setTimeoutError] = useState<string | null>(null);

  const isLoading = (isLoadingActive || (activeTab === 'all' && isLoadingAll) || isLoadingGoals) && !forceStopLoading;
  const error = recommendationsError || timeoutError;

  // Safety timeout for loading state
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isLoadingActive || isLoadingAll || isLoadingGoals) {
      setForceStopLoading(false);
      setTimeoutError(null);
      timer = setTimeout(() => {
        console.warn('⚠️ Recommendations loading timed out');
        setForceStopLoading(true);
        setTimeoutError('Loading is taking longer than usual. Please try refreshing.');
      }, 10000); // 10 second safety limit
    } else {
      setForceStopLoading(false);
    }
    return () => clearTimeout(timer);
  }, [isLoadingActive, isLoadingAll, isLoadingGoals]);

  const handleRefresh = () => {
    setForceStopLoading(false);
    setTimeoutError(null);
    refetch();
  };

  // Filter recommendations
  const filteredRecommendations = (showCompleted ? allRecommendations : activeRecommendations).filter(rec => {
    if (filterType !== 'all' && rec.recommendation_type !== filterType) return false;
    if (filterPriority !== 'all' && rec.priority !== filterPriority) return false;
    return true;
  });

  // Mark as viewed when opened
  useEffect(() => {
    if (selectedRec && !selectedRec.viewed_at) {
      markAsViewed(selectedRec.id);
    }
  }, [selectedRec]);

  const handleComplete = (rec: HealthRecommendation) => {
    markAsCompleted(
      { recommendationId: rec.id },
      {
        onSuccess: () => {
          toast({
            title: '✅ Completed!',
            description: 'Great job completing this recommendation!',
          });
          setSelectedRec(null);
          refetch();
        },
        onError: (error) => {
          toast({
            title: 'Error',
            description: 'Failed to mark as completed',
            variant: 'destructive',
          });
        },
      }
    );
  };

  const handleDismiss = (rec: HealthRecommendation, reason?: string) => {
    dismiss(
      { recommendationId: rec.id, reason },
      {
        onSuccess: () => {
          toast({
            title: 'Dismissed',
            description: 'Recommendation dismissed',
          });
          setSelectedRec(null);
          refetch();
        },
        onError: (error) => {
          toast({
            title: 'Error',
            description: 'Failed to dismiss recommendation',
            variant: 'destructive',
          });
        },
      }
    );
  };

  const handleFeedback = (rec: HealthRecommendation, feedback: 'helpful' | 'not_helpful' | 'neutral') => {
    updateFeedback(
      { recommendationId: rec.id, feedback },
      {
        onSuccess: () => {
          toast({
            title: 'Thank you!',
            description: 'Your feedback helps us improve recommendations',
          });
          refetch();
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="bg-[#101010] min-h-screen text-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 p-6 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          <p className="text-gray-400">Loading your recommendations...</p>
          
          {forceStopLoading && (
            <div className="mt-4 flex flex-col items-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <p className="text-amber-400 text-sm max-w-xs">
                This is taking longer than expected. 
              </p>
              <button 
                onClick={handleRefresh}
                className="bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2 rounded-lg flex items-center gap-2 transition-all"
              >
                <RefreshCw className="h-4 w-4" />
                Retry Connection
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[#101010] min-h-screen text-white flex items-center justify-center p-4">
        <div className="max-w-sm mx-auto text-center">
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-8">
            <div className="bg-red-500/20 p-4 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="h-10 w-10 text-red-500" />
            </div>
            <h2 className="text-xl font-bold text-red-400 mb-2">Request Timeout</h2>
            <p className="text-gray-400 mb-6 leading-relaxed">
              The application is taking longer than usual to load. This might be due to a poor connection or session sync issue.
            </p>
            <button
              onClick={handleRefresh}
              className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-red-500/20 flex items-center justify-center gap-2"
            >
              <RefreshCw className="h-5 w-5" />
              Reload App Properly
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Detail view
  if (selectedRec) {
    const Icon = typeIcons[selectedRec.recommendation_type] || Target;
    const priorityStyle = priorityColors[selectedRec.priority] || priorityColors.medium;

    return (
      <div className="bg-[#101010] min-h-screen text-white p-4 pt-safe-top">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={() => setSelectedRec(null)}
              className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-bold">Recommendation Details</h1>
          </div>

          {/* Content */}
          <div className="bg-[#1E1E1E] rounded-2xl p-6 border border-gray-800">
            {/* Header */}
            <div className="flex items-start gap-4 mb-6">
              <div className={`p-3 rounded-xl ${priorityStyle.bg}`}>
                <Icon className={`w-6 h-6 ${priorityStyle.text}`} />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold mb-2">{selectedRec.title}</h2>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs px-2 py-1 rounded-full ${priorityStyle.bg} ${priorityStyle.text}`}>
                    {selectedRec.priority.toUpperCase()}
                  </span>
                  <span className="text-xs px-2 py-1 rounded-full bg-gray-700 text-gray-300">
                    {selectedRec.recommendation_type}
                  </span>
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-400 mb-2">Description</h3>
              <p className="text-gray-300 leading-relaxed">{selectedRec.description}</p>
            </div>

            {/* Action Items */}
            {selectedRec.action_items && selectedRec.action_items.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-400 mb-3">Action Items</h3>
                <div className="space-y-2">
                  {selectedRec.action_items.map((item: any, idx: number) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 p-3 bg-gray-800/50 rounded-lg"
                    >
                      {item.completed ? (
                        <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                      ) : (
                        <div className="w-5 h-5 border-2 border-gray-600 rounded flex-shrink-0 mt-0.5" />
                      )}
                      <span className={item.completed ? 'text-gray-500 line-through' : 'text-gray-300'}>
                        {item.action}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Metadata */}
            <div className="mb-6 space-y-2 text-sm">
              {selectedRec.valid_from && (
                <div className="flex items-center gap-2 text-gray-400">
                  <Calendar className="w-4 h-4" />
                  <span>Valid from: {new Date(selectedRec.valid_from).toLocaleDateString()}</span>
                </div>
              )}
              {selectedRec.valid_until && (
                <div className="flex items-center gap-2 text-gray-400">
                  <Clock className="w-4 h-4" />
                  <span>Valid until: {new Date(selectedRec.valid_until).toLocaleDateString()}</span>
                </div>
              )}
              {selectedRec.ai_confidence && (
                <div className="flex items-center gap-2 text-gray-400">
                  <Activity className="w-4 h-4" />
                  <span>AI Confidence: {Math.round(selectedRec.ai_confidence * 100)}%</span>
                </div>
              )}
            </div>

            {/* Actions */}
            {selectedRec.status === 'active' && (
              <div className="space-y-3">
                <button
                  onClick={() => handleComplete(selectedRec)}
                  className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  Mark as Completed
                </button>
                <button
                  onClick={() => handleDismiss(selectedRec)}
                  className="w-full bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  <XCircle className="w-5 h-5" />
                  Dismiss
                </button>
              </div>
            )}

            {/* Feedback */}
            {!selectedRec.patient_feedback && selectedRec.status === 'active' && (
              <div className="mt-6 pt-6 border-t border-gray-700">
                <h3 className="text-sm font-semibold text-gray-400 mb-3">Was this helpful?</h3>
                <div className="flex gap-3">
                  <button
                    onClick={() => handleFeedback(selectedRec, 'helpful')}
                    className="flex-1 bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 text-green-400 py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <ThumbsUp className="w-4 h-4" />
                    Helpful
                  </button>
                  <button
                    onClick={() => handleFeedback(selectedRec, 'neutral')}
                    className="flex-1 bg-gray-500/10 hover:bg-gray-500/20 border border-gray-500/30 text-gray-400 py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <Minus className="w-4 h-4" />
                    Neutral
                  </button>
                  <button
                    onClick={() => handleFeedback(selectedRec, 'not_helpful')}
                    className="flex-1 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <ThumbsDown className="w-4 h-4" />
                    Not Helpful
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="bg-[#101010] min-h-screen text-white p-4 pt-safe-top">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold">Health Recommendations</h1>
              <p className="text-sm text-gray-400">Personalized health guidance</p>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-[#1E1E1E] rounded-xl p-4 border border-blue-500/20">
            <div className="text-2xl font-bold text-blue-400">{stats.active}</div>
            <div className="text-xs text-gray-400">Active</div>
          </div>
          <div className="bg-[#1E1E1E] rounded-xl p-4 border border-green-500/20">
            <div className="text-2xl font-bold text-green-400">{stats.completed}</div>
            <div className="text-xs text-gray-400">Completed</div>
          </div>
          <div className="bg-[#1E1E1E] rounded-xl p-4 border border-orange-500/20">
            <div className="text-2xl font-bold text-orange-400">
              {adherence ? Math.round(adherence.adherence_percentage) : 0}%
            </div>
            <div className="text-xs text-gray-400">Med Adherence</div>
          </div>
        </div>

        {/* Goals Summary */}
        {activeGoals.length > 0 && (
          <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-xl p-4 border border-purple-500/20 mb-6">
            <div className="flex items-center gap-3 mb-3">
              <Award className="w-5 h-5 text-purple-400" />
              <h3 className="font-semibold text-purple-400">Active Goals</h3>
            </div>
            <div className="space-y-2">
              {activeGoals.slice(0, 3).map((goal) => (
                <div key={goal.id} className="flex items-center justify-between">
                  <span className="text-sm text-gray-300">{goal.goal_name}</span>
                  <span className="text-sm font-semibold text-purple-400">
                    {goal.progress_percentage}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-3 mb-6 overflow-x-auto pb-2">
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              showCompleted
                ? 'bg-blue-500 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            {showCompleted ? 'Show Active' : 'Show All'}
          </button>
          <button
            onClick={() => setFilterPriority(filterPriority === 'urgent' ? 'all' : 'urgent')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              filterPriority === 'urgent'
                ? 'bg-red-500 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            Urgent Only
          </button>
        </div>

        {/* Recommendations List */}
        {filteredRecommendations.length === 0 ? (
          <div className="bg-[#1E1E1E] rounded-xl p-8 border border-gray-800 text-center">
            <Target className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-400 mb-2">No Recommendations</h3>
            <p className="text-sm text-gray-500">
              {showCompleted
                ? 'No recommendations to show'
                : 'Great! You have no active recommendations at this time.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredRecommendations.map((rec) => {
              const Icon = typeIcons[rec.recommendation_type] || Target;
              const priorityStyle = priorityColors[rec.priority] || priorityColors.medium;
              const statusStyle = statusColors[rec.status] || statusColors.active;

              return (
                <div
                  key={rec.id}
                  onClick={() => setSelectedRec(rec)}
                  className={`bg-[#1E1E1E] rounded-xl p-4 border ${priorityStyle.border} hover:bg-[#252525] transition-all cursor-pointer`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${priorityStyle.bg} flex-shrink-0`}>
                      <Icon className={`w-5 h-5 ${priorityStyle.text}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-white mb-1 truncate">{rec.title}</h3>
                      <p className="text-sm text-gray-400 line-clamp-2 mb-2">{rec.description}</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-xs px-2 py-1 rounded-full ${priorityStyle.bg} ${priorityStyle.text}`}
                        >
                          {rec.priority}
                        </span>
                        <span
                          className={`text-xs px-2 py-1 rounded-full ${statusStyle.bg} ${statusStyle.text}`}
                        >
                          {statusStyle.label}
                        </span>
                        {!rec.viewed_at && (
                          <span className="text-xs px-2 py-1 rounded-full bg-blue-500/20 text-blue-400">
                            New
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default RecommendationsDashboard;

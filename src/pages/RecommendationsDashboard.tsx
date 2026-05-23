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
  RefreshCw,
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
  urgent: { bg: 'bg-red-950/70', border: 'border-red-500/30', text: 'text-red-400' },
  high: { bg: 'bg-orange-950/70', border: 'border-orange-500/30', text: 'text-orange-400' },
  medium: { bg: 'bg-blue-950/70', border: 'border-blue-500/30', text: 'text-blue-400' },
  low: { bg: 'bg-slate-900/70', border: 'border-slate-700/30', text: 'text-slate-400' },
};

// Status colors
const statusColors: Record<string, { bg: string; text: string; label: string }> = {
  active: { bg: 'bg-emerald-950/70', text: 'text-emerald-400', label: 'Active' },
  in_progress: { bg: 'bg-yellow-950/70', text: 'text-yellow-400', label: 'In Progress' },
  completed: { bg: 'bg-green-950/70', text: 'text-green-400', label: 'Completed' },
  dismissed: { bg: 'bg-slate-900/70', text: 'text-slate-400', label: 'Dismissed' },
  expired: { bg: 'bg-red-950/70', text: 'text-red-400', label: 'Expired' },
};

// Strip markdown formatting from AI-generated text
const stripMarkdown = (text: string): string => {
  if (!text) return text;
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')   // **bold**
    .replace(/\*([^*]+)\*/g, '$1')         // *italic*
    .replace(/^#{1,6}\s+/gm, '')           // ## headings
    .replace(/`([^`]+)`/g, '$1')           // `code`
    .replace(/^\s*[-*+]\s+/gm, '')         // bullet points
    .replace(/^\s*\d+\.\s+/gm, '')         // numbered lists
    .replace(/__([^_]+)__/g, '$1')          // __bold__
    .replace(/_([^_]+)_/g, '$1')            // _italic_
    .trim();
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
      <div className="bg-[#080D1A] min-h-screen text-white flex items-center justify-center font-inter select-none">
        <div className="flex flex-col items-center gap-4 p-6 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
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
      <div className="bg-[#080D1A] min-h-screen text-white flex items-center justify-center p-4 font-inter select-none">
        <div className="max-w-sm mx-auto text-center">
          <div className="bg-red-950/40 border border-red-500/20 rounded-3xl p-8">
            <div className="bg-red-500/20 p-4 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="h-10 w-10 text-red-500" />
            </div>
            <h2 className="text-xl font-bold text-red-400 mb-2">Request Timeout</h2>
            <p className="text-gray-400 mb-6 leading-relaxed">
              The application is taking longer than usual to load. This might be due to a poor connection or session sync issue.
            </p>
            <button
              onClick={handleRefresh}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-red-500/20 flex items-center justify-center gap-2"
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
      <div className="min-h-screen bg-[#080D1A] text-white font-inter select-none p-4 pt-safe-top">
        <div className="max-w-2xl mx-auto pb-20">
          {/* Standardized Header */}
          <header className="flex items-center gap-3 mb-6">
            <button
              onClick={() => setSelectedRec(null)}
              className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors active:scale-95 text-white"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-emerald-900/70 flex items-center justify-center border border-emerald-400/50">
                <Target className="h-6 w-6 text-emerald-300" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Recommendation Details</h1>
                <p className="text-xs text-gray-400">View details for this personalized recommendation</p>
              </div>
            </div>
          </header>

          {/* Content */}
          <div className="bg-[#1A243D] border border-slate-700/40 shadow-sm rounded-3xl p-6">
            {/* Header info */}
            <div className="flex items-start gap-4 mb-6">
              <div className={`p-3 rounded-2xl ${priorityStyle.bg} border ${priorityStyle.border}`}>
                <Icon className={`w-6 h-6 ${priorityStyle.text}`} />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold mb-2">{stripMarkdown(selectedRec.title)}</h2>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${priorityStyle.bg} ${priorityStyle.text} border ${priorityStyle.border}`}>
                    {selectedRec.priority.toUpperCase()}
                  </span>
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-800 text-gray-300 border border-slate-700">
                    {selectedRec.recommendation_type}
                  </span>
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="mb-6">
              <h3 className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">Description</h3>
              <p className="text-gray-300 leading-relaxed bg-[#121B32]/60 p-4 rounded-2xl border border-slate-700/20">{selectedRec.description}</p>
            </div>

            {/* Action Items */}
            {selectedRec.action_items && selectedRec.action_items.length > 0 && (
              <div className="mb-6">
                <h3 className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wider">Action Items</h3>
                <div className="space-y-2">
                  {selectedRec.action_items.map((item: any, idx: number) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 p-3 bg-[#121B32] border border-slate-700/40 rounded-xl"
                    >
                      {item.completed ? (
                        <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                      ) : (
                        <div className="w-5 h-5 border-2 border-slate-600 rounded flex-shrink-0 mt-0.5" />
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
            <div className="mb-6 space-y-2 text-sm bg-[#121B32]/40 p-4 rounded-2xl border border-slate-700/20">
              {selectedRec.valid_from && (
                <div className="flex items-center gap-2 text-gray-400">
                  <Calendar className="w-4 h-4 text-emerald-400" />
                  <span>Valid from: {new Date(selectedRec.valid_from).toLocaleDateString()}</span>
                </div>
              )}
              {selectedRec.valid_until && (
                <div className="flex items-center gap-2 text-gray-400">
                  <Clock className="w-4 h-4 text-emerald-400" />
                  <span>Valid until: {new Date(selectedRec.valid_until).toLocaleDateString()}</span>
                </div>
              )}
              {selectedRec.ai_confidence && (
                <div className="flex items-center gap-2 text-gray-400">
                  <Activity className="w-4 h-4 text-emerald-400" />
                  <span>AI Confidence: {Math.round(selectedRec.ai_confidence * 100)}%</span>
                </div>
              )}
            </div>

            {/* Actions */}
            {selectedRec.status === 'active' && (
              <div className="space-y-3">
                <button
                  onClick={() => handleComplete(selectedRec)}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white py-3 rounded-2xl font-semibold transition-all flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  Mark as Completed
                </button>
                <button
                  onClick={() => handleDismiss(selectedRec)}
                  className="w-full bg-slate-800 hover:bg-slate-700 active:scale-95 text-white py-3 rounded-2xl font-semibold transition-all flex items-center justify-center gap-2 border border-slate-700/50"
                >
                  <XCircle className="w-5 h-5" />
                  Dismiss
                </button>
              </div>
            )}

            {/* Feedback */}
            {!selectedRec.patient_feedback && selectedRec.status === 'active' && (
              <div className="mt-6 pt-6 border-t border-slate-800">
                <h3 className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wider">Was this helpful?</h3>
                <div className="flex gap-3">
                  <button
                    onClick={() => handleFeedback(selectedRec, 'helpful')}
                    className="flex-1 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 py-2.5 rounded-xl transition-all flex items-center justify-center gap-2"
                  >
                    <ThumbsUp className="w-4 h-4" />
                    Helpful
                  </button>
                  <button
                    onClick={() => handleFeedback(selectedRec, 'neutral')}
                    className="flex-1 bg-slate-800/40 hover:bg-slate-800/60 border border-slate-700/30 text-slate-300 py-2.5 rounded-xl transition-all flex items-center justify-center gap-2"
                  >
                    <Minus className="w-4 h-4" />
                    Neutral
                  </button>
                  <button
                    onClick={() => handleFeedback(selectedRec, 'not_helpful')}
                    className="flex-1 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 py-2.5 rounded-xl transition-all flex items-center justify-center gap-2"
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
    <div className="min-h-screen bg-[#080D1A] text-white font-inter select-none p-4 pt-safe-top">
      <div className="max-w-2xl mx-auto pb-20">
        {/* Standardized Header */}
        <header className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors active:scale-95 text-white"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-emerald-900/70 flex items-center justify-center border border-emerald-400/50">
              <Target className="h-6 w-6 text-emerald-300" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Health Recommendations</h1>
              <p className="text-xs text-gray-400">Personalized health guidance</p>
            </div>
          </div>
        </header>

        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-[#1A243D] border border-slate-700/40 shadow-sm rounded-3xl p-4 flex flex-col items-center justify-center text-center">
            <div className="text-2xl font-bold text-emerald-400">{stats.active}</div>
            <div className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Active</div>
          </div>
          <div className="bg-[#1A243D] border border-slate-700/40 shadow-sm rounded-3xl p-4 flex flex-col items-center justify-center text-center">
            <div className="text-2xl font-bold text-green-400">{stats.completed}</div>
            <div className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Completed</div>
          </div>
          <div className="bg-[#1A243D] border border-slate-700/40 shadow-sm rounded-3xl p-4 flex flex-col items-center justify-center text-center">
            <div className="text-2xl font-bold text-orange-400">
              {adherence ? Math.round(adherence.adherence_percentage) : 0}%
            </div>
            <div className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Med Adherence</div>
          </div>
        </div>

        {/* Goals Summary */}
        {activeGoals.length > 0 && (
          <div className="bg-gradient-to-r from-purple-900/40 to-blue-900/40 rounded-3xl p-5 border border-purple-500/30 mb-6">
            <div className="flex items-center gap-3 mb-3">
              <Award className="w-5 h-5 text-purple-400 animate-pulse" />
              <h3 className="font-bold text-purple-400">Active Goals</h3>
            </div>
            <div className="space-y-2">
              {activeGoals.slice(0, 3).map((goal) => (
                <div key={goal.id} className="flex items-center justify-between">
                  <span className="text-sm text-gray-300">{goal.goal_name}</span>
                  <span className="text-sm font-bold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20">
                    {goal.progress_percentage}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1 scrollbar-hide">
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className={`px-4 py-2 rounded-full text-xs font-semibold transition-all whitespace-nowrap border ${showCompleted
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : 'bg-[#1A243D] text-gray-400 border-slate-700/40 hover:text-gray-200'
              }`}
          >
            {showCompleted ? 'Show Active Only' : 'Show All Recommendations'}
          </button>
          <button
            onClick={() => setFilterPriority(filterPriority === 'urgent' ? 'all' : 'urgent')}
            className={`px-4 py-2 rounded-full text-xs font-semibold transition-all whitespace-nowrap border ${filterPriority === 'urgent'
                ? 'bg-red-500/20 text-red-300 border-red-500/40'
                : 'bg-[#1A243D] text-gray-400 border-slate-700/40 hover:text-gray-200'
              }`}
          >
            Urgent Only
          </button>
        </div>

        {/* Recommendations List */}
        {filteredRecommendations.length === 0 ? (
          <div className="bg-[#1A243D] border border-slate-700/40 shadow-sm rounded-3xl p-8 text-center">
            <Target className="w-12 h-12 text-gray-500 mx-auto mb-4" />
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
                  className={`bg-[#1A243D] rounded-3xl p-5 border ${priorityStyle.border} hover:bg-[#223052] transition-all cursor-pointer shadow-sm`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-2xl ${priorityStyle.bg} border ${priorityStyle.border} flex-shrink-0`}>
                      <Icon className={`w-5 h-5 ${priorityStyle.text}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-white mb-1 truncate text-base">{rec.title}</h3>
                      <p className="text-sm text-gray-400 line-clamp-2 mb-3">{rec.description}</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${priorityStyle.bg} ${priorityStyle.text} border ${priorityStyle.border}`}
                        >
                          {rec.priority.toUpperCase()}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusStyle.bg} ${statusStyle.text} border border-slate-700`}
                        >
                          {statusStyle.label}
                        </span>
                        {!rec.viewed_at && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                            NEW
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

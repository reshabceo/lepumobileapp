import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Activity,
  BarChart3,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Clock,
  RefreshCw,
  Loader2,
  Link2,
  Unlink,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface GlucoseReadingRow {
  id: number;
  user_id: string;
  glucose: number;
  trend: string | null;
  reading_timestamp: string;
  created_at: string;
}

interface JunctionProfile {
  junction_connected: boolean;
  junction_user_id: string | null;
}

const AbbottCGMMonitor: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [profile, setProfile] = useState<JunctionProfile | null>(null);
  const [latestReading, setLatestReading] = useState<GlucoseReadingRow | null>(null);
  const [history, setHistory] = useState<GlucoseReadingRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [libreviewEmail, setLibreviewEmail] = useState('');
  // Region is chosen server-side from JUNCTION_LIBRE_REGION (in for EU / India LibreView).
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const loadProfile = useCallback(async () => {
    if (!user?.id) return;

    const { data, error } = await supabase
      .from('profiles')
      .select('junction_connected, junction_user_id')
      .eq('id', user.id)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('Failed to load Junction profile:', error);
      return;
    }

    setProfile(data ?? { junction_connected: false, junction_user_id: null });
  }, [user?.id]);

  const loadReadings = useCallback(async () => {
    if (!user?.id) return;

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('glucose_readings')
      .select('*')
      .eq('user_id', user.id)
      .gte('reading_timestamp', since)
      .order('reading_timestamp', { ascending: true });

    if (error) {
      console.error('Failed to load glucose readings:', error);
      return;
    }

    const rows = (data ?? []) as GlucoseReadingRow[];
    setHistory(rows);
    setLatestReading(rows.length > 0 ? rows[rows.length - 1] : null);
  }, [user?.id]);

  const refreshAll = useCallback(async () => {
    setIsLoading(true);
    try {
      await Promise.all([loadProfile(), loadReadings()]);
    } finally {
      setIsLoading(false);
    }
  }, [loadProfile, loadReadings]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`glucose-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'glucose_readings',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as GlucoseReadingRow;
          setLatestReading(row);
          setHistory((prev) => {
            const next = [...prev, row];
            const cutoff = Date.now() - 24 * 60 * 60 * 1000;
            return next.filter((r) => new Date(r.reading_timestamp).getTime() >= cutoff);
          });
        },
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user?.id]);

  const handleConnect = async () => {
    if (!user?.id) return;

    const email = libreviewEmail.trim().toLowerCase();
    if (!email) {
      toast({
        title: 'LibreView email required',
        description: 'Enter the exact email from your FreeStyle Libre / LibreView account.',
        variant: 'destructive',
      });
      return;
    }

    setIsConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-junction-link', {
        body: { libreview_email: email },
      });

      if (error) {
        let detail = error.message;
        const context = (error as { context?: Response }).context;
        if (context && typeof context.json === 'function') {
          try {
            const payload = await context.json();
            if (typeof payload?.error === 'string') detail = payload.error;
          } catch {
            // Use default error.message
          }
        }
        throw new Error(detail);
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Unable to connect Abbott CGM.');
      }

      if (data?.connected) {
        toast({
          title: 'Abbott CGM Connected',
          description: 'Your LibreView account is linked. Readings should appear shortly.',
        });
        await loadProfile();
        await loadReadings();
        return;
      }

      throw new Error(data?.error || 'Connection did not complete.');
    } catch (error) {
      console.error('Connect Abbott CGM failed:', error);
      const message = error instanceof Error ? error.message : 'Unable to connect Abbott CGM.';
      const isEmailMismatch =
        message.includes('cannot be matched') ||
        message.includes('INVALID_CREDENTIALS') ||
        message.includes('INVALID_EMAIL') ||
        message.includes('tryVital practice');
      toast({
        title: 'Connection Failed',
        description: isEmailMismatch
          ? 'Junction could not find your LibreView email in tryVital-sandbox. Confirm the practice is linked in the Libre app and glucose data exists on libreview.com.'
          : message.includes('JUNCTION_API_KEY')
            ? 'Server not configured — set JUNCTION_API_KEY in Supabase secrets and redeploy create-junction-link.'
            : message,
        variant: 'destructive',
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const getGlucoseStatus = (value: number) => {
    if (value < 70) return { status: 'Low', color: 'text-red-500', bgColor: 'bg-red-500/10', borderColor: 'border-red-500/20' };
    if (value > 180) return { status: 'High', color: 'text-orange-500', bgColor: 'bg-orange-500/10', borderColor: 'border-orange-500/20' };
    if (value >= 70 && value <= 140) return { status: 'Normal', color: 'text-green-500', bgColor: 'bg-green-500/10', borderColor: 'border-green-500/20' };
    return { status: 'Elevated', color: 'text-yellow-500', bgColor: 'bg-yellow-500/10', borderColor: 'border-yellow-500/20' };
  };

  const getTrendIcon = (trend: string | null) => {
    switch (trend) {
      case 'Rising':
      case 'Rising Rapidly':
        return <TrendingUp className="h-4 w-4 text-red-500" />;
      case 'Falling':
      case 'Falling Rapidly':
        return <TrendingDown className="h-4 w-4 text-green-500" />;
      case 'Stable':
        return <Activity className="h-4 w-4 text-blue-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  const chartBars = useMemo(() => {
    if (history.length === 0) return [];
    const max = Math.max(...history.map((r) => r.glucose), 180);
    const min = Math.min(...history.map((r) => r.glucose), 70);
    const range = Math.max(max - min, 1);
    return history.slice(-24).map((reading) => ({
      id: reading.id,
      height: `${Math.max(12, ((reading.glucose - min) / range) * 100)}%`,
      glucose: reading.glucose,
      time: new Date(reading.reading_timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }));
  }, [history]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        loadProfile();
        loadReadings();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [loadProfile, loadReadings]);

  const isConnected = profile?.junction_connected === true;
  const averageGlucose = history.length
    ? Math.round(history.reduce((sum, r) => sum + r.glucose, 0) / history.length)
    : 0;

  return (
    <div className="min-h-screen bg-[#080D1A] text-white font-inter select-none">
      <div className="p-4 pt-safe-top">
        <header className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors active:scale-95 text-white"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-amber-900/70 flex items-center justify-center border border-amber-400/50">
              <BarChart3 className="h-6 w-6 text-amber-300" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Abbott CGM</h1>
              <p className="text-xs text-gray-400">FreeStyle Libre via LibreView</p>
            </div>
          </div>
          <button
            onClick={refreshAll}
            disabled={isLoading}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors disabled:opacity-50 text-white ml-auto"
          >
            {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <RefreshCw className="h-5 w-5" />}
          </button>
        </header>
      </div>

      <div className="p-4 space-y-4 max-w-md mx-auto">
        <div className="bg-[#1A243D] border border-slate-700/40 shadow-sm rounded-3xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-white">Connection Status</h3>
            <div className={`flex items-center gap-2 text-sm font-semibold ${isConnected ? 'text-green-400' : 'text-amber-400'}`}>
              <div className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-amber-500'}`} />
              {isConnected ? 'Connected Abbott CGM' : 'Not Connected'}
            </div>
          </div>

          <p className="text-sm text-gray-400 mb-4">
            {isConnected
              ? 'Your Abbott FreeStyle Libre sensor syncs through LibreView and Junction (India / EU).'
              : 'Step 1: In Libre app → Connected Apps → LibreView → add practice tryVital-sandbox. Step 2: Enter your LibreView email below (must match the Libre app account).'}
          </p>

          {!isConnected && (
            <div className="space-y-3 mb-4">
              <div>
                <Label htmlFor="libreview-email" className="text-gray-300 text-xs mb-1.5 block">
                  LibreView email
                </Label>
                <Input
                  id="libreview-email"
                  type="email"
                  value={libreviewEmail}
                  onChange={(e) => setLibreviewEmail(e.target.value)}
                  placeholder="Your LibreView / Libre app email (not Monitraq)"
                  className="bg-[#121B32] border-slate-600 text-white"
                  autoComplete="email"
                />
                <p className="text-[11px] text-amber-400/90 mt-1">
                  Must match the email on libreview.com — not your Monitraq login.
                </p>
              </div>
              <div className="rounded-xl bg-[#121B32] border border-slate-600 px-3 py-2.5">
                <p className="text-[11px] text-gray-400">LibreView region (server)</p>
                <p className="text-sm font-semibold text-white">India — EU Junction sandbox</p>
                <p className="text-[11px] text-gray-500 mt-1">
                  Region is set on the server (in). Your Libre app can show India — that matches.
                </p>
              </div>
            </div>
          )}

          <Button
            onClick={handleConnect}
            disabled={isConnecting}
            className={`w-full font-bold py-3.5 rounded-xl ${isConnected ? 'bg-slate-700 hover:bg-slate-600' : 'bg-amber-600 hover:bg-amber-700'}`}
          >
            {isConnecting ? (
              <Loader2 className="h-5 w-5 animate-spin mx-auto" />
            ) : (
              <>
                {isConnected ? <Link2 className="h-4 w-4 mr-2" /> : <Unlink className="h-4 w-4 mr-2" />}
                {isConnected ? 'Reconnect Abbott CGM' : 'Connect Abbott CGM'}
              </>
            )}
          </Button>
        </div>

        {latestReading ? (
          <div className="bg-[#1A243D] border border-slate-700/40 shadow-sm rounded-3xl p-6 text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-2xl bg-amber-900/50 flex items-center justify-center border border-amber-500/30">
                <BarChart3 className="h-6 w-6 text-amber-400" />
              </div>
              <h2 className="text-lg font-bold text-white">Current Glucose</h2>
            </div>

            <div className="mb-4">
              <div className="text-6xl font-extrabold text-white mb-2 tracking-tight">
                {latestReading.glucose}
              </div>
              <div className="text-sm font-semibold text-gray-400 uppercase tracking-wider">mg/dL</div>
            </div>

            <div className="flex items-center justify-center gap-3 mb-4 bg-[#121B32] border border-slate-700/40 rounded-2xl p-3 max-w-[240px] mx-auto">
              {getTrendIcon(latestReading.trend)}
              <span className="text-sm font-medium text-gray-300">
                {latestReading.trend || 'Unknown'}
              </span>
            </div>

            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${getGlucoseStatus(latestReading.glucose).bgColor} ${getGlucoseStatus(latestReading.glucose).borderColor} border`}>
              {getGlucoseStatus(latestReading.glucose).status === 'Normal' ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-orange-500" />
              )}
              <span className={`font-semibold ${getGlucoseStatus(latestReading.glucose).color}`}>
                {getGlucoseStatus(latestReading.glucose).status}
              </span>
            </div>
          </div>
        ) : (
          <div className="bg-[#1A243D] border border-slate-700/40 shadow-sm rounded-3xl p-6 text-center">
            <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
            <h2 className="text-lg font-bold mb-2">No Readings Yet</h2>
            <p className="text-sm text-gray-400">
              {isConnected
                ? 'Waiting for glucose data from your Abbott sensor.'
                : 'Connect your Abbott CGM to start receiving readings.'}
            </p>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-[#1A243D] border border-slate-700/40 shadow-sm rounded-3xl p-4 text-center">
            <div className="text-2xl font-black text-amber-400">{averageGlucose || '—'}</div>
            <div className="text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-wider">24h Avg</div>
          </div>
          <div className="bg-[#1A243D] border border-slate-700/40 shadow-sm rounded-3xl p-4 text-center">
            <div className="text-2xl font-black text-amber-400">{history.length}</div>
            <div className="text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-wider">Readings</div>
          </div>
          <div className="bg-[#1A243D] border border-slate-700/40 shadow-sm rounded-3xl p-4 text-center">
            <div className="text-sm font-black text-amber-400 flex items-center justify-center gap-1">
              <Clock className="h-4 w-4" />
              {latestReading
                ? new Date(latestReading.reading_timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : '—'}
            </div>
            <div className="text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-wider">Last Update</div>
          </div>
        </div>

        <div className="bg-[#1A243D] border border-slate-700/40 shadow-sm rounded-3xl p-5">
          <h3 className="text-base font-bold mb-4 text-white">24h Glucose Graph</h3>
          {chartBars.length > 0 ? (
            <div className="flex items-end gap-1.5 h-36 px-1">
              {chartBars.map((bar) => (
                <div key={bar.id} className="flex-1 flex flex-col items-center justify-end h-full">
                  <div
                    className="w-full rounded-t-md bg-gradient-to-t from-amber-700 to-amber-400 min-h-[12px]"
                    style={{ height: bar.height }}
                    title={`${bar.glucose} mg/dL at ${bar.time}`}
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 text-center py-8">No 24-hour data available yet.</p>
          )}
        </div>

        <div className="bg-[#1A243D] border border-slate-700/40 shadow-sm rounded-3xl p-5">
          <h3 className="text-base font-bold mb-4 text-white">Recent Readings</h3>
          <div className="space-y-2.5">
            {history.slice(-8).reverse().map((reading) => (
              <div key={reading.id} className="flex items-center justify-between p-3 bg-[#121B32] border border-slate-700/40 rounded-2xl">
                <div className="flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full ${
                    getGlucoseStatus(reading.glucose).status === 'Normal' ? 'bg-green-500'
                      : getGlucoseStatus(reading.glucose).status === 'Low' ? 'bg-red-500'
                        : getGlucoseStatus(reading.glucose).status === 'High' ? 'bg-orange-500' : 'bg-yellow-500'
                  }`} />
                  <div>
                    <div className="text-sm font-semibold text-white">{reading.glucose} <span className="text-[10px] text-gray-400">mg/dL</span></div>
                    <div className="text-[11px] text-gray-500">
                      {new Date(reading.reading_timestamp).toLocaleString()}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getTrendIcon(reading.trend)}
                  <span className="text-xs text-gray-400">{reading.trend || '—'}</span>
                </div>
              </div>
            ))}
            {history.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">No readings recorded yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AbbottCGMMonitor;

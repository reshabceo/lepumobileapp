import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Activity, BarChart3, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Clock, Battery, Signal, RefreshCw, Loader2, LogIn, LogOut } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { dexcomApi, GlucoseReading } from '@/services/dexcomApi';
import { useDevice } from '@/contexts/DeviceContext';
import { Button } from '@/components/ui/button';

interface CGMSession {
  isConnected: boolean;
  lastReading?: GlucoseReading;
  averageGlucose: number;
  readingsCount: number;
  lastUpdate: string;
  batteryLevel?: number;
  signalStrength?: number;
}

const CGMMonitor: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { connectedDevice } = useDevice();
  const [session, setSession] = useState<CGMSession>({
    isConnected: false,
    averageGlucose: 0,
    readingsCount: 0,
    lastUpdate: 'Never',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [glucoseHistory, setGlucoseHistory] = useState<GlucoseReading[]>([]);
  const [selectedTimeRange, setSelectedTimeRange] = useState<'1h' | '6h' | '24h'>('6h');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Respect demo flag; default to off so we do not auto-connect
    const demoEnabled = String(import.meta.env.VITE_ENABLE_DEXCOM_DEMO || 'false') === 'true';
    if (demoEnabled) {
      handleAutoConnect();
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const handleAutoConnect = async () => {
    setIsConnecting(true);
    try {
      // Simulate successful connection for demo
      setTimeout(() => {
        setIsAuthenticated(true);
        startMonitoring();
        toast({
          title: 'Connected Successfully',
          description: 'Connected to Dexcom CGM device.',
          variant: 'default'
        });
      }, 1500);
    } catch (error) {
      console.error('Failed to connect:', error);
      toast({
        title: 'Connection Failed',
        description: 'Unable to connect to Dexcom CGM.',
        variant: 'destructive'
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const startMonitoring = async () => {
    try {
      setIsLoading(true);

      // Use mock data for demonstration
      const mockData: GlucoseReading[] = [
        { systemTime: '2025-01-13T15:00:00Z', displayTime: '2025-01-13T15:00:00Z', value: 120, trend: 'Stable', unit: 'mg/dL' },
        { systemTime: '2025-01-13T15:15:00Z', displayTime: '2025-01-13T15:15:00Z', value: 118, trend: 'Falling', trendRate: -2, unit: 'mg/dL' },
        { systemTime: '2025-01-13T15:30:00Z', displayTime: '2025-01-13T15:30:00Z', value: 125, trend: 'Rising', trendRate: 7, unit: 'mg/dL' },
        { systemTime: '2025-01-13T15:45:00Z', displayTime: '2025-01-13T15:45:00Z', value: 132, trend: 'Rising', trendRate: 7, unit: 'mg/dL' },
        { systemTime: '2025-01-13T16:00:00Z', displayTime: '2025-01-13T16:00:00Z', value: 128, trend: 'Falling', trendRate: -4, unit: 'mg/dL' },
        { systemTime: '2025-01-13T16:15:00Z', displayTime: '2025-01-13T16:15:00Z', value: 135, trend: 'Rising', trendRate: 7, unit: 'mg/dL' },
        { systemTime: '2025-01-13T16:30:00Z', displayTime: '2025-01-13T16:30:00Z', value: 142, trend: 'Rising', trendRate: 7, unit: 'mg/dL' },
        { systemTime: '2025-01-13T16:45:00Z', displayTime: '2025-01-13T16:45:00Z', value: 138, trend: 'Falling', trendRate: -4, unit: 'mg/dL' },
      ];

      setGlucoseHistory(mockData);
      const lastReading = mockData[mockData.length - 1];
      const average = Math.round(mockData.reduce((sum, reading) => sum + reading.value, 0) / mockData.length);

      setSession({
        isConnected: true,
        lastReading,
        averageGlucose: average,
        readingsCount: mockData.length,
        lastUpdate: new Date().toLocaleTimeString(),
        batteryLevel: 85,
        signalStrength: 95,
      });

      // Start real-time updates
      startRealTimeUpdates();
    } catch (error) {
      console.error('Failed to start monitoring:', error);
      toast({
        title: 'Connection Failed',
        description: 'Unable to connect to Dexcom CGM. Please check your credentials.',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const startRealTimeUpdates = () => {
    // Update every 5 minutes (Dexcom typically updates every 5 minutes)
    intervalRef.current = setInterval(async () => {
      try {
        // Simulate new data for demo
        const newReading: GlucoseReading = {
          systemTime: new Date().toISOString(),
          displayTime: new Date().toISOString(),
          value: Math.floor(Math.random() * 60) + 100, // Random value between 100-160
          trend: Math.random() > 0.5 ? 'Rising' : 'Falling',
          trendRate: Math.floor(Math.random() * 10) + 1,
          unit: 'mg/dL',
        };

        setGlucoseHistory(prev => {
          const combined = [...prev, newReading];
          // Remove duplicates and keep last 100 readings
          const unique = combined.filter((reading, index, arr) =>
            arr.findIndex(r => r.systemTime === reading.systemTime) === index
          );
          return unique.slice(-100);
        });

        setSession(prev => ({
          ...prev,
          lastReading: newReading,
          lastUpdate: new Date().toLocaleTimeString(),
        }));
      } catch (error) {
        console.error('Failed to update glucose data:', error);
      }
    }, 5 * 60 * 1000); // 5 minutes
  };

  const handleDisconnect = () => {
    dexcomApi.logout();
    setIsAuthenticated(false);
    setSession({
      isConnected: false,
      averageGlucose: 0,
      readingsCount: 0,
      lastUpdate: 'Never',
    });
    setGlucoseHistory([]);

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    toast({
      title: 'Disconnected',
      description: 'Disconnected from Dexcom CGM.',
      variant: 'default'
    });
  };

  const handleRefresh = async () => {
    if (!isAuthenticated) return;

    setIsLoading(true);
    try {
      await startMonitoring();
      toast({ title: 'Data Refreshed', description: 'Glucose data has been updated.', variant: 'default' });
    } catch (error) {
      toast({ title: 'Refresh Failed', description: 'Unable to refresh glucose data.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTimeRangeChange = (range: '1h' | '6h' | '24h') => {
    setSelectedTimeRange(range);
    // Filter data based on time range
    const now = new Date();
    const filteredData = glucoseHistory.filter(reading => {
      const readingTime = new Date(reading.systemTime);
      const diffHours = (now.getTime() - readingTime.getTime()) / (1000 * 60 * 60);
      return diffHours <= (range === '1h' ? 1 : range === '6h' ? 6 : 24);
    });
    setGlucoseHistory(filteredData);
  };

  const getGlucoseStatus = (value: number) => {
    if (value < 70) return { status: 'Low', color: 'text-red-500', bgColor: 'bg-red-500/10', borderColor: 'border-red-500/20' };
    if (value > 180) return { status: 'High', color: 'text-orange-500', bgColor: 'bg-orange-500/10', borderColor: 'border-orange-500/20' };
    if (value >= 70 && value <= 140) return { status: 'Normal', color: 'text-green-500', bgColor: 'bg-green-500/10', borderColor: 'border-green-500/20' };
    return { status: 'Elevated', color: 'text-yellow-500', bgColor: 'bg-yellow-500/10', borderColor: 'border-yellow-500/20' };
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'Rising': return <TrendingUp className="h-4 w-4 text-red-500" />;
      case 'Falling': return <TrendingDown className="h-4 w-4 text-green-500" />;
      case 'Stable': return <Activity className="h-4 w-4 text-blue-500" />;
      default: return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  // Check if no device is connected
  if (!connectedDevice) {
    return (
      <div className="min-h-screen bg-[#080D1A] text-white font-inter select-none">
        {/* Header */}
        <div className="p-4 pt-safe-top">
          <header className="flex items-center gap-3 mb-6">
            <button
              onClick={() => navigate(-1)}
              className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors active:scale-95 text-white"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-green-900/70 flex items-center justify-center border border-green-400/50">
                <BarChart3 className="h-6 w-6 text-green-300" />
              </div>
              <div>
                <h1 className="text-xl font-bold">CGM Monitor</h1>
                <p className="text-xs text-gray-400">Continuous Glucose Monitoring</p>
              </div>
            </div>
          </header>
        </div>
        
        {/* Content */}
        <div className="p-4">
          <div className="w-full max-w-md mx-auto">
            <div className="bg-[#1A243D] border border-slate-700/40 shadow-sm rounded-3xl p-6 text-center">
              <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4 animate-bounce" />
              <h2 className="text-xl font-bold mb-2">No Device Connected</h2>
              <p className="text-sm text-gray-400 mb-6">Continuous glucose monitoring requires connecting a compatible Dexcom sensor.</p>
              <button 
                onClick={() => navigate('/wellue-scanner')} 
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3.5 px-4 rounded-xl transition-all shadow-lg active:scale-95"
              >
                Connect Dexcom Sensor
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080D1A] text-white font-inter select-none">
      {/* Header */}
      <div className="p-4 pt-safe-top">
        <header className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors active:scale-95 text-white"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-green-900/70 flex items-center justify-center border border-green-400/50">
              <BarChart3 className="h-6 w-6 text-green-300" />
            </div>
            <div>
              <h1 className="text-xl font-bold">CGM Monitor</h1>
              <p className="text-xs text-gray-400">Continuous Glucose Monitoring</p>
            </div>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors disabled:opacity-50 text-white"
            >
              {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <RefreshCw className="h-5 w-5" />}
            </button>
            <button
              onClick={handleDisconnect}
              className="p-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 transition-colors text-red-400"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </header>
      </div>

      <div className="p-4 space-y-4 max-w-md mx-auto">
        {/* Current Glucose Reading */}
        {session.lastReading && (
          <div className="bg-[#1A243D] border border-slate-700/40 shadow-sm rounded-3xl p-6 text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-2xl bg-green-900/50 flex items-center justify-center border border-green-500/30">
                <BarChart3 className="h-6 w-6 text-green-400" />
              </div>
              <h2 className="text-lg font-bold text-white">Current Glucose</h2>
            </div>

            <div className="mb-4">
              <div className="text-6xl font-extrabold text-white mb-2 tracking-tight">
                {session.lastReading.value}
              </div>
              <div className="text-sm font-semibold text-gray-400 uppercase tracking-wider">{session.lastReading.unit}</div>
            </div>

            <div className="flex items-center justify-center gap-3 mb-4 bg-[#121B32] border border-slate-700/40 rounded-2xl p-3 max-w-[240px] mx-auto">
              {getTrendIcon(session.lastReading.trend)}
              <span className="text-sm font-medium text-gray-300">
                {session.lastReading.trend}
                {session.lastReading.trendRate && ` (${session.lastReading.trendRate} ${session.lastReading.unit}/min)`}
              </span>
            </div>

            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${getGlucoseStatus(session.lastReading.value).bgColor} ${getGlucoseStatus(session.lastReading.value).borderColor} border`}>
              {getGlucoseStatus(session.lastReading.value).status === 'Normal' ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-orange-500" />
              )}
              <span className={`font-semibold ${getGlucoseStatus(session.lastReading.value).color}`}>
                {getGlucoseStatus(session.lastReading.value).status}
              </span>
            </div>
          </div>
        )}

        {/* Device Status */}
        <div className="bg-[#1A243D] border border-slate-700/40 shadow-sm rounded-3xl p-5">
          <h3 className="text-base font-bold mb-4 text-white">Device Status</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-3 p-3 bg-[#121B32] border border-slate-700/40 rounded-2xl">
              <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse" />
              <div>
                <p className="text-xs text-gray-400">Connection</p>
                <p className="text-sm font-semibold text-green-400">Connected</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-[#121B32] border border-slate-700/40 rounded-2xl">
              <Battery className="h-4 w-4 text-green-400" />
              <div>
                <p className="text-xs text-gray-400">Battery</p>
                <p className="text-sm font-semibold text-white">{session.batteryLevel}%</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-[#121B32] border border-slate-700/40 rounded-2xl">
              <Signal className="h-4 w-4 text-green-400" />
              <div>
                <p className="text-xs text-gray-400">Signal</p>
                <p className="text-sm font-semibold text-white">{session.signalStrength}%</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-[#121B32] border border-slate-700/40 rounded-2xl">
              <Clock className="h-4 w-4 text-green-400" />
              <div>
                <p className="text-xs text-gray-400">Last Update</p>
                <p className="text-sm font-semibold text-white">{session.lastUpdate}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-[#1A243D] border border-slate-700/40 shadow-sm rounded-3xl p-4 text-center">
            <div className="text-2xl font-black text-green-400">{session.averageGlucose}</div>
            <div className="text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-wider">Average</div>
          </div>

          <div className="bg-[#1A243D] border border-slate-700/40 shadow-sm rounded-3xl p-4 text-center">
            <div className="text-2xl font-black text-green-400">{session.readingsCount}</div>
            <div className="text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-wider">Readings</div>
          </div>

          <div className="bg-[#1A243D] border border-slate-700/40 shadow-sm rounded-3xl p-4 text-center">
            <div className="text-2xl font-black text-green-400">5</div>
            <div className="text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-wider">Mins</div>
          </div>
        </div>

        {/* Time Range Selector */}
        <div className="bg-[#1A243D] border border-slate-700/40 shadow-sm rounded-3xl p-4">
          <h3 className="text-xs font-bold mb-3 text-white uppercase tracking-wider">Time Range</h3>
          <div className="flex gap-2 bg-[#121B32] p-1 rounded-2xl border border-slate-700/40">
            {(['1h', '6h', '24h'] as const).map((range) => (
              <button
                key={range}
                onClick={() => handleTimeRangeChange(range)}
                className={`flex-1 py-2 rounded-xl font-bold text-xs transition-all ${selectedTimeRange === range
                    ? 'bg-green-600 text-white shadow-md shadow-green-500/10'
                    : 'text-gray-400 hover:text-white'
                  }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>

        {/* Glucose History Chart */}
        <div className="bg-[#1A243D] border border-slate-700/40 shadow-sm rounded-3xl p-5">
          <h3 className="text-base font-bold mb-4 text-white">Glucose History</h3>
          <div className="space-y-2.5">
            {glucoseHistory.slice(-8).reverse().map((reading, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-[#121B32] border border-slate-700/40 rounded-2xl">
                <div className="flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full ${getGlucoseStatus(reading.value).status === 'Normal' ? 'bg-green-500' :
                      getGlucoseStatus(reading.value).status === 'Low' ? 'bg-red-500' :
                        getGlucoseStatus(reading.value).status === 'High' ? 'bg-orange-500' : 'bg-yellow-500'
                    }`} />
                  <div>
                    <div className="text-sm font-semibold text-white">{reading.value} <span className="text-[10px] text-gray-400">{reading.unit}</span></div>
                    <div className="text-[11px] text-gray-500">
                      {new Date(reading.displayTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {getTrendIcon(reading.trend)}
                  <span className="text-xs text-gray-400">{reading.trend}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CGMMonitor;

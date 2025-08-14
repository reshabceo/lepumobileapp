import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Activity, BarChart3, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Clock, Battery, Signal, RefreshCw, Loader2, LogIn, LogOut } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { dexcomApi, GlucoseReading } from '@/services/dexcomApi';

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
    // Auto-connect to Dexcom for demo purposes
    // In production, this would check for existing tokens
    handleAutoConnect();
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* Header */}
      <div className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700">
        <div className="flex items-center justify-between p-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
            <span>Back</span>
          </button>
          <h1 className="text-xl font-semibold">CGM Monitor</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="p-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 transition-colors disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <RefreshCw className="h-5 w-5" />}
            </button>
            <button
              onClick={handleDisconnect}
              className="p-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 transition-colors"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Current Glucose Reading */}
        {session.lastReading && (
          <div className="bg-gradient-to-br from-blue-600/20 to-purple-600/20 rounded-2xl p-6 border border-blue-500/30">
            <div className="text-center">
              <div className="flex items-center justify-center gap-3 mb-4">
                <BarChart3 className="h-8 w-8 text-blue-400" />
                <h2 className="text-2xl font-bold">Current Glucose</h2>
              </div>
              
              <div className="mb-4">
                <div className="text-6xl font-bold text-white mb-2">
                  {session.lastReading.value}
                </div>
                <div className="text-lg text-gray-300">{session.lastReading.unit}</div>
              </div>

              <div className="flex items-center justify-center gap-4 mb-4">
                {getTrendIcon(session.lastReading.trend)}
                <span className="text-lg text-gray-300">
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
          </div>
        )}

        {/* Device Status */}
        <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700">
          <h3 className="text-lg font-semibold mb-4">Device Status</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3 p-3 bg-slate-700/50 rounded-lg">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
              <div>
                <p className="text-sm text-gray-400">Connection</p>
                <p className="font-semibold text-green-400">Connected</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-slate-700/50 rounded-lg">
              <Battery className="h-5 w-5 text-blue-400" />
              <div>
                <p className="text-sm text-gray-400">Battery</p>
                <p className="font-semibold text-white">{session.batteryLevel}%</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-slate-700/50 rounded-lg">
              <Signal className="h-5 w-5 text-green-400" />
              <div>
                <p className="text-sm text-gray-400">Signal</p>
                <p className="font-semibold text-white">{session.signalStrength}%</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-slate-700/50 rounded-lg">
              <Clock className="h-5 w-5 text-yellow-400" />
              <div>
                <p className="text-sm text-gray-400">Last Update</p>
                <p className="font-semibold text-white">{session.lastUpdate}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 text-center">
            <div className="text-2xl font-bold text-blue-400">{session.averageGlucose}</div>
            <div className="text-sm text-gray-400">Average</div>
          </div>
          
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 text-center">
            <div className="text-2xl font-bold text-green-400">{session.readingsCount}</div>
            <div className="text-sm text-gray-400">Readings</div>
          </div>
          
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 text-center">
            <div className="text-2xl font-bold text-purple-400">5</div>
            <div className="text-sm text-gray-400">Minutes</div>
          </div>
        </div>

        {/* Time Range Selector */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <h3 className="text-lg font-semibold mb-4">Time Range</h3>
          <div className="flex gap-2">
            {(['1h', '6h', '24h'] as const).map((range) => (
              <button
                key={range}
                onClick={() => handleTimeRangeChange(range)}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  selectedTimeRange === range
                    ? 'bg-blue-500 text-white'
                    : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>

        {/* Glucose History Chart */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <h3 className="text-lg font-semibold mb-4">Glucose History</h3>
          <div className="space-y-3">
            {glucoseHistory.slice(-8).reverse().map((reading, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${
                    getGlucoseStatus(reading.value).status === 'Normal' ? 'bg-green-500' :
                    getGlucoseStatus(reading.value).status === 'Low' ? 'bg-red-500' :
                    getGlucoseStatus(reading.value).status === 'High' ? 'bg-orange-500' : 'bg-yellow-500'
                  }`} />
                  <div>
                    <div className="font-semibold text-white">{reading.value} {reading.unit}</div>
                    <div className="text-sm text-gray-400">
                      {new Date(reading.displayTime).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {getTrendIcon(reading.trend)}
                  <span className="text-sm text-gray-300">{reading.trend}</span>
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

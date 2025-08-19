
import React, { useState, useEffect } from 'react';
import { ArrowLeft, FileText, Search, Eye, Download, Heart, Activity, Plus, Calendar, User, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { MobileAppContainer } from '../components/MobileAppContainer';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { useToast } from '../hooks/use-toast';

// Interface for BP results
interface BPResult {
  systolic: number;
  diastolic: number;
  pulseRate: number;
  map: number;
  timestamp: string;
  deviceId: string;
  deviceName: string;
  measurementId: string;
  status: string;
}

// Interface for ECG results (updated to match actual ECGRhythm structure)
interface ECGResult {
  id: string;
  deviceId: string;
  timestamp: string;
  heartRate: number;
  rhythm: 'normal' | 'irregular' | 'bradycardia' | 'tachycardia' | 'afib' | 'arrhythmia';
  qrsDuration: number;
  qtInterval: number;
  prInterval: number;
  stSegment: 'normal' | 'elevated' | 'depressed';
  tWave: 'normal' | 'inverted' | 'flattened';
  pWave: 'normal' | 'absent' | 'inverted';
  ecgData: number[];
  unit: string;
  type?: string;
  savedAt?: string;
}

// Union type for all measurement results
type MeasurementResult = BPResult | ECGResult;

// Component for a single measurement result item
const MeasurementResultItem = ({ result }: { result: MeasurementResult }) => {
  const { toast } = useToast();

  const handleView = () => {
    if ('systolic' in result) {
      // BP Result
      toast({
        title: "Viewing BP Result",
        description: `Systolic: ${result.systolic}, Diastolic: ${result.diastolic}`,
      });
    } else {
      // ECG Result
      toast({
        title: "Viewing ECG Result",
        description: `ECG recording: ${result.heartRate} BPM`,
      });
    }
  };

  const handleDownload = () => {
    if ('systolic' in result) {
      toast({
        title: "Download Started",
        description: `Downloading BP result...`,
      });
    } else {
      toast({
        title: "Download Started",
        description: `Downloading ECG result...`,
      });
    }
    console.log(`Downloading result:`, result);
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const getBPStatus = (systolic: number, diastolic: number) => {
    if (systolic < 120 && diastolic < 80) return 'Normal';
    if (systolic < 130 && diastolic < 80) return 'Elevated';
    if (systolic < 140 && diastolic < 90) return 'Stage 1';
    if (systolic < 180 && diastolic < 110) return 'Stage 2';
    return 'Crisis';
  };

  // Check if it's a BP result
  if ('systolic' in result) {
    const bpResult = result as BPResult;
    const status = getBPStatus(bpResult.systolic, bpResult.diastolic);
    const statusColor = status === 'Normal' ? 'text-green-400' :
      status === 'Elevated' ? 'text-yellow-400' :
        status === 'Stage 1' ? 'text-orange-400' : 'text-red-400';

    return (
      <div className="bg-[#30363D] p-4 rounded-lg flex items-center space-x-4">
        <div className="bg-[#3C444C] p-3 rounded-full">
          <Heart className="text-red-400" size={20} />
        </div>
        <div className="flex-grow">
          <p className="font-semibold text-white">BP: {bpResult.systolic}/{bpResult.diastolic} mmHg</p>
          <p className="text-xs text-gray-400">
            {formatDate(bpResult.timestamp)} &bull; {bpResult.deviceName}
          </p>
          <p className="text-xs text-gray-400">
            Pulse: {bpResult.pulseRate} bpm &bull; MAP: {bpResult.map} mmHg
          </p>
          <p className={`text-xs font-medium ${statusColor}`}>
            Status: {status}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleView}
            className="p-2 text-gray-300 bg-[#3C444C] rounded-full hover:bg-gray-600 transition-colors"
            aria-label="View BP result"
          >
            <Eye size={18} />
          </button>
          <button
            onClick={handleDownload}
            className="p-2 text-gray-300 bg-[#3C444C] rounded-full hover:bg-gray-600 transition-colors"
            aria-label="Download BP result"
          >
            <Download size={18} />
          </button>
        </div>
      </div>
    );
  }

  // ECG Result
  const ecgResult = result as ECGResult;

  return (
    <div className="bg-[#30363D] p-4 rounded-lg flex items-center space-x-4">
      <div className="bg-[#3C444C] p-3 rounded-full">
        <Activity className="text-blue-400" size={20} />
      </div>
      <div className="flex-grow">
        <p className="font-semibold text-white">ECG Recording</p>
        <p className="text-xs text-gray-400">
          Heart Rate: {ecgResult.heartRate} BPM
        </p>
        <p className="text-xs text-gray-400">
          Rhythm: {ecgResult.rhythm} &bull; QRS: {ecgResult.qrsDuration}ms
        </p>
        <p className="text-xs text-gray-400">
          {ecgResult.savedAt ? new Date(ecgResult.savedAt).toLocaleDateString() : new Date(ecgResult.timestamp).toLocaleDateString()}
        </p>
      </div>
      <div className="flex items-center space-x-2">
        <button
          onClick={handleView}
          className="p-2 text-gray-300 bg-[#3C444C] rounded-full hover:bg-gray-600 transition-colors"
          aria-label="View ECG result"
        >
          <Eye size={18} />
        </button>
        <button
          onClick={handleDownload}
          className="p-2 text-gray-300 bg-[#3C444C] rounded-full hover:bg-gray-600 transition-colors"
          aria-label="Download ECG result"
        >
          <Download size={18} />
        </button>
      </div>
    </div>
  );
};

// Main View Reports Component
export default function ViewReports() {
  const navigate = useNavigate();
  const [measurementResults, setMeasurementResults] = useState<MeasurementResult[]>([]);
  const [loading, setLoading] = useState(true);

  const handleBack = () => {
    navigate('/dashboard');
  };

  const handleAddReport = () => {
    navigate('/add-reports');
  };

  // Load measurement results from storage
  const loadResults = async () => {
    try {
      setLoading(true);

      const allResults: MeasurementResult[] = [];

      // Load BP results from localStorage
      const savedBPResults = localStorage.getItem('bpResults');
      if (savedBPResults) {
        const bpResults = JSON.parse(savedBPResults);
        allResults.push(...bpResults);
        console.log('📊 Loaded BP results from localStorage:', bpResults.length);
      }

      // Load ECG results from localStorage (from HealthDashboard)
      const savedECGResults = localStorage.getItem('storedFilesInApp');
      if (savedECGResults) {
        const ecgResults = JSON.parse(savedECGResults);
        console.log('📊 Raw storedFilesInApp data:', ecgResults);

        // Filter only ECG results
        const filteredECGResults = ecgResults.filter((item: any) => item.type === 'ecg');
        console.log('📊 Filtered ECG results:', filteredECGResults);

        allResults.push(...filteredECGResults);
        console.log('📊 Loaded ECG results from localStorage:', filteredECGResults.length);
      }

      // Also try to load from device storage
      try {
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        const files = await Filesystem.readdir({
          path: '',
          directory: Directory.Documents
        });

        // Load BP files
        const bpFiles = files.files.filter((file: any) =>
          file.name && file.name.startsWith('bp_result_') && file.name.endsWith('.json')
        );

        for (const file of bpFiles) {
          try {
            const content = await Filesystem.readFile({
              path: file.name,
              directory: Directory.Documents
            });
            const result = JSON.parse(content.data as string);
            allResults.push(result);
          } catch (e) {
            console.warn('⚠️ Failed to read BP file:', file.name, e);
          }
        }

        // Load ECG files
        const ecgFiles = files.files.filter((file: any) =>
          file.name && (file.name.startsWith('bp2_ecg_') || file.name.includes('ecg')) && file.name.endsWith('.json')
        );

        for (const file of ecgFiles) {
          try {
            const content = await Filesystem.readFile({
              path: file.name,
              directory: Directory.Documents
            });
            const result = JSON.parse(content.data as string);
            allResults.push(result);
          } catch (e) {
            console.warn('⚠️ Failed to read ECG file:', file.name, e);
          }
        }

        console.log('📊 Loaded results from device storage:', bpFiles.length + ecgFiles.length);

      } catch (error) {
        console.log('⚠️ Could not load from device storage:', error);
      }

      // Sort results by timestamp (newest first)
      const sortedResults = allResults.sort((a, b) => {
        const timestampA = 'timestamp' in a ? a.timestamp : '';
        const timestampB = 'timestamp' in b ? b.timestamp : '';
        return new Date(timestampB).getTime() - new Date(timestampA).getTime();
      });

      setMeasurementResults(sortedResults);
      console.log('📊 Total measurement results loaded:', sortedResults.length);

    } catch (error) {
      console.error('❌ Failed to load measurement results:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadResults();
  }, []);

  return (
    <MobileAppContainer>
      <div className="bg-[#161B22] min-h-screen text-white font-inter">
        <div className="max-w-sm mx-auto min-h-screen bg-[#1C2128] flex flex-col relative">

          {/* Status Bar Spacing */}
          <div className="h-6"></div>

          {/* Header */}
          <header className="flex items-center justify-between p-4 border-b border-gray-700 flex-shrink-0">
            <div className="flex items-center">
              <button onClick={handleBack} className="text-gray-300 hover:text-white">
                <ArrowLeft size={24} />
              </button>
              <FileText size={24} className="mx-3 text-gray-400" />
              <h1 className="text-lg font-semibold text-white">View Reports</h1>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={loadResults}
                className="text-gray-300 hover:text-white p-2 rounded-lg bg-gray-700/50"
                title="Refresh Results"
              >
                <RefreshCw size={20} />
              </button>
              <button className="text-gray-300 hover:text-white">
                <Search size={22} />
              </button>
            </div>
          </header>

          {/* Search Bar */}
          <div className="p-4 flex-shrink-0">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="text-gray-500" size={20} />
              </div>
              <input
                type="text"
                placeholder="Search reports"
                className="w-full pl-10 pr-4 py-2 bg-[#2D333B] text-white border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-500"
                aria-label="Search reports"
              />
            </div>
          </div>

          {/* Reports List */}
          <main className="flex-grow p-4 pt-0 overflow-y-auto">
            <div className="space-y-3 pb-20">
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
                  <p className="text-gray-400">Loading measurement results...</p>
                </div>
              ) : measurementResults.length > 0 ? (
                <>
                  <div className="mb-4">
                    <h2 className="text-lg font-semibold text-white mb-2">Measurement Results</h2>
                    <p className="text-sm text-gray-400">Found {measurementResults.length} measurement(s)</p>
                  </div>
                  {measurementResults.map((result, index) => (
                    <MeasurementResultItem key={('measurementId' in result ? result.measurementId : index) || index} result={result} />
                  ))}
                </>
              ) : (
                <div className="text-center py-8">
                  <Activity className="h-12 w-12 text-gray-500 mx-auto mb-4" />
                  <p className="text-gray-400 font-medium">No Measurement Results Found</p>
                  <p className="text-sm text-gray-500 mt-2">
                    Complete BP or ECG measurements to see results here
                  </p>
                </div>
              )}
            </div>
          </main>

          {/* Floating Action Button */}
          <button
            onClick={handleAddReport}
            className="absolute bottom-6 right-6 bg-teal-500 text-white rounded-full p-4 shadow-lg hover:bg-teal-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#1C2128] focus:ring-teal-500"
          >
            <Plus size={24} />
          </button>

        </div>
      </div>
    </MobileAppContainer>
  );
}

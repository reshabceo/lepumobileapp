import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Bluetooth, 
  BluetoothOff, 
  Search, 
  Square, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Battery,
  Settings,
  Smartphone,
  AlertCircle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useDevice } from '@/contexts/DeviceContext';
import { Capacitor } from '@capacitor/core';

export const WellueSDKScanner: React.FC = () => {
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [hasAutoScanned, setHasAutoScanned] = useState<boolean>(false);
  const [bonded, setBonded] = useState<Array<{ name: string; address: string }>>([]);
  const [showFound, setShowFound] = useState<boolean>(true);
  const [showPaired, setShowPaired] = useState<boolean>(false);
  const { toast } = useToast();
  
  const {
    connectedDevice,
    availableDevices,
    isScanning,
    isConnecting,
    isInitialized,
    bluetoothEnabled,
    error,
    startScan,
    stopScan,
    connectToDevice,
    disconnectDevice,
    refreshBattery,
    manualInitializeSDK
  } = useDevice();

  useEffect(() => {
    setIsMobile(Capacitor.isNativePlatform());
  }, []);

  useEffect(() => {
    if (isMobile && isInitialized && !hasAutoScanned && bluetoothEnabled) {
      const tryAutoScan = async () => {
        try {
          setHasAutoScanned(true);
          await startScan();
          setTimeout(() => {
            if (isScanning) {
              stopScan();
            }
          }, 10000);
        } catch (error) {
          console.error('Auto-scan failed:', error);
        }
      };
      tryAutoScan();
    }
  }, [isMobile, isInitialized, hasAutoScanned, bluetoothEnabled, isScanning, startScan, stopScan]);

  const manualInitialize = async () => {
    if (!isInitialized) {
      try {
        toast({
          title: "Initializing...",
          description: "Please wait while the SDK initializes",
        });
        await manualInitializeSDK();
        toast({
          title: "Success!",
          description: "SDK initialized successfully",
        });
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to initialize SDK",
          variant: "destructive",
        });
      }
    }
  };

  const getBatteryLevel = async () => {
    if (connectedDevice) {
      await refreshBattery();
    }
  };

  const getStatusIcon = (isConnected: boolean) => {
    return isConnected ? (
      <CheckCircle className="h-4 w-4 text-green-400" />
    ) : (
      <XCircle className="h-4 w-4 text-gray-400" />
    );
  };

  if (!isInitialized) {
    return (
      <div className="bg-gray-900 rounded-2xl p-6 border border-gray-700">
        <div className="flex items-center gap-2 mb-4">
          <Bluetooth className="h-5 w-5 text-blue-400" />
          <h3 className="text-lg font-semibold text-white">Wellue Device Scanner</h3>
        </div>
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-4">
          <AlertTriangle className="h-4 w-4 text-red-400 mb-2" />
          <p className="text-red-300 text-sm">
            SDK is initializing. Please wait...
          </p>
        </div>
        <Button 
          onClick={manualInitialize}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          disabled={isInitialized}
        >
          {isInitialized ? "Initialized" : "Initialize SDK"}
        </Button>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-2xl p-6 border border-gray-700">
      <div className="flex items-center gap-2 mb-6">
        <Bluetooth className="h-5 w-5 text-blue-400" />
        <h3 className="text-lg font-semibold text-white">Wellue Device Scanner</h3>
      </div>
      <div className="space-y-4">
        {/* Bluetooth Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {bluetoothEnabled ? (
              <Bluetooth className="h-5 w-5 text-blue-400" />
            ) : (
              <BluetoothOff className="h-5 w-5 text-red-400" />
            )}
            <span className="text-sm text-gray-300">
              Bluetooth: {bluetoothEnabled ? "Enabled" : "Disabled"}
            </span>
          </div>
          {connectedDevice && (
            <Badge variant="secondary" className="flex items-center gap-1 bg-blue-500/20 text-blue-400 border-blue-500/30">
              <Battery className="h-3 w-3" />
              {connectedDevice.battery || 0}%
            </Badge>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
            <AlertCircle className="h-4 w-4 text-red-400 mb-2" />
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        {/* Connected Device */}
        {connectedDevice && (
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-400" />
                <div>
                  <p className="font-medium text-green-300">{connectedDevice.name}</p>
                  <p className="text-xs text-green-400">{connectedDevice.id}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={getBatteryLevel}
                  className="text-green-400 border-green-400/30 bg-green-500/10 hover:bg-green-500/20"
                >
                  <Battery className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={disconnectDevice}
                  className="text-red-400 border-red-400/30 bg-red-500/10 hover:bg-red-500/20"
                >
                  Disconnect
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Scan Controls */}
        <div className="flex gap-2">
          {!isScanning ? (
            <Button 
              onClick={startScan}
              disabled={!bluetoothEnabled || !!connectedDevice}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Search className="h-4 w-4 mr-2" />
              Start Scan
            </Button>
          ) : (
            <Button 
              onClick={stopScan}
              variant="outline"
              className="flex-1"
            >
              <Square className="h-4 w-4 mr-2" />
              Stop Scan
            </Button>
          )}
        </div>

        {/* Manual Device Detection */}
        <div className="flex gap-2">
          <Button
            onClick={async () => {
              try {
                toast({
                  title: "Checking devices...",
                  description: "Looking for connected devices",
                });
                await startScan();
                setTimeout(() => {
                  stopScan();
                  toast({
                    title: "Scan complete",
                    description: `Found ${availableDevices.length} device(s)`,
                  });
                }, 3000);
              } catch (error) {
                toast({
                  title: "Error",
                  description: "Failed to check for devices",
                  variant: "destructive",
                });
              }
            }}
            variant="outline"
            size="sm"
            className="flex-1"
          >
            <Bluetooth className="h-4 w-4 mr-2" />
            Check Devices
          </Button>
          
          <Button
            onClick={() => window.location.reload()}
            variant="outline"
            size="sm"
            className="flex-1"
          >
            <Settings className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Device Tabs */}
        <div className="flex border-b border-gray-700">
          <button
            onClick={() => setShowFound(true)}
            className={`px-4 py-2 text-sm font-medium ${
              showFound
                ? 'border-b-2 border-blue-400 text-blue-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            Found Devices ({availableDevices.length})
          </button>
          <button
            onClick={() => setShowPaired(true)}
            className={`px-4 py-2 text-sm font-medium ${
              showPaired
                ? 'border-b-2 border-blue-400 text-blue-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            Paired Devices ({bonded.length})
          </button>
        </div>

        {/* Found Devices */}
        {showFound && (
          <div className="space-y-2">
            {isScanning && (
              <div className="text-center py-4 text-sm text-gray-400">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-400 mx-auto mb-2"></div>
                Scanning for devices...
              </div>
            )}
            
            {!isScanning && availableDevices.length === 0 && (
              <div className="text-center py-8 text-gray-400">
                <Search className="h-12 w-12 mx-auto mb-2 text-gray-500" />
                <p className="text-gray-300">No devices found</p>
                <p className="text-sm text-gray-400">Start scanning to discover devices</p>
              </div>
            )}

            {availableDevices.map((device) => (
              <div 
                key={device.id} 
                className={`cursor-pointer transition-colors p-3 rounded-lg border ${
                  device.isConnected 
                    ? 'bg-green-500/10 border-green-500/20' 
                    : 'bg-gray-800 border-gray-700 hover:bg-gray-700'
                }`}
                onClick={() => !device.isConnected && connectToDevice(device)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(device.isConnected || false)}
                    <div>
                      <p className="font-medium text-white">{device.name}</p>
                      <p className="text-xs text-gray-400">{device.id}</p>
                      {device.battery !== undefined && (
                        <p className="text-xs text-gray-400">
                          Battery: {device.battery}%
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge 
                      className={device.isConnected ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-gray-500/20 text-gray-400 border-gray-500/30"}
                    >
                      {device.isConnected ? "Connected" : "Available"}
                    </Badge>
                    {device.isConnected ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          disconnectDevice();
                        }}
                        className="text-red-400 border-red-400/30 bg-red-500/10 hover:bg-red-500/20"
                      >
                        Disconnect
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          connectToDevice(device);
                        }}
                        disabled={isConnecting}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        {isConnecting ? "Connecting..." : "Connect"}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Paired Devices */}
        {showPaired && (
          <div className="space-y-2">
            {bonded.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Settings className="h-12 w-12 mx-auto mb-2 text-gray-500" />
                <p className="text-gray-300">No paired devices</p>
                <p className="text-sm text-gray-400">Paired devices will appear here</p>
              </div>
            ) : (
              bonded.map((device) => (
                <div key={device.address} className="cursor-pointer hover:bg-gray-700 bg-gray-800 border border-gray-700 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Smartphone className="h-4 w-4 text-gray-400" />
                      <div>
                        <p className="font-medium text-white">{device.name}</p>
                        <p className="text-xs text-gray-400">{device.address}</p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="bg-blue-500/20 text-blue-400 border-blue-500/30">Paired</Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

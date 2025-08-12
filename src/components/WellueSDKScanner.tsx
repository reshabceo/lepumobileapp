import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Bluetooth, 
  BluetoothOff, 
  Search, 
  Square, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Battery,
  Activity,
  Settings,
  Smartphone,
  Wifi,
  WifiOff,
  AlertCircle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useDevice } from '@/contexts/DeviceContext';
import { WellueDevice } from '@/lib/wellue-sdk-bridge';
import { Capacitor } from '@capacitor/core';

export const WellueSDKScanner: React.FC = () => {
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [hasAutoScanned, setHasAutoScanned] = useState<boolean>(false);
  const [bonded, setBonded] = useState<Array<{ name: string; address: string }>>([]);
  const [showFound, setShowFound] = useState<boolean>(true);
  const [showPaired, setShowPaired] = useState<boolean>(false);
  const { toast } = useToast();
  
  // Use shared device context
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

  // Check if we're on mobile
  useEffect(() => {
    setIsMobile(Capacitor.isNativePlatform());
  }, []);

  // Auto-scan on mobile devices
  useEffect(() => {
    if (isMobile && isInitialized && !hasAutoScanned && bluetoothEnabled) {
      const tryAutoScan = async () => {
        try {
          setHasAutoScanned(true);
          await startScan();
          
          // Auto-stop after 10 seconds
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

  const loadBondedDevices = async () => {
    try {
      // This would typically come from the native plugin
      // For now, we'll show an empty list
      setBonded([]);
    } catch (error) {
      console.error('Failed to load bonded devices:', error);
    }
  };

  const getBatteryLevel = async () => {
    if (connectedDevice) {
      await refreshBattery();
    }
  };

  const startBPMeasurement = async () => {
    if (connectedDevice) {
      // Navigate to BP monitor or start measurement
      toast({
        title: "BP Measurement",
        description: "Navigate to Live BP Monitor to start measurement",
      });
    }
  };

  const getStatusIcon = (isConnected: boolean) => {
    return isConnected ? (
      <CheckCircle className="h-4 w-4 text-green-500" />
    ) : (
      <XCircle className="h-4 w-4 text-gray-400" />
    );
  };

  const getStatusColor = (isConnected: boolean) => {
    return isConnected ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800";
  };

  if (!isInitialized) {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bluetooth className="h-5 w-5" />
              Wellue Device Scanner
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                SDK is initializing. Please wait...
              </AlertDescription>
            </Alert>
            <Button 
              onClick={manualInitialize}
              className="mt-4"
              disabled={isInitialized}
            >
              {isInitialized ? "Initialized" : "Initialize SDK"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bluetooth className="h-5 w-5" />
            Wellue Device Scanner
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Bluetooth Status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {bluetoothEnabled ? (
                <Bluetooth className="h-5 w-5 text-blue-500" />
              ) : (
                <BluetoothOff className="h-5 w-5 text-red-500" />
              )}
              <span className="text-sm">
                Bluetooth: {bluetoothEnabled ? "Enabled" : "Disabled"}
              </span>
            </div>
            {connectedDevice && (
              <Badge variant="secondary" className="flex items-center gap-1">
                <Battery className="h-3 w-3" />
                {connectedDevice.battery || 0}%
              </Badge>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Manual SDK Initialization */}
          {!isInitialized && (
            <Alert>
              <Settings className="h-4 w-4" />
              <AlertDescription>
                SDK not initialized. Click the button below to initialize and grant Bluetooth permissions.
              </AlertDescription>
              <Button 
                onClick={manualInitialize}
                className="mt-3"
                size="sm"
              >
                <Smartphone className="h-4 w-4 mr-2" />
                Initialize SDK
              </Button>
            </Alert>
          )}

          {/* Connected Device */}
          {connectedDevice && (
            <Card className="bg-green-50 border-green-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-green-800">
                  Connected Device
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <div>
                      <p className="font-medium text-green-800">{connectedDevice.name}</p>
                      <p className="text-xs text-green-600">{connectedDevice.id}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={getBatteryLevel}
                      className="text-green-700 border-green-300"
                    >
                      <Battery className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={disconnectDevice}
                      className="text-red-700 border-red-300"
                    >
                      Disconnect
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Scan Controls */}
          <div className="flex gap-2">
            {!isScanning ? (
              <Button 
                onClick={startScan}
                disabled={!bluetoothEnabled || !!connectedDevice}
                className="flex-1"
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
            
            {connectedDevice && (
              <Button
                onClick={startBPMeasurement}
                className="flex-1"
                variant="default"
              >
                <Activity className="h-4 w-4 mr-2" />
                Start BP
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
                  
                  // Force a scan to check for devices
                  await startScan();
                  
                  // Wait a moment then stop scan
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
          <div className="flex border-b">
            <button
              onClick={() => setShowFound(true)}
              className={`px-4 py-2 text-sm font-medium ${
                showFound
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Found Devices ({availableDevices.length})
            </button>
            <button
              onClick={() => setShowPaired(true)}
              className={`px-4 py-2 text-sm font-medium ${
                showPaired
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Paired Devices ({bonded.length})
            </button>
          </div>

          {/* Found Devices */}
          {showFound && (
            <div className="space-y-2">
              {isScanning && (
                <div className="text-center py-4 text-sm text-gray-500">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto mb-2"></div>
                  Scanning for devices...
                </div>
              )}
              
              {!isScanning && availableDevices.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Search className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                  <p>No devices found</p>
                  <p className="text-sm">Start scanning to discover devices</p>
                </div>
              )}

              {availableDevices.map((device) => (
                <Card 
                  key={device.id} 
                  className={`cursor-pointer transition-colors ${
                    device.isConnected 
                      ? 'bg-green-50 border-green-200' 
                      : 'hover:bg-gray-50'
                  }`}
                  onClick={() => !device.isConnected && connectToDevice(device)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(device.isConnected || false)}
                        <div>
                          <p className="font-medium">{device.name}</p>
                          <p className="text-xs text-gray-500">{device.id}</p>
                          {device.battery !== undefined && (
                            <p className="text-xs text-gray-500">
                              Battery: {device.battery}%
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge 
                          className={getStatusColor(device.isConnected || false)}
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
                            className="text-red-700 border-red-300"
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
                          >
                            {isConnecting ? "Connecting..." : "Connect"}
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Paired Devices */}
          {showPaired && (
            <div className="space-y-2">
              {bonded.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Settings className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                  <p>No paired devices</p>
                  <p className="text-sm">Paired devices will appear here</p>
                </div>
              ) : (
                bonded.map((device) => (
                  <Card key={device.address} className="cursor-pointer hover:bg-gray-50">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Smartphone className="h-4 w-4 text-gray-400" />
                          <div>
                            <p className="font-medium">{device.name}</p>
                            <p className="text-xs text-gray-500">{device.address}</p>
                          </div>
                        </div>
                        <Badge variant="secondary">Paired</Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

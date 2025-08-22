import React, { useState, useEffect } from 'react';
import EcgStripCanvas from './EcgStripCanvas';
import { ScreenOrientation } from '@capacitor/screen-orientation';
import { ArrowLeft, Maximize2 } from 'lucide-react';

interface EcgChartWithControlsProps {
    ecgData: {
        s: Float32Array;
        sr: number;
        scale: number;
    } | null;
}

export default function EcgChartWithControls({ ecgData }: EcgChartWithControlsProps) {
    const [isLandscape, setIsLandscape] = useState(false);

    // Check initial orientation
    useEffect(() => {
        const checkOrientation = async () => {
            try {
                const orientation = await ScreenOrientation.orientation();
                setIsLandscape(orientation.type.includes('landscape'));
            } catch (err) {
                console.log('Could not check orientation:', err);
            }
        };
        checkOrientation();
    }, []);

    // Listen for orientation changes
    useEffect(() => {
        const handleOrientationChange = () => {
            const isLandscapeNow = window.innerWidth > window.innerHeight;
            setIsLandscape(isLandscapeNow);
        };

        window.addEventListener('resize', handleOrientationChange);
        return () => window.removeEventListener('resize', handleOrientationChange);
    }, []);
    




    // Expand to landscape mode
    const expandToLandscape = async () => {
        try {
            await ScreenOrientation.lock({ orientation: 'landscape' });
            setIsLandscape(true);
        } catch (err) {
            console.error('Failed to lock landscape:', err);
        }
    };

    // Return to portrait mode
    const returnToPortrait = async () => {
        try {
            await ScreenOrientation.unlock();
            setIsLandscape(false);
        } catch (err) {
            console.error('Failed to unlock orientation:', err);
        }
    };

    if (!ecgData) {
        return null;
    }

    // Landscape mode - full screen ECG display
    if (isLandscape) {
        return (
            <div className="fixed inset-0 bg-white z-50">
                {/* Back button */}
                <div className="absolute top-4 left-4 z-10">
                    <button
                        onClick={returnToPortrait}
                        className="flex items-center gap-2 px-4 py-2 backdrop-blur-sm bg-green-500/80 text-white rounded-lg hover:bg-green-400/90 transition-all duration-300 border border-green-400/30 shadow-lg"
                    >
                        <ArrowLeft className="h-5 w-5" />
                        Back
                    </button>
                </div>

                {/* Full screen ECG chart with proper DPI scaling and maximum width */}
                <div className="w-full h-full flex items-center justify-center p-4">
                    <EcgStripCanvas
                        samples={ecgData.s}
                        sampleRate={ecgData.sr}
                        scaleUvPerLsb={ecgData.scale}
                        rows={3}
                        secondsPerRow={10}
                        width={Math.floor((window.innerWidth - 40) * window.devicePixelRatio)}
                        height={Math.floor((window.innerHeight - 80) * window.devicePixelRatio)}
                    />
                </div>
            </div>
        );
    }

    // Portrait mode - normal chart display
    return (
        <div className="backdrop-blur-md bg-green-900/10 border border-green-500/30 rounded-lg shadow-2xl p-6">
            {/* Single ECG Waveform title */}
            <h3 className="text-lg font-semibold mb-4 text-white">ECG Waveform</h3>
            
            {/* Chart with expand icon */}
            <div className="relative">
                {/* Expand icon at top-right */}
                <button
                    onClick={expandToLandscape}
                    className="absolute top-2 right-2 z-10 p-2 backdrop-blur-sm bg-green-500/80 text-white rounded-lg hover:bg-green-400/90 transition-all duration-300 border border-green-400/30 shadow-lg"
                    title="Expand to landscape mode"
                >
                    <Maximize2 className="h-5 w-5" />
                </button>

                {/* ECG Chart - Full Width to Show Complete Chart */}
                <EcgStripCanvas
                    samples={ecgData.s}
                    sampleRate={ecgData.sr}
                    scaleUvPerLsb={ecgData.scale}
                    rows={3}
                    secondsPerRow={10}
                    width={1600}
                    height={720}
                />
            </div>
        </div>
    );
}

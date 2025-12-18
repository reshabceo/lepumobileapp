import React, { useState, useEffect } from 'react';
import EcgStripCanvas from './EcgStripCanvas';
import EcgFullScreenChart from './EcgFullScreenChart';
import { Maximize2 } from 'lucide-react';

interface EcgChartWithControlsProps {
    ecgData: {
        s: Float32Array;
        sr: number;
        scale: number;
    } | null;
}

export default function EcgChartWithControls({ ecgData }: EcgChartWithControlsProps) {
    const [isLandscape, setIsLandscape] = useState(false);

    // No need to listen to device orientation - we control chart rotation manually
    // Reset to portrait when component unmounts
    useEffect(() => {
        return () => {
            setIsLandscape(false);
        };
    }, []);
    




    // Expand to landscape mode (chart only, not entire app)
    const expandToLandscape = () => {
        setIsLandscape(true);
    };

    // Return to portrait mode (chart only, not entire app)
    const returnToPortrait = () => {
        setIsLandscape(false);
    };

    if (!ecgData) {
        return null;
    }

    // Landscape mode - use separate full-screen component
    if (isLandscape) {
        return (
            <EcgFullScreenChart 
                ecgData={ecgData} 
                onClose={returnToPortrait}
            />
        );
    }

    // Portrait mode - normal chart display
    return (
        <div className="backdrop-blur-md bg-green-900/10 border border-green-500/30 rounded-lg shadow-2xl p-6">
            {/* Chart with expand icon - title removed to avoid duplicate */}
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

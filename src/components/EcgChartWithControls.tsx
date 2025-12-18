import React, { useState, useEffect, useRef } from 'react';
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
    const [chartDimensions, setChartDimensions] = useState({ width: 1600, height: 720 });
    const containerRef = useRef<HTMLDivElement>(null);

    // Calculate responsive dimensions based on viewport and container
    useEffect(() => {
        const calculateDimensions = () => {
            if (!containerRef.current) return;

            // Get container width (accounting for padding: p-3 sm:p-6)
            const containerPadding = window.innerWidth < 640 ? 24 : 48; // p-3 = 12px each side, p-6 = 24px each side
            const containerWidth = containerRef.current.offsetWidth - containerPadding;
            const viewportWidth = window.innerWidth;
            const dpr = window.devicePixelRatio || 1;

            // For mobile: use full available width to show complete ECG
            // Standard ECG paper: 25mm/sec horizontal, 10mm/mV vertical
            // We show 3 rows × 10 seconds = 30 seconds total
            
            // Calculate width: use full container width for mobile
            const availableWidth = Math.max(containerWidth, viewportWidth - containerPadding);
            
            // For mobile devices, ensure we can show the full ECG chart
            // Calculate proper dimensions maintaining ECG paper standards
            const rows = 3;
            const secondsPerRow = 10;
            
            // Calculate dimensions: ensure full ECG is visible
            // Paper speed: 25mm/sec, so 10 seconds = 250mm horizontally
            // For mobile, scale to fit screen while maintaining aspect ratio
            const baseWidth = Math.max(availableWidth, 320); // Minimum width for mobile
            
            // Calculate height based on ECG standard proportions
            // Each row needs enough height to show the waveform clearly
            // Standard ECG: ~40mm per row for good visibility
            const rowHeightMm = 40; // mm per row
            const totalHeightMm = rows * rowHeightMm; // Total height in mm
            
            // Convert mm to pixels: 1mm ≈ 3.78px at 96 DPI, but scale for mobile
            const mmToPx = 3.78 * (dpr > 1 ? 1.5 : 1); // Scale up for high DPI
            const baseHeight = totalHeightMm * mmToPx;
            
            // Use device pixel ratio for crisp rendering
            const width = Math.floor(baseWidth * dpr);
            const height = Math.floor(baseHeight * dpr);
            
            setChartDimensions({ width, height });
        };

        // Calculate on mount and when ecgData changes
        calculateDimensions();
        
        // Recalculate on window resize
        const handleResize = () => {
            setTimeout(calculateDimensions, 100); // Debounce
        };
        
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [ecgData]);

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

    // Portrait mode - responsive chart display for mobile
    return (
        <div 
            ref={containerRef}
            className="backdrop-blur-md bg-green-900/10 border border-green-500/30 rounded-lg shadow-2xl p-3 sm:p-6 w-full overflow-hidden"
        >
            {/* Chart with expand icon */}
            <div className="relative w-full">
                {/* Expand icon at top-right */}
                <button
                    onClick={expandToLandscape}
                    className="absolute top-2 right-2 z-10 p-2 backdrop-blur-sm bg-green-500/80 text-white rounded-lg hover:bg-green-400/90 transition-all duration-300 border border-green-400/30 shadow-lg"
                    title="Expand to landscape mode"
                >
                    <Maximize2 className="h-5 w-5" />
                </button>

                {/* ECG Chart - Responsive and Full Width for Mobile */}
                {/* Horizontal scroll for very wide charts on mobile */}
                <div className="w-full overflow-x-auto overflow-y-hidden -mx-3 sm:-mx-6">
                    <div className="min-w-full">
                        <EcgStripCanvas
                            samples={ecgData.s}
                            sampleRate={ecgData.sr}
                            scaleUvPerLsb={ecgData.scale}
                            rows={3}
                            secondsPerRow={10}
                            width={chartDimensions.width}
                            height={chartDimensions.height}
                            minimal={true}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

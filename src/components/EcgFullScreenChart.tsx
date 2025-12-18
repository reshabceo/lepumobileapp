import React from 'react';
import { createPortal } from 'react-dom';
import EcgStripCanvas from './EcgStripCanvas';
import { ArrowLeft } from 'lucide-react';

interface EcgFullScreenChartProps {
    ecgData: {
        s: Float32Array;
        sr: number;
        scale: number;
    };
    onClose: () => void;
}

export default function EcgFullScreenChart({ ecgData, onClose }: EcgFullScreenChartProps) {
    // Calculate dimensions to fill entire screen with DPI scaling
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const dpr = window.devicePixelRatio || 1;
    
    // Chart dimensions for landscape: use height as width, width as height
    const landscapeWidth = Math.floor(viewportHeight * dpr);
    const landscapeHeight = Math.floor(viewportWidth * dpr);
    
    // Use React Portal to render at document body level, ensuring it's on top
    const chartContent = (
        <div 
            className="fixed inset-0 bg-black" 
            style={{ 
                width: '100vw', 
                height: '100vh',
                overflow: 'hidden',
                zIndex: 99999,
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0
            }}
        >
            {/* Back button */}
            <div className="absolute top-4 left-4 z-10">
                <button
                    onClick={onClose}
                    className="flex items-center gap-2 px-4 py-2 backdrop-blur-sm bg-green-500/80 text-white rounded-lg hover:bg-green-400/90 transition-all duration-300 border border-green-400/30 shadow-lg"
                >
                    <ArrowLeft className="h-5 w-5" />
                    Back
                </button>
            </div>

            {/* Full screen ECG chart - rotated 90deg to fill horizontally, with DPI scaling */}
            {/* Fill entire viewport - use full dimensions for landscape */}
            <div 
                style={{
                    position: 'absolute',
                    transform: 'rotate(90deg)',
                    transformOrigin: 'center center',
                    left: '50%',
                    top: '50%',
                    marginLeft: `-${viewportHeight / 2}px`,
                    marginTop: `-${viewportWidth / 2}px`,
                    width: `${viewportHeight}px`,
                    height: `${viewportWidth}px`,
                    overflow: 'hidden'
                }}
            >
                <EcgStripCanvas
                    samples={ecgData.s}
                    sampleRate={ecgData.sr}
                    scaleUvPerLsb={ecgData.scale}
                    rows={3}
                    secondsPerRow={10}
                    width={landscapeWidth}
                    height={landscapeHeight}
                />
            </div>
        </div>
    );
    
    // Render using portal to ensure it's at the top level
    return typeof document !== 'undefined' 
        ? createPortal(chartContent, document.body)
        : chartContent;
}


import React, { useRef, useEffect, useCallback } from 'react';

interface EcgFinalCanvasProps {
    samples: Int16Array | Float32Array;
    sampleRate: number;        // 125 Hz
    scaleUvPerLsb: number;     // 3.098 μV/LSB or 1.0 if already in mV
    seconds: number;           // Duration to show (e.g., 10 seconds)
    width: number;             // Canvas width
    height: number;            // Canvas height
    onPng?: (dataUrl: string) => void; // Callback for PNG export
}

const EcgFinalCanvas: React.FC<EcgFinalCanvasProps> = ({
    samples,
    sampleRate,
    scaleUvPerLsb,
    seconds,
    width,
    height,
    onPng
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Convert samples to mV values
    const convertToMv = useCallback((sample: number): number => {
        if (scaleUvPerLsb === 1.0) {
            // Already in mV, no conversion needed
            return sample;
        } else {
            // Convert from Int16 ADC values to mV
            return (sample * scaleUvPerLsb) / 1000; // Convert μV to mV
        }
    }, [scaleUvPerLsb]);

    // Draw ECG grid (standard medical ECG paper)
    const drawGrid = useCallback((ctx: CanvasRenderingContext2D) => {
        const gridSize = 25; // 5mm grid (standard ECG paper)
        const minorGridSize = 5; // 1mm grid

        ctx.strokeStyle = '#e0e0e0';
        ctx.lineWidth = 0.5;

        // Draw minor grid lines (1mm)
        for (let x = 0; x <= width; x += minorGridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        for (let y = 0; y <= height; y += minorGridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }

        // Draw major grid lines (5mm)
        ctx.strokeStyle = '#c0c0c0';
        ctx.lineWidth = 1;
        for (let x = 0; x <= width; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        for (let y = 0; y <= height; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
    }, [width, height]);

    // Draw ECG waveform
    const drawWaveform = useCallback((ctx: CanvasRenderingContext2D) => {
        if (!samples || samples.length === 0) return;

        const samplesToShow = Math.min(samples.length, seconds * sampleRate);
        const startIndex = Math.max(0, samples.length - samplesToShow);
        
        const xStep = width / samplesToShow;
        const yCenter = height / 2;
        const yScale = height / 2; // mV scale

        ctx.strokeStyle = '#2563eb'; // Blue ECG line
        ctx.lineWidth = 2;
        ctx.beginPath();

        for (let i = 0; i < samplesToShow; i++) {
            const sampleIndex = startIndex + i;
            const x = i * xStep;
            const mv = convertToMv(samples[sampleIndex]);
            const y = yCenter - (mv * yScale);

            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }

        ctx.stroke();
    }, [samples, sampleRate, seconds, width, height, convertToMv]);

    // Draw scale indicators
    const drawScale = useCallback((ctx: CanvasRenderingContext2D) => {
        ctx.fillStyle = '#374151';
        ctx.font = '12px monospace';
        ctx.textAlign = 'left';

        // Time scale (seconds)
        for (let i = 0; i <= seconds; i++) {
            const x = (i / seconds) * width;
            ctx.fillText(`${i}s`, x + 5, height - 10);
        }

        // Voltage scale (mV)
        const maxMv = 2; // Show ±2mV scale
        ctx.textAlign = 'right';
        for (let mv = -maxMv; mv <= maxMv; mv += 0.5) {
            const y = (height / 2) - (mv * (height / 2) / maxMv);
            ctx.fillText(`${mv}mV`, width - 5, y + 4);
        }
    }, [width, height, seconds]);

    // Export to PNG
    const exportToPng = useCallback(() => {
        if (canvasRef.current && onPng) {
            const dataUrl = canvasRef.current.toDataURL('image/png');
            onPng(dataUrl);
        }
    }, [onPng]);

    // Render ECG
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Clear canvas
        ctx.clearRect(0, 0, width, height);

        // Draw components
        drawGrid(ctx);
        drawWaveform(ctx);
        drawScale(ctx);
    }, [samples, sampleRate, scaleUvPerLsb, seconds, width, height, drawGrid, drawWaveform, drawScale]);

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">ECG Recording</h3>
                {onPng && (
                    <button
                        onClick={exportToPng}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        Export PNG
                    </button>
                )}
            </div>
            
            <div className="border border-gray-300 rounded-lg overflow-hidden">
                <canvas
                    ref={canvasRef}
                    width={width}
                    height={height}
                    className="block w-full h-auto"
                    style={{ maxWidth: '100%', height: 'auto' }}
                />
            </div>
            
            <div className="text-sm text-gray-600 space-y-1">
                <p><strong>Sample Rate:</strong> {sampleRate} Hz</p>
                <p><strong>Scale:</strong> {scaleUvPerLsb} μV/LSB</p>
                <p><strong>Duration:</strong> {seconds} seconds</p>
                <p><strong>Total Samples:</strong> {samples?.length || 0}</p>
            </div>
        </div>
    );
};

export default EcgFinalCanvas;

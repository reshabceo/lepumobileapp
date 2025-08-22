import React, { useRef, useEffect, useCallback, useState } from 'react';

interface EcgStripCanvasProps {
  samples: Int16Array | Float32Array;
  sampleRate: number;
  scaleUvPerLsb: number;
  rows: number;
  secondsPerRow: number;
  width: number;
  height: number;
  onPng?: (dataUrl: string) => void;
  minimal?: boolean; // For live display - no title, export button, or info
}

export default function EcgStripCanvas({
  samples,
  sampleRate,
  scaleUvPerLsb,
  rows,
  secondsPerRow,
  width,
  height,
  onPng,
  minimal = false
}: EcgStripCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pxPerMm, setPxPerMm] = useState<number>(3.78); // Default fallback

  // Get device DPI to calculate px-per-mm
  useEffect(() => {
    const getDeviceDpi = () => {
      // Try to get device DPI from various sources
      if (window.devicePixelRatio) {
        // Most modern browsers
        const dpi = window.devicePixelRatio * 96; // 96 DPI is standard
        return dpi / 25.4; // Convert DPI to px-per-mm (25.4 mm = 1 inch)
      } else if ((window as any).screen && (window as any).screen.logicalXDPI) {
        // IE fallback
        const dpi = (window as any).screen.logicalXDPI;
        return dpi / 25.4;
      } else {
        // Fallback for older browsers
        return 3.78; // Approximate px-per-mm for 96 DPI
      }
    };
    
    setPxPerMm(getDeviceDpi());
  }, []);

  const convertToMv = useCallback((sample: number): number => {
    if (scaleUvPerLsb === 1.0) {
      return sample; // Already in mV
    } else {
      return (sample * scaleUvPerLsb) / 1000; // Convert μV to mV
    }
  }, [scaleUvPerLsb]);

  const drawEcgStrip = useCallback((
    ctx: CanvasRenderingContext2D,
    rowSamples: Int16Array | Float32Array,
    rowIndex: number,
    rowHeight: number,
    rowY: number
  ) => {
    const samplesPerRow = secondsPerRow * sampleRate;
    const startIndex = rowIndex * samplesPerRow;
    const endIndex = Math.min(startIndex + samplesPerRow, rowSamples.length);
    
    if (startIndex >= rowSamples.length) return;

    const rowData = rowSamples.slice(startIndex, endIndex);
    if (rowData.length === 0) return;

    // TRUE MILLIMETRE SCALING
    // Paper speed: 25mm/s (standard ECG paper)
    const paperSpeedMmPerSec = 25;
    const mmPerSecond = paperSpeedMmPerSec;
    const mmPerSample = mmPerSecond / sampleRate;
    
    // Gain: ×1 = 10mm/mV (standard ECG gain)
    const gainMmPerMv = 10;
    
    // Convert to pixels
    const pxPerMmX = pxPerMm;
    const pxPerMmY = pxPerMm;
    
    // Calculate max amplitude for grid scaling
    const maxAmplitude = Math.max(...Array.from(rowData).map(Math.abs));
    const maxMv = convertToMv(maxAmplitude);
    
    // Calculate scaling factors - NO MARGINS, fill full canvas
    const timeScale = width / (secondsPerRow * sampleRate); // Full width, no margins
    const amplitudeScale = rowHeight / (maxAmplitude * 2); // Full height, no margins

    // Draw TRUE MILLIMETRE GRID (1mm minor, 5mm major) - 35% opacity grid behind waveform
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    
    // Minor grid lines (1mm apart)
    ctx.lineWidth = 0.5;
    const minorGridMm = 1;
    
    // Vertical minor lines (1mm time intervals)
    for (let mm = 0; mm <= secondsPerRow * mmPerSecond; mm += minorGridMm) {
      const x = mm * pxPerMmX;
      if (x <= width) {
        ctx.beginPath();
        ctx.moveTo(x, rowY);
        ctx.lineTo(x, rowY + rowHeight);
        ctx.stroke();
      }
    }
    
    // Major grid lines (5mm apart)
    ctx.lineWidth = 1.0;
    const majorGridMm = 5;
    
    // Vertical major lines (5mm time intervals)
    for (let mm = 0; mm <= secondsPerRow * mmPerSecond; mm += majorGridMm) {
      const x = mm * pxPerMmX;
      if (x <= width) {
        ctx.beginPath();
        ctx.moveTo(x, rowY);
        ctx.lineTo(x, rowY + rowHeight);
        ctx.stroke();
      }
    }
    
    // Horizontal grid lines (voltage intervals)
    // At ×1 gain: 10mm = 1mV, so 1mm = 0.1mV
    const voltageStepMm = 1; // 1mm intervals
    const voltageStepMv = voltageStepMm / gainMmPerMv; // 0.1mV per 1mm
    
    // Calculate voltage range for this row
    const voltageRangeMm = maxMv * gainMmPerMv * 2; // Total range in mm
    
    // Draw horizontal grid lines
    for (let mm = 0; mm <= voltageRangeMm; mm += voltageStepMm) {
      const y = rowY + (rowHeight / 2) + (mm * pxPerMmY);
      if (y >= rowY && y <= rowY + rowHeight) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
      
      // Also draw negative voltage lines
      const yNeg = rowY + (rowHeight / 2) - (mm * pxPerMmY);
      if (yNeg >= rowY && yNeg <= rowY + rowHeight) {
        ctx.beginPath();
        ctx.moveTo(0, yNeg);
        ctx.lineTo(width, yNeg);
        ctx.stroke();
      }
    }

    // Draw ECG waveform - GREEN WAVEFORM ON BLACK
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2.0;
    ctx.beginPath();

    let firstPoint = true;
    for (let i = 0; i < rowData.length; i++) {
      const x = i * timeScale;
      const sample = convertToMv(rowData[i]);
      const y = rowY + (rowHeight / 2) - (sample * amplitudeScale);

      if (firstPoint) {
        ctx.moveTo(x, y);
        firstPoint = false;
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // Add row labels - WHITE TEXT ON BLACK
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px monospace';
    ctx.textAlign = 'left';
    
    // Time labels
    for (let i = 0; i <= secondsPerRow; i++) {
      const x = i * sampleRate * timeScale;
      ctx.fillText(`${i}s`, x + 2, rowY + rowHeight + 15);
    }

    // Amplitude labels
    ctx.textAlign = 'right';
    ctx.fillText(`${maxMv.toFixed(1)}mV`, 10, rowY + 15);
    ctx.fillText(`0mV`, 10, rowY + (rowHeight / 2) + 5);
    ctx.fillText(`-${maxMv.toFixed(1)}mV`, 10, rowY + rowHeight - 5);

    // Row info
    ctx.textAlign = 'left';
    const startTime = rowIndex * secondsPerRow;
    const endTime = Math.min((rowIndex + 1) * secondsPerRow, samples.length / sampleRate);
    ctx.fillText(`${startTime}s - ${endTime.toFixed(1)}s`, width - 50, rowY + 15);
  }, [samples, sampleRate, secondsPerRow, width, convertToMv, pxPerMm]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Set background - BLACK BACKGROUND
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);

    // Calculate row dimensions - NO MARGINS, use full height
    const rowHeight = height / rows; // Full height, no margins
    const totalDuration = samples.length / sampleRate;

    // Draw title and info - WHITE TEXT ON BLACK
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ECG Recording', width / 2, 25);

    ctx.font = '14px sans-serif';
    ctx.fillText(`Sample Rate: ${sampleRate} Hz | Scale: ${scaleUvPerLsb} ${scaleUvPerLsb === 1.0 ? 'mV/LSB' : 'μV/LSB'} | Duration: ${totalDuration.toFixed(1)}s | Total Samples: ${samples.length}`, width / 2, 45);

    // Draw each row - NO TOP MARGIN
    for (let i = 0; i < rows; i++) {
      const rowY = i * rowHeight;
      drawEcgStrip(ctx, samples, i, rowHeight, rowY);
    }

    // Border removed to fill screen fully

  }, [samples, sampleRate, scaleUvPerLsb, rows, secondsPerRow, width, height, drawEcgStrip]);

  const handleExportPng = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !onPng) return;

    const dataUrl = canvas.toDataURL('image/png');
    onPng(dataUrl);
  }, [onPng]);

  return (
    <>
      {!minimal && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">ECG Waveform</h3>
            {onPng && (
              <button
                onClick={handleExportPng}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                Export PNG
              </button>
            )}
          </div>
          
          <div className="overflow-hidden">
            <canvas
              ref={canvasRef}
              width={width}
              height={height}
              className="w-full h-auto"
              style={{ maxWidth: '100%' }}
            />
          </div>

          <div className="text-sm text-gray-600 space-y-1">
            <p><strong>Layout:</strong> {rows} rows × {secondsPerRow}s each = {rows * secondsPerRow}s total</p>
            <p><strong>Data:</strong> {samples.length} samples at {sampleRate} Hz</p>
            <p><strong>Scale:</strong> {scaleUvPerLsb} {scaleUvPerLsb === 1.0 ? 'mV/LSB' : 'μV/LSB'}</p>
          </div>
        </div>
      )}
      
      {minimal && (
        <div className="overflow-hidden">
          <canvas
            ref={canvasRef}
            width={width}
            height={height}
            className="w-full h-auto"
            style={{ maxWidth: '100%' }}
          />
        </div>
      )}
    </>
  );
}

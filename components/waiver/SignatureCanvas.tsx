'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';

// Brand green — visible on both light and dark backgrounds
const STROKE_COLOR = '#22c55e'; // green-500

interface Props {
  /** Called with a PDF-ready data URL (black strokes on white background) */
  onConfirm: (pdfDataUrl: string) => void;
  onClear?: () => void;
}

export function SignatureCanvas({ onConfirm, onClear }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const [hasStroke, setHasStroke] = useState(false);

  // Set canvas resolution (hi-DPI) and stroke style
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.strokeStyle = STROKE_COLOR;
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  const getPos = (e: MouseEvent | Touch, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const startDraw = useCallback((x: number, y: number) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    isDrawing.current = true;
    lastPos.current = { x, y };
    ctx.beginPath();
    ctx.moveTo(x, y);
  }, []);

  const draw = useCallback((x: number, y: number) => {
    if (!isDrawing.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || !lastPos.current) return;
    ctx.lineTo(x, y);
    ctx.stroke();
    lastPos.current = { x, y };
    setHasStroke(true);
  }, []);

  const stopDraw = useCallback(() => {
    isDrawing.current = false;
    lastPos.current = null;
  }, []);

  // Mouse events
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onDown  = (e: MouseEvent) => { e.preventDefault(); const p = getPos(e, canvas); startDraw(p.x, p.y); };
    const onMove  = (e: MouseEvent) => { e.preventDefault(); const p = getPos(e, canvas); draw(p.x, p.y); };
    const onUp    = () => stopDraw();
    canvas.addEventListener('mousedown', onDown);
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mouseup', onUp);
    canvas.addEventListener('mouseleave', onUp);
    return () => {
      canvas.removeEventListener('mousedown', onDown);
      canvas.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('mouseup', onUp);
      canvas.removeEventListener('mouseleave', onUp);
    };
  }, [startDraw, draw, stopDraw]);

  // Touch events
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onStart = (e: TouchEvent) => { e.preventDefault(); const p = getPos(e.touches[0], canvas); startDraw(p.x, p.y); };
    const onMove  = (e: TouchEvent) => { e.preventDefault(); const p = getPos(e.touches[0], canvas); draw(p.x, p.y); };
    const onEnd   = () => stopDraw();
    canvas.addEventListener('touchstart', onStart, { passive: false });
    canvas.addEventListener('touchmove',  onMove,  { passive: false });
    canvas.addEventListener('touchend',   onEnd);
    return () => {
      canvas.removeEventListener('touchstart', onStart);
      canvas.removeEventListener('touchmove',  onMove);
      canvas.removeEventListener('touchend',   onEnd);
    };
  }, [startDraw, draw, stopDraw]);

  const handleClear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width * dpr, rect.height * dpr);
    setHasStroke(false);
    onClear?.();
  };

  const handleConfirm = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasStroke) return;

    // Build a PDF-ready version: white background + black strokes
    const offscreen = document.createElement('canvas');
    offscreen.width = canvas.width;
    offscreen.height = canvas.height;
    const ctx = offscreen.getContext('2d');
    if (!ctx) return;

    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, offscreen.width, offscreen.height);

    // Draw the original strokes on top
    ctx.drawImage(canvas, 0, 0);

    // Convert stroke pixels to black. After compositing green strokes over the white fill,
    // ALL pixels have a=255 — so we check color (non-white = stroke) instead of alpha.
    const imgData = ctx.getImageData(0, 0, offscreen.width, offscreen.height);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      // Pure white background pixels have all channels near 255.
      // Stroke pixels (#22c55e = rgb(34,197,94)) and anti-aliased blends have at least one channel < 240.
      const isStroke = r < 240 || g < 240 || b < 240;
      if (isStroke) {
        d[i] = 0; d[i + 1] = 0; d[i + 2] = 0; d[i + 3] = 255;
      } else {
        d[i] = 255; d[i + 1] = 255; d[i + 2] = 255; d[i + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);

    onConfirm(offscreen.toDataURL('image/png'));
  };

  return (
    <div className="space-y-3">
      {/* Canvas area — always a crisp white surface so the green stands out on any theme */}
      <div className="relative rounded-xl border-2 border-green-500/40 bg-white overflow-hidden shadow-inner">
        <canvas
          ref={canvasRef}
          className="w-full touch-none cursor-crosshair"
          style={{ height: '150px', display: 'block' }}
        />
        {!hasStroke && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <p className="text-sm text-gray-400 select-none italic">Draw your signature here</p>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleClear}
          className="border-border text-foreground hover:bg-muted"
        >
          Clear
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={handleConfirm}
          disabled={!hasStroke}
          className="flex-1 bg-green-600 hover:bg-green-700 text-white disabled:opacity-40"
        >
          Confirm Signature
        </Button>
      </div>
    </div>
  );
}

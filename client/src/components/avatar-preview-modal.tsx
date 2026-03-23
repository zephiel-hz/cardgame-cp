import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

interface AvatarPreviewModalProps {
  isOpen: boolean;
  imageData: string;
  onConfirm: (croppedData: string) => void;
  onCancel: () => void;
}

// Fixed canvas and preview sizes
const CANVAS_SIZE_DESKTOP = 380;
const CANVAS_SIZE_MOBILE = 200;
const PREVIEW_SIZE_DESKTOP = 180;
const PREVIEW_SIZE_MOBILE = 96;

export function AvatarPreviewModal({
  isOpen,
  imageData,
  onConfirm,
  onCancel,
}: AvatarPreviewModalProps) {
  const isMobileDevice = useIsMobile();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const imageRef = useRef<HTMLImageElement | null>(null);

  const CANVAS_SIZE = isMobileDevice ? CANVAS_SIZE_MOBILE : CANVAS_SIZE_DESKTOP;
  const PREVIEW_SIZE = isMobileDevice ? PREVIEW_SIZE_MOBILE : PREVIEW_SIZE_DESKTOP;

  // Load image
  useEffect(() => {
    if (!isOpen || !imageData) return;

    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      // Calculate optimal zoom to fit image at natural size without being too large
      const scale = Math.min(CANVAS_SIZE / img.width, CANVAS_SIZE / img.height);
      const initialZoom = Math.min(scale, 1); // Don't zoom in, only zoom out if needed
      setZoom(initialZoom);
      setPanX(0);
      setPanY(0);
      redrawCanvas(img, initialZoom, 0, 0);
    };
    img.src = imageData;
  }, [isOpen, imageData, CANVAS_SIZE]);

  // Redraw canvas when device breakpoint changes
  useEffect(() => {
    if (imageRef.current) {
      redrawCanvas(imageRef.current, zoom, panX, panY);
    }
  }, [isMobileDevice]);

  // Update preview in real-time when zoom or pan changes
  useEffect(() => {
    if (imageRef.current && previewCanvasRef.current) {
      generatePreview(imageRef.current, zoom, panX, panY);
    }
  }, [zoom, panX, panY, PREVIEW_SIZE]);

  // Redraw canvas with current transform
  const redrawCanvas = (
    img: HTMLImageElement,
    z: number,
    px: number,
    py: number
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = "rgb(243, 244, 246)";
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // Draw grid background for reference
    ctx.strokeStyle = "rgb(209, 213, 219)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= CANVAS_SIZE; i += CANVAS_SIZE / 4) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, CANVAS_SIZE);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(CANVAS_SIZE, i);
      ctx.stroke();
    }

    // Save context
    ctx.save();

    // Translate to center
    ctx.translate(CANVAS_SIZE / 2 + px, CANVAS_SIZE / 2 + py);

    // Scale
    ctx.scale(z, z);

    // Draw image centered
    ctx.drawImage(
      img,
      -img.width / 2,
      -img.height / 2,
      img.width,
      img.height
    );

    ctx.restore();

    // Draw center crosshair
    ctx.strokeStyle = "rgb(239, 68, 68)";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(CANVAS_SIZE / 2 - 20, CANVAS_SIZE / 2);
    ctx.lineTo(CANVAS_SIZE / 2 + 20, CANVAS_SIZE / 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(CANVAS_SIZE / 2, CANVAS_SIZE / 2 - 20);
    ctx.lineTo(CANVAS_SIZE / 2, CANVAS_SIZE / 2 + 20);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw preview circle outline
    ctx.strokeStyle = "rgb(59, 130, 246)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(CANVAS_SIZE / 2, CANVAS_SIZE / 2, PREVIEW_SIZE / 2, 0, Math.PI * 2);
    ctx.stroke();

    // Draw circular preview on the right
    generatePreview(img, z, px, py);
  };

  // Generate circular preview
  const generatePreview = (
    img: HTMLImageElement,
    z: number,
    px: number,
    py: number
  ) => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas completely
    ctx.clearRect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE);

    // Create circular clipping path first
    ctx.save();
    ctx.beginPath();
    ctx.arc(PREVIEW_SIZE / 2, PREVIEW_SIZE / 2, PREVIEW_SIZE / 2, 0, Math.PI * 2);
    ctx.clip();

    // Crop area (180×180) maps directly to preview canvas (180×180)
    // So pan offset is 1:1, NO scaling needed
    // (Crop area on main canvas is 90-px-radius circle, same as preview)

    // Draw image inside the clipped circular area
    ctx.translate(PREVIEW_SIZE / 2 + px, PREVIEW_SIZE / 2 + py);
    ctx.scale(z, z);

    // Draw image centered (same as canvas rendering)
    ctx.drawImage(
      img,
      -img.width / 2,
      -img.height / 2,
      img.width,
      img.height
    );

    ctx.restore();
  };

  // Handle wheel zoom
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const newZoom = zoom - (e.deltaY > 0 ? 0.1 : -0.1);
    const clampedZoom = Math.max(0.05, Math.min(3, newZoom));
    setZoom(clampedZoom);
    if (imageRef.current) {
      redrawCanvas(imageRef.current, clampedZoom, panX, panY);
    }
  };

  // No scale factor needed - canvas display size = internal size

  // Handle mouse down for panning
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  // Handle mouse move for panning
  // Handle mouse move for panning
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || !imageRef.current) return;

    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;

    setPanX((px) => px + dx);
    setPanY((py) => py + dy);
    setDragStart({ x: e.clientX, y: e.clientY });

    redrawCanvas(imageRef.current, zoom, panX + dx, panY + dy);
  };

  // Handle mouse up
  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch tracking for multi-touch gestures
  const touchStartRef = useRef<{ x: number; y: number; distance: number } | null>(null);

  // Handle touch start
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      const touch = e.touches[0];
      setDragStart({ x: touch.clientX, y: touch.clientY });
      touchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        distance: 0,
      };
    } else if (e.touches.length === 2) {
      // Pinch zoom
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      touchStartRef.current = {
        x: (touch1.clientX + touch2.clientX) / 2,
        y: (touch1.clientY + touch2.clientY) / 2,
        distance,
      };
      setIsDragging(false);
    }
  };

  // Handle touch move
  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!imageRef.current || !touchStartRef.current) return;

    if (e.touches.length === 1) {
      // Single finger drag for pan
      const touch = e.touches[0];
      const dx = touch.clientX - dragStart.x;
      const dy = touch.clientY - dragStart.y;

      setPanX((px) => px + dx);
      setPanY((py) => py + dy);
      setDragStart({ x: touch.clientX, y: touch.clientY });

      redrawCanvas(imageRef.current, zoom, panX + dx, panY + dy);
    } else if (e.touches.length === 2) {
      // Pinch zoom
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );

      const prevDistance = touchStartRef.current.distance;
      if (prevDistance > 0) {
        const scale = distance / prevDistance;
        const newZoom = zoom * scale;
        const clampedZoom = Math.max(0.05, Math.min(3, newZoom));
        setZoom(clampedZoom);
        redrawCanvas(imageRef.current, clampedZoom, panX, panY);
      }

      touchStartRef.current.distance = distance;
    }
  };

  // Handle touch end
  const handleTouchEnd = () => {
    setIsDragging(false);
    touchStartRef.current = null;
  };

  // Handle zoom button
  const handleZoomChange = (newZoom: number) => {
    const clampedZoom = Math.max(0.05, Math.min(3, newZoom));
    setZoom(clampedZoom);
    if (imageRef.current) {
      redrawCanvas(imageRef.current, clampedZoom, panX, panY);
    }
  };

  // Reset
  const handleReset = () => {
    setZoom(1);
    setPanX(0);
    setPanY(0);
    if (imageRef.current) {
      redrawCanvas(imageRef.current, 1, 0, 0);
    }
  };

  // Confirm and crop
  const handleConfirm = async () => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;

    // Create a square canvas for avatar
    const squareCanvas = document.createElement("canvas");
    squareCanvas.width = 512;
    squareCanvas.height = 512;
    const ctx = squareCanvas.getContext("2d");
    if (!ctx) return;

    // Fill background
    ctx.fillStyle = "rgb(243, 244, 246)";
    ctx.fillRect(0, 0, 512, 512);

    // Draw the preview image into the square canvas (sized appropriately)
    // The preview is circular, so we'll draw it with some padding
    const scaleFactor = 512 / PREVIEW_SIZE;
    ctx.save();
    ctx.translate(256, 256);
    ctx.beginPath();
    ctx.arc(0, 0, 256, 0, Math.PI * 2);
    ctx.clip();
    ctx.translate(-256, -256);
    const previewCtx = previewCanvasRef.current?.getContext("2d");
    if (previewCtx) {
      ctx.drawImage(previewCanvasRef.current as HTMLCanvasElement, 0, 0, PREVIEW_SIZE, PREVIEW_SIZE, 0, 0, 512, 512);
    }
    ctx.restore();

    // Convert to data URL
    const croppedData = squareCanvas.toDataURL("image/png");
    onConfirm(croppedData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-sm md:max-w-2xl lg:max-w-4xl w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-4 md:p-6 gap-4 rounded-xl">
        <DialogHeader className="mb-2">
          <DialogTitle className="text-base md:text-lg font-bold text-slate-900 dark:text-white">
            ✨ Sesuaikan Avatar
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto max-h-[80vh]">
          {/* Canvas area */}
          <div className="flex flex-col lg:flex-row gap-4 justify-center lg:justify-start items-center lg:items-start">
            {/* Main canvas */}
            <div className="flex flex-col items-center gap-2 flex-shrink-0">
              <div className="relative group flex-shrink-0" style={{ width: `${CANVAS_SIZE}px`, height: `${CANVAS_SIZE}px` }}>
                <div className="absolute inset-0 bg-gradient-to-r from-pink-400 to-purple-400 rounded-lg blur opacity-0 group-hover:opacity-75 transition duration-300"></div>
                <div className="relative border-2 border-slate-300 dark:border-slate-600 rounded-lg overflow-hidden bg-white dark:bg-slate-800 shadow-lg hover:shadow-xl transition-shadow w-full h-full">
                  <canvas
                    ref={canvasRef}
                    width={CANVAS_SIZE}
                    height={CANVAS_SIZE}
                    onWheel={handleWheel}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    className="cursor-grab active:cursor-grabbing block touch-none"
                    style={{
                      width: `${CANVAS_SIZE}px`,
                      height: `${CANVAS_SIZE}px`,
                      display: "block",
                    }}
                  />
                </div>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium text-center">
                {isMobileDevice ? "👆 Drag & Pinch to adjust" : "🖱️ Scroll to zoom • Drag to move"}
              </p>
            </div>

            {/* Preview - Always show on desktop, below on mobile */}
            {!isMobileDevice && (
              <div className="flex flex-col items-center gap-2 flex-shrink-0">
                <div className="relative group flex-shrink-0" style={{ width: `${PREVIEW_SIZE}px`, height: `${PREVIEW_SIZE}px` }}>
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-cyan-400 rounded-lg blur opacity-0 hover:opacity-50 transition duration-300"></div>
                  <div className="relative border-2 border-slate-300 dark:border-slate-600 rounded-lg overflow-hidden bg-white dark:bg-slate-800 shadow-lg w-full h-full">
                    <canvas
                      ref={previewCanvasRef}
                      width={PREVIEW_SIZE}
                      height={PREVIEW_SIZE}
                      className="block"
                      style={{
                        width: `${PREVIEW_SIZE}px`,
                        height: `${PREVIEW_SIZE}px`,
                        display: "block",
                      }}
                    />
                  </div>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  Preview
                </p>
              </div>
            )}
          </div>

          {/* Mobile Preview Below */}
          {isMobileDevice && (
            <div className="flex justify-center">
              <div className="flex flex-col items-center gap-1 flex-shrink-0">
                <div className="relative flex-shrink-0" style={{ width: `${PREVIEW_SIZE}px`, height: `${PREVIEW_SIZE}px` }}>
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-cyan-400 rounded-lg blur opacity-0 hover:opacity-50 transition duration-300"></div>
                  <div className="relative border-2 border-slate-300 dark:border-slate-600 rounded-lg overflow-hidden bg-white dark:bg-slate-800 w-full h-full">
                    <canvas
                      ref={previewCanvasRef}
                      width={PREVIEW_SIZE}
                      height={PREVIEW_SIZE}
                      className="block"
                      style={{
                        width: `${PREVIEW_SIZE}px`,
                        height: `${PREVIEW_SIZE}px`,
                        display: "block",
                      }}
                    />
                  </div>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Preview</p>
              </div>
            </div>
          )}

          {/* Controls */}
          <div className="space-y-2 md:space-y-3 bg-slate-50 dark:bg-slate-800 p-3 md:p-4 rounded-lg border border-slate-200 dark:border-slate-700">
            {/* Zoom Slider */}
            <div className="space-y-1.5">
              <label className="text-xs md:text-sm font-bold text-foreground flex items-center gap-1.5">
                <ZoomIn size={16} />
                Zoom: {(zoom * 100).toFixed(0)}%
              </label>
              <Slider
                value={[zoom]}
                onValueChange={([newZoom]) => handleZoomChange(newZoom)}
                min={0.05}
                max={3}
                step={0.05}
                className="w-full"
              />
            </div>

            {/* Zoom buttons */}
            <div className="flex gap-1.5 justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleZoomChange(zoom - 0.2)}
                className={`${isMobileDevice ? "h-8 w-8 p-0" : "flex items-center gap-1"} flex items-center justify-center transition-all hover:bg-slate-100 dark:hover:bg-slate-700`}
                title="Zoom out"
              >
                <ZoomOut size={16} />
                {!isMobileDevice && <span>−</span>}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleZoomChange(zoom + 0.2)}
                className={`${isMobileDevice ? "h-8 w-8 p-0" : "flex items-center gap-1"} flex items-center justify-center transition-all hover:bg-slate-100 dark:hover:bg-slate-700`}
                title="Zoom in"
              >
                <ZoomIn size={16} />
                {!isMobileDevice && <span>+</span>}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                className={`${isMobileDevice ? "h-8 w-8 p-0" : "flex items-center gap-1"} flex items-center justify-center transition-all hover:bg-slate-100 dark:hover:bg-slate-700`}
                title="Reset"
              >
                <RotateCcw size={16} />
                {!isMobileDevice && <span>Reset</span>}
              </Button>
            </div>

            {/* Info */}
            <p className="text-xs text-slate-600 dark:text-slate-300 font-medium bg-blue-50 dark:bg-blue-950/40 p-2 rounded border border-blue-200/50 dark:border-blue-800/50">
              ℹ️ Center your image in the circle below
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 md:gap-3 mt-4 flex flex-col-reverse xs:flex-row">
          <Button 
            variant="outline" 
            onClick={onCancel} 
            className="w-full text-xs md:text-sm py-2 md:py-2.5 transition-all hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            ❌ Batal
          </Button>
          <Button
            onClick={handleConfirm}
            className="w-full text-xs md:text-sm py-2 md:py-2.5 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white font-bold transition-all shadow-md hover:shadow-lg"
          >
            ✨ Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

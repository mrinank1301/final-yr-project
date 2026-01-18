"use client";

import { 
  X, 
  Pen, 
  Eraser, 
  Type, 
  Square, 
  Circle, 
  Minus, 
  Download, 
  Trash2, 
  Undo2, 
  Redo2,
  MousePointer2,
  Highlighter,
  Move,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2
} from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";

interface WhiteboardSidebarProps {
  onClose: () => void;
}

type Tool = "select" | "pen" | "highlighter" | "eraser" | "text" | "rectangle" | "circle" | "line" | "pan";

interface Point {
  x: number;
  y: number;
}

interface DrawAction {
  tool: Tool;
  points: Point[];
  color: string;
  size: number;
  opacity: number;
  text?: string;
  startPoint?: Point;
  endPoint?: Point;
}

const COLORS = [
  "#000000", // Black
  "#374151", // Gray
  "#EF4444", // Red
  "#F97316", // Orange
  "#EAB308", // Yellow
  "#22C55E", // Green
  "#06B6D4", // Cyan
  "#3B82F6", // Blue
  "#8B5CF6", // Purple
  "#EC4899", // Pink
  "#FFFFFF", // White
];

const STROKE_SIZES = [2, 4, 6, 8, 12, 16];

export function WhiteboardSidebar({ onClose }: WhiteboardSidebarProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState("#000000");
  const [strokeSize, setStrokeSize] = useState(4);
  const [isDrawing, setIsDrawing] = useState(false);
  const [actions, setActions] = useState<DrawAction[]>([]);
  const [redoStack, setRedoStack] = useState<DrawAction[]>([]);
  const [currentAction, setCurrentAction] = useState<DrawAction | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [lastPanPoint, setLastPanPoint] = useState<Point | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [textPosition, setTextPosition] = useState<Point | null>(null);
  const [showTextInput, setShowTextInput] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  // Initialize canvas size
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      
      // Set canvas size (2x for retina)
      canvas.width = width * 2;
      canvas.height = height * 2;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      
      setCanvasSize({ width, height });
    };

    updateSize();
    
    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(container);
    
    return () => resizeObserver.disconnect();
  }, [isFullScreen]);

  // Draw grid
  const drawGrid = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const gridSize = 20;
    ctx.strokeStyle = "#E5E7EB";
    ctx.lineWidth = 0.5 / zoom;

    const startX = Math.floor(-pan.x / zoom / gridSize) * gridSize;
    const startY = Math.floor(-pan.y / zoom / gridSize) * gridSize;
    const endX = startX + width / zoom + gridSize * 2;
    const endY = startY + height / zoom + gridSize * 2;

    for (let x = startX; x < endX; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, startY);
      ctx.lineTo(x, endY);
      ctx.stroke();
    }

    for (let y = startY; y < endY; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(startX, y);
      ctx.lineTo(endX, y);
      ctx.stroke();
    }
  }, [zoom, pan]);

  // Draw a single action
  const drawAction = useCallback((ctx: CanvasRenderingContext2D, action: DrawAction) => {
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (action.tool === "pen" || action.tool === "highlighter") {
      ctx.strokeStyle = action.color;
      ctx.lineWidth = action.size;
      ctx.globalAlpha = action.opacity;

      if (action.points.length > 1) {
        ctx.beginPath();
        ctx.moveTo(action.points[0].x, action.points[0].y);
        
        for (let i = 1; i < action.points.length; i++) {
          const midPoint = {
            x: (action.points[i].x + action.points[i - 1].x) / 2,
            y: (action.points[i].y + action.points[i - 1].y) / 2,
          };
          ctx.quadraticCurveTo(action.points[i - 1].x, action.points[i - 1].y, midPoint.x, midPoint.y);
        }
        ctx.stroke();
      } else if (action.points.length === 1) {
        // Draw a dot for single click
        ctx.beginPath();
        ctx.arc(action.points[0].x, action.points[0].y, action.size / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    } else if (action.tool === "eraser") {
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = action.size * 2;
      ctx.globalAlpha = 1;

      if (action.points.length > 1) {
        ctx.beginPath();
        ctx.moveTo(action.points[0].x, action.points[0].y);
        
        for (let i = 1; i < action.points.length; i++) {
          ctx.lineTo(action.points[i].x, action.points[i].y);
        }
        ctx.stroke();
      }
    } else if (action.tool === "text" && action.text && action.startPoint) {
      ctx.fillStyle = action.color;
      ctx.font = `${action.size * 4}px 'Segoe UI', sans-serif`;
      ctx.globalAlpha = 1;
      ctx.fillText(action.text, action.startPoint.x, action.startPoint.y);
    } else if (action.tool === "rectangle" && action.startPoint && action.endPoint) {
      ctx.strokeStyle = action.color;
      ctx.lineWidth = action.size;
      ctx.globalAlpha = action.opacity;
      
      const width = action.endPoint.x - action.startPoint.x;
      const height = action.endPoint.y - action.startPoint.y;
      ctx.strokeRect(action.startPoint.x, action.startPoint.y, width, height);
      ctx.globalAlpha = 1;
    } else if (action.tool === "circle" && action.startPoint && action.endPoint) {
      ctx.strokeStyle = action.color;
      ctx.lineWidth = action.size;
      ctx.globalAlpha = action.opacity;
      
      const radiusX = Math.abs(action.endPoint.x - action.startPoint.x) / 2;
      const radiusY = Math.abs(action.endPoint.y - action.startPoint.y) / 2;
      const centerX = action.startPoint.x + (action.endPoint.x - action.startPoint.x) / 2;
      const centerY = action.startPoint.y + (action.endPoint.y - action.startPoint.y) / 2;
      
      ctx.beginPath();
      ctx.ellipse(centerX, centerY, Math.max(radiusX, 1), Math.max(radiusY, 1), 0, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (action.tool === "line" && action.startPoint && action.endPoint) {
      ctx.strokeStyle = action.color;
      ctx.lineWidth = action.size;
      ctx.globalAlpha = action.opacity;
      
      ctx.beginPath();
      ctx.moveTo(action.startPoint.x, action.startPoint.y);
      ctx.lineTo(action.endPoint.x, action.endPoint.y);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }, []);

  // Redraw canvas
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || canvasSize.width === 0) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Reset transform and clear
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Apply 2x scale for retina, then zoom and pan
    ctx.setTransform(2 * zoom, 0, 0, 2 * zoom, pan.x * 2, pan.y * 2);

    // Draw grid
    drawGrid(ctx, canvasSize.width, canvasSize.height);

    // Draw all completed actions
    actions.forEach(action => {
      drawAction(ctx, action);
    });

    // Draw current action being drawn
    if (currentAction) {
      drawAction(ctx, currentAction);
    }
  }, [actions, currentAction, zoom, pan, canvasSize, drawGrid, drawAction]);

  // Redraw when anything changes
  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  // Get canvas coordinates from mouse/touch event
  const getCanvasCoordinates = useCallback((e: React.MouseEvent | React.TouchEvent): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    let clientX: number, clientY: number;

    if ("touches" in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if ("clientX" in e) {
      clientX = e.clientX;
      clientY = e.clientY;
    } else {
      return { x: 0, y: 0 };
    }

    // Convert screen coordinates to canvas coordinates
    return {
      x: (clientX - rect.left - pan.x) / zoom,
      y: (clientY - rect.top - pan.y) / zoom,
    };
  }, [pan, zoom]);

  // Handle mouse/touch down
  const handleStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const point = getCanvasCoordinates(e);

    if (tool === "pan") {
      setIsPanning(true);
      setLastPanPoint({ x: ("touches" in e ? e.touches[0].clientX : e.clientX), y: ("touches" in e ? e.touches[0].clientY : e.clientY) });
      return;
    }

    if (tool === "select") {
      return;
    }

    if (tool === "text") {
      setTextPosition(point);
      setShowTextInput(true);
      return;
    }

    setIsDrawing(true);
    setRedoStack([]);

    const newAction: DrawAction = {
      tool,
      points: [point],
      color,
      size: strokeSize,
      opacity: tool === "highlighter" ? 0.4 : 1,
      startPoint: point,
      endPoint: point,
    };

    setCurrentAction(newAction);
  }, [tool, color, strokeSize, getCanvasCoordinates]);

  // Handle mouse/touch move
  const handleMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (isPanning && lastPanPoint) {
      const clientX = "touches" in e && e.touches.length > 0 ? e.touches[0].clientX : ("clientX" in e ? e.clientX : 0);
      const clientY = "touches" in e && e.touches.length > 0 ? e.touches[0].clientY : ("clientY" in e ? e.clientY : 0);
      
      const dx = clientX - lastPanPoint.x;
      const dy = clientY - lastPanPoint.y;
      
      setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      setLastPanPoint({ x: clientX, y: clientY });
      return;
    }

    if (!isDrawing || !currentAction) return;

    const point = getCanvasCoordinates(e);

    if (tool === "pen" || tool === "highlighter" || tool === "eraser") {
      setCurrentAction(prev => prev ? {
        ...prev,
        points: [...prev.points, point],
      } : null);
    } else if (tool === "rectangle" || tool === "circle" || tool === "line") {
      setCurrentAction(prev => prev ? {
        ...prev,
        endPoint: point,
      } : null);
    }
  }, [isPanning, lastPanPoint, isDrawing, currentAction, tool, getCanvasCoordinates]);

  // Handle mouse/touch up
  const handleEnd = useCallback(() => {
    if (isPanning) {
      setIsPanning(false);
      setLastPanPoint(null);
      return;
    }

    if (isDrawing && currentAction) {
      setActions(prev => [...prev, currentAction]);
      setCurrentAction(null);
    }
    setIsDrawing(false);
  }, [isPanning, isDrawing, currentAction]);

  // Handle text input
  const handleTextSubmit = () => {
    if (textInput && textPosition) {
      const textAction: DrawAction = {
        tool: "text",
        points: [],
        color,
        size: strokeSize,
        opacity: 1,
        text: textInput,
        startPoint: textPosition,
      };
      setActions(prev => [...prev, textAction]);
      setRedoStack([]);
    }
    setShowTextInput(false);
    setTextInput("");
    setTextPosition(null);
  };

  // Undo
  const handleUndo = () => {
    if (actions.length === 0) return;
    const lastAction = actions[actions.length - 1];
    setActions(prev => prev.slice(0, -1));
    setRedoStack(prev => [...prev, lastAction]);
  };

  // Redo
  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const lastRedo = redoStack[redoStack.length - 1];
    setRedoStack(prev => prev.slice(0, -1));
    setActions(prev => [...prev, lastRedo]);
  };

  // Clear canvas
  const handleClear = () => {
    setActions([]);
    setRedoStack([]);
    setCurrentAction(null);
  };

  // Download canvas
  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement("a");
    link.download = `whiteboard_${new Date().toISOString().slice(0, 10)}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  // Zoom controls
  const handleZoomIn = () => setZoom(prev => Math.min(prev * 1.2, 3));
  const handleZoomOut = () => setZoom(prev => Math.max(prev / 1.2, 0.5));
  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const tools: { id: Tool; icon: React.ReactNode; label: string }[] = [
    { id: "select", icon: <MousePointer2 className="w-4 h-4" />, label: "Select" },
    { id: "pen", icon: <Pen className="w-4 h-4" />, label: "Pen" },
    { id: "highlighter", icon: <Highlighter className="w-4 h-4" />, label: "Highlighter" },
    { id: "eraser", icon: <Eraser className="w-4 h-4" />, label: "Eraser" },
    { id: "text", icon: <Type className="w-4 h-4" />, label: "Text" },
    { id: "line", icon: <Minus className="w-4 h-4" />, label: "Line" },
    { id: "rectangle", icon: <Square className="w-4 h-4" />, label: "Rectangle" },
    { id: "circle", icon: <Circle className="w-4 h-4" />, label: "Circle" },
    { id: "pan", icon: <Move className="w-4 h-4" />, label: "Pan" },
  ];

  return (
    <div className={`flex flex-col h-full bg-gray-900 ${isFullScreen ? 'fixed inset-0 z-50' : ''}`}>
      {/* Header */}
      <div className="p-3 border-b border-gray-800 flex justify-between items-center bg-gray-900 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-pink-500 to-rose-600 rounded-lg flex items-center justify-center shadow-lg shadow-rose-500/20">
            <Pen className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-white text-sm">Whiteboard</h3>
            <span className="text-xs text-gray-400">OneNote Style</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsFullScreen(!isFullScreen)}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
            title={isFullScreen ? "Exit Fullscreen" : "Fullscreen"}
          >
            {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="p-2 border-b border-gray-800 bg-gray-900/95 backdrop-blur-sm space-y-2 shrink-0">
        {/* Tools Row */}
        <div className="flex flex-wrap gap-1">
          {tools.map(t => (
            <button
              key={t.id}
              onClick={() => setTool(t.id)}
              title={t.label}
              className={`p-2 rounded-lg transition-all ${
                tool === t.id
                  ? "bg-rose-500 text-white shadow-lg shadow-rose-500/30"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white"
              }`}
            >
              {t.icon}
            </button>
          ))}
          
          <div className="w-px h-8 bg-gray-700 mx-1 self-center" />
          
          {/* Undo/Redo */}
          <button
            onClick={handleUndo}
            disabled={actions.length === 0}
            title="Undo"
            className="p-2 rounded-lg bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            title="Redo"
            className="p-2 rounded-lg bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <Redo2 className="w-4 h-4" />
          </button>
          
          <div className="w-px h-8 bg-gray-700 mx-1 self-center" />
          
          {/* Zoom */}
          <button
            onClick={handleZoomOut}
            title="Zoom Out"
            className="p-2 rounded-lg bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white transition-all"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={handleResetZoom}
            title="Reset Zoom"
            className="px-2 py-1 rounded-lg bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white text-xs font-mono transition-all"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            onClick={handleZoomIn}
            title="Zoom In"
            className="p-2 rounded-lg bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white transition-all"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>

        {/* Colors Row */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Color:</span>
          <div className="flex gap-1">
            {COLORS.map(c => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-6 h-6 rounded-full border-2 transition-all ${
                  color === c 
                    ? "border-white scale-110 shadow-lg" 
                    : "border-gray-600 hover:border-gray-400"
                }`}
                style={{ backgroundColor: c }}
                title={c}
              />
            ))}
          </div>
        </div>

        {/* Stroke Size Row */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Size:</span>
          <div className="flex gap-1">
            {STROKE_SIZES.map(size => (
              <button
                key={size}
                onClick={() => setStrokeSize(size)}
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                  strokeSize === size
                    ? "bg-rose-500 text-white"
                    : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                }`}
                title={`${size}px`}
              >
                <div
                  className="rounded-full bg-current"
                  style={{ width: Math.max(size, 4), height: Math.max(size, 4) }}
                />
              </button>
            ))}
          </div>
        </div>

        {/* Actions Row */}
        <div className="flex gap-1">
          <button
            onClick={handleClear}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 text-red-400 hover:bg-red-500/20 transition-all text-xs"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 transition-all text-xs"
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </button>
        </div>
      </div>

      {/* Canvas Area */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-hidden relative min-h-0"
        style={{ 
          cursor: tool === "pan" ? (isPanning ? "grabbing" : "grab") : tool === "text" ? "text" : "crosshair",
          backgroundColor: "#FFFFFF"
        }}
      >
        <canvas
          ref={canvasRef}
          onMouseDown={handleStart}
          onMouseMove={handleMove}
          onMouseUp={handleEnd}
          onMouseLeave={handleEnd}
          onTouchStart={handleStart}
          onTouchMove={handleMove}
          onTouchEnd={handleEnd}
          className="touch-none absolute inset-0"
          style={{ touchAction: "none" }}
        />
        
        {/* Text Input Overlay */}
        {showTextInput && textPosition && (
          <div
            className="absolute bg-white border-2 border-rose-500 rounded shadow-lg z-10"
            style={{
              left: textPosition.x * zoom + pan.x,
              top: textPosition.y * zoom + pan.y,
            }}
          >
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleTextSubmit();
                if (e.key === "Escape") {
                  setShowTextInput(false);
                  setTextInput("");
                }
              }}
              onBlur={handleTextSubmit}
              autoFocus
              placeholder="Type here..."
              className="px-2 py-1 text-sm outline-none min-w-[100px]"
              style={{ 
                color, 
                fontSize: `${strokeSize * 4}px`,
                fontFamily: "'Segoe UI', sans-serif"
              }}
            />
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-2 border-t border-gray-800 bg-gray-900 flex items-center justify-between text-xs text-gray-500 shrink-0">
        <span>
          {actions.length} stroke{actions.length !== 1 ? 's' : ''} • {tool.charAt(0).toUpperCase() + tool.slice(1)} tool
        </span>
        <span>
          Click and drag to draw
        </span>
      </div>
    </div>
  );
}

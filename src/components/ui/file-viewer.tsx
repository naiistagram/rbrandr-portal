"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  X, Pen, Download, Save, ChevronLeft, ChevronRight, Undo, Circle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type PenAnnotation = { type: "pen"; points: [number, number][]; color: string };
type CircleAnnotation = { type: "circle"; cx: number; cy: number; rx: number; ry: number; color: string };
type Annotation = PenAnnotation | CircleAnnotation;

const COLORS = ["#ef4444", "#f59e0b", "#3b82f6", "#10b981", "#ffffff"];

function isPDF(url: string) {
  return /\.pdf($|\?)/i.test(url) || url.includes("/object/public/contracts/") || url.includes("/object/public/reports/");
}

function isAnnotationFile(url: string) {
  return url.includes("annotation-") && url.endsWith(".png");
}

export function FileViewer({
  files,
  initialIndex = 0,
  contentId,
  onClose,
  onAnnotationSaved,
  readOnly = false,
}: {
  files: string[];
  initialIndex?: number;
  contentId: string;
  onClose: () => void;
  onAnnotationSaved?: (newUrls: string[]) => void;
  readOnly?: boolean;
}) {
  const [index, setIndex] = useState(Math.min(initialIndex, files.length - 1));
  const [annotating, setAnnotating] = useState(false);
  const [tool, setTool] = useState<"circle" | "pen">("circle");
  const [color, setColor] = useState(COLORS[0]);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [startPct, setStartPct] = useState<[number, number] | null>(null);
  const [currentAnn, setCurrentAnn] = useState<Annotation | null>(null);
  const [saving, setSaving] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  const currentFile = files[index] ?? "";
  const fileIsPDF = isPDF(currentFile);
  const fileIsAnnotation = isAnnotationFile(currentFile);

  // Size canvas to container whenever annotating or index changes
  useEffect(() => {
    if (!annotating) return;
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const size = () => {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      redraw();
    };
    size();
    const ro = new ResizeObserver(size);
    ro.observe(container);
    return () => ro.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [annotating, index]);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const drawOne = (ann: Annotation) => {
      ctx.strokeStyle = ann.color;
      ctx.lineWidth = Math.max(2, W * 0.003);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.shadowColor = "rgba(0,0,0,0.6)";
      ctx.shadowBlur = 3;
      if (ann.type === "pen" && ann.points.length > 1) {
        ctx.beginPath();
        ctx.moveTo(ann.points[0][0] * W, ann.points[0][1] * H);
        for (let i = 1; i < ann.points.length; i++) {
          ctx.lineTo(ann.points[i][0] * W, ann.points[i][1] * H);
        }
        ctx.stroke();
      } else if (ann.type === "circle") {
        ctx.beginPath();
        ctx.ellipse(ann.cx * W, ann.cy * H, ann.rx * W, ann.ry * H, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    };

    annotations.forEach(drawOne);
    if (currentAnn) drawOne(currentAnn);
  }, [annotations, currentAnn]);

  useEffect(() => { redraw(); }, [redraw]);

  function pct(e: React.MouseEvent, canvas: HTMLCanvasElement): [number, number] {
    const r = canvas.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
  }

  function onMouseDown(e: React.MouseEvent) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const p = pct(e, canvas);
    setStartPct(p);
    setDrawing(true);
    if (tool === "pen") {
      setCurrentAnn({ type: "pen", points: [p], color });
    } else {
      setCurrentAnn({ type: "circle", cx: p[0], cy: p[1], rx: 0, ry: 0, color });
    }
  }

  function onMouseMove(e: React.MouseEvent) {
    if (!drawing || !startPct) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const p = pct(e, canvas);
    if (tool === "pen") {
      setCurrentAnn((prev) =>
        prev?.type === "pen" ? { ...prev, points: [...prev.points, p] } : prev
      );
    } else {
      const rx = Math.abs(p[0] - startPct[0]) / 2;
      const ry = Math.abs(p[1] - startPct[1]) / 2;
      const cx = (startPct[0] + p[0]) / 2;
      const cy = (startPct[1] + p[1]) / 2;
      setCurrentAnn({ type: "circle", cx, cy, rx, ry, color });
    }
  }

  function onMouseUp() {
    if (!drawing || !currentAnn) return;
    setDrawing(false);
    const valid =
      currentAnn.type === "pen"
        ? currentAnn.points.length > 2
        : currentAnn.type === "circle" && currentAnn.rx > 0.01;
    if (valid) setAnnotations((prev) => [...prev, currentAnn]);
    setCurrentAnn(null);
    setStartPct(null);
  }

  // Touch support
  function onTouchStart(e: React.TouchEvent) {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const r = canvas.getBoundingClientRect();
    const t = e.touches[0];
    const p: [number, number] = [(t.clientX - r.left) / r.width, (t.clientY - r.top) / r.height];
    setStartPct(p);
    setDrawing(true);
    if (tool === "pen") {
      setCurrentAnn({ type: "pen", points: [p], color });
    } else {
      setCurrentAnn({ type: "circle", cx: p[0], cy: p[1], rx: 0, ry: 0, color });
    }
  }

  function onTouchMove(e: React.TouchEvent) {
    e.preventDefault();
    if (!drawing || !startPct) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const r = canvas.getBoundingClientRect();
    const t = e.touches[0];
    const p: [number, number] = [(t.clientX - r.left) / r.width, (t.clientY - r.top) / r.height];
    if (tool === "pen") {
      setCurrentAnn((prev) =>
        prev?.type === "pen" ? { ...prev, points: [...prev.points, p] } : prev
      );
    } else {
      const rx = Math.abs(p[0] - startPct[0]) / 2;
      const ry = Math.abs(p[1] - startPct[1]) / 2;
      const cx = (startPct[0] + p[0]) / 2;
      const cy = (startPct[1] + p[1]) / 2;
      setCurrentAnn({ type: "circle", cx, cy, rx, ry, color });
    }
  }

  async function saveAnnotation() {
    const canvas = canvasRef.current;
    if (!canvas || annotations.length === 0) return;
    setSaving(true);

    // For images, composite the original image + annotations into one PNG
    let sourceCanvas = canvas;
    if (!fileIsPDF) {
      const imgEl = containerRef.current?.querySelector("img");
      if (imgEl) {
        const containerRect = containerRef.current!.getBoundingClientRect();
        const imgRect = imgEl.getBoundingClientRect();
        const composite = document.createElement("canvas");
        composite.width = canvas.width;
        composite.height = canvas.height;
        const ctx = composite.getContext("2d");
        if (ctx) {
          ctx.fillStyle = "#111111";
          ctx.fillRect(0, 0, composite.width, composite.height);
          ctx.drawImage(
            imgEl,
            imgRect.left - containerRect.left,
            imgRect.top - containerRect.top,
            imgRect.width,
            imgRect.height
          );
          ctx.drawImage(canvas, 0, 0);
        }
        sourceCanvas = composite;
      }
    }

    const blob = await new Promise<Blob | null>((res) => sourceCanvas.toBlob(res, "image/png"));
    if (!blob) { setSaving(false); return; }

    const path = `annotation-${contentId}-${Date.now()}.png`;
    const { error } = await supabase.storage.from("assets").upload(path, blob, { contentType: "image/png" });
    if (error) { setSaving(false); return; }

    const { data: { publicUrl } } = supabase.storage.from("assets").getPublicUrl(path);

    const { data: item } = await supabase
      .from("content_items")
      .select("file_urls")
      .eq("id", contentId)
      .single();

    const newUrls = [...(item?.file_urls ?? []), publicUrl];
    await supabase.from("content_items").update({ file_urls: newUrls }).eq("id", contentId);

    onAnnotationSaved?.(newUrls);
    setAnnotations([]);
    setAnnotating(false);
    setSaving(false);
  }

  // Keyboard nav
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
      if (e.key === "ArrowRight") setIndex((i) => Math.min(files.length - 1, i + 1));
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files.length]);

  return (
    <div className="fixed inset-0 bg-black/96 z-50 flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur flex-shrink-0 gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {!readOnly && !fileIsAnnotation && (
            <>
              <button
                onClick={() => { setAnnotating((a) => !a); if (annotating) setAnnotations([]); }}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                  annotating
                    ? "bg-[var(--accent)] text-white"
                    : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                )}
              >
                <Pen className="w-3.5 h-3.5" />
                {annotating ? "Exit Annotate" : "Annotate"}
              </button>

              {annotating && (
                <>
                  <div className="w-px h-5 bg-zinc-700" />
                  <button
                    onClick={() => setTool("circle")}
                    className={cn("flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all", tool === "circle" ? "bg-zinc-600 text-white" : "text-zinc-400 hover:text-white")}
                  >
                    <Circle className="w-3.5 h-3.5" /> Circle
                  </button>
                  <button
                    onClick={() => setTool("pen")}
                    className={cn("flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all", tool === "pen" ? "bg-zinc-600 text-white" : "text-zinc-400 hover:text-white")}
                  >
                    <Pen className="w-3.5 h-3.5" /> Pen
                  </button>
                  <div className="w-px h-5 bg-zinc-700" />
                  <div className="flex items-center gap-1.5">
                    {COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => setColor(c)}
                        className={cn("w-5 h-5 rounded-full transition-all border-2", color === c ? "border-white scale-125" : "border-transparent hover:border-zinc-500")}
                        style={{ background: c }}
                      />
                    ))}
                  </div>
                  <div className="w-px h-5 bg-zinc-700" />
                  <button
                    onClick={() => setAnnotations((p) => p.slice(0, -1))}
                    disabled={annotations.length === 0}
                    className="flex items-center gap-1 px-2 py-1.5 rounded text-xs text-zinc-400 hover:text-white disabled:opacity-30 transition-colors"
                  >
                    <Undo className="w-3.5 h-3.5" /> Undo
                  </button>
                  <button
                    onClick={saveAnnotation}
                    disabled={annotations.length === 0 || saving}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-40 transition-all"
                  >
                    <Save className="w-3.5 h-3.5" />
                    {saving ? "Saving…" : "Save Annotation"}
                  </button>
                </>
              )}
            </>
          )}

          {fileIsAnnotation && (
            <span className="text-xs text-amber-400 font-medium">Annotation</span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {files.length > 1 && (
            <span className="text-xs text-zinc-500">{index + 1} / {files.length}</span>
          )}
          <a
            href={currentFile}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 text-zinc-400 hover:text-white transition-colors"
            title="Download"
          >
            <Download className="w-4 h-4" />
          </a>
          <button onClick={onClose} className="p-2 text-zinc-400 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content area */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden">
        {fileIsPDF ? (
          <iframe
            key={currentFile}
            src={`${currentFile}#toolbar=0&navpanes=0`}
            className="w-full h-full border-0"
            style={{ pointerEvents: annotating ? "none" : "auto" }}
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center p-6"
            style={{ pointerEvents: annotating ? "none" : "auto" }}
          >
            <img
              key={currentFile}
              src={currentFile}
              alt="Content attachment"
              className="max-w-full max-h-full object-contain select-none rounded-lg"
              draggable={false}
            />
          </div>
        )}

        {/* Annotation canvas */}
        {annotating && (
          <canvas
            ref={canvasRef}
            className="absolute inset-0 cursor-crosshair touch-none"
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onMouseUp}
          />
        )}
      </div>

      {/* Slider dots / arrows */}
      {files.length > 1 && (
        <div className="flex items-center justify-center gap-3 py-3 border-t border-zinc-800/60 flex-shrink-0">
          <button
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            disabled={index === 0}
            className="p-1 text-zinc-500 hover:text-white disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex gap-2 items-center">
            {files.map((url, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                className={cn(
                  "rounded-full transition-all",
                  i === index
                    ? "bg-[var(--accent)] w-5 h-2"
                    : "bg-zinc-600 hover:bg-zinc-400 w-2 h-2",
                  isAnnotationFile(url) && i !== index && "bg-amber-700"
                )}
                title={isAnnotationFile(url) ? "Annotation" : `File ${i + 1}`}
              />
            ))}
          </div>
          <button
            onClick={() => setIndex((i) => Math.min(files.length - 1, i + 1))}
            disabled={index === files.length - 1}
            className="p-1 text-zinc-500 hover:text-white disabled:opacity-30 transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect, useRef } from "react";
import { ScrollText, Download, PenLine, CheckCircle2, Clock, X, Eye } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Topbar } from "@/components/layout/topbar";
import { formatDate } from "@/lib/utils";
import type { Contract } from "@/lib/supabase/types";

export default function ContractsPage() {
  const supabase = createClient();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [signing, setSigning] = useState<Contract | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSig, setHasSig] = useState(false);
  const [signerName, setSignerName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [userId, setUserId] = useState("");
  const [viewing, setViewing] = useState<Contract | null>(null);
  const [isMember, setIsMember] = useState(false);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data: profile } = await supabase.from("profiles").select("client_role").eq("id", user.id).single();
      if (profile?.client_role === "member") {
        setIsMember(true);
        return;
      }

      // Only project owners (CEO) can see contracts — RLS enforces this too
      const { data: projects } = await supabase.from("projects").select("id").eq("client_id", user.id).order("created_at", { ascending: true });
      const projectIds = (projects ?? []).map((p) => p.id);
      if (projectIds.length > 0) {
        const { data } = await supabase.from("contracts").select("*").in("project_id", projectIds).order("created_at", { ascending: false });
        if (data) setContracts(data);
      }
    }
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Signature canvas
  function getPos(e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function startDraw(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    setIsDrawing(true);
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e, canvas);
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setHasSig(true);
  }

  function clearSig() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSig(false);
  }

  async function submitSignature() {
    if (!signing || !hasSig || !signerName.trim()) return;
    setSubmitting(true);

    const canvas = canvasRef.current;
    const sigData = canvas?.toDataURL("image/png") ?? "";

    await supabase
      .from("contracts")
      .update({
        status: "signed",
        signature_data: sigData,
        signature_name: signerName.trim().toUpperCase(),
        signed_at: new Date().toISOString(),
      })
      .eq("id", signing.id);

    await supabase.from("notifications").insert({
      user_id: userId,
      title: "Contract Signed",
      message: `You signed "${signing.title}"`,
      type: "contract",
      read: false,
      link: "/contracts",
    });

    setContracts((prev) =>
      prev.map((c) =>
        c.id === signing.id
          ? { ...c, status: "signed", signature_data: sigData, signature_name: signerName.trim().toUpperCase(), signed_at: new Date().toISOString() }
          : c
      )
    );
    setSigning(null);
    setHasSig(false);
    setSignerName("");
    setSubmitting(false);
  }

  const statusConfig = {
    pending: { label: "Awaiting Signature", variant: "warning" as const, icon: Clock },
    signed: { label: "Signed", variant: "success" as const, icon: CheckCircle2 },
    expired: { label: "Expired", variant: "error" as const, icon: X },
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Topbar title="Contracts" subtitle="Review and sign your agreements" userId={userId} />

      <div className="flex-1 p-6 animate-fade-in">
        {isMember ? (
          <div className="text-center py-20">
            <ScrollText className="w-10 h-10 text-[var(--foreground-subtle)] mx-auto mb-3" />
            <p className="text-sm font-semibold text-[var(--foreground-muted)]">Access restricted</p>
            <p className="text-xs text-[var(--foreground-subtle)] mt-1">
              Only the primary account holder can view contracts.
            </p>
          </div>
        ) : contracts.length === 0 ? (
          <div className="text-center py-20">
            <ScrollText className="w-10 h-10 text-[var(--foreground-subtle)] mx-auto mb-3" />
            <p className="text-sm text-[var(--foreground-muted)]">No contracts yet</p>
            <p className="text-xs text-[var(--foreground-subtle)] mt-1">
              Contracts from RBRANDR will appear here
            </p>
          </div>
        ) : (
          <div className="space-y-3 max-w-3xl">
            {contracts.map((contract) => {
              const s = statusConfig[contract.status as keyof typeof statusConfig];
              const Icon = s?.icon ?? Clock;
              return (
                <div
                  key={contract.id}
                  className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 flex items-center gap-4 hover:border-zinc-600 transition-all"
                >
                  <div className="w-10 h-10 rounded-xl bg-[var(--surface-2)] flex items-center justify-center flex-shrink-0">
                    <ScrollText className="w-5 h-5 text-[var(--foreground-muted)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[var(--foreground)]">{contract.title}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <p className="text-xs text-[var(--foreground-subtle)]">
                        Added {formatDate(contract.created_at)}
                      </p>
                      {contract.signed_at && (
                        <p className="text-xs text-emerald-400">
                          Signed {formatDate(contract.signed_at)}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <Badge variant={s?.variant ?? "default"}>
                      <Icon className="w-3 h-3" />
                      {s?.label}
                    </Badge>
                    <button
                      onClick={() => setViewing(contract)}
                      className="w-8 h-8 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:border-zinc-500 transition-all cursor-pointer"
                      title="View document"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <a
                      href={contract.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-8 h-8 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:border-zinc-500 transition-all"
                      title="Download"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </a>
                    {contract.status === "pending" && (
                      <Button
                        size="sm"
                        onClick={() => { setSigning(contract); setHasSig(false); setSignerName(""); }}
                        className="gap-1.5"
                      >
                        <PenLine className="w-3.5 h-3.5" />
                        Sign
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* PDF viewer modal */}
      {viewing && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-4xl h-[90vh] flex flex-col animate-fade-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] flex-shrink-0">
              <div>
                <h3 className="text-sm font-bold text-[var(--foreground)]">{viewing.title}</h3>
                <p className="text-xs text-[var(--foreground-muted)] mt-0.5">Read-only preview</p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={viewing.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-all"
                >
                  <Download className="w-3 h-3" />
                  Download
                </a>
                <button
                  onClick={() => setViewing(null)}
                  className="text-[var(--foreground-subtle)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden rounded-b-2xl">
              <iframe
                src={`${viewing.file_url}#toolbar=0`}
                className="w-full h-full"
                title={viewing.title}
              />
            </div>
          </div>
        </div>
      )}

      {/* Signature modal */}
      {signing && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-md animate-fade-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
              <div>
                <h3 className="text-sm font-bold text-[var(--foreground)]">Sign Contract</h3>
                <p className="text-xs text-[var(--foreground-muted)] mt-0.5">{signing.title}</p>
              </div>
              <button
                onClick={() => setSigning(null)}
                className="text-[var(--foreground-subtle)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-[var(--foreground-muted)]">
                Draw your signature below. By signing, you agree to the terms of this contract.
              </p>

              <div>
                <label className="text-xs font-medium text-[var(--foreground-muted)] block mb-1.5">
                  Full Name in Block Capitals *
                </label>
                <input
                  type="text"
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value.toUpperCase())}
                  placeholder="YOUR FULL NAME"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[var(--foreground)] text-sm font-semibold tracking-wide outline-none focus:border-[var(--accent)] transition-all uppercase"
                  style={{ textTransform: "uppercase" }}
                />
              </div>

              <div className="relative rounded-xl border border-[var(--border)] overflow-hidden bg-white">
                <canvas
                  ref={canvasRef}
                  width={448}
                  height={160}
                  onMouseDown={startDraw}
                  onMouseMove={draw}
                  onMouseUp={() => setIsDrawing(false)}
                  onMouseLeave={() => setIsDrawing(false)}
                  onTouchStart={startDraw}
                  onTouchMove={draw}
                  onTouchEnd={() => setIsDrawing(false)}
                  className="w-full touch-none cursor-crosshair"
                />
                {!hasSig && (
                  <p className="absolute inset-0 flex items-center justify-center text-sm text-zinc-400 pointer-events-none">
                    Draw your signature here
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={clearSig}
                  className="text-xs text-[var(--foreground-subtle)] hover:text-[var(--foreground-muted)] underline transition-colors cursor-pointer"
                >
                  Clear
                </button>
              </div>

              <div className="flex gap-3">
                <Button variant="secondary" className="flex-1" onClick={() => setSigning(null)}>
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  disabled={!hasSig || !signerName.trim()}
                  loading={submitting}
                  onClick={submitSignature}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Submit Signature
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

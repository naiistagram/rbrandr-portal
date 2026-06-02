"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Upload, Loader2 } from "lucide-react";

interface Props {
  clientId: string;
  projectId: string;
  tab: string;
}

const inputCls = "w-full px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] text-sm outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/30 transition-all";
const labelCls = "block text-xs font-medium text-[var(--foreground-muted)] mb-1";

export default function CompanyUploadForms({ clientId, projectId, tab }: Props) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Contract fields
  const [contractTitle, setContractTitle] = useState("");
  const [contractType, setContractType] = useState("contract");
  const contractRef = useRef<HTMLInputElement>(null);

  // Document fields
  const [docTitle, setDocTitle] = useState("");
  const [docDesc, setDocDesc] = useState("");
  const docRef = useRef<HTMLInputElement>(null);

  // Report fields
  const [reportTitle, setReportTitle] = useState("");
  const [reportPeriod, setReportPeriod] = useState("");
  const reportRef = useRef<HTMLInputElement>(null);

  // Asset fields
  const [assetName, setAssetName] = useState("");
  const [assetCategory, setAssetCategory] = useState("other");
  const assetRef = useRef<HTMLInputElement>(null);

  async function upload(endpoint: string, fd: FormData) {
    setUploading(true);
    setError("");
    setSuccess("");
    fd.append("projectId", projectId);
    fd.append("clientId", clientId);
    const res = await fetch(endpoint, { method: "POST", body: fd });
    const json = await res.json();
    setUploading(false);
    if (!res.ok) {
      setError(json.error ?? "Upload failed");
      return;
    }
    setSuccess("Uploaded successfully.");
    router.refresh();
  }

  async function handleContract(e: React.FormEvent) {
    e.preventDefault();
    const file = contractRef.current?.files?.[0];
    if (!file || !contractTitle) return;
    const fd = new FormData();
    fd.append("file", file);
    fd.append("title", contractTitle);
    fd.append("type", contractType);
    await upload("/api/admin/upload-contract", fd);
    setContractTitle("");
    if (contractRef.current) contractRef.current.value = "";
  }

  async function handleDocument(e: React.FormEvent) {
    e.preventDefault();
    const file = docRef.current?.files?.[0];
    if (!file || !docTitle) return;
    const fd = new FormData();
    fd.append("file", file);
    fd.append("title", docTitle);
    fd.append("description", docDesc);
    await upload("/api/admin/upload-document", fd);
    setDocTitle("");
    setDocDesc("");
    if (docRef.current) docRef.current.value = "";
  }

  async function handleReport(e: React.FormEvent) {
    e.preventDefault();
    const file = reportRef.current?.files?.[0];
    if (!file || !reportTitle || !reportPeriod) return;
    const fd = new FormData();
    fd.append("file", file);
    fd.append("title", reportTitle);
    fd.append("period", reportPeriod);
    await upload("/api/admin/upload-report", fd);
    setReportTitle("");
    setReportPeriod("");
    if (reportRef.current) reportRef.current.value = "";
  }

  async function handleAsset(e: React.FormEvent) {
    e.preventDefault();
    const file = assetRef.current?.files?.[0];
    if (!file || !assetName) return;
    const fd = new FormData();
    fd.append("file", file);
    fd.append("name", assetName);
    fd.append("category", assetCategory);
    await upload("/api/admin/upload-asset", fd);
    setAssetName("");
    if (assetRef.current) assetRef.current.value = "";
  }

  const wrapCls = "bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 mb-5";

  if (tab === "Contracts & T&Cs") return (
    <div className={wrapCls}>
      <h3 className="text-sm font-semibold text-[var(--foreground)] mb-4">Upload Document</h3>
      <form onSubmit={handleContract} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Title *</label>
            <input required value={contractTitle} onChange={e => setContractTitle(e.target.value)} placeholder="Document title" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Type</label>
            <select value={contractType} onChange={e => setContractType(e.target.value)} className={inputCls}>
              <option value="contract">Contract</option>
              <option value="terms">T&Cs</option>
            </select>
          </div>
        </div>
        <label className="flex flex-col items-center gap-2 p-4 border border-dashed border-[var(--border)] rounded-lg cursor-pointer hover:border-[var(--accent)]/50 transition-colors text-[var(--foreground-subtle)] text-sm">
          <Upload className="w-4 h-4" />
          {contractRef.current?.files?.[0]?.name ?? "Choose PDF to Upload"}
          <input ref={contractRef} type="file" accept=".pdf" className="sr-only" onChange={() => setError("")} />
        </label>
        {error && <p className="text-xs text-red-400">{error}</p>}
        {success && <p className="text-xs text-emerald-400">{success}</p>}
        <button type="submit" disabled={uploading} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium disabled:opacity-50 hover:opacity-90 transition-opacity cursor-pointer">
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {uploading ? "Uploading…" : "Upload"}
        </button>
      </form>
    </div>
  );

  if (tab === "Documents") return (
    <div className={wrapCls}>
      <h3 className="text-sm font-semibold text-[var(--foreground)] mb-4">Upload Document</h3>
      <form onSubmit={handleDocument} className="space-y-3">
        <div>
          <label className={labelCls}>Title *</label>
          <input required value={docTitle} onChange={e => setDocTitle(e.target.value)} placeholder="Document title" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Description</label>
          <input value={docDesc} onChange={e => setDocDesc(e.target.value)} placeholder="Optional description" className={inputCls} />
        </div>
        <label className="flex flex-col items-center gap-2 p-4 border border-dashed border-[var(--border)] rounded-lg cursor-pointer hover:border-[var(--accent)]/50 transition-colors text-[var(--foreground-subtle)] text-sm">
          <Upload className="w-4 h-4" />
          {docRef.current?.files?.[0]?.name ?? "Choose file to Upload"}
          <input ref={docRef} type="file" className="sr-only" onChange={() => setError("")} />
        </label>
        {error && <p className="text-xs text-red-400">{error}</p>}
        {success && <p className="text-xs text-emerald-400">{success}</p>}
        <button type="submit" disabled={uploading} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium disabled:opacity-50 hover:opacity-90 transition-opacity cursor-pointer">
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {uploading ? "Uploading…" : "Upload"}
        </button>
      </form>
    </div>
  );

  if (tab === "Reports") return (
    <div className={wrapCls}>
      <h3 className="text-sm font-semibold text-[var(--foreground)] mb-4">Upload Report</h3>
      <form onSubmit={handleReport} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Title *</label>
            <input required value={reportTitle} onChange={e => setReportTitle(e.target.value)} placeholder="e.g. Monthly Analytics" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Period *</label>
            <input required value={reportPeriod} onChange={e => setReportPeriod(e.target.value)} placeholder="e.g. May 2026" className={inputCls} />
          </div>
        </div>
        <label className="flex flex-col items-center gap-2 p-4 border border-dashed border-[var(--border)] rounded-lg cursor-pointer hover:border-[var(--accent)]/50 transition-colors text-[var(--foreground-subtle)] text-sm">
          <Upload className="w-4 h-4" />
          {reportRef.current?.files?.[0]?.name ?? "Choose PDF to Upload"}
          <input ref={reportRef} type="file" accept=".pdf" className="sr-only" onChange={() => setError("")} />
        </label>
        {error && <p className="text-xs text-red-400">{error}</p>}
        {success && <p className="text-xs text-emerald-400">{success}</p>}
        <button type="submit" disabled={uploading} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium disabled:opacity-50 hover:opacity-90 transition-opacity cursor-pointer">
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {uploading ? "Uploading…" : "Upload"}
        </button>
      </form>
    </div>
  );

  if (tab === "Assets") return (
    <div className={wrapCls}>
      <h3 className="text-sm font-semibold text-[var(--foreground)] mb-4">Upload Asset</h3>
      <form onSubmit={handleAsset} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Name *</label>
            <input required value={assetName} onChange={e => setAssetName(e.target.value)} placeholder="Asset name" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Category</label>
            <select value={assetCategory} onChange={e => setAssetCategory(e.target.value)} className={inputCls}>
              <option value="logo">Logo</option>
              <option value="brand">Brand</option>
              <option value="template">Template</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
        <label className="flex flex-col items-center gap-2 p-4 border border-dashed border-[var(--border)] rounded-lg cursor-pointer hover:border-[var(--accent)]/50 transition-colors text-[var(--foreground-subtle)] text-sm">
          <Upload className="w-4 h-4" />
          {assetRef.current?.files?.[0]?.name ?? "Choose file to Upload"}
          <input ref={assetRef} type="file" className="sr-only" onChange={() => setError("")} />
        </label>
        {error && <p className="text-xs text-red-400">{error}</p>}
        {success && <p className="text-xs text-emerald-400">{success}</p>}
        <button type="submit" disabled={uploading} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium disabled:opacity-50 hover:opacity-90 transition-opacity cursor-pointer">
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {uploading ? "Uploading…" : "Upload"}
        </button>
      </form>
    </div>
  );

  return null;
}

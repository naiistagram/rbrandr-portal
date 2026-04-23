"use client";

import { useState, useEffect, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { BookOpen, Upload, FileText, Download, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Topbar } from "@/components/layout/topbar";
import { formatDate } from "@/lib/utils";
import type { Document } from "@/lib/supabase/types";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentsPage() {
  const supabase = createClient();
  const [docs, setDocs] = useState<Document[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [search, setSearch] = useState("");
  const [userId, setUserId] = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const { data: projects } = await supabase.from("projects").select("id").eq("client_id", user.id).order("created_at", { ascending: true });
      const projectIds = (projects ?? []).map((p) => p.id);
      if (projectIds.length > 0) setProjectId(projectIds[0]);
      const { data } = await supabase.from("documents").select("*").eq("client_id", user.id).order("created_at", { ascending: false });
      if (data) setDocs(data);
    }
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!projectId || !userId) return;
    setUploadError("");
    setUploading(true);
    for (const file of acceptedFiles) {
      const path = `documents/${projectId}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("documents").upload(path, file);
      if (error) continue;
      const { data: urlData } = supabase.storage.from("documents").getPublicUrl(path);
      const { data } = await supabase.from("documents").insert({
        project_id: projectId,
        uploaded_by: userId,
        title: file.name,
        file_url: urlData.publicUrl,
        file_type: file.type,
        file_size: file.size,
      }).select().single();
      if (data) setDocs((prev) => [data, ...prev]);
    }
    setUploading(false);
  }, [projectId, userId, supabase]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected: (rejections) => {
      const tooBig = rejections.some((r) => r.errors.some((e) => e.code === "file-too-large"));
      setUploadError(tooBig ? "File too large. Maximum size is 50MB." : "File type not supported.");
    },
    accept: { "application/pdf": [], "application/msword": [], "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [], "text/plain": [], "application/zip": [] },
    maxSize: 50 * 1024 * 1024,
  });

const filtered = docs.filter((d) => d.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex flex-col min-h-screen">
      <Topbar title="Documents" subtitle="Store and access your project documents" userId={userId} />

      <div className="flex-1 p-6 space-y-5 animate-fade-in">
        {/* Upload zone */}
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${isDragActive ? "border-[var(--accent)] bg-[var(--accent-subtle)]" : "border-[var(--border)] hover:border-zinc-600 bg-[var(--surface)]"}`}
        >
          <input {...getInputProps()} />
          <Upload className={`w-8 h-8 mx-auto mb-3 ${isDragActive ? "text-[var(--accent)]" : "text-[var(--foreground-subtle)]"}`} />
          <p className="text-sm font-medium text-[var(--foreground)]">
            {isDragActive ? "Drop files here" : "Drag & drop files, or click to browse"}
          </p>
          <p className="text-xs text-[var(--foreground-subtle)] mt-1">PDFs, Word docs, ZIP — up to 50MB each</p>
          {uploading && (
            <div className="mt-3 flex items-center justify-center gap-2 text-sm text-[var(--accent)]">
              <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              Uploading...
            </div>
          )}
          {uploadError && (
            <p className="mt-2 text-xs text-red-400">{uploadError}</p>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--foreground-subtle)]" />
          <input
            type="text"
            placeholder="Search documents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-sm text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] outline-none focus:border-[var(--accent)] transition-all"
          />
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <BookOpen className="w-10 h-10 text-[var(--foreground-subtle)] mx-auto mb-3" />
            <p className="text-sm text-[var(--foreground-muted)]">No documents yet</p>
            <p className="text-xs text-[var(--foreground-subtle)] mt-1">Upload your first document above</p>
          </div>
        ) : (
          <div className="space-y-2 max-w-3xl">
            {filtered.map((doc) => (
              <div key={doc.id} className="flex items-center gap-4 p-4 bg-[var(--surface)] border border-[var(--border)] rounded-xl hover:border-zinc-600 transition-all group">
                <div className="w-9 h-9 rounded-lg bg-[var(--surface-2)] flex items-center justify-center flex-shrink-0">
                  <FileText className="w-4 h-4 text-[var(--foreground-muted)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--foreground)] truncate">{doc.title}</p>
                  <p className="text-xs text-[var(--foreground-subtle)]">
                    {formatSize(doc.file_size)} · {formatDate(doc.created_at)}
                  </p>
                </div>
                <a
                  href={doc.file_url}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Download className="w-3.5 h-3.5" />
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

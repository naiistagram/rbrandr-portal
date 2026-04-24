"use client";

import { useState, useEffect, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import {
  Upload,
  FolderOpen,
  Image,
  FileText,
  Film,
  Download,
  Trash2,
  Search,
  X,
  ZoomIn,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
// Note: project/asset DB queries go through API routes to bypass RLS for member access
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Topbar } from "@/components/layout/topbar";
import { formatDate } from "@/lib/utils";
import type { Asset } from "@/lib/supabase/types";
type Category = "all" | "logo" | "brand" | "template" | "other";

function fileIcon(type: string) {
  if (type.startsWith("image/")) return <Image className="w-5 h-5" />;
  if (type.startsWith("video/")) return <Film className="w-5 h-5" />;
  return <FileText className="w-5 h-5" />;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AssetsPage() {
  const supabase = createClient();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<Category>("all");
  const [uploadCategory, setUploadCategory] = useState<Asset["category"]>("brand");
  const [userId, setUserId] = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectIds, setProjectIds] = useState<string[]>([]);
  const [viewing, setViewing] = useState<Asset | null>(null);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      fetchAssets();
    }
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchAssets() {
    const res = await fetch("/api/assets");
    if (!res.ok) return;
    const data = await res.json();
    setAssets(data.assets ?? []);
    const ids: string[] = data.projectIds ?? [];
    setProjectIds(ids);
    if (ids.length > 0 && !projectId) setProjectId(ids[0]);
  }

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (!projectId || !userId) return;
      setUploading(true);
      setUploadError("");

      for (const file of acceptedFiles) {
        const path = `${projectId}/${Date.now()}-${file.name}`;

        const { error: storageError } = await supabase.storage
          .from("assets")
          .upload(path, file);

        if (storageError) {
          setUploadError(storageError.message);
          continue;
        }

        const { data: urlData } = supabase.storage.from("assets").getPublicUrl(path);

        await fetch("/api/assets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            project_id: projectId,
            name: file.name,
            file_url: urlData.publicUrl,
            file_type: file.type,
            file_size: file.size,
            category: uploadCategory,
          }),
        });
      }

      await fetchAssets();
      setUploading(false);
    },
    [projectId, userId, uploadCategory, supabase]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected: (rejections) => {
      const tooBig = rejections.some((r) => r.errors.some((e) => e.code === "file-too-large"));
      setUploadError(tooBig ? "File too large. Maximum size is 500MB." : "File type not supported.");
    },
    accept: {
      "image/*": [],
      "application/pdf": [],
      "application/zip": [],
      "video/*": [],
    },
    maxSize: 500 * 1024 * 1024,
  });

  async function deleteAsset(asset: Asset) {
    const path = asset.file_url.split("/storage/v1/object/public/assets/")[1];
    if (path) await supabase.storage.from("assets").remove([path]);
    await fetch(`/api/assets?id=${asset.id}`, { method: "DELETE" });
    setAssets((prev) => prev.filter((a) => a.id !== asset.id));
  }

  const filtered = assets.filter((a) => {
    const matchSearch = a.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = category === "all" || a.category === category;
    return matchSearch && matchCat;
  });

  const categories: Category[] = ["all", "logo", "brand", "template", "other"];

  return (
    <div className="flex flex-col min-h-screen">
      <Topbar title="Brand Assets" subtitle="Upload and manage your brand files" userId={userId} />

      <div className="flex-1 p-6 space-y-5 animate-fade-in">
        {/* Category selector for upload */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-medium text-[var(--foreground-muted)]">Upload as:</span>
          {(["logo", "brand", "template", "other"] as Asset["category"][]).map((cat) => (
            <button
              key={cat}
              onClick={() => setUploadCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all cursor-pointer ${
                uploadCategory === cat
                  ? "bg-[var(--accent)] text-white"
                  : "bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
              }`}
            >
              {cat === "brand" ? "Brand Asset" : cat === "logo" ? "Logo" : cat === "template" ? "Template" : "Other"}
            </button>
          ))}
        </div>

        {/* Upload zone */}
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${
            isDragActive
              ? "border-[var(--accent)] bg-[var(--accent-subtle)]"
              : "border-[var(--border)] hover:border-zinc-600 bg-[var(--surface)]"
          }`}
        >
          <input {...getInputProps()} />
          <Upload
            className={`w-8 h-8 mx-auto mb-3 ${
              isDragActive ? "text-[var(--accent)]" : "text-[var(--foreground-subtle)]"
            }`}
          />
          <p className="text-sm font-medium text-[var(--foreground)]">
            {isDragActive ? "Drop files here" : "Drag & drop files, or click to browse"}
          </p>
          <p className="text-xs text-[var(--foreground-subtle)] mt-1">
            Images, PDFs, ZIPs, Videos — up to 500MB each
          </p>
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

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--foreground-subtle)]" />
            <input
              type="text"
              placeholder="Search assets..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-sm text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] outline-none focus:border-[var(--accent)] transition-all"
            />
          </div>
          <div className="flex items-center gap-1.5">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all cursor-pointer ${
                  category === cat
                    ? "bg-[var(--accent-subtle)] text-[var(--accent)]"
                    : "bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Assets grid */}
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <FolderOpen className="w-10 h-10 text-[var(--foreground-subtle)] mx-auto mb-3" />
            <p className="text-sm text-[var(--foreground-muted)]">No assets found</p>
            <p className="text-xs text-[var(--foreground-subtle)] mt-1">Upload your first file above</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filtered.map((asset) => (
              <Card key={asset.id} className="group p-0 overflow-hidden">
                {/* Preview */}
                <div
                  className="relative aspect-video bg-[var(--surface-2)] flex items-center justify-center overflow-hidden cursor-pointer"
                  onClick={() => setViewing(asset)}
                >
                  {asset.file_type.startsWith("image/") ? (
                    <img
                      src={asset.file_url}
                      alt={asset.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-[var(--foreground-subtle)]">
                      {fileIcon(asset.file_type)}
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); setViewing(asset); }}
                      className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
                    >
                      <ZoomIn className="w-4 h-4" />
                    </button>
                    <a
                      href={asset.file_url}
                      download
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteAsset(asset); }}
                      className="w-8 h-8 rounded-lg bg-red-500/20 hover:bg-red-500/40 flex items-center justify-center text-red-400 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="p-3">
                  <p className="text-xs font-medium text-[var(--foreground)] truncate">{asset.name}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[10px] text-[var(--foreground-subtle)]">
                      {formatSize(asset.file_size)}
                    </span>
                    <Badge variant="default" className="text-[10px] px-1.5 py-0">
                      {asset.category}
                    </Badge>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Asset viewer modal */}
        {viewing && (
            <div
              className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setViewing(null)}
            >
              <button
                onClick={() => setViewing(null)}
                className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer z-10"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="flex flex-col items-center gap-4 max-w-5xl w-full" onClick={(e) => e.stopPropagation()}>
                {viewing.file_type.startsWith("image/") ? (
                  <img
                    src={viewing.file_url}
                    alt={viewing.name}
                    className="max-h-[80vh] max-w-full object-contain rounded-xl"
                    style={{ imageRendering: "auto" }}
                  />
                ) : /\.pdf$/i.test(viewing.file_url) ? (
                  <iframe
                    src={viewing.file_url}
                    className="w-full rounded-xl border-0"
                    style={{ height: "80vh" }}
                    title={viewing.name}
                  />
                ) : viewing.file_type.startsWith("video/") ? (
                  <video
                    src={viewing.file_url}
                    controls
                    className="max-h-[80vh] max-w-full rounded-xl"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-4 text-white">
                    <FileText className="w-16 h-16 opacity-40" />
                    <p className="text-sm">{viewing.name}</p>
                    <a
                      href={viewing.file_url}
                      download
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
                    >
                      Download file
                    </a>
                  </div>
                )}
                <div className="flex items-center gap-4 text-white/60 text-xs">
                  <span>{viewing.name}</span>
                  <span>·</span>
                  <span>{formatSize(viewing.file_size)}</span>
                  <span>·</span>
                  <span className="capitalize">{viewing.category}</span>
                  <a
                    href={viewing.file_url}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-2 flex items-center gap-1 text-white/80 hover:text-white transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" /> Download
                  </a>
                </div>
              </div>
            </div>
          )}
      </div>
    </div>
  );
}

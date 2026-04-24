"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft, Mail, Save, Plus, X, Upload,
  FileText, ScrollText, BarChart3, Clock,
  Download, ImageIcon, FolderOpen, BookOpen, Milestone,
  Ticket as TicketIcon, CheckCircle2, Circle, Calendar, Trash2,
  AlignLeft, CheckSquare, List,
  Target, Megaphone, Radio, TrendingUp, Users, Trophy, Eye,
  Film, Camera, ChevronLeft, ChevronRight, Paperclip, Globe, MessageSquare, Star,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge, StatusDot } from "@/components/ui/badge";
import { cn, formatDate, STATUS_CONFIG } from "@/lib/utils";
import type {
  Profile, Project, ContentItem, Contract, Report,
  Asset, Document as Doc, Milestone as MS, Ticket, Form, Feedback,
} from "@/lib/supabase/types";

const CONTENT_TYPES = ["post", "story", "reel", "ad", "email", "blog", "other"] as const;
const PLATFORMS = ["Instagram", "Facebook", "TikTok", "LinkedIn", "Twitter/X", "YouTube", "Email", "Blog"];
const SERVICE_TYPES = [
  { value: "social_media", label: "Social Media" },
  { value: "brand", label: "Brand" },
  { value: "website", label: "Website" },
  { value: "both", label: "Full Service" },
];
const ASSET_CATEGORIES = ["logo", "brand", "template", "other"] as const;
const TABS = ["Overview", "Content", "Assets", "Documents", "Timeline", "Forms", "Contracts & T&Cs", "Reports", "Tickets", "Feedback"] as const;
type Tab = typeof TABS[number];

function getVisibleTabs(serviceType: string): Tab[] {
  const hasContent = ["social_media", "both", "marketing"].includes(serviceType);
  return TABS.filter((t) => hasContent || t !== "Content");
}

type FormField = { id: string; label: string; type: "text" | "textarea" | "select" | "multiselect" | "checkbox" | "file"; options?: string; required?: boolean };

const PRIORITY_COLORS: Record<string, string> = {
  low: "text-emerald-400",
  medium: "text-amber-400",
  high: "text-orange-400",
  urgent: "text-red-400",
};

const PLATFORM_CONFIG: Record<string, { color: string; bg: string; dot: string; pill: string }> = {
  Instagram: { color: "text-pink-400", bg: "from-purple-600/30 to-pink-600/30", dot: "bg-gradient-to-br from-purple-500 to-pink-500", pill: "bg-pink-500/10 text-pink-400 border-pink-500/20" },
  Facebook: { color: "text-blue-400", bg: "from-blue-700/30 to-blue-500/30", dot: "bg-blue-500", pill: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  TikTok: { color: "text-rose-400", bg: "from-zinc-800/80 to-rose-900/30", dot: "bg-rose-500", pill: "bg-rose-500/10 text-rose-400 border-rose-500/20" },
  LinkedIn: { color: "text-sky-400", bg: "from-sky-700/30 to-sky-500/30", dot: "bg-sky-500", pill: "bg-sky-500/10 text-sky-400 border-sky-500/20" },
  "Twitter/X": { color: "text-zinc-300", bg: "from-zinc-700/40 to-zinc-600/20", dot: "bg-zinc-400", pill: "bg-zinc-500/10 text-zinc-300 border-zinc-500/20" },
  YouTube: { color: "text-red-400", bg: "from-red-700/30 to-red-500/20", dot: "bg-red-500", pill: "bg-red-500/10 text-red-400 border-red-500/20" },
  Email: { color: "text-emerald-400", bg: "from-emerald-700/30 to-emerald-500/20", dot: "bg-emerald-500", pill: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  Blog: { color: "text-amber-400", bg: "from-amber-700/30 to-amber-500/20", dot: "bg-amber-500", pill: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
};
const PLATFORM_ORDER = ["Instagram", "Facebook", "TikTok", "LinkedIn", "Twitter/X", "YouTube", "Email", "Blog"];
const TYPE_PILL: Record<string, string> = {
  post: "bg-sky-500/15 text-sky-400 border-sky-500/20",
  story: "bg-purple-500/15 text-purple-400 border-purple-500/20",
  reel: "bg-pink-500/15 text-pink-400 border-pink-500/20",
  carousel: "bg-indigo-500/15 text-indigo-400 border-indigo-500/20",
  ad: "bg-orange-500/15 text-orange-400 border-orange-500/20",
  email: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  blog: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  other: "bg-zinc-500/15 text-zinc-400 border-zinc-500/20",
};

function contentIconFn(type: string) {
  if (type === "reel" || type === "story") return Film;
  if (type === "post" || type === "ad") return Camera;
  return FileText;
}
function isImageUrl(url: string) {
  return /\.(png|jpg|jpeg|gif|webp)/i.test(url) || (!url.includes(".pdf") && !url.includes(".zip"));
}

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const clientId = params.id as string;
  const supabase = createClient();

  const [client, setClient] = useState<Profile | null>(null);
  const [clientServiceType, setClientServiceType] = useState<Profile["service_type"]>("social_media");
  const [savingServiceType, setSavingServiceType] = useState(false);
  const [clientRoleState, setClientRoleState] = useState<"ceo" | "member">("ceo");
  const [jobTitleState, setJobTitleState] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [project, setProject] = useState<Project | null>(null);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [content, setContent] = useState<ContentItem[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [documents, setDocuments] = useState<Doc[]>([]);
  const [milestones, setMilestones] = useState<MS[]>([]);
  const [forms, setForms] = useState<Form[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [feedbackItems, setFeedbackItems] = useState<Feedback[]>([]);
  const [tab, setTab] = useState<Tab>("Overview");
  // Admin content detail modal
  const [adminSelected, setAdminSelected] = useState<ContentItem | null>(null);
  const [adminMediaIndex, setAdminMediaIndex] = useState(0);
  const [adminEditDesc, setAdminEditDesc] = useState("");
  const [adminEditFileUrls, setAdminEditFileUrls] = useState<string[]>([]);
  const [uploadingEditFile, setUploadingEditFile] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const adminEditFileRef = useRef<HTMLInputElement>(null);
  // Admin content filters
  const [adminContentStatus, setAdminContentStatus] = useState<"all" | ContentItem["status"]>("all");
  const [adminContentPlatform, setAdminContentPlatform] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [adminId, setAdminId] = useState("");
  const [ticketResponses, setTicketResponses] = useState<Record<string, string>>({});
  const [savingResponse, setSavingResponse] = useState<string | null>(null);
  const [responseError, setResponseError] = useState<Record<string, string>>({});
  const [responseSaved, setResponseSaved] = useState<Record<string, boolean>>({});
  const [feedbackReplies, setFeedbackReplies] = useState<Record<string, string>>({});
  const [savingReply, setSavingReply] = useState<string | null>(null);
  const [replySaved, setReplySaved] = useState<Record<string, boolean>>({});
  const [viewingAdminAsset, setViewingAdminAsset] = useState<Asset | null>(null);
  const [ticketMessages, setTicketMessages] = useState<Record<string, string>>({});
  // Team members
  type MemberRow = { id: string; user_id: string; created_at: string; profiles: { id: string; full_name: string; email: string; avatar_url: string | null; client_role: string } };
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [showAddMember, setShowAddMember] = useState(false);
  const [memberForm, setMemberForm] = useState({ fullName: "", email: "", jobTitle: "" });
  const [addingMember, setAddingMember] = useState(false);
  const [addMemberError, setAddMemberError] = useState("");
  const [addMemberSuccess, setAddMemberSuccess] = useState("");
  const [memberResetSent, setMemberResetSent] = useState<Record<string, boolean>>({});

  // Project form
  const [projForm, setProjForm] = useState({
    name: "", service_type: "social_media", goals: "", competition: "", status: "active",
    target_audience: "", messaging: "", channels: "",
    kpis: [] as string[],
  });
  const [kpiInput, setKpiInput] = useState("");
  const [savingProject, setSavingProject] = useState(false);
  const [projectSaved, setProjectSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  // Content form
  const [showContentForm, setShowContentForm] = useState(false);
  const [contentForm, setContentForm] = useState({
    title: "", content_type: "post" as ContentItem["content_type"], platform: "",
    description: "", scheduled_date: "", status: "draft" as ContentItem["status"],
  });
  const [addingContent, setAddingContent] = useState(false);
  const contentFileRef = useRef<HTMLInputElement>(null);
  const [contentFileUrls, setContentFileUrls] = useState<string[]>([]);
  const [uploadingContentFile, setUploadingContentFile] = useState(false);

  // Asset upload
  const assetRef = useRef<HTMLInputElement>(null);
  const [assetName, setAssetName] = useState("");
  const [assetCategory, setAssetCategory] = useState<Asset["category"]>("other");
  const [uploadingAsset, setUploadingAsset] = useState(false);

  // Document upload
  const docRef = useRef<HTMLInputElement>(null);
  const [docTitle, setDocTitle] = useState("");
  const [docDescription, setDocDescription] = useState("");
  const [uploadingDoc, setUploadingDoc] = useState(false);

  // Milestone form
  const [showMilestoneForm, setShowMilestoneForm] = useState(false);
  const [msForm, setMsForm] = useState({ title: "", description: "", due_date: "" });
  const [addingMs, setAddingMs] = useState(false);

  // Form builder
  const [showFormBuilder, setShowFormBuilder] = useState(false);
  const [fbTitle, setFbTitle] = useState("");
  const [fbDescription, setFbDescription] = useState("");
  const [fbFields, setFbFields] = useState<FormField[]>([]);
  const [creatingForm, setCreatingForm] = useState(false);
  const [formTemplates, setFormTemplates] = useState<Array<{ id: string; title: string; description: string | null; fields: FormField[] }>>([]);
  const [showTemplateList, setShowTemplateList] = useState(false);

  // Contract upload
  const contractRef = useRef<HTMLInputElement>(null);
  const [contractTitle, setContractTitle] = useState("");
  const [contractType, setContractType] = useState<"contract" | "terms">("contract");
  const [uploadingContract, setUploadingContract] = useState(false);
  const [contractError, setContractError] = useState("");

  // Report upload
  const reportRef = useRef<HTMLInputElement>(null);
  const [reportTitle, setReportTitle] = useState("");
  const [reportPeriod, setReportPeriod] = useState("");
  const [reportSummary, setReportSummary] = useState("");
  const [uploadingReport, setUploadingReport] = useState(false);
  const [reportError, setReportError] = useState("");

  // Form responses expanded state
  const [expandedForms, setExpandedForms] = useState<Set<string>>(new Set());

  useEffect(() => {
    const t = searchParams.get("tab");
    if (t && (TABS as readonly string[]).includes(t)) setTab(t as Tab);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function changeTab(t: Tab) {
    setTab(t);
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("tab", t);
    router.replace(`?${sp.toString()}`, { scroll: false });
  }

  useEffect(() => {
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  async function init() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setAdminId(user.id);

    const res = await fetch(`/api/admin/clients/${clientId}`);
    if (!res.ok) { setLoading(false); return; }

    const data = await res.json();
    setClient(data.client);
    setClientServiceType(data.client?.service_type ?? "social_media");
    setClientRoleState(data.client?.client_role ?? "ceo");
    setJobTitleState(data.client?.job_title ?? "");
    setAllProjects(data.projects ?? []);
    if (data.project) {
      setProject(data.project);
      const b = (data.project.brief ?? {}) as Record<string, string>;
      setProjForm({
        name: data.project.name,
        service_type: data.project.service_type,
        goals: data.project.goals ?? "",
        competition: data.project.competition ?? "",
        status: data.project.status,
        target_audience: b.target_audience ?? "",
        messaging: b.messaging ?? "",
        channels: b.channels ?? "",
        kpis: Array.isArray(data.project.kpis) ? (data.project.kpis as string[]) : [],
      });
    }
    setContent(data.content ?? []);
    setContracts(data.contracts ?? []);
    setReports(data.reports ?? []);
    setAssets(data.assets ?? []);
    setDocuments(data.documents ?? []);
    setMilestones(data.milestones ?? []);
    setForms(data.forms ?? []);
    setTickets(data.tickets ?? []);
    setFeedbackItems(data.feedback ?? []);
    const initialResponses: Record<string, string> = {};
    for (const t of (data.tickets ?? [])) {
      initialResponses[t.id] = t.admin_response ?? "";
    }
    setTicketResponses(initialResponses);
    const initialReplies: Record<string, string> = {};
    for (const f of (data.feedback ?? [])) {
      initialReplies[f.id] = f.admin_reply ?? "";
    }
    setFeedbackReplies(initialReplies);
    const { data: templates } = await supabase.from("form_templates").select("*").order("created_at", { ascending: false });
    if (templates) setFormTemplates(templates as typeof formTemplates);
    fetchMembers();
    setLoading(false);
  }

  async function fetchMembers() {
    const res = await fetch(`/api/admin/clients/${clientId}/members`);
    if (res.ok) {
      const data = await res.json();
      setMembers(data.members ?? []);
    }
  }

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    setAddingMember(true);
    setAddMemberError("");
    setAddMemberSuccess("");
    const res = await fetch(`/api/admin/clients/${clientId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(memberForm),
    });
    const data = await res.json();
    setAddingMember(false);
    if (!res.ok) { setAddMemberError(data.error ?? "Failed to add member."); return; }
    setAddMemberSuccess(`Invitation sent to ${memberForm.email}`);
    setMemberForm({ fullName: "", email: "", jobTitle: "" });
    fetchMembers();
  }

  async function handleRemoveMember(membershipId: string, userId: string) {
    if (!confirm("Remove this team member? Their account will be deleted.")) return;
    await fetch(`/api/admin/clients/${clientId}/members`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ membershipId, userId }),
    });
    fetchMembers();
  }

  async function handleMemberReset(userId: string, email: string) {
    await fetch("/api/admin/resend-invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setMemberResetSent((prev) => ({ ...prev, [userId]: true }));
    setTimeout(() => setMemberResetSent((prev) => ({ ...prev, [userId]: false })), 3000);
  }

  async function handleToggleRole(userId: string, currentRole: string) {
    const newRole = currentRole === "ceo" ? "member" : "ceo";
    await fetch(`/api/admin/clients/${clientId}/members`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, clientRole: newRole }),
    });
    fetchMembers();
  }

  async function handleSaveServiceType(value: Profile["service_type"]) {
    setSavingServiceType(true);
    setClientServiceType(value);
    const visibleAfter = getVisibleTabs(value);
    if (!visibleAfter.includes(tab as Tab)) changeTab("Overview");
    await fetch(`/api/admin/clients/${clientId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ service_type: value }),
    });
    setSavingServiceType(false);
  }

  async function handleSaveClientProfile(fields: { client_role?: string; job_title?: string }) {
    setSavingProfile(true);
    await fetch(`/api/admin/clients/${clientId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    });
    setSavingProfile(false);
  }

  async function handleResendInvite() {
    if (!client) return;
    setResending(true);
    await fetch("/api/admin/resend-invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: client.email }),
    });
    setResending(false);
    setResent(true);
    setTimeout(() => setResent(false), 3000);
  }

  function loadProjectForm(proj: Project) {
    setProject(proj);
    const b = (proj.brief ?? {}) as Record<string, string>;
    setProjForm({
      name: proj.name,
      service_type: proj.service_type,
      goals: proj.goals ?? "",
      competition: proj.competition ?? "",
      status: proj.status,
      target_audience: b.target_audience ?? "",
      messaging: b.messaging ?? "",
      channels: b.channels ?? "",
      kpis: Array.isArray(proj.kpis) ? (proj.kpis as string[]) : [],
    });
  }

  function buildBriefAndKpis() {
    const brief = {
      target_audience: projForm.target_audience || null,
      messaging: projForm.messaging || null,
      channels: projForm.channels || null,
    };
    return {
      brief: Object.values(brief).some(Boolean) ? brief : null,
      kpis: projForm.kpis.length > 0 ? projForm.kpis : null,
    };
  }

  async function handleSaveProject() {
    if (!project) return;
    setSavingProject(true);
    setSaveError("");
    const { brief, kpis } = buildBriefAndKpis();
    const res = await fetch(`/api/admin/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: projForm.name, service_type: projForm.service_type, goals: projForm.goals, competition: projForm.competition, status: projForm.status, kpis, brief }),
    });
    const json = await res.json();
    setSavingProject(false);
    if (!res.ok) { setSaveError(json.error ?? "Save failed"); return; }
    setProject((p) => p ? { ...p, ...json.project } : p);
    setProjectSaved(true);
    setTimeout(() => setProjectSaved(false), 2500);
  }

  async function handleCreateProject() {
    if (!projForm.name) return;
    setSavingProject(true);
    setSaveError("");
    const { brief, kpis } = buildBriefAndKpis();
    const res = await fetch("/api/admin/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, name: projForm.name, service_type: projForm.service_type, goals: projForm.goals, competition: projForm.competition, status: "draft", kpis, brief }),
    });
    const json = await res.json();
    if (json.project) {
      setProject(json.project);
      setAllProjects((prev) => [json.project, ...prev]);
    } else {
      setSaveError(json.error ?? "Failed to create project");
    }
    setSavingProject(false);
  }

  async function handleAddContent(e: React.FormEvent) {
    e.preventDefault();
    if (!project || !contentForm.title) return;
    setAddingContent(true);

    const res = await fetch(`/api/admin/clients/${clientId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "add_content",
        project_id: project.id,
        title: contentForm.title,
        content_type: contentForm.content_type,
        platform: contentForm.platform || null,
        description: contentForm.description || null,
        scheduled_date: contentForm.scheduled_date || null,
        status: contentForm.status,
        created_by: adminId,
        file_urls: contentFileUrls.length > 0 ? contentFileUrls : null,
      }),
    });

    const json = await res.json();
    if (!res.ok) { alert(`Failed to add content: ${json.error}`); setAddingContent(false); return; }
    if (json.content) setContent((prev) => [json.content, ...prev]);
    setShowContentForm(false);
    setContentForm({ title: "", content_type: "post", platform: "", description: "", scheduled_date: "", status: "draft" });
    setContentFileUrls([]);
    setAddingContent(false);
  }

  async function handleContentFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !project) return;
    const isVideo = file.type.startsWith("video/");
    const maxBytes = isVideo ? 500 * 1024 * 1024 : 50 * 1024 * 1024;
    if (file.size > maxBytes) {
      alert(isVideo ? "Video too large. Maximum size is 500MB." : "File too large. Maximum size is 50MB.");
      e.target.value = "";
      return;
    }
    setUploadingContentFile(true);
    const path = `${project.id}/content-${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("assets").upload(path, file);
    if (error) { setUploadingContentFile(false); return; }
    const { data: { publicUrl } } = supabase.storage.from("assets").getPublicUrl(path);
    setContentFileUrls((prev) => [...prev, publicUrl]);
    setUploadingContentFile(false);
    if (contentFileRef.current) contentFileRef.current.value = "";
  }

  async function handleUploadAsset(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !project || !assetName) return;
    setUploadingAsset(true);
    const path = `${project.id}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("assets").upload(path, file);
    if (error) { setUploadingAsset(false); return; }
    const { data: urlData } = supabase.storage.from("assets").getPublicUrl(path);
    const { data } = await supabase.from("assets").insert({
      project_id: project.id,
      client_id: clientId,
      uploaded_by: adminId,
      name: assetName,
      file_url: urlData.publicUrl,
      file_type: file.type,
      file_size: file.size,
      category: assetCategory,
    }).select().single();
    if (data) setAssets((prev) => [data, ...prev]);
    setAssetName("");
    setUploadingAsset(false);
    if (assetRef.current) assetRef.current.value = "";
  }

  async function handleUploadDoc(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !project || !docTitle) return;
    if (file.size > 50 * 1024 * 1024) {
      alert("File too large. Maximum size is 50MB.");
      e.target.value = "";
      return;
    }
    setUploadingDoc(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("projectId", project.id);
    fd.append("clientId", clientId);
    fd.append("title", docTitle);
    fd.append("description", docDescription);
    const res = await fetch("/api/admin/upload-document", { method: "POST", body: fd });
    const json = await res.json();
    if (json.document) setDocuments((prev) => [json.document, ...prev]);
    setDocTitle("");
    setDocDescription("");
    setUploadingDoc(false);
    if (docRef.current) docRef.current.value = "";
  }

  async function handleAddMilestone(e: React.FormEvent) {
    e.preventDefault();
    if (!project || !msForm.title || !msForm.due_date) return;
    setAddingMs(true);
    const { data } = await supabase.from("milestones").insert({
      project_id: project.id,
      client_id: clientId,
      title: msForm.title,
      description: msForm.description || null,
      due_date: msForm.due_date,
      completed: false,
    }).select().single();
    if (data) setMilestones((prev) => [...prev, data].sort((a, b) => a.due_date.localeCompare(b.due_date)));
    setMsForm({ title: "", description: "", due_date: "" });
    setShowMilestoneForm(false);
    setAddingMs(false);
  }

  async function toggleMilestone(id: string, completed: boolean) {
    await supabase.from("milestones").update({ completed }).eq("id", id);
    setMilestones((prev) => prev.map((m) => m.id === id ? { ...m, completed } : m));
  }

  async function handleCreateForm(e: React.FormEvent) {
    e.preventDefault();
    if (!project || !fbTitle || fbFields.length === 0) return;
    setCreatingForm(true);
    const fields = fbFields.map((f) => ({
      id: f.id,
      label: f.label,
      type: f.type,
      required: f.required ?? false,
      options: (f.type === "select" || f.type === "multiselect" || f.type === "checkbox") && f.options ? f.options.split(",").map((o) => o.trim()).filter(Boolean) : undefined,
    }));
    const { data } = await supabase.from("forms").insert({
      project_id: project.id,
      client_id: clientId,
      title: fbTitle,
      description: fbDescription || null,
      fields,
      status: "pending",
    }).select().single();
    if (data) setForms((prev) => [data, ...prev]);
    setFbTitle("");
    setFbDescription("");
    setFbFields([]);
    setShowFormBuilder(false);
    setCreatingForm(false);
  }

  function addFormField(type: FormField["type"]) {
    setFbFields((prev) => [...prev, { id: crypto.randomUUID(), label: "", type, required: false }]);
  }

  async function handleSaveTemplate() {
    if (!fbTitle || fbFields.length === 0) return;
    const { data } = await supabase.from("form_templates").insert({
      title: fbTitle,
      description: fbDescription || null,
      fields: fbFields,
    }).select().single();
    if (data) setFormTemplates((prev) => [data as typeof formTemplates[0], ...prev]);
    alert(`Template "${fbTitle}" saved!`);
  }

  function loadTemplate(tpl: typeof formTemplates[0]) {
    setFbTitle(tpl.title);
    setFbDescription(tpl.description ?? "");
    setFbFields(tpl.fields);
    setShowTemplateList(false);
  }

  async function handleUploadContract(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !project || !contractTitle) return;
    if (file.size > 50 * 1024 * 1024) {
      setContractError("File too large. Maximum size is 50MB.");
      e.target.value = "";
      return;
    }
    setUploadingContract(true);
    setContractError("");
    const fd = new FormData();
    fd.append("file", file);
    fd.append("projectId", project.id);
    fd.append("title", contractTitle);
    fd.append("type", contractType);
    fd.append("clientId", clientId);
    const res = await fetch("/api/admin/upload-contract", { method: "POST", body: fd });
    const json = await res.json();
    if (!res.ok) {
      setContractError(json.error ?? "Upload failed");
      setUploadingContract(false);
      if (contractRef.current) contractRef.current.value = "";
      return;
    }
    setContracts((prev) => [json.contract, ...prev]);
    setContractTitle("");
    setUploadingContract(false);
    if (contractRef.current) contractRef.current.value = "";
  }

  async function handleUploadReport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !project || !reportTitle || !reportPeriod) return;
    if (file.size > 50 * 1024 * 1024) {
      setReportError("File too large. Maximum size is 50MB.");
      e.target.value = "";
      return;
    }
    setUploadingReport(true);
    setReportError("");
    const fd = new FormData();
    fd.append("file", file);
    fd.append("projectId", project.id);
    fd.append("title", reportTitle);
    fd.append("period", reportPeriod);
    fd.append("summary", reportSummary);
    fd.append("clientId", clientId);
    const res = await fetch("/api/admin/upload-report", { method: "POST", body: fd });
    const json = await res.json();
    if (!res.ok) {
      setReportError(json.error ?? "Upload failed");
      setUploadingReport(false);
      if (reportRef.current) reportRef.current.value = "";
      return;
    }
    setReports((prev) => [json.report, ...prev]);
    setReportTitle("");
    setReportPeriod("");
    setReportSummary("");
    setUploadingReport(false);
    if (reportRef.current) reportRef.current.value = "";
  }

  async function updateTicketStatus(id: string, status: Ticket["status"]) {
    await fetch(`/api/admin/tickets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setTickets((prev) => prev.map((t) => t.id === id ? { ...t, status } : t));
  }

  async function saveTicketResponse(id: string) {
    const response = ticketResponses[id] ?? "";
    setSavingResponse(id);
    setResponseError((prev) => ({ ...prev, [id]: "" }));
    setResponseSaved((prev) => ({ ...prev, [id]: false }));
    const res = await fetch(`/api/admin/tickets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ admin_response: response || null }),
    });
    if (res.ok) {
      setTickets((prev) => prev.map((t) => t.id === id ? { ...t, admin_response: response || null } : t));
      setResponseSaved((prev) => ({ ...prev, [id]: true }));
      setTimeout(() => setResponseSaved((prev) => ({ ...prev, [id]: false })), 3000);
    } else {
      const json = await res.json().catch(() => ({}));
      setResponseError((prev) => ({ ...prev, [id]: json.error ?? "Save failed" }));
    }
    setSavingResponse(null);
  }

  async function saveFeedbackReply(id: string) {
    const reply = feedbackReplies[id] ?? "";
    setSavingReply(id);
    const res = await fetch(`/api/admin/clients/${clientId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reply_feedback", feedback_id: id, reply }),
    });
    if (res.ok) {
      setFeedbackItems((prev) => prev.map((f) => f.id === id ? { ...f, admin_reply: reply || null } : f));
      setReplySaved((prev) => ({ ...prev, [id]: true }));
      setTimeout(() => setReplySaved((prev) => ({ ...prev, [id]: false })), 3000);
    }
    setSavingReply(null);
  }

  async function handleDeleteTicket(id: string) {
    if (!window.confirm("Remove this ticket? This cannot be undone.")) return;
    const res = await fetch(`/api/admin/tickets/${id}`, { method: "DELETE" });
    if (res.ok) setTickets((prev) => prev.filter((t) => t.id !== id));
  }

  async function sendTicketMessage(ticketId: string) {
    const text = (ticketMessages[ticketId] ?? "").trim();
    if (!text) return;
    const ticket = tickets.find((t) => t.id === ticketId);
    if (!ticket) return;
    const newMsg = { role: "admin" as const, text, created_at: new Date().toISOString() };
    const updated = [...(ticket.messages ?? []), newMsg];
    await supabase.from("tickets").update({ messages: updated as unknown as import("@/lib/supabase/types").Json }).eq("id", ticketId);
    setTickets((prev) => prev.map((t) => t.id === ticketId ? { ...t, messages: updated } : t));
    setTicketMessages((prev) => ({ ...prev, [ticketId]: "" }));
  }

  async function handleDeleteContract(id: string) {
    if (!window.confirm("Delete this contract/T&C? This cannot be undone.")) return;
    await fetch("/api/admin/delete", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ table: "contracts", id }) });
    setContracts((prev) => prev.filter((c) => c.id !== id));
  }

  async function handleDeleteReport(id: string) {
    if (!window.confirm("Delete this report? This cannot be undone.")) return;
    await fetch("/api/admin/delete", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ table: "reports", id }) });
    setReports((prev) => prev.filter((r) => r.id !== id));
  }

  async function handleDeleteDocument(id: string) {
    if (!window.confirm("Delete this document? This cannot be undone.")) return;
    await fetch("/api/admin/delete", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ table: "documents", id }) });
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  }

  async function handleDeleteContent(id: string) {
    if (!window.confirm("Delete this content item?")) return;
    await supabase.from("content_items").delete().eq("id", id);
    setContent((prev) => prev.filter((c) => c.id !== id));
  }

  async function handleDeleteAsset(asset: Asset) {
    if (!window.confirm("Delete this asset?")) return;
    const path = asset.file_url.split("/storage/v1/object/public/assets/")[1];
    if (path) await supabase.storage.from("assets").remove([path]);
    await supabase.from("assets").delete().eq("id", asset.id);
    setAssets((prev) => prev.filter((a) => a.id !== asset.id));
  }

  async function handleDeleteMilestone(id: string) {
    if (!window.confirm("Delete this milestone?")) return;
    await supabase.from("milestones").delete().eq("id", id);
    setMilestones((prev) => prev.filter((m) => m.id !== id));
  }

  async function handleDeleteForm(id: string) {
    if (!window.confirm("Delete this form?")) return;
    await supabase.from("forms").delete().eq("id", id);
    setForms((prev) => prev.filter((f) => f.id !== id));
  }

  async function handleDeleteProject(p: Project) {
    if (!window.confirm(`Delete project "${p.name}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/admin/projects/${p.id}`, { method: "DELETE" });
    if (res.ok) {
      setAllProjects((prev) => prev.filter((x) => x.id !== p.id));
      if (project?.id === p.id) setProject(allProjects.find((x) => x.id !== p.id) ?? null);
    }
  }

  async function handleUpdateContentStatus(itemId: string, newStatus: ContentItem["status"]) {
    await supabase.from("content_items").update({ status: newStatus }).eq("id", itemId);
    await supabase.from("notifications").insert({
      user_id: clientId,
      title: "Content Status Updated",
      message: `Your content has been moved to ${STATUS_CONFIG[newStatus]?.label ?? newStatus}`,
      type: "content",
      read: false,
      link: "/calendar",
    });
    setContent((prev) => prev.map((c) => c.id === itemId ? { ...c, status: newStatus } : c));
  }

  async function handleUpdateContentDate(itemId: string, newDate: string) {
    await supabase.from("content_items").update({ scheduled_date: newDate || null }).eq("id", itemId);
    setContent((prev) => prev.map((c) => c.id === itemId ? { ...c, scheduled_date: newDate || null } : c));
  }

  function openAdminDetail(item: ContentItem) {
    setAdminSelected(item);
    setAdminMediaIndex(0);
    setAdminEditDesc(item.description ?? "");
    setAdminEditFileUrls(item.file_urls ?? []);
  }

  async function handleEditFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !project) return;
    const isVideo = file.type.startsWith("video/");
    const maxBytes = isVideo ? 500 * 1024 * 1024 : 50 * 1024 * 1024;
    if (file.size > maxBytes) {
      alert(isVideo ? "Video too large. Max 500MB." : "File too large. Max 50MB.");
      e.target.value = "";
      return;
    }
    setUploadingEditFile(true);
    const path = `${project.id}/content-${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("assets").upload(path, file);
    if (error) { setUploadingEditFile(false); return; }
    const { data: { publicUrl } } = supabase.storage.from("assets").getPublicUrl(path);
    setAdminEditFileUrls((prev) => [...prev, publicUrl]);
    setUploadingEditFile(false);
    if (adminEditFileRef.current) adminEditFileRef.current.value = "";
  }

  async function handleSaveContentEdit() {
    if (!adminSelected || !clientId) return;
    setSavingEdit(true);
    const res = await fetch(`/api/admin/clients/${clientId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update_content",
        content_id: adminSelected.id,
        description: adminEditDesc || null,
        file_urls: adminEditFileUrls.length > 0 ? adminEditFileUrls : null,
      }),
    });
    const json = await res.json();
    if (!res.ok) { alert(`Failed to save: ${json.error}`); setSavingEdit(false); return; }
    const updated = json.content as ContentItem;
    setContent((prev) => prev.map((c) => c.id === updated.id ? updated : c));
    setAdminSelected(null);
    setSavingEdit(false);
  }

  const inputClass = "w-full px-3.5 py-2.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[var(--foreground)] text-sm outline-none focus:border-[var(--accent)] transition-all";
  const labelClass = "text-xs font-medium text-[var(--foreground-muted)] block mb-1.5";

  function BriefSection({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          {icon}
          <h4 className="text-xs font-semibold text-[var(--foreground)] uppercase tracking-wider">{title}</h4>
        </div>
        <div className="pl-6">{children}</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3">
        <p className="text-sm text-[var(--foreground-muted)]">Client not found.</p>
        <Button variant="secondary" onClick={() => router.push("/admin/clients")}>Back to Clients</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="border-b border-[var(--border)] px-6 py-4">
        <button
          onClick={() => router.push("/admin/clients")}
          className="flex items-center gap-2 text-xs text-[var(--foreground-subtle)] hover:text-[var(--foreground)] transition-colors mb-3 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Clients
        </button>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-[var(--accent-subtle)] border border-[var(--accent)]/20 flex items-center justify-center flex-shrink-0 overflow-hidden text-base font-bold text-[var(--accent)]">
            {client.avatar_url ? (
              <img src={client.avatar_url} alt={client.full_name} className="w-full h-full object-cover" />
            ) : (
              client.full_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-[var(--foreground)]">{client.full_name}</h1>
            <p className="text-sm text-[var(--foreground-muted)]">
              {client.company_name ? `${client.company_name} · ${client.email}` : client.email}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <label className="text-xs text-[var(--foreground-subtle)]">Portal view</label>
            <select
              value={clientServiceType}
              onChange={(e) => handleSaveServiceType(e.target.value as Profile["service_type"])}
              disabled={savingServiceType}
              className="text-xs px-2.5 py-1.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[var(--foreground)] outline-none focus:border-[var(--accent)] transition-all cursor-pointer disabled:opacity-50"
            >
              <option value="social_media">Social Media</option>
              <option value="brand">Brand</option>
              <option value="website">Website</option>
              <option value="both">Full Service</option>
              <option value="marketing">Marketing</option>
            </select>
            {savingServiceType && <span className="text-xs text-[var(--foreground-subtle)]">Saving…</span>}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background: "#111113", borderBottom: "1px solid #27272a", display: "flex", overflowX: "auto", padding: "0 8px", flexShrink: 0 }}>
        {getVisibleTabs(clientServiceType ?? "social_media").map((t) => (
          <button
            key={t}
            onClick={() => changeTab(t)}
            style={{
              padding: "12px 16px",
              fontSize: "14px",
              fontWeight: 500,
              whiteSpace: "nowrap",
              flexShrink: 0,
              cursor: "pointer",
              background: "none",
              border: "none",
              borderBottom: tab === t ? "2px solid #ed0194" : "2px solid transparent",
              color: tab === t ? "#ed0194" : "#a1a1aa",
              transition: "color 0.15s",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex-1 p-6 animate-fade-in">

        {/* ── OVERVIEW TAB ── */}
        {tab === "Overview" && (
          <div className="max-w-3xl space-y-5">

            {/* Client Info */}
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-[var(--foreground-subtle)] mb-1">Email</p>
                <p className="text-sm text-[var(--foreground)]">{client.email}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--foreground-subtle)] mb-1">Company</p>
                <p className="text-sm text-[var(--foreground)]">{client.company_name ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--foreground-subtle)] mb-1">Joined</p>
                <p className="text-sm text-[var(--foreground)]">{formatDate(client.created_at)}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--foreground-subtle)] mb-1">Service</p>
                <p className="text-sm text-[var(--foreground)]">{SERVICE_TYPES.find((t) => t.value === projForm.service_type)?.label ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--foreground-subtle)] mb-1">Portal Role</p>
                <select
                  value={clientRoleState}
                  onChange={(e) => {
                    const val = e.target.value as "ceo" | "member";
                    setClientRoleState(val);
                    handleSaveClientProfile({ client_role: val });
                  }}
                  className="text-xs px-2.5 py-1.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[var(--foreground)] outline-none focus:border-[var(--accent)] transition-all cursor-pointer w-full"
                >
                  <option value="ceo">CEO — full access</option>
                  <option value="member">Member — no contracts</option>
                </select>
              </div>
              <div>
                <p className="text-xs text-[var(--foreground-subtle)] mb-1">Job Title</p>
                <input
                  type="text"
                  value={jobTitleState}
                  onChange={(e) => setJobTitleState(e.target.value)}
                  onBlur={() => handleSaveClientProfile({ job_title: jobTitleState })}
                  placeholder="e.g. Marketing Manager"
                  className="text-xs px-2.5 py-1.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[var(--foreground)] outline-none focus:border-[var(--accent)] transition-all w-full placeholder:text-[var(--foreground-subtle)]"
                />
              </div>
              {savingProfile && (
                <p className="col-span-2 text-xs text-[var(--foreground-subtle)]">Saving…</p>
              )}
              <div className="col-span-2 pt-1 border-t border-[var(--border)]">
                <Button variant="secondary" size="sm" loading={resending} onClick={handleResendInvite} className="gap-2 w-full">
                  <Mail className="w-3.5 h-3.5" />
                  {resent ? "✓ Invite sent" : "Resend Invite / Password Reset"}
                </Button>
              </div>
            </div>

            {/* Projects info cards */}
            {allProjects.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-[var(--foreground-muted)] uppercase tracking-wider">All Projects</p>
                  <button
                    onClick={() => {
                      setProject(null);
                      setProjForm({ name: "", service_type: "social_media", goals: "", competition: "", status: "active", target_audience: "", messaging: "", channels: "", kpis: [] });
                      setSaveError("");
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium border border-dashed border-[var(--border)] text-[var(--foreground-subtle)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Plus className="w-3 h-3" /> New Project
                  </button>
                </div>
                {allProjects.map((p) => (
                  <div
                    key={p.id}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-xl border transition-all",
                      project?.id === p.id
                        ? "bg-[var(--accent-subtle)] border-[var(--accent)]/40"
                        : "bg-[var(--surface)] border-[var(--border)]"
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--foreground)] truncate">{p.name}</p>
                      <p className="text-xs text-[var(--foreground-subtle)]">
                        {SERVICE_TYPES.find((t) => t.value === p.service_type)?.label ?? p.service_type}
                        {" · "}
                        {formatDate(p.created_at)}
                      </p>
                    </div>
                    <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0", p.status === "active" ? "bg-emerald-400/15 text-emerald-400" : p.status === "draft" ? "bg-zinc-400/15 text-zinc-400" : "bg-amber-400/15 text-amber-400")}>
                      {p.status}
                    </span>
                    <button
                      onClick={() => loadProjectForm(p)}
                      className="text-xs text-[var(--accent)] hover:underline flex-shrink-0 cursor-pointer"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteProject(p)}
                      className="w-6 h-6 flex items-center justify-center text-[var(--foreground-subtle)] hover:text-red-400 transition-colors cursor-pointer flex-shrink-0"
                      title="Delete project"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Project Settings */}
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-semibold text-[var(--foreground)]">{project ? "Project Settings" : "Create Project"}</h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className={labelClass}>Project Name *</label>
                  <input type="text" value={projForm.name} onChange={(e) => setProjForm((f) => ({ ...f, name: e.target.value }))} placeholder="Project name" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Service Package</label>
                  <select value={projForm.service_type} onChange={(e) => setProjForm((f) => ({ ...f, service_type: e.target.value }))} className={inputClass}>
                    {SERVICE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Status</label>
                  <select value={projForm.status} onChange={(e) => setProjForm((f) => ({ ...f, status: e.target.value }))} className={inputClass}>
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Project Brief */}
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 space-y-5">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[var(--accent)]" />
                <h3 className="text-sm font-semibold text-[var(--foreground)]">Project Brief</h3>
              </div>

              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Target className="w-3.5 h-3.5 text-[var(--foreground-subtle)]" />
                  <label className={labelClass}>Goals & Hypothesis</label>
                </div>
                <textarea rows={3} value={projForm.goals} onChange={(e) => setProjForm((f) => ({ ...f, goals: e.target.value }))} placeholder="What are the overarching goals? What's your hypothesis for this project?" className={`${inputClass} resize-none`} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Users className="w-3.5 h-3.5 text-[var(--foreground-subtle)]" />
                    <label className={labelClass}>Target Audience</label>
                  </div>
                  <textarea rows={3} value={projForm.target_audience} onChange={(e) => setProjForm((f) => ({ ...f, target_audience: e.target.value }))} placeholder="Demographics, interests, platform behaviour..." className={`${inputClass} resize-none`} />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Megaphone className="w-3.5 h-3.5 text-[var(--foreground-subtle)]" />
                    <label className={labelClass}>Main Messaging</label>
                  </div>
                  <textarea rows={3} value={projForm.messaging} onChange={(e) => setProjForm((f) => ({ ...f, messaging: e.target.value }))} placeholder="Key messages, tone of voice, primary CTA..." className={`${inputClass} resize-none`} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Radio className="w-3.5 h-3.5 text-[var(--foreground-subtle)]" />
                    <label className={labelClass}>Distribution Channels</label>
                  </div>
                  <textarea rows={2} value={projForm.channels} onChange={(e) => setProjForm((f) => ({ ...f, channels: e.target.value }))} placeholder="Instagram, TikTok, Email, Website..." className={`${inputClass} resize-none`} />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Trophy className="w-3.5 h-3.5 text-[var(--foreground-subtle)]" />
                    <label className={labelClass}>Competitive Landscape</label>
                  </div>
                  <textarea rows={2} value={projForm.competition} onChange={(e) => setProjForm((f) => ({ ...f, competition: e.target.value }))} placeholder="Key competitors, differentiators..." className={`${inputClass} resize-none`} />
                </div>
              </div>
            </div>

            {/* KPIs */}
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 space-y-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[var(--accent)]" />
                <h3 className="text-sm font-semibold text-[var(--foreground)]">KPIs & Success Metrics</h3>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={kpiInput}
                  onChange={(e) => setKpiInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (kpiInput.trim()) {
                        setProjForm((f) => ({ ...f, kpis: [...f.kpis, kpiInput.trim()] }));
                        setKpiInput("");
                      }
                    }
                  }}
                  placeholder="e.g. Increase engagement by 20% — press Enter to add"
                  className={inputClass}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    if (kpiInput.trim()) {
                      setProjForm((f) => ({ ...f, kpis: [...f.kpis, kpiInput.trim()] }));
                      setKpiInput("");
                    }
                  }}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              {projForm.kpis.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {projForm.kpis.map((kpi, i) => (
                    <div key={i} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--foreground-muted)]">
                      <TrendingUp className="w-3 h-3 text-[var(--accent)] flex-shrink-0" />
                      {kpi}
                      <button
                        onClick={() => setProjForm((f) => ({ ...f, kpis: f.kpis.filter((_, j) => j !== i) }))}
                        className="text-[var(--foreground-subtle)] hover:text-red-400 transition-colors cursor-pointer ml-1"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[var(--foreground-subtle)]">No KPIs added yet.</p>
              )}
            </div>

            {/* Save */}
            <div className="space-y-2">
              <Button onClick={project ? handleSaveProject : handleCreateProject} loading={savingProject} className="w-full">
                {projectSaved ? "✓ Saved" : project ? <><Save className="w-4 h-4" /> Save Project</> : <><Plus className="w-4 h-4" /> Create Project</>}
              </Button>
              {saveError && <p className="text-xs text-red-400">{saveError}</p>}
            </div>

            {/* Brief Preview */}
            {project && (projForm.goals || projForm.target_audience || projForm.messaging || projForm.channels || projForm.competition || projForm.kpis.length > 0 || milestones.length > 0) && (
              <div className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-zinc-800 flex items-center gap-2">
                  <Eye className="w-4 h-4 text-[var(--accent)]" />
                  <h3 className="text-sm font-semibold text-[var(--foreground)]">Project Brief Preview</h3>
                  <span className="text-xs text-[var(--foreground-subtle)] ml-auto">
                    {client.company_name ?? client.full_name} · {SERVICE_TYPES.find((t) => t.value === projForm.service_type)?.label}
                  </span>
                </div>
                <div className="p-6 space-y-6">
                  {projForm.goals && (
                    <BriefSection icon={<Target className="w-4 h-4 text-[var(--accent)]" />} title="Goals & Hypothesis">
                      <p className="text-sm text-[var(--foreground-muted)] whitespace-pre-line leading-relaxed">{projForm.goals}</p>
                    </BriefSection>
                  )}
                  {(projForm.target_audience || projForm.messaging) && (
                    <div className="grid grid-cols-2 gap-6">
                      {projForm.target_audience && (
                        <BriefSection icon={<Users className="w-4 h-4 text-blue-400" />} title="Target Audience">
                          <p className="text-sm text-[var(--foreground-muted)] whitespace-pre-line leading-relaxed">{projForm.target_audience}</p>
                        </BriefSection>
                      )}
                      {projForm.messaging && (
                        <BriefSection icon={<Megaphone className="w-4 h-4 text-amber-400" />} title="Main Messaging">
                          <p className="text-sm text-[var(--foreground-muted)] whitespace-pre-line leading-relaxed">{projForm.messaging}</p>
                        </BriefSection>
                      )}
                    </div>
                  )}
                  {(projForm.channels || projForm.competition) && (
                    <div className="grid grid-cols-2 gap-6">
                      {projForm.channels && (
                        <BriefSection icon={<Radio className="w-4 h-4 text-emerald-400" />} title="Distribution Channels">
                          <p className="text-sm text-[var(--foreground-muted)] whitespace-pre-line leading-relaxed">{projForm.channels}</p>
                        </BriefSection>
                      )}
                      {projForm.competition && (
                        <BriefSection icon={<Trophy className="w-4 h-4 text-orange-400" />} title="Competitive Landscape">
                          <p className="text-sm text-[var(--foreground-muted)] whitespace-pre-line leading-relaxed">{projForm.competition}</p>
                        </BriefSection>
                      )}
                    </div>
                  )}
                  {projForm.kpis.length > 0 && (
                    <BriefSection icon={<TrendingUp className="w-4 h-4 text-[var(--accent)]" />} title="KPIs & Success Metrics">
                      <div className="space-y-1.5">
                        {projForm.kpis.map((kpi, i) => (
                          <div key={i} className="flex items-center gap-2 text-sm text-[var(--foreground-muted)]">
                            <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] flex-shrink-0" />
                            {kpi}
                          </div>
                        ))}
                      </div>
                    </BriefSection>
                  )}
                  {milestones.length > 0 && (
                    <BriefSection icon={<Milestone className="w-4 h-4 text-purple-400" />} title="Key Project Milestones">
                      <div className="space-y-2">
                        {milestones.slice(0, 5).map((m) => (
                          <div key={m.id} className="flex items-center gap-3">
                            {m.completed
                              ? <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                              : <Circle className="w-4 h-4 text-zinc-600 flex-shrink-0" />}
                            <span className={cn("text-sm text-[var(--foreground-muted)] flex-1", m.completed && "line-through opacity-50")}>{m.title}</span>
                            <span className="text-xs text-[var(--foreground-subtle)]">{formatDate(m.due_date)}</span>
                          </div>
                        ))}
                        {milestones.length > 5 && (
                          <p className="text-xs text-[var(--foreground-subtle)] pl-7">+{milestones.length - 5} more — see Timeline tab</p>
                        )}
                      </div>
                    </BriefSection>
                  )}
                  {content.length > 0 && (
                    <BriefSection icon={<ImageIcon className="w-4 h-4 text-zinc-400" />} title="Content Items">
                      <p className="text-sm text-[var(--foreground-muted)]">
                        {content.length} item{content.length !== 1 ? "s" : ""} scheduled
                        {content.filter((c) => c.status === "published").length > 0 && ` · ${content.filter((c) => c.status === "published").length} published`}
                        {content.filter((c) => c.status === "in_review").length > 0 && ` · ${content.filter((c) => c.status === "in_review").length} in review`}
                      </p>
                    </BriefSection>
                  )}
                </div>
              </div>
            )}
            {/* Team Members */}
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-[var(--accent)]" />
                  <h3 className="text-sm font-semibold text-[var(--foreground)]">Team Members</h3>
                  <span className="text-xs text-[var(--foreground-subtle)]">({members.length})</span>
                </div>
                <Button size="sm" variant="secondary" className="gap-1.5" onClick={() => { setShowAddMember(true); setAddMemberError(""); setAddMemberSuccess(""); }}>
                  <Plus className="w-3.5 h-3.5" /> Add Member
                </Button>
              </div>

              {members.length === 0 ? (
                <p className="text-xs text-[var(--foreground-subtle)]">No additional team members yet.</p>
              ) : (
                <div className="space-y-2">
                  {members.map((m) => (
                    <div key={m.id} className="flex items-center gap-3 py-2 border-b border-[var(--border)] last:border-0">
                      <div className="w-7 h-7 rounded-full bg-[var(--accent-subtle)] flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-[var(--accent)]">
                        {m.profiles?.full_name?.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--foreground)] truncate">{m.profiles?.full_name}</p>
                        <p className="text-xs text-[var(--foreground-subtle)] truncate">{m.profiles?.email}</p>
                      </div>
                      {(m.profiles as { job_title?: string })?.job_title && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[var(--accent-subtle)] text-[var(--accent)] border border-[var(--accent)]/20 flex-shrink-0 max-w-[120px] truncate">
                          {(m.profiles as { job_title?: string }).job_title}
                        </span>
                      )}
                      <button
                        onClick={() => handleToggleRole(m.user_id, m.profiles?.client_role ?? "member")}
                        title="Click to toggle role"
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 cursor-pointer transition-all ${
                          m.profiles?.client_role === "ceo"
                            ? "bg-emerald-400/10 text-emerald-400 hover:bg-emerald-400/20"
                            : "bg-zinc-500/10 text-zinc-400 hover:bg-zinc-500/20"
                        }`}
                      >
                        {m.profiles?.client_role === "ceo" ? "CEO" : "member"}
                      </button>
                      <button
                        onClick={() => handleMemberReset(m.user_id, m.profiles?.email)}
                        title="Send password reset email"
                        className="w-6 h-6 flex items-center justify-center text-[var(--foreground-subtle)] hover:text-[var(--accent)] transition-colors cursor-pointer flex-shrink-0"
                      >
                        {memberResetSent[m.user_id]
                          ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          : <Mail className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => handleRemoveMember(m.id, m.user_id)}
                        className="w-6 h-6 flex items-center justify-center text-[var(--foreground-subtle)] hover:text-red-400 transition-colors cursor-pointer flex-shrink-0"
                        title="Remove member"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {showAddMember && (
                <form onSubmit={handleAddMember} className="pt-3 border-t border-[var(--border)] space-y-3">
                  {addMemberSuccess ? (
                    <div className="flex items-center gap-2 text-sm text-emerald-400">
                      <Mail className="w-4 h-4" /> {addMemberSuccess}
                      <button type="button" onClick={() => setShowAddMember(false)} className="ml-auto text-[var(--foreground-subtle)] hover:text-[var(--foreground)] cursor-pointer"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          required
                          type="text"
                          placeholder="Full name"
                          value={memberForm.fullName}
                          onChange={(e) => setMemberForm((f) => ({ ...f, fullName: e.target.value }))}
                          className="px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)] transition-all"
                        />
                        <input
                          required
                          type="email"
                          placeholder="Email address"
                          value={memberForm.email}
                          onChange={(e) => setMemberForm((f) => ({ ...f, email: e.target.value }))}
                          className="px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)] transition-all"
                        />
                        <input
                          type="text"
                          placeholder="Role / job title (optional)"
                          value={memberForm.jobTitle}
                          onChange={(e) => setMemberForm((f) => ({ ...f, jobTitle: e.target.value }))}
                          className="col-span-2 px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)] transition-all"
                        />
                      </div>
                      {addMemberError && <p className="text-xs text-red-400">{addMemberError}</p>}
                      <div className="flex gap-2">
                        <Button type="button" variant="secondary" size="sm" onClick={() => setShowAddMember(false)}>Cancel</Button>
                        <Button type="submit" size="sm" loading={addingMember} className="gap-1.5"><Mail className="w-3.5 h-3.5" /> Send Invite</Button>
                      </div>
                    </>
                  )}
                </form>
              )}
            </div>

          </div>
        )}

        {/* ── CONTENT TAB ── */}
        {tab === "Content" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-[var(--foreground-muted)]">{content.length} item{content.length !== 1 ? "s" : ""}</p>
              {project && (
                <Button onClick={() => setShowContentForm(true)} size="sm" className="gap-2">
                  <Plus className="w-4 h-4" /> Add Content
                </Button>
              )}
            </div>

            {content.length > 0 && (() => {
              const statuses: Array<{ key: ContentItem["status"] | "all"; label: string; color: string }> = [
                { key: "all", label: "All", color: "border-[var(--border)] text-[var(--foreground-muted)] data-[active=true]:bg-[var(--surface-2)] data-[active=true]:border-zinc-500 data-[active=true]:text-[var(--foreground)]" },
                { key: "draft", label: "Draft", color: "data-[active=true]:bg-zinc-500/15 data-[active=true]:border-zinc-500/40 data-[active=true]:text-zinc-300" },
                { key: "in_review", label: "In Review", color: "data-[active=true]:bg-amber-400/15 data-[active=true]:border-amber-400/40 data-[active=true]:text-amber-400" },
                { key: "approved", label: "Approved", color: "data-[active=true]:bg-emerald-400/15 data-[active=true]:border-emerald-400/40 data-[active=true]:text-emerald-400" },
                { key: "rejected", label: "Rejected", color: "data-[active=true]:bg-red-400/15 data-[active=true]:border-red-400/40 data-[active=true]:text-red-400" },
                { key: "published", label: "Published", color: "data-[active=true]:bg-[var(--accent-subtle)] data-[active=true]:border-[var(--accent)]/40 data-[active=true]:text-[var(--accent)]" },
              ];
              const platforms = PLATFORM_ORDER.filter((p) => content.some((i) => i.platform === p));
              const statusCounts = {
                draft: content.filter((i) => i.status === "draft").length,
                in_review: content.filter((i) => i.status === "in_review").length,
                approved: content.filter((i) => i.status === "approved").length,
                rejected: content.filter((i) => i.status === "rejected").length,
                published: content.filter((i) => i.status === "published").length,
              };
              return (
                <div className="space-y-3">
                  {/* Stats row */}
                  <div className="grid grid-cols-5 gap-2">
                    {(["draft", "in_review", "approved", "rejected", "published"] as const).map((s) => {
                      const cfg = STATUS_CONFIG[s];
                      return (
                        <button key={s} onClick={() => setAdminContentStatus(adminContentStatus === s ? "all" : s)}
                          className={cn("p-2.5 rounded-lg border text-left transition-all cursor-pointer", adminContentStatus === s ? "bg-[var(--surface-2)] border-zinc-600" : "bg-[var(--surface)] border-[var(--border)] hover:border-zinc-600")}>
                          <p className="text-base font-bold text-[var(--foreground)]">{statusCounts[s]}</p>
                          <p className={cn("text-[10px] font-medium mt-0.5", cfg?.color ?? "text-zinc-400")}>{cfg?.label ?? s}</p>
                        </button>
                      );
                    })}
                  </div>
                  {/* Status pills */}
                  <div className="flex gap-1.5 flex-wrap">
                    {statuses.map(({ key, label, color }) => {
                      const count = key === "all" ? content.length : statusCounts[key as keyof typeof statusCounts];
                      return (
                        <button key={key} data-active={adminContentStatus === key}
                          onClick={() => setAdminContentStatus(key)}
                          className={cn("px-3 py-1 rounded-full text-xs font-medium border border-[var(--border)] text-[var(--foreground-subtle)] hover:border-zinc-600 transition-all cursor-pointer", color)}>
                          {label} {count > 0 && <span className="opacity-70">({count})</span>}
                        </button>
                      );
                    })}
                  </div>
                  {/* Platform pills */}
                  {platforms.length > 0 && (
                    <div className="flex gap-1.5 flex-wrap">
                      <button data-active={adminContentPlatform === "all"}
                        onClick={() => setAdminContentPlatform("all")}
                        className="px-3 py-1 rounded-full text-xs font-medium border border-[var(--border)] text-[var(--foreground-subtle)] hover:border-zinc-600 transition-all cursor-pointer data-[active=true]:bg-[var(--surface-2)] data-[active=true]:border-zinc-500 data-[active=true]:text-[var(--foreground)]">
                        All Platforms
                      </button>
                      {platforms.map((p) => {
                        const cfg = PLATFORM_CONFIG[p];
                        const count = content.filter((i) => i.platform === p).length;
                        return (
                          <button key={p} data-active={adminContentPlatform === p}
                            onClick={() => setAdminContentPlatform(p)}
                            className={cn("px-3 py-1 rounded-full text-xs font-medium border border-[var(--border)] transition-all cursor-pointer", cfg ? `hover:${cfg.pill} data-[active=true]:${cfg.pill}` : "text-zinc-400")}>
                            {p} <span className="opacity-70">({count})</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}

            {!project && <div className="text-center py-12 text-sm text-[var(--foreground-subtle)]">Create a project first before adding content.</div>}

            {showContentForm && (
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 space-y-4 max-w-2xl">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-[var(--foreground)]">New Content Item</h4>
                  <button onClick={() => setShowContentForm(false)} className="text-[var(--foreground-subtle)] hover:text-[var(--foreground)] cursor-pointer"><X className="w-4 h-4" /></button>
                </div>
                <form onSubmit={handleAddContent} className="space-y-3">
                  <div>
                    <label className={labelClass}>Title *</label>
                    <input type="text" required value={contentForm.title} onChange={(e) => setContentForm((f) => ({ ...f, title: e.target.value }))} placeholder="Content title" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Type</label>
                    <select value={contentForm.content_type} onChange={(e) => setContentForm((f) => ({ ...f, content_type: e.target.value as ContentItem["content_type"] }))} className={inputClass}>
                      {CONTENT_TYPES.map((t) => <option key={t} value={t} className="capitalize">{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Platform</label>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => setContentForm((f) => ({ ...f, platform: "" }))}
                        className={cn(
                          "px-3 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer",
                          !contentForm.platform
                            ? "bg-[var(--surface)] border-[var(--foreground-muted)] text-[var(--foreground)]"
                            : "border-[var(--border)] text-[var(--foreground-subtle)] hover:text-[var(--foreground-muted)]"
                        )}
                      >
                        None
                      </button>
                      {PLATFORMS.map((p) => {
                        const cfg = PLATFORM_CONFIG[p];
                        const active = contentForm.platform === p;
                        return (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setContentForm((f) => ({ ...f, platform: p }))}
                            className={cn(
                              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer",
                              active ? cfg.pill : "border-[var(--border)] text-[var(--foreground-subtle)] hover:text-[var(--foreground-muted)]"
                            )}
                          >
                            <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", cfg.dot)} />
                            {p}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>Scheduled Date</label>
                      <input type="date" value={contentForm.scheduled_date} onChange={(e) => setContentForm((f) => ({ ...f, scheduled_date: e.target.value }))} className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>Status</label>
                      <select value={contentForm.status} onChange={(e) => setContentForm((f) => ({ ...f, status: e.target.value as ContentItem["status"] }))} className={inputClass}>
                        <option value="draft">Draft</option>
                        <option value="in_review">In Review</option>
                        <option value="approved">Approved</option>
                        <option value="published">Published</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Description</label>
                    <textarea rows={3} value={contentForm.description} onChange={(e) => setContentForm((f) => ({ ...f, description: e.target.value }))} placeholder="Content description or notes..." className={`${inputClass} resize-none`} />
                  </div>
                  <div>
                    <label className={labelClass}>Attachments (PDF, images, videos)</label>
                    <input ref={contentFileRef} type="file" accept=".pdf,image/*,video/*" onChange={handleContentFileUpload} className="hidden" />
                    <button
                      type="button"
                      onClick={() => contentFileRef.current?.click()}
                      disabled={uploadingContentFile}
                      className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg border border-dashed border-[var(--border)] text-[var(--foreground-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-all cursor-pointer disabled:opacity-50"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      {uploadingContentFile ? "Uploading…" : "Attach file"}
                    </button>
                    {contentFileUrls.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {contentFileUrls.map((url, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs text-[var(--foreground-muted)]">
                            <span className="truncate flex-1">{url.split("/").pop()}</span>
                            <button type="button" onClick={() => setContentFileUrls((p) => p.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-300 cursor-pointer flex-shrink-0">
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <Button type="button" variant="secondary" className="flex-1" onClick={() => { setShowContentForm(false); setContentFileUrls([]); }}>Cancel</Button>
                    <Button type="submit" className="flex-1" loading={addingContent}>Add Content</Button>
                  </div>
                </form>
              </div>
            )}

            {project && content.length === 0 && !showContentForm && (
              <div className="text-center py-12">
                <ImageIcon className="w-10 h-10 text-[var(--foreground-subtle)] mx-auto mb-3" />
                <p className="text-sm text-[var(--foreground-muted)]">No content yet</p>
              </div>
            )}

            {/* Card grid grouped by platform */}
            {content.length > 0 && (() => {
              const filtered = content.filter((i) =>
                (adminContentStatus === "all" || i.status === adminContentStatus) &&
                (adminContentPlatform === "all" || i.platform === adminContentPlatform)
              );
              const grouped: Record<string, ContentItem[]> = {};
              for (const p of PLATFORM_ORDER) {
                const g = filtered.filter((i) => i.platform === p);
                if (g.length) grouped[p] = g;
              }
              const other = filtered.filter((i) => !i.platform || !PLATFORM_ORDER.includes(i.platform));
              if (other.length) grouped["Other"] = other;
              if (filtered.length === 0) return (
                <div className="text-center py-12">
                  <ImageIcon className="w-10 h-10 text-[var(--foreground-subtle)] mx-auto mb-3" />
                  <p className="text-sm text-[var(--foreground-muted)]">No content matches the current filters</p>
                </div>
              );
              return (
                <div className="space-y-8">
                  {Object.entries(grouped).map(([platform, items]) => {
                    const cfg = PLATFORM_CONFIG[platform];
                    return (
                      <div key={platform}>
                        <div className="flex items-center gap-3 mb-4">
                          {cfg ? <span className={cn("w-2.5 h-2.5 rounded-full flex-shrink-0", cfg.dot)} /> : <Globe className="w-4 h-4 text-zinc-500" />}
                          <h3 className={cn("text-sm font-bold", cfg?.color ?? "text-zinc-400")}>{platform}</h3>
                          <span className="text-xs text-[var(--foreground-subtle)] bg-[var(--surface)] border border-[var(--border)] px-2 py-0.5 rounded-full">{items.length}</span>
                          <div className="flex-1 h-px bg-[var(--border)]" />
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                          {items.map((item) => {
                            const thumb = item.file_urls?.[0];
                            const platCfg = item.platform ? PLATFORM_CONFIG[item.platform] : null;
                            const CIcon = contentIconFn(item.content_type);
                            return (
                              <button
                                key={item.id}
                                onClick={() => openAdminDetail(item)}
                                className="group text-left bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden hover:border-zinc-600 transition-all w-full"
                              >
                                <div className={cn("relative aspect-[4/3] bg-[var(--surface-2)] flex items-center justify-center overflow-hidden", !thumb && platCfg ? `bg-gradient-to-br ${platCfg.bg}` : "")}>
                                  {thumb ? (
                                    <img src={thumb} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                                  ) : (
                                    <CIcon className="w-8 h-8 text-[var(--foreground-subtle)] opacity-40" />
                                  )}
                                  <div className="absolute top-2 right-2">
                                    <div className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold",
                                      item.status === "approved" ? "bg-emerald-400 text-zinc-900" :
                                      item.status === "published" ? "bg-[var(--accent)] text-white" :
                                      item.status === "rejected" ? "bg-red-400 text-zinc-900" :
                                      item.status === "in_review" ? "bg-amber-400 text-zinc-900" :
                                      "bg-zinc-700 text-zinc-300"
                                    )}>
                                      {STATUS_CONFIG[item.status as keyof typeof STATUS_CONFIG]?.label ?? item.status}
                                    </div>
                                  </div>
                                </div>
                                <div className="p-3 space-y-2">
                                  <p className="text-sm font-semibold text-[var(--foreground)] line-clamp-2 leading-tight">{item.title}</p>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className={cn("text-[10px] font-medium capitalize px-2 py-0.5 rounded border", TYPE_PILL[item.content_type] ?? TYPE_PILL.other)}>{item.content_type}</span>
                                    {item.platform && platCfg && (
                                      <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded border flex items-center gap-1", platCfg.pill)}>
                                        <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", platCfg.dot)} />
                                        {item.platform}
                                      </span>
                                    )}
                                  </div>
                                  {item.scheduled_date && <p className="text-[10px] text-[var(--foreground-subtle)]">{formatDate(item.scheduled_date)}</p>}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}

        {/* ── ADMIN CONTENT DETAIL MODAL ── */}
        {adminSelected && (() => {
          const media = adminSelected.file_urls ?? [];
          const s = STATUS_CONFIG[adminSelected.status as keyof typeof STATUS_CONFIG];
          return (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setAdminSelected(null)}>
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col md:flex-row overflow-hidden animate-fade-in" onClick={(e) => e.stopPropagation()}>
                {/* Media */}
                <div className="relative bg-black flex items-center justify-center md:w-[55%] flex-shrink-0 min-h-[220px]">
                  {media.length > 0 ? (
                    <>
                      {/\.(mp4|mov|webm|ogg|avi)$/i.test(media[adminMediaIndex]) ? (
                        <video src={media[adminMediaIndex]} controls className="max-w-full max-h-[480px]" />
                      ) : isImageUrl(media[adminMediaIndex]) ? (
                        <img src={media[adminMediaIndex]} alt={adminSelected.title} className="max-w-full max-h-[480px] object-contain" />
                      ) : (
                        <div className="flex flex-col items-center gap-3 p-8">
                          <Paperclip className="w-8 h-8 text-zinc-400" />
                          <a href={media[adminMediaIndex]} target="_blank" rel="noopener noreferrer" className="text-sm text-[var(--accent)] hover:underline">View file</a>
                        </div>
                      )}
                      {media.length > 1 && (
                        <>
                          <button onClick={() => setAdminMediaIndex((i) => Math.max(0, i - 1))} disabled={adminMediaIndex === 0} className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white disabled:opacity-30 cursor-pointer">
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <button onClick={() => setAdminMediaIndex((i) => Math.min(media.length - 1, i + 1))} disabled={adminMediaIndex === media.length - 1} className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white disabled:opacity-30 cursor-pointer">
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </>
                  ) : (
                    <div className={cn("w-full h-full min-h-[220px] flex items-center justify-center", adminSelected.platform && PLATFORM_CONFIG[adminSelected.platform] ? `bg-gradient-to-br ${PLATFORM_CONFIG[adminSelected.platform].bg}` : "bg-[var(--surface-2)]")}>
                      {(() => { const I = contentIconFn(adminSelected.content_type); return <I className="w-16 h-16 text-white/20" />; })()}
                    </div>
                  )}
                </div>

                {/* Detail panel */}
                <div className="flex flex-col flex-1 min-h-0">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] flex-shrink-0">
                    <div className="flex items-center gap-2">
                      {adminSelected.platform && PLATFORM_CONFIG[adminSelected.platform] && (
                        <span className={cn("w-2 h-2 rounded-full", PLATFORM_CONFIG[adminSelected.platform].dot)} />
                      )}
                      <span className="text-xs font-semibold text-[var(--foreground-muted)]">{adminSelected.platform ?? "No platform"}</span>
                    </div>
                    <button onClick={() => setAdminSelected(null)} className="text-[var(--foreground-subtle)] hover:text-[var(--foreground)] cursor-pointer">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-5 space-y-4">
                    <div className="flex items-center gap-2">
                      <StatusDot status={adminSelected.status} />
                      <span className={cn("text-xs font-semibold", s?.color)}>{s?.label}</span>
                      <span className={cn("text-[10px] font-medium capitalize px-2 py-0.5 rounded border ml-auto", TYPE_PILL[adminSelected.content_type] ?? TYPE_PILL.other)}>{adminSelected.content_type}</span>
                    </div>
                    <h4 className="text-base font-bold text-[var(--foreground)] leading-tight">{adminSelected.title}</h4>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-[var(--foreground-muted)] block">Status</label>
                      <select
                        value={adminSelected.status}
                        onChange={(e) => {
                          handleUpdateContentStatus(adminSelected.id, e.target.value as ContentItem["status"]);
                          setAdminSelected((p) => p ? { ...p, status: e.target.value as ContentItem["status"] } : null);
                        }}
                        className={inputClass}
                      >
                        <option value="draft">Draft</option>
                        <option value="in_review">In Review</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                        <option value="published">Published</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-[var(--foreground-muted)] block">Scheduled Date</label>
                      <input
                        type="date"
                        value={adminSelected.scheduled_date ?? ""}
                        onChange={(e) => {
                          handleUpdateContentDate(adminSelected.id, e.target.value);
                          setAdminSelected((p) => p ? { ...p, scheduled_date: e.target.value || null } : null);
                        }}
                        className={inputClass}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-[var(--foreground-muted)] block">Caption / Notes</label>
                      <textarea
                        rows={4}
                        value={adminEditDesc}
                        onChange={(e) => setAdminEditDesc(e.target.value)}
                        placeholder="Add a caption or notes for the client…"
                        className={`${inputClass} resize-none`}
                      />
                    </div>

                    {/* File upload */}
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-[var(--foreground-muted)] block">Attachments</label>
                      <input
                        ref={adminEditFileRef}
                        type="file"
                        accept=".pdf,image/*,video/*"
                        onChange={handleEditFileUpload}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => adminEditFileRef.current?.click()}
                        disabled={uploadingEditFile}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-[var(--border)] text-xs text-[var(--foreground-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-all cursor-pointer w-full justify-center disabled:opacity-50"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        {uploadingEditFile ? "Uploading…" : "Upload file"}
                      </button>
                      {adminEditFileUrls.length > 0 && (
                        <div className="space-y-1.5">
                          {adminEditFileUrls.map((url, i) => (
                            <div key={url} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-xs">
                              <span className="flex-1 truncate text-[var(--foreground-muted)]">
                                {/\.(png|jpg|jpeg|gif|webp)/i.test(url) ? "🖼" : /\.pdf$/i.test(url) ? "📄" : /\.(mp4|mov|webm)$/i.test(url) ? "🎬" : "📎"} File {i + 1}
                              </span>
                              <button
                                type="button"
                                onClick={() => setAdminEditFileUrls((prev) => prev.filter((_, j) => j !== i))}
                                className="text-[var(--foreground-subtle)] hover:text-red-400 transition-colors cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Save button */}
                    <Button
                      onClick={handleSaveContentEdit}
                      loading={savingEdit}
                      className="w-full"
                    >
                      <Save className="w-3.5 h-3.5 mr-1.5" /> Save Changes
                    </Button>

                    {adminSelected.feedback && (
                      <div className="p-3 rounded-lg bg-[var(--surface-2)] border border-[var(--border)]">
                        <p className="text-xs font-semibold text-[var(--foreground-muted)] mb-1 flex items-center gap-1.5">
                          <MessageSquare className="w-3 h-3" /> Client Feedback
                        </p>
                        <p className="text-sm text-[var(--foreground-muted)]">{adminSelected.feedback}</p>
                      </div>
                    )}
                    <div className="pt-2 border-t border-[var(--border)]">
                      <button
                        onClick={() => { handleDeleteContent(adminSelected.id); setAdminSelected(null); }}
                        className="flex items-center gap-2 text-xs text-red-400 hover:text-red-300 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Delete content item
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ── ASSETS TAB ── */}
        {tab === "Assets" && (
          <div className="space-y-5 max-w-2xl">
            {project && (
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 space-y-4">
                <h4 className="text-sm font-semibold text-[var(--foreground)]">Upload Brand Asset</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Asset Name *</label>
                    <input type="text" placeholder="e.g. Primary Logo" value={assetName} onChange={(e) => setAssetName(e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Category</label>
                    <select value={assetCategory} onChange={(e) => setAssetCategory(e.target.value as Asset["category"])} className={inputClass}>
                      {ASSET_CATEGORIES.map((c) => <option key={c} value={c} className="capitalize">{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                    </select>
                  </div>
                </div>
                <input ref={assetRef} type="file" accept="image/*,.pdf,.svg,.ai,.eps,.sketch,.fig" onChange={handleUploadAsset} className="hidden" />
                <Button
                  onClick={() => { if (!assetName) return; assetRef.current?.click(); }}
                  loading={uploadingAsset}
                  disabled={!assetName}
                  variant="secondary"
                  className="w-full gap-2"
                >
                  <Upload className="w-4 h-4" /> {uploadingAsset ? "Uploading..." : "Choose File to Upload"}
                </Button>
              </div>
            )}
            {!project && <div className="text-center py-12 text-sm text-[var(--foreground-subtle)]">Create a project first.</div>}

            {assets.length === 0 ? (
              <div className="text-center py-12">
                <FolderOpen className="w-10 h-10 text-[var(--foreground-subtle)] mx-auto mb-3" />
                <p className="text-sm text-[var(--foreground-muted)]">No assets uploaded yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {assets.map((a) => (
                  <div
                    key={a.id}
                    className="group relative bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden cursor-pointer hover:border-zinc-600 transition-all"
                    onClick={() => setViewingAdminAsset(a)}
                  >
                    <div className="aspect-video bg-[var(--surface-2)] flex items-center justify-center overflow-hidden">
                      {a.file_type.startsWith("image/") ? (
                        <img src={a.file_url} alt={a.name} className="w-full h-full object-cover" />
                      ) : (
                        <FolderOpen className="w-6 h-6 text-[var(--foreground-subtle)]" />
                      )}
                    </div>
                    <div className="p-2.5">
                      <p className="text-xs font-medium text-[var(--foreground)] truncate">{a.name}</p>
                      <p className="text-[10px] text-[var(--foreground-subtle)] capitalize mt-0.5">{a.category} · {(a.file_size / 1024).toFixed(1)} KB</p>
                    </div>
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <a
                        href={a.file_url}
                        download
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteAsset(a); }}
                        className="w-8 h-8 rounded-lg bg-red-500/20 hover:bg-red-500/40 flex items-center justify-center text-red-400 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Asset lightbox */}
            {viewingAdminAsset && (
              <div
                className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                onClick={() => setViewingAdminAsset(null)}
              >
                <button
                  onClick={() => setViewingAdminAsset(null)}
                  className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer z-10"
                >
                  <X className="w-5 h-5" />
                </button>
                <div className="flex flex-col items-center gap-4 max-w-5xl w-full" onClick={(e) => e.stopPropagation()}>
                  {viewingAdminAsset.file_type.startsWith("image/") ? (
                    <img src={viewingAdminAsset.file_url} alt={viewingAdminAsset.name} className="max-h-[80vh] max-w-full object-contain rounded-xl" />
                  ) : /\.pdf$/i.test(viewingAdminAsset.file_url) ? (
                    <iframe src={viewingAdminAsset.file_url} className="w-full rounded-xl border-0" style={{ height: "80vh" }} title={viewingAdminAsset.name} />
                  ) : (
                    <div className="flex flex-col items-center gap-4 text-white">
                      <FileText className="w-16 h-16 opacity-40" />
                      <p className="text-sm">{viewingAdminAsset.name}</p>
                      <a href={viewingAdminAsset.file_url} download target="_blank" rel="noopener noreferrer" className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90">Download file</a>
                    </div>
                  )}
                  <p className="text-white/60 text-xs">{viewingAdminAsset.name} · {(viewingAdminAsset.file_size / 1024).toFixed(1)} KB · <span className="capitalize">{viewingAdminAsset.category}</span></p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── DOCUMENTS TAB ── */}
        {tab === "Documents" && (
          <div className="space-y-5 max-w-2xl">
            {project && (
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 space-y-4">
                <h4 className="text-sm font-semibold text-[var(--foreground)]">Upload Document</h4>
                <div>
                  <label className={labelClass}>Title *</label>
                  <input type="text" placeholder="Document title" value={docTitle} onChange={(e) => setDocTitle(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Description (optional)</label>
                  <textarea rows={2} placeholder="Brief description..." value={docDescription} onChange={(e) => setDocDescription(e.target.value)} className={`${inputClass} resize-none`} />
                </div>
                <input ref={docRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt" onChange={handleUploadDoc} className="hidden" />
                <Button
                  onClick={() => { if (!docTitle) return; docRef.current?.click(); }}
                  loading={uploadingDoc}
                  disabled={!docTitle}
                  variant="secondary"
                  className="w-full gap-2"
                >
                  <Upload className="w-4 h-4" /> {uploadingDoc ? "Uploading..." : "Choose File to Upload"}
                </Button>
              </div>
            )}
            {!project && <div className="text-center py-12 text-sm text-[var(--foreground-subtle)]">Create a project first.</div>}

            {documents.length === 0 ? (
              <div className="text-center py-12">
                <BookOpen className="w-10 h-10 text-[var(--foreground-subtle)] mx-auto mb-3" />
                <p className="text-sm text-[var(--foreground-muted)]">No documents uploaded yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {documents.map((doc) => (
                  <div key={doc.id} className="flex items-center gap-4 p-4 bg-[var(--surface)] border border-[var(--border)] rounded-xl">
                    <FileText className="w-4 h-4 text-[var(--foreground-muted)] flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--foreground)]">{doc.title}</p>
                      {doc.description && <p className="text-xs text-[var(--foreground-subtle)] truncate">{doc.description}</p>}
                      <p className="text-xs text-[var(--foreground-subtle)]">{(doc.file_size / 1024).toFixed(1)} KB · {formatDate(doc.created_at)}</p>
                    </div>
                    <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="text-[var(--foreground-subtle)] hover:text-[var(--foreground)] transition-colors">
                      <Download className="w-4 h-4" />
                    </a>
                    <button onClick={() => handleDeleteDocument(doc.id)} className="p-1 text-[var(--foreground-subtle)] hover:text-red-400 transition-colors cursor-pointer flex-shrink-0" title="Delete">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TIMELINE TAB ── */}
        {tab === "Timeline" && (
          <div className="space-y-4 max-w-2xl">
            <div className="flex items-center justify-between">
              <p className="text-sm text-[var(--foreground-muted)]">{milestones.length} milestone{milestones.length !== 1 ? "s" : ""}</p>
              {project && (
                <Button onClick={() => setShowMilestoneForm(true)} size="sm" className="gap-2">
                  <Plus className="w-4 h-4" /> Add Milestone
                </Button>
              )}
            </div>
            {!project && <div className="text-center py-12 text-sm text-[var(--foreground-subtle)]">Create a project first.</div>}

            {showMilestoneForm && (
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-[var(--foreground)]">New Milestone</h4>
                  <button onClick={() => setShowMilestoneForm(false)} className="text-[var(--foreground-subtle)] hover:text-[var(--foreground)] cursor-pointer"><X className="w-4 h-4" /></button>
                </div>
                <form onSubmit={handleAddMilestone} className="space-y-3">
                  <div>
                    <label className={labelClass}>Title *</label>
                    <input type="text" required value={msForm.title} onChange={(e) => setMsForm((f) => ({ ...f, title: e.target.value }))} placeholder="Milestone title" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Due Date *</label>
                    <input type="date" required value={msForm.due_date} onChange={(e) => setMsForm((f) => ({ ...f, due_date: e.target.value }))} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Description (optional)</label>
                    <textarea rows={2} value={msForm.description} onChange={(e) => setMsForm((f) => ({ ...f, description: e.target.value }))} placeholder="Details..." className={`${inputClass} resize-none`} />
                  </div>
                  <div className="flex gap-3">
                    <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowMilestoneForm(false)}>Cancel</Button>
                    <Button type="submit" className="flex-1" loading={addingMs}>Add Milestone</Button>
                  </div>
                </form>
              </div>
            )}

            {project && milestones.length === 0 && !showMilestoneForm && (
              <div className="text-center py-12">
                <Milestone className="w-10 h-10 text-[var(--foreground-subtle)] mx-auto mb-3" />
                <p className="text-sm text-[var(--foreground-muted)]">No milestones yet</p>
              </div>
            )}

            <div className="space-y-2">
              {milestones.map((m) => (
                <div key={m.id} className={cn("flex items-center gap-4 p-4 bg-[var(--surface)] border border-[var(--border)] rounded-xl transition-opacity", m.completed && "opacity-60")}>
                  <button
                    onClick={() => toggleMilestone(m.id, !m.completed)}
                    className="flex-shrink-0 cursor-pointer text-[var(--foreground-subtle)] hover:text-[var(--accent)] transition-colors"
                  >
                    {m.completed ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <Circle className="w-5 h-5" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm font-medium text-[var(--foreground)]", m.completed && "line-through")}>{m.title}</p>
                    {m.description && <p className="text-xs text-[var(--foreground-subtle)] truncate">{m.description}</p>}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-[var(--foreground-subtle)] flex-shrink-0">
                    <Calendar className="w-3.5 h-3.5" />
                    {formatDate(m.due_date)}
                  </div>
                  <button onClick={() => handleDeleteMilestone(m.id)} className="p-1 text-[var(--foreground-subtle)] hover:text-red-400 transition-colors cursor-pointer flex-shrink-0" title="Delete">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── FORMS TAB ── */}
        {tab === "Forms" && (
          <div className="space-y-4 max-w-2xl">
            <div className="flex items-center justify-between">
              <p className="text-sm text-[var(--foreground-muted)]">{forms.length} form{forms.length !== 1 ? "s" : ""}</p>
              {project && (
                <Button onClick={() => setShowFormBuilder(true)} size="sm" className="gap-2">
                  <Plus className="w-4 h-4" /> Create Form
                </Button>
              )}
            </div>
            {!project && <div className="text-center py-12 text-sm text-[var(--foreground-subtle)]">Create a project first.</div>}

            {showFormBuilder && (
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-[var(--foreground)]">Form Builder</h4>
                  <div className="flex items-center gap-2">
                    {formTemplates.length > 0 && (
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setShowTemplateList((v) => !v)}
                          className="text-xs px-2.5 py-1 rounded-lg border border-[var(--border)] text-[var(--foreground-muted)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-colors cursor-pointer"
                        >
                          Load Template ▾
                        </button>
                        {showTemplateList && (
                          <div className="absolute right-0 top-8 z-20 w-56 bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-xl overflow-hidden">
                            {formTemplates.map((tpl) => (
                              <button
                                key={tpl.id}
                                type="button"
                                onClick={() => loadTemplate(tpl)}
                                className="w-full text-left px-4 py-2.5 text-xs hover:bg-[var(--surface-2)] transition-colors border-b border-[var(--border)] last:border-0 text-[var(--foreground)]"
                              >
                                <p className="font-medium">{tpl.title}</p>
                                {tpl.description && <p className="text-[var(--foreground-subtle)] mt-0.5 truncate">{tpl.description}</p>}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    <button onClick={() => { setShowFormBuilder(false); setFbFields([]); setShowTemplateList(false); }} className="text-[var(--foreground-subtle)] hover:text-[var(--foreground)] cursor-pointer"><X className="w-4 h-4" /></button>
                  </div>
                </div>
                <form onSubmit={handleCreateForm} className="space-y-4">
                  <div>
                    <label className={labelClass}>Form Title *</label>
                    <input type="text" required value={fbTitle} onChange={(e) => setFbTitle(e.target.value)} placeholder="e.g. Website Brief" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Description (shown to client)</label>
                    <textarea rows={2} value={fbDescription} onChange={(e) => setFbDescription(e.target.value)} placeholder="What this form is for..." className={`${inputClass} resize-none`} />
                  </div>

                  {/* Fields */}
                  <div className="space-y-3">
                    <p className="text-xs font-medium text-[var(--foreground-muted)]">Fields ({fbFields.length})</p>
                    {fbFields.map((field, i) => (
                      <div key={field.id} className="bg-[var(--surface-2)] border border-[var(--border)] rounded-lg p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={field.label}
                            onChange={(e) => setFbFields((prev) => prev.map((f, j) => j === i ? { ...f, label: e.target.value } : f))}
                            placeholder="Field label"
                            className={cn(inputClass, "flex-1")}
                          />
                          <span className="text-xs text-[var(--foreground-subtle)] bg-[var(--surface)] border border-[var(--border)] px-2 py-1 rounded capitalize">{field.type}</span>
                          <button
                            type="button"
                            onClick={() => setFbFields((prev) => prev.filter((_, j) => j !== i))}
                            className="text-[var(--foreground-subtle)] hover:text-red-400 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {(field.type === "select" || field.type === "multiselect" || field.type === "checkbox") && (
                          <input
                            type="text"
                            value={field.options ?? ""}
                            onChange={(e) => setFbFields((prev) => prev.map((f, j) => j === i ? { ...f, options: e.target.value } : f))}
                            placeholder={field.type === "checkbox" ? "Checkbox items (comma separated, e.g. Yes,No,Maybe)" : "Options (comma separated)"}
                            className={inputClass}
                          />
                        )}
                        <label className="flex items-center gap-2 text-xs text-[var(--foreground-muted)] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={field.required ?? false}
                            onChange={(e) => setFbFields((prev) => prev.map((f, j) => j === i ? { ...f, required: e.target.checked } : f))}
                            className="accent-[var(--accent)]"
                          />
                          Required
                        </label>
                      </div>
                    ))}

                    <div className="flex gap-2 flex-wrap">
                      <p className="text-xs text-[var(--foreground-subtle)] w-full">Add field:</p>
                      <button type="button" onClick={() => addFormField("text")} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors cursor-pointer">
                        <AlignLeft className="w-3 h-3" /> Text
                      </button>
                      <button type="button" onClick={() => addFormField("textarea")} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors cursor-pointer">
                        <AlignLeft className="w-3 h-3" /> Long Text
                      </button>
                      <button type="button" onClick={() => addFormField("select")} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors cursor-pointer">
                        <List className="w-3 h-3" /> Dropdown
                      </button>
                      <button type="button" onClick={() => addFormField("multiselect")} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors cursor-pointer">
                        <CheckSquare className="w-3 h-3" /> Multi-select
                      </button>
                      <button type="button" onClick={() => addFormField("checkbox")} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors cursor-pointer">
                        <CheckSquare className="w-3 h-3" /> Checkbox
                      </button>
                      <button type="button" onClick={() => addFormField("file")} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors cursor-pointer">
                        <Upload className="w-3 h-3" /> File Upload
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button type="button" variant="secondary" className="flex-1" onClick={() => { setShowFormBuilder(false); setFbFields([]); setShowTemplateList(false); }}>Cancel</Button>
                    <button
                      type="button"
                      onClick={handleSaveTemplate}
                      disabled={!fbTitle || fbFields.length === 0}
                      className="px-3 py-2 text-xs rounded-lg border border-[var(--border)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors disabled:opacity-40 cursor-pointer"
                    >
                      Save as Template
                    </button>
                    <Button type="submit" className="flex-1" loading={creatingForm} disabled={fbFields.length === 0}>Create Form</Button>
                  </div>
                </form>
              </div>
            )}

            {project && forms.length === 0 && !showFormBuilder && (
              <div className="text-center py-12">
                <FileText className="w-10 h-10 text-[var(--foreground-subtle)] mx-auto mb-3" />
                <p className="text-sm text-[var(--foreground-muted)]">No forms created yet</p>
              </div>
            )}

            <div className="space-y-3">
              {forms.map((form) => {
                const isExpanded = expandedForms.has(form.id);
                const fields = form.fields as FormField[];
                const responses = form.responses as Record<string, string | boolean | string[]> | null;
                return (
                  <div key={form.id} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden">
                    <div
                      className={cn("flex items-center gap-4 p-4", form.status === "submitted" && responses ? "cursor-pointer hover:bg-[var(--surface-2)] transition-colors" : "")}
                      onClick={() => {
                        if (form.status === "submitted" && responses) {
                          setExpandedForms((prev) => {
                            const next = new Set(prev);
                            if (next.has(form.id)) next.delete(form.id); else next.add(form.id);
                            return next;
                          });
                        }
                      }}
                    >
                      <FileText className="w-4 h-4 text-[var(--foreground-muted)] flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--foreground)]">{form.title}</p>
                        {form.description && <p className="text-xs text-[var(--foreground-subtle)] truncate">{form.description}</p>}
                        <p className="text-xs text-[var(--foreground-subtle)]">
                          {fields.length} field{fields.length !== 1 ? "s" : ""}
                          {form.submitted_at ? ` · Submitted ${formatDate(form.submitted_at)}` : ` · Created ${formatDate(form.created_at)}`}
                        </p>
                      </div>
                      <Badge variant={form.status === "submitted" ? "success" : "warning"} className="flex-shrink-0 capitalize">
                        {form.status}
                      </Badge>
                      {form.status === "submitted" && responses && (
                        <span className="text-xs text-[var(--accent)] flex-shrink-0">
                          {isExpanded ? "Hide ▲" : "View ▼"}
                        </span>
                      )}
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteForm(form.id); }} className="p-1 text-[var(--foreground-subtle)] hover:text-red-400 transition-colors cursor-pointer flex-shrink-0" title="Delete">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {isExpanded && responses && (
                      <div className="border-t border-[var(--border)] bg-[var(--surface-2)] p-4 space-y-3">
                        <p className="text-xs font-semibold text-[var(--foreground-muted)] uppercase tracking-wider">Client Responses</p>
                        {fields.map((field) => {
                          const val = responses[field.id];
                          if (val === undefined || val === null || val === "") return null;
                          return (
                            <div key={field.id} className="space-y-1">
                              <p className="text-xs font-medium text-[var(--foreground-subtle)]">{field.label}</p>
                              {Array.isArray(val) ? (
                                <div className="flex flex-wrap gap-1.5">
                                  {(val as string[]).map((v) => (
                                    <span key={v} className="text-xs px-2 py-0.5 rounded-full bg-[var(--accent-subtle)] text-[var(--accent)] border border-[var(--accent)]/20">{v}</span>
                                  ))}
                                </div>
                              ) : typeof val === "boolean" ? (
                                <p className="text-sm text-[var(--foreground)]">{val ? "Yes" : "No"}</p>
                              ) : (
                                <p className="text-sm text-[var(--foreground)] whitespace-pre-line">{val as string}</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── CONTRACTS TAB ── */}
        {tab === "Contracts & T&Cs" && (
          <div className="space-y-5 max-w-2xl">
            {project && (
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 space-y-4">
                <h4 className="text-sm font-semibold text-[var(--foreground)]">Upload Document</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Title *</label>
                    <input type="text" placeholder="Document title" value={contractTitle} onChange={(e) => setContractTitle(e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Type</label>
                    <select value={contractType} onChange={(e) => setContractType(e.target.value as "contract" | "terms")} className={inputClass}>
                      <option value="contract">Contract</option>
                      <option value="terms">T&Cs</option>
                    </select>
                  </div>
                </div>
                <input ref={contractRef} type="file" accept=".pdf,.doc,.docx" onChange={handleUploadContract} className="hidden" />
                <Button onClick={() => { if (!contractTitle) return; setContractError(""); contractRef.current?.click(); }} loading={uploadingContract} disabled={!contractTitle} className="w-full gap-2" variant="secondary">
                  <Upload className="w-4 h-4" /> {uploadingContract ? "Uploading..." : "Choose PDF to Upload"}
                </Button>
                {contractError && <p className="text-xs text-red-400">{contractError}</p>}
              </div>
            )}

            {contracts.length === 0 ? (
              <div className="text-center py-12">
                <ScrollText className="w-10 h-10 text-[var(--foreground-subtle)] mx-auto mb-3" />
                <p className="text-sm text-[var(--foreground-muted)]">No documents uploaded yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {contracts.map((c) => (
                  <div key={c.id} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden">
                    <div className="flex items-center gap-4 p-4">
                      <ScrollText className="w-4 h-4 text-[var(--foreground-muted)] flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--foreground)]">{c.title}</p>
                        <p className="text-xs text-[var(--foreground-subtle)]">{formatDate(c.created_at)}</p>
                      </div>
                      <Badge variant={c.type === "terms" ? "purple" : "default"} className="flex-shrink-0">{c.type === "terms" ? "T&Cs" : "Contract"}</Badge>
                      <Badge variant={c.status === "signed" ? "success" : c.status === "expired" ? "error" : "warning"} className="flex-shrink-0">{c.status}</Badge>
                      <a href={c.file_url} target="_blank" rel="noopener noreferrer" className="text-[var(--foreground-subtle)] hover:text-[var(--foreground)] transition-colors" title="View original PDF">
                        <Download className="w-4 h-4" />
                      </a>
                      <button onClick={() => handleDeleteContract(c.id)} className="p-1 text-[var(--foreground-subtle)] hover:text-red-400 transition-colors cursor-pointer flex-shrink-0" title="Delete">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {c.status === "signed" && c.signature_data && (
                      <div className="border-t border-[var(--border)] px-4 py-3 bg-emerald-400/5 flex items-center gap-4">
                        <div className="flex-shrink-0">
                          <p className="text-[10px] text-emerald-400 font-semibold mb-1 uppercase tracking-wider">Client Signature</p>
                          <img src={c.signature_data} alt="Client signature" className="h-10 max-w-[160px] object-contain bg-white/5 rounded border border-emerald-400/20 p-1" />
                          {c.signature_name && (
                            <p className="text-xs font-bold tracking-widest mt-1 text-[var(--foreground)]">{c.signature_name.toUpperCase()}</p>
                          )}
                          {c.signed_at && <p className="text-[10px] text-[var(--foreground-subtle)] mt-1">Signed {formatDate(c.signed_at)}</p>}
                        </div>
                        <a
                          href={`/api/admin/signed-pdf/${c.id}`}
                          download
                          className="ml-auto flex items-center gap-1.5 text-xs font-medium text-emerald-400 border border-emerald-400/30 px-3 py-1.5 rounded-lg hover:bg-emerald-400/10 transition-colors flex-shrink-0"
                        >
                          <Download className="w-3.5 h-3.5" /> Download Signed PDF
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── REPORTS TAB ── */}
        {tab === "Reports" && (
          <div className="space-y-5 max-w-2xl">
            {project && (
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 space-y-4">
                <h4 className="text-sm font-semibold text-[var(--foreground)]">Upload Report</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Title *</label>
                    <input type="text" placeholder="Report title" value={reportTitle} onChange={(e) => setReportTitle(e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Period *</label>
                    <input type="text" placeholder="e.g. April 2026" value={reportPeriod} onChange={(e) => setReportPeriod(e.target.value)} className={inputClass} />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Summary (optional)</label>
                  <textarea rows={3} placeholder="Key highlights from this report..." value={reportSummary} onChange={(e) => setReportSummary(e.target.value)} className={`${inputClass} resize-none`} />
                </div>
                <input ref={reportRef} type="file" accept=".pdf" onChange={handleUploadReport} className="hidden" />
                <Button onClick={() => { if (!reportTitle || !reportPeriod) return; setReportError(""); reportRef.current?.click(); }} loading={uploadingReport} disabled={!reportTitle || !reportPeriod} variant="secondary" className="w-full gap-2">
                  <Upload className="w-4 h-4" /> {uploadingReport ? "Uploading..." : "Choose PDF to Upload"}
                </Button>
                {reportError && <p className="text-xs text-red-400">{reportError}</p>}
              </div>
            )}

            {reports.length === 0 ? (
              <div className="text-center py-12">
                <BarChart3 className="w-10 h-10 text-[var(--foreground-subtle)] mx-auto mb-3" />
                <p className="text-sm text-[var(--foreground-muted)]">No reports uploaded yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {reports.map((r) => (
                  <div key={r.id} className="flex items-center gap-4 p-4 bg-[var(--surface)] border border-[var(--border)] rounded-xl">
                    <BarChart3 className="w-4 h-4 text-[var(--accent)] flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--foreground)]">{r.title}</p>
                      <p className="text-xs text-[var(--foreground-subtle)]">{r.period} · {formatDate(r.created_at)}</p>
                    </div>
                    <a href={r.file_url} target="_blank" rel="noopener noreferrer" className="text-[var(--foreground-subtle)] hover:text-[var(--foreground)] transition-colors">
                      <Download className="w-4 h-4" />
                    </a>
                    <button onClick={() => handleDeleteReport(r.id)} className="p-1 text-[var(--foreground-subtle)] hover:text-red-400 transition-colors cursor-pointer flex-shrink-0" title="Delete">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TICKETS TAB ── */}
        {tab === "Tickets" && (
          <div className="space-y-4 max-w-2xl">
            <p className="text-sm text-[var(--foreground-muted)]">{tickets.length} ticket{tickets.length !== 1 ? "s" : ""} submitted by client</p>

            {tickets.length === 0 ? (
              <div className="text-center py-12">
                <TicketIcon className="w-10 h-10 text-[var(--foreground-subtle)] mx-auto mb-3" />
                <p className="text-sm text-[var(--foreground-muted)]">No tickets yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {tickets.map((t) => (
                  <div key={t.id} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[var(--foreground)]">{t.title}</p>
                        <p className="text-xs text-[var(--foreground-subtle)] mt-0.5">{formatDate(t.created_at)}</p>
                      </div>
                      <Badge variant={t.priority === "urgent" ? "error" : t.priority === "high" ? "warning" : "default"} className="flex-shrink-0 capitalize">
                        {t.priority}
                      </Badge>
                      {(t.status === "resolved" || t.status === "closed") && (
                        <button
                          onClick={() => handleDeleteTicket(t.id)}
                          className="w-6 h-6 flex items-center justify-center text-[var(--foreground-subtle)] hover:text-red-400 transition-colors cursor-pointer flex-shrink-0"
                          title="Remove ticket"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Status journey */}
                    <div className="flex items-center gap-1.5">
                      {(["open", "in_progress", "resolved", "closed"] as Ticket["status"][]).map((s, i, arr) => {
                        const statusOrder = { open: 0, in_progress: 1, resolved: 2, closed: 3 };
                        const reached = statusOrder[t.status] >= statusOrder[s];
                        const isCurrent = t.status === s;
                        return (
                          <div key={s} className="flex items-center gap-1.5">
                            <span className={cn(
                              "text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize",
                              isCurrent ? "bg-[var(--accent)] text-white" :
                              reached ? "bg-emerald-400/15 text-emerald-400" :
                              "bg-[var(--surface-2)] text-[var(--foreground-subtle)]"
                            )}>
                              {s.replace("_", " ")}
                            </span>
                            {i < arr.length - 1 && <span className="text-[var(--foreground-subtle)] text-xs">→</span>}
                          </div>
                        );
                      })}
                    </div>

                    <p className="text-sm text-[var(--foreground-muted)] whitespace-pre-line">{t.description}</p>

                    {/* Attached files */}
                    {t.file_urls && t.file_urls.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-[var(--foreground-subtle)] flex items-center gap-1.5">
                          <Paperclip className="w-3 h-3" /> Attachments
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {t.file_urls.map((url, i) => {
                            const isImg = /\.(png|jpg|jpeg|gif|webp)/i.test(url);
                            return isImg ? (
                              <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block w-20 h-20 rounded-lg overflow-hidden border border-[var(--border)] hover:border-[var(--accent)] transition-colors">
                                <img src={url} alt={`attachment-${i}`} className="w-full h-full object-cover" />
                              </a>
                            ) : (
                              <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[var(--foreground-muted)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-colors">
                                <FileText className="w-3 h-3" /> File {i + 1}
                              </a>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Message thread */}
                    {(t.messages ?? []).length > 0 && (
                      <div className="space-y-2 border-t border-[var(--border)] pt-3">
                        <p className="text-xs font-medium text-[var(--foreground-subtle)]">Thread</p>
                        {(t.messages ?? []).map((msg, i) => (
                          <div key={i} className={cn(
                            "px-3 py-2 rounded-lg text-sm",
                            msg.role === "admin"
                              ? "bg-[var(--accent-subtle)] border border-[var(--accent)]/20 ml-4"
                              : "bg-[var(--surface-2)] border border-[var(--border)]"
                          )}>
                            <p className={cn("text-[10px] font-semibold mb-0.5 uppercase tracking-wider", msg.role === "admin" ? "text-[var(--accent)]" : "text-[var(--foreground-subtle)]")}>
                              {msg.role === "admin" ? "Account manager" : "Client"}
                            </p>
                            <p className="text-[var(--foreground-muted)] whitespace-pre-line">{msg.text}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <p className="text-xs text-[var(--foreground-subtle)]">Status:</p>
                      <select
                        value={t.status}
                        onChange={(e) => updateTicketStatus(t.id, e.target.value as Ticket["status"])}
                        className="text-xs px-2 py-1 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[var(--foreground)] outline-none focus:border-[var(--accent)] transition-all cursor-pointer"
                      >
                        <option value="open">Open</option>
                        <option value="in_progress">In Progress</option>
                        <option value="resolved">Resolved</option>
                        <option value="closed">Closed</option>
                      </select>
                    </div>

                    {/* Admin response + new message */}
                    <div className="space-y-2 border-t border-[var(--border)] pt-3">
                      <p className="text-xs font-medium text-[var(--foreground-subtle)]">Send message to client</p>
                      <textarea
                        rows={2}
                        value={ticketMessages[t.id] ?? ""}
                        onChange={(e) => setTicketMessages((prev) => ({ ...prev, [t.id]: e.target.value }))}
                        placeholder="Update the client on progress..."
                        className="w-full text-sm px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] outline-none focus:border-[var(--accent)] transition-all resize-none"
                      />
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => sendTicketMessage(t.id)}
                          disabled={!(ticketMessages[t.id] ?? "").trim()}
                          className="text-xs px-3 py-1.5 rounded-lg bg-[var(--accent)] text-white hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
                        >
                          Send Message
                        </button>
                      </div>
                      <div className="space-y-2 border-t border-[var(--border)] pt-2">
                        <p className="text-xs font-medium text-[var(--foreground-subtle)]">Resolution note (visible to client)</p>
                        <textarea
                          rows={2}
                          value={ticketResponses[t.id] ?? ""}
                          onChange={(e) => setTicketResponses((prev) => ({ ...prev, [t.id]: e.target.value }))}
                          placeholder="Summary of how this was resolved..."
                          className="w-full text-sm px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] outline-none focus:border-[var(--accent)] transition-all resize-none"
                        />
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => saveTicketResponse(t.id)}
                            disabled={savingResponse === t.id}
                            className="text-xs px-3 py-1.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-all disabled:opacity-50 cursor-pointer"
                          >
                            {savingResponse === t.id ? "Saving…" : "Save Resolution"}
                          </button>
                          {responseSaved[t.id] && <span className="text-xs text-emerald-400">✓ Saved</span>}
                          {responseError[t.id] && <span className="text-xs text-red-400">{responseError[t.id]}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── FEEDBACK TAB ── */}
        {tab === "Feedback" && (
          <div className="space-y-4 max-w-2xl">
            <p className="text-sm text-[var(--foreground-muted)]">{feedbackItems.length} feedback submission{feedbackItems.length !== 1 ? "s" : ""} from client</p>
            {feedbackItems.length === 0 ? (
              <div className="text-center py-12">
                <MessageSquare className="w-10 h-10 text-[var(--foreground-subtle)] mx-auto mb-3" />
                <p className="text-sm text-[var(--foreground-muted)]">No feedback submitted yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {feedbackItems.map((f) => (
                  <div key={f.id} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--surface-2)] border border-[var(--border)] text-[var(--foreground-muted)] capitalize">{f.category}</span>
                        <p className="text-xs text-[var(--foreground-subtle)]">{formatDate(f.created_at)}</p>
                      </div>
                      {f.rating !== null && (
                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star key={star} className={cn("w-3.5 h-3.5", star <= f.rating! ? "text-amber-400 fill-amber-400" : "text-[var(--foreground-subtle)]")} />
                          ))}
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-[var(--foreground-muted)]">{f.message}</p>
                    {f.admin_reply && (
                      <div className="p-2.5 rounded-lg bg-[var(--accent-subtle)] border border-[var(--accent)]/20 text-xs text-[var(--foreground-muted)]">
                        <span className="font-semibold text-[var(--accent)]">Your reply: </span>{f.admin_reply}
                      </div>
                    )}
                    <div className="space-y-2 border-t border-[var(--border)] pt-3">
                      <p className="text-xs font-medium text-[var(--foreground-subtle)]">Reply to client</p>
                      <textarea
                        rows={2}
                        value={feedbackReplies[f.id] ?? ""}
                        onChange={(e) => setFeedbackReplies((prev) => ({ ...prev, [f.id]: e.target.value }))}
                        placeholder="Write a warm reply..."
                        className="w-full text-sm px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] outline-none focus:border-[var(--accent)] transition-all resize-none"
                      />
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => saveFeedbackReply(f.id)}
                          disabled={savingReply === f.id}
                          className="text-xs px-3 py-1.5 rounded-lg bg-[var(--accent)] text-white hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
                        >
                          {savingReply === f.id ? "Saving…" : "Send Reply"}
                        </button>
                        {replySaved[f.id] && <span className="text-xs text-emerald-400">✓ Saved</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

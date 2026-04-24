"use client";

import { useState, useEffect, useRef } from "react";
import { User, Camera, Save, Mail, Building2, Lock, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Topbar } from "@/components/layout/topbar";
import { getInitials } from "@/lib/utils";
import type { Profile } from "@/lib/supabase/types";

export default function SettingsPage() {
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [form, setForm] = useState({ fullName: "", company: "" });
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [userId, setUserId] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [changingPwd, setChangingPwd] = useState(false);
  const [pwdError, setPwdError] = useState("");
  const [pwdSaved, setPwdSaved] = useState(false);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (data) {
        setProfile(data);
        setForm({ fullName: data.full_name, company: data.company_name ?? "" });
        setAvatarPreview(data.avatar_url);
      }
    }
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwdError("");
    if (newPassword.length < 8) { setPwdError("Password must be at least 8 characters."); return; }
    if (newPassword !== confirmPassword) { setPwdError("Passwords do not match."); return; }
    setChangingPwd(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setChangingPwd(false);
    if (error) { setPwdError(error.message); return; }
    setNewPassword("");
    setConfirmPassword("");
    setPwdSaved(true);
    setTimeout(() => setPwdSaved(false), 3000);
  }

  async function handleSave() {
    if (!profile) return;
    setSaving(true);

    let avatarUrl = profile.avatar_url;

    if (avatarFile) {
      const ext = avatarFile.name.split(".").pop();
      const filePath = `avatars/${profile.id}.${ext}`;
      await supabase.storage.from("avatars").upload(filePath, avatarFile, { upsert: true });
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(filePath);
      avatarUrl = urlData.publicUrl;
    }

    await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ full_name: form.fullName, company_name: form.company, avatar_url: avatarUrl }),
    });

    setProfile((p) => p ? { ...p, full_name: form.fullName, company_name: form.company || null, avatar_url: avatarUrl } : p);
    setSaved(true);
    setSaving(false);
    setTimeout(() => setSaved(false), 2500);
  }

  const inputClass =
    "w-full px-3.5 py-2.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[var(--foreground)] text-sm outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/30 transition-all";

  return (
    <div className="flex flex-col min-h-screen">
      <Topbar title="Settings" subtitle="Manage your profile and preferences" userId={userId} />

      <div className="flex-1 p-6 animate-fade-in">
        <div className="max-w-lg space-y-6">
          {/* Profile */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6 space-y-5">
            <h3 className="text-sm font-semibold text-[var(--foreground)]">Profile</h3>

            {/* Avatar */}
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="relative w-16 h-16 rounded-full flex-shrink-0 overflow-hidden group cursor-pointer"
              >
                <div className="w-full h-full rounded-full bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center overflow-hidden">
                  {avatarPreview ? (
                    <img
                      src={avatarPreview}
                      alt="Avatar"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-sm font-bold text-[var(--accent)]">
                      {form.fullName ? getInitials(form.fullName) : <User className="w-5 h-5 text-[var(--foreground-subtle)]" />}
                    </span>
                  )}
                </div>
                <div className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Camera className="w-5 h-5 text-white" />
                </div>
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
              <div>
                <p className="text-sm font-medium text-[var(--foreground)]">Profile Picture</p>
                <p className="text-xs text-[var(--foreground-subtle)] mt-0.5">
                  Click to upload. JPG, PNG, GIF up to 5MB
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--foreground-muted)] flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" /> Full Name
                </label>
                <input
                  type="text"
                  value={form.fullName}
                  onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                  className={inputClass}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--foreground-muted)] flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" /> Email Address
                </label>
                <input
                  type="email"
                  value={profile?.email ?? ""}
                  disabled
                  className={`${inputClass} opacity-50 cursor-not-allowed`}
                />
                <p className="text-xs text-[var(--foreground-subtle)]">
                  Contact rbrandr to change your email
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--foreground-muted)] flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5" /> Company Name
                </label>
                <input
                  type="text"
                  value={form.company}
                  onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                  placeholder="Your company name"
                  className={inputClass}
                />
              </div>
            </div>

            <Button onClick={handleSave} loading={saving} className="w-full">
              {saved ? (
                <>✓ Saved</>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Changes
                </>
              )}
            </Button>
          </div>

          {/* Security */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6 space-y-4">
            <h3 className="text-sm font-semibold text-[var(--foreground)] flex items-center gap-2">
              <Lock className="w-4 h-4 text-[var(--foreground-muted)]" />
              Change Password
            </h3>
            {pwdSaved ? (
              <div className="flex items-center gap-2 text-sm text-emerald-400">
                <CheckCircle2 className="w-4 h-4" /> Password updated successfully.
              </div>
            ) : (
              <form onSubmit={handleChangePassword} className="space-y-3">
                <div className="relative">
                  <input
                    type={showNewPwd ? "text" : "password"}
                    required
                    placeholder="New password (min. 8 characters)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className={inputClass}
                  />
                  <button type="button" onClick={() => setShowNewPwd((s) => !s)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--foreground-subtle)] hover:text-[var(--foreground-muted)] cursor-pointer">
                    {showNewPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <input
                  type="password"
                  required
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={inputClass}
                />
                {pwdError && (
                  <p className="text-xs text-red-400">{pwdError}</p>
                )}
                <Button type="submit" loading={changingPwd} variant="secondary" className="w-full">
                  Update Password
                </Button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

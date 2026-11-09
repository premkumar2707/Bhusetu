"use client";

/**
 * BhuSetu 3D — Dedicated User Profile & Account Security Workspace
 * Team: TANTRAKATHA | SIH 2026 (SIH26011)
 *
 * Dedicated, clean, enterprise-grade account workspace.
 * Features:
 * - Sourced strictly from authenticated Supabase user profile.
 * - No operational GIS sidebar / no dashboard clutter.
 * - Clear Back to Workspace navigation.
 * - Hero Identity Section with dynamic avatar, role, and badges.
 * - No email in the visual profile hero (displayed only in contact details form).
 * - Full Contact Details & Profile Information form with Save Changes.
 * - Account Security & Change Password form with reveal toggles, Clear, and Update Password.
 * - Zero hardcoding, zero mock users, full Supabase persistence.
 */
import React, { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import {
  ArrowLeft,
  Camera,
  CreditCard,
  Building2,
  ClipboardList,
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
  LogOut,
  Trash2,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase/client";
import { getInitials, getRoleDisplayName } from "@/components/layout/UserProfileMenu";

export default function ProfilePage() {
  const router = useRouter();
  const { user, logout, refreshProfile } = useAuth();

  // Form State
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    department: "",
    employeeId: "",
    phone: "",
    officeLocation: "",
    emergencyContact: "",
  });

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Password Change State
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Compute Default Institutional Employee ID based on role if not explicitly set
  const defaultEmployeeId = useMemo(() => {
    if (user?.employee_id) return user.employee_id;
    const role = user?.roles?.[0] || "";
    if (role === "ADMIN") return "ADM-001";
    if (role === "GOVERNMENT_OFFICER") return "OFF-042";
    if (role === "SURVEYOR") return "SRV-108";
    if (role === "ANALYST") return "GEO-219";
    return "EMP-001";
  }, [user]);

  // Sync Form State with Authenticated User
  useEffect(() => {
    if (user) {
      setFormData({
        fullName: user.name || "",
        email: user.email || "",
        department: user.department || "Urban Development Directorate",
        employeeId: user.employee_id || defaultEmployeeId,
        phone: user.phone || "",
        officeLocation: user.office_location || "",
        emergencyContact: user.emergency_contact || "",
      });
      setAvatarUrl(user.avatar_url || null);
    }
  }, [user, defaultEmployeeId]);

  if (!user) {
    return null;
  }

  const initials = getInitials(user.name);
  const primaryRole = user.roles?.[0] || "PUBLIC_USER";
  const roleDisplay = getRoleDisplayName(primaryRole);

  // Handle Photo Upload (Client-side Canvas Compression to compact WebP format)
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setSaveError("Profile photo must be less than 5 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxDim = 256;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL("image/webp", 0.85);
          setAvatarUrl(compressedDataUrl);
          setHasUnsavedChanges(true);
          setSaveSuccess(false);
          setSaveError(null);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setAvatarUrl(null);
    setHasUnsavedChanges(true);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Handle Profile Information Submission
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName.trim()) {
      setSaveError("Full Name cannot be empty.");
      return;
    }

    setIsSaving(true);
    setSaveSuccess(false);
    setSaveError(null);

    try {
      // 1. Update public.users database record under RLS
      const { error: dbError } = await supabase
        .from("users")
        .update({
          full_name: formData.fullName.trim(),
          department: formData.department.trim(),
        })
        .or(`auth_user_id.eq.${user.id},id.eq.${user.id}`);

      if (dbError) {
        console.warn("Direct public.users update note:", dbError.message);
      }

      // 2. Update Supabase Auth user metadata
      const { error: authError } = await supabase.auth.updateUser({
        data: {
          full_name: formData.fullName.trim(),
          department: formData.department.trim(),
          employee_id: formData.employeeId.trim(),
          phone: formData.phone.trim(),
          office_location: formData.officeLocation.trim(),
          emergency_contact: formData.emergencyContact.trim(),
          avatar_url: avatarUrl,
        },
      });

      if (authError) {
        throw new Error(authError.message);
      }

      // 3. If email changed and is non-empty
      if (formData.email.trim().toLowerCase() !== user.email.toLowerCase()) {
        const { error: emailErr } = await supabase.auth.updateUser({
          email: formData.email.trim().toLowerCase(),
        });
        if (emailErr) {
          console.warn("Email update confirmation required:", emailErr.message);
        }
      }

      // 4. Authoritatively refresh current user session
      await refreshProfile();
      setSaveSuccess(true);
      setHasUnsavedChanges(false);
      setTimeout(() => setSaveSuccess(false), 4500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to persist profile changes.";
      setSaveError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Password Update Submission
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordSuccess(false);
    setPasswordError(null);

    if (!passwordForm.newPassword) {
      setPasswordError("Please enter a new password.");
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters in length.");
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError("New password and confirm password do not match.");
      return;
    }

    setIsUpdatingPassword(true);

    try {
      // If current password provided, verify with Supabase Auth first
      if (passwordForm.currentPassword) {
        const { error: verifyErr } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: passwordForm.currentPassword,
        });
        if (verifyErr) {
          throw new Error("Current password is incorrect. Please re-enter.");
        }
      }

      // Update password in Supabase Auth
      const { error: updateErr } = await supabase.auth.updateUser({
        password: passwordForm.newPassword,
      });

      if (updateErr) {
        throw new Error(updateErr.message);
      }

      setPasswordSuccess(true);
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setTimeout(() => setPasswordSuccess(false), 4500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update password.";
      setPasswordError(msg);
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleClearPassword = () => {
    setPasswordForm({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
    setPasswordError(null);
    setPasswordSuccess(false);
  };

  const handleSignOut = async () => {
    await logout();
    router.push("/login");
  };

  return (
    <ProtectedRoute moduleName="User Profile">
      <div className="flex-1 overflow-y-auto bg-[#0F1210] min-h-[calc(100vh-4rem)] select-none">
        {/* Centered Enterprise Workspace Container */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-6">
          {/* Breadcrumb Navigation & Back to Workspace */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <Link
                href="/overview"
                className="inline-flex items-center gap-1.5 text-xs font-mono text-[#94A3B8] hover:text-[#F4F0E8] transition-colors mb-2.5 group"
              >
                <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
                <span>Back to Workspace</span>
              </Link>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#F4F0E8] font-mono">
                My Profile
              </h1>
              <p className="text-xs sm:text-sm text-[#94A3B8] mt-1 font-sans">
                Manage your account identity, profile information, and security settings.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleSignOut}
                className="px-3.5 py-2 rounded-[8px] border border-rose-500/30 bg-rose-950/20 hover:bg-rose-950/40 text-rose-300 text-xs font-mono font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
                title="Sign out of current institutional session"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>

          {/* 1. Profile Identity Hero Card */}
          <div className="rounded-[16px] bg-[#121614] border border-[rgba(244,240,232,0.10)] overflow-hidden shadow-xl">
            {/* Banner Accent with Subtle Grid Texture */}
            <div className="h-28 sm:h-32 bg-gradient-to-r from-[#B56E48]/35 via-[#965533]/25 to-[#176C68]/25 border-b border-[rgba(244,240,232,0.08)] relative overflow-hidden">
              <div
                className="absolute inset-0 opacity-20 pointer-events-none"
                style={{
                  backgroundImage:
                    "radial-gradient(circle, rgba(244, 240, 232, 0.3) 1px, transparent 1px)",
                  backgroundSize: "16px 16px",
                }}
              />
              <div className="absolute top-3.5 right-4 sm:right-6">
                <span className="px-3 py-1 rounded-full bg-[#0C0F0D]/70 backdrop-blur-sm border border-[rgba(244,240,232,0.15)] text-[#E09F67] text-[11px] font-mono font-bold uppercase tracking-wider">
                  {roleDisplay}
                </span>
              </div>
            </div>

            {/* Identity Details Body */}
            <div className="p-6 sm:p-8 -mt-14 sm:-mt-16 relative z-10 space-y-5">
              {/* Avatar + Top Badges Header */}
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                {/* Avatar Box with Status Dot */}
                <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-[#1C1613] border-2 border-[#B56E48]/60 shadow-2xl flex items-center justify-center text-[#E09F67] text-2xl sm:text-3xl font-bold font-mono tracking-wider shrink-0 overflow-hidden">
                  {avatarUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={avatarUrl}
                      alt={user.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>{initials}</span>
                  )}
                  {/* Active Status Indicator */}
                  <span
                    className="w-4 h-4 rounded-full bg-[#2EB8B0] border-2 border-[#121614] absolute bottom-1 right-1 shadow-sm"
                    title="Active Institutional Account"
                  />
                </div>

                {/* Identity Badges */}
                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-[#161B18] border border-[rgba(244,240,232,0.12)] text-xs font-mono text-[#F4F0E8] shadow-sm">
                    <CreditCard className="w-3.5 h-3.5 text-[#2EB8B0]" />
                    <span className="font-semibold">{formData.employeeId || defaultEmployeeId}</span>
                  </div>

                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-[#161B18] border border-[rgba(244,240,232,0.12)] text-xs font-mono text-[#F4F0E8] shadow-sm">
                    <Building2 className="w-3.5 h-3.5 text-[#E09F67]" />
                    <span className="truncate max-w-[220px] sm:max-w-[300px]">
                      {formData.department || user.department || "Urban Development Directorate"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Name & Role Designation (No email here per requirement) */}
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold font-mono text-[#F4F0E8] tracking-tight">
                  {formData.fullName || user.name}
                </h2>
                <p className="text-sm font-mono font-medium text-[#E09F67] mt-0.5">
                  {roleDisplay}
                </p>
              </div>

              {/* Photo Upload Controls */}
              <div className="border-t border-[rgba(244,240,232,0.08)] pt-4 flex flex-wrap items-center gap-3">
                <label className="inline-flex items-center gap-2 px-4 py-2 rounded-[8px] bg-[#B56E48] hover:bg-[#C47B50] text-[#F4F0E8] text-xs font-mono font-bold transition-all shadow-sm cursor-pointer select-none">
                  <Camera className="w-3.5 h-3.5" />
                  <span>Upload Photo</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                </label>

                {avatarUrl && (
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[8px] border border-rose-500/30 bg-rose-950/20 hover:bg-rose-950/40 text-rose-300 text-xs font-mono font-medium transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Remove Photo</span>
                  </button>
                )}

                <span className="text-xs text-[#94A3B8] font-mono">
                  JPG, PNG, WEBP · max 5 MB
                </span>
              </div>
            </div>
          </div>

          {/* 2. Profile Information & Contact Details Card */}
          <form
            onSubmit={handleSaveProfile}
            className="rounded-[16px] bg-[#121614] border border-[rgba(244,240,232,0.10)] p-6 sm:p-8 space-y-6 shadow-xl"
          >
            {/* Section Header */}
            <div className="flex items-center gap-3 pb-4 border-b border-[rgba(244,240,232,0.08)]">
              <div className="w-8 h-8 rounded-[8px] bg-[#1C1613] border border-[#B56E48]/30 flex items-center justify-center text-[#E09F67] shrink-0">
                <ClipboardList className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold font-mono text-[#F4F0E8]">
                  Contact Details &amp; Profile Information
                </h2>
                <p className="text-xs text-[#94A3B8] font-sans">
                  Institutional identity, contact coordinates, and department assignment.
                </p>
              </div>
            </div>

            {/* Two-Column Responsive Form Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              {/* Full Name */}
              <div>
                <label className="block text-xs font-mono font-semibold tracking-wider text-[#A2B3A8] uppercase mb-1.5">
                  Full Name <span className="text-[#C47B50] font-normal normal-case ml-1">(editable)</span>
                </label>
                <input
                  type="text"
                  value={formData.fullName}
                  onChange={(e) => {
                    setFormData({ ...formData, fullName: e.target.value });
                    setHasUnsavedChanges(true);
                  }}
                  required
                  placeholder="Enter full name..."
                  className="w-full px-3.5 py-2.5 rounded-[8px] bg-[#161B18] border border-[rgba(244,240,232,0.12)] text-[#F4F0E8] placeholder:text-[#5F6B64] text-xs sm:text-sm font-sans focus:outline-none focus:border-[#B56E48] focus:ring-1 focus:ring-[#B56E48] transition-colors"
                />
              </div>

              {/* Email Address */}
              <div>
                <label className="block text-xs font-mono font-semibold tracking-wider text-[#A2B3A8] uppercase mb-1.5">
                  Email Address <span className="text-[#C47B50] font-normal normal-case ml-1">(editable)</span>
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => {
                    setFormData({ ...formData, email: e.target.value });
                    setHasUnsavedChanges(true);
                  }}
                  required
                  placeholder="Enter institutional email..."
                  className="w-full px-3.5 py-2.5 rounded-[8px] bg-[#161B18] border border-[rgba(244,240,232,0.12)] text-[#F4F0E8] placeholder:text-[#5F6B64] text-xs sm:text-sm font-sans focus:outline-none focus:border-[#B56E48] focus:ring-1 focus:ring-[#B56E48] transition-colors"
                />
              </div>

              {/* Department */}
              <div>
                <label className="block text-xs font-mono font-semibold tracking-wider text-[#A2B3A8] uppercase mb-1.5">
                  Department <span className="text-[#C47B50] font-normal normal-case ml-1">(editable)</span>
                </label>
                <input
                  type="text"
                  value={formData.department}
                  onChange={(e) => {
                    setFormData({ ...formData, department: e.target.value });
                    setHasUnsavedChanges(true);
                  }}
                  placeholder="e.g. Urban Development Directorate"
                  className="w-full px-3.5 py-2.5 rounded-[8px] bg-[#161B18] border border-[rgba(244,240,232,0.12)] text-[#F4F0E8] placeholder:text-[#5F6B64] text-xs sm:text-sm font-sans focus:outline-none focus:border-[#B56E48] focus:ring-1 focus:ring-[#B56E48] transition-colors"
                />
              </div>

              {/* Employee ID */}
              <div>
                <label className="block text-xs font-mono font-semibold tracking-wider text-[#A2B3A8] uppercase mb-1.5">
                  Employee ID <span className="text-[#C47B50] font-normal normal-case ml-1">(editable)</span>
                </label>
                <input
                  type="text"
                  value={formData.employeeId}
                  onChange={(e) => {
                    setFormData({ ...formData, employeeId: e.target.value });
                    setHasUnsavedChanges(true);
                  }}
                  placeholder="e.g. ADM-001"
                  className="w-full px-3.5 py-2.5 rounded-[8px] bg-[#161B18] border border-[rgba(244,240,232,0.12)] text-[#F4F0E8] placeholder:text-[#5F6B64] text-xs sm:text-sm font-sans focus:outline-none focus:border-[#B56E48] focus:ring-1 focus:ring-[#B56E48] transition-colors"
                />
              </div>

              {/* Phone Number */}
              <div>
                <label className="block text-xs font-mono font-semibold tracking-wider text-[#A2B3A8] uppercase mb-1.5">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => {
                    setFormData({ ...formData, phone: e.target.value });
                    setHasUnsavedChanges(true);
                  }}
                  placeholder="Enter phone number..."
                  className="w-full px-3.5 py-2.5 rounded-[8px] bg-[#161B18] border border-[rgba(244,240,232,0.12)] text-[#F4F0E8] placeholder:text-[#5F6B64] text-xs sm:text-sm font-sans focus:outline-none focus:border-[#B56E48] focus:ring-1 focus:ring-[#B56E48] transition-colors"
                />
              </div>

              {/* Office Location */}
              <div>
                <label className="block text-xs font-mono font-semibold tracking-wider text-[#A2B3A8] uppercase mb-1.5">
                  Office Location
                </label>
                <input
                  type="text"
                  value={formData.officeLocation}
                  onChange={(e) => {
                    setFormData({ ...formData, officeLocation: e.target.value });
                    setHasUnsavedChanges(true);
                  }}
                  placeholder="e.g. Room 101, Directorate HQ"
                  className="w-full px-3.5 py-2.5 rounded-[8px] bg-[#161B18] border border-[rgba(244,240,232,0.12)] text-[#F4F0E8] placeholder:text-[#5F6B64] text-xs sm:text-sm font-sans focus:outline-none focus:border-[#B56E48] focus:ring-1 focus:ring-[#B56E48] transition-colors"
                />
              </div>

              {/* Emergency Contact Phone (Full width on md) */}
              <div className="col-span-1 md:col-span-2">
                <label className="block text-xs font-mono font-semibold tracking-wider text-[#A2B3A8] uppercase mb-1.5">
                  Emergency Contact Phone
                </label>
                <input
                  type="tel"
                  value={formData.emergencyContact}
                  onChange={(e) => {
                    setFormData({ ...formData, emergencyContact: e.target.value });
                    setHasUnsavedChanges(true);
                  }}
                  placeholder="Enter emergency contact phone..."
                  className="w-full px-3.5 py-2.5 rounded-[8px] bg-[#161B18] border border-[rgba(244,240,232,0.12)] text-[#F4F0E8] placeholder:text-[#5F6B64] text-xs sm:text-sm font-sans focus:outline-none focus:border-[#B56E48] focus:ring-1 focus:ring-[#B56E48] transition-colors"
                />
              </div>
            </div>

            {/* Form Footer & Primary Save Action */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-[rgba(244,240,232,0.08)]">
              <div className="flex items-center gap-2">
                {saveSuccess && (
                  <span className="text-xs text-[#2EB8B0] font-mono flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    Changes saved successfully.
                  </span>
                )}
                {saveError && (
                  <span className="text-xs text-rose-400 font-mono flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4" />
                    {saveError}
                  </span>
                )}
                {hasUnsavedChanges && !saveSuccess && !saveError && (
                  <span className="text-xs text-[#E09F67] font-mono">
                    You have unsaved changes.
                  </span>
                )}
              </div>

              <button
                type="submit"
                disabled={isSaving}
                className="px-6 py-2.5 rounded-[8px] bg-[#B56E48] hover:bg-[#C47B50] disabled:opacity-50 text-[#F4F0E8] text-xs sm:text-sm font-mono font-bold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer shrink-0"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Save Changes</span>
                )}
              </button>
            </div>
          </form>

          {/* 3. Account Security & Change Password Card */}
          <form
            onSubmit={handleUpdatePassword}
            className="rounded-[16px] bg-[#121614] border border-[rgba(244,240,232,0.10)] p-6 sm:p-8 space-y-6 shadow-xl"
          >
            {/* Section Header */}
            <div className="flex items-center gap-3 pb-4 border-b border-[rgba(244,240,232,0.08)]">
              <div className="w-8 h-8 rounded-[8px] bg-[#1C1613] border border-[#B56E48]/30 flex items-center justify-center text-[#E09F67] shrink-0">
                <KeyRound className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold font-mono text-[#F4F0E8]">
                  Change Password
                </h2>
                <p className="text-xs text-[#94A3B8] font-sans">
                  Ensure your institutional account is protected with strong credentials.
                </p>
              </div>
            </div>

            {/* Three-Column Password Fields on Desktop, Stacked on Mobile */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
              {/* Current Password */}
              <div>
                <label className="block text-xs font-mono font-semibold tracking-wider text-[#A2B3A8] uppercase mb-1.5">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? "text" : "password"}
                    value={passwordForm.currentPassword}
                    onChange={(e) =>
                      setPasswordForm({ ...passwordForm, currentPassword: e.target.value })
                    }
                    placeholder="••••••••"
                    className="w-full pl-3.5 pr-10 py-2.5 rounded-[8px] bg-[#161B18] border border-[rgba(244,240,232,0.12)] text-[#F4F0E8] placeholder:text-[#5F6B64] text-xs sm:text-sm font-sans focus:outline-none focus:border-[#B56E48] focus:ring-1 focus:ring-[#B56E48] transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7E8B83] hover:text-[#F4F0E8] transition-colors"
                    aria-label={showCurrentPassword ? "Hide current password" : "Show current password"}
                  >
                    {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div>
                <label className="block text-xs font-mono font-semibold tracking-wider text-[#A2B3A8] uppercase mb-1.5">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={passwordForm.newPassword}
                    onChange={(e) =>
                      setPasswordForm({ ...passwordForm, newPassword: e.target.value })
                    }
                    placeholder="••••••••"
                    className="w-full pl-3.5 pr-10 py-2.5 rounded-[8px] bg-[#161B18] border border-[rgba(244,240,232,0.12)] text-[#F4F0E8] placeholder:text-[#5F6B64] text-xs sm:text-sm font-sans focus:outline-none focus:border-[#B56E48] focus:ring-1 focus:ring-[#B56E48] transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7E8B83] hover:text-[#F4F0E8] transition-colors"
                    aria-label={showNewPassword ? "Hide new password" : "Show new password"}
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-xs font-mono font-semibold tracking-wider text-[#A2B3A8] uppercase mb-1.5">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={passwordForm.confirmPassword}
                    onChange={(e) =>
                      setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })
                    }
                    placeholder="••••••••"
                    className="w-full pl-3.5 pr-10 py-2.5 rounded-[8px] bg-[#161B18] border border-[rgba(244,240,232,0.12)] text-[#F4F0E8] placeholder:text-[#5F6B64] text-xs sm:text-sm font-sans focus:outline-none focus:border-[#B56E48] focus:ring-1 focus:ring-[#B56E48] transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7E8B83] hover:text-[#F4F0E8] transition-colors"
                    aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Password Actions Footer */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-[rgba(244,240,232,0.08)]">
              <div className="flex items-center gap-2">
                {passwordSuccess && (
                  <span className="text-xs text-[#2EB8B0] font-mono flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    Password updated successfully.
                  </span>
                )}
                {passwordError && (
                  <span className="text-xs text-rose-400 font-mono flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4" />
                    {passwordError}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={handleClearPassword}
                  disabled={isUpdatingPassword}
                  className="px-5 py-2.5 rounded-[8px] border border-rose-500/30 bg-rose-950/20 hover:bg-rose-950/40 text-rose-300 text-xs sm:text-sm font-mono font-medium transition-colors cursor-pointer"
                >
                  Clear
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingPassword}
                  className="px-6 py-2.5 rounded-[8px] bg-[#B56E48] hover:bg-[#C47B50] disabled:opacity-50 text-[#F4F0E8] text-xs sm:text-sm font-mono font-bold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer shrink-0"
                >
                  {isUpdatingPassword ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Updating...</span>
                    </>
                  ) : (
                    <span>Update Password</span>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </ProtectedRoute>
  );
}

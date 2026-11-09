"use client";

/**
 * BhuSetu 3D Enterprise Global User Profile Menu Component
 * 
 * Replaces fragmented header user card + role badge + logout button
 * with a single compact, accessible, dynamic profile trigger and floating account menu.
 * 
 * Strict specifications:
 * - Dynamic data sourced strictly from authenticated Supabase user profile.
 * - Zero email rendering (email removed from trigger and dropdown).
 * - Standalone ADMIN badge and separate header Logout button removed.
 * - Dynamic initials generation (e.g., Vikram Sen -> VS, Sunil Rao -> SR).
 * - Exact human-readable role display (ADMIN -> Admin, SURVEYOR -> Surveyor, etc.).
 * - Viewport collision protection, click-outside and Escape key management.
 * - Real auth logout via useAuth().logout().
 */
import React, { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { User as UserIcon, LogOut, ChevronDown, ChevronRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

/**
 * Computes robust two-letter initials from a user's display name.
 * Handles single words, multi-word names, extra whitespace, and punctuation.
 */
export function getInitials(name?: string | null, fallback = "U"): string {
  if (!name || !name.trim()) return fallback;
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback;
  if (parts.length === 1) {
    const single = parts[0];
    return single.length >= 2
      ? single.substring(0, 2).toUpperCase()
      : single.charAt(0).toUpperCase();
  }
  const first = parts[0].charAt(0);
  const last = parts[parts.length - 1].charAt(0);
  return `${first}${last}`.toUpperCase();
}

/**
 * Maps system role code to the application's authoritative human-readable label.
 * Specifications:
 * ADMIN -> Admin
 * SURVEYOR -> Surveyor
 * GOVERNMENT_OFFICER -> Government Officer
 * ANALYST -> Analyst
 * PLANNER -> Planner
 * PUBLIC_USER -> Public User
 */
export function getRoleDisplayName(role?: string | null): string {
  if (!role) return "Public User";
  const normalized = role.toUpperCase().trim();
  switch (normalized) {
    case "ADMIN":
      return "Admin";
    case "GOVERNMENT_OFFICER":
    case "OFFICER":
      return "Government Officer";
    case "SURVEYOR":
      return "Surveyor";
    case "ANALYST":
      return "Analyst";
    case "PLANNER":
      return "Planner";
    case "PUBLIC_USER":
      return "Public User";
    default:
      return role
        .split(/[_\s]+/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(" ");
  }
}

interface UserProfileMenuProps {
  /** Optional custom class to adjust trigger styling if needed */
  className?: string;
  /** Whether to show a compact variant on small screens */
  compactOnMobile?: boolean;
}

export function UserProfileMenu({
  className,
  compactOnMobile = true,
}: UserProfileMenuProps) {
  const router = useRouter();
  const { user, logout, isAuthenticated, isLoading } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Close dropdown on Escape key and restore focus to trigger
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && isOpen) {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    }

    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleToggle = () => {
    setIsOpen((prev) => !prev);
  };

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleSignOut = async () => {
    handleClose();
    await logout();
    router.push("/login");
  };

  // If session is resolving, render a refined subtle skeleton
  if (isLoading) {
    return (
      <div className="h-9 px-3 rounded-[6px] bg-[#141816] border border-[rgba(244,240,232,0.08)] flex items-center gap-2.5 animate-pulse">
        <div className="w-6 h-6 rounded-full bg-[#1A201D]" />
        <div className="w-16 h-3 rounded bg-[#1A201D] hidden sm:block" />
      </div>
    );
  }

  // If not authenticated, do not render profile menu
  if (!isAuthenticated || !user) {
    return null;
  }

  const initials = getInitials(user.name);
  const primaryRole = user.roles?.[0] || "PUBLIC_USER";
  const roleLabel = getRoleDisplayName(primaryRole);

  return (
    <div ref={containerRef} className={cn("relative inline-block text-left", className)}>
      {/* Profile Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={`Open profile menu for ${user.name || "authenticated user"}`}
        className={cn(
          "group flex items-center gap-2.5 px-2.5 py-1.5 rounded-[6px] text-xs font-mono transition-all duration-150 cursor-pointer select-none",
          "border border-[rgba(244,240,232,0.10)] bg-[#141816]",
          "hover:bg-[#1A201D] hover:border-[rgba(244,240,232,0.22)]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B56E48] focus-visible:ring-offset-1 focus-visible:ring-offset-[#0C0F0D]",
          isOpen && "bg-[#1A201D] border-[#B56E48]/50 shadow-sm"
        )}
      >
        {/* Circular Avatar with Dynamic Photo / Initials */}
        <div
          className="w-7 h-7 rounded-full bg-[#1C1613] border border-[#B56E48]/40 flex items-center justify-center text-[#E09F67] text-[11px] font-bold tracking-tight shrink-0 shadow-inner group-hover:border-[#B56E48]/70 transition-colors overflow-hidden"
          aria-hidden="true"
        >
          {user.avatar_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
          ) : (
            initials
          )}
        </div>

        {/* User Display Name */}
        <span
          className={cn(
            "font-semibold text-xs text-[#F4F0E8] truncate max-w-[120px] sm:max-w-[160px] tracking-tight",
            compactOnMobile ? "hidden sm:inline" : "inline"
          )}
          title={user.name}
        >
          {user.name}
        </span>

        {/* Small Downward Chevron */}
        <ChevronDown
          className={cn(
            "w-3.5 h-3.5 text-[#8C988F] group-hover:text-[#F4F0E8] transition-transform duration-200 shrink-0",
            isOpen && "rotate-180 text-[#E09F67]"
          )}
          aria-hidden="true"
        />
      </button>

      {/* Floating Account Dropdown Menu */}
      {isOpen && (
        <div
          role="menu"
          aria-orientation="vertical"
          aria-label="User Account Menu"
          className={cn(
            "absolute right-0 top-full mt-1.5 w-64 max-w-[calc(100vw-2rem)]",
            "bg-[#0F1210] border border-[rgba(244,240,232,0.12)] rounded-[10px]",
            "shadow-2xl shadow-black/80 py-1.5 z-50 overflow-hidden",
            "animate-in fade-in-50 zoom-in-95 duration-100 ease-out origin-top-right"
          )}
        >
          {/* Header Section: Avatar, Full Name, Human-Readable Role (NO EMAIL) */}
          <div className="px-3.5 py-3 border-b border-[rgba(244,240,232,0.08)] bg-[#121614]/80">
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-full bg-[#1C1613] border border-[#B56E48]/40 flex items-center justify-center text-[#E09F67] text-xs font-bold shrink-0 shadow-inner overflow-hidden"
                aria-hidden="true"
              >
                {user.avatar_url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  initials
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div
                  className="font-bold text-sm text-[#F4F0E8] truncate font-mono tracking-tight"
                  title={user.name}
                >
                  {user.name}
                </div>
                <div className="text-[11px] font-mono text-[#A2B3A8] truncate mt-0.5 font-medium">
                  {roleLabel}
                </div>
              </div>
            </div>
          </div>

          {/* Action Menu Items */}
          <div className="py-1">
            {/* My Profile Action */}
            <Link
              href="/profile"
              onClick={handleClose}
              role="menuitem"
              className={cn(
                "group flex items-center justify-between px-3.5 py-2.5 text-xs font-mono transition-colors",
                "text-[#D9D2C5] hover:text-[#F4F0E8] hover:bg-[#1A201D]"
              )}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <UserIcon className="w-4 h-4 text-[#A2B3A8] group-hover:text-[#E09F67] transition-colors shrink-0" />
                <span className="font-medium">My Profile</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-[#5A6B62] group-hover:text-[#A2B3A8] transition-transform group-hover:translate-x-0.5 shrink-0" />
            </Link>
          </div>

          {/* Divider */}
          <div className="border-t border-[rgba(244,240,232,0.08)] my-1" />

          {/* Sign Out Action */}
          <div className="px-1 py-0.5">
            <button
              type="button"
              onClick={handleSignOut}
              role="menuitem"
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2 rounded-[6px] text-xs font-mono font-medium transition-colors text-left cursor-pointer",
                "text-rose-400/90 hover:text-rose-300 hover:bg-rose-950/20"
              )}
            >
              <LogOut className="w-4 h-4 text-rose-400/90 group-hover:text-rose-300 shrink-0" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

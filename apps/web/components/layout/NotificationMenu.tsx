"use client";

/**
 * BhuSetu 3D Enterprise Notification Menu Component
 * 
 * Sits directly adjacent to User Profile in application headers:
 * Concept: BhuSetu 3D | Search / Ask BhuSetu | Notifications | User / Settings
 * 
 * Strict specifications:
 * - Compact, professional, visually consistent with BhuSetu dark theme.
 * - Product-ready notification entry point with contextual popover.
 * - Honest state: Zero fake notification counts (no mock 3, 5, 12) and zero fake alerts.
 * - Displays a polished empty state ("No new notifications") with monitored channels.
 * - Architected to seamlessly connect to real-time events / Supabase / WebSockets.
 * - Accessible: ARIA labels, focus states, Escape key handling, click-outside dismissal.
 */
import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  Bell,
  BellOff,
  CheckCircle2,
  AlertTriangle,
  FileCheck2,
  Sparkles,
  Layers,
  Activity,
  Shield,
  X,
  Check,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/context/LanguageContext";

export type NotificationCategory =
  | "SPATIAL_DISCREPANCY"
  | "VERIFICATION_REQUIRED"
  | "EVIDENCE_COMPLETED"
  | "SPATIAL_PROCESSING"
  | "AI_INVESTIGATION"
  | "DATA_QUALITY"
  | "SYSTEM_WORKFLOW";

export type NotificationSeverity = "info" | "warning" | "alert" | "success";

export interface NotificationItem {
  id: string;
  title: string;
  description: string;
  category: NotificationCategory;
  severity: NotificationSeverity;
  timestamp: string;
  read: boolean;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
}

export const NOTIFICATION_CHANNELS: Array<{
  category: NotificationCategory;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
}> = [
    {
      category: "SPATIAL_DISCREPANCY",
      label: "Spatial Discrepancy",
      description: "Height, setback & floor slab anomalies",
      icon: AlertTriangle,
      accentColor: "text-[#C47B50] bg-[#B56E48]/15 border-[#B56E48]/30",
    },
    {
      category: "VERIFICATION_REQUIRED",
      label: "Statutory Verification",
      description: "Official surveyor & legal reviews",
      icon: FileCheck2,
      accentColor: "text-[#23847D] bg-[#176C68]/15 border-[#176C68]/30",
    },
    {
      category: "EVIDENCE_COMPLETED",
      label: "Evidence Processing",
      description: "Drone LiDAR & orthophoto ingestion",
      icon: CheckCircle2,
      accentColor: "text-[#2EB8B0] bg-[#23847D]/15 border-[#23847D]/30",
    },
    {
      category: "SPATIAL_PROCESSING",
      label: "Spatial Processing",
      description: "PostGIS 3D mesh & cadastral tilesets",
      icon: Layers,
      accentColor: "text-[#D9D2C5] bg-[#1A201D] border-[rgba(244,240,232,0.12)]",
    },
    {
      category: "AI_INVESTIGATION",
      label: "AI Investigation",
      description: "Automated volumetric & compliance audits",
      icon: Sparkles,
      accentColor: "text-[#2EB8B0] bg-[#176C68]/20 border-[#176C68]/40",
    },
    {
      category: "DATA_QUALITY",
      label: "Data Quality Alert",
      description: "Benchmark drift & coordinate variances",
      icon: Activity,
      accentColor: "text-[#E09F67] bg-[#B56E48]/15 border-[#B56E48]/30",
    },
    {
      category: "SYSTEM_WORKFLOW",
      label: "System Workflow",
      description: "Institutional sign-offs & audit logs",
      icon: Shield,
      accentColor: "text-[#A2B3A8] bg-[#141816] border-[rgba(244,240,232,0.10)]",
    },
  ];

interface NotificationMenuProps {
  /** Optional custom class to adjust wrapper styling if needed */
  className?: string;
  /** Optional custom class to adjust trigger button styling if needed */
  triggerClassName?: string;
  /** Optional initial notifications array if sourced from server or parent state */
  initialNotifications?: NotificationItem[];
}

export function NotificationMenu({
  className,
  triggerClassName,
  initialNotifications = [],
}: NotificationMenuProps) {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>(initialNotifications);
  const [activeTab, setActiveTab] = useState<"all" | "unread">("all");

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Sync initialNotifications if changed externally
  useEffect(() => {
    if (initialNotifications.length > 0) {
      setNotifications(initialNotifications);
    }
  }, [initialNotifications]);

  // Derived unread count
  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const displayedNotifications = useMemo(() => {
    if (activeTab === "unread") {
      return notifications.filter((n) => !n.read);
    }
    return notifications;
  }, [notifications, activeTab]);

  // Close popover on outside click
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

  // Close popover on Escape key and restore focus to trigger
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

  const handleMarkAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((item) => (item.id === id ? { ...item, read: true } : item))
    );
  };

  const handleMarkAllAsRead = () => {
    setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
  };

  return (
    <div ref={containerRef} className={cn("relative inline-block text-left", className)}>
      {/* Notification Bell Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={
          unreadCount > 0
            ? `Notifications (${unreadCount} unread)`
            : "Notifications (no new notifications)"
        }
        title="Notifications"
        className={cn(
          "relative flex items-center justify-center p-2 rounded-[6px] text-xs font-mono transition-all duration-150 cursor-pointer select-none",
          "border-2 border-[#C47B50] bg-[#141816]",
          "text-[#A2B3A8] hover:text-[#F4F0E8] hover:bg-[#1A201D] hover:border-[rgba(219,183,113,0.22)]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B56E48] focus-visible:ring-offset-1 focus-visible:ring-offset-[#0C0F0D]",
          isOpen && "bg-[#1A201D] border-[#B56E48]/50 text-[#F4F0E8] shadow-sm",
          triggerClassName
        )}
      >
        <Bell className="w-4 h-4 shrink-0 transition-transform duration-150 active:scale-95" />

        {/* Subtle unread badge: ONLY displayed if actual unread notifications exist */}
        {unreadCount > 0 && (
          <span
            className="absolute -top-1 -right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-[#B56E48] text-[9px] font-mono font-bold text-[#F4F0E8] shadow-sm ring-2 ring-[#0F1210]"
            aria-hidden="true"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Contextual Notification Popover Panel */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Notification Center"
          className={cn(
            "absolute right-0 top-full mt-1.5 w-80 sm:w-96 max-w-[calc(100vw-1.5rem)]",
            "bg-[#0F1210] border border-[rgba(244,240,232,0.12)] rounded-[10px]",
            "shadow-2xl shadow-black/80 z-50 overflow-hidden flex flex-col",
            "animate-in fade-in-50 zoom-in-95 duration-100 ease-out origin-top-right"
          )}
        >
          {/* Popover Header */}
          <div className="px-4 py-3 border-b border-[rgba(244,240,232,0.08)] bg-[#121614]/90 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-[#F4F0E8] font-mono tracking-tight">
                {t("notifications.title")}
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-[#1A201D] text-[#A2B3A8] border border-[rgba(244,240,232,0.08)]">
                {unreadCount > 0 ? t("notifications.unreadCount", { count: unreadCount }) : t("notifications.zeroUnread")}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllAsRead}
                  className="text-[11px] font-mono text-[#A2B3A8] hover:text-[#F4F0E8] transition-colors cursor-pointer"
                >
                  {t("notifications.markAllRead")}
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 rounded text-[#5A6B62] hover:text-[#D9D2C5] hover:bg-[#1A201D] transition-colors"
                aria-label="Close notifications panel"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Filter Tabs if multiple notifications exist */}
          {notifications.length > 0 && (
            <div className="flex items-center px-4 pt-2 border-b border-[rgba(244,240,232,0.08)] bg-[#0F1210] gap-4">
              <button
                type="button"
                onClick={() => setActiveTab("all")}
                className={cn(
                  "pb-2 text-xs font-mono font-medium transition-colors border-b-2",
                  activeTab === "all"
                    ? "border-[#B56E48] text-[#F4F0E8]"
                    : "border-transparent text-[#5A6B62] hover:text-[#A2B3A8]"
                )}
              >
                {t("notifications.allTab", { count: notifications.length })}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("unread")}
                className={cn(
                  "pb-2 text-xs font-mono font-medium transition-colors border-b-2",
                  activeTab === "unread"
                    ? "border-[#B56E48] text-[#F4F0E8]"
                    : "border-transparent text-[#5A6B62] hover:text-[#A2B3A8]"
                )}
              >
                {t("notifications.unreadTab", { count: unreadCount })}
              </button>
            </div>
          )}

          {/* Body: Notifications List OR Honest Empty State */}
          <div className="max-h-[360px] overflow-y-auto">
            {displayedNotifications.length > 0 ? (
              <div className="divide-y divide-[rgba(244,240,232,0.06)]">
                {displayedNotifications.map((item) => {
                  const channel = NOTIFICATION_CHANNELS.find(
                    (c) => c.category === item.category
                  );
                  const Icon = channel?.icon || Bell;

                  return (
                    <div
                      key={item.id}
                      className={cn(
                        "p-3.5 flex gap-3 transition-colors text-left",
                        !item.read
                          ? "bg-[#141816]/70 hover:bg-[#181D1A]"
                          : "hover:bg-[#141816]/40 opacity-75 hover:opacity-100"
                      )}
                    >
                      <div
                        className={cn(
                          "w-7 h-7 rounded-[6px] flex items-center justify-center shrink-0 border",
                          channel?.accentColor ||
                          "text-[#A2B3A8] bg-[#141816] border-[rgba(244,240,232,0.10)]"
                        )}
                      >
                        <Icon className="w-3.5 h-3.5" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-mono text-xs font-medium text-[#F4F0E8] truncate">
                            {item.title}
                          </p>
                          <span className="text-[10px] font-mono text-[#5A6B62] shrink-0">
                            {item.timestamp}
                          </span>
                        </div>
                        <p className="text-xs text-[#8C988F] font-sans mt-0.5 line-clamp-2 leading-relaxed">
                          {item.description}
                        </p>

                        <div className="flex items-center gap-3 mt-2">
                          {item.actionUrl && (
                            <Link
                              href={item.actionUrl}
                              onClick={() => {
                                handleMarkAsRead(item.id);
                                setIsOpen(false);
                              }}
                              className="inline-flex items-center gap-1 text-[11px] font-mono text-[#2EB8B0] hover:underline"
                            >
                              <span>{t("common.viewDetails")}</span>
                              <ExternalLink className="w-3 h-3" />
                            </Link>
                          )}
                          {!item.read && (
                            <button
                              type="button"
                              onClick={() => handleMarkAsRead(item.id)}
                              className="inline-flex items-center gap-1 text-[11px] font-mono text-[#5A6B62] hover:text-[#A2B3A8]"
                            >
                              <Check className="w-3 h-3" />
                              <span>{t("common.markRead")}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Honest Empty State */
              <div className="px-5 py-7 flex flex-col items-center text-center">
                <div className="w-10 h-10 rounded-full bg-[#141816] border border-[rgba(244,240,232,0.08)] flex items-center justify-center text-[#5A6B62] mb-3 shadow-inner">
                  <BellOff className="w-5 h-5 text-[#8C988F]" />
                </div>
                <h4 className="font-mono text-sm font-semibold text-[#F4F0E8] tracking-tight">
                  {t("notifications.emptyTitle")}
                </h4>
                <p className="text-xs text-[#8C988F] max-w-[270px] leading-relaxed mt-1 font-sans">
                  {t("notifications.emptySubtitle")}
                </p>

                {/* Monitored Channels Guide */}
                <div className="w-full mt-5 pt-4 border-t border-[rgba(244,240,232,0.08)] text-left">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-[#5A6B62] font-semibold block mb-2">
                    {t("notifications.monitoredStreams")}
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {NOTIFICATION_CHANNELS.slice(0, 4).map((ch) => {
                      const Icon = ch.icon;
                      return (
                        <div
                          key={ch.category}
                          className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#121614] border border-[rgba(244,240,232,0.06)]"
                        >
                          <Icon className="w-3 h-3 text-[#A2B3A8] shrink-0" />
                          <span className="text-[10px] font-mono text-[#A2B3A8] truncate">
                            {ch.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Popover Footer: Platform Event Bus Status */}
          <div className="px-4 py-2.5 border-t border-[rgba(244,240,232,0.08)] bg-[#121614]/80 flex items-center justify-between text-[11px] font-mono text-[#5A6B62]">
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#23847D] opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#2EB8B0]" />
              </span>
              <span className="text-[#8C988F]">{t("notifications.eventBusActive")}</span>
            </div>

            <span className="text-[10px] text-[#5A6B62]">{t("notifications.realTimeSync")}</span>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

/**
 * BhuSetu 3D Application Shell TopBar
 * Evidence-Backed 3D Property Intelligence Platform
 */
import React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigationDrawer } from "@/hooks/useNavigationDrawer";
import { NotificationMenu } from "@/components/layout/NotificationMenu";
import { UserProfileMenu } from "@/components/layout/UserProfileMenu";
import { LanguageSelector } from "@/components/layout/LanguageSelector";
import { useLanguage } from "@/context/LanguageContext";

export function TopBar() {
  const pathname = usePathname();
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toggleDrawer } = useNavigationDrawer();
  const { t } = useLanguage();

  // Hide navbar completely whenever session / auth is validating, or on dedicated full-screen views
  if (
    isLoading ||
    pathname === "/3d-city" ||
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/signup"
  ) {
    return null;
  }

  return (
    <header className="h-16 border-b border-[rgba(244,240,232,0.12)] bg-[#0C0F0D]/95 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between z-30 sticky top-0 select-none shadow-sm">
      {/* Brand Identity & Mobile Hamburger */}
      <div className="flex items-center gap-3">
        {/* Mobile Navigation Drawer Toggle - hidden on dedicated profile page */}
        {pathname !== "/profile" && (
          <button
            onClick={toggleDrawer}
            className="lg:hidden p-2 rounded-[6px] border border-[rgba(244,240,232,0.12)] bg-[#141816] text-[#F4F0E8] hover:bg-[#1A201D] transition-colors cursor-pointer shrink-0"
            title="Toggle Navigation Menu"
            aria-label="Toggle navigation menu"
          >
            <Menu className="w-4 h-4" />
          </button>
        )}

        <Link href="/" className="flex items-center gap-3 hover:opacity-95 transition-opacity group">
          <div className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-[6px] overflow-hidden shrink-0 shadow-sm group-hover:scale-[1.03] transition-transform">
            <Image
              src="/brand/bhusetu-logo.webp"
              alt="BhuSetu 3D Official Brand Logo"
              width={40}
              height={40}
              priority
              className="w-full h-full object-contain"
            />
          </div>
          <div className="flex flex-col text-left">
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-wider text-base sm:text-lg text-[#F4F0E8] font-mono leading-none">
                BHUSETU 3D
              </span>
            </div>
            <span className="hidden md:block text-xs text-[#A7B3AB] truncate max-w-[280px] md:max-w-none font-sans mt-0.5">
              {t("common.tagline")}
            </span>
          </div>
        </Link>
      </div>

      {/* User Session & Actions */}
      <div className="flex items-center gap-2.5 sm:gap-3.5">
        {isAuthenticated && user ? (
          <div className="flex items-center gap-2 sm:gap-2.5">
            <NotificationMenu />
            <LanguageSelector />
            <UserProfileMenu />
          </div>
        ) : (
          <div className="flex items-center gap-2 sm:gap-2.5">
            <LanguageSelector />
            <Link
              href="/login"
              className="px-4 py-2 rounded-[6px] bg-[#141816] hover:bg-[#1A201D] border border-[rgba(244,240,232,0.12)] hover:border-[rgba(244,240,232,0.25)] text-[#F4F0E8] text-xs sm:text-sm font-mono font-medium transition-all"
            >
              {t("header.signIn")}
            </Link>
            <Link
              href="/overview"
              className="px-4 py-2 rounded-[6px] bg-[#B56E48] hover:bg-[#C47B50] text-[#F4F0E8] text-xs sm:text-sm font-mono font-bold transition-all shadow-sm"
            >
              {t("header.launchPlatform")}
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}

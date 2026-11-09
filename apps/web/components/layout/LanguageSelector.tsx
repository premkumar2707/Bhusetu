"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Globe, ChevronDown, Check } from "lucide-react";
import { useLanguage, SupportedLocale, SUPPORTED_LOCALES } from "@/context/LanguageContext";

interface LanguageSelectorProps {
  triggerClassName?: string;
  align?: "left" | "right";
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  triggerClassName = "",
  align = "right",
}) => {
  const { locale, setLocale, currentLocaleMeta, supportedLocales, t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Reset focusedIndex when opening
  useEffect(() => {
    if (isOpen) {
      const idx = supportedLocales.findIndex((l) => l.code === locale);
      setFocusedIndex(idx >= 0 ? idx : 0);
    } else {
      setFocusedIndex(-1);
    }
  }, [isOpen, locale, supportedLocales]);

  // Focus the item when focusedIndex changes
  useEffect(() => {
    if (isOpen && focusedIndex >= 0 && itemRefs.current[focusedIndex]) {
      itemRefs.current[focusedIndex]?.focus();
    }
  }, [isOpen, focusedIndex]);

  const handleToggle = () => {
    setIsOpen((prev) => !prev);
  };

  const handleSelect = useCallback(
    (code: SupportedLocale) => {
      setLocale(code);
      setIsOpen(false);
      triggerRef.current?.focus();
    },
    [setLocale]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
      triggerRef.current?.focus();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIndex((prev) => (prev + 1) % supportedLocales.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIndex((prev) => (prev - 1 + supportedLocales.length) % supportedLocales.length);
    } else if (e.key === "Tab") {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative inline-block text-left" onKeyDown={handleKeyDown}>
      {/* Collapsed Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`Select platform language. Current language: ${currentLocaleMeta.label}`}
        title={`Language: ${currentLocaleMeta.label} (${currentLocaleMeta.nativeName})`}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-[6px] bg-[#141816] hover:bg-[#1A201D] border border-[rgba(244,240,232,0.10)] hover:border-[rgba(244,240,232,0.22)] text-[#D9D2C5] hover:text-[#F4F0E8] transition-all cursor-pointer font-mono text-xs select-none shadow-sm focus:outline-none focus:ring-1 focus:ring-[#B56E48]/50 ${triggerClassName}`}
      >
        <Globe className="w-3.5 h-3.5 text-[#23847D] shrink-0" aria-hidden="true" />
        <span className="font-bold tracking-wider uppercase text-[11px] sm:text-xs">
          {locale.toUpperCase()}
        </span>
        <ChevronDown
          className={`w-3 h-3 text-[#A2B3A8] transition-transform duration-150 ${
            isOpen ? "rotate-180 text-[#F4F0E8]" : ""
          }`}
          aria-hidden="true"
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          role="listbox"
          aria-label="Platform Languages"
          className={`absolute ${
            align === "right" ? "right-0" : "left-0"
          } mt-1.5 w-52 rounded-[8px] bg-[#141816] border border-[rgba(244,240,232,0.14)] shadow-2xl z-50 overflow-hidden py-1 animate-in fade-in zoom-in-95 duration-100 backdrop-blur-md`}
        >
          {/* Header */}
          <div className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-[#A2B3A8] border-b border-[rgba(244,240,232,0.08)] flex items-center justify-between font-semibold">
            <span>{t("header.selectLanguage") || "Select Language"}</span>
            <span className="text-[9px] text-[#5A6B62] font-normal">i18n</span>
          </div>

          {/* Language Options */}
          <div className="py-1">
            {supportedLocales.map((loc, idx) => {
              const isSelected = loc.code === locale;
              return (
                <button
                  key={loc.code}
                  ref={(el) => {
                    itemRefs.current[idx] = el;
                  }}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  tabIndex={focusedIndex === idx ? 0 : -1}
                  onClick={() => handleSelect(loc.code)}
                  className={`w-full px-3 py-2 text-left flex items-center justify-between transition-colors font-mono text-xs cursor-pointer ${
                    isSelected
                      ? "bg-[#1A201D] text-[#F4F0E8] font-bold"
                      : "text-[#D9D2C5] hover:bg-[#1C221F] hover:text-[#F4F0E8]"
                  } focus:outline-none focus:bg-[#1C221F]`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border ${
                        isSelected
                          ? "bg-[#23847D]/20 text-[#2EB8B0] border-[#23847D]/40"
                          : "bg-[#0F1210] text-[#5A6B62] border-[rgba(244,240,232,0.08)]"
                      }`}
                    >
                      {loc.code}
                    </span>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs truncate">{loc.nativeName}</span>
                      <span className="text-[10px] text-[#A2B3A8] font-sans font-normal truncate">
                        {loc.label}
                      </span>
                    </div>
                  </div>

                  {isSelected && (
                    <Check className="w-3.5 h-3.5 text-[#2EB8B0] shrink-0" aria-hidden="true" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';

interface LayoutContextType {
  isSidebarCollapsed: boolean;
  setSidebarCollapsed: (v: boolean) => void;
  isMobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;
}

const LayoutContext = createContext<LayoutContextType | undefined>(undefined);

export function LayoutProvider({ children }: { children: React.ReactNode }) {
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobileOpen, setMobileOpen] = useState(false);

  // Persistence for desktop collapse state
  useEffect(() => {
    const saved = localStorage.getItem('ifa_sidebar_collapsed');
    if (saved) setSidebarCollapsed(saved === 'true');
  }, []);

  const toggleSidebar = (v: boolean) => {
    setSidebarCollapsed(v);
    localStorage.setItem('ifa_sidebar_collapsed', String(v));
  };

  return (
    <LayoutContext.Provider value={{ 
      isSidebarCollapsed, 
      setSidebarCollapsed: toggleSidebar,
      isMobileOpen,
      setMobileOpen
    }}>
      {children}
    </LayoutContext.Provider>
  );
}

export function useLayout() {
  const context = useContext(LayoutContext);
  if (context === undefined) {
    throw new Error('useLayout must be used within a LayoutProvider');
  }
  return context;
}

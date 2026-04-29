'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  LineChart, 
  Wallet, 
  Zap, 
  Coins, 
  Menu, 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Sun, 
  Moon,
  Bookmark,
  Activity
} from 'lucide-react';
import { useLayout } from '@/context/LayoutContext';
import { useTheme } from '@/context/ThemeContext';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { icon: <LayoutDashboard size={18} />, label: "Market Terminal", href: "/" },
  { icon: <Bookmark size={18} />, label: "Saved Alpha", href: "/bookmarks" },
  { icon: <LineChart size={18} />, label: "Quant Lab", href: "/quant-lab" },
  { icon: <Zap size={18} />, label: "Ifa Oracle", href: "/oracle" },
  { icon: <Wallet size={18} />, label: "Portfolio", href: "/portfolio" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const { isSidebarCollapsed, setSidebarCollapsed, isMobileOpen, setMobileOpen } = useLayout();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  const NavItem = ({ item, collapsed }: { item: typeof NAV_ITEMS[0], collapsed: boolean }) => {
    const isActive = pathname === item.href;
    
    return (
      <Link href={item.href} onClick={() => setMobileOpen(false)}>
        <div className={cn(
          "group relative flex items-center gap-4 px-3 py-3 cursor-pointer transition-all duration-200 border-l-2",
          isActive 
            ? "bg-accent border-primary text-primary" 
            : "border-transparent text-muted-foreground hover:text-foreground hover:bg-accent/50",
          collapsed && "justify-center px-0"
        )}>
          <div className={cn("transition-transform duration-300", isActive ? "scale-105" : "group-hover:scale-105")}>
            {item.icon}
          </div>
          
          {!collapsed && (
            <span className="font-bold text-[11px] uppercase tracking-widest whitespace-nowrap">
              {item.label}
            </span>
          )}

          {/* Tooltip for collapsed state */}
          {collapsed && (
            <div className="absolute left-20 px-3 py-2 bg-card text-primary text-[9px] font-bold border border-border opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 shadow-2xl uppercase tracking-[0.2em]">
              {item.label}
            </div>
          )}

          {!collapsed && item.label === "Ifa Oracle" && (
            <span className="ml-auto text-[7px] font-mono bg-orange-500/10 text-orange-400 border border-orange-500/20 px-1 py-0.5">
              NEW
            </span>
          )}
        </div>
      </Link>
    );
  };

  return (
    <>
      {/* Desktop sidebar */}
      <aside 
        className={cn(
          "fixed left-0 top-0 h-full border-r border-border bg-background hidden lg:flex flex-col z-40 transition-all duration-300 ease-in-out",
          isSidebarCollapsed ? "w-20" : "w-64"
        )}
      >
        {/* Logo Section */}
        <div className={cn("flex items-center gap-3 p-6 mb-8 border-b border-border", isSidebarCollapsed && "justify-center px-0")}>
          <div className="min-w-[32px] w-8 h-8 bg-card border border-primary/40 flex items-center justify-center transition-transform hover:scale-105">
            <Activity size={18} className="text-primary" />
          </div>
          {!isSidebarCollapsed && (
            <span className="text-sm font-bold text-foreground tracking-[0.3em] uppercase italic whitespace-nowrap">
              IFA<span className="text-primary">_QUANT</span>
            </span>
          )}
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto no-scrollbar">
          <div className="text-[8px] font-bold text-muted-foreground uppercase tracking-[0.4em] mb-4 px-6">
            {isSidebarCollapsed ? "---" : "System_Access"}
          </div>
          <div className="space-y-0.5">
            {NAV_ITEMS.map((item) => (
              <NavItem key={item.href} item={item} collapsed={isSidebarCollapsed} />
            ))}
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="mt-auto border-t border-border">
          {/* Theme Toggle */}
          <button 
            onClick={toggleTheme}
            className={cn(
              "w-full flex items-center gap-4 px-6 py-4 transition-all hover:bg-accent text-muted-foreground hover:text-foreground",
              isSidebarCollapsed && "justify-center px-0"
            )}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            {!isSidebarCollapsed && <span className="text-[9px] font-bold uppercase tracking-widest">{theme === 'dark' ? 'Light_Mode' : 'Dark_Mode'}</span>}
          </button>

          {/* Collapse Toggle */}
          <button 
            onClick={() => setSidebarCollapsed(!isSidebarCollapsed)}
            className={cn(
              "w-full flex items-center gap-4 px-6 py-4 transition-all hover:bg-accent text-muted-foreground hover:text-foreground",
              isSidebarCollapsed && "justify-center px-0"
            )}
          >
            {isSidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            {!isSidebarCollapsed && <span className="text-[9px] font-bold uppercase tracking-widest">Collapse_Sys</span>}
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-background border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-card border border-primary/40 flex items-center justify-center">
            <Activity size={14} className="text-primary" />
          </div>
          <span className="text-xs font-bold text-foreground tracking-[0.2em] uppercase italic">
            IFA<span className="text-primary">_QUANT</span>
          </span>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={toggleTheme} className="text-muted-foreground hover:text-foreground">
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button
            onClick={() => setMobileOpen(true)}
            className="text-muted-foreground hover:text-primary transition-colors"
          >
            <Menu size={20} />
          </button>
        </div>
      </div>

      {/* Mobile drawer overlay */}
      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-60 bg-black/50 backdrop-blur-sm dark:bg-black/80"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside className={cn(
        "lg:hidden fixed top-0 left-0 h-full w-64 bg-background border-r border-border z-70 transition-transform duration-300 ease-in-out",
        isMobileOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-card border border-primary/40 flex items-center justify-center">
              <Activity size={16} className="text-primary" />
            </div>
            <span className="text-sm font-bold text-foreground tracking-[0.2em] uppercase italic">
              IFA<span className="text-primary">_QUANT</span>
            </span>
          </div>
          <button onClick={() => setMobileOpen(false)} className="text-muted-foreground">
            <X size={20} />
          </button>
        </div>

        <nav className="mt-4">
          {NAV_ITEMS.map((item) => (
            <NavItem key={item.href} item={item} collapsed={false} />
          ))}
        </nav>
      </aside>
    </>
  );
}

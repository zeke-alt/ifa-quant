'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Radio, 
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
  Bookmark
} from 'lucide-react';
import { useLayout } from '@/context/LayoutContext';
import { useTheme } from '@/context/ThemeContext';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { icon: <LayoutDashboard size={20} />, label: "Market Terminal", href: "/" },
  { icon: <Bookmark size={20} />, label: "Saved Alpha", href: "/bookmarks" },
  { icon: <LineChart size={20} />, label: "Quant Lab", href: "/quant-lab" },
  { icon: <Zap size={20} />, label: "Ifa Oracle", href: "/oracle" },
  { icon: <Wallet size={20} />, label: "Portfolio", href: "/portfolio" },
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
          "group relative flex items-center gap-4 px-3 py-3 rounded-xl cursor-pointer transition-all duration-300 mb-1",
          isActive 
            ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" 
            : "text-muted-foreground hover:bg-secondary hover:text-foreground",
          collapsed && "justify-center px-0"
        )}>
          <div className={cn("transition-transform duration-300", isActive ? "scale-110" : "group-hover:scale-110")}>
            {item.icon}
          </div>
          
          {!collapsed && (
            <span className="font-bold text-sm tracking-tight whitespace-nowrap">
              {item.label}
            </span>
          )}

          {/* Tooltip for collapsed state */}
          {collapsed && (
            <div className="absolute left-16 px-3 py-1.5 bg-foreground text-background text-[10px] font-black rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 shadow-xl uppercase tracking-widest">
              {item.label}
            </div>
          )}

          {!collapsed && item.label === "Ifa Oracle" && (
            <span className="ml-auto text-[8px] font-mono bg-orange-500/20 text-orange-400 border border-orange-500/30 px-1.5 py-0.5 rounded-md">
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
          "fixed left-0 top-0 h-full border-r border-border bg-background/80 backdrop-blur-xl p-6 hidden lg:flex flex-col z-40 transition-all duration-500 ease-in-out",
          isSidebarCollapsed ? "w-24" : "w-64"
        )}
      >
        {/* Logo Section */}
        <div className={cn("flex items-center gap-3 mb-12", isSidebarCollapsed && "justify-center")}>
          <div className="min-w-[36px] w-9 h-9 bg-primary rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(var(--primary-rgb),0.3)] cursor-pointer hover:rotate-12 transition-transform">
            <Coins size={20} className="text-primary-foreground" fill="currentColor" />
          </div>
          {!isSidebarCollapsed && (
            <span className="text-xl font-black text-foreground tracking-tighter italic whitespace-nowrap">
              Ifá<span className="text-primary">Quant</span>
            </span>
          )}
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto no-scrollbar">
          <div className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-6 px-3 opacity-40">
            {isSidebarCollapsed ? "---" : "Main_Menu"}
          </div>
          {NAV_ITEMS.map((item) => (
            <NavItem key={item.href} item={item} collapsed={isSidebarCollapsed} />
          ))}
        </div>

        {/* Bottom Actions */}
        <div className="mt-auto space-y-4 pt-6 border-t border-slate-100 dark:border-slate-800/50">
          {/* Theme Toggle */}
          <button 
            onClick={toggleTheme}
            className={cn(
              "w-full flex items-center gap-4 px-3 py-3 rounded-xl transition-all hover:bg-secondary text-muted-foreground hover:text-foreground",
              isSidebarCollapsed && "justify-center"
            )}
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            {!isSidebarCollapsed && <span className="text-sm font-black uppercase tracking-tight">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>}
          </button>

          {/* Collapse Toggle */}
          <button 
            onClick={() => setSidebarCollapsed(!isSidebarCollapsed)}
            className={cn(
              "w-full flex items-center gap-4 px-3 py-3 rounded-xl transition-all hover:bg-secondary text-muted-foreground hover:text-foreground",
              isSidebarCollapsed && "justify-center"
            )}
          >
            {isSidebarCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
            {!isSidebarCollapsed && <span className="text-sm font-black uppercase tracking-tight">Collapse</span>}
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Coins size={16} className="text-primary-foreground" fill="currentColor" />
          </div>
          <span className="text-lg font-black text-foreground tracking-tighter italic">
            Ifá<span className="text-primary">Quant</span>
          </span>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={toggleTheme} className="text-slate-500">
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button
            onClick={() => setMobileOpen(true)}
            className="text-slate-600 dark:text-slate-400 hover:text-blue-500 transition-colors"
          >
            <Menu size={24} />
          </button>
        </div>
      </div>

      {/* Mobile drawer overlay */}
      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-60 bg-black/60 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside className={cn(
        "lg:hidden fixed top-0 left-0 h-full w-72 bg-background border-r border-border p-8 z-70 transition-transform duration-500 ease-in-out",
        isMobileOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center">
              <Coins size={20} className="text-primary-foreground" fill="currentColor" />
            </div>
            <span className="text-xl font-black text-foreground tracking-tighter italic">
              Ifá<span className="text-primary">Quant</span>
            </span>
          </div>
          <button onClick={() => setMobileOpen(false)} className="text-slate-500">
            <X size={24} />
          </button>
        </div>

        <nav className="space-y-2">
          {NAV_ITEMS.map((item) => (
            <NavItem key={item.href} item={item} collapsed={false} />
          ))}
        </nav>
      </aside>
    </>
  );
}

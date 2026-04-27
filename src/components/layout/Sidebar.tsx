'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Radio, LineChart, Wallet, Zap, Coins, Menu, X } from 'lucide-react';

const NAV_ITEMS = [
  { icon: <LayoutDashboard size={18} />, label: "Market Terminal", href: "/" },
  { icon: <Radio size={18} />, label: "Signal Feed", href: "/signals" },
  { icon: <LineChart size={18} />, label: "Quant Lab", href: "/quant-lab" },
  { icon: <Wallet size={18} />, label: "Portfolio", href: "/portfolio" },
  { icon: <Zap size={18} />, label: "Ifa Oracle", href: "/oracle" },
];

function NavContent({ pathname, onClose }: { pathname: string; onClose?: () => void }) {
  return (
    <>
      <div className="flex items-center justify-between mb-12">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(37,99,235,0.4)]">
            <Coins size={20} className="text-white" fill="white" />
          </div>
          <span className="text-xl font-black text-white tracking-tighter italic">
            Ifá<span className="text-blue-500">Quant</span>
          </span>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors lg:hidden">
            <X size={20} />
          </button>
        )}
      </div>

      <nav className="space-y-2">
        {NAV_ITEMS.map(({ icon, label, href }) => (
          <Link key={href} href={href} onClick={onClose}>
            <div className={`flex items-center gap-4 px-4 py-3 rounded-xl cursor-pointer transition-all ${
              pathname === href
                ? 'bg-blue-600/10 text-blue-500 border border-blue-500/10'
                : 'text-slate-500 hover:text-slate-200'
            }`}>
              {icon}
              <span className="font-bold text-sm tracking-tight">{label}</span>
              {label === "Ifa Oracle" && (
                <span className="ml-auto text-[8px] font-mono bg-orange-500/20 text-orange-400 border border-orange-500/30 px-1.5 py-0.5 rounded-md">
                  NEW
                </span>
              )}
            </div>
          </Link>
        ))}
      </nav>
    </>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed left-0 top-0 h-full w-64 border-r border-slate-800 bg-[#020617] p-8 hidden lg:block z-40">
        <NavContent pathname={pathname} />
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden relative top-0 left-0 right-0 z-40 bg-[#020617] border-b border-slate-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
            <Coins size={14} className="text-white" fill="white" />
          </div>
          <span className="text-base font-black text-white tracking-tighter italic">
            Ifá<span className="text-blue-500">Quant</span>
          </span>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="text-slate-400 hover:text-white transition-colors p-1"
        >
          <Menu size={22} />
        </button>
      </div>

      {/* Mobile drawer overlay */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside className={`lg:hidden fixed top-0 left-0 h-full w-72 bg-[#020617] border-r border-slate-800 p-8 z-50 transition-transform duration-300 ${
        open ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <NavContent pathname={pathname} onClose={() => setOpen(false)} />
      </aside>
    </>
  );
}
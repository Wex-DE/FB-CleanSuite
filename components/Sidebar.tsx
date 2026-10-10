import React from 'react';
import {
  Facebook,
  LayoutDashboard,
  Settings,
  Trash2,
  Clock,
  Terminal,
  HelpCircle,
  ShieldCheck,
  ShieldAlert,
  Github,
  Star,
  X,
} from 'lucide-react';

export type NavSection = 'dashboard' | 'posts' | 'comments' | 'logs' | 'settings' | 'guide';

interface SidebarProps {
  activeSection: NavSection;
  onSelectSection: (section: NavSection) => void;
  onOpenHelp: () => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeSection,
  onSelectSection,
  onOpenHelp,
  mobileOpen = false,
  onCloseMobile,
}) => {
  const navItems: { id: NavSection; label: string; icon: React.ElementType; badge?: string }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'posts', label: 'Post Cleaner', icon: Trash2 },
    { id: 'comments', label: 'Spam Comments', icon: ShieldAlert, badge: 'NEW' },
    { id: 'logs', label: 'Activity Logs', icon: Terminal },
    { id: 'settings', label: 'Page & Tokens', icon: Settings },
    { id: 'guide', label: 'Help & Guide', icon: HelpCircle },
  ];

  const handleNavClick = (id: NavSection) => {
    if (onCloseMobile) {
      onCloseMobile();
    }
    if (id === 'guide') {
      onOpenHelp();
    } else {
      onSelectSection(id);
    }
  };

  return (
    <>
      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-40 md:hidden animate-in fade-in duration-200"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`fixed md:sticky top-0 left-0 z-50 h-screen w-64 flex-shrink-0 flex flex-col justify-between border-r border-slate-200/80 dark:border-white/5 bg-white dark:bg-slate-950 p-5 transition-transform duration-300 ease-in-out overflow-y-auto ${
          mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="space-y-6">
          {/* Brand & Mobile Close */}
          <div className="flex items-center justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-blue-600 p-2 text-white shadow-md shadow-blue-500/20 flex-shrink-0">
                <Facebook className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight leading-tight">
                  FB CleanSuite
                </h1>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                  All-in-one privacy &amp; cleanup engine
                </p>
              </div>
            </div>

            {/* Mobile close button */}
            <button
              onClick={onCloseMobile}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white md:hidden"
              aria-label="Close Navigation"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

        {/* Navigation Items */}
        <nav className="space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition active:scale-[0.99] ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/25'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900/80 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? 'text-white' : 'text-slate-400 dark:text-slate-500'}`} />
                <span className="flex-1 text-left">{item.label}</span>
                {item.badge && (
                  <span
                    className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-full leading-none tracking-wider ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Sidebar Info & Badge */}
      <div className="space-y-4 pt-6">
        {/* Safe & Official Box */}
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-950/20 p-3.5 space-y-1.5 text-xs">
          <div className="flex items-center gap-2 font-bold text-emerald-700 dark:text-emerald-400 text-[11px]">
            <ShieldCheck className="h-4 w-4 flex-shrink-0" />
            <span>Safe &amp; Official</span>
          </div>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
            Uses official Meta Graph API v26.0. No scraping. No browser automation. Your tokens stay strictly local.
          </p>
        </div>

        {/* GitHub Star Repo Button */}
        <a
          href="https://github.com/Wex-DE/FB-CleanSuite"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900/60 px-3 py-2 text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
        >
          <div className="flex items-center gap-2">
            <Github className="h-3.5 w-3.5 text-slate-500" />
            <span>Star on GitHub</span>
          </div>
          <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
        </a>

        {/* Version */}
        <div className="text-[10px] text-slate-400 dark:text-slate-600 font-mono text-center">
          v1.0.0-production
        </div>
      </div>
    </aside>
  </>
  );
};

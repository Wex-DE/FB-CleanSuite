import { LogOut, Sun, Moon, CheckCircle2, ChevronDown, Menu, Sparkles } from 'lucide-react';
import { PageInfo } from '@/server/types';

interface TopNavProps {
  authenticated: boolean;
  selectedPageObj?: PageInfo;
  pages: PageInfo[];
  selectedPageId: string;
  onSelectPage: (id: string) => void;
  onLogout: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  tokenExpired?: boolean;
  tokenExpiresInSeconds?: number | null;
  onRefreshClick?: () => void;
  onOpenMobileSidebar?: () => void;
  isDemoMode?: boolean;
  onToggleDemoMode?: () => void;
}

export const TopNav: React.FC<TopNavProps> = ({
  authenticated,
  selectedPageObj,
  pages,
  selectedPageId,
  onSelectPage,
  onLogout,
  theme,
  onToggleTheme,
  tokenExpired,
  tokenExpiresInSeconds,
  onRefreshClick,
  onOpenMobileSidebar,
  isDemoMode,
  onToggleDemoMode,
}) => {
  // Format token expiry time remaining
  const formatTimeRemaining = (seconds: number | null | undefined): string => {
    if (seconds === null || seconds === undefined) return 'Never expires';
    if (seconds <= 0) return 'Expired';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hrs > 24) {
      const days = Math.floor(hrs / 24);
      return `${days}d remaining`;
    }
    if (hrs > 0) return `${hrs}h ${mins}m left`;
    if (mins > 0) return `${mins}m left`;
    return `${seconds}s left`;
  };

  return (
    <header className="border-b border-slate-200/80 dark:border-white/5 bg-white/80 dark:bg-slate-950/70 backdrop-blur-xl px-4 sm:px-6 py-3.5 flex items-center justify-between transition-colors sticky top-0 z-30">
      {/* Mobile Hamburger Toggle & Active Page Pill */}
      <div className="flex items-center gap-2 sm:gap-3">
        {onOpenMobileSidebar && (
          <button
            type="button"
            onClick={onOpenMobileSidebar}
            className="p-1.5 -ml-1 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900 transition md:hidden"
            aria-label="Open Navigation Drawer"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}

        {authenticated && selectedPageObj ? (
          <div className="flex items-center gap-2.5 sm:gap-3">
            {/* Avatar with Initials */}
            <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xs shadow-sm flex-shrink-0">
              {selectedPageObj.name.substring(0, 2).toUpperCase()}
            </div>

            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                  {selectedPageObj.name}
                </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Connected
              </span>

              {/* Token Expiry Pill */}
              {tokenExpired ? (
                <button
                  onClick={onRefreshClick}
                  className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/15 border border-rose-500/30 px-2.5 py-0.5 text-[10px] font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-500/25 transition cursor-pointer"
                  title="Click to update your expired Graph API Access Token"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-ping" />
                  Token Expired (Click to Renew)
                </button>
              ) : tokenExpiresInSeconds !== undefined ? (
                <button
                  onClick={onRefreshClick}
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-medium border cursor-pointer transition ${
                    tokenExpiresInSeconds !== null && tokenExpiresInSeconds < 3600
                      ? 'bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/25'
                      : 'bg-slate-100 dark:bg-slate-900/80 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:border-blue-500/30'
                  }`}
                  title="Token validity time remaining. Click to refresh or change token."
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      tokenExpiresInSeconds !== null && tokenExpiresInSeconds < 3600
                        ? 'bg-amber-500 animate-pulse'
                        : 'bg-blue-500'
                    }`}
                  />
                  Token: {formatTimeRemaining(tokenExpiresInSeconds)}
                </button>
              ) : null}

              <span className="hidden lg:inline-flex items-center rounded-md bg-slate-100 dark:bg-slate-900 px-2 py-0.5 text-[10px] font-medium text-slate-500 border border-slate-200 dark:border-slate-800">
                Authorized for Management
              </span>
            </div>
            <div className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
              Page ID: {selectedPageObj.id}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
          FB CleanSuite Management Console
        </div>
      )}
      </div>

      {/* Right Action Controls */}
      <div className="flex items-center gap-2.5">
        {/* Switch Page Dropdown (if multiple pages exist) */}
        {authenticated && pages.length > 1 && (
          <div className="relative">
            <select
              value={selectedPageId}
              onChange={(e) => onSelectPage(e.target.value)}
              className="appearance-none rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 pl-3 pr-8 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 shadow-sm focus:outline-none cursor-pointer"
            >
              {pages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
          </div>
        )}

        {/* Interactive Demo Mode Toggle */}
        {onToggleDemoMode && (
          <button
            type="button"
            onClick={onToggleDemoMode}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition active:scale-95 shadow-sm border ${
              isDemoMode
                ? 'bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400'
                : 'border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-blue-500/30'
            }`}
            title={isDemoMode ? 'Exit Demo Sandbox' : 'Explore with mock data without connecting Facebook'}
          >
            <Sparkles className={`h-3.5 w-3.5 ${isDemoMode ? 'text-amber-500 fill-amber-500' : 'text-blue-500'}`} />
            <span className="hidden sm:inline">{isDemoMode ? 'Demo Active' : 'Demo Sandbox'}</span>
          </button>
        )}

        {/* Theme Toggle */}
        <button
          onClick={onToggleTheme}
          aria-label="Toggle Theme"
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition active:scale-95 shadow-sm"
          title={theme === 'dark' ? 'Switch to Day (Light) Mode' : 'Switch to Night (Dark) Mode'}
        >
          {theme === 'dark' ? (
            <>
              <Sun className="h-3.5 w-3.5 text-amber-400" />
              <span className="hidden sm:inline text-xs font-medium">Day</span>
            </>
          ) : (
            <>
              <Moon className="h-3.5 w-3.5 text-blue-500" />
              <span className="hidden sm:inline text-xs font-medium">Night</span>
            </>
          )}
        </button>

        {/* Disconnect Button */}
        {authenticated && (
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 transition active:scale-95 shadow-sm"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Disconnect</span>
          </button>
        )}
      </div>
    </header>
  );
};

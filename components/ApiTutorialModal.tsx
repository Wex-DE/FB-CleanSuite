import React, { useState, useEffect } from 'react';
import { X, ExternalLink, ShieldCheck, Key, CheckCircle, Info, Facebook, Code2, AlertTriangle, Copy, Check } from 'lucide-react';

interface ApiTutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'token' | 'oauth';
}

export const ApiTutorialModal: React.FC<ApiTutorialModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'token',
}) => {
  const [activeTab, setActiveTab] = useState<'token' | 'oauth'>(initialTab);
  const [copiedEnv, setCopiedEnv] = useState(false);
  const [copiedUri, setCopiedUri] = useState(false);

  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  const envSnippet = `META_APP_ID=your_meta_app_id
META_APP_SECRET=your_meta_app_secret
META_REDIRECT_URI=http://127.0.0.1:3000/api/auth/callback
META_API_VERSION=v26.0`;

  const redirectUri = 'http://127.0.0.1:3000/api/auth/callback';

  const copyToClipboard = (text: string, type: 'env' | 'uri') => {
    navigator.clipboard.writeText(text);
    if (type === 'env') {
      setCopiedEnv(true);
      setTimeout(() => setCopiedEnv(false), 2000);
    } else {
      setCopiedUri(true);
      setTimeout(() => setCopiedUri(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-2xl max-h-[92vh] flex flex-col rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden my-auto text-slate-800 dark:text-slate-200">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-blue-600/15 p-2 text-blue-600 dark:text-blue-400 border border-blue-500/25">
              <Key className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                Meta Graph API Connection Setup
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Official setup instructions for Facebook Page management</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-100/60 dark:bg-slate-950/40 px-6 pt-3 gap-2">
          <button
            onClick={() => setActiveTab('token')}
            className={`flex items-center gap-2 pb-3 px-3 text-xs font-semibold border-b-2 transition ${
              activeTab === 'token'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Key className="h-3.5 w-3.5" />
            Option A: Page Access Token (Recommended)
          </button>
          <button
            onClick={() => setActiveTab('oauth')}
            className={`flex items-center gap-2 pb-3 px-3 text-xs font-semibold border-b-2 transition ${
              activeTab === 'oauth'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Facebook className="h-3.5 w-3.5" />
            Option B: Meta OAuth Login Setup
          </button>
        </div>

        {/* Tab 1: Option A (Direct Token Explorer) */}
        {activeTab === 'token' && (
          <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            {/* Intro Box */}
            <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-4 text-blue-700 dark:text-blue-300 flex items-start gap-2.5">
              <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>
                <strong>Option A is the fastest method (takes &lt; 2 minutes)</strong>. It does not require App Review or configuring OAuth redirect URIs. It generates an official Page Access Token directly via the Meta Graph API Explorer.
              </span>
            </div>

            {/* Step 1 */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] text-white font-bold">1</span>
                Open Meta Graph API Explorer
              </div>
              <p className="text-slate-500 dark:text-slate-400">
                Log in to Facebook and open the official Meta Graph API Explorer:
              </p>
              <a
                href="https://developers.facebook.com/tools/explorer/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600/15 border border-blue-500/30 px-3 py-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-600/25 transition mt-1"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                developers.facebook.com/tools/explorer
              </a>
            </div>

            {/* Step 2 */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] text-white font-bold">2</span>
                Select your Meta App
              </div>
              <p className="text-slate-500 dark:text-slate-400">
                In the top-right corner, find the <strong>Meta App</strong> dropdown and select any of your registered apps. (If you don&apos;t have an app yet, create a quick &quot;Business&quot; or &quot;Other&quot; app in Meta Developers in 1 minute).
              </p>
            </div>

            {/* Step 3 */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 p-4 space-y-2.5">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] text-white font-bold">3</span>
                Add Required Permissions
              </div>
              <p className="text-slate-500 dark:text-slate-400">
                Click <strong>Add a Permission</strong> on the right-hand panel and add these 4 required permissions:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 font-mono text-[11px]">
                <div className="flex items-center gap-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-2.5 py-1.5 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>pages_show_list</span>
                </div>
                <div className="flex items-center gap-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-2.5 py-1.5 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>pages_read_engagement</span>
                </div>
                <div className="flex items-center gap-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-2.5 py-1.5 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>pages_manage_posts</span>
                </div>
                <div className="flex items-center gap-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-2.5 py-1.5 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>pages_manage_engagement</span>
                </div>
              </div>
            </div>

            {/* Step 4 */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] text-white font-bold">4</span>
                Generate &amp; Switch to Page Access Token
              </div>
              <ol className="list-decimal list-inside space-y-1.5 text-slate-600 dark:text-slate-300">
                <li>Click the blue <strong>Generate Access Token</strong> button and approve the Facebook permissions dialog.</li>
                <li>Click the <strong>User or Page</strong> dropdown. Under the <em>Page Access Tokens</em> section, select your target Page.</li>
                <li>The Access Token field will automatically regenerate into a genuine <strong>Page Access Token</strong> (starting with <code className="text-amber-600 dark:text-amber-300 font-bold">EAA...</code>).</li>
              </ol>
            </div>

            {/* Step 5 */}
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 space-y-2 text-emerald-800 dark:text-emerald-300">
              <div className="flex items-center gap-2 text-sm font-semibold text-emerald-950 dark:text-white">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-[10px] text-white font-bold">5</span>
                Paste and Connect
              </div>
              <p className="text-xs text-emerald-900 dark:text-slate-300">
                Copy that token, paste it into the <strong>Option A</strong> input box on the dashboard, and click <strong>&quot;Connect Target Page&quot;</strong>.
              </p>
            </div>
          </div>
        )}

        {/* Tab 2: Option B (Meta OAuth Dialog Setup) */}
        {activeTab === 'oauth' && (
          <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            {/* Intro Box */}
            <div className="rounded-xl bg-purple-500/10 border border-purple-500/20 p-4 text-purple-700 dark:text-purple-300 flex items-start gap-2.5">
              <Facebook className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>
                <strong>Option B enables standard Facebook OAuth Login</strong>. You click the button, a Facebook authorization popup opens, and you log in directly. To enable this, configure your local Meta App credentials in <code className="font-mono bg-purple-100 dark:bg-purple-950/60 px-1 py-0.5 rounded">.env.local</code>.
              </span>
            </div>

            {/* Step 1 */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] text-white font-bold">1</span>
                Open Meta Developer Dashboard
              </div>
              <p className="text-slate-500 dark:text-slate-400">
                Go to your apps dashboard or create a new app:
              </p>
              <a
                href="https://developers.facebook.com/apps/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600/15 border border-blue-500/30 px-3 py-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-600/25 transition mt-1"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                developers.facebook.com/apps
              </a>
            </div>

            {/* Step 2 */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] text-white font-bold">2</span>
                Add Facebook Login Product
              </div>
              <p className="text-slate-500 dark:text-slate-400">
                Inside your App Dashboard, navigate to <strong>Add Products</strong> and set up <strong>Facebook Login for Business</strong> (or <strong>Facebook Login</strong>).
              </p>
            </div>

            {/* Step 3 */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] text-white font-bold">3</span>
                  Configure Valid OAuth Redirect URI
                </div>
              </div>
              <p className="text-slate-500 dark:text-slate-400">
                Go to <strong>Facebook Login → Settings</strong>. In the <strong>Valid OAuth Redirect URIs</strong> field, add the following URL and click <em>Save Changes</em>:
              </p>
              <div className="flex items-center justify-between rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-emerald-400 font-mono text-[11px]">
                <span>{redirectUri}</span>
                <button
                  onClick={() => copyToClipboard(redirectUri, 'uri')}
                  className="inline-flex items-center gap-1 rounded bg-slate-800 px-2 py-1 text-[10px] text-slate-200 hover:bg-slate-700 transition"
                >
                  {copiedUri ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  {copiedUri ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>

            {/* Step 4 */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] text-white font-bold">4</span>
                  Configure .env.local File
                </div>
                <button
                  onClick={() => copyToClipboard(envSnippet, 'env')}
                  className="inline-flex items-center gap-1 rounded bg-slate-200 dark:bg-slate-800 px-2 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 transition"
                >
                  {copiedEnv ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                  {copiedEnv ? 'Copied Env' : 'Copy Template'}
                </button>
              </div>
              <p className="text-slate-500 dark:text-slate-400">
                Go to <strong>App Settings → Basic</strong> to copy your <strong>App ID</strong> and <strong>App Secret</strong>. Place them in your <code className="font-mono">.env.local</code> file:
              </p>
              <pre className="rounded-lg bg-slate-900 border border-slate-700 p-3 text-[11px] font-mono text-slate-200 overflow-x-auto">
                {envSnippet}
              </pre>
            </div>

            {/* Step 5 */}
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-2 text-amber-800 dark:text-amber-300">
              <div className="flex items-center gap-2 text-sm font-semibold text-amber-950 dark:text-white">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-600 text-[10px] text-white font-bold">5</span>
                Restart Application &amp; Sign In
              </div>
              <p className="text-xs text-amber-900 dark:text-slate-300">
                After saving <code className="font-mono bg-amber-100 dark:bg-amber-950 px-1 py-0.5 rounded">.env.local</code>, restart the local server in your terminal (<code className="font-mono">npm start</code> or <code className="font-mono">npm run dev</code>). Then click <strong>&quot;Sign in with Facebook OAuth&quot;</strong> under Option B!
              </p>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 p-4 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            <span>Tokens &amp; Secrets are stored locally using AES-256-GCM encryption.</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition shadow-sm active:scale-95"
          >
            Got it (Close)
          </button>
        </div>
      </div>
    </div>
  );
};

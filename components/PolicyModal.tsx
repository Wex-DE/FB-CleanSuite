import React from 'react';
import { X, Shield, Lock, FileText, CheckCircle } from 'lucide-react';

interface PolicyModalProps {
  isOpen: boolean;
  type: 'privacy' | 'terms';
  onClose: () => void;
}

export const PolicyModal: React.FC<PolicyModalProps> = ({ isOpen, type, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden my-auto text-slate-700 dark:text-slate-200">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-slate-950/70 p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-blue-500/10 p-2 text-blue-500 border border-blue-500/20">
              {type === 'privacy' ? <Lock className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                {type === 'privacy' ? 'Privacy & Data Protection Policy' : 'Terms of Authorized Use'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {type === 'privacy' ? 'Localhost-first zero telemetry architecture' : 'Policy compliance & safe usage boundaries'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-4 text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-sans">
          {type === 'privacy' ? (
            <>
              <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-4 text-blue-700 dark:text-blue-300 flex items-start gap-2.5">
                <Shield className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>100% Localhost Execution:</strong> This tool runs exclusively on your local machine (<code className="text-slate-900 dark:text-white font-mono">127.0.0.1:3000</code>). No telemetry, analytics, cookies, or user tracking are gathered or transmitted to third-party servers.
                </span>
              </div>

              <h4 className="text-sm font-semibold text-slate-900 dark:text-white pt-2">1. Token Encryption &amp; Storage</h4>
              <p className="text-slate-500 dark:text-slate-400">
                All Page and User Access Tokens are encrypted using local authenticated <strong>AES-256-GCM</strong> encryption using a machine-generated key located in <code className="font-mono text-slate-800 dark:text-slate-300">data/secrets.key</code>. Tokens never enter client-side browser storage, network responses, or logs.
              </p>

              <h4 className="text-sm font-semibold text-slate-900 dark:text-white pt-2">2. Data Logging &amp; Sanitization</h4>
              <p className="text-slate-500 dark:text-slate-400">
                Internal execution logs are preserved strictly within <code className="font-mono text-slate-800 dark:text-slate-300">data/logs/</code> on your computer. All authorization headers, token strings, and client secrets are automatically sanitized and redacted via regular expressions prior to disk write.
              </p>

              <h4 className="text-sm font-semibold text-slate-900 dark:text-white pt-2">3. Meta Platform Terms Compliance</h4>
              <p className="text-slate-500 dark:text-slate-400">
                This utility does not scrape, bypass CAPTCHAs, hijack sessions, or use private Facebook endpoints. It connects exclusively via official Meta Graph API endpoints on Pages for which you possess administrative permissions.
              </p>
            </>
          ) : (
            <>
              <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-4 text-amber-700 dark:text-amber-300 flex items-start gap-2.5">
                <Shield className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>Responsible Ownership Notice:</strong> This software is an administrative cleanup tool designed strictly for Pages you own or administer. Deletion of Page posts is irreversible.
                </span>
              </div>

              <h4 className="text-sm font-semibold text-slate-900 dark:text-white pt-2">1. Authorized Administration Only</h4>
              <p className="text-slate-500 dark:text-slate-400">
                You agree to use this software only on Facebook Pages where you possess legitimate administrative authority (<code className="font-mono text-slate-800 dark:text-slate-300">pages_manage_posts</code> permission).
              </p>

              <h4 className="text-sm font-semibold text-slate-900 dark:text-white pt-2">2. Rate-Limit Discipline</h4>
              <p className="text-slate-500 dark:text-slate-400">
                You agree not to bypass pacing delays, flood API endpoints, or modify safety thresholds to burst requests. The tool is deliberately paced (conservative 1-by-1 execution) to respect Meta Graph API rate-limit guidelines.
              </p>

              <h4 className="text-sm font-semibold text-slate-900 dark:text-white pt-2">3. Limitation of Liability</h4>
              <p className="text-slate-500 dark:text-slate-400">
                This open-source tool is provided &quot;as is&quot;, without warranty of any kind. The authors and maintainers are not liable for any content deletion, account penalties, or platform restrictions resulting from usage.
              </p>
            </>
          )}
        </div>

        <div className="border-t border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-slate-950/70 p-4 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition active:scale-95"
          >
            I Understand &amp; Agree
          </button>
        </div>
      </div>
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // Don't show if already running in standalone / installed mode
    if (window.matchMedia('(display-mode: standalone)').matches) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };

    const installedHandler = () => {
      setInstalled(true);
      setVisible(false);
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', installedHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setInstalled(true);
    setDeferredPrompt(null);
    setVisible(false);
  };

  const handleDismiss = () => {
    setVisible(false);
    setDeferredPrompt(null);
  };

  if (!visible || installed) return null;

  return (
    <div className="pwa-install-banner" role="banner" aria-label="Install app prompt">
      <div className="pwa-install-content">
        <img src="/logo.png" alt="CampusLedger" className="pwa-install-logo" />
        <div className="pwa-install-text">
          <p className="pwa-install-title">Install CampusLedger App</p>
          <p className="pwa-install-sub">Add to Home Screen for offline access</p>
        </div>
        <button className="pwa-install-btn" onClick={handleInstall} aria-label="Install app">
          <Download size={14} />
          Install
        </button>
        <button className="pwa-dismiss-btn" onClick={handleDismiss} aria-label="Dismiss install prompt">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

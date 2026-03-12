import { useState } from 'react';

const ICON = '/logo.png';

export type PushPermission = NotificationPermission;

export function usePushNotifications() {
  const supported = typeof window !== 'undefined' && 'Notification' in window;

  const [permission, setPermission] = useState<PushPermission>(
    supported ? Notification.permission : 'denied',
  );

  const requestPermission = async (): Promise<PushPermission> => {
    if (!supported) return 'denied';
    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  };

  const notify = (title: string, options?: NotificationOptions) => {
    if (!supported || Notification.permission !== 'granted') return;
    const notif = new Notification(title, {
      icon: ICON,
      badge: ICON,
      ...options,
    });
    notif.onclick = () => {
      window.focus();
      notif.close();
    };
  };

  const sendLowStockAlert = (item = 'HDMI Cables', stock = 5) =>
    notify('⚠️ Low Stock Alert', {
      body: `${item} stock is critically low — only ${stock} units remaining. Reorder required.`,
      tag: 'low-stock',
      requireInteraction: false,
    });

  const sendMaintenanceAlert = (assetName = 'Dell OptiPlex 7090') =>
    notify('🔧 New Maintenance Request', {
      body: `${assetName} has been flagged for urgent maintenance by a lab technician.`,
      tag: 'maintenance',
      requireInteraction: false,
    });

  const sendProcurementAlert = (requestNo = 'PR-2026-002') =>
    notify('✅ Procurement Approved', {
      body: `Purchase request ${requestNo} has been approved and is ready for processing.`,
      tag: 'procurement',
      requireInteraction: false,
    });

  return {
    supported,
    permission,
    requestPermission,
    sendLowStockAlert,
    sendMaintenanceAlert,
    sendProcurementAlert,
  };
}

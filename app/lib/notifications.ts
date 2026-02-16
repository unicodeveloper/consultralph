/**
 * Browser notification utilities for research completion alerts.
 * Uses the Notification API (no service worker needed since the tab
 * stays open during polling).
 */

/**
 * Request permission to send browser notifications.
 * Safe to call multiple times — returns immediately if already granted/denied.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return false;
  }

  if (Notification.permission === "granted") {
    return true;
  }

  if (Notification.permission === "denied") {
    return false;
  }

  const result = await Notification.requestPermission();
  return result === "granted";
}

/**
 * Send a browser notification when research completes.
 * No-ops gracefully if permission was not granted.
 */
export function sendCompletionNotification(title: string): void {
  if (
    typeof window === "undefined" ||
    !("Notification" in window) ||
    Notification.permission !== "granted"
  ) {
    return;
  }

  // Only notify if the tab is not focused
  if (document.hasFocus()) {
    return;
  }

  try {
    new Notification("Research Complete", {
      body: title || "Your research report is ready.",
      icon: "/consultralph.png",
      tag: "research-complete",
    });
  } catch {
    // Safari on iOS throws on new Notification() — fail silently
  }
}

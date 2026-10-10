import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { NetworkOnly, Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

// biome-ignore lint/suspicious/noExplicitAny: ServiceWorker self scope
declare const self: any;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // Never from this cache. The default for /api/ GETs falls back to a stored response when
    // the network is slow or down, keyed by URL alone, whoever is signed in: a shared phone
    // could hand one student another's pull, their guide (it depends on role) or a link to
    // their photo (/api/assets/:id). Every /api/ answer is someone's (RULES R4, 0.5-4). The
    // pages keep their own offline copies: the pull's records whose rows it holds
    // (lib/sync/pull.ts); the guide's does not yet (lib/compass/client.ts, Phase 4).
    {
      matcher: ({ sameOrigin, url: { pathname } }) => sameOrigin && pathname.startsWith("/api/"),
      handler: new NetworkOnly(),
    },
    ...defaultCache,
  ],
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        matcher({ request }: { request: Request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

serwist.addEventListeners();

// Handle Web Push Notifications (PLAN 0-8 §3)
// biome-ignore lint/suspicious/noExplicitAny: ServiceWorker PushEvent
self.addEventListener("push", (event: any) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const title = data.title || "College Ess Reminder";
    const options = {
      body: data.body || "",
      icon: data.icon || "/icon-192.png",
      badge: data.badge || "/icon-192.png",
      data: data.data || { url: "/dashboard" },
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    console.error("Failed to parse push notification payload:", err);
  }
});

// biome-ignore lint/suspicious/noExplicitAny: ServiceWorker NotificationEvent
self.addEventListener("notificationclick", (event: any) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/dashboard";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      // biome-ignore lint/suspicious/noExplicitAny: ServiceWorker Client
      .then((clientList: any[]) => {
        for (const client of clientList) {
          if (client.url && "focus" in client) {
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      }),
  );
});

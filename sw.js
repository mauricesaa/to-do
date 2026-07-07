/* Calendar Planner service worker — offline-first PWA shell.
   Strategy: stale-while-revalidate. The app is served instantly from the
   on-device cache (so it keeps working even if the host is down or the link
   is briefly unreachable), and refreshed in the background whenever online.
   Bump CACHE when you change the app so phones pick up the new version. */
var CACHE = "planner-v3";
var ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  // Only manage same-origin requests; let anything else pass straight through.
  try { if (new URL(req.url).origin !== self.location.origin) return; } catch (_) { return; }

  var accept = req.headers.get("accept") || "";
  var isHTML = req.mode === "navigate" || accept.indexOf("text/html") !== -1;
  // All navigations resolve to the cached app shell.
  var key = isHTML ? "./index.html" : req;

  e.respondWith(
    caches.open(CACHE).then(function (cache) {
      return cache.match(key).then(function (cached) {
        // Kick off a background refresh; never let it break the response.
        var fetching = fetch(req).then(function (res) {
          if (res && res.ok) { cache.put(key, res.clone()); }
          return res;
        }).catch(function () { return cached; });
        e.waitUntil(fetching.catch(function () {}));
        // Serve from cache immediately; only wait on the network if nothing is cached yet.
        return cached || fetching;
      });
    })
  );
});

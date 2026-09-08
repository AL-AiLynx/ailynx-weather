+"use strict";

const CACHE_NAME =
  "ailynx-weather-v36";

const AS1_VALIDATION_ENDPOINT =
  "https://jggazwqwalincsjegieo.supabase.co/functions/v1/as1-validation-read";

const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css?v=25",
  "./weather-engine.js",
  "./as1-observation-client.js?v=10",
  "./as1-validation-client.js?v=10",
  "./as1-horus-client.js?v=16",
  "./lynx-dashboard-config.js?v=19",
  "./lynx-notices.js?v=16",
  "./asset-registry.js?v=4",
  "./weather-history.js?v=1",
  "./as1-asset-client.js?v=2",
  "./asset-read-path.js?v=2",
  "./public-runtime-config.js?v=1",
  "./community-config.js?v=2",
  "./auth-client.js?v=1",
  "./i18n.js?v=4",
  "./community-client.js?v=1",
  "./membership-client.js?v=2",
  "./member-community.js?v=2",
  "./market-advisory-config.js?v=1",
  "./market-advisory.js?v=1",
  "./auth-gate.js?v=3",
  "./market-price-client.js?v=15",
  "./market-dominance-client.js?v=15",
  "./visit-counter-client.js?v=15",
  "./app.js?v=29",
  "./weather-data.json",
  "./horus-sample.json",
  "./manifest.webmanifest",
  "./offline.html",
  "./apple-touch-icon.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];


self.addEventListener(
  "install",
  (event) => {
    event.waitUntil(
      caches
        .open(CACHE_NAME)
        .then((cache) =>
          cache.addAll(APP_SHELL)
        )
    );

    self.skipWaiting();
  }
);


self.addEventListener(
  "activate",
  (event) => {
    event.waitUntil(
      caches
        .keys()
        .then((cacheNames) =>
          Promise.all(
            cacheNames
              .filter(
                (name) =>
                  name !== CACHE_NAME
              )
              .map(
                (name) =>
                  caches.delete(name)
              )
          )
        )
    );

    self.clients.claim();
  }
);


self.addEventListener(
  "fetch",
  (event) => {
    const request =
      event.request;

    if (request.method !== "GET") {
      return;
    }

    const requestUrl =
      new URL(request.url);

    if (
      `${requestUrl.origin}${requestUrl.pathname}` ===
        AS1_VALIDATION_ENDPOINT
    ) {
      event.respondWith(fetch(request));
      return;
    }


    /*
      weather-data.json은
      네트워크 우선, 실패하면 캐시
    */
    const isJsonDataRequest =
      requestUrl.pathname.endsWith(
        "/weather-data.json"
      ) ||
      requestUrl.pathname.endsWith(
        "/horus-sample.json"
      );

    if (isJsonDataRequest) {
      event.respondWith(
        fetch(request)
          .then(async (response) => {
            if (!response.ok) {
              throw new Error(
                `JSON data response error: ${response.status}`
              );
            }

            const cache =
              await caches.open(
                CACHE_NAME
              );

            await cache.put(
              request,
              response.clone()
            );

            return response;
          })
          .catch(async () => {
            const cachedResponse =
              await caches.match(request);

            if (cachedResponse) {
              return cachedResponse;
            }

            return new Response(
              JSON.stringify({
                error: requestUrl.pathname.endsWith(
                  "/horus-sample.json"
                )
                  ? "HORUS sample unavailable"
                  : "Weather data unavailable"
              }),
              {
                status: 503,
                headers: {
                  "Content-Type":
                    "application/json; charset=utf-8"
                }
              }
            );
          })
      );

      return;
    }


    /*
      페이지 이동
    */
    if (
      request.mode === "navigate"
    ) {
      event.respondWith(
        fetch(request).catch(
          async () => {
            const cache =
              await caches.open(
                CACHE_NAME
              );

            return (
              (await cache.match(
                "./index.html"
              )) ||
              (await cache.match(
                "./offline.html"
              ))
            );
          }
        )
      );

      return;
    }


    /*
      CSS·JS·아이콘 등
    */
    event.respondWith(
      caches
        .match(request)
        .then(
          (cachedResponse) =>
            cachedResponse ||
            fetch(request)
        )
    );
  }
);


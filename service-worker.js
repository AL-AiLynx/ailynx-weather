"use strict";

const CACHE_NAME =
  "ailynx-weather-v4";

const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./weather-data.json",
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


    /*
      weather-data.json은
      네트워크 우선, 실패하면 캐시
    */
    if (
      requestUrl.pathname.endsWith(
        "/weather-data.json"
      )
    ) {
      event.respondWith(
        fetch(request)
          .then(async (response) => {
            const cache =
              await caches.open(
                CACHE_NAME
              );

            cache.put(
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
                error: "Weather data unavailable"
              }),
              {
                status: 503,
                headers: {
                  "Content-Type": "application/json"
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

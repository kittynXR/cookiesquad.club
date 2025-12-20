const EVENTS_URL = "data/events.json";
const POSTERS_URL = "data/posters.json";

const toastNode = document.getElementById("toast");
const lightbox = document.getElementById("lightbox");
const lightboxImg = document.getElementById("lightbox-img");
const lightboxCaption = document.getElementById("lightbox-caption");

function showToast(message) {
  if (!toastNode) return;
  toastNode.textContent = message;
  toastNode.classList.add("show");
  window.clearTimeout(showToast._t);
  showToast._t = window.setTimeout(() => toastNode.classList.remove("show"), 1600);
}

function discordTimestamp(epochSeconds, style = "t") {
  return `<t:${epochSeconds}:${style}>`;
}

function formatLocal(epochSeconds, options) {
  try {
    return new Intl.DateTimeFormat(undefined, options).format(new Date(epochSeconds * 1000));
  } catch {
    return new Date(epochSeconds * 1000).toLocaleString();
  }
}

function formatRelative(epochSeconds) {
  const delta = epochSeconds * 1000 - Date.now();
  const abs = Math.abs(delta);
  const minutes = Math.round(abs / 60000);
  const hours = Math.round(abs / 3600000);
  const days = Math.round(abs / 86400000);

  const suffix = delta >= 0 ? "from now" : "ago";
  if (minutes < 60) return `${minutes}m ${suffix}`;
  if (hours < 48) return `${hours}h ${suffix}`;
  return `${days}d ${suffix}`;
}

function pickFeaturedEvent(events) {
  const now = Math.floor(Date.now() / 1000);
  const sorted = [...events].filter((e) => Number.isFinite(e.doorsAt)).sort((a, b) => a.doorsAt - b.doorsAt);
  const next = sorted.find((e) => e.doorsAt >= now - 60);
  if (next) return { mode: "next", event: next };

  const prev = [...sorted].reverse().find(Boolean);
  if (prev) return { mode: "previous", event: prev };

  return { mode: "none", event: null };
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast("Copied!");
  } catch {
    showToast("Copy failed");
  }
}

function openLightbox({ src, alt, caption }) {
  if (!lightbox || !lightboxImg) return;
  lightboxImg.src = src;
  lightboxImg.alt = alt ?? "";
  if (lightboxCaption) lightboxCaption.textContent = caption ?? "";
  if (typeof lightbox.showModal === "function") lightbox.showModal();
  else lightbox.setAttribute("open", "");
}

function escapeHtml(text) {
  return String(text ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderFeatured(container, featured) {
  if (!container) return;
  if (!featured.event) {
    container.className = "card card-body";
    container.textContent = "No events yet.";
    return;
  }

  const { event, mode } = featured;
  const badgeClass = mode === "next" ? "badge next" : "badge prev";
  const badgeText = mode === "next" ? "Next event" : "Previous event";

  container.className = "card featured";
  container.innerHTML = `
    <button class="poster-card card" data-lightbox="poster" type="button" aria-label="View poster">
      <img class="poster" src="${escapeHtml(event.poster)}" alt="${escapeHtml(event.posterAlt ?? event.title)}" loading="lazy" />
    </button>
    <div class="featured-meta">
      <div class="${badgeClass}">${badgeText}</div>
      <h3 class="featured-title">${escapeHtml(event.title)}</h3>
      <div class="kv">
        <div class="kv-row">
          <div class="kv-label">Doors</div>
          <div class="kv-value">
            <span class="chip" title="${discordTimestamp(event.doorsAt, "F")}">${formatLocal(event.doorsAt, {
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}</span>
            <span class="muted">${formatRelative(event.doorsAt)}</span>
            <button class="icon-btn" data-copy="${discordTimestamp(event.doorsAt, "F")}" type="button">Copy</button>
          </div>
        </div>
      </div>
      ${Array.isArray(event.lineup) && event.lineup.length ? `<ul class="lineup">${event.lineup
        .map((slot) => {
          const ts = discordTimestamp(slot.at, "t");
          return `
            <li class="lineup-item">
              <span class="lineup-name">${escapeHtml(slot.name)}</span>
              <span class="lineup-time">
                <span class="chip" title="${ts}">${formatLocal(slot.at, { hour: "numeric", minute: "2-digit" })}</span>
                <button class="icon-btn" data-copy="${ts}" type="button">Copy</button>
              </span>
            </li>
          `;
        })
        .join("")}</ul>` : `<p class="muted">Lineup drops with the next poster.</p>`}
      <div class="hero-actions">
        <a class="btn primary" href="event/?id=${encodeURIComponent(event.id)}">Open event page</a>
        <a class="btn" href="admin/?eventId=${encodeURIComponent(event.id)}">Upload photos</a>
      </div>
    </div>
  `;

  const posterBtn = container.querySelector('[data-lightbox="poster"]');
  posterBtn?.addEventListener("click", () =>
    openLightbox({
      src: event.poster,
      alt: event.posterAlt ?? event.title,
      caption: event.title,
    }),
  );

  for (const btn of container.querySelectorAll("button[data-copy]")) {
    btn.addEventListener("click", () => copyToClipboard(btn.getAttribute("data-copy") ?? ""));
  }
}

function renderPosters(grid, posters) {
  if (!grid) return;
  if (!posters.length) {
    grid.className = "card card-body";
    grid.textContent = "No posters found.";
    return;
  }

  grid.innerHTML = posters
    .map(
      (p) => `
        <button class="card card-body poster-card" type="button" data-poster-src="${escapeHtml(p.src)}" data-poster-label="${escapeHtml(p.label)}">
          <img class="poster" src="${escapeHtml(p.src)}" alt="${escapeHtml(p.label)} poster" loading="lazy" />
          <div class="poster-label">
            <span class="poster-title">${escapeHtml(p.label)}</span>
            <span class="muted">View</span>
          </div>
        </button>
      `,
    )
    .join("");

  for (const btn of grid.querySelectorAll("button[data-poster-src]")) {
    btn.addEventListener("click", () =>
      openLightbox({
        src: btn.getAttribute("data-poster-src") ?? "",
        alt: `${btn.getAttribute("data-poster-label") ?? ""} poster`,
        caption: btn.getAttribute("data-poster-label") ?? "",
      }),
    );
  }
}

async function fetchGalleryCount(eventId) {
  const manifestUrl = `assets/photos/${encodeURIComponent(eventId)}/manifest.json`;
  try {
    const res = await fetch(manifestUrl, { cache: "no-store" });
    if (!res.ok) return { count: 0, manifestUrl, ok: false };
    const data = await res.json();
    const count = Array.isArray(data?.photos) ? data.photos.length : 0;
    return { count, manifestUrl, ok: true };
  } catch {
    return { count: 0, manifestUrl, ok: false };
  }
}

async function renderGalleries(grid, events) {
  if (!grid) return;
  if (!events.length) {
    grid.className = "card card-body";
    grid.textContent = "No events yet.";
    return;
  }

  const counts = await Promise.all(events.map((e) => fetchGalleryCount(e.id)));
  grid.innerHTML = events
    .map((event, idx) => {
      const count = counts[idx]?.count ?? 0;
      const doors = Number.isFinite(event.doorsAt)
        ? formatLocal(event.doorsAt, { year: "numeric", month: "short", day: "numeric" })
        : "TBA";
      return `
        <article class="card">
          <img class="poster" src="${escapeHtml(event.poster)}" alt="${escapeHtml(event.posterAlt ?? event.title)}" loading="lazy" />
          <div class="card-body">
            <div class="poster-title">${escapeHtml(event.title)}</div>
            <div class="muted">${doors}</div>
            <div class="poster-label">
              <span class="chip">${count} photo${count === 1 ? "" : "s"}</span>
              <span class="hero-actions">
                <a class="btn primary" href="event/?id=${encodeURIComponent(event.id)}">View</a>
                <a class="btn" href="admin/?eventId=${encodeURIComponent(event.id)}">Upload</a>
              </span>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

async function main() {
  const featuredNode = document.getElementById("featured-event");
  const postersNode = document.getElementById("poster-grid");
  const galleriesNode = document.getElementById("gallery-grid");

  try {
    const [eventsRes, postersRes] = await Promise.all([fetch(EVENTS_URL), fetch(POSTERS_URL)]);
    if (!eventsRes.ok) throw new Error(`Failed to load ${EVENTS_URL}`);
    if (!postersRes.ok) throw new Error(`Failed to load ${POSTERS_URL}`);

    const eventsData = await eventsRes.json();
    const postersData = await postersRes.json();

    const events = Array.isArray(eventsData?.events) ? eventsData.events : [];
    const posters = Array.isArray(postersData?.posters) ? postersData.posters : [];

    renderFeatured(featuredNode, pickFeaturedEvent(events));
    renderPosters(postersNode, posters);
    await renderGalleries(galleriesNode, events);
  } catch (err) {
    if (featuredNode) {
      featuredNode.className = "card card-body";
      featuredNode.textContent = "Failed to load event data.";
    }
    console.error(err);
  }
}

main();

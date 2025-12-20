const EVENTS_URL = new URL("../data/events.json", import.meta.url);

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

function buildDiscordPost(event) {
  const baseUrl = new URL("../", window.location.href).toString();

  const lines = [];
  lines.push("CookieSquad event:");
  lines.push(String(event?.title ?? "CookieSquad"));

  if (Number.isFinite(event?.doorsAt)) {
    lines.push(`Doors: ${discordTimestamp(event.doorsAt, "F")}`);
  }

  for (const slot of Array.isArray(event?.lineup) ? event.lineup : []) {
    if (!slot?.name || !Number.isFinite(slot?.at)) continue;
    lines.push(`${slot.name} — ${discordTimestamp(slot.at, "t")}`);
  }

  lines.push("");
  lines.push(baseUrl);
  return lines.join("\n");
}

function formatLocal(epochSeconds, options) {
  try {
    return new Intl.DateTimeFormat(undefined, options).format(new Date(epochSeconds * 1000));
  } catch {
    return new Date(epochSeconds * 1000).toLocaleString();
  }
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

function render(root, event, photos) {
  const dateLabel = Number.isFinite(event?.doorsAt)
    ? formatLocal(event.doorsAt, { year: "numeric", month: "long", day: "numeric" })
    : "TBA";

  root.innerHTML = `
    <div class="section-head">
      <h2>${escapeHtml(event.title)}</h2>
      <p class="muted">${dateLabel}</p>
    </div>
    <div class="card featured">
      <button class="poster-card card" data-lightbox="poster" type="button" aria-label="View poster">
        <img class="poster" src="../${escapeHtml(event.poster)}" alt="${escapeHtml(event.posterAlt ?? event.title)}" loading="lazy" />
      </button>
      <div class="featured-meta">
        <div class="kv">
          ${
            Number.isFinite(event?.doorsAt)
              ? `
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
                    <button class="icon-btn" data-copy="${discordTimestamp(event.doorsAt, "F")}" type="button">Copy</button>
                  </div>
                </div>
              `
              : ""
          }
        </div>

        ${
          Array.isArray(event?.lineup) && event.lineup.length
            ? `
              <h3 class="muted" style="margin: 8px 0 0;">Lineup</h3>
              <ul class="lineup">
                ${event.lineup
                  .map((slot) => {
                    if (!slot?.name || !Number.isFinite(slot?.at)) return "";
                    const ts = discordTimestamp(slot.at, "t");
                    return `
                      <li class="lineup-item">
                        <span class="lineup-name">${escapeHtml(slot.name)}</span>
                        <span class="lineup-time">
                          <span class="chip" title="${ts}">${formatLocal(slot.at, {
                            hour: "numeric",
                            minute: "2-digit",
                          })}</span>
                          <button class="icon-btn" data-copy="${ts}" type="button">Copy</button>
                        </span>
                      </li>
                    `;
                  })
                  .join("")}
              </ul>
            `
            : `<p class="muted">Lineup TBA.</p>`
        }

        <div class="hero-actions">
          <a class="btn primary" href="../admin/?eventId=${encodeURIComponent(event.id)}">Upload photos</a>
          <button class="btn" type="button" data-copy-discord-post="1">Copy Discord post</button>
          <a class="btn" href="../">Back</a>
        </div>
      </div>
    </div>

    <div class="section-head" style="margin-top: 22px;">
      <h2>Photos</h2>
      <p class="muted">${Array.isArray(photos) ? `${photos.length} photo${photos.length === 1 ? "" : "s"}` : "No photos yet"}</p>
    </div>

    ${
      Array.isArray(photos) && photos.length
        ? `<div class="grid photos-grid" id="photos-grid">
            ${photos
              .map(
                (p) => `
                  <button class="card photo-card" type="button" data-photo-src="../${escapeHtml(p.src)}" data-photo-alt="${escapeHtml(p.alt ?? "")}">
                    <img class="photo" src="../${escapeHtml(p.src)}" alt="${escapeHtml(p.alt ?? "")}" loading="lazy" />
                  </button>
                `,
              )
              .join("")}
          </div>`
        : `<div class="card card-body">
            <p class="muted" style="margin-top: 0;">
              No photos uploaded for this event yet.
            </p>
      <div class="hero-actions">
        <a class="btn primary" href="../admin/?eventId=${encodeURIComponent(event.id)}">Upload photos</a>
        <button class="btn" type="button" data-copy-discord-post="1">Copy Discord post</button>
        <a class="btn" href="../#galleries">Back to galleries</a>
      </div>
    </div>`
    }
  `;

  root.querySelector('[data-lightbox="poster"]')?.addEventListener("click", () =>
    openLightbox({
      src: `../${event.poster}`,
      alt: event.posterAlt ?? event.title,
      caption: event.title,
    }),
  );

  for (const btn of root.querySelectorAll("button[data-copy]")) {
    btn.addEventListener("click", () => copyToClipboard(btn.getAttribute("data-copy") ?? ""));
  }

  root.querySelector('button[data-copy-discord-post="1"]')?.addEventListener("click", () =>
    copyToClipboard(buildDiscordPost(event)),
  );

  for (const btn of root.querySelectorAll("button[data-photo-src]")) {
    btn.addEventListener("click", () =>
      openLightbox({
        src: btn.getAttribute("data-photo-src") ?? "",
        alt: btn.getAttribute("data-photo-alt") ?? "",
        caption: event.title,
      }),
    );
  }
}

async function fetchManifest(eventId) {
  const manifestUrl = new URL(`../assets/photos/${encodeURIComponent(eventId)}/manifest.json`, import.meta.url);
  try {
    const res = await fetch(manifestUrl, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function main() {
  const root = document.getElementById("event-root");
  if (!root) return;

  const params = new URLSearchParams(window.location.search);
  const eventId = params.get("id");
  if (!eventId) {
    root.innerHTML = `<div class="card card-body">Missing <span class="chip">?id=</span> in the URL.</div>`;
    return;
  }

  try {
    const eventsRes = await fetch(EVENTS_URL);
    if (!eventsRes.ok) throw new Error("Failed to load events");
    const eventsData = await eventsRes.json();
    const events = Array.isArray(eventsData?.events) ? eventsData.events : [];
    const event = events.find((e) => e?.id === eventId);

    if (!event) {
      root.innerHTML = `<div class="card card-body">Event not found: <span class="chip">${escapeHtml(eventId)}</span></div>`;
      return;
    }

    const manifest = await fetchManifest(eventId);
    const photos = Array.isArray(manifest?.photos) ? manifest.photos : [];
    render(root, event, photos);
  } catch (err) {
    root.innerHTML = `<div class="card card-body">Failed to load event.</div>`;
    console.error(err);
  }
}

main();

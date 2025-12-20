const EVENTS_URL = new URL("../data/events.json", import.meta.url);

const form = document.getElementById("upload-form");
const eventSelect = document.getElementById("event-select");
const logNode = document.getElementById("log");
const uploadBtn = document.getElementById("upload-btn");
const toastNode = document.getElementById("toast");

function showToast(message) {
  if (!toastNode) return;
  toastNode.textContent = message;
  toastNode.classList.add("show");
  window.clearTimeout(showToast._t);
  showToast._t = window.setTimeout(() => toastNode.classList.remove("show"), 2000);
}

function escapeHtml(text) {
  return String(text ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function logLine(line) {
  if (!logNode) return;
  logNode.textContent += `${line}\n`;
}

function setBusy(isBusy) {
  if (!uploadBtn) return;
  uploadBtn.disabled = isBusy;
  uploadBtn.textContent = isBusy ? "Uploading…" : "Upload to GitHub";
}

function arrayBufferToBase64(buffer) {
  let binary = "";
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64ToUtf8(b64) {
  const clean = String(b64 ?? "").replace(/\s/g, "");
  const binary = atob(clean);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function utf8ToBase64(text) {
  const bytes = new TextEncoder().encode(String(text ?? ""));
  return arrayBufferToBase64(bytes);
}

function extFromFile(file) {
  const name = String(file?.name ?? "");
  const m = name.match(/\.([a-zA-Z0-9]{1,8})$/);
  if (m) return m[1].toLowerCase();
  const type = String(file?.type ?? "");
  if (type === "image/jpeg") return "jpg";
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return "bin";
}

function safeRepoParts(repo) {
  const m = String(repo ?? "").trim().match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
  if (!m) return null;
  return { owner: m[1], name: m[2] };
}

async function ghRequest({ token, method, url, body }) {
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!res.ok) {
    const message = json?.message ? `${json.message}` : `${res.status} ${res.statusText}`;
    const detail = json?.documentation_url ? ` (${json.documentation_url})` : "";
    const err = new Error(`${method} ${url} failed: ${message}${detail}`);
    err.status = res.status;
    err.payload = json;
    throw err;
  }

  return json;
}

async function loadEvents() {
  const res = await fetch(EVENTS_URL);
  if (!res.ok) throw new Error("Failed to load events");
  const data = await res.json();
  return Array.isArray(data?.events) ? data.events : [];
}

function populateEventSelect(events) {
  if (!eventSelect) return;
  eventSelect.innerHTML = events
    .map((e) => `<option value="${escapeHtml(e.id)}">${escapeHtml(e.title)}</option>`)
    .join("");

  const params = new URLSearchParams(window.location.search);
  const desired = params.get("eventId");
  if (desired && events.some((e) => e.id === desired)) eventSelect.value = desired;
}

async function getManifest({ token, owner, repo, branch, eventId }) {
  const path = `assets/photos/${eventId}/manifest.json`;
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`;
  try {
    const data = await ghRequest({ token, method: "GET", url });
    const content = base64ToUtf8(data?.content ?? "");
    const json = content ? JSON.parse(content) : null;
    return { path, sha: data?.sha ?? null, json: json ?? { eventId, photos: [] } };
  } catch (err) {
    if (err?.status === 404) {
      return { path, sha: null, json: { eventId, photos: [] } };
    }
    throw err;
  }
}

async function putFile({ token, owner, repo, branch, path, message, contentBase64, sha }) {
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}`;
  const body = { message, content: contentBase64, branch };
  if (sha) body.sha = sha;
  return await ghRequest({ token, method: "PUT", url, body });
}

function uniquePhotoName(file, index) {
  const ext = extFromFile(file);
  const rand = Math.random().toString(16).slice(2, 8);
  return `${Date.now()}_${index + 1}_${rand}.${ext}`;
}

async function handleSubmit(ev) {
  ev.preventDefault();
  if (!form) return;
  if (logNode) logNode.textContent = "";

  const fd = new FormData(form);
  const repoInput = String(fd.get("repo") ?? "");
  const branch = String(fd.get("branch") ?? "main");
  const token = String(fd.get("token") ?? "");
  const remember = String(fd.get("remember") ?? "no");
  const eventId = String(fd.get("eventId") ?? "");
  const files = form.querySelector('input[name="files"]')?.files ?? [];

  const repoParts = safeRepoParts(repoInput);
  if (!repoParts) {
    showToast("Repo must be owner/repo");
    return;
  }
  if (!token) {
    showToast("Token required");
    return;
  }
  if (!eventId) {
    showToast("Choose an event");
    return;
  }
  if (!files.length) {
    showToast("Choose photos first");
    return;
  }

  if (remember === "yes") localStorage.setItem("csq_github_token", token);
  else localStorage.removeItem("csq_github_token");

  setBusy(true);
  try {
    logLine(`Repo: ${repoInput} (${branch})`);
    logLine(`Event: ${eventId}`);
    logLine(`Files: ${files.length}`);

    const manifest = await getManifest({
      token,
      owner: repoParts.owner,
      repo: repoParts.name,
      branch,
      eventId,
    });

    const photos = Array.isArray(manifest.json?.photos) ? manifest.json.photos : [];
    manifest.json.photos = photos;

    for (let i = 0; i < files.length; i += 1) {
      const file = files[i];
      if (!String(file?.type ?? "").startsWith("image/")) {
        logLine(`Skipping non-image: ${file.name}`);
        continue;
      }

      const fileName = uniquePhotoName(file, i);
      const path = `assets/photos/${eventId}/${fileName}`;
      logLine(`Uploading ${file.name} -> ${path}`);

      const contentBase64 = arrayBufferToBase64(await file.arrayBuffer());
      await putFile({
        token,
        owner: repoParts.owner,
        repo: repoParts.name,
        branch,
        path,
        message: `Upload photo for ${eventId}`,
        contentBase64,
      });

      photos.push({
        src: path,
        alt: "",
        uploadedAt: new Date().toISOString(),
        originalName: file.name,
      });
    }

    const manifestJson = JSON.stringify(manifest.json, null, 2) + "\n";
    const manifestBase64 = utf8ToBase64(manifestJson);

    const updatedManifest = await putFile({
      token,
      owner: repoParts.owner,
      repo: repoParts.name,
      branch,
      path: manifest.path,
      message: `Update photo manifest for ${eventId}`,
      contentBase64: manifestBase64,
      sha: manifest.sha,
    });

    logLine(`Manifest updated: ${updatedManifest?.content?.path ?? manifest.path}`);
    logLine(`Done.`);
    showToast("Upload complete");

    const eventUrl = new URL(`../event/?id=${encodeURIComponent(eventId)}`, window.location.href);
    logLine(`View: ${eventUrl.toString()}`);
  } catch (err) {
    console.error(err);
    logLine(`ERROR: ${err?.message ?? String(err)}`);
    showToast("Upload failed");
  } finally {
    setBusy(false);
  }
}

async function main() {
  if (!form) return;

  const saved = localStorage.getItem("csq_github_token");
  if (saved) {
    const tokenInput = form.querySelector('input[name="token"]');
    if (tokenInput) tokenInput.value = saved;
  }

  try {
    const events = await loadEvents();
    populateEventSelect(events);
  } catch (err) {
    console.error(err);
    if (eventSelect) eventSelect.innerHTML = `<option value="">Failed to load events</option>`;
  }

  form.addEventListener("submit", handleSubmit);
}

main();

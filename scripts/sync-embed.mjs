import fs from "node:fs/promises";

const INDEX_PATH = "index.html";
const EVENTS_PATH = "data/events.json";

function discordTimestamp(epochSeconds, style = "t") {
  return `<t:${epochSeconds}:${style}>`;
}

function formatInTimeZone(epochSeconds, timeZone, options) {
  return new Intl.DateTimeFormat("en-US", { timeZone, ...options }).format(new Date(epochSeconds * 1000));
}

function timeZoneAbbrev(epochSeconds, timeZone) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "short" }).formatToParts(
      new Date(epochSeconds * 1000),
    );
    return parts.find((p) => p.type === "timeZoneName")?.value ?? "";
  } catch {
    return "";
  }
}

function asAbsoluteUrl(siteUrl, pathOrUrl) {
  if (!pathOrUrl) return siteUrl;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return new URL(pathOrUrl.replace(/^\//, ""), siteUrl.endsWith("/") ? siteUrl : `${siteUrl}/`).toString();
}

function pickEmbedEvent(events, nowEpochSeconds) {
  const eligible = events
    .filter((e) => e && Number.isFinite(e.doorsAt) && e.isPublic !== false)
    .sort((a, b) => a.doorsAt - b.doorsAt);

  const next = eligible.find((e) => e.doorsAt >= nowEpochSeconds);
  if (next) return { mode: "next", event: next };

  const previous = [...eligible].reverse().find(Boolean);
  if (previous) return { mode: "previous", event: previous };

  return { mode: "none", event: null };
}

function buildEmbedMeta({ siteUrl, siteName, timeZone, event, mode }) {
  const baseTitle = siteName || "CookieSquad";
  const title = mode === "next" ? `${baseTitle} — Next Event` : `${baseTitle} — Previous Event`;

  const prefix = mode === "next" ? "Next event will be" : "Previous event was on";
  const hasDoors = Number.isFinite(event?.doorsAt);

  const whenLocal = hasDoors
    ? formatInTimeZone(event.doorsAt, timeZone, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
      })
    : "TBA";
  const whenUtc = hasDoors
    ? formatInTimeZone(event.doorsAt, "UTC", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
      })
    : null;

  const when = whenUtc ? `${whenLocal} / ${whenUtc}` : whenLocal;

  const titleText = event?.title ?? baseTitle;
  const tzShort = hasDoors ? timeZoneAbbrev(event.doorsAt, timeZone) : "";

  const lines = [`${prefix} ${when}: ${titleText}`];
  if (hasDoors) {
    const doorsTime = formatInTimeZone(event.doorsAt, timeZone, { hour: "numeric", minute: "2-digit" });
    lines.push(`Doors — ${doorsTime}${tzShort ? ` ${tzShort}` : ""}`);
  }

  for (const slot of Array.isArray(event?.lineup) ? event.lineup : []) {
    if (!slot?.name || !Number.isFinite(slot?.at)) continue;
    const time = formatInTimeZone(slot.at, timeZone, { hour: "numeric", minute: "2-digit" });
    lines.push(`${slot.name} — ${time}${tzShort ? ` ${tzShort}` : ""}`);
  }

  const description = lines.join("\n");

  const imageUrl = asAbsoluteUrl(siteUrl, event?.poster);

  return [
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${escapeHtmlAttr(baseTitle)}" />`,
    `<meta property="og:url" content="${escapeHtmlAttr(siteUrl)}" />`,
    `<meta property="og:title" content="${escapeHtmlAttr(title)}" />`,
    `<meta property="og:description" content="${escapeHtmlAttr(description)}" />`,
    `<meta property="og:image" content="${escapeHtmlAttr(imageUrl)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeHtmlAttr(title)}" />`,
    `<meta name="twitter:description" content="${escapeHtmlAttr(description)}" />`,
    `<meta name="twitter:image" content="${escapeHtmlAttr(imageUrl)}" />`,
  ].join("\n");
}

function escapeHtmlAttr(value) {
  const placeholder = "__CSQ_NL__";
  return String(value ?? "")
    .replaceAll("\r\n", "\n")
    .replaceAll("\r", "\n")
    .replaceAll("\n", placeholder)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll(placeholder, "&#10;");
}

function replaceEmbedBlock(html, newInnerBlock) {
  const start = "<!-- EMBED:START -->";
  const end = "<!-- EMBED:END -->";
  const startIdx = html.indexOf(start);
  const endIdx = html.indexOf(end);
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    throw new Error(`Embed markers not found in ${INDEX_PATH}`);
  }

  const innerStart = startIdx + start.length;
  const innerEnd = endIdx;

  const indentMatch = html.slice(0, startIdx).match(/\n([ \t]*)$/);
  const indent = indentMatch?.[1] ?? "";
  const indented = newInnerBlock.split("\n").map((line) => `${indent}${line}`).join("\n");

  return `${html.slice(0, innerStart)}\n${indented}\n${indent}${html.slice(innerEnd)}`;
}

async function main() {
  const [indexHtmlRaw, eventsRaw] = await Promise.all([
    fs.readFile(INDEX_PATH, "utf8"),
    fs.readFile(EVENTS_PATH, "utf8"),
  ]);
  const eventsData = JSON.parse(eventsRaw);
  const siteUrl = eventsData?.site?.url ?? "https://cookiesquad.club/";
  const siteName = eventsData?.site?.name ?? "CookieSquad";
  const timeZone = eventsData?.site?.timezone ?? "UTC";
  const events = Array.isArray(eventsData?.events) ? eventsData.events : [];

  const nowEpochSeconds = Math.floor(Date.now() / 1000);
  const picked = pickEmbedEvent(events, nowEpochSeconds);
  if (!picked.event) throw new Error("No eligible events found in data/events.json");

  const newInner = buildEmbedMeta({
    siteUrl: siteUrl.endsWith("/") ? siteUrl : `${siteUrl}/`,
    siteName,
    timeZone,
    event: picked.event,
    mode: picked.mode,
  });

  const updated = replaceEmbedBlock(indexHtmlRaw, newInner);
  await fs.writeFile(INDEX_PATH, updated, "utf8");
  console.log(`Synced embed: ${picked.mode} -> ${picked.event.id}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

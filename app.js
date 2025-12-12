/* Unhinged Dota Tactics — single-file app.js
   - Random draw with filters
   - Favorites via localStorage
   - Share link with card id
   - Export image (canvas)
*/

const els = {
  btnRandom: document.getElementById("btnRandom"),
  btnSurprise: document.getElementById("btnSurprise"),
  btnPickFromList: document.getElementById("btnPickFromList"),
  btnFavorites: document.getElementById("btnFavorites"),
  btnCloseList: document.getElementById("btnCloseList"),
  btnReset: document.getElementById("btnReset"),

  search: document.getElementById("search"),
  mode: document.getElementById("mode"),
  roles: document.getElementById("roles"),
  tilt: document.getElementById("tilt"),
  onlyNew: document.getElementById("onlyNew"),

  pillMeta: document.getElementById("pillMeta"),

  cardName: document.getElementById("cardName"),
  cardTagline: document.getElementById("cardTagline"),
  cardRoles: document.getElementById("cardRoles"),
  cardMode: document.getElementById("cardMode"),
  cardTilt: document.getElementById("cardTilt"),
  cardDiff: document.getElementById("cardDiff"),
  cardRule: document.getElementById("cardRule"),
  cardWin: document.getElementById("cardWin"),
  cardWhy: document.getElementById("cardWhy"),
  cardSpice: document.getElementById("cardSpice"),
  cardWarning: document.getElementById("cardWarning"),

  btnFav: document.getElementById("btnFav"),
  btnCopy: document.getElementById("btnCopy"),
  btnShare: document.getElementById("btnShare"),
  btnExport: document.getElementById("btnExport"),

  listPanel: document.getElementById("listPanel"),
  listTitle: document.getElementById("listTitle"),
  list: document.getElementById("list"),

  exportCanvas: document.getElementById("exportCanvas")
};

const STORE_FAV = "udt_favorites_v1";

let allCards = [];
let current = null;
let sessionSeen = new Set();
let favorites = new Set(loadFavorites());

init();

async function init() {
  const data = await fetch("tactics.json").then(r => r.json());
  allCards = (data.cards || []).slice();

  // If share link contains id, load it
  const url = new URL(location.href);
  const sharedId = url.searchParams.get("card");
  if (sharedId) {
    const found = allCards.find(c => c.id === sharedId);
    if (found) {
      showCard(found, { source: "share-link" });
    }
  }

  if (!current) {
    showCard(pickRandomFiltered(), { source: "initial" });
  }

  wireEvents();
  renderMeta();
}

function wireEvents() {
  els.btnRandom.addEventListener("click", () => {
    showCard(pickRandomFiltered(), { source: "random" });
  });

  els.btnSurprise.addEventListener("click", () => {
    // Chaos mode: ignore filters, but avoid repeats if possible.
    const pick = pickRandom(allCards.filter(c => !sessionSeen.has(c.id))) || pickRandom(allCards);
    showCard(pick, { source: "chaos" });
  });

  ["input", "change"].forEach(ev => {
    els.search.addEventListener(ev, rerollIfNoMatchHint);
    els.mode.addEventListener(ev, rerollIfNoMatchHint);
    els.roles.addEventListener(ev, rerollIfNoMatchHint);
    els.tilt.addEventListener(ev, rerollIfNoMatchHint);
    els.onlyNew.addEventListener(ev, rerollIfNoMatchHint);
  });

  els.btnPickFromList.addEventListener("click", () => openList("Browse", filteredCards()));
  els.btnFavorites.addEventListener("click", () => openFavorites());

  els.btnCloseList.addEventListener("click", () => closeList());
  els.btnReset.addEventListener("click", () => {
    els.search.value = "";
    els.mode.value = "any";
    els.roles.value = "any";
    els.tilt.value = "any";
    els.onlyNew.checked = false;
    sessionSeen.clear();
    showCard(pickRandomFiltered(), { source: "reset" });
  });

  els.btnFav.addEventListener("click", toggleFavoriteCurrent);
  els.btnCopy.addEventListener("click", copyCurrent);
  els.btnShare.addEventListener("click", shareCurrent);
  els.btnExport.addEventListener("click", exportCurrentImage);

  window.addEventListener("keydown", (e) => {
    if (e.target && ["INPUT", "SELECT", "TEXTAREA"].includes(e.target.tagName)) return;

    if (e.key.toLowerCase() === "r") {
      e.preventDefault();
      showCard(pickRandomFiltered(), { source: "hotkey-r" });
    }
    if (e.key.toLowerCase() === "f") {
      e.preventDefault();
      toggleFavoriteCurrent();
    }
    if (e.key.toLowerCase() === "c") {
      e.preventDefault();
      copyCurrent();
    }
    if (e.key === "Escape") closeList();
  });
}

function rerollIfNoMatchHint() {
  renderMeta();
}

function filteredCards() {
  const q = (els.search.value || "").trim().toLowerCase();
  const mode = els.mode.value;
  const roles = els.roles.value;
  const tilt = els.tilt.value;

  return allCards.filter(c => {
    if (mode !== "any" && c.mode !== mode) return false;
    if (roles !== "any" && c.roles_key !== roles) return false;
    if (tilt !== "any" && c.tilt !== tilt) return false;

    if (q) {
      const hay = [
        c.name, c.tagline, c.roles_text, c.rule, c.win, c.why, c.spice, c.warning,
        c.mode, c.tilt, c.difficulty
      ].join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }

    return true;
  });
}

function pickRandomFiltered() {
  const poolAll = filteredCards();
  if (!poolAll.length) {
    // fallback to any
    return pickRandom(allCards);
  }

  const preferNew = els.onlyNew.checked;
  if (!preferNew) return pickRandom(poolAll);

  const unseen = poolAll.filter(c => !sessionSeen.has(c.id));
  return pickRandom(unseen) || pickRandom(poolAll);
}

function pickRandom(arr) {
  if (!arr || arr.length === 0) return null;
  const i = Math.floor(Math.random() * arr.length);
  return arr[i];
}

function showCard(card, { source } = {}) {
  if (!card) return;

  current = card;
  sessionSeen.add(card.id);

  els.cardName.textContent = card.name || "—";
  els.cardTagline.textContent = card.tagline || "—";
  els.cardRoles.textContent = card.roles_text || "—";
  els.cardMode.textContent = formatMode(card.mode);
  els.cardTilt.textContent = formatTilt(card.tilt);
  els.cardDiff.textContent = card.difficulty || "—";
  els.cardRule.textContent = card.rule || "—";
  els.cardWin.textContent = card.win || "—";
  els.cardWhy.textContent = card.why || "—";
  els.cardSpice.textContent = card.spice || "—";
  els.cardWarning.textContent = card.warning || "—";

  setFavButton();
  renderMeta(source);
  updateURL(card.id);
}

function renderMeta(source = "") {
  const pool = filteredCards();
  const preferNew = els.onlyNew.checked;
  const unseenCount = pool.filter(c => !sessionSeen.has(c.id)).length;

  const parts = [];
  parts.push(`${pool.length}/${allCards.length} match`);
  if (preferNew) parts.push(`${unseenCount} unseen`);
  if (source) parts.push(`via ${source}`);

  els.pillMeta.textContent = parts.join(" • ");
}

function formatMode(m) {
  if (m === "ranked_ok") return "Ranked OK";
  if (m === "unranked_only") return "Unranked only";
  return m || "Any";
}
function formatTilt(t) {
  if (!t) return "—";
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function loadFavorites() {
  try {
    const raw = localStorage.getItem(STORE_FAV);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr;
  } catch {
    return [];
  }
}
function saveFavorites() {
  localStorage.setItem(STORE_FAV, JSON.stringify(Array.from(favorites)));
}
function setFavButton() {
  if (!current) return;
  const isFav = favorites.has(current.id);
  els.btnFav.textContent = isFav ? "⭐ Saved" : "⭐ Save";
}

function toggleFavoriteCurrent() {
  if (!current) return;
  if (favorites.has(current.id)) favorites.delete(current.id);
  else favorites.add(current.id);
  saveFavorites();
  setFavButton();
}

function openList(title, cards) {
  els.listTitle.textContent = title;
  els.list.innerHTML = "";

  const items = (cards || []).slice().sort((a,b) => a.name.localeCompare(b.name));
  if (!items.length) {
    els.list.innerHTML = `<div class="pill">No cards found.</div>`;
  } else {
    for (const c of items) {
      const div = document.createElement("div");
      div.className = "listItem";
      div.innerHTML = `
        <div class="listItemTop">
          <div class="listItemName">${escapeHtml(c.name)}</div>
          <div class="listItemMeta">${escapeHtml(formatMode(c.mode))} • ${escapeHtml(formatTilt(c.tilt))} • ${escapeHtml(c.roles_text || "")}</div>
        </div>
        <div class="listItemDesc">${escapeHtml(c.tagline || "")}</div>
      `;
      div.addEventListener("click", () => {
        showCard(c, { source: "list" });
        closeList();
      });
      els.list.appendChild(div);
    }
  }

  els.listPanel.classList.remove("hidden");
  window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
}

function closeList() {
  els.listPanel.classList.add("hidden");
}

function openFavorites() {
  const favCards = allCards.filter(c => favorites.has(c.id));
  openList("Favorites", favCards);
}

function copyCurrent() {
  if (!current) return;
  const text = formatCardText(current);
  navigator.clipboard.writeText(text).then(() => {
    toast("Copied.");
  }).catch(() => {
    toast("Copy failed (browser blocked).");
  });
}

function shareCurrent() {
  if (!current) return;
  const shareUrl = new URL(location.href);
  shareUrl.searchParams.set("card", current.id);

  const text = `Try this Dota tactic:\n${current.name}\n${shareUrl.toString()}`;

  if (navigator.share) {
    navigator.share({ title: current.name, text, url: shareUrl.toString() }).catch(() => {});
  } else {
    navigator.clipboard.writeText(shareUrl.toString()).then(() => toast("Share link copied."));
  }
}

function updateURL(cardId) {
  const url = new URL(location.origin + location.pathname);
  url.searchParams.set("card", cardId);
  history.replaceState({}, "", url.toString());
}

function formatCardText(c) {
  return [
    `🃏 ${c.name}`,
    c.tagline ? `— ${c.tagline}` : "",
    ``,
    `Roles: ${c.roles_text || "-"}`,
    `Mode: ${formatMode(c.mode)} • Tilt: ${formatTilt(c.tilt)} • Difficulty: ${c.difficulty || "-"}`,
    ``,
    `Core rule: ${c.rule || "-"}`,
    `Win condition: ${c.win || "-"}`,
    `Why it works: ${c.why || "-"}`,
    `Optional spice: ${c.spice || "-"}`,
    ``,
    `Note: ${c.warning || "-"}`,
  ].filter(Boolean).join("\n");
}

/* ---- Export as image (canvas) ---- */
async function exportCurrentImage() {
  if (!current) return;

  const canvas = els.exportCanvas;
  const ctx = canvas.getContext("2d");

  // background
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle = "#0b0f19";
  ctx.fillRect(0,0,canvas.width,canvas.height);

  // subtle gradients
  gradientBlob(ctx, 240, 120, 420, "rgba(124,58,237,.25)");
  gradientBlob(ctx, 980, 220, 380, "rgba(59,130,246,.18)");

  // card container
  roundRect(ctx, 70, 70, 1060, 535, 26, "rgba(16,24,39,.9)", "rgba(31,42,68,.85)");

  // header
  ctx.fillStyle = "#e5e7eb";
  ctx.font = "800 44px Inter";
  ctx.fillText("🃏 " + current.name, 110, 145);

  ctx.fillStyle = "#9ca3af";
  ctx.font = "600 22px Inter";
  wrapText(ctx, current.tagline || "", 110, 185, 980, 28);

  // meta row
  const meta = `${current.roles_text || ""} • ${formatMode(current.mode)} • Tilt: ${formatTilt(current.tilt)} • Diff: ${current.difficulty || ""}`;
  ctx.fillStyle = "rgba(229,231,235,.9)";
  ctx.font = "600 18px Inter";
  wrapText(ctx, meta, 110, 255, 980, 24);

  // sections
  let y = 305;
  y = drawSection(ctx, "Core rule", current.rule, 110, y);
  y = drawSection(ctx, "Win condition", current.win, 110, y);
  y = drawSection(ctx, "Why it works", current.why, 110, y);
  y = drawSection(ctx, "Optional spice", current.spice, 110, y);

  // footer note
  ctx.fillStyle = "rgba(156,163,175,.95)";
  ctx.font = "600 18px Inter";
  wrapText(ctx, current.warning || "", 110, 560, 980, 24);

  // watermark
  ctx.fillStyle = "rgba(156,163,175,.65)";
  ctx.font = "700 16px Inter";
  ctx.fillText("Unhinged Dota Tactics • Duo queue edition", 110, 632);

  const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
  if (!blob) return toast("Export failed.");

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `tactic-${current.id}.png`;
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ---- small drawing helpers ---- */
function roundRect(ctx, x, y, w, h, r, fill, stroke) {
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.arcTo(x+w, y, x+w, y+h, r);
  ctx.arcTo(x+w, y+h, x, y+h, r);
  ctx.arcTo(x, y+h, x, y, r);
  ctx.arcTo(x, y, x+w, y, r);
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function gradientBlob(ctx, cx, cy, radius, color) {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  g.addColorStop(0, color);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI*2);
  ctx.fill();
}

function drawSection(ctx, title, text, x, y) {
  ctx.fillStyle = "#e5e7eb";
  ctx.font = "800 22px Inter";
  ctx.fillText(title, x, y);

  ctx.fillStyle = "rgba(229,231,235,.92)";
  ctx.font = "500 20px Inter";
  const nextY = wrapText(ctx, text || "", x, y + 30, 980, 26);

  return nextY + 18;
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = String(text).split(/\s+/).filter(Boolean);
  let line = "";
  let yy = y;

  for (const w of words) {
    const test = line ? (line + " " + w) : w;
    const { width } = ctx.measureText(test);
    if (width > maxWidth) {
      ctx.fillText(line, x, yy);
      line = w;
      yy += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, yy);
  return yy + lineHeight;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* ---- tiny toast ---- */
let toastEl = null;
function toast(msg) {
  if (toastEl) toastEl.remove();
  toastEl = document.createElement("div");
  toastEl.textContent = msg;
  toastEl.style.position = "fixed";
  toastEl.style.bottom = "18px";
  toastEl.style.left = "50%";
  toastEl.style.transform = "translateX(-50%)";
  toastEl.style.padding = "10px 12px";
  toastEl.style.background = "rgba(15,23,42,.92)";
  toastEl.style.border = "1px solid rgba(31,42,68,.9)";
  toastEl.style.borderRadius = "12px";
  toastEl.style.color = "#e5e7eb";
  toastEl.style.boxShadow = "0 12px 40px rgba(0,0,0,.35)";
  toastEl.style.zIndex = "9999";
  document.body.appendChild(toastEl);
  setTimeout(() => toastEl?.remove(), 1200);
}

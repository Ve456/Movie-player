const ICONS = {
  close: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>`,
  edit: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`,
  check: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  play: `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><polygon points="6,4 20,12 6,20"/></svg>`,
  musicNote: `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`,
  lock: `<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
};

async function safeJson(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      res.ok
        ? "Server sent back something unexpected"
        : `Server error ${res.status} — make sure server.js is up to date and restarted`
    );
  }
}

const debugLogEntries = [];
const DEBUG_LOG_MAX = 300;

function debugLog(message, level) {
  const entry = { time: new Date(), message, level: level || "info" };
  debugLogEntries.push(entry);
  if (debugLogEntries.length > DEBUG_LOG_MAX) debugLogEntries.shift();
  renderDebugLog();
}

function renderDebugLog() {
  const el = document.getElementById("debug-log");
  if (!el || !document.getElementById("settings-modal-overlay").classList.contains("open")) return;

  if (debugLogEntries.length === 0) {
    el.innerHTML = `<div class="debug-log-entry">No events logged yet.</div>`;
    return;
  }

  el.innerHTML = debugLogEntries
    .slice()
    .reverse()
    .map((e) => {
      const t = e.time.toTimeString().slice(0, 8);
      const cls = e.level === "error" ? " debug-error" : e.level === "ok" ? " debug-ok" : "";
      return `<div class="debug-log-entry${cls}"><span class="debug-time">${t}</span>${escapeHtml(e.message)}</div>`;
    })
    .join("");
}

const grid = document.getElementById("grid");
const status = document.getElementById("status");
const overlay = document.getElementById("player-overlay");
const videoEl = document.getElementById("video-el");
const playerTitle = document.getElementById("player-title");
const closeBtn = document.getElementById("close-player");
const uploadBtn = document.getElementById("upload-btn");
const fileInput = document.getElementById("file-input");
const uploadsList = document.getElementById("uploads");
const dropzone = document.getElementById("dropzone");
const searchInput = document.getElementById("search-input");
const categoriesEl = document.getElementById("categories");
const tagModalOverlay = document.getElementById("tag-modal-overlay");
const tagModalTitle = document.getElementById("tag-modal-title");
const tagInput = document.getElementById("tag-input");
const tagCancelBtn = document.getElementById("tag-cancel");
const tagSaveBtn = document.getElementById("tag-save");
const gamepadIndicator = document.getElementById("gamepad-indicator");
const assignBanner = document.getElementById("assign-banner");
const assignCategoryName = document.getElementById("assign-category-name");
const assignDoneBtn = document.getElementById("assign-done");
const musicPlayer = document.getElementById("music-player");
const audioEl = document.getElementById("audio-el");
const visualizerCanvas = document.getElementById("visualizer");
const nameInput = document.getElementById("name-input");
const nameExt = document.getElementById("name-ext");
const thumbPreviewImg = document.getElementById("thumb-preview-img");
const thumbPreviewEmpty = document.getElementById("thumb-preview-empty");
const thumbFileInput = document.getElementById("thumb-file-input");
const thumbUploadBtn = document.getElementById("thumb-upload-btn");
const thumbRemoveBtn = document.getElementById("thumb-remove-btn");
const thumbSearchBtn = document.getElementById("thumb-search-btn");
const thumbSearchResults = document.getElementById("thumb-search-results");
const settingsBtn = document.getElementById("settings-btn");
const settingsOverlay = document.getElementById("settings-modal-overlay");
const settingsCloseBtn = document.getElementById("settings-close");
const themeGrid = document.getElementById("theme-grid");
const backgroundBadge = document.getElementById("background-badge");
const bufferSpinner = document.getElementById("buffer-spinner");
const musicSpinner = document.getElementById("music-spinner");
const backgroundToggle = document.getElementById("background-toggle");
const debugToggleBtn = document.getElementById("debug-toggle-btn");
const debugChevron = document.getElementById("debug-chevron");
const debugSubmenu = document.getElementById("debug-submenu");
const forceCacheToggle = document.getElementById("force-cache-toggle");
const debugLogEl = document.getElementById("debug-log");
const debugLogClearBtn = document.getElementById("debug-log-clear");
const tmdbKeyInput = document.getElementById("tmdb-key-input");
const tmdbSaveBtn = document.getElementById("tmdb-save-btn");
const tmdbStatus = document.getElementById("tmdb-status");
const controllerMapList = document.getElementById("controller-map-list");
const unlockOverlay = document.getElementById("unlock-modal-overlay");
const unlockModal = document.getElementById("unlock-modal");
const unlockModalTitle = document.getElementById("unlock-modal-title");
const unlockModalDesc = document.getElementById("unlock-modal-desc");
const unlockPasscodeInput = document.getElementById("unlock-passcode-input");
const unlockCancelBtn = document.getElementById("unlock-cancel");
const unlockSubmitBtn = document.getElementById("unlock-submit");
const privacyOverlay = document.getElementById("privacy-modal-overlay");
const privacyModalTitle = document.getElementById("privacy-modal-title");
const privacyModalBody = document.getElementById("privacy-modal-body");
const privacyCancelBtn = document.getElementById("privacy-cancel");

let allVideos = [];
let activeCategory = null;
let searchTerm = "";
let editingFilename = null;
let editingExt = "";
let assignMode = null;
let posterSearchEnabled = false;

function formatSize(bytes) {
  const gb = bytes / (1024 ** 3);
  if (gb >= 1) return gb.toFixed(1) + " GB";
  const mb = bytes / (1024 ** 2);
  return mb.toFixed(0) + " MB";
}

const THEMES = [
  { id: "ocean", name: "Ocean", a: "#2dd4c8", b: "#3b82f6" },
  { id: "sunset", name: "Sunset", a: "#f472b6", b: "#a855f7" },
  { id: "grape", name: "Grape", a: "#8b5cf6", b: "#d946ef" },
  { id: "ember", name: "Ember", a: "#fb923c", b: "#ef4444" },
  { id: "forest", name: "Forest", a: "#34d399", b: "#10b981" },
  { id: "rose", name: "Rose", a: "#fb7185", b: "#e11d48" },
  { id: "gold", name: "Gold", a: "#fbbf24", b: "#d97706" },
  { id: "midnight", name: "Midnight", a: "#6366f1", b: "#4338ca" },
  { id: "cyber", name: "Cyber", a: "#22d3ee", b: "#e879f9" },
  { id: "light", name: "Light", a: "#0891a3", b: "#4f46e5" },
  { id: "sand", name: "Sand", a: "#d97706", b: "#c2410c" },
];

function getCurrentTheme() {
  return localStorage.getItem("homeflix-theme") || "ocean";
}

function applyTheme(themeId) {
  document.documentElement.setAttribute("data-theme", themeId);
  localStorage.setItem("homeflix-theme", themeId);
  renderThemeGrid();
}

function renderThemeGrid() {
  const current = getCurrentTheme();
  themeGrid.innerHTML = "";

  THEMES.forEach((theme) => {
    const swatch = document.createElement("div");
    swatch.className = "theme-swatch" + (current === theme.id ? " active" : "");
    swatch.tabIndex = 0;
    swatch.innerHTML = `
      <div class="swatch-dot" style="background: linear-gradient(135deg, ${theme.a}, ${theme.b});"></div>
      <div class="swatch-label">${theme.name}</div>
    `;
    swatch.addEventListener("click", () => applyTheme(theme.id));
    themeGrid.appendChild(swatch);
  });
}

settingsBtn.addEventListener("click", () => {
  renderThemeGrid();
  refreshTmdbStatus();
  renderControllerMap();
  renderCacheNodeStatus();
  settingsOverlay.classList.add("open");
  renderDebugLog();
});

async function renderCacheNodeStatus() {
  const el = document.getElementById("cache-node-list");
  if (!el) return;
  el.innerHTML = `<div class="controller-value">Checking for cache nodes on the LAN…</div>`;
  await refreshCacheNodes();

  if (discoveredCacheNodes.length === 0) {
    el.innerHTML = `<div class="controller-value">None found. Run cache-node.js on another machine on this network to add one.</div>`;
    return;
  }

  el.innerHTML = discoveredCacheNodes
    .map((n) => {
      const isBest = bestCacheNode && bestCacheNode.id === n.id;
      const latency = isBest ? `${Math.round(bestCacheNode.latencyMs)}ms` : "unreachable or slower";
      return `
        <div class="controller-row">
          <div>
            <div class="controller-label">${escapeHtml(n.address)}:${n.port}</div>
            <div class="controller-value">${isBest ? `Active — ${latency}` : latency}</div>
          </div>
        </div>
      `;
    })
    .join("");
}

settingsCloseBtn.addEventListener("click", () => settingsOverlay.classList.remove("open"));

settingsOverlay.addEventListener("click", (e) => {
  if (e.target === settingsOverlay) settingsOverlay.classList.remove("open");
});

async function refreshTmdbStatus() {
  try {
    const res = await fetch("/api/config");
    const cfg = await safeJson(res);
    posterSearchEnabled = Boolean(cfg.posterSearchEnabled);
    thumbSearchBtn.style.display = posterSearchEnabled ? "" : "none";
    tmdbKeyInput.value = "";
    tmdbKeyInput.placeholder = cfg.hasCustomKey ? "•••••••• (key saved)" : "TMDB API key";
    tmdbStatus.textContent = posterSearchEnabled ? "Poster search is enabled." : "Poster search is off — add a key to enable it.";
    tmdbStatus.classList.toggle("enabled", posterSearchEnabled);
  } catch {
    tmdbStatus.textContent = "Couldn't load status.";
  }
}

tmdbSaveBtn.addEventListener("click", async () => {
  const value = tmdbKeyInput.value.trim();
  try {
    const res = await fetch("/api/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tmdbApiKey: value }),
    });
    const cfg = await safeJson(res);
    if (!res.ok) throw new Error(cfg.error || "Server error");
    await refreshTmdbStatus();
  } catch (err) {
    tmdbStatus.textContent = "Couldn't save key: " + err.message;
  }
});

function getBackgroundPlaySetting() {
  return localStorage.getItem("homeflix-background-play") === "on";
}

function setBackgroundPlaySetting(on) {
  localStorage.setItem("homeflix-background-play", on ? "on" : "off");
  backgroundToggle.classList.toggle("on", on);
  backgroundToggle.setAttribute("aria-checked", on ? "true" : "false");
}

backgroundToggle.addEventListener("click", () => {
  setBackgroundPlaySetting(!getBackgroundPlaySetting());
});

debugToggleBtn.addEventListener("click", () => {
  const isOpen = debugSubmenu.classList.toggle("open");
  debugChevron.classList.toggle("open", isOpen);
  if (isOpen) renderDebugLog();
});

function getForceCacheSetting() {
  return localStorage.getItem("homeflix-force-cache") === "on";
}

function setForceCacheSetting(on, { silent } = {}) {
  localStorage.setItem("homeflix-force-cache", on ? "on" : "off");
  forceCacheToggle.classList.toggle("on", on);
  forceCacheToggle.setAttribute("aria-checked", on ? "true" : "false");
  if (!silent) debugLog(`Force cache node playback turned ${on ? "ON" : "off"}`);
}

forceCacheToggle.addEventListener("click", () => {
  setForceCacheSetting(!getForceCacheSetting());
});

setForceCacheSetting(getForceCacheSetting(), { silent: true });

debugLogClearBtn.addEventListener("click", () => {
  debugLogEntries.length = 0;
  renderDebugLog();
});

setBackgroundPlaySetting(getBackgroundPlaySetting());

let privateFolderNames = new Set();

function getUnlockToken(category) {
  return sessionStorage.getItem(`homeflix-unlock-${category}`);
}

function setUnlockToken(category, token) {
  sessionStorage.setItem(`homeflix-unlock-${category}`, token);
}

function buildTokensParam() {
  const tokens = [];
  privateFolderNames.forEach((cat) => {
    const token = getUnlockToken(cat);
    if (token) tokens.push({ category: cat, token });
  });
  if (tokens.length === 0) return "";
  return "tokens=" + encodeURIComponent(JSON.stringify(tokens));
}

function withTokens(url) {
  const param = buildTokensParam();
  if (!param) return url;
  return url + (url.includes("?") ? "&" : "?") + param;
}

async function loadPrivateFolderList() {
  try {
    const res = await fetch("/api/private-folders");
    const names = await safeJson(res);
    privateFolderNames = new Set(names);
  } catch {
    privateFolderNames = new Set();
  }
}

let discoveredCacheNodes = [];
let bestCacheNode = null;

async function probeNode(node) {
  const start = performance.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1000);
    const res = await fetch(`http://${node.address}:${node.port}/status`, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) {
      debugLog(`Probe ${node.address}:${node.port} — bad response (${res.status})`, "error");
      return null;
    }
    const latencyMs = performance.now() - start;
    debugLog(`Probe ${node.address}:${node.port} — OK, ${Math.round(latencyMs)}ms`, "ok");
    return { ...node, latencyMs };
  } catch (err) {
    debugLog(`Probe ${node.address}:${node.port} — unreachable (${err.message})`, "error");
    return null;
  }
}

async function refreshCacheNodes() {
  try {
    const res = await fetch("/api/cache-nodes");
    const data = await safeJson(res);
    discoveredCacheNodes = data.nodes || [];

    if (discoveredCacheNodes.length === 0) {
      bestCacheNode = null;
      return;
    }

    debugLog(`Found ${discoveredCacheNodes.length} cache node(s) registered, probing…`);
    const probes = (await Promise.all(discoveredCacheNodes.map(probeNode))).filter(Boolean);
    probes.sort((a, b) => a.latencyMs - b.latencyMs);
    bestCacheNode = probes[0] || null;

    if (bestCacheNode) {
      debugLog(`Selected fastest cache node: ${bestCacheNode.address}:${bestCacheNode.port} (${Math.round(bestCacheNode.latencyMs)}ms)`, "ok");
    } else {
      debugLog(`No cache nodes responded — will use the main server directly`, "error");
    }
  } catch (err) {
    discoveredCacheNodes = [];
    bestCacheNode = null;
    debugLog(`Could not fetch cache node list: ${err.message}`, "error");
  }
}

function videoHasPrivateTag(video) {
  return video.tags.some((t) => privateFolderNames.has(t));
}

function getStreamUrl(video) {
  const directUrl = withTokens("/stream/" + encodeURIComponent(video.filename));

  if (videoHasPrivateTag(video)) {
    debugLog(`"${video.title}" is in a private folder — always using main server directly`);
    return directUrl;
  }

  const forceCache = getForceCacheSetting();

  if (forceCache && discoveredCacheNodes.length > 0) {
    const node = bestCacheNode || discoveredCacheNodes[0];
    debugLog(`Force cache node ON — routing "${video.title}" through ${node.address}:${node.port} (unverified)`);
    return `http://${node.address}:${node.port}/video/${encodeURIComponent(video.filename)}`;
  }

  if (!bestCacheNode) {
    debugLog(`Playing "${video.title}" directly from main server (no healthy cache node)`);
    return directUrl;
  }

  debugLog(`Playing "${video.title}" via cache node ${bestCacheNode.address}:${bestCacheNode.port}`, "ok");
  return `http://${bestCacheNode.address}:${bestCacheNode.port}/video/${encodeURIComponent(video.filename)}`;
}

async function loadLibrary() {
  try {
    const res = await fetch(withTokens("/api/videos"));
    if (!res.ok) throw new Error("Server error " + res.status);
    allVideos = await safeJson(res);
    renderCategories();
    renderGrid();
    debugLog(`Loaded library: ${allVideos.length} item(s) visible`);
  } catch (err) {
    status.style.display = "block";
    status.textContent = "Couldn't load the library: " + err.message;
    debugLog(`Failed to load library: ${err.message}`, "error");
  }
}

function renderCategories() {
  const all = new Set();
  allVideos.forEach((v) => v.tags.forEach((t) => all.add(t)));
  privateFolderNames.forEach((t) => all.add(t));
  const cats = [...all].sort((a, b) => a.localeCompare(b));

  categoriesEl.innerHTML = "";

  const allChip = document.createElement("div");
  allChip.className = "chip" + (activeCategory === null ? " active" : "");
  allChip.textContent = "All";
  allChip.addEventListener("click", () => {
    activeCategory = null;
    renderCategories();
    renderGrid();
  });
  categoriesEl.appendChild(allChip);

  cats.forEach((cat) => {
    const wrap = document.createElement("div");
    wrap.className = "chip-wrap";
    const isPrivate = privateFolderNames.has(cat);
    const isUnlocked = !isPrivate || Boolean(getUnlockToken(cat));

    const chip = document.createElement("div");
    chip.className = "chip" + (activeCategory === cat ? " active" : "");
    chip.innerHTML = isPrivate ? `${ICONS.lock} ${escapeHtml(cat)}` : escapeHtml(cat);
    chip.addEventListener("click", () => {
      if (isPrivate && !isUnlocked) {
        openUnlockModal(cat);
        return;
      }
      activeCategory = activeCategory === cat ? null : cat;
      renderCategories();
      renderGrid();
    });
    wrap.appendChild(chip);

    if (isUnlocked) {
      const addBtn = document.createElement("button");
      addBtn.className = "chip-add";
      addBtn.title = `Add videos to "${cat}"`;
      addBtn.textContent = "+";
      addBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        startAssignMode(cat);
      });
      wrap.appendChild(addBtn);
    }

    const lockBtn = document.createElement("button");
    lockBtn.className = "chip-add";
    lockBtn.title = isPrivate ? `Manage privacy for "${cat}"` : `Make "${cat}" private`;
    lockBtn.innerHTML = ICONS.lock;
    lockBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openPrivacyModal(cat);
    });
    wrap.appendChild(lockBtn);

    categoriesEl.appendChild(wrap);
  });
}

let pendingUnlockCategory = null;

function openUnlockModal(category) {
  pendingUnlockCategory = category;
  unlockModalTitle.textContent = `Unlock "${category}"`;
  unlockModalDesc.textContent = "Enter the passcode to view this folder.";
  unlockPasscodeInput.value = "";
  unlockOverlay.classList.add("open");
  unlockPasscodeInput.focus();
}

function closeUnlockModal() {
  unlockOverlay.classList.remove("open");
  pendingUnlockCategory = null;
}

async function submitUnlock() {
  if (!pendingUnlockCategory) return;
  const passcode = unlockPasscodeInput.value;

  try {
    const res = await fetch(`/api/private-folders/${encodeURIComponent(pendingUnlockCategory)}/unlock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode }),
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.error || "Incorrect passcode");

    setUnlockToken(pendingUnlockCategory, data.token);
    activeCategory = pendingUnlockCategory;
    closeUnlockModal();
    await loadLibrary();
  } catch (err) {
    unlockModal.classList.remove("shake");
    void unlockModal.offsetWidth;
    unlockModal.classList.add("shake");
    unlockModalDesc.textContent = err.message;
    unlockPasscodeInput.value = "";
    unlockPasscodeInput.focus();
  }
}

unlockCancelBtn.addEventListener("click", closeUnlockModal);
unlockSubmitBtn.addEventListener("click", submitUnlock);
unlockPasscodeInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") submitUnlock();
  if (e.key === "Escape") closeUnlockModal();
});

let pendingPrivacyCategory = null;

function closePrivacyModal() {
  privacyOverlay.classList.remove("open");
  pendingPrivacyCategory = null;
}

function openPrivacyModal(category) {
  pendingPrivacyCategory = category;
  const isPrivate = privateFolderNames.has(category);
  privacyModalTitle.textContent = `"${category}"`;

  if (!isPrivate) {
    privacyModalBody.innerHTML = `
      <p style="font-size:12px;color:var(--text-dim);margin:0 0 14px">Set a passcode to hide this folder's videos until it's unlocked.</p>
      <div class="privacy-field">
        <label>Passcode (at least 4 characters)</label>
        <input type="password" id="privacy-new-passcode">
      </div>
      <div class="privacy-field">
        <label>Confirm passcode</label>
        <input type="password" id="privacy-confirm-passcode">
      </div>
      <button class="privacy-action-btn" id="privacy-make-private-btn">Make Private</button>
      <div class="privacy-error" id="privacy-error"></div>
    `;
    document.getElementById("privacy-make-private-btn").addEventListener("click", async () => {
      const p1 = document.getElementById("privacy-new-passcode").value;
      const p2 = document.getElementById("privacy-confirm-passcode").value;
      const errorEl = document.getElementById("privacy-error");
      if (p1.length < 4) return (errorEl.textContent = "Passcode must be at least 4 characters");
      if (p1 !== p2) return (errorEl.textContent = "Passcodes don't match");

      try {
        const res = await fetch(`/api/private-folders/${encodeURIComponent(category)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ passcode: p1 }),
        });
        const data = await safeJson(res);
        if (!res.ok) throw new Error(data.error || "Server error");

        privateFolderNames.add(category);

        const unlockRes = await fetch(`/api/private-folders/${encodeURIComponent(category)}/unlock`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ passcode: p1 }),
        });
        const unlockData = await safeJson(unlockRes);
        if (unlockRes.ok) setUnlockToken(category, unlockData.token);

        closePrivacyModal();
        await loadLibrary();
      } catch (err) {
        errorEl.textContent = err.message;
      }
    });
  } else {
    privacyModalBody.innerHTML = `
      <p style="font-size:12px;color:var(--text-dim);margin:0 0 14px">This folder is private.</p>
      <div class="privacy-field">
        <label>Current passcode</label>
        <input type="password" id="privacy-current-passcode">
      </div>
      <div class="privacy-field">
        <label>New passcode</label>
        <input type="password" id="privacy-new-passcode">
      </div>
      <button class="privacy-action-btn" id="privacy-change-btn">Change Passcode</button>
      <div class="privacy-error" id="privacy-change-error"></div>
      <hr style="border:none;border-top:1px solid var(--rule);margin:16px 0">
      <div class="privacy-field">
        <label>Current passcode</label>
        <input type="password" id="privacy-remove-passcode">
      </div>
      <button class="privacy-action-btn danger" id="privacy-remove-btn">Remove Protection</button>
      <div class="privacy-error" id="privacy-remove-error"></div>
    `;

    document.getElementById("privacy-change-btn").addEventListener("click", async () => {
      const currentPasscode = document.getElementById("privacy-current-passcode").value;
      const newPasscode = document.getElementById("privacy-new-passcode").value;
      const errorEl = document.getElementById("privacy-change-error");
      if (newPasscode.length < 4) return (errorEl.textContent = "New passcode must be at least 4 characters");

      try {
        const res = await fetch(`/api/private-folders/${encodeURIComponent(category)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ currentPasscode, newPasscode }),
        });
        const data = await safeJson(res);
        if (!res.ok) throw new Error(data.error || "Server error");
        errorEl.style.color = "var(--teal)";
        errorEl.textContent = "Passcode changed.";
      } catch (err) {
        errorEl.style.color = "";
        errorEl.textContent = err.message;
      }
    });

    document.getElementById("privacy-remove-btn").addEventListener("click", async () => {
      const passcode = document.getElementById("privacy-remove-passcode").value;
      const errorEl = document.getElementById("privacy-remove-error");

      try {
        const res = await fetch(`/api/private-folders/${encodeURIComponent(category)}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ passcode }),
        });
        const data = await safeJson(res);
        if (!res.ok) throw new Error(data.error || "Server error");

        privateFolderNames.delete(category);
        sessionStorage.removeItem(`homeflix-unlock-${category}`);
        closePrivacyModal();
        await loadLibrary();
      } catch (err) {
        errorEl.textContent = err.message;
      }
    });
  }

  privacyOverlay.classList.add("open");
}

privacyCancelBtn.addEventListener("click", closePrivacyModal);
privacyOverlay.addEventListener("click", (e) => {
  if (e.target === privacyOverlay) closePrivacyModal();
});

function startAssignMode(category) {
  assignMode = category;
  activeCategory = null;
  searchInput.value = "";
  searchTerm = "";
  assignCategoryName.textContent = category;
  assignBanner.classList.add("active");
  renderCategories();
  renderGrid();
}

function stopAssignMode() {
  assignMode = null;
  assignBanner.classList.remove("active");
  renderGrid();
}

async function toggleAssignMembership(video) {
  const has = video.tags.includes(assignMode);
  const newTags = has ? video.tags.filter((t) => t !== assignMode) : [...video.tags, assignMode];

  try {
    const res = await fetch(`/api/videos/${encodeURIComponent(video.filename)}/tags`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags: newTags }),
    });
    if (!res.ok) throw new Error("Server error " + res.status);
    video.tags = newTags;
    renderGrid();
  } catch (err) {
    alert("Couldn't update category: " + err.message);
  }
}

assignDoneBtn.addEventListener("click", stopAssignMode);

async function deleteVideo(video) {
  const confirmed = confirm(`Delete "${video.title}" from the server? This can't be undone.`);
  if (!confirmed) return;

  try {
    const res = await fetch(`/api/videos/${encodeURIComponent(video.filename)}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Server error " + res.status);
    loadLibrary();
  } catch (err) {
    alert("Couldn't delete video: " + err.message);
  }
}

function getVisibleVideos() {
  return allVideos.filter((v) => {
    const matchesCategory = !activeCategory || v.tags.includes(activeCategory);
    const matchesSearch = !searchTerm || v.title.toLowerCase().includes(searchTerm);
    return matchesCategory && matchesSearch;
  });
}

function renderGrid() {
  const visible = getVisibleVideos();

  if (allVideos.length === 0) {
    status.style.display = "block";
    status.textContent = "No videos found. Check that VIDEO_DIR points at a folder with .mp4/.mkv/.webm/.mov files.";
    grid.innerHTML = "";
    return;
  }

  if (visible.length === 0) {
    status.style.display = "block";
    status.textContent = "Nothing matches that search / category.";
    grid.innerHTML = "";
    return;
  }

  status.style.display = "none";
  grid.innerHTML = "";

  visible.forEach((v) => {
    const card = document.createElement("div");
    card.className = "card" + (assignMode && v.tags.includes(assignMode) ? " assign-member" : "");
    card.tabIndex = 0;
    card.dataset.filename = v.filename;

    const badgeTag = v.tags[0];
    const extraTagsHtml = v.tags.slice(1).map((t) => `<span class="tag-pill">${escapeHtml(t)}</span>`).join("");
    const thumbStyle = v.hasThumbnail
      ? ` style="background-image: url('${withTokens("/thumbnail/" + encodeURIComponent(v.filename))}')"`
      : "";
    const progressPct = v.progress && v.progress.duration > 0
      ? Math.min(100, Math.round((v.progress.position / v.progress.duration) * 100))
      : 0;

    card.innerHTML = `
      <button class="delete-btn" title="Delete video">${ICONS.close}</button>
      <div class="assign-check">${ICONS.check}</div>
      <div class="card-thumb"${thumbStyle}>
        ${v.hasThumbnail ? "" : `<span class="play-icon">${v.kind === "audio" ? ICONS.musicNote : ICONS.play}</span>`}
        <div class="card-thumb-overlay">
          ${badgeTag ? `<span class="card-badge">${escapeHtml(badgeTag)}</span>` : ""}
          <div class="card-thumb-title">${escapeHtml(v.title)}</div>
        </div>
        ${progressPct > 0 ? `<div class="progress-track"><div class="progress-fill" style="width:${progressPct}%"></div></div>` : ""}
      </div>
      <div class="card-body">
        <div class="card-meta">
          <span>${formatSize(v.sizeBytes)}</span>
          <button class="edit-tags-btn" title="Edit categories">${ICONS.edit} edit</button>
        </div>
        ${extraTagsHtml ? `<div class="card-tags">${extraTagsHtml}</div>` : ""}
      </div>
    `;

    card.addEventListener("click", (e) => {
      if (e.target.closest(".edit-tags-btn") || e.target.closest(".delete-btn")) return;
      if (assignMode) {
        toggleAssignMembership(v);
      } else {
        openPlayer(v);
      }
    });
    card.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      if (assignMode) toggleAssignMembership(v);
      else openPlayer(v);
    });

    card.querySelector(".edit-tags-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      openTagEditor(v);
    });

    card.querySelector(".delete-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      deleteVideo(v);
    });

    grid.appendChild(card);
  });

  resetGamepadFocus();
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

searchInput.addEventListener("input", () => {
  searchTerm = searchInput.value.trim().toLowerCase();
  renderGrid();
});

function refreshThumbPreview(video) {
  if (video.hasThumbnail) {
    thumbPreviewImg.src = withTokens(`/thumbnail/${encodeURIComponent(video.filename)}`) + `&t=${Date.now()}`;
    thumbPreviewImg.classList.add("visible");
    thumbPreviewEmpty.classList.add("hidden");
    thumbRemoveBtn.style.display = "";
  } else {
    thumbPreviewImg.classList.remove("visible");
    thumbPreviewImg.removeAttribute("src");
    thumbPreviewEmpty.classList.remove("hidden");
    thumbRemoveBtn.style.display = "none";
  }
}

function openTagEditor(video) {
  editingFilename = video.filename;
  const dot = video.filename.lastIndexOf(".");
  editingExt = dot >= 0 ? video.filename.slice(dot) : "";
  const base = dot >= 0 ? video.filename.slice(0, dot) : video.filename;

  tagModalTitle.textContent = video.title;
  nameInput.value = base;
  nameExt.textContent = editingExt;
  tagInput.value = video.tags.join(", ");
  thumbSearchResults.innerHTML = "";
  refreshThumbPreview(video);
  tagModalOverlay.classList.add("open");
  nameInput.focus();
  nameInput.select();
}

function closeTagEditor() {
  tagModalOverlay.classList.remove("open");
  editingFilename = null;
  editingExt = "";
  thumbSearchResults.innerHTML = "";
}

async function saveTagEditor() {
  if (!editingFilename) return;

  const newBase = nameInput.value.trim();
  if (!newBase) {
    alert("File name can't be empty.");
    return;
  }

  let currentFilename = editingFilename;

  if (newBase !== editingFilename.slice(0, editingFilename.length - editingExt.length)) {
    try {
      const res = await fetch(`/api/videos/${encodeURIComponent(editingFilename)}/rename`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newName: newBase }),
      });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data.error || "Server error " + res.status);
      currentFilename = data.newFilename;
    } catch (err) {
      alert("Couldn't rename file: " + err.message);
      return;
    }
  }

  const tags = tagInput.value
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  try {
    const res = await fetch(`/api/videos/${encodeURIComponent(currentFilename)}/tags`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags }),
    });
    if (!res.ok) throw new Error("Server error " + res.status);
    closeTagEditor();
    loadLibrary();
  } catch (err) {
    alert("Couldn't save categories: " + err.message);
  }
}

tagCancelBtn.addEventListener("click", closeTagEditor);
tagSaveBtn.addEventListener("click", saveTagEditor);
tagInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") saveTagEditor();
  if (e.key === "Escape") closeTagEditor();
});

nameInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") saveTagEditor();
  if (e.key === "Escape") closeTagEditor();
});

thumbUploadBtn.addEventListener("click", () => thumbFileInput.click());

thumbFileInput.addEventListener("change", async () => {
  const file = thumbFileInput.files[0];
  thumbFileInput.value = "";
  if (!file || !editingFilename) return;

  const formData = new FormData();
  formData.append("thumbnail", file);

  try {
    const res = await fetch(`/api/videos/${encodeURIComponent(editingFilename)}/thumbnail`, {
      method: "POST",
      body: formData,
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.error || "Server error " + res.status);
    refreshThumbPreview({ filename: editingFilename, hasThumbnail: true });
    loadLibrary();
  } catch (err) {
    alert("Couldn't upload thumbnail: " + err.message);
  }
});

thumbRemoveBtn.addEventListener("click", async () => {
  if (!editingFilename) return;
  try {
    const res = await fetch(`/api/videos/${encodeURIComponent(editingFilename)}/thumbnail`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("Server error " + res.status);
    refreshThumbPreview({ filename: editingFilename, hasThumbnail: false });
    loadLibrary();
  } catch (err) {
    alert("Couldn't remove thumbnail: " + err.message);
  }
});

thumbSearchBtn.addEventListener("click", async () => {
  if (!editingFilename || !posterSearchEnabled) return;
  const query = nameInput.value.trim() || tagModalTitle.textContent;

  thumbSearchResults.innerHTML = `<span style="font-size:12px;color:var(--text-dim)">Searching…</span>`;

  try {
    const res = await fetch(`/api/videos/${encodeURIComponent(editingFilename)}/poster-search?title=${encodeURIComponent(query)}`);
    const results = await safeJson(res);
    if (!res.ok) throw new Error(results.error || "Search failed");

    if (results.length === 0) {
      thumbSearchResults.innerHTML = `<span style="font-size:12px;color:var(--text-dim)">No posters found</span>`;
      return;
    }

    thumbSearchResults.innerHTML = "";
    results.forEach((r) => {
      const img = document.createElement("img");
      img.src = r.posterUrl;
      img.title = r.year ? `${r.title} (${r.year})` : r.title;
      img.addEventListener("click", () => choosePoster(r.posterUrl));
      thumbSearchResults.appendChild(img);
    });
  } catch (err) {
    thumbSearchResults.innerHTML = `<span style="font-size:12px;color:var(--text-dim)">${escapeHtml(err.message)}</span>`;
  }
});

async function choosePoster(url) {
  if (!editingFilename) return;
  try {
    const res = await fetch(`/api/videos/${encodeURIComponent(editingFilename)}/thumbnail-from-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.error || "Server error " + res.status);
    thumbSearchResults.innerHTML = "";
    refreshThumbPreview({ filename: editingFilename, hasThumbnail: true });
    loadLibrary();
  } catch (err) {
    alert("Couldn't save that poster: " + err.message);
  }
}

uploadBtn.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", () => {
  uploadFiles(fileInput.files);
  fileInput.value = "";
});

let dragCounter = 0;

window.addEventListener("dragenter", (e) => {
  e.preventDefault();
  dragCounter++;
  dropzone.classList.add("active");
});

window.addEventListener("dragover", (e) => e.preventDefault());

window.addEventListener("dragleave", (e) => {
  e.preventDefault();
  dragCounter--;
  if (dragCounter <= 0) {
    dragCounter = 0;
    dropzone.classList.remove("active");
  }
});

window.addEventListener("drop", (e) => {
  e.preventDefault();
  dragCounter = 0;
  dropzone.classList.remove("active");
  if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
});

function uploadFiles(fileList) {
  Array.from(fileList).forEach(uploadOne);
}

function uploadOne(file) {
  const row = document.createElement("div");
  row.className = "upload-row";
  row.innerHTML = `
    <div class="name"><span>${escapeHtml(file.name)}</span><span class="pct">0%</span></div>
    <div class="bar-track"><div class="bar-fill"></div></div>
  `;
  uploadsList.appendChild(row);

  const pctEl = row.querySelector(".pct");
  const barEl = row.querySelector(".bar-fill");

  const formData = new FormData();
  formData.append("video", file);

  const xhr = new XMLHttpRequest();
  xhr.open("POST", "/api/upload");

  xhr.upload.addEventListener("progress", (e) => {
    if (!e.lengthComputable) return;
    const pct = Math.round((e.loaded / e.total) * 100);
    barEl.style.width = pct + "%";
    pctEl.textContent = pct + "%";
  });

  xhr.addEventListener("load", () => {
    if (xhr.status >= 200 && xhr.status < 300) {
      pctEl.textContent = "done";
      setTimeout(() => {
        row.remove();
        loadLibrary();
      }, 600);
    } else {
      handleUploadError(row, xhr.responseText);
    }
  });

  xhr.addEventListener("error", () => handleUploadError(row, "Network error"));

  xhr.send(formData);
}

function handleUploadError(row, message) {
  row.classList.add("error");
  let text = message;
  try {
    text = JSON.parse(message).error || message;
  } catch (_) {}
  row.querySelector(".pct").textContent = "failed";
  row.querySelector(".name span").title = text;
}

function isMusicMode(video) {
  if (video.kind === "audio") return true;
  return video.tags.some((t) => t.toLowerCase() === "music");
}

videoEl.addEventListener("waiting", () => bufferSpinner.classList.add("active"));
videoEl.addEventListener("loadstart", () => bufferSpinner.classList.add("active"));
videoEl.addEventListener("playing", () => bufferSpinner.classList.remove("active"));
videoEl.addEventListener("canplay", () => bufferSpinner.classList.remove("active"));
videoEl.addEventListener("error", () => {
  const code = videoEl.error ? videoEl.error.code : "unknown";
  debugLog(`Video playback error (code ${code}) for ${videoEl.src}`, "error");
});

audioEl.addEventListener("waiting", () => musicSpinner.classList.add("active"));
audioEl.addEventListener("loadstart", () => musicSpinner.classList.add("active"));
audioEl.addEventListener("playing", () => musicSpinner.classList.remove("active"));
audioEl.addEventListener("canplay", () => musicSpinner.classList.remove("active"));
audioEl.addEventListener("error", () => {
  const code = audioEl.error ? audioEl.error.code : "unknown";
  debugLog(`Audio playback error (code ${code}) for ${audioEl.src}`, "error");
});

function updateMediaSession(video) {
  if (!("mediaSession" in navigator)) return;

  navigator.mediaSession.metadata = new MediaMetadata({
    title: video.title,
    artist: "Lan flix",
    album: video.tags[0] || "",
  });

  navigator.mediaSession.setActionHandler("play", () => {
    const activeMedia = musicPlayer.classList.contains("open") ? audioEl : videoEl;
    activeMedia.play();
  });
  navigator.mediaSession.setActionHandler("pause", () => {
    const activeMedia = musicPlayer.classList.contains("open") ? audioEl : videoEl;
    activeMedia.pause();
  });
  navigator.mediaSession.setActionHandler("stop", () => closePlayer());
}

function clearMediaSession() {
  if (!("mediaSession" in navigator)) return;
  navigator.mediaSession.metadata = null;
  navigator.mediaSession.setActionHandler("play", null);
  navigator.mediaSession.setActionHandler("pause", null);
  navigator.mediaSession.setActionHandler("stop", null);
}

let currentPlayingVideo = null;
let lastProgressSaveTime = 0;
const restartBtn = document.getElementById("restart-btn");

function saveProgressToServer(video, position, duration) {
  if (!Number.isFinite(position)) return;
  fetch(`/api/videos/${encodeURIComponent(video.filename)}/progress`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ position, duration: Number.isFinite(duration) ? duration : 0 }),
  }).catch((err) => debugLog(`Could not save progress: ${err.message}`, "error"));
}

function handleTimeUpdate(mediaEl) {
  if (!currentPlayingVideo) return;
  const now = Date.now();
  if (now - lastProgressSaveTime < 5000) return;
  lastProgressSaveTime = now;
  saveProgressToServer(currentPlayingVideo, mediaEl.currentTime, mediaEl.duration);
}

videoEl.addEventListener("timeupdate", () => handleTimeUpdate(videoEl));
audioEl.addEventListener("timeupdate", () => handleTimeUpdate(audioEl));
videoEl.addEventListener("pause", () => {
  if (currentPlayingVideo) saveProgressToServer(currentPlayingVideo, videoEl.currentTime, videoEl.duration);
});
audioEl.addEventListener("pause", () => {
  if (currentPlayingVideo) saveProgressToServer(currentPlayingVideo, audioEl.currentTime, audioEl.duration);
});

window.addEventListener("pagehide", () => {
  if (!currentPlayingVideo) return;
  const activeMedia = musicPlayer.classList.contains("open") ? audioEl : videoEl;
  if (!Number.isFinite(activeMedia.currentTime)) return;
  const payload = JSON.stringify({
    position: activeMedia.currentTime,
    duration: Number.isFinite(activeMedia.duration) ? activeMedia.duration : 0,
  });
  navigator.sendBeacon(
    `/api/videos/${encodeURIComponent(currentPlayingVideo.filename)}/progress`,
    new Blob([payload], { type: "application/json" })
  );
});

restartBtn.addEventListener("click", () => {
  const activeMedia = musicPlayer.classList.contains("open") ? audioEl : videoEl;
  activeMedia.currentTime = 0;
  restartBtn.style.display = "none";
  if (currentPlayingVideo) saveProgressToServer(currentPlayingVideo, 0, activeMedia.duration);
  debugLog(`Restarted "${currentPlayingVideo ? currentPlayingVideo.title : ""}" from the beginning`);
});

function attachResumeSeek(video, activeMedia) {
  activeMedia.addEventListener(
    "loadedmetadata",
    function seekResume() {
      const p = video.progress;
      if (p && p.position > 5 && p.duration > 0 && p.position < activeMedia.duration - 10) {
        activeMedia.currentTime = p.position;
        restartBtn.style.display = "";
        debugLog(`Resumed "${video.title}" at ${Math.round(p.position)}s`);
      }
    },
    { once: true }
  );
}

function openPlayer(video) {
  playerTitle.textContent = video.title;
  currentPlayingVideo = video;
  lastProgressSaveTime = 0;
  restartBtn.style.display = "none";

  if (isMusicMode(video)) {
    videoEl.pause();
    videoEl.removeAttribute("src");
    videoEl.style.display = "none";
    musicPlayer.classList.add("open");

    attachResumeSeek(video, audioEl);
    audioEl.src = getStreamUrl(video);
    overlay.classList.add("open");
    audioEl.play();
    updateMediaSession(video);

    if (getBackgroundPlaySetting()) {
      stopVisualizer();
      backgroundBadge.classList.add("active");
    } else {
      backgroundBadge.classList.remove("active");
      startVisualizer();
    }
  } else {
    audioEl.pause();
    audioEl.removeAttribute("src");
    musicPlayer.classList.remove("open");
    backgroundBadge.classList.remove("active");
    videoEl.style.display = "";

    attachResumeSeek(video, videoEl);
    videoEl.src = getStreamUrl(video);
    overlay.classList.add("open");
    videoEl.play();
    stopVisualizer();
    updateMediaSession(video);
  }
}

function closePlayer() {
  if (currentPlayingVideo) {
    const activeMedia = musicPlayer.classList.contains("open") ? audioEl : videoEl;
    saveProgressToServer(currentPlayingVideo, activeMedia.currentTime, activeMedia.duration);
  }

  videoEl.pause();
  videoEl.removeAttribute("src");
  videoEl.load();

  audioEl.pause();
  audioEl.removeAttribute("src");

  overlay.classList.remove("open");
  musicPlayer.classList.remove("open");
  backgroundBadge.classList.remove("active");
  videoEl.style.display = "";
  stopVisualizer();
  clearMediaSession();
  bufferSpinner.classList.remove("active");
  musicSpinner.classList.remove("active");
  restartBtn.style.display = "none";
  currentPlayingVideo = null;
  loadLibrary();
}

closeBtn.addEventListener("click", closePlayer);
document.addEventListener("keydown", (e) => {
  if (!overlay.classList.contains("open")) return;
  const typing = document.activeElement && ["INPUT", "TEXTAREA"].includes(document.activeElement.tagName);
  if (typing) return;

  if (e.key === "Escape") closePlayer();

  if (e.key === " ") {
    e.preventDefault();
    const activeMedia = musicPlayer.classList.contains("open") ? audioEl : videoEl;
    if (activeMedia.paused) activeMedia.play(); else activeMedia.pause();
  }
});

let audioCtx = null;
let analyser = null;
let sourceNode = null;
let visualizerFrame = null;

function ensureAudioGraph() {
  if (sourceNode) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  sourceNode = audioCtx.createMediaElementSource(audioEl);
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 128;
  sourceNode.connect(analyser);
  analyser.connect(audioCtx.destination);
}

function startVisualizer() {
  ensureAudioGraph();
  if (audioCtx.state === "suspended") audioCtx.resume();

  const dpr = window.devicePixelRatio || 1;
  const cssWidth = visualizerCanvas.clientWidth || 720;
  const cssHeight = visualizerCanvas.clientHeight || 200;
  visualizerCanvas.width = cssWidth * dpr;
  visualizerCanvas.height = cssHeight * dpr;
  const ctx = visualizerCanvas.getContext("2d");
  ctx.scale(dpr, dpr);

  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);

  const rootStyles = getComputedStyle(document.documentElement);
  const colorBottom = rootStyles.getPropertyValue("--blue").trim() || "#3b82f6";
  const colorMid = rootStyles.getPropertyValue("--teal").trim() || "#2dd4c8";
  const colorTop = rootStyles.getPropertyValue("--glow-a").trim() || "#8b5cf6";

  function draw() {
    visualizerFrame = requestAnimationFrame(draw);
    analyser.getByteFrequencyData(dataArray);

    ctx.clearRect(0, 0, cssWidth, cssHeight);

    const barCount = bufferLength;
    const gap = 3;
    const barWidth = (cssWidth - gap * (barCount - 1)) / barCount;

    for (let i = 0; i < barCount; i++) {
      const value = dataArray[i] / 255;
      const barHeight = Math.max(3, value * cssHeight);
      const x = i * (barWidth + gap);
      const y = cssHeight - barHeight;

      const gradient = ctx.createLinearGradient(0, cssHeight, 0, 0);
      gradient.addColorStop(0, colorBottom);
      gradient.addColorStop(0.55, colorMid);
      gradient.addColorStop(1, colorTop);

      ctx.fillStyle = gradient;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(x, y, barWidth, barHeight, 3);
      } else {
        ctx.rect(x, y, barWidth, barHeight);
      }
      ctx.fill();
    }
  }

  draw();
}

function stopVisualizer() {
  if (visualizerFrame) {
    cancelAnimationFrame(visualizerFrame);
    visualizerFrame = null;
  }
}

const GAMEPAD_ACTIONS = [
  { key: "confirm", label: "Confirm / Select" },
  { key: "back", label: "Back / Cancel" },
  { key: "categoryPrev", label: "Previous category" },
  { key: "categoryNext", label: "Next category" },
  { key: "menu", label: "Open Settings" },
  { key: "search", label: "Jump to search" },
];

const DEFAULT_GAMEPAD_MAP = {
  confirm: 0,
  back: 1,
  categoryPrev: 4,
  categoryNext: 5,
  menu: 9,
  search: 3,
};

const BUTTON_NAMES = {
  0: "A / Cross",
  1: "B / Circle",
  2: "X / Square",
  3: "Y / Triangle",
  4: "LB / L1",
  5: "RB / R1",
  6: "LT / L2",
  7: "RT / R2",
  8: "Back / Select",
  9: "Start / Options",
  10: "L3 (stick click)",
  11: "R3 (stick click)",
  12: "D-pad Up",
  13: "D-pad Down",
  14: "D-pad Left",
  15: "D-pad Right",
  16: "Home / Guide",
};

function buttonName(index) {
  return BUTTON_NAMES[index] || `Button ${index}`;
}

function getGamepadMap() {
  try {
    return { ...DEFAULT_GAMEPAD_MAP, ...JSON.parse(localStorage.getItem("homeflix-gamepad-map")) };
  } catch {
    return { ...DEFAULT_GAMEPAD_MAP };
  }
}

function setGamepadMapAction(actionKey, buttonIndex) {
  const map = getGamepadMap();
  map[actionKey] = buttonIndex;
  localStorage.setItem("homeflix-gamepad-map", JSON.stringify(map));
}

let remapListening = null;

function renderControllerMap() {
  const map = getGamepadMap();
  controllerMapList.innerHTML = "";

  GAMEPAD_ACTIONS.forEach((action) => {
    const row = document.createElement("div");
    row.className = "controller-row";

    const isListening = remapListening === action.key;
    row.innerHTML = `
      <div>
        <div class="controller-label">${action.label}</div>
        <div class="controller-value">${isListening ? "Press a button…" : buttonName(map[action.key])}</div>
      </div>
      <button class="controller-remap-btn${isListening ? " listening" : ""}" type="button">${isListening ? "Waiting…" : "Remap"}</button>
    `;

    row.querySelector("button").addEventListener("click", () => {
      remapListening = action.key;
      renderControllerMap();
    });

    controllerMapList.appendChild(row);
  });
}

let gamepadFocusIndex = 0;
let gamepadConnected = false;
const buttonState = {};

function resetGamepadFocus() {
  gamepadFocusIndex = 0;
  updateGamepadFocusVisual();
}

function getCardEls() {
  return Array.from(grid.querySelectorAll(".card"));
}

function updateGamepadFocusVisual() {
  const cards = getCardEls();
  cards.forEach((c) => c.classList.remove("gamepad-focus"));
  if (!gamepadConnected || cards.length === 0) return;
  gamepadFocusIndex = Math.max(0, Math.min(gamepadFocusIndex, cards.length - 1));
  const el = cards[gamepadFocusIndex];
  el.classList.add("gamepad-focus");
  el.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

function getColumnCount() {
  const style = getComputedStyle(grid);
  return style.gridTemplateColumns.split(" ").filter(Boolean).length || 1;
}

function moveGamepadFocus(dx, dy) {
  const cards = getCardEls();
  if (cards.length === 0) return;
  const cols = getColumnCount();
  let next = gamepadFocusIndex + dx + dy * cols;
  next = Math.max(0, Math.min(next, cards.length - 1));
  gamepadFocusIndex = next;
  updateGamepadFocusVisual();
}

function cycleCategory(direction) {
  const chips = Array.from(categoriesEl.children);
  if (chips.length === 0) return;
  const currentIndex = chips.findIndex((c) => c.classList.contains("active"));
  let next = currentIndex + direction;
  if (next < 0) next = chips.length - 1;
  if (next >= chips.length) next = 0;
  chips[next].click();
}

function buttonPressed(index, pressed, now) {
  const state = buttonState[index] || { held: false, nextRepeat: 0 };
  let fire = false;

  if (pressed && !state.held) {
    fire = true;
    state.nextRepeat = now + 380;
  } else if (pressed && state.held && now >= state.nextRepeat) {
    fire = true;
    state.nextRepeat = now + 140;
  }

  state.held = pressed;
  buttonState[index] = state;
  return fire;
}

function getActiveModalEl() {
  if (unlockOverlay.classList.contains("open")) return unlockModal;
  if (privacyOverlay.classList.contains("open")) return document.getElementById("privacy-modal");
  if (settingsOverlay.classList.contains("open")) return document.getElementById("settings-modal");
  if (tagModalOverlay.classList.contains("open")) return document.getElementById("tag-modal");
  return null;
}

function getModalFocusables(root) {
  return Array.from(root.querySelectorAll('button, input, [tabindex]:not([tabindex="-1"])')).filter(
    (el) => el.offsetParent !== null && !el.disabled
  );
}

let modalFocusIndex = 0;
let lastActiveModalEl = null;

function closeActiveModal(modalEl) {
  if (modalEl.id === "unlock-modal") closeUnlockModal();
  else if (modalEl.id === "privacy-modal") closePrivacyModal();
  else if (modalEl.id === "settings-modal") settingsOverlay.classList.remove("open");
  else if (modalEl.id === "tag-modal") closeTagEditor();
}

function pollGamepad() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  const pad = pads && pads[0];

  if (pad) {
    if (!gamepadConnected) {
      gamepadConnected = true;
      gamepadIndicator.classList.add("connected");
      resetGamepadFocus();
    }

    const now = performance.now();
    const map = getGamepadMap();

    if (remapListening) {
      for (let i = 0; i < pad.buttons.length; i++) {
        if (pad.buttons[i].pressed && buttonPressed("remap-" + i, true, now)) {
          setGamepadMapAction(remapListening, i);
          remapListening = null;
          renderControllerMap();
          break;
        }
      }
      requestAnimationFrame(pollGamepad);
      return;
    }

    const up = pad.buttons[12] && pad.buttons[12].pressed;
    const down = pad.buttons[13] && pad.buttons[13].pressed;
    const left = pad.buttons[14] && pad.buttons[14].pressed;
    const right = pad.buttons[15] && pad.buttons[15].pressed;
    const stickX = pad.axes[0] || 0;
    const stickY = pad.axes[1] || 0;
    const deadzone = 0.5;

    const dirUp = up || stickY < -deadzone;
    const dirDown = down || stickY > deadzone;
    const dirLeft = left || stickX < -deadzone;
    const dirRight = right || stickX > deadzone;

    const confirmBtn = pad.buttons[map.confirm] && pad.buttons[map.confirm].pressed;
    const backBtn = pad.buttons[map.back] && pad.buttons[map.back].pressed;
    const prevBtn = pad.buttons[map.categoryPrev] && pad.buttons[map.categoryPrev].pressed;
    const nextBtn = pad.buttons[map.categoryNext] && pad.buttons[map.categoryNext].pressed;
    const menuBtn = pad.buttons[map.menu] && pad.buttons[map.menu].pressed;
    const searchBtn = pad.buttons[map.search] && pad.buttons[map.search].pressed;

    const activeModalEl = getActiveModalEl();
    const isPlayerOpen = overlay.classList.contains("open");

    if (activeModalEl) {
      if (activeModalEl !== lastActiveModalEl) {
        modalFocusIndex = 0;
        lastActiveModalEl = activeModalEl;
      }

      const focusables = getModalFocusables(activeModalEl);
      focusables.forEach((el) => el.classList.remove("gamepad-focus"));

      if (focusables.length > 0) {
        modalFocusIndex = ((modalFocusIndex % focusables.length) + focusables.length) % focusables.length;
        focusables[modalFocusIndex].classList.add("gamepad-focus");
        focusables[modalFocusIndex].scrollIntoView({ block: "nearest" });

        if (buttonPressed("modal-down", dirDown || dirRight, now)) {
          modalFocusIndex = (modalFocusIndex + 1) % focusables.length;
        }
        if (buttonPressed("modal-up", dirUp || dirLeft, now)) {
          modalFocusIndex = (modalFocusIndex - 1 + focusables.length) % focusables.length;
        }
        if (buttonPressed("modal-confirm", confirmBtn, now)) {
          const el = focusables[modalFocusIndex];
          if (el.tagName === "INPUT") el.focus();
          else el.click();
        }
      }

      if (buttonPressed("modal-back", backBtn, now)) {
        closeActiveModal(activeModalEl);
      }
    } else if (isPlayerOpen) {
      const activeMedia = musicPlayer.classList.contains("open") ? audioEl : videoEl;
      if (buttonPressed("player-back", backBtn, now)) closePlayer();
      if (buttonPressed("player-confirm", confirmBtn, now)) {
        if (activeMedia.paused) activeMedia.play(); else activeMedia.pause();
      }
      if (buttonPressed("player-left", dirLeft, now)) activeMedia.currentTime = Math.max(0, activeMedia.currentTime - 10);
      if (buttonPressed("player-right", dirRight, now)) activeMedia.currentTime += 10;
      if (buttonPressed("player-up", dirUp, now)) activeMedia.volume = Math.min(1, activeMedia.volume + 0.1);
      if (buttonPressed("player-down", dirDown, now)) activeMedia.volume = Math.max(0, activeMedia.volume - 0.1);
    } else {
      if (assignMode && buttonPressed("grid-back", backBtn, now)) stopAssignMode();

      if (buttonPressed("grid-up", dirUp, now)) moveGamepadFocus(0, -1);
      if (buttonPressed("grid-down", dirDown, now)) moveGamepadFocus(0, 1);
      if (buttonPressed("grid-left", dirLeft, now)) moveGamepadFocus(-1, 0);
      if (buttonPressed("grid-right", dirRight, now)) moveGamepadFocus(1, 0);
      if (buttonPressed("grid-confirm", confirmBtn, now)) {
        const cards = getCardEls();
        const card = cards[gamepadFocusIndex];
        if (card) {
          const video = allVideos.find((v) => v.filename === card.dataset.filename);
          if (video) {
            if (assignMode) toggleAssignMembership(video);
            else openPlayer(video);
          }
        }
      }
      if (buttonPressed("grid-prev", prevBtn, now)) cycleCategory(-1);
      if (buttonPressed("grid-next", nextBtn, now)) cycleCategory(1);
      if (buttonPressed("grid-menu", menuBtn, now)) settingsBtn.click();
      if (buttonPressed("grid-search", searchBtn, now)) searchInput.focus();
    }
  } else if (gamepadConnected) {
    gamepadConnected = false;
    gamepadIndicator.classList.remove("connected");
    getCardEls().forEach((c) => c.classList.remove("gamepad-focus"));
  }

  requestAnimationFrame(pollGamepad);
}

window.addEventListener("gamepadconnected", (e) => {
  gamepadConnected = true;
  gamepadIndicator.classList.add("connected");
  resetGamepadFocus();
  debugLog(`Controller connected: ${e.gamepad.id}`, "ok");
});

window.addEventListener("gamepaddisconnected", () => {
  gamepadConnected = false;
  gamepadIndicator.classList.remove("connected");
  debugLog(`Controller disconnected`);
});

document.documentElement.setAttribute("data-theme", getCurrentTheme());

requestAnimationFrame(pollGamepad);

refreshTmdbStatus();
loadPrivateFolderList();
loadLibrary();

refreshCacheNodes();
setInterval(refreshCacheNodes, 30 * 1000);

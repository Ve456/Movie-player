const express = require("express");
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const multer = require("multer");
const archiver = require("archiver");
const { Bonjour } = require("bonjour-service");

const app = express();
const PORT = process.env.PORT || 8000;
const VIDEO_DIR = process.env.VIDEO_DIR || path.join(__dirname, "videos");
const TAGS_FILE = path.join(VIDEO_DIR, ".homeflix-tags.json");
const THUMBS_DIR = path.join(VIDEO_DIR, ".homeflix-thumbnails");
const THUMBS_FILE = path.join(VIDEO_DIR, ".homeflix-thumbnails.json");
const PROGRESS_FILE = path.join(VIDEO_DIR, ".homeflix-progress.json");
const CONFIG_FILE = path.join(VIDEO_DIR, ".homeflix-config.json");
const PRIVATE_FILE = path.join(VIDEO_DIR, ".homeflix-private.json");
const SECRET_FILE = path.join(VIDEO_DIR, ".homeflix-secret");
const CACHE_SECRET_FILE = path.join(VIDEO_DIR, ".homeflix-cache-secret");
const DOWNLOADS_DIR = path.join(__dirname, "downloads");

const VIDEO_EXTENSIONS = new Set([".mp4", ".webm", ".mkv", ".mov", ".m4v"]);
const AUDIO_EXTENSIONS = new Set([".mp3", ".wav", ".flac", ".m4a", ".ogg", ".aac"]);
const MEDIA_EXTENSIONS = new Set([...VIDEO_EXTENSIONS, ...AUDIO_EXTENSIONS]);

app.use(express.json());

fs.mkdirSync(VIDEO_DIR, { recursive: true });
fs.mkdirSync(THUMBS_DIR, { recursive: true });

function loadTags() {
  try {
    return JSON.parse(fs.readFileSync(TAGS_FILE, "utf8"));
  } catch {
    return {};
  }
}

function saveTags(tags) {
  fs.writeFileSync(TAGS_FILE, JSON.stringify(tags, null, 2));
}

function loadThumbs() {
  try {
    return JSON.parse(fs.readFileSync(THUMBS_FILE, "utf8"));
  } catch {
    return {};
  }
}

function saveThumbs(thumbs) {
  fs.writeFileSync(THUMBS_FILE, JSON.stringify(thumbs, null, 2));
}

function loadProgress() {
  try {
    return JSON.parse(fs.readFileSync(PROGRESS_FILE, "utf8"));
  } catch {
    return {};
  }
}

function saveProgress(progress) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

function deleteThumbFile(storedName) {
  if (!storedName) return;
  const p = path.join(THUMBS_DIR, storedName);
  fs.unlink(p, () => {});
}

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
  } catch {
    return {};
  }
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

function getTmdbKey() {
  const config = loadConfig();
  return config.tmdbApiKey || process.env.TMDB_API_KEY || "";
}

function loadPrivate() {
  try {
    return JSON.parse(fs.readFileSync(PRIVATE_FILE, "utf8"));
  } catch {
    return {};
  }
}

function savePrivate(data) {
  fs.writeFileSync(PRIVATE_FILE, JSON.stringify(data, null, 2));
}

function getSecret() {
  try {
    return fs.readFileSync(SECRET_FILE, "utf8").trim();
  } catch {
    const secret = crypto.randomBytes(32).toString("hex");
    fs.writeFileSync(SECRET_FILE, secret);
    return secret;
  }
}

function getCacheSecret() {
  try {
    return fs.readFileSync(CACHE_SECRET_FILE, "utf8").trim();
  } catch {
    const secret = crypto.randomBytes(24).toString("hex");
    fs.writeFileSync(CACHE_SECRET_FILE, secret);
    return secret;
  }
}

let libraryVersion = Date.now();

function bumpLibraryVersion() {
  libraryVersion = Date.now();
}

const cacheNodes = new Map();
const CACHE_NODE_TIMEOUT_MS = 45 * 1000;

function registerCacheNode(id, address, port) {
  cacheNodes.set(id, { id, address, port, lastSeen: Date.now() });
}

function getLiveCacheNodes() {
  const now = Date.now();
  for (const [id, node] of cacheNodes) {
    if (now - node.lastSeen > CACHE_NODE_TIMEOUT_MS) cacheNodes.delete(id);
  }
  return [...cacheNodes.values()];
}

function hashPasscode(passcode, salt) {
  return crypto.scryptSync(passcode, salt, 64).toString("hex");
}

function verifyPasscode(category, passcode) {
  const store = loadPrivate();
  const entry = store[category];
  if (!entry) return false;
  const hash = hashPasscode(passcode, entry.salt);
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(entry.hash, "hex"));
}

function makeToken(category) {
  const expiry = Date.now() + 24 * 60 * 60 * 1000;
  const payload = `${category}:${expiry}`;
  const sig = crypto.createHmac("sha256", getSecret()).update(payload).digest("hex");
  return Buffer.from(`${payload}:${sig}`).toString("base64url");
}

function verifyToken(category, token) {
  if (!token) return false;
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const parts = decoded.split(":");
    if (parts.length !== 3) return false;
    const [tokenCategory, expiryStr, sig] = parts;
    if (tokenCategory !== category) return false;
    const expiry = Number(expiryStr);
    if (!expiry || Date.now() > expiry) return false;
    const payload = `${tokenCategory}:${expiryStr}`;
    const expectedSig = crypto.createHmac("sha256", getSecret()).update(payload).digest("hex");
    return crypto.timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expectedSig, "hex"));
  } catch {
    return false;
  }
}

function parseUnlockedCategories(req) {
  const unlocked = new Set();
  let raw = req.query.tokens;
  if (!raw) return unlocked;
  try {
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return unlocked;
    list.forEach((entry) => {
      if (entry && entry.category && entry.token && verifyToken(entry.category, entry.token)) {
        unlocked.add(entry.category);
      }
    });
  } catch {
    return unlocked;
  }
  return unlocked;
}

function isVideoLocked(videoTags, unlockedCategories) {
  const privateStore = loadPrivate();
  const privateTagsOnVideo = videoTags.filter((t) => privateStore[t]);
  if (privateTagsOnVideo.length === 0) return false;
  return !privateTagsOnVideo.every((t) => unlockedCategories.has(t));
}

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

function getImageContentType(filename) {
  const ext = path.extname(filename).toLowerCase();
  const types = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
  };
  return types[ext] || "application/octet-stream";
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, VIDEO_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[/\\]/g, "_");
    let candidate = base + ext;
    let i = 1;
    while (fs.existsSync(path.join(VIDEO_DIR, candidate))) {
      candidate = `${base} (${i})${ext}`;
      i++;
    }
    cb(null, candidate);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!MEDIA_EXTENSIONS.has(ext)) {
      return cb(new Error("Unsupported file type: " + ext));
    }
    cb(null, true);
  },
});

const thumbStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, THUMBS_DIR),
  filename: (req, file, cb) => {
    const videoFilename = path.basename(req.params.filename);
    const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
    const safeBase = path.basename(videoFilename, path.extname(videoFilename)).replace(/[^a-z0-9]/gi, "_");
    cb(null, `${safeBase}-${Date.now()}${ext}`);
  },
});

const thumbUpload = multer({
  storage: thumbStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!IMAGE_EXTENSIONS.has(ext)) {
      return cb(new Error("Unsupported image type: " + ext));
    }
    cb(null, true);
  },
});

app.use(express.static(path.join(__dirname, "public"), {
  etag: true,
  setHeaders: (res) => {
    res.setHeader("Cache-Control", "no-cache");
  },
}));

app.get("/api/config", (req, res) => {
  const config = loadConfig();
  res.json({
    posterSearchEnabled: Boolean(getTmdbKey()),
    hasCustomKey: Boolean(config.tmdbApiKey),
  });
});

app.put("/api/config", (req, res) => {
  const config = loadConfig();
  config.tmdbApiKey = String(req.body.tmdbApiKey || "").trim();
  saveConfig(config);
  res.json({
    posterSearchEnabled: Boolean(getTmdbKey()),
    hasCustomKey: Boolean(config.tmdbApiKey),
  });
});

app.get("/api/private-folders", (req, res) => {
  res.json(Object.keys(loadPrivate()));
});

app.post("/api/private-folders/:category", (req, res) => {
  const category = req.params.category;
  const passcode = String(req.body.passcode || "");
  const store = loadPrivate();

  if (store[category]) {
    return res.status(409).json({ error: "This folder is already private. Use change-passcode instead." });
  }
  if (!passcode || passcode.length < 4) {
    return res.status(400).json({ error: "Passcode must be at least 4 characters" });
  }

  const salt = crypto.randomBytes(16).toString("hex");
  store[category] = { salt, hash: hashPasscode(passcode, salt) };
  savePrivate(store);
  bumpLibraryVersion();
  res.json({ category, private: true });
});

app.put("/api/private-folders/:category", (req, res) => {
  const category = req.params.category;
  const currentPasscode = String(req.body.currentPasscode || "");
  const newPasscode = String(req.body.newPasscode || "");
  const store = loadPrivate();

  if (!store[category]) {
    return res.status(404).json({ error: "This folder isn't private" });
  }
  if (!verifyPasscode(category, currentPasscode)) {
    return res.status(401).json({ error: "Current passcode is incorrect" });
  }
  if (!newPasscode || newPasscode.length < 4) {
    return res.status(400).json({ error: "New passcode must be at least 4 characters" });
  }

  const salt = crypto.randomBytes(16).toString("hex");
  store[category] = { salt, hash: hashPasscode(newPasscode, salt) };
  savePrivate(store);
  res.json({ category, private: true });
});

app.delete("/api/private-folders/:category", (req, res) => {
  const category = req.params.category;
  const passcode = String(req.body.passcode || "");
  const store = loadPrivate();

  if (!store[category]) {
    return res.json({ category, private: false });
  }
  if (!verifyPasscode(category, passcode)) {
    return res.status(401).json({ error: "Incorrect passcode" });
  }

  delete store[category];
  savePrivate(store);
  bumpLibraryVersion();
  res.json({ category, private: false });
});

app.post("/api/private-folders/:category/unlock", (req, res) => {
  const category = req.params.category;
  const passcode = String(req.body.passcode || "");
  const store = loadPrivate();

  if (!store[category]) {
    return res.status(404).json({ error: "This folder isn't private" });
  }
  if (!verifyPasscode(category, passcode)) {
    return res.status(401).json({ error: "Incorrect passcode" });
  }

  res.json({ category, token: makeToken(category) });
});

app.get("/api/videos", (req, res) => {
  fs.readdir(VIDEO_DIR, { withFileTypes: true }, (err, entries) => {
    if (err) {
      console.error("Failed to read VIDEO_DIR:", err.message);
      return res.status(500).json({ error: "Could not read video folder" });
    }

    const tags = loadTags();
    const thumbs = loadThumbs();
    const progressStore = loadProgress();
    const unlockedCategories = parseUnlockedCategories(req);

    const videos = entries
      .filter((e) => e.isFile() && MEDIA_EXTENSIONS.has(path.extname(e.name).toLowerCase()))
      .map((e) => {
        const stats = fs.statSync(path.join(VIDEO_DIR, e.name));
        const ext = path.extname(e.name).toLowerCase();
        const videoTags = tags[e.name] || [];
        return {
          filename: e.name,
          title: path.basename(e.name, ext).replace(/[._]/g, " "),
          sizeBytes: stats.size,
          tags: videoTags,
          kind: AUDIO_EXTENSIONS.has(ext) ? "audio" : "video",
          hasThumbnail: Boolean(thumbs[e.name]),
          locked: isVideoLocked(videoTags, unlockedCategories),
          progress: progressStore[e.name] || null,
        };
      })
      .filter((v) => !v.locked)
      .sort((a, b) => a.title.localeCompare(b.title));

    res.json(videos);
  });
});

app.get("/api/categories", (req, res) => {
  const tags = loadTags();
  const all = new Set();
  Object.values(tags).forEach((list) => list.forEach((t) => all.add(t)));
  res.json([...all].sort((a, b) => a.localeCompare(b)));
});

app.put("/api/videos/:filename/tags", (req, res) => {
  const filename = path.basename(req.params.filename);
  const filePath = path.join(VIDEO_DIR, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "File not found" });
  }

  const incoming = Array.isArray(req.body.tags) ? req.body.tags : [];
  const cleaned = [...new Set(
    incoming
      .map((t) => String(t).trim())
      .filter((t) => t.length > 0)
  )];

  const tags = loadTags();
  if (cleaned.length === 0) {
    delete tags[filename];
  } else {
    tags[filename] = cleaned;
  }
  saveTags(tags);
  bumpLibraryVersion();

  res.json({ filename, tags: cleaned });
});

function handleProgressUpdate(req, res) {
  const filename = path.basename(req.params.filename);
  const filePath = path.join(VIDEO_DIR, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "File not found" });
  }

  const position = Number(req.body.position);
  const duration = Number(req.body.duration);

  if (!Number.isFinite(position) || position < 0) {
    return res.status(400).json({ error: "Invalid position" });
  }

  const progress = loadProgress();
  const nearEnd = Number.isFinite(duration) && duration > 0 && (duration - position < 15 || position / duration > 0.95);
  const nearStart = position < 5;

  if (nearEnd || nearStart) {
    delete progress[filename];
  } else {
    progress[filename] = { position, duration: Number.isFinite(duration) ? duration : 0, updatedAt: Date.now() };
  }

  saveProgress(progress);
  res.json({ filename, cleared: nearEnd || nearStart });
}

app.put("/api/videos/:filename/progress", handleProgressUpdate);
app.post("/api/videos/:filename/progress", handleProgressUpdate);

app.post("/api/videos/:filename/thumbnail", (req, res) => {
  const videoFilename = path.basename(req.params.filename);
  const videoPath = path.join(VIDEO_DIR, videoFilename);

  if (!fs.existsSync(videoPath)) {
    return res.status(404).json({ error: "Video not found" });
  }

  thumbUpload.single("thumbnail")(req, res, (err) => {
    if (err) {
      console.error("Thumbnail upload failed:", err.message);
      return res.status(400).json({ error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ error: "No image received" });
    }

    const thumbs = loadThumbs();
    const previous = thumbs[videoFilename];
    thumbs[videoFilename] = req.file.filename;
    saveThumbs(thumbs);
    if (previous && previous !== req.file.filename) deleteThumbFile(previous);

    res.json({ filename: videoFilename, thumbnail: req.file.filename });
  });
});

app.delete("/api/videos/:filename/thumbnail", (req, res) => {
  const videoFilename = path.basename(req.params.filename);
  const thumbs = loadThumbs();
  const existing = thumbs[videoFilename];

  if (!existing) {
    return res.json({ filename: videoFilename, removed: false });
  }

  delete thumbs[videoFilename];
  saveThumbs(thumbs);
  deleteThumbFile(existing);

  res.json({ filename: videoFilename, removed: true });
});

app.get("/thumbnail/:filename", (req, res) => {
  const videoFilename = path.basename(req.params.filename);
  const tags = loadTags();
  const videoTags = tags[videoFilename] || [];
  const unlockedCategories = parseUnlockedCategories(req);
  if (isVideoLocked(videoTags, unlockedCategories)) {
    return res.status(403).send("This thumbnail is in a private folder");
  }

  const thumbs = loadThumbs();
  const storedName = thumbs[videoFilename];

  if (!storedName) {
    return res.status(404).send("No thumbnail set");
  }

  const thumbPath = path.join(THUMBS_DIR, storedName);
  fs.stat(thumbPath, (err, stats) => {
    if (err) return res.status(404).send("Thumbnail file missing");

    const etag = `"${storedName}"`;
    res.setHeader("ETag", etag);
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Content-Type", getImageContentType(storedName));

    if (req.headers["if-none-match"] === etag) {
      return res.status(304).end();
    }

    res.setHeader("Content-Length", stats.size);
    fs.createReadStream(thumbPath).pipe(res);
  });
});

app.get("/api/videos/:filename/poster-search", async (req, res) => {
  const tmdbKey = getTmdbKey();
  if (!tmdbKey) {
    return res.status(501).json({ error: "Poster search isn't configured on this server" });
  }

  const query = String(req.query.title || "").trim();
  if (!query) {
    return res.status(400).json({ error: "Missing title" });
  }

  try {
    const url = `https://api.themoviedb.org/3/search/multi?api_key=${encodeURIComponent(tmdbKey)}&query=${encodeURIComponent(query)}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error("TMDB request failed: " + response.status);
    const data = await response.json();

    const results = (data.results || [])
      .filter((r) => r.poster_path)
      .slice(0, 8)
      .map((r) => ({
        id: r.id,
        title: r.title || r.name || query,
        year: (r.release_date || r.first_air_date || "").slice(0, 4),
        posterUrl: `https://image.tmdb.org/t/p/w342${r.poster_path}`,
      }));

    res.json(results);
  } catch (err) {
    console.error("Poster search failed:", err.message);
    res.status(502).json({ error: "Poster search failed" });
  }
});

app.post("/api/videos/:filename/thumbnail-from-url", async (req, res) => {
  if (!getTmdbKey()) {
    return res.status(501).json({ error: "Poster search isn't configured on this server" });
  }

  const videoFilename = path.basename(req.params.filename);
  const videoPath = path.join(VIDEO_DIR, videoFilename);
  if (!fs.existsSync(videoPath)) {
    return res.status(404).json({ error: "Video not found" });
  }

  const imageUrl = String(req.body.url || "");
  let parsed;
  try {
    parsed = new URL(imageUrl);
  } catch {
    return res.status(400).json({ error: "Invalid URL" });
  }

  if (parsed.hostname !== "image.tmdb.org") {
    return res.status(400).json({ error: "Only TMDB image URLs are allowed" });
  }

  try {
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error("Image fetch failed: " + response.status);
    const buffer = Buffer.from(await response.arrayBuffer());

    const ext = path.extname(parsed.pathname).toLowerCase() || ".jpg";
    const safeBase = path.basename(videoFilename, path.extname(videoFilename)).replace(/[^a-z0-9]/gi, "_");
    const storedName = `${safeBase}-${Date.now()}${ext}`;
    fs.writeFileSync(path.join(THUMBS_DIR, storedName), buffer);

    const thumbs = loadThumbs();
    const previous = thumbs[videoFilename];
    thumbs[videoFilename] = storedName;
    saveThumbs(thumbs);
    if (previous && previous !== storedName) deleteThumbFile(previous);

    res.json({ filename: videoFilename, thumbnail: storedName });
  } catch (err) {
    console.error("Thumbnail-from-url failed:", err.message);
    res.status(502).json({ error: "Could not save that poster" });
  }
});

function getLanAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) {
        return `http://${iface.address}:${PORT}`;
      }
    }
  }
  return `http://localhost:${PORT}`;
}

function zipFile(destPath, entries) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(destPath);
    const archive = archiver("zip", { zlib: { level: 9 } });
    output.on("close", resolve);
    archive.on("error", reject);
    archive.pipe(output);
    entries.forEach((entry) => archive.append(entry.content, { name: entry.name, mode: entry.mode }));
    archive.finalize();
  });
}

async function generateDesktopAppDownloads() {
  fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
  const url = getLanAddress();

  const readme = (platform, steps) => `Lan flix desktop launcher — ${platform}

This opens Lan flix in its own window using a browser already on your
device, with no address bar or tabs. It is a small launcher script, not an
installer or a compiled app.

It points at: ${url}
If your server's IP address ever changes, restart the Lan flix server once
to regenerate these downloads with the new address.

${steps}
`;

  const linuxDesktop = `[Desktop Entry]
Name=Lan flix
Comment=Your home media server
Exec=sh -c "xdg-open ${url} 2>/dev/null || (command -v chromium >/dev/null && chromium --app=${url}) || (command -v google-chrome >/dev/null && google-chrome --app=${url}) || (command -v brave-browser >/dev/null && brave-browser --app=${url})"
Icon=video-x-generic
Terminal=false
Type=Application
Categories=AudioVideo;Video;Player;
`;

  const windowsBat = `@echo off
start chrome --app=${url} 2>nul
if errorlevel 1 start msedge --app=${url} 2>nul
if errorlevel 1 start ${url}
`;

  const macCommand = `#!/bin/bash
open -na "Google Chrome" --args --app="${url}" 2>/dev/null || \\
open -na "Brave Browser" --args --app="${url}" 2>/dev/null || \\
open -na "Microsoft Edge" --args --app="${url}" 2>/dev/null || \\
open "${url}"
`;

  await zipFile(path.join(DOWNLOADS_DIR, "linux.zip"), [
    { name: "lanflix.desktop", content: linuxDesktop },
    { name: "README.txt", content: readme("Linux", 'Move lanflix.desktop into ~/.local/share/applications/ (create that folder if it doesn\'t exist), then it should appear in your app launcher. You may need to right-click it and choose "Allow launching" the first time.') },
  ]);

  await zipFile(path.join(DOWNLOADS_DIR, "windows.zip"), [
    { name: "lanflix.bat", content: windowsBat },
    { name: "README.txt", content: readme("Windows", 'Double-click lanflix.bat to launch. To pin it, right-click the file, choose "Create shortcut," then drag that shortcut to your taskbar or Start menu.') },
  ]);

  await zipFile(path.join(DOWNLOADS_DIR, "mac.zip"), [
    { name: "lanflix.command", content: macCommand, mode: 0o755 },
    { name: "README.txt", content: readme("macOS", 'Double-click lanflix.command to launch. The first time, you may need to right-click it, choose Open, and confirm — macOS blocks unsigned scripts by default (System Settings -> Privacy & Security also has an "Open Anyway" option if needed).') },
  ]);
}

app.use("/downloads", express.static(DOWNLOADS_DIR));

function requireCacheSecret(req, res, next) {
  const provided = req.headers["x-cache-secret"];
  if (provided !== getCacheSecret()) {
    return res.status(401).json({ error: "Invalid or missing cache secret" });
  }
  next();
}

app.post("/internal/register-cache-node", requireCacheSecret, (req, res) => {
  const { id, port } = req.body;
  const address = req.socket.remoteAddress.replace("::ffff:", "");
  if (!id || !port) {
    return res.status(400).json({ error: "Missing id or port" });
  }
  registerCacheNode(id, address, port);
  res.json({ ok: true, libraryVersion });
});

app.get("/api/cache-nodes", (req, res) => {
  const nodes = getLiveCacheNodes().map((n) => ({ id: n.id, address: n.address, port: n.port }));
  res.json({ nodes, libraryVersion });
});

app.get("/internal/cache-manifest", requireCacheSecret, (req, res) => {
  const tags = loadTags();
  const privateStore = loadPrivate();

  fs.readdir(VIDEO_DIR, { withFileTypes: true }, (err, entries) => {
    if (err) return res.status(500).json({ error: "Could not read video folder" });

    const cacheable = entries
      .filter((e) => e.isFile() && MEDIA_EXTENSIONS.has(path.extname(e.name).toLowerCase()))
      .map((e) => e.name)
      .filter((filename) => {
        const videoTags = tags[filename] || [];
        return !videoTags.some((t) => privateStore[t]);
      });

    res.json({ libraryVersion, filenames: cacheable });
  });
});

app.get("/internal/cache-fetch/:filename", requireCacheSecret, (req, res) => {
  const filename = path.basename(req.params.filename);
  const filePath = path.join(VIDEO_DIR, filename);

  if (!MEDIA_EXTENSIONS.has(path.extname(filename).toLowerCase())) {
    return res.status(400).json({ error: "Not a supported media file" });
  }

  const tags = loadTags();
  const privateStore = loadPrivate();
  const videoTags = tags[filename] || [];
  if (videoTags.some((t) => privateStore[t])) {
    return res.status(403).json({ error: "This video is private and cannot be cached" });
  }

  fs.stat(filePath, (err, stats) => {
    if (err) return res.status(404).json({ error: "File not found" });
    res.setHeader("Content-Length", stats.size);
    res.setHeader("Content-Type", getContentType(filename));
    fs.createReadStream(filePath).pipe(res);
  });
});

app.post("/api/upload", (req, res) => {
  upload.single("video")(req, res, (err) => {
    if (err) {
      console.error("Upload failed:", err.message);
      return res.status(400).json({ error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ error: "No file received" });
    }
    bumpLibraryVersion();
    res.json({ filename: req.file.filename });
  });
});

app.put("/api/videos/:filename/rename", (req, res) => {
  const oldFilename = path.basename(req.params.filename);
  const oldPath = path.join(VIDEO_DIR, oldFilename);

  if (!fs.existsSync(oldPath)) {
    return res.status(404).json({ error: "File not found" });
  }

  const ext = path.extname(oldFilename);
  let newBase = String(req.body.newName || "").trim().replace(/[\/\\]/g, "_");

  if (!newBase) {
    return res.status(400).json({ error: "Name cannot be empty" });
  }

  const newFilename = newBase + ext;
  const newPath = path.join(VIDEO_DIR, newFilename);

  if (newFilename === oldFilename) {
    return res.json({ oldFilename, newFilename });
  }

  if (fs.existsSync(newPath)) {
    return res.status(409).json({ error: "A file with that name already exists" });
  }

  fs.rename(oldPath, newPath, (err) => {
    if (err) {
      console.error("Rename failed:", err.message);
      return res.status(500).json({ error: "Could not rename file" });
    }

    const tags = loadTags();
    if (tags[oldFilename]) {
      tags[newFilename] = tags[oldFilename];
      delete tags[oldFilename];
      saveTags(tags);
    }

    const thumbs = loadThumbs();
    if (thumbs[oldFilename]) {
      thumbs[newFilename] = thumbs[oldFilename];
      delete thumbs[oldFilename];
      saveThumbs(thumbs);
    }

    const progress = loadProgress();
    if (progress[oldFilename]) {
      progress[newFilename] = progress[oldFilename];
      delete progress[oldFilename];
      saveProgress(progress);
    }

    bumpLibraryVersion();
    res.json({ oldFilename, newFilename });
  });
});

app.delete("/api/videos/:filename", (req, res) => {
  const filename = path.basename(req.params.filename);
  const filePath = path.join(VIDEO_DIR, filename);

  if (!MEDIA_EXTENSIONS.has(path.extname(filename).toLowerCase())) {
    return res.status(400).json({ error: "Not a supported media file" });
  }

  fs.unlink(filePath, (err) => {
    if (err) {
      console.error("Delete failed:", err.message);
      return res.status(err.code === "ENOENT" ? 404 : 500).json({ error: "Could not delete file" });
    }

    const tags = loadTags();
    if (tags[filename]) {
      delete tags[filename];
      saveTags(tags);
    }

    const thumbs = loadThumbs();
    if (thumbs[filename]) {
      deleteThumbFile(thumbs[filename]);
      delete thumbs[filename];
      saveThumbs(thumbs);
    }

    const progress = loadProgress();
    if (progress[filename]) {
      delete progress[filename];
      saveProgress(progress);
    }

    bumpLibraryVersion();
    res.json({ deleted: filename });
  });
});

app.get("/stream/:filename", (req, res) => {
  const filename = path.basename(req.params.filename);
  const filePath = path.join(VIDEO_DIR, filename);

  if (!MEDIA_EXTENSIONS.has(path.extname(filename).toLowerCase())) {
    return res.status(400).send("Not a supported media file");
  }

  const tags = loadTags();
  const videoTags = tags[filename] || [];
  const unlockedCategories = parseUnlockedCategories(req);
  if (isVideoLocked(videoTags, unlockedCategories)) {
    return res.status(403).send("This video is in a private folder");
  }

  fs.stat(filePath, (err, stats) => {
    if (err) return res.status(404).send("File not found");

    const fileSize = stats.size;
    const contentType = getContentType(filename);
    const etag = `"${fileSize}-${stats.mtimeMs}"`;
    const lastModified = stats.mtime.toUTCString();

    res.setHeader("ETag", etag);
    res.setHeader("Last-Modified", lastModified);
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.setHeader("Accept-Ranges", "bytes");

    const ifNoneMatch = req.headers["if-none-match"];
    const ifModifiedSince = req.headers["if-modified-since"];
    if (ifNoneMatch === etag || (ifModifiedSince && new Date(ifModifiedSince) >= stats.mtime)) {
      return res.status(304).end();
    }

    const range = req.headers.range;
    const streamOptions = { highWaterMark: 1024 * 1024 };

    if (!range) {
      res.writeHead(200, {
        "Content-Length": fileSize,
        "Content-Type": contentType,
      });
      return fs.createReadStream(filePath, streamOptions).pipe(res);
    }

    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunkSize = end - start + 1;

    res.writeHead(206, {
      "Content-Range": `bytes ${start}-${end}/${fileSize}`,
      "Content-Length": chunkSize,
      "Content-Type": contentType,
    });

    fs.createReadStream(filePath, { ...streamOptions, start, end }).pipe(res);
  });
});

function getContentType(filename) {
  const ext = path.extname(filename).toLowerCase();
  const types = {
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mkv": "video/x-matroska",
    ".mov": "video/quicktime",
    ".m4v": "video/x-m4v",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".flac": "audio/flac",
    ".m4a": "audio/mp4",
    ".ogg": "audio/ogg",
    ".aac": "audio/aac",
  };
  return types[ext] || "application/octet-stream";
}

app.use("/api", (req, res) => {
  res.status(404).json({ error: `No API route for ${req.method} ${req.path}` });
});

app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  if (req.path.startsWith("/api")) {
    res.status(500).json({ error: err.message || "Internal server error" });
  } else {
    res.status(500).send("Internal server error");
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`\nLan flix running`);
  console.log(`  Serving folder: ${VIDEO_DIR}`);
  console.log(`  Local:   http://localhost:${PORT}`);
  console.log(`  Network: http://<this-machine's-LAN-IP>:${PORT}\n`);

  generateDesktopAppDownloads()
    .then(() => console.log("Desktop app downloads ready in /downloads"))
    .catch((err) => console.error("Could not generate desktop app downloads:", err.message));

  const bonjour = new Bonjour();
  bonjour.publish({ name: "Lan flix", type: "lanflix", port: Number(PORT) });
  console.log(`Advertising on the LAN as _lanflix._tcp (mDNS) — cache nodes can auto-discover this server.`);
  console.log(`Cache node pairing secret: ${getCacheSecret()}`);
  console.log(`(You'll need this exact value when starting a cache-node.js on another machine.)\n`);
});

// Download page: finds the newest build through the GitHub API, points the
// big button at the visitor's OS, runs the menu's embers and the theme song.
"use strict";

const REPO = "nathanjmetz/squad-game-downloads";
const RELEASES = `https://github.com/${REPO}/releases/latest`;
const PLATFORMS = [
	{ id: "windows", label: "WINDOWS", match: /win/i },
	{ id: "mac", label: "MAC", match: /mac|osx|darwin/i },
	{ id: "linux", label: "LINUX", match: /linux|x11/i },
];

const $ = (id) => document.getElementById(id);

function detectOs() {
	const ua = navigator.userAgent || "";
	const plat = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || "";
	if (/android|iphone|ipad|ipod/i.test(ua) || (/Mac/.test(plat) && navigator.maxTouchPoints > 1)) return "mobile";
	if (/win/i.test(plat) || /windows/i.test(ua)) return "windows";
	if (/mac/i.test(plat) || /mac os/i.test(ua)) return "mac";
	if (/linux|x11|cros/i.test(plat + ua)) return "linux";
	return "unknown";
}

function sizeText(bytes) {
	return bytes ? `${Math.round(bytes / 1048576)} MB` : "";
}

function whenText(iso) {
	const d = new Date(iso);
	if (isNaN(d)) return "";
	const hours = (Date.now() - d) / 3600000;
	if (hours < 1) return "just now";
	if (hours < 24) return `${Math.round(hours)} h ago`;
	const days = Math.round(hours / 24);
	return days === 1 ? "yesterday" : days < 14 ? `${days} days ago` : d.toLocaleDateString();
}

// assets: { windows: {url, size}, ... }; release: the API object or null.
function render(assets, release) {
	const os = detectOs();
	const mine = PLATFORMS.find((p) => p.id === os);
	const primary = $("primary");
	if (mine && assets[mine.id]) {
		primary.href = assets[mine.id].url;
		primary.innerHTML = `DOWNLOAD<small>FOR ${mine.label}${assets[mine.id].size ? "  ·  " + sizeText(assets[mine.id].size) : ""}</small>`;
	} else {
		primary.href = RELEASES;
		primary.innerHTML = os === "mobile" ? "DOWNLOADS<small>THE GAME RUNS ON A COMPUTER</small>" : "DOWNLOADS";
	}

	const others = $("others");
	others.textContent = "";
	others.previousElementSibling.textContent = mine && assets[mine.id] ? "OTHER PLATFORMS" : "PLATFORMS";
	for (const p of PLATFORMS) {
		if (mine && p.id === mine.id && assets[p.id]) continue;
		const a = document.createElement("a");
		a.className = "row";
		const has = !!assets[p.id];
		const known = release !== null;
		a.href = has ? assets[p.id].url : RELEASES;
		if (known && !has) a.classList.add("off");
		a.innerHTML = `<span>${p.label}</span><small>${has ? sizeText(assets[p.id].size) + "  ›" : known ? "not built yet" : "on GitHub  ›"}</small>`;
		others.appendChild(a);
	}

	if (release) {
		const m = /\(([0-9a-f]{7,})\)/i.exec(release.name || "");
		$("mode-info").textContent = `BUILD  ·  ${whenText(release.published_at).toUpperCase()}`;
		$("mode-title").textContent = m ? m[1].toUpperCase() : (release.tag_name || "LATEST").toUpperCase();
		$("mode").href = release.html_url || RELEASES;
		$("build-line").textContent = "Newest build, " + new Date(release.published_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) +
			". Everyone needs the same build to play together.";
	} else {
		$("build-line").textContent = "Couldn't reach GitHub just now, so the buttons open the downloads page.";
	}
	if (os === "mobile") {
		const s = $("status");
		s.textContent = "Open this page on your Mac or PC to install the game.";
		s.hidden = false;
	}
}

async function loadRelease() {
	render({}, undefined);
	$("build-line").textContent = "Looking up the newest build…";
	try {
		const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { Accept: "application/vnd.github+json" } });
		if (!res.ok) throw new Error(res.status);
		const release = await res.json();
		const assets = {};
		for (const a of release.assets || []) {
			if (!/\.(zip|dmg|exe|tar\.gz|tgz|AppImage)$/i.test(a.name)) continue;
			const p = PLATFORMS.find((p) => p.match.test(a.name));
			if (p && !assets[p.id]) assets[p.id] = { url: a.browser_download_url, size: a.size };
		}
		render(assets, release);
	} catch (e) {
		render({}, null);
		$("others").querySelectorAll(".row").forEach((r) => r.classList.remove("off"));
	}
}

// Tabs swap the right column's panel, like the menu's top bar.
function showPanel(name) {
	if (!document.querySelector(`.panel[data-name="${name}"]`)) name = "download";
	document.querySelectorAll(".panel").forEach((p) => (p.hidden = p.dataset.name !== name));
	document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.panel === name));
}
window.addEventListener("hashchange", () => showPanel(location.hash.slice(1)));

// Theme song: on by default once the page is unlocked, faded in and out.
// Turning it off is remembered on this device. Browsers only allow sound
// after a click or key press, so after an automatic unlock (remembered
// password) it starts on the visitor's first click or key instead.
const MUSIC_STORE = "download-page-music";

function setupMusic() {
	const btn = $("music");
	const audio = $("theme");
	let fade = 0;
	let wanted = true;
	try { wanted = localStorage.getItem(MUSIC_STORE) !== "off"; } catch (e) { /* private mode */ }
	const ramp = (to, done) => {
		cancelAnimationFrame(fade);
		const from = audio.volume, t0 = performance.now(), ms = 1200;
		const step = (t) => {
			const k = Math.min(1, (t - t0) / ms);
			audio.volume = from + (to - from) * k;
			if (k < 1) fade = requestAnimationFrame(step); else if (done) done();
		};
		fade = requestAnimationFrame(step);
	};
	const show = (on) => {
		btn.setAttribute("aria-pressed", String(on));
		btn.querySelector(".chip-text").textContent = on ? "MUSIC ON" : "MUSIC OFF";
		btn.title = on ? "Stop the theme song" : "Play the theme song";
	};
	const start = () => {
		if (!wanted || !audio.paused) return Promise.resolve();
		audio.volume = 0;
		return audio.play().then(() => ramp(0.6));
	};
	// Blocked autoplay: try again on the first click or key press anywhere.
	const retry = (ev) => {
		if (ev.target.closest && ev.target.closest("#music")) return;
		start().then(() => {
			document.removeEventListener("pointerdown", retry, true);
			document.removeEventListener("keydown", retry, true);
		}).catch(() => {});
	};
	btn.addEventListener("click", () => {
		wanted = btn.getAttribute("aria-pressed") !== "true";
		try { localStorage.setItem(MUSIC_STORE, wanted ? "on" : "off"); } catch (e) { /* private mode */ }
		show(wanted);
		if (wanted) start().catch(() => {});
		else ramp(0, () => audio.pause());
	});
	show(wanted);
	if (wanted) {
		start().catch(() => {
			document.addEventListener("pointerdown", retry, true);
			document.addEventListener("keydown", retry, true);
		});
	}
}

// Embers drifting up from the bottom (Brand.embers in the game).
function setupEmbers() {
	const canvas = $("embers");
	if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
	const ctx = canvas.getContext("2d");
	const LIFE = 9, AMOUNT = 70;
	let w = 0, h = 0, dpr = 1, parts = [], last = performance.now();
	const resize = () => {
		dpr = Math.min(window.devicePixelRatio || 1, 2);
		w = canvas.clientWidth; h = canvas.clientHeight;
		canvas.width = w * dpr; canvas.height = h * dpr;
	};
	const spawn = (age) => {
		const ang = (-90 + 14 + (Math.random() * 2 - 1) * 25) * Math.PI / 180;
		const v = 40 + Math.random() * 80;
		return { x: Math.random() * w, y: h + 20 + (Math.random() * 2 - 1) * 40, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v,
			rot: Math.random() * 6.28, spin: (Math.random() * 2 - 1) * Math.PI / 2, s: 1 + Math.random() * 3, age };
	};
	// Color ramp: sun (clear) -> ember_hot -> accent -> clear.
	const color = (k) => {
		if (k < 0.15) return [250, 225, 131, (k / 0.15) * 0.95];
		if (k < 0.7) { const t = (k - 0.15) / 0.55; return [251 - 13 * t, 163 - 25 * t, 88 - 30 * t, 0.95 - 0.35 * t]; }
		return [238, 138, 58, 0.6 * (1 - (k - 0.7) / 0.3)];
	};
	const step = (dt, p) => {
		p.age += dt; p.vx += 6 * dt; p.vy += -4 * dt;
		p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.spin * dt;
	};
	resize();
	for (let i = 0; i < AMOUNT; i++) { const p = spawn(0); const pre = Math.random() * LIFE; for (let t = 0; t < pre; t += 0.25) step(0.25, p); parts.push(p); }
	window.addEventListener("resize", resize);
	const frame = (t) => {
		const dt = Math.min(0.05, (t - last) / 1000); last = t;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, w, h);
		for (let i = 0; i < parts.length; i++) {
			const p = parts[i];
			step(dt, p);
			if (p.age >= LIFE) { parts[i] = spawn(0); continue; }
			const [r, g, b, a] = color(p.age / LIFE);
			ctx.save();
			ctx.translate(p.x, p.y); ctx.rotate(p.rot);
			ctx.fillStyle = `rgba(${r | 0},${g | 0},${b | 0},${a})`;
			ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s);
			ctx.restore();
		}
		requestAnimationFrame(frame);
	};
	requestAnimationFrame(frame);
}

// The page itself is encrypted (locked.json, AES-GCM with a PBKDF2 key from
// the password) so the static host never serves it in the clear. The key is
// remembered on this device after the first unlock.
const KEY_STORE = "download-page-key";
const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function decrypt(locked, key) {
	const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64(locked.iv) }, key, b64(locked.data));
	return new TextDecoder().decode(plain);
}

async function keyFrom(password, locked) {
	const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
	return crypto.subtle.deriveKey({ name: "PBKDF2", salt: b64(locked.salt), iterations: locked.iterations, hash: "SHA-256" },
		base, { name: "AES-GCM", length: 256 }, true, ["decrypt"]);
}

function remember(raw) {
	try { if (raw) localStorage.setItem(KEY_STORE, raw); else localStorage.removeItem(KEY_STORE); } catch (e) { /* private mode */ }
}

function openPage(html) {
	$("lock").hidden = true;
	const page = $("page");
	page.innerHTML = html;
	page.hidden = false;
	const titled = page.querySelector("[data-title]");
	if (titled) document.title = titled.dataset.title;
	showPanel(location.hash.slice(1));
	setupMusic();
	loadRelease();
}

async function setupLock() {
	let locked;
	try {
		locked = await (await fetch("locked.json", { cache: "no-cache" })).json();
	} catch (e) {
		$("lock-error").textContent = "Couldn't load the page. Refresh to try again.";
		$("lock-error").hidden = false;
		return;
	}
	let saved = null;
	try { saved = localStorage.getItem(KEY_STORE); } catch (e) { /* private mode */ }
	if (saved) {
		try {
			const key = await crypto.subtle.importKey("raw", b64(saved), "AES-GCM", true, ["decrypt"]);
			return openPage(await decrypt(locked, key));
		} catch (e) {
			remember(null);
		}
	}
	$("lock").addEventListener("submit", async (ev) => {
		ev.preventDefault();
		const btn = $("unlock");
		btn.disabled = true;
		$("lock-error").hidden = true;
		try {
			const key = await keyFrom($("password").value, locked);
			const html = await decrypt(locked, key);
			const raw = new Uint8Array(await crypto.subtle.exportKey("raw", key));
			remember(btoa(String.fromCharCode(...raw)));
			openPage(html);
		} catch (e) {
			$("lock-error").textContent = "That's not it. Try again.";
			$("lock-error").hidden = false;
			$("password").select();
		}
		btn.disabled = false;
	});
}

setupEmbers();
setupLock();

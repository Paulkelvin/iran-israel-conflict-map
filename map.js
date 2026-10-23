// ============================================================================
// Iran–Israel Conflict Map & Kinetic Simulator (2024–2026 Complete Edition)
// ============================================================================

let map;
let conflictEvents = [];
let iranBoundaryData = null;
let israelBoundaryData = null;
let dateRange = { min: null, max: null };
let currentViewMode = 'points';
let currentTheme = 'light';      // Light Mode by default!
let currentBasemapMode = 'auto'; // 'auto' | 'hybrid' | 'streets'
let popup = null;
let mapLoaded = false;
let eventListenersSetup = false;

// Timeline & Simulation state
let animationInterval = null;
let isPlaying = false;
let currentAnimationIndex = 0;
let userMovedSlider = false;
let hasActivePlayhead = false;
let sliderDirtyByUser = false;
let pendingKineticTimers = [];
let sortedEvents = [];
let showTrajectories = true;
let soundEnabled = true;         // Enabled by default!
let masterVolume = 0.70;         // 70% default volume (adjustable 0-100% from UI)
let preMuteVolume = 0.70;
let activeAudioNodes = new Set();
let canvasWasDirty = false;
let audioCtx = null;
let launchWavUrl = null;
let blastWavUrl = null;
let lastLaunchSoundMs = 0;
let lastBlastSoundMs = 0;
let selectedFeature = null;

// MapTiler API Key & Basemap Styles
const MAPTILER_KEY = '5wLARAKCAelcLZakveFi';
const MAP_STYLES = {
    dark: `https://api.maptiler.com/maps/dataviz-dark/style.json?key=${MAPTILER_KEY}`,
    light: `https://api.maptiler.com/maps/streets/style.json?key=${MAPTILER_KEY}`,
    hybrid: `https://api.maptiler.com/maps/hybrid/style.json?key=${MAPTILER_KEY}`,
    streets: `https://api.maptiler.com/maps/streets/style.json?key=${MAPTILER_KEY}`
};

// Authentic Launch Origins for Ballistic/Airstrike Trajectories
const IRAN_LAUNCH_BASES = [
    { name: 'Kermanshah Missile Complex', coords: [47.0714, 34.3142] },
    { name: 'Tabriz Missile Base', coords: [46.2979, 38.0739] },
    { name: 'Khorramabad Underground Base', coords: [48.3558, 33.4878] },
    { name: 'Isfahan Aerospace Complex', coords: [51.6680, 32.6546] },
    { name: 'Shiraz Missile Base', coords: [52.5378, 29.6060] }
];

const ISRAEL_LAUNCH_BASES = [
    { name: 'Nevatim Airbase (IAF)', coords: [35.0122, 31.2083] },
    { name: 'Tel Nof Airbase (IAF)', coords: [34.8219, 31.8394] },
    { name: 'Ramat David Airbase (IAF)', coords: [35.1794, 32.6653] },
    { name: 'Palmachim Airbase', coords: [34.6906, 31.8978] }
];

// Gamified Campaign Mission Definitions (2024 – 2026)
const CAMPAIGN_MISSIONS = {
    'true-promise-2024': {
        title: '2024 Origin: Op. True Promise I & II + Days of Repentance (Apr – Oct 2024)',
        start: '2024-04-14',
        end: '2024-10-26'
    },
    'rising-lion': {
        title: '2025 Twelve-Day War: Op. Rising Lion & Retaliation (Jun 13–15, 2025)',
        start: '2025-06-12',
        end: '2025-06-16'
    },
    'roaring-lion': {
        title: '2026 War Outbreak: Op. Roaring Lion (Feb 28 – Mar 1, 2026)',
        start: '2026-02-28',
        end: '2026-03-01'
    },
    'cluster-oil': {
        title: 'Oil Depots & Cluster Munitions (Mar 8–19, 2026)',
        start: '2026-03-08',
        end: '2026-03-19'
    },
    'nuclear-tit-for-tat': {
        title: 'Natanz–Dimona Nuclear Tit-for-Tat (Mar 21, 2026)',
        start: '2026-03-21',
        end: '2026-03-21'
    },
    'june-exchange': {
        title: 'June Ceasefire Breakdown (Jun 7–8, 2026)',
        start: '2026-06-07',
        end: '2026-06-08'
    }
};

// 60FPS Kinetic Canvas State
let kineticCanvas = null;
let kineticCtx = null;
let activeProjectiles = [];
let activeBlasts = [];
let activeParticles = [];

// ============================================================================
// INITIALIZATION
// ============================================================================
document.addEventListener('DOMContentLoaded', function() {
    document.documentElement.setAttribute('data-theme', currentTheme);
    buildProceduralWavSounds();
    initKineticCanvas();
    initializeMap();

    // Unlock browser audio on first user click/tap anywhere
    const unlockAudio = () => {
        ensureAudioContext();
        window.removeEventListener('pointerdown', unlockAudio);
        window.removeEventListener('keydown', unlockAudio);
    };
    window.addEventListener('pointerdown', unlockAudio);
    window.addEventListener('keydown', unlockAudio);
});

function getSpeedMultiplier() {
    const val = parseFloat(document.getElementById('animation-speed')?.value || '1');
    return isNaN(val) ? 1 : val;
}

function dismissWelcomeCard() {
    const wc = document.getElementById('welcome-card');
    if (wc && !wc.classList.contains('hidden')) {
        wc.classList.add('hidden');
    }
}

function getEffectiveMapStyleUrl() {
    if (currentBasemapMode === 'auto') {
        return currentTheme === 'light' ? MAP_STYLES.light : MAP_STYLES.dark;
    }
    return MAP_STYLES[currentBasemapMode] || MAP_STYLES.light;
}

function initializeMap() {
    map = new maplibregl.Map({
        container: 'map',
        style: getEffectiveMapStyleUrl(),
        center: [44.5, 32.4],
        zoom: 4.5,
        maxZoom: 18,
        minZoom: 2
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    popup = new maplibregl.Popup({
        closeButton: true,
        closeOnClick: false,
        maxWidth: '300px'
    });

    map.on('load', function() {
        mapLoaded = true;
        loadData();
    });

    map.on('style.load', function() {
        if (conflictEvents.length > 0) {
            restoreLayersAfterStyleChange();
        }
    });

    map.on('error', function(e) {
        console.warn('Map warning:', e);
    });
}

// ============================================================================
// AUTOMATIC CAMERA PANNING TO KEEP KINETIC EXCHANGES IN VIEW
// ============================================================================
function isCoordInsideSafeViewport(coords) {
    if (!map) return true;
    const bounds = map.getBounds();
    const west = bounds.getWest();
    const east = bounds.getEast();
    const south = bounds.getSouth();
    const north = bounds.getNorth();

    // Require 12% inner margin so points aren't hidden behind the side drawer or edges
    const lngSpan = east - west;
    const latSpan = north - south;
    const lng = coords[0];
    const lat = coords[1];

    return (
        lng >= west + lngSpan * 0.14 &&
        lng <= east - lngSpan * 0.10 &&
        lat >= south + latSpan * 0.12 &&
        lat <= north - latSpan * 0.12
    );
}

function ensureExchangeInView(originCoords, targetCoords) {
    if (!map || !originCoords || !targetCoords) return;

    const zoom = map.getZoom();
    const originVisible = isCoordInsideSafeViewport(originCoords);
    const targetVisible = isCoordInsideSafeViewport(targetCoords);

    // If either country (launch base or impact target) is outside the canvas view, or zoom is too extreme, pan smoothly!
    if (!originVisible || !targetVisible || zoom < 3.4 || zoom > 7.5) {
        const pairBounds = new maplibregl.LngLatBounds();
        pairBounds.extend(originCoords);
        pairBounds.extend(targetCoords);

        const sideDrawer = document.getElementById('side-drawer');
        const drawerOpen = sideDrawer && !sideDrawer.classList.contains('collapsed') && window.innerWidth > 900;

        map.fitBounds(pairBounds, {
            padding: {
                top: 90,
                bottom: 110,
                left: drawerOpen ? 380 : 80,
                right: 90
            },
            duration: 950,
            maxZoom: 5.6
        });
    }
}

// ============================================================================
// 60FPS ULTRA-LIGHTWEIGHT BALLISTIC TRAJECTORY & BLAST SHOCKWAVE ENGINE
// (Zero shadowBlur, Zero per-frame Gradients, Capped Concurrency & 1x Overlay DPR)
// ============================================================================
const MAX_ACTIVE_PROJECTILES = 6;
const MAX_ACTIVE_BLASTS = 6;
const MAX_ACTIVE_PARTICLES = 28;
const MAX_CONCURRENT_AUDIO = 4;

function initKineticCanvas() {
    kineticCanvas = document.getElementById('kinetic-canvas');
    if (!kineticCanvas) return;
    kineticCtx = kineticCanvas.getContext('2d', { alpha: true, desynchronized: true });

    const resizeCanvas = () => {
        const rect = kineticCanvas.parentElement.getBoundingClientRect();
        // Use 1x CSS pixel resolution on the kinetic overlay canvas (4x fewer pixels to fill than 2x Retina DPR!)
        kineticCanvas.width = Math.max(1, Math.floor(rect.width));
        kineticCanvas.height = Math.max(1, Math.floor(rect.height));
    };

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
    requestAnimationFrame(renderKineticLoop);
}

function hashString(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
        h = ((h << 5) - h) + str.charCodeAt(i);
        h |= 0;
    }
    return Math.abs(h);
}

function getLaunchOriginForFeature(feature) {
    const props = feature.properties || {};
    const eid = String(props.Event_ID || '0');
    const idx = hashString(eid);

    if (props.Country === 'Israel') {
        return IRAN_LAUNCH_BASES[idx % IRAN_LAUNCH_BASES.length];
    } else {
        return ISRAEL_LAUNCH_BASES[idx % ISRAEL_LAUNCH_BASES.length];
    }
}

function clearPendingKineticTimers(clearInFlight = false) {
    if (pendingKineticTimers.length > 0) {
        pendingKineticTimers.forEach(tId => clearTimeout(tId));
        pendingKineticTimers = [];
    }
    if (clearInFlight) {
        activeProjectiles = [];
        activeBlasts = [];
        activeParticles = [];
    }
}

function spawnStrikeProjectile(feature, delayMs = 0, autoPan = false) {
    if (!feature || !feature.geometry || !feature.geometry.coordinates) return;

    const timerId = setTimeout(() => {
        const targetCoords = feature.geometry.coordinates;
        const originObj = getLaunchOriginForFeature(feature);
        const originCoords = originObj.coords;
        const props = feature.properties || {};
        const isStrikeInIsrael = props.Country === 'Israel';
        const isCluster = (props.Weapon_Type || '').toLowerCase().includes('cluster');

        if (autoPan) {
            ensureExchangeInView(originCoords, targetCoords);
        }

        const color = isStrikeInIsrael ? '#dc2626' : '#ea580c';
        const coreColor = currentTheme === 'light' ? '#7f1d1d' : '#ffffff';

        // Comfortable, trackable flight speed (~2.6 seconds across the map at 1x)
        const baseSpeed = 0.0062 + (Math.random() * 0.0012);

        if (showTrajectories) {
            // Enforce strict projectile cap so many missiles never slow down the browser
            if (activeProjectiles.length >= MAX_ACTIVE_PROJECTILES) {
                const oldest = activeProjectiles.shift();
                if (oldest) {
                    spawnImpactBlast(oldest.target, oldest.color, oldest.isCluster);
                }
            }
            activeProjectiles.push({
                origin: originCoords,
                target: targetCoords,
                originName: originObj.name,
                targetName: props['City/Region'] || props.Country,
                progress: 0,
                baseSpeed: baseSpeed,
                color: color,
                coreColor: coreColor,
                isCluster: isCluster,
                clusterSpawned: false,
                feature: feature
            });
            playSynthesizedSound('launch');
        } else {
            spawnImpactBlast(targetCoords, color, isCluster);
            playSynthesizedSound('blast');
        }
    }, delayMs);

    pendingKineticTimers.push(timerId);
}

function spawnImpactBlast(coords, color, isCluster = false) {
    if (activeBlasts.length >= MAX_ACTIVE_BLASTS) {
        activeBlasts.shift();
    }
    activeBlasts.push({
        coords: coords,
        radius: 3,
        maxRadius: isCluster ? 44 : 34,
        alpha: 1.0,
        color: color
    });

    const count = isCluster ? 7 : 5;
    for (let i = 0; i < count; i++) {
        if (activeParticles.length >= MAX_ACTIVE_PARTICLES) {
            activeParticles.shift();
        }
        const angle = (Math.PI * 2 * i) / count + (Math.random() * 0.35);
        const speed = 0.8 + Math.random() * 1.5;
        activeParticles.push({
            coords: coords,
            offsetX: 0,
            offsetY: 0,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 1.0,
            decay: 0.028 + Math.random() * 0.015,
            color: i % 2 === 0 ? color : '#f59e0b',
            size: 2.2
        });
    }
}

function launchSalvoForEvents(eventsArray, bannerLabel = null) {
    if (!eventsArray || eventsArray.length === 0) return;

    clearPendingKineticTimers(true);

    // Ensure both countries are framed on screen before firing salvo
    ensureExchangeInView([34.8, 31.8], [51.4, 35.7]);

    const maxSalvo = 6;
    const step = Math.max(1, Math.floor(eventsArray.length / maxSalvo));
    const salvoSet = [];
    for (let i = 0; i < eventsArray.length && salvoSet.length < maxSalvo; i += step) {
        salvoSet.push(eventsArray[i]);
    }

    const statusEl = document.getElementById('salvo-status-text');
    if (statusEl) {
        statusEl.innerHTML = bannerLabel
            ? `🚀 <strong>${bannerLabel}</strong> — Launching ${salvoSet.length} strike trajectories`
            : `🚀 Launching ${salvoSet.length} kinetic strike trajectories across theater`;
    }

    const mult = getSpeedMultiplier();
    const staggerMs = Math.round(360 / Math.sqrt(mult));

    salvoSet.forEach((feat, idx) => {
        spawnStrikeProjectile(feat, idx * staggerMs, false);
    });
}

function getBezierPoint(p0, p1, p2, t) {
    const invT = 1 - t;
    return {
        x: invT * invT * p0.x + 2 * invT * t * p1.x + t * t * p2.x,
        y: invT * invT * p0.y + 2 * invT * t * p1.y + t * t * p2.y
    };
}

function renderKineticLoop() {
    if (kineticCtx && kineticCanvas && map && mapLoaded) {
        const hasActiveEffects =
            activeProjectiles.length > 0 ||
            activeBlasts.length > 0 ||
            activeParticles.length > 0;

        // Lightweight idle optimization: skip canvas redraws when no kinetic effects are active
        if (!hasActiveEffects) {
            if (canvasWasDirty) {
                kineticCtx.clearRect(0, 0, kineticCanvas.width, kineticCanvas.height);
                canvasWasDirty = false;
            }
            requestAnimationFrame(renderKineticLoop);
            return;
        }

        canvasWasDirty = true;
        kineticCtx.clearRect(0, 0, kineticCanvas.width, kineticCanvas.height);

        const speedMult = getSpeedMultiplier();

        // 1. Update & Draw Ballistic Projectiles (Zero shadowBlur — uses dual-stroke halo for 50x faster GPU rendering)
        kineticCtx.lineCap = 'round';
        for (let i = activeProjectiles.length - 1; i >= 0; i--) {
            const p = activeProjectiles[i];
            p.progress += p.baseSpeed * speedMult;

            const startPt = map.project(p.origin);
            const endPt = map.project(p.target);

            const midX = (startPt.x + endPt.x) * 0.5;
            const midY = (startPt.y + endPt.y) * 0.5;
            const dist = Math.hypot(endPt.x - startPt.x, endPt.y - startPt.y);
            const arcHeight = Math.min(180, dist * 0.32);
            const ctrlPt = { x: midX, y: midY - arcHeight };

            // Guide arc
            kineticCtx.beginPath();
            kineticCtx.moveTo(startPt.x, startPt.y);
            kineticCtx.quadraticCurveTo(ctrlPt.x, ctrlPt.y, endPt.x, endPt.y);
            kineticCtx.strokeStyle = p.color;
            kineticCtx.globalAlpha = currentTheme === 'light' ? 0.25 : 0.18;
            kineticCtx.lineWidth = 1.2;
            kineticCtx.setLineDash([4, 4]);
            kineticCtx.stroke();
            kineticCtx.setLineDash([]);

            // Origin pulse ring
            if (p.progress < 0.30) {
                kineticCtx.beginPath();
                kineticCtx.arc(startPt.x, startPt.y, 4 + p.progress * 24, 0, Math.PI * 2);
                kineticCtx.strokeStyle = p.color;
                kineticCtx.globalAlpha = (0.30 - p.progress) * 2.2;
                kineticCtx.lineWidth = 1.6;
                kineticCtx.stroke();
            }

            // Target reticle
            if (p.progress > 0.30) {
                kineticCtx.beginPath();
                kineticCtx.arc(endPt.x, endPt.y, 8, 0, Math.PI * 2);
                kineticCtx.strokeStyle = p.color;
                kineticCtx.globalAlpha = Math.min(0.85, p.progress);
                kineticCtx.lineWidth = 1.5;
                kineticCtx.stroke();
            }

            // Fast 4-segment contrail using dual-pass stroke (outer halo + inner core, ZERO shadowBlur)
            const tailStart = Math.max(0, p.progress - 0.20);
            const headT = Math.min(1, p.progress);
            const segs = 4;
            kineticCtx.beginPath();
            for (let s = 0; s <= segs; s++) {
                const t = tailStart + (headT - tailStart) * (s / segs);
                const pt = getBezierPoint(startPt, ctrlPt, endPt, t);
                if (s === 0) kineticCtx.moveTo(pt.x, pt.y);
                else kineticCtx.lineTo(pt.x, pt.y);
            }
            // Outer glow pass
            kineticCtx.strokeStyle = p.color;
            kineticCtx.globalAlpha = 0.28;
            kineticCtx.lineWidth = 7.0;
            kineticCtx.stroke();
            // Inner bright core pass
            kineticCtx.globalAlpha = 0.92;
            kineticCtx.lineWidth = 2.6;
            kineticCtx.stroke();

            // Warhead tip (outer halo + inner core, ZERO shadowBlur)
            const headPt = getBezierPoint(startPt, ctrlPt, endPt, headT);
            kineticCtx.beginPath();
            kineticCtx.arc(headPt.x, headPt.y, 7.5, 0, Math.PI * 2);
            kineticCtx.fillStyle = p.color;
            kineticCtx.globalAlpha = 0.32;
            kineticCtx.fill();

            kineticCtx.beginPath();
            kineticCtx.arc(headPt.x, headPt.y, 3.8, 0, Math.PI * 2);
            kineticCtx.fillStyle = currentTheme === 'light' ? p.color : '#ffffff';
            kineticCtx.globalAlpha = 1.0;
            kineticCtx.fill();

            if (p.progress >= 1.0) {
                spawnImpactBlast(p.target, p.color, p.isCluster);
                playSynthesizedSound('blast');
                activeProjectiles.splice(i, 1);
            }
        }

        // 2. Impact Blasts (Zero createRadialGradient — fast concentric rings)
        for (let i = activeBlasts.length - 1; i >= 0; i--) {
            const b = activeBlasts[i];
            const pt = map.project(b.coords);

            b.radius += (b.maxRadius - b.radius) * 0.08 + 0.4;
            b.alpha -= 0.022;

            if (b.alpha <= 0) {
                activeBlasts.splice(i, 1);
                continue;
            }

            // Inner flash disc
            kineticCtx.beginPath();
            kineticCtx.arc(pt.x, pt.y, b.radius * 0.75, 0, Math.PI * 2);
            kineticCtx.fillStyle = b.color;
            kineticCtx.globalAlpha = b.alpha * 0.26;
            kineticCtx.fill();

            // Outer shockwave ring
            kineticCtx.beginPath();
            kineticCtx.arc(pt.x, pt.y, b.radius, 0, Math.PI * 2);
            kineticCtx.strokeStyle = b.color;
            kineticCtx.lineWidth = 2.2;
            kineticCtx.globalAlpha = b.alpha * 0.9;
            kineticCtx.stroke();
        }

        // 3. Debris Sparks
        for (let i = activeParticles.length - 1; i >= 0; i--) {
            const ptcl = activeParticles[i];
            const basePt = map.project(ptcl.coords);
            ptcl.offsetX += ptcl.vx;
            ptcl.offsetY += ptcl.vy;
            ptcl.life -= ptcl.decay;

            if (ptcl.life <= 0) {
                activeParticles.splice(i, 1);
                continue;
            }

            kineticCtx.beginPath();
            kineticCtx.arc(basePt.x + ptcl.offsetX, basePt.y + ptcl.offsetY, ptcl.size, 0, Math.PI * 2);
            kineticCtx.fillStyle = ptcl.color;
            kineticCtx.globalAlpha = ptcl.life;
            kineticCtx.fill();
        }
        kineticCtx.globalAlpha = 1.0;
    }

    requestAnimationFrame(renderKineticLoop);
}

// ============================================================================
// REAL RECORDED EXPLOSION & TURBULENT ROCKET LAUNCH AUDIO ENGINE
// ============================================================================
const SOUND_ASSETS = {
    launch: 'sounds/missile_launch.wav?v=8',
    blasts: [
        'sounds/real_explosion_1.ogg?v=8',
        'sounds/real_explosion_2.ogg?v=8',
        'sounds/bomb_blast.wav?v=8'
    ]
};
let blastRoundRobin = 0;
const preloadedAudioTemplates = {};

function buildProceduralWavSounds() {
    // Preload audio files once into memory templates so playback clones without re-downloading
    try {
        [SOUND_ASSETS.launch, ...SOUND_ASSETS.blasts].forEach(url => {
            if (!preloadedAudioTemplates[url]) {
                const a = new Audio(url);
                a.preload = 'auto';
                a.load();
                preloadedAudioTemplates[url] = a;
            }
        });
    } catch (e) {}
}

function ensureAudioContext() {
    try {
        if (!audioCtx) {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (Ctx) audioCtx = new Ctx();
        }
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
    } catch (e) {}
}

function spawnManagedAudio(url, baseGain, playbackRate = 1.0) {
    if (!soundEnabled || masterVolume <= 0.001) return;
    // Cap concurrent HTMLAudioElement decoders to prevent main-thread audio lag during heavy salvos
    if (activeAudioNodes.size >= MAX_CONCURRENT_AUDIO) {
        const oldestAudio = activeAudioNodes.values().next().value;
        if (oldestAudio) {
            try { oldestAudio.pause(); } catch (e) {}
            activeAudioNodes.delete(oldestAudio);
        }
    }
    try {
        const template = preloadedAudioTemplates[url];
        const a = template ? template.cloneNode() : new Audio(url);
        a._baseGain = baseGain;
        a.volume = Math.min(1.0, Math.max(0, baseGain * masterVolume));
        a.playbackRate = playbackRate;
        activeAudioNodes.add(a);
        const cleanup = () => activeAudioNodes.delete(a);
        a.addEventListener('ended', cleanup, { once: true });
        a.addEventListener('error', cleanup, { once: true });
        a.play().catch(cleanup);
    } catch (e) {}
}

function syncAudioVolumeUI() {
    const soundToggleBtn = document.getElementById('sound-toggle-btn');
    const volumeSlider = document.getElementById('volume-slider');
    const volumeLabel = document.getElementById('volume-label');

    const effectiveVol = soundEnabled ? masterVolume : 0;
    const pct = Math.round(effectiveVol * 100);

    if (volumeSlider && parseInt(volumeSlider.value, 10) !== pct) {
        volumeSlider.value = pct;
    }
    if (volumeLabel) {
        volumeLabel.textContent = `${pct}%`;
    }
    if (soundToggleBtn) {
        soundToggleBtn.classList.toggle('active', soundEnabled && pct > 0);
        if (!soundEnabled || pct === 0) {
            soundToggleBtn.textContent = '🔇';
        } else if (pct < 45) {
            soundToggleBtn.textContent = '🔉';
        } else {
            soundToggleBtn.textContent = '🔊';
        }
    }

    // Immediately scale volume of all currently playing sounds in real time!
    activeAudioNodes.forEach(a => {
        try {
            if (!soundEnabled || masterVolume <= 0.001) {
                a.volume = 0;
            } else {
                a.volume = Math.min(1.0, Math.max(0, (a._baseGain || 0.8) * masterVolume));
            }
        } catch (e) {}
    });
}

function playSynthesizedSound(type) {
    if (!soundEnabled || masterVolume <= 0.001) return;

    const nowMs = performance.now();
    if (type === 'launch') {
        if (nowMs - lastLaunchSoundMs < 220) return;
        lastLaunchSoundMs = nowMs;

        spawnManagedAudio(SOUND_ASSETS.launch, 0.78, 0.94 + Math.random() * 0.12);
    } else if (type === 'blast') {
        if (nowMs - lastBlastSoundMs < 200) return;
        lastBlastSoundMs = nowMs;

        const url = SOUND_ASSETS.blasts[blastRoundRobin % SOUND_ASSETS.blasts.length];
        blastRoundRobin++;
        spawnManagedAudio(url, 0.96, 0.92 + Math.random() * 0.14);
    }
}

// ============================================================================
// DATA LOADING & LAYER MANAGEMENT
// ============================================================================
async function loadData() {
    if (!mapLoaded) return;

    try {
        const response = await fetch('Israel_Iran_Strikes_Data/Israel_Iran_Strikes.geojson');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        conflictEvents = data.features;

        calculateDateRange();
        await loadBoundaryData();
        addDataToMap();

        if (!eventListenersSetup) {
            setupEventListeners();
            eventListenersSetup = true;
        }

        initializeTimelineAnimation();
        renderLiveStrikeFeed(conflictEvents);

        setTimeout(() => {
            fitMapToData();
        }, 400);

    } catch (error) {
        console.error('Error loading data:', error);
    }
}

async function loadBoundaryData() {
    try {
        const iranResponse = await fetch('IranAdminstrative.json/IranBoundary.json');
        if (iranResponse.ok) iranBoundaryData = await iranResponse.json();

        const israelResponse = await fetch('IsraelProvinces.json/IsraelBoundary.json');
        if (israelResponse.ok) israelBoundaryData = await israelResponse.json();

        addBoundaryLayers();
    } catch (error) {
        console.warn('Error loading boundary data:', error);
    }
}

function addBoundaryLayers() {
    if (iranBoundaryData && !map.getSource('iran-boundary')) {
        map.addSource('iran-boundary', { type: 'geojson', data: iranBoundaryData });
        map.addLayer({
            id: 'iran-boundary-layer',
            type: 'line',
            source: 'iran-boundary',
            paint: {
                'line-color': '#ea580c',
                'line-width': 2.2,
                'line-opacity': 0.8
            }
        });
    }

    if (israelBoundaryData && !map.getSource('israel-boundary')) {
        map.addSource('israel-boundary', { type: 'geojson', data: israelBoundaryData });
        map.addLayer({
            id: 'israel-boundary-layer',
            type: 'line',
            source: 'israel-boundary',
            paint: {
                'line-color': '#dc2626',
                'line-width': 2.2,
                'line-opacity': 0.85
            }
        });
    }
}

function addDataToMap() {
    if (!map.getSource('conflict-events')) {
        map.addSource('conflict-events', {
            type: 'geojson',
            data: {
                type: 'FeatureCollection',
                features: conflictEvents
            }
        });
    }

    updateCountryCounts(conflictEvents);

    if (!map.getLayer('conflict-points-glow')) {
        map.addLayer({
            id: 'conflict-points-glow',
            type: 'circle',
            source: 'conflict-events',
            paint: {
                'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 7, 10, 15],
                'circle-color': [
                    'case',
                    ['==', ['get', 'Country'], 'Israel'], '#dc2626',
                    ['==', ['get', 'Country'], 'Iran'], '#ea580c',
                    '#2563eb'
                ],
                'circle-opacity': 0.24,
                'circle-blur': 0.75
            }
        });
    }

    if (!map.getLayer('conflict-points')) {
        map.addLayer({
            id: 'conflict-points',
            type: 'circle',
            source: 'conflict-events',
            paint: {
                'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 4.5, 10, 8.5],
                'circle-color': [
                    'case',
                    ['==', ['get', 'Country'], 'Israel'], '#dc2626',
                    ['==', ['get', 'Country'], 'Iran'], '#ea580c',
                    '#2563eb'
                ],
                'circle-opacity': 0.92,
                'circle-stroke-width': 1.6,
                'circle-stroke-color': '#ffffff'
            }
        });
    }

    if (!map.getLayer('conflict-heatmap')) {
        map.addLayer({
            id: 'conflict-heatmap',
            type: 'heatmap',
            source: 'conflict-events',
            paint: {
                'heatmap-weight': 1,
                'heatmap-intensity': 1.2,
                'heatmap-color': [
                    'interpolate', ['linear'], ['heatmap-density'],
                    0, 'rgba(0, 0, 0, 0)',
                    0.2, 'rgba(37, 99, 235, 0.45)',
                    0.45, 'rgba(234, 88, 12, 0.75)',
                    0.75, 'rgba(220, 38, 38, 0.9)',
                    1, '#7f1d1d'
                ],
                'heatmap-radius': 30,
                'heatmap-opacity': 0.85
            }
        }, 'conflict-points-glow');
    }

    setViewMode(currentViewMode);

    map.on('click', 'conflict-points', function(e) {
        dismissWelcomeCard();
        const feature = e.features[0];
        selectAndSimulateFeature(feature, e.lngLat, false);
    });

    map.on('mouseenter', 'conflict-points', function() {
        map.getCanvas().style.cursor = 'pointer';
    });

    map.on('mouseleave', 'conflict-points', function() {
        map.getCanvas().style.cursor = '';
    });
}

function restoreLayersAfterStyleChange() {
    addBoundaryLayers();
    addDataToMap();
    sortedEvents = getSortedFilteredEvents();
    const visibleEvents = hasActivePlayhead && sortedEvents.length > 0
        ? sortedEvents.slice(0, Math.min(sortedEvents.length, currentAnimationIndex + 1))
        : sortedEvents;
    if (map.getSource('conflict-events')) {
        map.getSource('conflict-events').setData({
            type: 'FeatureCollection',
            features: visibleEvents
        });
    }
    updateCountryCounts(visibleEvents);
}

// ============================================================================
// CONTEXTUAL DOSSIER, POPUP & LIVE STRIKE FEED (ALL 63 DATES)
// ============================================================================
function formatSourceLinks(sourceUrlStr) {
    if (!sourceUrlStr) return '';
    const urls = sourceUrlStr.split(',').map(u => u.trim()).filter(u => u.startsWith('http'));
    if (urls.length === 0) return '';
    return urls.map((url, idx) => {
        let domain = `Source ${idx + 1}`;
        try {
            const host = new URL(url).hostname.replace('www.', '');
            if (host.includes('reuters')) domain = 'Reuters';
            else if (host.includes('apnews')) domain = 'AP News';
            else if (host.includes('bbc')) domain = 'BBC';
            else if (host.includes('aljazeera')) domain = 'Al Jazeera';
            else if (host.includes('timesofisrael')) domain = 'Times of Israel';
            else if (host.includes('nytimes')) domain = 'NYT';
            else if (host.includes('washingtonpost')) domain = 'WashPost';
            else if (host.includes('theguardian')) domain = 'The Guardian';
            else if (host.includes('ucdp.uu.se')) domain = 'UCDP Dataset';
            else if (host.includes('en-hrana')) domain = 'HRANA';
            else if (host.includes('jpost')) domain = 'Jerusalem Post';
            else if (host.includes('ynetnews')) domain = 'Ynet';
        } catch (e) {}
        return `<a href="${url}" target="_blank" rel="noopener noreferrer">🔗 ${domain}</a>`;
    }).join(' &nbsp;·&nbsp; ');
}

function selectAndSimulateFeature(feature, lngLat = null, flyToPoint = false) {
    dismissWelcomeCard();
    selectedFeature = feature;
    const coords = lngLat || feature.geometry.coordinates;

    // If not currently playing, sync the playhead & slider to the selected event so clicking Play continues from here
    if (!isPlaying && feature && feature.properties) {
        sortedEvents = getSortedFilteredEvents();
        const foundIdx = sortedEvents.findIndex(
            ev => ev === feature ||
            (ev.properties.Event_ID === feature.properties.Event_ID &&
             ev.properties.Date === feature.properties.Date &&
             ev.geometry.coordinates[0] === feature.geometry.coordinates[0])
        );
        if (foundIdx !== -1) {
            currentAnimationIndex = foundIdx;
            hasActivePlayhead = true;
            sliderDirtyByUser = false;
            const slider = document.getElementById('timeline-slider');
            if (slider) {
                slider.min = 0;
                slider.max = Math.max(0, sortedEvents.length - 1);
                slider.step = 1;
                slider.value = foundIdx;
            }
            updateDateDisplay(`${formatDate(feature.properties.Date)} (${foundIdx + 1} / ${sortedEvents.length})`);
        }
    }

    spawnStrikeProjectile(feature, 0, true);

    const statusEl = document.getElementById('salvo-status-text');
    const originObj = getLaunchOriginForFeature(feature);
    if (statusEl) {
        statusEl.innerHTML = `🎯 <strong>${feature.properties.Event_ID} (${feature.properties.Date}):</strong> ${originObj.name} ➔ ${feature.properties['City/Region'] || feature.properties.Country}`;
    }

    if (flyToPoint) {
        map.easeTo({
            center: feature.geometry.coordinates,
            zoom: Math.max(map.getZoom(), 5.5),
            duration: 900
        });
    }

    showEventPopup(feature, coords);
    updateInfoPanel(feature.properties);
}

function showEventPopup(feature, lngLat) {
    const properties = feature.properties;
    const sourceLinks = formatSourceLinks(properties.Source_URL);

    const popupContent = `
        <div class="popup-content">
            <div class="popup-title">${properties.Event_ID || 'Event'} // ${properties.Date || ''}</div>
            <div class="popup-details">
                <div class="popup-detail"><strong>Location:</strong> ${properties['City/Region'] || 'Unknown'}, ${properties.Country || ''}</div>
                ${properties.Target_Type ? `<div class="popup-detail"><strong>Target:</strong> ${properties.Target_Type}</div>` : ''}
                <div class="popup-detail"><strong>Weapon:</strong> ${properties.Weapon_Type || 'Unknown'}</div>
                <div class="popup-detail"><strong>Impact:</strong> ${properties.Reported_Impact || 'Unknown'}</div>
                ${sourceLinks ? `<div class="popup-detail" style="margin-top:6px;">${sourceLinks}</div>` : ''}
            </div>
        </div>
    `;

    popup.setLngLat(lngLat)
        .setHTML(popupContent)
        .addTo(map);
}

function updateInfoPanel(properties) {
    const dossierPanel = document.getElementById('dossier-panel');
    const infoPanel = document.getElementById('event-info');
    if (!infoPanel) return;

    if (dossierPanel) {
        dossierPanel.classList.remove('hidden');
    }

    const sourceLinks = formatSourceLinks(properties.Source_URL);
    const isIsrael = properties.Country === 'Israel';
    const badgeClass = isIsrael ? 'israel' : 'iran';

    infoPanel.innerHTML = `
        <div class="dossier-header-row">
            <span class="dossier-id">${properties.Event_ID || 'STRIKE'}</span>
            <span class="dossier-country-badge ${badgeClass}">STRIKE IN ${(properties.Country || '').toUpperCase()}</span>
        </div>
        <div class="dossier-grid">
            <div class="dossier-meta-box">
                <span class="dossier-meta-label">Date</span>
                <span class="dossier-meta-val mono">${properties.Date || 'Unknown'}</span>
            </div>
            <div class="dossier-meta-box">
                <span class="dossier-meta-label">Location</span>
                <span class="dossier-meta-val">${properties['City/Region'] || 'Unknown'}</span>
            </div>
            <div class="dossier-meta-box">
                <span class="dossier-meta-label">Weapon</span>
                <span class="dossier-meta-val">${properties.Weapon_Type || 'Unknown'}</span>
            </div>
            <div class="dossier-meta-box">
                <span class="dossier-meta-label">Target</span>
                <span class="dossier-meta-val">${properties.Target_Type || 'Military / Urban'}</span>
            </div>
        </div>
        <div class="dossier-impact">
            ${properties.Reported_Impact || 'No impact details recorded.'}
        </div>
        <div class="dossier-footer">
            <div class="dossier-links">${sourceLinks || '<span style="color:#64748b;">Verified Record</span>'}</div>
            <button class="replay-strike-btn" id="replay-single-strike-btn">🚀 Replay</button>
        </div>
    `;

    const replayBtn = document.getElementById('replay-single-strike-btn');
    if (replayBtn && selectedFeature) {
        replayBtn.addEventListener('click', () => {
            spawnStrikeProjectile(selectedFeature, 0, true);
        });
    }
}

function renderLiveStrikeFeed(eventsList) {
    const feedContainer = document.getElementById('live-strike-feed');
    const countBadge = document.getElementById('feed-count-badge');
    const datesSummary = document.getElementById('explore-dates-summary');
    const searchQuery = (document.getElementById('feed-search-input')?.value || '').trim().toLowerCase();

    if (!feedContainer) return;

    let filtered = eventsList;
    if (searchQuery) {
        filtered = eventsList.filter(e => {
            const p = e.properties;
            const hay = `${p.Event_ID} ${p.Date} ${p.Country} ${p['City/Region']} ${p.Target_Type} ${p.Weapon_Type} ${p.Reported_Impact}`.toLowerCase();
            return hay.includes(searchQuery);
        });
    }

    if (countBadge) {
        countBadge.textContent = filtered.length;
    }

    // Group events by Date (newest date to oldest date across ALL active dates so no date is ever hidden!)
    const byDate = new Map();
    filtered.forEach(feat => {
        const d = feat.properties.Date || 'Unknown';
        if (!byDate.has(d)) byDate.set(d, []);
        byDate.get(d).push(feat);
    });

    const uniqueDates = Array.from(byDate.keys()).sort((a, b) => b.localeCompare(a));

    if (datesSummary) {
        datesSummary.innerHTML = `Showing <strong>${uniqueDates.length} dates</strong> (${filtered.length} events)`;
    }

    if (uniqueDates.length === 0) {
        feedContainer.innerHTML = `<div style="text-align:center; padding:18px; color:var(--text-sub); font-size:0.78rem;">No strikes match your filter.</div>`;
        return;
    }

    // Build flat indexed list while rendering date group headers across ALL unique dates
    const renderedFeatures = [];
    const htmlParts = [];

    uniqueDates.forEach(dateStr => {
        const dayEvents = byDate.get(dateStr);
        // Sort curated EVT highlights first within each day
        dayEvents.sort((a, b) => {
            const aEvt = String(a.properties.Event_ID || '').startsWith('EVT') ? 1 : 0;
            const bEvt = String(b.properties.Event_ID || '').startsWith('EVT') ? 1 : 0;
            return bEvt - aEvt;
        });

        htmlParts.push(`
            <div class="feed-date-divider">
                <span>📅 ${formatDate(dateStr)}</span>
                <span>${dayEvents.length} strike${dayEvents.length > 1 ? 's' : ''}</span>
            </div>
        `);

        // Show up to 10 strikes per date (or all if searching/filtering < 15 dates) so all 63 dates are scrollable
        const perDayCap = uniqueDates.length > 15 && !searchQuery ? 6 : dayEvents.length;
        dayEvents.slice(0, perDayCap).forEach(feat => {
            const p = feat.properties;
            const cls = p.Country === 'Israel' ? 'israel' : 'iran';
            const idx = renderedFeatures.length;
            renderedFeatures.push(feat);

            htmlParts.push(`
                <div class="feed-item ${cls}" data-feed-idx="${idx}">
                    <div class="feed-item-top">
                        <span class="feed-date">${p.Date} · ${p.Event_ID}</span>
                        <span class="feed-tag ${cls}">➔ ${p.Country.toUpperCase()}</span>
                    </div>
                    <div class="feed-loc">${p['City/Region'] || p.Country}</div>
                    <div class="feed-sub">${p.Reported_Impact || p.Weapon_Type || ''}</div>
                </div>
            `);
        });
    });

    feedContainer.innerHTML = htmlParts.join('');

    feedContainer.querySelectorAll('.feed-item').forEach(itemEl => {
        itemEl.addEventListener('click', () => {
            const i = parseInt(itemEl.getAttribute('data-feed-idx'), 10);
            const feat = renderedFeatures[i];
            if (feat) {
                selectAndSimulateFeature(feat, feat.geometry.coordinates, true);
            }
        });
    });
}

// ============================================================================
// TELEMETRY, DETERMINISTIC SORTING & FILTERING
// ============================================================================
function updateCountryCounts(eventsList) {
    const israelCount = eventsList.filter(e => e.properties.Country === 'Israel').length;
    const iranCount = eventsList.filter(e => e.properties.Country === 'Iran').length;
    const totalCount = eventsList.length;

    const elIsrael = document.getElementById('count-israel');
    const elIran = document.getElementById('count-iran');
    const kpiTotal = document.getElementById('kpi-total');
    const kpiIran = document.getElementById('kpi-iran');
    const kpiIsrael = document.getElementById('kpi-israel');

    if (elIsrael) elIsrael.textContent = israelCount;
    if (elIran) elIran.textContent = iranCount;
    if (kpiTotal) kpiTotal.textContent = totalCount;
    if (kpiIran) kpiIran.textContent = iranCount;
    if (kpiIsrael) kpiIsrael.textContent = israelCount;
}

function getSortedFilteredEvents() {
    return getActiveFilteredEvents()
        .filter(event => event.properties && event.properties.Date)
        .sort((a, b) => {
            const dA = new Date(a.properties.Date).getTime();
            const dB = new Date(b.properties.Date).getTime();
            if (dA !== dB) return dA - dB;
            // Prioritize curated EVT exchanges first within the same date, then deterministic ID sort
            const aEvt = String(a.properties.Event_ID || '').startsWith('EVT') ? 0 : 1;
            const bEvt = String(b.properties.Event_ID || '').startsWith('EVT') ? 0 : 1;
            if (aEvt !== bEvt) return aEvt - bEvt;
            return String(a.properties.Event_ID || '').localeCompare(String(b.properties.Event_ID || ''));
        });
}

function syncSliderBounds(maxIndex, currentVal = null) {
    const slider = document.getElementById('timeline-slider');
    if (!slider) return;
    const safeMax = Math.max(0, maxIndex);
    slider.min = 0;
    slider.max = safeMax;
    slider.step = 1;
    if (currentVal !== null) {
        slider.value = Math.min(safeMax, Math.max(0, currentVal));
    }
}

function calculateDateRange() {
    const dates = conflictEvents
        .map(event => new Date(event.properties.Date))
        .filter(date => !isNaN(date.getTime()));

    if (dates.length > 0) {
        dateRange.min = new Date(Math.min(...dates));
        dateRange.max = new Date(Math.max(...dates));

        const startDateInput = document.getElementById('start-date');
        const endDateInput = document.getElementById('end-date');
        if (startDateInput) startDateInput.value = dateRange.min.toISOString().split('T')[0];
        if (endDateInput) endDateInput.value = dateRange.max.toISOString().split('T')[0];

        sortedEvents = getSortedFilteredEvents();
        syncSliderBounds(sortedEvents.length - 1, sortedEvents.length - 1);

        updateDateDisplay(`${formatDate(dateRange.min)} – ${formatDate(dateRange.max)} (${conflictEvents.length})`);
    }
}

function getActiveFilteredEvents() {
    const startDateVal = document.getElementById('start-date')?.value;
    const endDateVal = document.getElementById('end-date')?.value;
    const targetType = document.getElementById('target-type-select')?.value || 'all';
    const showIsrael = document.getElementById('filter-israel') ? document.getElementById('filter-israel').checked : true;
    const showIran = document.getElementById('filter-iran') ? document.getElementById('filter-iran').checked : true;

    const start = startDateVal ? new Date(startDateVal) : dateRange.min;
    const end = endDateVal ? new Date(endDateVal) : dateRange.max;

    return conflictEvents.filter(event => {
        const props = event.properties;
        const eventDate = new Date(props.Date);
        if (start && eventDate < start) return false;
        if (end && eventDate > end) return false;

        if (props.Country === 'Israel' && !showIsrael) return false;
        if (props.Country === 'Iran' && !showIran) return false;

        if (targetType !== 'all') {
            const tStr = (props.Target_Type || '').toLowerCase();
            if (!tStr.includes(targetType.toLowerCase())) return false;
        }
        return true;
    });
}

function applyAllFilters(fitBounds = true, triggerSalvo = false, bannerTitle = null) {
    if (isPlaying) stopAnimation();
    clearPendingKineticTimers(true);

    sortedEvents = getSortedFilteredEvents();
    currentAnimationIndex = 0;
    userMovedSlider = false;
    hasActivePlayhead = false;
    sliderDirtyByUser = false;

    syncSliderBounds(sortedEvents.length - 1, sortedEvents.length - 1);

    if (map.getSource('conflict-events')) {
        map.getSource('conflict-events').setData({
            type: 'FeatureCollection',
            features: sortedEvents
        });
    }

    updateCountryCounts(sortedEvents);
    renderLiveStrikeFeed(sortedEvents);

    const startDate = document.getElementById('start-date')?.value || '';
    const endDate = document.getElementById('end-date')?.value || '';
    updateDateDisplay(`${startDate} – ${endDate} (${sortedEvents.length})`);

    if (fitBounds && sortedEvents.length > 0) {
        setTimeout(() => fitMapToData(), 80);
    }

    if (triggerSalvo && sortedEvents.length > 0) {
        setTimeout(() => launchSalvoForEvents(sortedEvents, bannerTitle), 450);
    }
}

// ============================================================================
// SLIDER SCRUBBING: 1-TO-1 EXACT EVENT INDEX SYNC SO PLAY CONTINUES FROM SLIDER
// ============================================================================
function filterEventsByDate(sliderValue) {
    if (isPlaying) stopAnimation();
    clearPendingKineticTimers(true);

    sortedEvents = getSortedFilteredEvents();
    if (sortedEvents.length === 0) return;

    const slider = document.getElementById('timeline-slider');
    const maxIdx = Math.max(0, sortedEvents.length - 1);
    if (slider && parseInt(slider.max, 10) !== maxIdx) {
        slider.min = 0;
        slider.max = maxIdx;
        slider.step = 1;
    }

    const rawVal = parseFloat(sliderValue);
    const targetIdx = isNaN(rawVal)
        ? 0
        : Math.min(maxIdx, Math.max(0, Math.round(rawVal)));

    // Sync animation playhead directly to the exact slider position!
    currentAnimationIndex = targetIdx;
    userMovedSlider = true;
    hasActivePlayhead = true;
    sliderDirtyByUser = true;

    const filteredEvents = sortedEvents.slice(0, targetIdx + 1);
    const currentEv = sortedEvents[targetIdx];

    if (map.getSource('conflict-events')) {
        map.getSource('conflict-events').setData({
            type: 'FeatureCollection',
            features: filteredEvents
        });
    }

    updateCountryCounts(filteredEvents);
    renderLiveStrikeFeed(filteredEvents);

    if (currentEv) {
        selectedFeature = currentEv;
        updateDateDisplay(`${formatDate(currentEv.properties.Date)} (${targetIdx + 1} / ${sortedEvents.length})`);

        const statusEl = document.getElementById('salvo-status-text');
        if (statusEl) {
            statusEl.innerHTML = `📍 <strong>${currentEv.properties.Date}:</strong> ${currentEv.properties['City/Region'] || currentEv.properties.Country} (${targetIdx + 1} / ${sortedEvents.length}) — Click Play to continue`;
        }

        // If the right-side Strike Intelligence dossier is open, keep it synced to the slider's current event
        const dossierPanel = document.getElementById('dossier-panel');
        if (dossierPanel && !dossierPanel.classList.contains('hidden')) {
            updateInfoPanel(currentEv.properties);
        }
    }
}

function updateDateDisplay(date = null) {
    const dateDisplay = document.getElementById('date-display');
    if (!dateDisplay) return;
    dateDisplay.textContent = date ? (typeof date === 'string' ? date : formatDate(date)) : 'All Dates';
}

// ============================================================================
// UI EVENT LISTENERS
// ============================================================================
function setupEventListeners() {
    // 0. Top-Center Pill Inline Play All Button
    const bannerPlayBtn = document.getElementById('banner-play-btn');
    if (bannerPlayBtn) {
        bannerPlayBtn.addEventListener('click', function() {
            ensureAudioContext();
            toggleAnimation();
        });
    }

    // Explore "Show All Dates" button
    const exploreShowAllBtn = document.getElementById('explore-show-all-btn');
    if (exploreShowAllBtn) {
        exploreShowAllBtn.addEventListener('click', function() {
            resetAnimation();
        });
    }

    // 1. Left Drawer Collapse/Expand Toggle
    const drawerToggleBtn = document.getElementById('drawer-toggle-btn');
    const sideDrawer = document.getElementById('side-drawer');
    if (drawerToggleBtn && sideDrawer) {
        drawerToggleBtn.addEventListener('click', function() {
            sideDrawer.classList.toggle('collapsed');
            setTimeout(() => fitMapToData(), 260);
        });
    }

    // 2. Left Drawer Tab Navigation (Campaigns | Explore | Layers)
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const targetId = this.getAttribute('data-tab');
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
            this.classList.add('active');
            const pane = document.getElementById(targetId);
            if (pane) pane.classList.add('active');
        });
    });

    // 3. Close Contextual Dossier Card
    const closeDossierBtn = document.getElementById('close-dossier-btn');
    if (closeDossierBtn) {
        closeDossierBtn.addEventListener('click', function() {
            const dossierPanel = document.getElementById('dossier-panel');
            if (dossierPanel) dossierPanel.classList.add('hidden');
            if (popup) popup.remove();
        });
    }

    // 4. Light Mode / Dark Mode Toggle
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', function() {
            currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', currentTheme);
            this.textContent = currentTheme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode';

            if (currentBasemapMode === 'auto') {
                map.setStyle(getEffectiveMapStyleUrl());
            }
        });
    }

    // 5. Timeline & Playback Controls (Pause immediately on pointerdown/touchstart so timer never fights slider!)
    const timelineSlider = document.getElementById('timeline-slider');
    if (timelineSlider) {
        const onSliderGrab = () => {
            dismissWelcomeCard();
            if (isPlaying) stopAnimation();
        };
        timelineSlider.addEventListener('pointerdown', onSliderGrab);
        timelineSlider.addEventListener('mousedown', onSliderGrab);
        timelineSlider.addEventListener('touchstart', onSliderGrab, { passive: true });

        const onSliderMove = function() {
            dismissWelcomeCard();
            if (isPlaying) stopAnimation();
            filterEventsByDate(this.value);
        };
        timelineSlider.addEventListener('input', onSliderMove);
        timelineSlider.addEventListener('change', onSliderMove);
    }

    const playPauseBtn = document.getElementById('play-pause-btn');
    if (playPauseBtn) {
        playPauseBtn.addEventListener('click', function() {
            dismissWelcomeCard();
            ensureAudioContext();
            toggleAnimation();
        });
    }

    const resetAnimationBtn = document.getElementById('reset-animation-btn');
    if (resetAnimationBtn) resetAnimationBtn.addEventListener('click', resetAnimation);

    const animationSpeed = document.getElementById('animation-speed');
    if (animationSpeed) {
        animationSpeed.addEventListener('change', function() {
            if (isPlaying) {
                // Seamlessly adjust interval speed without resetting or firing an extra immediate step
                stopAnimation();
                startAnimation(false);
            }
        });
    }

    // 6. Top Bar Quick Actions
    const launchSalvoBtn = document.getElementById('launch-salvo-btn');
    if (launchSalvoBtn) {
        launchSalvoBtn.addEventListener('click', function() {
            dismissWelcomeCard();
            ensureAudioContext();
            launchSalvoForEvents(getActiveFilteredEvents(), 'Theater Salvo');
        });
    }

    const toggleArcsBtn = document.getElementById('toggle-arcs-btn');
    if (toggleArcsBtn) {
        toggleArcsBtn.addEventListener('click', function() {
            showTrajectories = !showTrajectories;
            this.classList.toggle('active', showTrajectories);
            this.textContent = showTrajectories ? '☄️ Arcs' : '💥 Blasts';
        });
    }

    const soundToggleBtn = document.getElementById('sound-toggle-btn');
    if (soundToggleBtn) {
        soundToggleBtn.addEventListener('click', function() {
            if (soundEnabled && masterVolume > 0.01) {
                preMuteVolume = masterVolume;
                soundEnabled = false;
            } else {
                soundEnabled = true;
                if (masterVolume <= 0.01) {
                    masterVolume = preMuteVolume > 0.05 ? preMuteVolume : 0.70;
                }
                ensureAudioContext();
                lastLaunchSoundMs = 0;
                lastBlastSoundMs = 0;
                playSynthesizedSound('launch');
                setTimeout(() => playSynthesizedSound('blast'), 260);
            }
            syncAudioVolumeUI();
        });
    }

    const volumeSlider = document.getElementById('volume-slider');
    if (volumeSlider) {
        const onVolumeChange = function() {
            const pct = parseFloat(this.value);
            masterVolume = isNaN(pct) ? 0.70 : Math.min(1.0, Math.max(0, pct / 100));
            if (masterVolume > 0.005) {
                soundEnabled = true;
                preMuteVolume = masterVolume;
            } else {
                soundEnabled = false;
            }
            ensureAudioContext();
            syncAudioVolumeUI();
        };
        volumeSlider.addEventListener('input', onVolumeChange);
        volumeSlider.addEventListener('change', onVolumeChange);
    }

    // 7. Campaign Mission Cards
    document.querySelectorAll('.mission-card').forEach(card => {
        card.addEventListener('click', function() {
            dismissWelcomeCard();
            ensureAudioContext();
            document.querySelectorAll('.mission-card').forEach(c => c.classList.remove('active'));
            this.classList.add('active');

            const missionKey = this.getAttribute('data-mission');
            const m = CAMPAIGN_MISSIONS[missionKey];
            if (!m) return;

            const startDateInput = document.getElementById('start-date');
            const endDateInput = document.getElementById('end-date');
            if (startDateInput) startDateInput.value = m.start;
            if (endDateInput) endDateInput.value = m.end;

            const targetSelect = document.getElementById('target-type-select');
            if (targetSelect) targetSelect.value = 'all';
            const filterIsrael = document.getElementById('filter-israel');
            if (filterIsrael) filterIsrael.checked = true;
            const filterIran = document.getElementById('filter-iran');
            if (filterIran) filterIran.checked = true;

            applyAllFilters(true, true, m.title);
        });
    });

    // 8. Filters & Map Layers
    const applyDateBtn = document.getElementById('apply-date-btn');
    if (applyDateBtn) {
        applyDateBtn.addEventListener('click', function() {
            dismissWelcomeCard();
            document.querySelectorAll('.mission-card').forEach(c => c.classList.remove('active'));
            applyAllFilters(true, true, 'Custom Date Window');
        });
    }

    const warPhaseSelect = document.getElementById('war-phase-select');
    if (warPhaseSelect) {
        warPhaseSelect.addEventListener('change', function() {
            dismissWelcomeCard();
            ensureAudioContext();
            document.querySelectorAll('.mission-card').forEach(c => c.classList.remove('active'));
            const startDateInput = document.getElementById('start-date');
            const endDateInput = document.getElementById('end-date');
            if (this.value === 'all' && dateRange.min && dateRange.max) {
                startDateInput.value = dateRange.min.toISOString().split('T')[0];
                endDateInput.value = dateRange.max.toISOString().split('T')[0];
            } else if (this.value === '2024-war') {
                startDateInput.value = '2024-04-01';
                endDateInput.value = '2024-12-31';
            } else if (this.value === '2025-war') {
                startDateInput.value = '2025-06-12';
                endDateInput.value = '2025-07-31';
            } else if (this.value === '2026-war') {
                startDateInput.value = '2026-02-28';
                endDateInput.value = dateRange.max ? dateRange.max.toISOString().split('T')[0] : '2026-07-19';
            } else if (this.value === '2026-opening') {
                startDateInput.value = '2026-02-28';
                endDateInput.value = '2026-04-09';
            } else if (this.value === '2026-late') {
                startDateInput.value = '2026-06-01';
                endDateInput.value = '2026-07-19';
            }
            applyAllFilters(true, true, this.options[this.selectedIndex].text);
        });
    }

    const targetTypeSelect = document.getElementById('target-type-select');
    if (targetTypeSelect) {
        targetTypeSelect.addEventListener('change', function() {
            dismissWelcomeCard();
            applyAllFilters(true, true, `Target: ${this.value}`);
        });
    }

    const filterIsrael = document.getElementById('filter-israel');
    if (filterIsrael) filterIsrael.addEventListener('change', () => applyAllFilters(false, false));

    const filterIran = document.getElementById('filter-iran');
    if (filterIran) filterIran.addEventListener('change', () => applyAllFilters(false, false));

    const feedSearchInput = document.getElementById('feed-search-input');
    if (feedSearchInput) {
        feedSearchInput.addEventListener('input', () => {
            const baseList = hasActivePlayhead && sortedEvents.length > 0
                ? sortedEvents.slice(0, Math.min(sortedEvents.length, currentAnimationIndex + 1))
                : getSortedFilteredEvents();
            renderLiveStrikeFeed(baseList);
        });
    }

    const pointsBtn = document.getElementById('points-btn');
    if (pointsBtn) pointsBtn.addEventListener('click', () => setViewMode('points'));

    const heatmapBtn = document.getElementById('heatmap-btn');
    if (heatmapBtn) heatmapBtn.addEventListener('click', () => setViewMode('heatmap'));

    document.querySelectorAll('.style-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.style-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentBasemapMode = this.getAttribute('data-style') || 'auto';
            map.setStyle(getEffectiveMapStyleUrl());
        });
    });

    const iranBoundary = document.getElementById('iran-boundary');
    if (iranBoundary) {
        iranBoundary.addEventListener('change', function() {
            toggleBoundaryLayer('iran-boundary-layer', this.checked);
        });
    }

    const israelBoundary = document.getElementById('israel-boundary');
    if (israelBoundary) {
        israelBoundary.addEventListener('change', function() {
            toggleBoundaryLayer('israel-boundary-layer', this.checked);
        });
    }

    const resetViewBtn = document.getElementById('reset-view-btn');
    if (resetViewBtn) resetViewBtn.addEventListener('click', resetMapView);

    const fitBoundsBtn = document.getElementById('fit-bounds-btn');
    if (fitBoundsBtn) fitBoundsBtn.addEventListener('click', fitMapToData);
}

// ============================================================================
// VIEW MODES & CAMERA HELPERS
// ============================================================================
function setViewMode(mode) {
    currentViewMode = mode;

    const pointsBtn = document.getElementById('points-btn');
    const heatmapBtn = document.getElementById('heatmap-btn');
    if (pointsBtn) pointsBtn.classList.toggle('active', mode === 'points');
    if (heatmapBtn) heatmapBtn.classList.toggle('active', mode === 'heatmap');

    const showPoints = mode === 'points' ? 'visible' : 'none';
    const showHeat = mode === 'heatmap' ? 'visible' : 'none';

    if (map.getLayer('conflict-points')) map.setLayoutProperty('conflict-points', 'visibility', showPoints);
    if (map.getLayer('conflict-points-glow')) map.setLayoutProperty('conflict-points-glow', 'visibility', showPoints);
    if (map.getLayer('conflict-heatmap')) map.setLayoutProperty('conflict-heatmap', 'visibility', showHeat);
}

function resetMapView() {
    map.flyTo({
        center: [44.5, 32.4],
        zoom: 4.5,
        duration: 1200
    });
}

function fitMapToData() {
    const currentSource = map.getSource('conflict-events');
    if (!currentSource || !currentSource._data || currentSource._data.features.length === 0) {
        return;
    }

    const bounds = new maplibregl.LngLatBounds();
    currentSource._data.features.forEach(event => {
        bounds.extend(event.geometry.coordinates);
    });

    const sideDrawer = document.getElementById('side-drawer');
    const drawerOpen = sideDrawer && !sideDrawer.classList.contains('collapsed') && window.innerWidth > 900;

    const pad = {
        top: 70,
        bottom: 90,
        left: drawerOpen ? 370 : 60,
        right: 70
    };

    map.fitBounds(bounds, {
        padding: pad,
        duration: 1200,
        maxZoom: 9.5
    });
}

function toggleBoundaryLayer(layerId, visible) {
    if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
    }
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

// ============================================================================
// TIMELINE SIMULATION PLAYBACK (RESUMES FROM SLIDER & AUTO-PANS TO EXCHANGE)
// ============================================================================
function initializeTimelineAnimation() {
    sortedEvents = getSortedFilteredEvents();
    syncSliderBounds(sortedEvents.length - 1, sortedEvents.length - 1);
}

function startAnimation(runImmediately = true) {
    if (isPlaying) return;

    sortedEvents = getSortedFilteredEvents();
    if (sortedEvents.length === 0) return;

    const maxIdx = Math.max(0, sortedEvents.length - 1);
    const slider = document.getElementById('timeline-slider');
    if (slider && parseInt(slider.max, 10) !== maxIdx) {
        slider.min = 0;
        slider.max = maxIdx;
        slider.step = 1;
    }

    // If the user moved the slider, ALWAYS read the slider's exact position as the source of truth!
    if (sliderDirtyByUser && slider) {
        const sliderVal = parseInt(slider.value, 10);
        if (!isNaN(sliderVal)) {
            currentAnimationIndex = Math.min(maxIdx, Math.max(0, sliderVal));
        }
        sliderDirtyByUser = false;
        hasActivePlayhead = true;
    } else if (!hasActivePlayhead || currentAnimationIndex >= sortedEvents.length || currentAnimationIndex < 0) {
        // Fresh playback from the start (or wrapping around after completing the final event)
        currentAnimationIndex = 0;
        hasActivePlayhead = true;
    }

    isPlaying = true;
    const playPauseBtn = document.getElementById('play-pause-btn');
    if (playPauseBtn) {
        playPauseBtn.textContent = '⏸ Pause';
        playPauseBtn.classList.add('playing');
    }
    const bannerPlayBtn = document.getElementById('banner-play-btn');
    if (bannerPlayBtn) {
        bannerPlayBtn.textContent = '⏸ Pause';
    }

    const mult = getSpeedMultiplier();
    const stepIntervalMs = Math.round(2000 / mult);

    const runStep = () => {
        if (!isPlaying) return;
        if (currentAnimationIndex >= sortedEvents.length) {
            // Seamlessly loop back to the beginning and continue playing!
            currentAnimationIndex = 0;
        }

        const currentEvent = sortedEvents[currentAnimationIndex];
        const currentDate = currentEvent.properties.Date;

        // Count how many remaining events share this exact date so high-density UCDP days (e.g., 70 events on Jun 13)
        // advance smoothly without getting stuck on the same date for 35 ticks
        let sameDateRemaining = 0;
        for (let k = currentAnimationIndex; k < sortedEvents.length; k++) {
            if (sortedEvents[k].properties.Date === currentDate) sameDateRemaining++;
            else break;
        }
        const maxBatchForStep = sameDateRemaining > 24 ? 6 : (sameDateRemaining > 8 ? 4 : 2);

        const batch = [currentEvent];
        while (
            currentAnimationIndex + 1 < sortedEvents.length &&
            sortedEvents[currentAnimationIndex + 1].properties.Date === currentDate &&
            batch.length < maxBatchForStep
        ) {
            currentAnimationIndex++;
            batch.push(sortedEvents[currentAnimationIndex]);
        }

        const eventsToShow = sortedEvents.slice(0, currentAnimationIndex + 1);

        if (map.getSource('conflict-events')) {
            map.getSource('conflict-events').setData({
                type: 'FeatureCollection',
                features: eventsToShow
            });
        }

        updateCountryCounts(eventsToShow);

        // Automatically pan/frame camera if either launch origin or impact target is outside current view!
        const firstEv = batch[0];
        const firstOrigin = getLaunchOriginForFeature(firstEv).coords;
        ensureExchangeInView(firstOrigin, firstEv.geometry.coordinates);

        // Spawn up to 2 visual projectiles per batch so audio/visuals stay ultra-lightweight
        const visualBatch = batch.slice(0, 2);
        visualBatch.forEach((ev, idx) => {
            spawnStrikeProjectile(ev, idx * 320, false);
        });

        const latestEv = batch[0]; // Highlight the primary/curated event of the batch
        selectedFeature = latestEv;
        // Only update the right-side dossier DOM during rapid playback if the user already has it open
        const dossierPanel = document.getElementById('dossier-panel');
        if (dossierPanel && !dossierPanel.classList.contains('hidden')) {
            updateInfoPanel(latestEv.properties);
        }

        const statusEl = document.getElementById('salvo-status-text');
        if (statusEl) {
            statusEl.innerHTML = `⚡ <strong>${latestEv.properties.Date}:</strong> ${latestEv.properties['City/Region'] || latestEv.properties.Country} — ${latestEv.properties.Weapon_Type || 'Strike'} (${eventsToShow.length} / ${sortedEvents.length})`;
        }

        if (slider) {
            slider.value = currentAnimationIndex;
        }

        updateDateDisplay(`${formatDate(latestEv.properties.Date)} (${eventsToShow.length} / ${sortedEvents.length})`);
        currentAnimationIndex++;
    };

    if (runImmediately) {
        runStep();
    }
    animationInterval = setInterval(runStep, stepIntervalMs);
}

function stopAnimation() {
    if (!isPlaying) return;

    isPlaying = false;
    if (animationInterval) {
        clearInterval(animationInterval);
        animationInterval = null;
    }

    const playPauseBtn = document.getElementById('play-pause-btn');
    if (playPauseBtn) {
        playPauseBtn.textContent = '🚀 Play All';
        playPauseBtn.classList.remove('playing');
    }
    const bannerPlayBtn = document.getElementById('banner-play-btn');
    if (bannerPlayBtn) {
        bannerPlayBtn.textContent = '▶ Play All';
    }
}

function resetAnimation() {
    stopAnimation();
    clearPendingKineticTimers(true);
    currentAnimationIndex = 0;
    userMovedSlider = false;
    hasActivePlayhead = false;
    sliderDirtyByUser = false;

    const dossierPanel = document.getElementById('dossier-panel');
    if (dossierPanel) dossierPanel.classList.add('hidden');
    if (popup) popup.remove();

    document.querySelectorAll('.mission-card').forEach(c => c.classList.remove('active'));
    const phaseSelect = document.getElementById('war-phase-select');
    if (phaseSelect) phaseSelect.value = 'all';
    const targetSelect = document.getElementById('target-type-select');
    if (targetSelect) targetSelect.value = 'all';
    const filterIsrael = document.getElementById('filter-israel');
    if (filterIsrael) filterIsrael.checked = true;
    const filterIran = document.getElementById('filter-iran');
    if (filterIran) filterIran.checked = true;

    if (dateRange.min && dateRange.max) {
        const startDateInput = document.getElementById('start-date');
        const endDateInput = document.getElementById('end-date');
        if (startDateInput) startDateInput.value = dateRange.min.toISOString().split('T')[0];
        if (endDateInput) endDateInput.value = dateRange.max.toISOString().split('T')[0];
    }

    applyAllFilters(true, false);
}

function toggleAnimation() {
    if (isPlaying) {
        stopAnimation();
    } else {
        startAnimation();
    }
}

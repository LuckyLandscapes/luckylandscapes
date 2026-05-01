#!/usr/bin/env node
// Replace the old wizard `if (qzCategoryBtns.length > 0) { ... }` block in
// main.js with a simplified single-page-form handler.
// Idempotent: re-running is a no-op once the new marker is in place.

import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TARGET = join(__dirname, '..', 'main.js');

const NEW_MARKER = '// LL:QUOTE-FORM-V2 — single-page form handler';

const NEW_BLOCK = `${NEW_MARKER}
const qzCategoryBtns = document.querySelectorAll('#qz-categories .qz-option-card');
if (qzCategoryBtns.length > 0) {
    // --- DOM refs ---
    const formCard = document.getElementById('quote-form-card');
    const confirmCard = document.getElementById('quote-confirmation');
    const quoteForm = document.getElementById('quote-form');
    const categoryInput = document.getElementById('q-category');
    const categoryLabelInput = document.getElementById('q-categoryLabel');
    const categoryError = document.getElementById('category-error');

    const categoryLabels = {
        lawn:      'Lawn Care',
        garden:    'Garden & Beds',
        hardscape: 'Hardscaping',
        cleanup:   'Property Cleanup',
        design:    'Design & Build',
        other:     'Something Else',
    };

    // --- Category chip selection (single-select) ---
    function selectCategory(cat) {
        if (!cat) return;
        categoryInput.value = cat;
        if (categoryLabelInput) categoryLabelInput.value = categoryLabels[cat] || cat;
        qzCategoryBtns.forEach(b => b.classList.toggle('selected', b.dataset.category === cat));
        if (categoryError) categoryError.classList.remove('visible');
        trackEvent('quote_category_select', { category: cat });
    }

    qzCategoryBtns.forEach(btn => {
        btn.addEventListener('click', () => selectCategory(btn.dataset.category));
    });

    // --- URL ?category=xxx pre-select ---
    const urlParams = new URLSearchParams(window.location.search);
    const preselect = urlParams.get('category');
    if (preselect && categoryLabels[preselect]) selectCategory(preselect);

    // ============================================
    // PHOTO UPLOAD
    // ============================================
    const photoInput = document.getElementById('q-photos');
    const uploadTrigger = document.getElementById('qz-upload-trigger');
    const uploadPreview = document.getElementById('qz-upload-preview');
    let selectedPhotos = [];

    if (uploadTrigger && photoInput) {
        uploadTrigger.addEventListener('click', () => photoInput.click());
        photoInput.addEventListener('change', () => {
            const newFiles = Array.from(photoInput.files);
            const MAX_PER_FILE = 10 * 1024 * 1024;
            const MAX_TOTAL = 30 * 1024 * 1024;
            const skipped = [];
            let totalBytes = selectedPhotos.reduce((s, f) => s + f.size, 0);
            for (const file of newFiles) {
                if (selectedPhotos.length >= 5) { skipped.push(\`\${file.name} (max 5 photos)\`); continue; }
                if (!file.type.startsWith('image/')) { skipped.push(\`\${file.name} (not an image)\`); continue; }
                if (file.size > MAX_PER_FILE) { skipped.push(\`\${file.name} (over 10 MB)\`); continue; }
                if (totalBytes + file.size > MAX_TOTAL) { skipped.push(\`\${file.name} (combined size limit)\`); continue; }
                selectedPhotos.push(file);
                totalBytes += file.size;
            }
            photoInput.value = '';
            if (skipped.length > 0) alert(\`Skipped:\\n• \${skipped.join('\\n• ')}\`);
            renderPhotoPreview();
        });
    }

    function renderPhotoPreview() {
        if (!uploadPreview) return;
        uploadPreview.innerHTML = '';
        selectedPhotos.forEach((file, idx) => {
            const thumb = document.createElement('div');
            thumb.className = 'qz-upload-thumb';
            const img = document.createElement('img');
            img.src = URL.createObjectURL(file);
            img.alt = file.name;
            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'qz-upload-thumb-remove';
            removeBtn.textContent = '✕';
            removeBtn.addEventListener('click', () => {
                selectedPhotos.splice(idx, 1);
                renderPhotoPreview();
            });
            thumb.appendChild(img);
            thumb.appendChild(removeBtn);
            uploadPreview.appendChild(thumb);
        });
    }

    async function getPhotoData() {
        const out = [];
        for (const file of selectedPhotos) {
            const reader = new FileReader();
            const b64 = await new Promise((resolve) => {
                reader.onload = () => resolve(reader.result.split(',')[1]);
                reader.readAsDataURL(file);
            });
            out.push({ name: file.name, type: file.type, data: b64 });
        }
        return out;
    }

    // ============================================
    // SUBMISSION (Apps Script + luckyapp lead intake)
    // ============================================
    async function submitQuestionnaire(data) {
        const payload = { ...data };
        if (selectedPhotos.length > 0) payload.photos = await getPhotoData();
        const tasks = [];
        if (QUOTES_SCRIPT_URL) {
            tasks.push(
                fetch(QUOTES_SCRIPT_URL, {
                    method: 'POST', mode: 'no-cors',
                    headers: { 'Content-Type': 'text/plain' },
                    body: JSON.stringify(payload),
                }).catch(err => console.error('Apps Script submission error:', err))
            );
        }
        if (LEADS_INTAKE_URL) {
            const { photos, ...leadPayload } = payload;
            tasks.push(
                fetch(LEADS_INTAKE_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(leadPayload),
                }).then(r => { if (!r.ok) console.error('Lead intake failed', r.status); })
                  .catch(err => console.error('Lead intake error:', err))
            );
        }
        await Promise.allSettled(tasks);
    }

    // ============================================
    // CONFETTI (kept from old version — visual reward on submit)
    // ============================================
    function spawnConfetti() {
        const container = document.getElementById('confetti-container');
        if (!container) return;
        container.innerHTML = '';
        const colors = ['#6B8E4E', '#8FAF72', '#B5CFA0', '#5A7A40', '#41a100', '#F7F5F0', '#FFD700'];
        for (let i = 0; i < 60; i++) {
            const piece = document.createElement('div');
            piece.className = 'confetti-piece';
            piece.style.left = Math.random() * 100 + '%';
            piece.style.top = '-10px';
            piece.style.background = colors[Math.floor(Math.random() * colors.length)];
            piece.style.animationDelay = Math.random() * 1.5 + 's';
            piece.style.animationDuration = (2 + Math.random() * 2) + 's';
            piece.style.width = (6 + Math.random() * 8) + 'px';
            piece.style.height = (6 + Math.random() * 8) + 'px';
            piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
            container.appendChild(piece);
        }
    }

    // ============================================
    // AUTOSAVE (localStorage) — keeps partial leads alive
    // ============================================
    const AUTOSAVE_KEY = 'lucky_quote_partial';
    const AUTOSAVE_TTL_DAYS = 7;
    const AUTOSAVE_FIELDS = ['q-firstName', 'q-lastName', 'q-email', 'q-phone', 'q-address', 'q-description'];

    function loadAutosave() {
        try {
            const raw = localStorage.getItem(AUTOSAVE_KEY);
            if (!raw) return null;
            const data = JSON.parse(raw);
            if (!data || !data.savedAt) return null;
            if ((Date.now() - data.savedAt) / 86400000 > AUTOSAVE_TTL_DAYS) {
                localStorage.removeItem(AUTOSAVE_KEY);
                return null;
            }
            return data;
        } catch (_) { return null; }
    }

    function saveAutosave() {
        try {
            const payload = { savedAt: Date.now() };
            AUTOSAVE_FIELDS.forEach(id => {
                const el = document.getElementById(id);
                if (el && el.value.trim()) payload[el.name] = el.value;
            });
            if (categoryInput && categoryInput.value) payload.category = categoryInput.value;
            if (Object.keys(payload).length <= 1) return;
            localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(payload));
        } catch (_) {}
    }

    function clearAutosave() {
        try { localStorage.removeItem(AUTOSAVE_KEY); } catch (_) {}
    }

    (function restoreAutosave() {
        const data = loadAutosave();
        if (!data) return;
        const map = { firstName: 'q-firstName', lastName: 'q-lastName', email: 'q-email', phone: 'q-phone', address: 'q-address', project_description: 'q-description' };
        Object.entries(map).forEach(([k, id]) => {
            const el = document.getElementById(id);
            if (el && data[k] && !el.value) el.value = data[k];
        });
        if (data.category && categoryLabels[data.category]) selectCategory(data.category);
        trackEvent('quote_autosave_restored');
    })();

    AUTOSAVE_FIELDS.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', saveAutosave);
    });

    // ============================================
    // PHONE auto-format + EMAIL validation
    // ============================================
    const phoneInput = document.getElementById('q-phone');
    if (phoneInput) {
        phoneInput.addEventListener('input', (e) => {
            let val = e.target.value.replace(/\\D/g, '').slice(0, 10);
            let f = '';
            if (val.length > 0) f += '(' + val.slice(0, 3);
            if (val.length >= 3) f += ') ';
            if (val.length > 3) f += val.slice(3, 6);
            if (val.length >= 6) f += '-';
            if (val.length > 6) f += val.slice(6, 10);
            e.target.value = f;
            const group = phoneInput.closest('.form-group');
            if (val.length === 10 && group) group.classList.remove('has-error');
        });
        phoneInput.addEventListener('blur', () => {
            const digits = phoneInput.value.replace(/\\D/g, '');
            const group = phoneInput.closest('.form-group');
            if (group) group.classList.toggle('has-error', digits.length > 0 && digits.length < 10);
        });
    }

    const emailInput = document.getElementById('q-email');
    if (emailInput) {
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$/;
        emailInput.addEventListener('blur', () => {
            const v = emailInput.value.trim();
            const group = emailInput.closest('.form-group');
            if (group) group.classList.toggle('has-error', v.length > 0 && !emailRegex.test(v));
        });
        emailInput.addEventListener('input', () => {
            const group = emailInput.closest('.form-group');
            if (group && emailRegex.test(emailInput.value.trim())) group.classList.remove('has-error');
        });
    }

    // ============================================
    // SUBMIT
    // ============================================
    if (quoteForm) {
        quoteForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const firstName = document.getElementById('q-firstName').value.trim();
            const lastName  = document.getElementById('q-lastName').value.trim();
            const email     = document.getElementById('q-email').value.trim();
            const phone     = document.getElementById('q-phone').value.trim();
            const description = document.getElementById('q-description').value.trim();
            const category  = categoryInput.value;

            // Required: category + first/last name + email + description.
            if (!category) {
                if (categoryError) categoryError.classList.add('visible');
                document.getElementById('qz-categories').scrollIntoView({ behavior: 'smooth', block: 'center' });
                return;
            }
            if (!firstName || !lastName || !email || !description) {
                quoteForm.reportValidity();
                return;
            }
            const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$/;
            if (!emailRegex.test(email)) {
                document.getElementById('q-email').closest('.form-group').classList.add('has-error');
                document.getElementById('q-email').focus();
                return;
            }
            if (phone) {
                const digits = phone.replace(/\\D/g, '');
                if (digits.length < 10) {
                    document.getElementById('q-phone').closest('.form-group').classList.add('has-error');
                    document.getElementById('q-phone').focus();
                    return;
                }
            }

            const btn = document.getElementById('qz-submit');
            const originalHTML = btn.innerHTML;
            btn.innerHTML = '<span class="spinner"></span> Submitting...';
            btn.disabled = true;

            const fd = new FormData(quoteForm);
            const data = {};
            for (const [k, v] of fd.entries()) {
                if (v && k !== 'photos') data[k] = v;
            }
            if (selectedPhotos.length > 0) {
                data.photoCount = selectedPhotos.length;
                data.photoNames = selectedPhotos.map(f => f.name).join(', ');
            }

            // If Turnstile is configured, include the token so the backend can verify.
            const turnstileResp = quoteForm.querySelector('[name="cf-turnstile-response"]');
            if (turnstileResp && turnstileResp.value) data.turnstile_token = turnstileResp.value;

            await submitQuestionnaire(data);
            clearAutosave();

            trackEvent('quote_submit', {
                category,
                budget: data.project_budget || 'unspecified',
                timeline: data.project_timeline || 'unspecified',
                has_address: !!data.address,
                has_photos: !!data.photoCount,
            });
            trackEvent('generate_lead', { value: 1, currency: 'USD' });

            // Swap form card for confirmation card.
            if (formCard) formCard.classList.add('quote-step-hidden');
            if (confirmCard) {
                confirmCard.classList.remove('quote-step-hidden');
                spawnConfetti();
                confirmCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }

            btn.innerHTML = originalHTML;
            btn.disabled = false;
        });
    }

    // ============================================
    // ADDRESS AUTOCOMPLETE + lazy Leaflet (preserved from prior version)
    // ============================================
    const addressInput = document.getElementById('q-address');
    const suggestionsEl = document.getElementById('address-suggestions');
    const mapWrap = document.getElementById('address-map-wrap');
    const mapEl = document.getElementById('address-minimap');
    const mapLabel = document.getElementById('address-map-label');

    let leafletLoaded = false;
    function loadLeaflet() {
        if (leafletLoaded || typeof L !== 'undefined') { leafletLoaded = true; return Promise.resolve(); }
        return new Promise((resolve) => {
            const css = document.createElement('link');
            css.rel = 'stylesheet';
            css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
            css.crossOrigin = '';
            document.head.appendChild(css);
            const js = document.createElement('script');
            js.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
            js.crossOrigin = '';
            js.onload = () => { leafletLoaded = true; resolve(); };
            js.onerror = () => resolve();
            document.head.appendChild(js);
        });
    }

    if (addressInput) {
        const triggerLeafletLoad = () => { loadLeaflet(); addressInput.removeEventListener('focus', triggerLeafletLoad); addressInput.removeEventListener('input', triggerLeafletLoad); };
        addressInput.addEventListener('focus', triggerLeafletLoad, { once: true });
        addressInput.addEventListener('input', triggerLeafletLoad, { once: true });
    }

    if (addressInput && suggestionsEl) {
        let debounceTimer = null, focusedIdx = -1, currentResults = [], miniMap = null, miniMapMarker = null;

        const luckyPinSvg = \`<svg xmlns="http://www.w3.org/2000/svg" width="40" height="52" viewBox="0 0 40 52"><defs><filter id="pinShadow" x="-20%" y="-10%" width="140%" height="130%"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000" flood-opacity="0.3"/></filter></defs><path d="M20 51 C20 51 3 31 3 18 A17 17 0 0 1 37 18 C37 31 20 51 20 51Z" fill="#4a7c34" filter="url(#pinShadow)"/><path d="M20 49 C20 49 5 30 5 18.5 A15 15 0 0 1 35 18.5 C35 30 20 49 20 49Z" fill="#6B8E4E"/><circle cx="20" cy="18" r="11" fill="rgba(255,255,255,0.2)"/><g transform="translate(20,18)" fill="#fff"><ellipse cx="0" cy="-4" rx="3.2" ry="4" opacity="0.95"/><ellipse cx="0" cy="4" rx="3.2" ry="4" opacity="0.95"/><ellipse cx="-4" cy="0" rx="4" ry="3.2" opacity="0.95"/><ellipse cx="4" cy="0" rx="4" ry="3.2" opacity="0.95"/><circle cx="0" cy="0" r="2" fill="#6B8E4E"/></g></svg>\`;

        async function initMiniMap(lat, lon) {
            if (!mapEl) return;
            if (typeof L === 'undefined') await loadLeaflet();
            if (typeof L === 'undefined') return;
            mapWrap.style.display = '';
            requestAnimationFrame(() => mapWrap.classList.add('visible'));
            const luckyPinIcon = L.icon({ iconUrl: 'data:image/svg+xml;base64,' + btoa(luckyPinSvg), iconSize: [40, 52], iconAnchor: [20, 52], popupAnchor: [0, -52] });
            if (!miniMap) {
                miniMap = L.map(mapEl, { zoomControl: false, attributionControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false, touchZoom: false, boxZoom: false, keyboard: false }).setView([lat, lon], 16);
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(miniMap);
                L.control.attribution({ prefix: false, position: 'bottomright' }).addAttribution('© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>').addTo(miniMap);
                miniMapMarker = L.marker([lat, lon], { icon: luckyPinIcon }).addTo(miniMap);
            } else {
                miniMap.setView([lat, lon], 16);
                miniMapMarker.setLatLng([lat, lon]);
            }
            setTimeout(() => miniMap.invalidateSize(), 350);
        }

        function hideMiniMap() {
            if (mapWrap) {
                mapWrap.classList.remove('visible');
                setTimeout(() => mapWrap.style.display = 'none', 300);
            }
        }

        function formatAddress(r) {
            const a = r.address || {};
            const parts = [];
            const road = a.road || '';
            if (road) parts.push((a.house_number ? a.house_number + ' ' : '') + road);
            const city = a.city || a.town || a.village || '';
            if (city) parts.push(city);
            if (a.state || a.postcode) parts.push((a.state || '') + (a.postcode ? ' ' + a.postcode : ''));
            return parts.join(', ') || r.display_name;
        }

        function renderSuggestions(results) {
            currentResults = results; focusedIdx = -1;
            if (results.length === 0) {
                suggestionsEl.innerHTML = '<div class="addr-no-results">No addresses found — try a more specific search</div>';
                suggestionsEl.classList.add('visible');
                setTimeout(() => suggestionsEl.classList.remove('visible'), 3000);
                return;
            }
            suggestionsEl.innerHTML = results.map((r, i) => {
                const a = r.address || {};
                const main = a.road ? (a.house_number ? a.house_number + ' ' : '') + a.road : (r.display_name || '').split(',')[0];
                const sub = [a.city || a.town || a.village || '', a.state || ''].filter(Boolean).join(', ');
                return \`<div class="address-suggestion-item" data-idx="\${i}"><div class="addr-text"><strong>\${main}</strong><span>\${sub}</span></div></div>\`;
            }).join('');
            suggestionsEl.classList.add('visible');
            suggestionsEl.querySelectorAll('.address-suggestion-item').forEach(item => {
                item.addEventListener('mousedown', (e) => { e.preventDefault(); selectAddress(currentResults[parseInt(item.dataset.idx, 10)]); });
            });
        }

        function selectAddress(r) {
            const f = formatAddress(r);
            addressInput.value = f;
            saveAutosave();
            suggestionsEl.classList.remove('visible');
            const lat = parseFloat(r.lat), lon = parseFloat(r.lon);
            if (!isNaN(lat) && !isNaN(lon)) {
                initMiniMap(lat, lon);
                if (mapLabel) mapLabel.textContent = f;
            }
            addressInput.classList.add('addr-confirmed');
            setTimeout(() => addressInput.classList.remove('addr-confirmed'), 1500);
        }

        let currentAbort = null;
        async function searchAddress(query) {
            if (query.length < 3) { suggestionsEl.classList.remove('visible'); return; }
            if (currentAbort) currentAbort.abort();
            currentAbort = new AbortController();
            const signal = currentAbort.signal;
            suggestionsEl.innerHTML = '<div class="addr-loading"><span class="addr-loading-spinner"></span> Searching addresses...</div>';
            suggestionsEl.classList.add('visible');
            try {
                const geoapifyKey = (window.LL_CONFIG && window.LL_CONFIG.geoapify) || '';
                let merged = [];
                if (geoapifyKey) {
                    const url = \`https://api.geoapify.com/v1/geocode/autocomplete?text=\${encodeURIComponent(query)}&filter=countrycode:us&bias=proximity:-96.7026,40.8136&limit=6&apiKey=\${geoapifyKey}\`;
                    const res = await fetch(url, { signal });
                    if (signal.aborted) return;
                    if (res.ok) {
                        const json = await res.json();
                        merged = (json.features || []).map(f => {
                            const p = f.properties || {};
                            return { display_name: p.formatted, lat: p.lat, lon: p.lon, address: { house_number: p.housenumber, road: p.street, city: p.city || p.town || p.village, state: p.state, postcode: p.postcode } };
                        });
                    }
                } else {
                    const neUrl = \`https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=6&countrycodes=us&viewbox=-104.1,43.0,-95.3,40.0&bounded=1&q=\${encodeURIComponent(query)}\`;
                    const res = await fetch(neUrl, { signal, headers: { 'Accept-Language': 'en-US,en' } });
                    if (signal.aborted) return;
                    if (res.ok) merged = await res.json();
                }
                renderSuggestions(merged.slice(0, 6));
            } catch (e) {
                if (e.name === 'AbortError') return;
                suggestionsEl.innerHTML = '<div class="addr-loading addr-error">Unable to search — type your full address</div>';
                setTimeout(() => suggestionsEl.classList.remove('visible'), 3000);
            }
        }

        addressInput.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            const v = addressInput.value.trim();
            if (v.length < 3) {
                suggestionsEl.classList.remove('visible');
                if (currentAbort) currentAbort.abort();
                if (v.length === 0) hideMiniMap();
                return;
            }
            debounceTimer = setTimeout(() => searchAddress(v), 250);
        });

        addressInput.addEventListener('keydown', (e) => {
            const items = suggestionsEl.querySelectorAll('.address-suggestion-item');
            if (!items.length) return;
            if (e.key === 'ArrowDown') { e.preventDefault(); focusedIdx = Math.min(focusedIdx + 1, items.length - 1); items.forEach((it, i) => it.classList.toggle('focused', i === focusedIdx)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); focusedIdx = Math.max(focusedIdx - 1, 0); items.forEach((it, i) => it.classList.toggle('focused', i === focusedIdx)); }
            else if (e.key === 'Enter' && focusedIdx >= 0) { e.preventDefault(); selectAddress(currentResults[focusedIdx]); }
            else if (e.key === 'Escape') suggestionsEl.classList.remove('visible');
        });

        addressInput.addEventListener('blur', () => setTimeout(() => suggestionsEl.classList.remove('visible'), 200));
    }
}`;

const js = await readFile(TARGET, 'utf8');

if (js.includes(NEW_MARKER)) {
    console.log('main.js already migrated to the new quote handler.');
    process.exit(0);
}

// Find the wizard block: const qzCategoryBtns ... up to the matching } of `if (qzCategoryBtns.length > 0) {`.
const startMarker = "const qzCategoryBtns = document.querySelectorAll('#qz-categories .qz-option-card, .qz-notsure-btn[data-category]');";
const startIdx = js.indexOf(startMarker);
if (startIdx < 0) { console.error('Could not find wizard start marker.'); process.exit(1); }

// Walk braces to find the close of `if (qzCategoryBtns.length > 0) { ... }`.
const ifStart = js.indexOf('if (qzCategoryBtns.length > 0) {', startIdx);
if (ifStart < 0) { console.error('Could not find if-block start.'); process.exit(1); }
let depth = 0, endIdx = -1;
for (let i = ifStart; i < js.length; i++) {
    const c = js[i];
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { endIdx = i + 1; break; } }
}
if (endIdx < 0) { console.error('Could not find if-block end.'); process.exit(1); }

const before = js.substring(0, startIdx);
const after = js.substring(endIdx);
const newJs = before + NEW_BLOCK + after;

await writeFile(TARGET, newJs);
const oldLines = js.split('\n').length;
const newLines = newJs.split('\n').length;
console.log(`Rewrote main.js: ${oldLines} → ${newLines} lines (saved ${oldLines - newLines})`);

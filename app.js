

let designMode = "light mode";
let colorCounter = 0;
let inputMode = "manual"; // 'manual' | 'image'
let uploadedImageSrc = null;
let imageColorsReady = false;

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function parseAiJson(text) {
  if (!text || typeof text !== "string") {
    throw new SyntaxError("Empty AI response");
  }
  const clean = text.replace(/```json|```/gi, "").trim();
  return JSON.parse(clean);
}

function normalizeAnalysis(parsed, colorCount) {
  const overview = typeof parsed?.overview === "string" ? parsed.overview : "No overview provided.";
  const harmony = typeof parsed?.harmony === "string" ? parsed.harmony : "No harmony notes provided.";
  const colors = Array.isArray(parsed?.colors) ? parsed.colors : [];
  const suggestions = Array.isArray(parsed?.suggestions) ? parsed.suggestions : [];

  while (colors.length < colorCount) {
    colors.push({ analysis: "No analysis provided for this color." });
  }

  return {
    overview,
    harmony,
    colors: colors.slice(0, colorCount),
    suggestions: suggestions
      .filter((s) => s && typeof s.hex === "string" && typeof s.replaces === "string")
      .slice(0, 5)
  };
}

const availableRoles = [
  "primary", "secondary", "background", "text",
  "accent", "border", "icon", "heading", "surface", "error"
];

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
  addColorRow('#6d28d9', 'primary');
  setupToggles();
  setupTextarea();
  setupDragAndDrop();
});

// --- UI SETUP & TOGGLES ---
function setupToggles() {
  // Tabs
  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const current = e.currentTarget;
      tabBtns.forEach(b => b.classList.remove('active'));
      current.classList.add('active');
      const target = current.getAttribute('data-tab');
      document.querySelectorAll('.tab-content').forEach(tc => tc.style.display = 'none');
      document.getElementById(target).style.display = 'block';
      inputMode = target === 'tab-manual' ? 'manual' : 'image';
      document.getElementById('error-msg').style.display = 'none';
    });
  });

  // Mode
  const modeBtns = document.querySelectorAll('.mode-btn');
  modeBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const current = e.currentTarget;
      modeBtns.forEach(b => b.classList.remove('active'));
      current.classList.add('active');
      designMode = current.getAttribute('data-mode');
    });
  });
}

function setupTextarea() {
  const ta = document.getElementById('project-context');
  const count = document.getElementById('char-count');
  ta.addEventListener('input', () => { count.textContent = `${ta.value.length} / 400`; });
}

// --- TAB A: MANUAL COLORS ---
function addColorRow(defaultHex = '#000000', defaultRole = 'secondary') {
  const rows = document.querySelectorAll('.color-row');
  if (rows.length >= 5) return;

  const id = `color-${colorCounter++}`;
  const row = document.createElement('div');
  row.className = 'color-row';
  row.id = id;

  const roleOptions = availableRoles.map(r =>
    `<option value="${r}" ${r === defaultRole ? 'selected' : ''}>${r}</option>`
  ).join('');

  row.innerHTML = `
    <div class="color-input-wrap">
      <input type="color" class="color-swatch" id="picker-${id}" value="${defaultHex}">
      <input type="text" class="hex-input" id="hex-${id}" value="${defaultHex}" maxlength="7">
    </div>
    <select class="role-select" id="role-${id}">${roleOptions}</select>
    <button class="remove-btn" onclick="removeColorRow('${id}')" title="Remove color">×</button>
  `;

  document.getElementById('colors-list').appendChild(row);
  updateRemoveButtons();

  const picker = document.getElementById(`picker-${id}`);
  const hexIn = document.getElementById(`hex-${id}`);

  picker.addEventListener('input', () => { hexIn.value = picker.value; });
  hexIn.addEventListener('input', () => {
    if (/^#[0-9A-Fa-f]{6}$/.test(hexIn.value)) picker.value = hexIn.value;
  });
}

function removeColorRow(id) {
  const row = document.getElementById(id);
  if (row) row.remove();
  updateRemoveButtons();
}

function updateRemoveButtons() {
  const rows = document.querySelectorAll('.color-row');
  const removeBtns = document.querySelectorAll('.remove-btn');
  removeBtns.forEach(btn => btn.disabled = rows.length <= 1);
  document.getElementById('add-color-btn').disabled = rows.length >= 5;
}

// --- TAB B: IMAGE EXTRACTION (DRAG/DROP & K-MEANS) ---
function setupDragAndDrop() {
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');

  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault(); dropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length) handleImageUpload(e.dataTransfer.files[0]);
  });
  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) handleImageUpload(e.target.files[0]);
  });
}

function handleImageUpload(file) {
  document.getElementById('upload-error').style.display = 'none';
  imageColorsReady = false;
  extractedState = [];
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    return showUploadError("Please upload a JPG, PNG, or WEBP.");
  }
  if (file.size > 5 * 1024 * 1024) {
    return showUploadError("Image must be under 5MB.");
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    uploadedImageSrc = e.target.result;
    document.getElementById('drop-msg').style.display = 'none';
    const preview = document.getElementById('image-preview');
    preview.src = uploadedImageSrc;
    preview.style.display = 'block';
    document.getElementById('extract-btn').style.display = 'block';
    document.getElementById('extraction-results').style.display = 'none';
  };
  reader.onerror = () => showUploadError("Could not read image. Try another file.");
  reader.readAsDataURL(file);
}

function showUploadError(msg) {
  const el = document.getElementById('upload-error');
  el.textContent = msg; el.style.display = 'block';
}

function extractColorsFromImage() {
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    // Downscale for performance
    const MAX_DIM = 200;
    let w = img.width, h = img.height;
    if (w > h && w > MAX_DIM) { h *= MAX_DIM / w; w = MAX_DIM; }
    else if (h > MAX_DIM) { w *= MAX_DIM / h; h = MAX_DIM; }

    canvas.width = w; canvas.height = h;
    ctx.drawImage(img, 0, 0, w, h);

    const data = ctx.getImageData(0, 0, w, h).data;
    const pixels = [];

    // 1. BETTER SAMPLING
    for (let i = 0; i < data.length; i += 4 * 5) {
      if (data[i + 3] >= 128) { // Skip perfectly or semi-transparent pixels
        pixels.push({ r: data[i], g: data[i + 1], b: data[i + 2] });
      }
    }

    if (pixels.length === 0) return showUploadError("Could not read pixels.");

    // 2. INITIALIZATION (k-means++)
    const getEvDist = (p1, p2) => Math.sqrt((p1.r - p2.r) ** 2 + (p1.g - p2.g) ** 2 + (p1.b - p2.b) ** 2);
    let clusters = [];
    const kCount = Math.min(8, pixels.length);
    clusters.push({ center: pixels[Math.floor(Math.random() * pixels.length)], pixels: [] });

    while (clusters.length < kCount) {
      let dSq = pixels.map(p => {
        let minD = Math.min(...clusters.map(c => getEvDist(p, c.center)));
        return minD * minD;
      });
      let sum = dSq.reduce((a, b) => a + b, 0);
      let r = Math.random() * sum;
      let cum = 0;
      let chosen = pixels[0];
      for (let i = 0; i < pixels.length; i++) {
        cum += dSq[i];
        if (cum >= r) { chosen = pixels[i]; break; }
      }
      clusters.push({ center: chosen, pixels: [] });
    }

    // 3. MORE ITERATIONS
    for (let iter = 0; iter < 10; iter++) {
      clusters.forEach(c => { c.pixels = []; c.t = [0, 0, 0]; });

      for (const p of pixels) {
        let minDist = Infinity; let minC = null;
        for (const c of clusters) {
          const d = getEvDist(p, c.center);
          if (d < minDist) { minDist = d; minC = c; }
        }
        if (!minC) continue;
        minC.pixels.push(p);
        minC.t[0] += p.r; minC.t[1] += p.g; minC.t[2] += p.b;
      }

      clusters.forEach(c => {
        if (c.pixels.length > 0) {
          c.center = { r: Math.round(c.t[0] / c.pixels.length), g: Math.round(c.t[1] / c.pixels.length), b: Math.round(c.t[2] / c.pixels.length) };
        }
      });
    }

    // 5. SORT BY DOMINANCE
    clusters.sort((a, b) => b.pixels.length - a.pixels.length);
    let topColors = clusters.map(c => c.center);

    // 4 & 6. DEDUPLICATION AND MINIMUM DIFFERENCE
    let uniqueColors = [];
    for (const c of topColors) {
      const tooClose = uniqueColors.some(u => getEvDist(c, u) < 50);
      if (!tooClose) uniqueColors.push(c);
      if (uniqueColors.length === 5) break;
    }

    while (uniqueColors.length < 5 && pixels.length > 0) {
      let maxDist = -1;
      let candidate = uniqueColors[0] || pixels[0];
      const step = Math.max(1, Math.floor(pixels.length / 1000));
      for (let i = 0; i < pixels.length; i += step) {
        const p = pixels[i];
        const minD = uniqueColors.length > 0 ? Math.min(...uniqueColors.map(u => getEvDist(p, u))) : Infinity;
        if (minD > maxDist) { maxDist = minD; candidate = p; }
      }
      uniqueColors.push(candidate);
    }

    renderExtractedSwatches(uniqueColors.map(c => rgbToHex(c.r, c.g, c.b)));
  };
  img.onerror = () => showUploadError("Failed to decode image.");
  img.src = uploadedImageSrc;
}
function rgbToHex(r, g, b) { return "#" + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join(''); }

let extractedState = [];
function renderExtractedSwatches(hexes) {
  document.getElementById('extract-btn').style.display = 'none';
  document.getElementById('extraction-results').style.display = 'block';
  imageColorsReady = true;

  extractedState = hexes.map((hex, i) => ({ hex, role: availableRoles[i] || 'secondary', active: true }));

  const wrap = document.getElementById('extracted-swatches-wrap');
  wrap.innerHTML = '';

  extractedState.forEach((item, idx) => {
    const row = document.createElement('div');
    row.className = 'ext-row';
    const roleOpts = availableRoles.map(r => `<option value="${r}" ${r === item.role ? 'selected' : ''}>${r}</option>`).join('');

    row.innerHTML = `
      <div class="ext-swatch" style="background:${item.hex}" title="Click to toggle" onclick="toggleExtracted(${idx}, this)"></div>
      <div class="ext-hex">${item.hex}</div>
      <select class="role-select" onchange="extractedState[${idx}].role = this.value">${roleOpts}</select>
    `;
    wrap.appendChild(row);
  });
}

function toggleExtracted(idx, el) {
  extractedState[idx].active = !extractedState[idx].active;
  el.parentElement.classList.toggle('disabled', !extractedState[idx].active);
}

function confirmExtraction() {
  const active = extractedState.filter(e => e.active);
  if (active.length === 0) return showError("Select at least one extracted color.");
  analyze();
}

function resetExtraction() {
  uploadedImageSrc = null;
  imageColorsReady = false;
  extractedState = [];
  document.getElementById('image-preview').style.display = 'none';
  document.getElementById('drop-msg').style.display = 'block';
  document.getElementById('extract-btn').style.display = 'none';
  document.getElementById('extraction-results').style.display = 'none';
  document.getElementById('file-input').value = '';
}

function extractColors() {
  if (inputMode === 'manual') {
    const rows = document.querySelectorAll('.color-row');
    const colors = [];
    rows.forEach(row => {
      colors.push({
        hex: row.querySelector('.hex-input').value.trim(),
        role: row.querySelector('.role-select').value,
        id: row.id
      });
    });
    return colors;
  } else {
    // Return active extracted colors
    return extractedState.filter(e => e.active).map(e => ({ hex: e.hex, role: e.role, id: 'img-color' }));
  }
}

// --- MATH & UTILS ---
function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

function luminance(r, g, b) {
  const a = [r, g, b].map(v => {
    v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

function getContrast(hex1, hex2) {
  const c1 = hexToRgb(hex1); const c2 = hexToRgb(hex2);
  const l1 = luminance(c1.r, c1.g, c1.b); const l2 = luminance(c2.r, c2.g, c2.b);
  const bright = Math.max(l1, l2); const dark = Math.min(l1, l2);
  return ((bright + 0.05) / (dark + 0.05)).toFixed(2);
}

function hexToHsl(hex) {
  let { r, g, b } = hexToRgb(hex); r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) { h = s = 0; } else {
    const d = max - min; s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) { case r: h = (g - b) / d + (g < b ? 6 : 0); break; case g: h = (b - r) / d + 2; break; case b: h = (r - g) / d + 4; break; }
    h /= 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = n => { const k = (n + h / 30) % 12; const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1); return Math.round(255 * color).toString(16).padStart(2, '0'); };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function getTextColor(hex) {
  const { r, g, b } = hexToRgb(hex);
  return (r * 299 + g * 587 + b * 114) / 1000 > 128 ? '#1a1a1a' : '#ffffff';
}

function getBadge(ratio, role) {
  const isText = ['text', 'heading'].includes(role);
  const r = parseFloat(ratio);
  if (isText) {
    if (r >= 7) return { l: 'AAA', c: 'badge-pass' };
    if (r >= 4.5) return { l: 'AA', c: 'badge-aa' };
    return { l: 'Fail', c: 'badge-fail' };
  } else {
    if (r >= 3) return { l: 'Pass', c: 'badge-pass' };
    return { l: 'Fail', c: 'badge-fail' };
  }
}

// --- RENDERING ---
function renderResults(data, colors, mode) {
  const resDiv = document.getElementById('results');

  // 1. Preview Bar
  const previewHTML = colors.map(c => `
    <div class="preview-segment" style="background:${c.hex};">
      <span class="preview-role" style="color:${getTextColor(c.hex)}">${c.role}</span>
    </div>
  `).join('');

  // 2. Overview (Thumbnail injected if image)
  let thumbHTML = '';
  if (inputMode === 'image' && uploadedImageSrc) {
    thumbHTML = `<img src="${uploadedImageSrc}" class="results-thumb" alt="Original Image">`;
  }

  const overviewHTML = `
    <div class="ui-card">
      <div class="section-label">palette overview</div>
      <div class="overview-header">
        ${thumbHTML}
        <div class="overview-text">${escapeHtml(data.overview)}</div>
      </div>
    </div>
  `;

  // 3. Color Blocks
  const colorBlocksHTML = colors.map((c, i) => {
    const analysis = data.colors[i]?.analysis || "No analysis provided.";

    let contrastHTML = '';
    if (mode === 'light mode' || mode === 'both') {
      const cr = getContrast(c.hex, '#ffffff');
      const b = getBadge(cr, c.role);
      contrastHTML += `<div class="contrast-chip"><div class="cc-meta"><div class="cc-label">vs light (#FFF)</div><div class="cc-val">${cr}:1</div></div><span class="badge ${b.c}">${b.l}</span></div>`;
    }
    if (mode === 'dark mode' || mode === 'both') {
      const cr = getContrast(c.hex, '#1a1a1a');
      const b = getBadge(cr, c.role);
      contrastHTML += `<div class="contrast-chip"><div class="cc-meta"><div class="cc-label">vs dark (#1A1A1A)</div><div class="cc-val">${cr}:1</div></div><span class="badge ${b.c}">${b.l}</span></div>`;
    }

    const { h, s } = hexToHsl(c.hex);
    const lightnesses = [95, 85, 70, 55, 40, 28, 15];
    const shadesArray = lightnesses.map(l => hslToHex(h, s, l));
    const shadesHTML = shadesArray.map((shadeHex) => `
      <div class="shade-chip" style="background:${shadeHex};" title="${shadeHex}"><span style="color:${getTextColor(shadeHex)}; font-size:9px;">${shadeHex.toUpperCase()}</span></div>
    `).join('');

    const shadesHeader = `
      <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-top:16px; margin-bottom:8px;">
        <span style="font-size:10px; color:#aaa; text-transform:uppercase; font-weight:600; font-family:'Space Mono', monospace; letter-spacing:0.5px;">Shade Scale</span>
        <button style="background:transparent; border:1px solid #ddd8f8; border-radius:4px; padding:3px 8px; font-size:10px; color:#7c3aed; cursor:pointer; font-family:'Space Mono', monospace; transition:0.2s;" onmouseover="this.style.background='#f5f3ff'" onmouseout="this.style.background='transparent'" onclick="copyShades('${shadesArray.join(',')}', this)">copy to figma</button>
      </div>
    `;

    return `
      <div class="color-block">
        <div class="color-block-header">
          <div class="cb-swatch" style="background:${c.hex}"></div>
          <div class="cb-meta">
            <span class="cb-hex">${c.hex.toUpperCase()}</span>
            <span class="cb-role">${c.role}</span>
          </div>
        </div>
        <div class="analysis-text">${escapeHtml(analysis)}</div>
        <div class="contrast-wrapper">${contrastHTML}</div>
        ${shadesHeader}
        <div class="shades-row" style="margin-top:0;">${shadesHTML}</div>
      </div>
    `;
  }).join('');

  // 4. Harmony
  const harmonyHTML = `
    <div class="ui-card">
      <div class="section-label">harmony & relationships</div>
      <div class="overview-text">${escapeHtml(data.harmony)}</div>
    </div>
  `;

  // 5. Suggestions
  const suggestionsHTML = data.suggestions.length
    ? data.suggestions.map((s, i) => `
    <div class="suggestion-block" id="sug-${i}" data-hex="${escapeHtml(s.hex)}" data-replaces="${escapeHtml(s.replaces)}">
      <div class="suggestion-header">
        <div class="sug-swatch" style="background:${escapeHtml(s.hex)}"></div>
        <div>
          <span class="sug-hex">${escapeHtml(s.hex)}</span>
          <span class="sug-role">for ${escapeHtml(s.replaces)}</span>
        </div>
      </div>
      <div class="sug-why">${escapeHtml(s.why || "")}</div>
      <div class="sug-actions">
        <button class="btn-use" type="button">use this</button>
        <button class="btn-try" type="button">try another</button>
        <button class="btn-skip" type="button">skip</button>
      </div>
    </div>
  `).join('')
    : `<p class="overview-text">No suggestions returned for this palette.</p>`;

  resDiv.innerHTML = `
    <div class="palette-preview-bar">${previewHTML}</div>
    ${overviewHTML}
    <div class="ui-card">
      <div class="section-label">color analysis</div>
      <div class="grid">${colorBlocksHTML}</div>
    </div>
    ${harmonyHTML}
    <div class="ui-card">
      <div class="section-label">suggestions</div>
      ${suggestionsHTML}
    </div>
    <div style="display:flex; justify-content:center; margin-top:24px;">
      <button class="dashed-btn" id="reset-app-btn" type="button" style="flex:1; max-width: 300px; background:rgba(255,255,255,0.5);">analyze another palette</button>
    </div>
  `;
  resDiv.style.display = 'block';

  document.getElementById('reset-app-btn')?.addEventListener('click', resetApp);
  resDiv.querySelectorAll('.suggestion-block').forEach((block, i) => {
    const hex = block.dataset.hex;
    const replaces = block.dataset.replaces;
    block.querySelector('.btn-use')?.addEventListener('click', () => useSuggestion(hex, replaces));
    block.querySelector('.btn-try')?.addEventListener('click', () => regenerateSuggestion(i, replaces));
    block.querySelector('.btn-skip')?.addEventListener('click', () => skipSuggestion(i));
  });
}

function showError(msg) {
  const el = document.getElementById('error-msg');
  el.textContent = msg; el.style.display = 'block';
}

// --- MAIN ACTIONS ---
async function analyze() {
  const colors = extractColors();
  const context = document.getElementById('project-context').value.trim();

  // Validate
  if (inputMode === 'image' && !imageColorsReady) {
    return showError('Extract colors from your image first, then confirm the palette.');
  }
  if (colors.length === 0) return showError('Add at least one color');
  const badHex = colors.find(c => !/^#[0-9A-Fa-f]{6}$/.test(c.hex));
  if (badHex) return showError('Please enter a valid hex color');

  document.getElementById('error-msg').style.display = 'none';
  document.getElementById('analyze-btn').disabled = true;
  document.getElementById('input-section').style.display = 'none';
  document.getElementById('loading').style.display = 'block';
  document.getElementById('results').style.display = 'none';

  const paletteString = colors.map(c => `${c.role}: ${c.hex}`).join(', ');
  const systemPrompt = "You are a senior design systems expert. Be honest, specific, and never generic in your color feedback.";

  const fromImg = inputMode === 'image' ? `These colors were automatically extracted from an image uploaded by the user via K-Means clustering. Comment briefly on how they were extracted together.` : ``;

  const userPrompt = `
Analyze this color palette:
Design Mode: ${designMode}
Project Context: ${context || 'None provided'}
${fromImg}
Colors: ${paletteString}

Return strict JSON only (no markdown formatting, no backticks). Structure:
{
  "overview": "2-3 sentences on how the palette works together for this project and mood",
  "colors": [
    { "analysis": "2 sentences specific to this color's role and context" } // MUST exactly match the number and order of the provided Colors
  ],
  "harmony": "2 sentences on color theory, emotional consistency, and potential clashes",
  "suggestions": [
    { "hex": "#value", "replaces": "role", "why": "1-2 sentences" },
    { "hex": "#value", "replaces": "role", "why": "1-2 sentences" }
  ]
}`;

  try {
    const controller = new AbortController();
    const to = setTimeout(() => controller.abort(), 30000);

    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        reasoning_effort: 'low',
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
        max_tokens: 1500
      }),
      signal: controller.signal
    });

    clearTimeout(to);
    const data = await res.json();

    if (!res.ok) {
      if (res.status === 401) throw new Error('Invalid API key. Check your Groq key.');
      if (res.status === 429) throw new Error('Rate limit hit. Wait a moment and try again.');
      if (res.status === 500 && data.error?.message?.includes('GROQ_API_KEY')) {
        throw new Error('Server is not configured with a Groq API key.');
      }
      throw new Error(data.error?.message || 'Connection failed. Check your internet and try again.');
    }

    const text = data?.choices?.[0]?.message?.content;
    const parsed = normalizeAnalysis(parseAiJson(text), colors.length);

    document.getElementById('loading').style.display = 'none';
    renderResults(parsed, colors, designMode);

  } catch (e) {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('input-section').style.display = 'block';
    document.getElementById('analyze-btn').disabled = false;

    if (e.name === 'AbortError') showError('Request timed out. Please try again.');
    else if (e instanceof SyntaxError) showError('AI returned an unexpected response. Try again.');
    else showError(e.message);
  }
}

function resetApp() {
  document.getElementById('input-section').style.display = 'block';
  document.getElementById('results').style.display = 'none';
  document.getElementById('analyze-btn').disabled = false;
}

function useSuggestion(hex, replacesRole) {
  if (inputMode === 'manual') {
    const rows = document.querySelectorAll('.color-row');
    let targetId = null;
    rows.forEach(r => { if (r.querySelector('.role-select').value === replacesRole) targetId = r.id; });

    if (targetId) {
      document.querySelector(`#${targetId} .hex-input`).value = hex;
      document.querySelector(`#${targetId} .color-swatch`).value = hex;
    } else {
      if (rows.length < 5) addColorRow(hex, replacesRole);
    }
  } else {
    // Modify extracted state
    const match = extractedState.find(e => e.role === replacesRole);
    if (match) match.hex = hex;
  }

  resetApp();
  setTimeout(() => analyze(), 100);
}

function skipSuggestion(idx) {
  const el = document.getElementById(`sug-${idx}`);
  if (el) { el.style.opacity = '0.4'; el.style.pointerEvents = 'none'; }
}

async function regenerateSuggestion(idx, replacesRole) {
  const colors = extractColors();
  const context = document.getElementById('project-context').value.trim();
  const paletteString = colors.map(c => `${c.role}: ${c.hex}`).join(', ');

  const el = document.getElementById(`sug-${idx}`);
  if (!el) return;
  el.querySelector('.sug-why').textContent = 'Generating...';

  const system = "You are a senior design systems expert. Strict JSON only.";
  const prompt = `
Palette: ${paletteString}
Mode: ${designMode}. Context: ${context}
Give me ONE alternative color suggestion to replace the role "${replacesRole}". 
Return ONLY JSON: {"hex": "#value", "why": "1-2 sentence explanation"}`;

  try {
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        reasoning_effort: 'low',
        messages: [{ role: "system", content: system }, { role: "user", content: prompt }],
        max_tokens: 300
      })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error?.message || 'Could not regenerate suggestion.');
    }

    const parsed = parseAiJson(data?.choices?.[0]?.message?.content);
    if (!parsed?.hex) throw new Error('Invalid suggestion response.');

    el.dataset.hex = parsed.hex;
    el.querySelector('.sug-swatch').style.background = parsed.hex;
    el.querySelector('.sug-hex').textContent = parsed.hex;
    el.querySelector('.sug-why').textContent = parsed.why || 'Alternative color suggestion.';
    el.querySelector('.btn-use').onclick = () => useSuggestion(parsed.hex, replacesRole);
  } catch (e) {
    el.querySelector('.sug-why').textContent = e.message || 'Could not regenerate. Try again.';
  }
}

function copyShades(shadeStr, btn) {
  const shades = shadeStr.split(',');
  let svg = '<svg width="608" height="80" viewBox="0 0 608 80" fill="none" xmlns="http://www.w3.org/2000/svg">\n';
  shades.forEach((hex, i) => {
    const x = i * 88;
    const tc = getTextColor(hex);
    svg += `  <rect x="${x}" y="0" width="80" height="80" rx="8" fill="${hex}"/>\n`;
    svg += `  <text x="${x + 8}" y="68" fill="${tc}" font-family="monospace" font-size="12" font-weight="bold">${hex.toUpperCase()}</text>\n`;
  });
  svg += '</svg>';

  const copy = navigator.clipboard?.writeText
    ? navigator.clipboard.writeText(svg)
    : Promise.reject(new Error('Clipboard unavailable'));

  copy.then(() => {
    const orig = btn.textContent;
    btn.textContent = 'copied blocks!';
    setTimeout(() => { btn.textContent = orig; }, 2000);
  }).catch(() => {
    btn.textContent = 'copy failed';
    setTimeout(() => { btn.textContent = 'copy to figma'; }, 2000);
  });
}

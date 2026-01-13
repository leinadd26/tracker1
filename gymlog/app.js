const DATA_KEY = 'lifeStatsData';
const IMG_KEY = 'gymLogImages_v1'; // date -> dataURL (compressed)

let images = {};

function loadImages() {
  try { images = JSON.parse(localStorage.getItem(IMG_KEY) || '{}'); }
  catch { images = {}; }
}
function saveImages() {
  localStorage.setItem(IMG_KEY, JSON.stringify(images));
}

function loadStatsData() {
  try {
    return JSON.parse(localStorage.getItem(DATA_KEY) || '[]') || [];
  } catch {
    return [];
  }
}

function formatDateGerman(yyyyMMdd) {
  const [y, m, d] = yyyyMMdd.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('de-DE', { weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit' });
}

function weightStr(w) {
  if (w === null || w === undefined || Number.isNaN(w)) return '--';
  return `${w} kg`;
}

function getGymEntries() {
  const all = loadStatsData();
  return all
    .filter(e => e && e.gym === true)
    .map(e => ({
      date: e.date,
      weight: (e.weight === null || e.weight === undefined) ? null : e.weight
    }))
    .sort((a, b) => b.date.localeCompare(a.date)); // neueste zuerst
}

function monthKeyNow() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function render() {
  loadImages();
  const list = document.getElementById('gymList');
  const empty = document.getElementById('emptyState');

  const entries = getGymEntries();

  document.getElementById('countAll').textContent = entries.length;

  const mk = monthKeyNow();
  const monthCount = entries.filter(e => e.date.startsWith(mk)).length;
  document.getElementById('countMonth').textContent = monthCount;

  if (entries.length === 0) {
    list.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  list.innerHTML = entries.map(e => {
    const img = images[e.date];
    const thumbSrc = img || '';
    const hasImg = !!img;

    return `
      <div class="entry" data-date="${e.date}">
        <button class="entry-head" type="button">
          <img class="thumb" alt="Foto" src="${thumbSrc}" ${hasImg ? '' : 'style="opacity:0.25"'} />
          <div class="meta">
            <div class="date">${formatDateGerman(e.date)}</div>
            <div class="sub">Gewicht: ${weightStr(e.weight)}</div>
          </div>
          <div class="chev">▼</div>
        </button>

        <div class="entry-body">
          <div class="preview">
            <img class="preview-img" alt="Vorschau" src="${thumbSrc}" ${hasImg ? '' : 'style="display:none"'} />
            ${hasImg ? '' : '<div style="padding:18px; color:#9aa; text-align:center;">Noch kein Bild</div>'}
          </div>

          <div class="body-row">
            <div class="badge">${formatDateGerman(e.date)}</div>
            <div class="badge">${weightStr(e.weight)}</div>
          </div>

          <div class="actions">
            <label class="upload-btn">
              Bild wählen
              <input class="file-input" type="file" accept="image/*" capture="environment" />
            </label>
            <button class="danger-btn" type="button" data-action="delete">Bild löschen</button>
          </div>

          <div style="margin-top:10px; font-size:0.82rem; color:#9aa; line-height:1.3;">
            Hinweis: Bilder werden lokal gespeichert (am Gerät). Sehr große Bilder werden automatisch verkleinert.
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Bild verkleinern + als JPEG speichern (damit localStorage nicht explodiert)
function compressImageToDataURL(file, maxWidth = 900, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);

        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function bind() {
  document.getElementById('reloadBtn').addEventListener('click', () => {
    render();
    if (navigator.vibrate) navigator.vibrate(30);
  });

  // Event-Delegation
  document.addEventListener('click', async (e) => {
    const head = e.target.closest('.entry-head');
    if (head) {
      const entry = head.closest('.entry');
      entry.classList.toggle('open');
      return;
    }

    const delBtn = e.target.closest('button[data-action="delete"]');
    if (delBtn) {
      const entry = delBtn.closest('.entry');
      const date = entry.dataset.date;
      if (!date) return;

      if (confirm('Bild wirklich löschen?')) {
        delete images[date];
        saveImages();
        render();
      }
      return;
    }
  });

  // File inputs
  document.addEventListener('change', async (e) => {
    const input = e.target.closest('.file-input');
    if (!input) return;

    const entry = input.closest('.entry');
    const date = entry?.dataset?.date;
    const file = input.files?.[0];
    if (!date || !file) return;

    try {
      const dataUrl = await compressImageToDataURL(file);
      images[date] = dataUrl;
      saveImages();
      render();
    } catch (err) {
      alert('Bild konnte nicht verarbeitet werden.');
    } finally {
      input.value = '';
    }
  });
}

render();
bind();
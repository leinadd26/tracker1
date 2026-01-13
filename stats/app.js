// =====================
// Google Sheets CONFIG
// =====================
const SHEETS_ID = '1XDOkxSB0xm8vy8J6eFRkFa4r2tRoKD8m6ArhzhkuwcY';
const SHEETS_TAB = 'Daten';
const SHEETS_RANGE = 'A2:I366';
const SHEETS_WRITE_URL = 'https://script.google.com/macros/s/AKfycbxRZ3gq53WZLk3223CgFZDVXDlBq4_JKPWZy56W44Gvc_GWL6bc-xM3NPo1jRIpFCenWg/exec';
const SHEETS_SECRET_KEY = 'lifeStatsSheetsSecret';

// =====================
// CONFIG: Ranks / Level
// =====================
const SCREEN_RANKS = [
  { name: 'UNREAL', maxAvg: 1.5, class: 'champion' },
  { name: 'CHAMPION', maxAvg: 2.5, class: 'champion' },
  { name: 'ELITE', maxAvg: 3.0, class: 'diamond' },
  { name: 'DIAMANT', maxAvg: 3.5, class: 'diamond' },
  { name: 'PLATIN', maxAvg: 4.0, class: 'silver' },
  { name: 'GOLD', maxAvg: 5.0, class: 'gold' },
  { name: 'SILBER', maxAvg: 6.0, class: 'silver' },
  { name: 'BRONZE', maxAvg: 7.0, class: 'bronze' },
  { name: 'UNRANKED', maxAvg: Infinity, class: 'bronze' }
];

const MIN_ENTRIES_TO_SYNC = 10;

function isMeaningfulEntry(e) {
  if (!e) return false;
  return (
    (e.screen !== null && e.screen !== undefined) ||
    (e.steps !== null && e.steps !== undefined && e.steps !== 0) ||
    (e.weight !== null && e.weight !== undefined && e.weight !== 0) ||
    e.morning === true ||
    e.evening === true ||
    e.fap === true ||
    e.gym === true
  );
}

function countMeaningfulEntries() {
  return data.filter(isMeaningfulEntry).length;
}

function canSyncToSheets() {
  return countMeaningfulEntries() >= MIN_ENTRIES_TO_SYNC;
}

function updateSyncLockUI() {
  const saveBtn = document.getElementById('saveEntry');
  const pushBtn = document.getElementById('pushTodayBtn');
  const status = document.getElementById('syncStatus');

  const n = countMeaningfulEntries();
  const locked = n < MIN_ENTRIES_TO_SYNC;

  // Push-Button sperren
  if (pushBtn) pushBtn.disabled = locked;

  // Save-Button bleibt klickbar (speichert lokal), aber Text zeigt Status
  if (saveBtn) {
    saveBtn.dataset.locked = locked ? 'true' : 'false';
    saveBtn.textContent = locked
      ? `💾 Lokal speichern (Sync ab ${MIN_ENTRIES_TO_SYNC} Einträgen: ${n}/${MIN_ENTRIES_TO_SYNC})`
      : `💾 Speichern (→ Sheets)`;
  }

  if (status) {
    status.textContent = locked
      ? `🔒 Sheets-Sync gesperrt: ${n}/${MIN_ENTRIES_TO_SYNC} Einträge.`
      : `✅ Sheets-Sync freigeschaltet.`;
  }
}

const RANK_IMAGE_MAP = {
  'BRONZE': 'Bronze.png',
  'SILBER': 'Silber.png',
  'GOLD': 'Gold.png',
  'PLATIN': 'Platin.png',
  'DIAMANT': 'Diamant.png',
  'ELITE': 'Elite.png',
  'CHAMPION': 'Champion.png',
  'UNREAL': 'Unreal.png',
  'UNRANKED': 'Unranked.png'
};

const LEVELS = [
  { level: 1, xpRequired: 100 },
  { level: 2, xpRequired: 300 },
  { level: 3, xpRequired: 750 },
  { level: 4, xpRequired: 1500 },
  { level: 5, xpRequired: 2500 },
  { level: 6, xpRequired: 3800 },
  { level: 7, xpRequired: 5000 },
  { level: 8, xpRequired: 6200 },
  { level: 9, xpRequired: 6800 },
  { level: 10, xpRequired: 7150 }
];

// Boss: 14 Routinen pro Woche -> 100/14 Schaden pro Routine
const BOSS_DAMAGE_PER_ROUTINE = 100 / 14;

const DAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const DAYS_FULL = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const MONTHS = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];

// =====================
// STATE
// =====================
let data = [];
let currentView = 'avg';
let currentMonth = 'total';

// =====================
// Helpers: Date LOCAL
// =====================
function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2,'0');
  const d = String(date.getDate()).padStart(2,'0');
  return `${y}-${m}-${d}`;
}
function parseDate(dateStr) {
  const [y,m,d] = dateStr.split('-').map(Number);
  return new Date(y, m-1, d);
}
function getToday() { return formatDate(new Date()); }
function formatDateShort(dateStr) {
  const d = parseDate(dateStr);
  return `${d.getDate()}.${d.getMonth()+1}`;
}

// =====================
// Helpers: Time
// =====================
function formatHoursHM(hours) {
  if (hours === null || hours === undefined || Number.isNaN(hours)) return '--';
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}min`;
}
function timeStrToHours(t) {
  if (!t) return null;
  const [hh,mm] = t.split(':').map(Number);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
  return hh + mm/60;
}
function hoursToTimeStr(hours) {
  if (hours === null || hours === undefined || Number.isNaN(hours)) return '';
  const totalMinutes = Math.round(hours*60);
  const hh = Math.floor(totalMinutes/60);
  const mm = totalMinutes % 60;
  return `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`;
}

// =====================
// Helpers: Rank Icon
// =====================
function getRankImageSrc(rankName) {
  const file = RANK_IMAGE_MAP[rankName] || RANK_IMAGE_MAP.UNRANKED || RANK_IMAGE_MAP.BRONZE;
  return `../FortniteRanks/${file}`;
}

// =====================
// Helpers: Week
// =====================
function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}
function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0,0,0,0);
  return d;
}
function getSunday(date) {
  const monday = getMonday(date);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return sunday;
}

function getFirstMondayOfYear(year) {
  const jan1 = new Date(year, 0, 1);
  let m = getMonday(jan1);
  // Falls der Montag zur letzten Dezemberwoche vom Vorjahr gehört, nimm den nächsten Montag
  if (m.getFullYear() < year) m.setDate(m.getDate() + 7);
  return m;
}

function getLastMondayOfYear(year) {
  const dec31 = new Date(year, 11, 31);
  return getMonday(dec31);
}

function getWeeklyRoutinePoints(mondayDate) {
  const sunday = new Date(mondayDate);
  sunday.setDate(mondayDate.getDate() + 6);

  const mondayStr = formatDate(mondayDate);
  const sundayStr = formatDate(sunday);

  const weekData = data.filter(d => d.date >= mondayStr && d.date <= sundayStr);

  return weekData.reduce((acc, d) => {
    return acc + (d.morning === true ? 1 : 0) + (d.evening === true ? 1 : 0);
  }, 0);
}

function getBossYearStats(year) {
  const firstMon = getFirstMondayOfYear(year);
  const lastMon = getLastMondayOfYear(year);

  // Anzahl mögliche Bosse im Jahr
  const oneWeek = 7 * 24 * 60 * 60 * 1000;
  const possible = Math.floor((lastMon - firstMon) / oneWeek) + 1;

  // Wie viele davon besiegt? (perfekte Woche = 14 Routinen)
  let defeated = 0;
  for (let i = 0; i < possible; i++) {
    const monday = new Date(firstMon);
    monday.setDate(firstMon.getDate() + i * 7);

    const points = getWeeklyRoutinePoints(monday);
    if (points >= 14) defeated++;
  }

  return { defeated, possible };
}

function getDaysUntilMonday() {
  const day = new Date().getDay();
  if (day === 0) return 1;
  if (day === 1) return 7;
  return 8 - day;
}

// =====================
// localStorage
// =====================
function loadData() {
  const saved = localStorage.getItem('lifeStatsData');
  if (saved) {
    data = JSON.parse(saved);
    return;
  }
  data = [];
  saveData();
}
function saveData() {
  localStorage.setItem('lifeStatsData', JSON.stringify(data));
}

// =====================
// Sheets Sync: READ (GViz)
// =====================
function parseMaybeNumber(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return v;
  const s = String(v).replace(/[^\d,.-]/g,'').replace(',','.');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

async function pullFromSheets() {
  const url = `https://docs.google.com/spreadsheets/d/${SHEETS_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(SHEETS_TAB)}&range=${encodeURIComponent(SHEETS_RANGE)}`;
  const res = await fetch(url, { cache: 'no-store' });
  const text = await res.text();

  const jsonStart = text.indexOf('{');
  const jsonEnd = text.lastIndexOf('}') + 1;
  const json = JSON.parse(text.slice(jsonStart, jsonEnd));

  const rows = json?.table?.rows || [];
  const newData = [];

  for (const r of rows) {
    const c = r.c || [];
    const dateCell = c[0]?.v;
    if (!dateCell) continue;

    let dateStr = null;

    // GViz Date: "Date(2026,0,1)"
    if (typeof dateCell === 'string' && dateCell.startsWith('Date(')) {
      const m = dateCell.match(/Date\((\d+),(\d+),(\d+)\)/);
      if (m) {
        const y = Number(m[1]);
        const mo = Number(m[2]) + 1;
        const d = Number(m[3]);
        dateStr = `${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      }
    } else if (dateCell instanceof Date) {
      dateStr = formatDate(dateCell);
    } else {
      // fallback: "01.01.2026"
      const parts = String(dateCell).split('.');
      if (parts.length === 3) {
        dateStr = `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
      }
    }
    if (!dateStr) continue;

    const screen = parseMaybeNumber(c[1]?.v);
    const morning = c[2]?.v === true;
    const evening = c[3]?.v === true;
    // E ignorieren
    const fap = c[5]?.v === true;
    const gym = c[6]?.v === true;
    const weight = parseMaybeNumber(c[7]?.v);
    const steps = parseMaybeNumber(c[8]?.v);

    // Optional: leere Zeilen nicht speichern (nur wenn wirklich irgendwas drin ist)
    const hasAny =
      (screen !== null) || morning || evening || fap || gym || (weight !== null) || (steps !== null);

    if (!hasAny) continue;

    newData.push({
      date: dateStr,
      screen,
      morning,
      evening,
      fap,
      gym,
      weight,
      steps
    });
  }

  newData.sort((a,b) => parseDate(a.date) - parseDate(b.date));
  data = newData;
  saveData();
}

// =====================
// Sheets Sync: WRITE (Apps Script WebApp)
// =====================
function getSheetsSecret() {
  let s = localStorage.getItem(SHEETS_SECRET_KEY);
  if (!s) {
    s = prompt('Sheets Sync Secret eingeben (wird nur lokal gespeichert):');
    if (s) localStorage.setItem(SHEETS_SECRET_KEY, s);
  }
  return s;
}

async function pushEntryToSheets(entry) {
  const secret = getSheetsSecret();
  if (!secret) throw new Error('No secret');

  const params = new URLSearchParams();
  params.set('secret', secret);
  params.set('date', entry.date);

  params.set('screen', entry.screen ?? '');
  params.set('morning', entry.morning === true ? 'true' : 'false');
  params.set('evening', entry.evening === true ? 'true' : 'false');
  params.set('fap', entry.fap === true ? 'true' : 'false');
  params.set('gym', entry.gym === true ? 'true' : 'false');
  params.set('weight', entry.weight ?? '');
  params.set('steps', entry.steps ?? '');

  // no-cors: wir können Response nicht lesen, Request geht aber raus
  await fetch(SHEETS_WRITE_URL, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: params.toString()
  });
}

function setStatus(msg) {
  const el = document.getElementById('syncStatus');
  if (el) el.textContent = msg;
}

// =====================
// Calculations
// =====================
function getAverageScreentime14Days() {
  const today = new Date();
  const from = new Date();
  from.setDate(today.getDate() - 14);

  const filtered = data.filter(d => {
    const dt = parseDate(d.date);
    return dt > from && dt <= today && d.screen !== null && d.screen > 0;
  });
  if (filtered.length === 0) return 0;
  return filtered.reduce((a,d) => a + d.screen, 0) / filtered.length;
}

function getScreenRank(avg) {
  for (const r of SCREEN_RANKS) if (avg < r.maxAvg) return r;
  return SCREEN_RANKS[SCREEN_RANKS.length - 1];
}

function getTotalXP() {
  return data.reduce((acc,d) => acc + ((d.morning?1:0) + (d.evening?1:0)) * 10, 0);
}

function getStreak() {
  const todayStr = getToday();
  const sorted = data.filter(d => d.date <= todayStr).sort((a,b)=> parseDate(b.date)-parseDate(a.date));
  let streak = 0;
  for (const day of sorted) {
    const pts = (day.morning?1:0) + (day.evening?1:0);
    if (pts === 0) break;
    streak++;
  }
  return streak;
}

function getCurrentLevel() {
  const xp = getTotalXP();
  if (xp < 100) return 0;
  for (let i = LEVELS.length - 1; i >= 0; i--) if (xp >= LEVELS[i].xpRequired) return LEVELS[i].level;
  return 1;
}

function getXPToNextLevel() {
  const xp = getTotalXP();
  const lvl = getCurrentLevel();
  if (lvl >= 10) return 0;
  const next = LEVELS.find(l => l.level === lvl + 1);
  return next ? next.xpRequired - xp : 0;
}

function getLevelProgress() {
  const xp = getTotalXP();
  const lvl = getCurrentLevel();
  if (lvl === 0) return (xp / 100) * 100;
  if (lvl >= 10) return 100;
  const curr = LEVELS.find(l => l.level === lvl)?.xpRequired || 0;
  const next = LEVELS.find(l => l.level === lvl + 1)?.xpRequired || curr;
  return ((xp - curr) / (next - curr)) * 100;
}

function getWeeklyBossData() {
  const today = new Date();
  const monday = getMonday(today);
  const sunday = getSunday(today);
  const mondayStr = formatDate(monday);
  const sundayStr = formatDate(sunday);

  const weekData = data.filter(d => d.date >= mondayStr && d.date <= sundayStr);
  const weeklyPoints = weekData.reduce((acc,d)=> acc + (d.morning?1:0) + (d.evening?1:0), 0);

  const hp = Math.max(0, 100 - weeklyPoints * BOSS_DAMAGE_PER_ROUTINE);
  return {
    weekNum: getWeekNumber(today),
    hp: Math.round(hp),
    routinesLeft: Math.ceil(hp / BOSS_DAMAGE_PER_ROUTINE),
    daysUntilReset: getDaysUntilMonday(),
    defeated: hp <= 0
  };
}

function getCurrentWeekDays() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayStr = formatDate(today);
  const monday = getMonday(today);

  const result = [];
  for (let i=0;i<7;i++){
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    const dateStr = formatDate(date);
    const dayData = data.find(d => d.date === dateStr) || null;

    result.push({
      date, dateStr,
      dayName: DAYS[date.getDay()],
      dayNum: date.getDate(),
      data: dayData,
      isFuture: dateStr > todayStr,
      isToday: dateStr === todayStr
    });
  }
  return result;
}

function getLast14DaysScreen() {
  const today = new Date();
  const out = [];
  for (let i=0;i<14;i++){
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const ds = formatDate(d);
    const row = data.find(x => x.date === ds);
    out.push({ date: ds, screen: row?.screen ?? null });
  }
  return out.reverse();
}

function getLast14DaysXP() {
  const today = new Date();
  const out = [];
  for (let i=0;i<14;i++){
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const ds = formatDate(d);
    const row = data.find(x => x.date === ds);
    const xp = row ? ((row.morning?1:0) + (row.evening?1:0))*10 : 0;
    out.push({ date: ds, xp, morning: row?.morning, evening: row?.evening });
  }
  return out.reverse();
}

function getTodayData() {
  const today = getToday();
  return data.find(d => d.date === today) || { date: today, screen:null, morning:false, evening:false, fap:false, gym:false, weight:null, steps:null };
}

// =====================
// Stats for month/total
// =====================
function getMonthlyStats(year, month) {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  const startStr = formatDate(start);
  const endStr = formatDate(end);

  const monthData = data.filter(d => d.date >= startStr && d.date <= endStr);

  const gymDays = monthData.filter(d => d.gym === true);
  const fapDays = monthData.filter(d => d.fap === true);

  const stepsData = monthData.filter(d => d.steps !== null && d.steps > 0);
  const totalSteps = stepsData.reduce((s,d)=> s + d.steps, 0);
  const avgSteps = stepsData.length ? Math.round(totalSteps / stepsData.length) : 0;

  const weights = monthData.filter(d => d.weight !== null && d.weight > 0).sort((a,b)=>parseDate(a.date)-parseDate(b.date));
  const startW = weights.length ? weights[0].weight : null;
  const endW = weights.length ? weights[weights.length-1].weight : null;
  const diff = (startW !== null && endW !== null) ? (endW - startW) : null;

  return {
    gym: { count: gymDays.length, days: gymDays },
    fap: { count: fapDays.length, days: fapDays },
    steps: { total: totalSteps, avg: avgSteps, days: stepsData },
    weight: { start: startW, end: endW, diff, days: weights }
  };
}

function getTotalStats() {
  const gymDays = data.filter(d => d.gym === true);
  const fapDays = data.filter(d => d.fap === true);

  const stepsData = data.filter(d => d.steps !== null && d.steps > 0);
  const totalSteps = stepsData.reduce((s,d)=> s + d.steps, 0);
  const avgSteps = stepsData.length ? Math.round(totalSteps / stepsData.length) : 0;

  const monthsWithData = new Set(data.map(d => d.date.substring(0,7)));
  const monthCount = monthsWithData.size || 1;

  const weights = data.filter(d => d.weight !== null && d.weight > 0).sort((a,b)=>parseDate(a.date)-parseDate(b.date));
  const startW = weights.length ? weights[0].weight : null;
  const endW = weights.length ? weights[weights.length-1].weight : null;

  return {
    gym: { count: gymDays.length, avgPerMonth: (gymDays.length / monthCount).toFixed(1), days: gymDays },
    fap: { count: fapDays.length, avgPerMonth: (fapDays.length / monthCount).toFixed(1), days: fapDays },
    steps: { total: totalSteps, avg: avgSteps, days: stepsData },
    weight: { start: startW, end: endW, days: weights }
  };
}

function populateMonthDropdown() {
  const select = document.getElementById('monthSelect');
  if (!select) return;

  while (select.options.length > 1) select.remove(1);

  const months = new Set(data.map(d => d.date.substring(0,7)));
  const sorted = [...months].sort().reverse();

  for (const m of sorted) {
    const [y, mo] = m.split('-').map(Number);
    const opt = document.createElement('option');
    opt.value = m;
    opt.textContent = `${MONTHS[mo-1]} ${y}`;
    select.appendChild(opt);
  }
}

// =====================
// Render
// =====================
function renderAll() {
  renderToday();
  renderScreentime();
  renderRoutine();
  renderBoss();
  renderWeek();
  renderStats();
  updateSyncLockUI();
}

function renderToday() {
  const t = getTodayData();

  const m = document.getElementById('todayMorning');
  const e = document.getElementById('todayEvening');
  const g = document.getElementById('todayGym');
  const f = document.getElementById('todayFap');
  const s = document.getElementById('todayScreen');
  const st = document.getElementById('todaySteps');

  if (m){ m.textContent = t.morning ? '✓' : '○'; m.className = `today-status ${t.morning ? 'done' : 'pending'}`; }
  if (e){ e.textContent = t.evening ? '✓' : '○'; e.className = `today-status ${t.evening ? 'done' : 'pending'}`; }
  if (g){ g.textContent = t.gym ? '✓' : '○'; g.className = `today-status ${t.gym ? 'done' : 'pending'}`; }

  // Fap: wenn TRUE -> rot
  if (f){
    f.textContent = t.fap ? '✓' : '○';
    f.className = `today-status ${t.fap ? 'bad' : 'pending'}`;
  }

  if (s){ s.textContent = formatHoursHM(t.screen); }

  // Steps: Zahl mit Tausenderpunkten
  if (st){
    st.textContent = (t.steps !== null && t.steps !== undefined)
      ? Number(t.steps).toLocaleString('de-DE')
      : '--';
  }
}

function renderScreentime() {
  const avg = getAverageScreentime14Days();
  const rank = getScreenRank(avg);

  const rankEl = document.getElementById('screenRank');
  const iconEl = document.getElementById('screenRankIcon');
  const avgEl = document.getElementById('screenAvg');
  const progEl = document.getElementById('screenProgress');
  const nextEl = document.getElementById('screenNext');

  if (rankEl){ rankEl.textContent = rank.name; rankEl.className = `rank-badge ${rank.class}`; }
  if (iconEl){ iconEl.src = getRankImageSrc(rank.name); }
  if (avgEl){ avgEl.textContent = `${formatHoursHM(avg)} avg`; }

  const idx = SCREEN_RANKS.findIndex(r => r.name === rank.name);
  if (idx > 0 && progEl && nextEl) {
    const nextRank = SCREEN_RANKS[idx - 1];
    const progress = ((rank.maxAvg - avg) / (rank.maxAvg - nextRank.maxAvg)) * 100;
    progEl.style.width = `${Math.max(0, Math.min(100, progress))}%`;
    nextEl.textContent = `Nächster Rang: avg < ${formatHoursHM(nextRank.maxAvg)}`;
  } else if (progEl && nextEl) {
    progEl.style.width = '100%';
    nextEl.textContent = '🏆 Höchster Rang!';
  }

  const reqEl = document.getElementById('screenRequirements');
  if (reqEl) {
    reqEl.innerHTML = SCREEN_RANKS.slice(0,-1).map(r => {
      const achieved = avg < r.maxAvg;
      return `
        <div class="requirement-item ${achieved ? 'achieved' : 'locked'}">
          <span class="requirement-status">${achieved ? '✅' : '🔒'}</span>
          <span class="requirement-name">${r.name}</span>
          <span class="requirement-value">< ${formatHoursHM(r.maxAvg)}</span>
        </div>
      `;
    }).join('');
  }

  const dailyEl = document.getElementById('screenDaily');
  if (dailyEl) {
    const last14 = getLast14DaysScreen();
    dailyEl.innerHTML = last14.map(d => `
      <div class="daily-item">
        <span class="daily-date">${formatDateShort(d.date)}</span>
        <span class="daily-value neutral">${d.screen !== null ? formatHoursHM(d.screen) : '--'}</span>
      </div>
    `).join('');
  }
}

function renderRoutine() {
  const level = getCurrentLevel();
  const xp = getTotalXP();
  const streak = getStreak();
  const xpToNext = getXPToNextLevel();
  const progress = getLevelProgress();

  const levelEl = document.getElementById('routineLevel');
  const streakEl = document.getElementById('streakDays');
  const xpEl = document.getElementById('totalPoints');
  const progEl = document.getElementById('levelProgress');
  const nextEl = document.getElementById('levelNext');

  if (levelEl) levelEl.textContent = level;
  if (streakEl) streakEl.textContent = streak;
  if (xpEl) xpEl.textContent = xp;
  if (progEl) progEl.style.width = `${Math.min(100, progress)}%`;
  if (nextEl) nextEl.textContent = level >= 10 ? '🎉 Max Level!' : `Noch ${xpToNext} XP (${Math.ceil(xpToNext/20)} perfekte Tage)`;

  const reqEl = document.getElementById('levelRequirements');
  if (reqEl) {
    reqEl.innerHTML = LEVELS.map(l => {
      const achieved = xp >= l.xpRequired;
      const current = l.level === level;
      return `
        <div class="requirement-item ${achieved ? 'achieved':'locked'} ${current?'current':''}">
          <span class="requirement-status">${achieved ? '✅' : '🔒'}</span>
          <span class="requirement-name">Level ${l.level}</span>
          <span class="requirement-value">${l.xpRequired} XP</span>
        </div>
      `;
    }).join('');
  }

  const dailyEl = document.getElementById('levelDaily');
  if (dailyEl) {
    const last14 = getLast14DaysXP();
    dailyEl.innerHTML = last14.map(d => `
      <div class="daily-item">
        <span class="daily-date">${formatDateShort(d.date)}</span>
        <span style="flex:1">${d.morning ? '☀️':'○'} ${d.evening ? '🌙':'○'}</span>
        <span class="daily-value neutral">+${d.xp} XP</span>
      </div>
    `).join('');
  }
}

function renderBoss() {
  const boss = getWeeklyBossData();
  const weekEl = document.getElementById('bossWeek');
  const hpEl = document.getElementById('bossHp');
  const hpText = document.getElementById('bossHpText');
  const info = document.getElementById('bossInfo');
  const reset = document.getElementById('bossReset');
  const card = document.getElementById('bossCard');

  if (weekEl) weekEl.textContent = `KW ${boss.weekNum}`;
  if (hpEl) hpEl.style.width = `${boss.hp}%`;
  if (hpText) hpText.textContent = `${boss.hp}%`;

  if (boss.defeated) {
    if (card) card.classList.add('defeated');
    if (info) info.textContent = '🏆 BOSS BESIEGT! Perfekte Woche! 🏆';
  } else {
    if (card) card.classList.remove('defeated');
    if (info) info.textContent = `⚔️ Noch ${boss.routinesLeft} Routinen bis zum Sieg!`;
  }
  if (reset) reset.textContent = `Reset in ${boss.daysUntilReset} Tag${boss.daysUntilReset!==1?'en':''}`;
const bossYearEl = document.getElementById('bossYear');
if (bossYearEl) {
  const y = new Date().getFullYear();
  const ys = getBossYearStats(y);
  bossYearEl.textContent = `Jahr: ${ys.defeated}/${ys.possible} besiegt`;
}

}

function renderWeek() {
  const week = getCurrentWeekDays();
  const grid = document.getElementById('weekGrid');
  if (grid) {
    grid.innerHTML = week.map(day => {
      let status = 'missed', icon = '✗';
      if (day.isFuture) { status='future'; icon='·'; }
      else if (day.data) {
        const pts = (day.data.morning?1:0) + (day.data.evening?1:0);
        if (pts===2) { status='perfect'; icon='✓✓'; }
        else if (pts===1) { status='partial'; icon='✓'; }
      } else if (day.isToday) {
        icon='○';
      }
      return `
        <div class="week-day ${status}${day.isToday?' today':''}">
          <span class="week-day-name">${day.dayName}</span>
          <span class="week-day-num">${day.dayNum}</span>
          <span class="week-day-status">${icon}</span>
        </div>
      `;
    }).join('');
  }

  const detail = document.getElementById('weekDetailList');
  if (detail) {
    detail.innerHTML = week.map(day => {
      const m = day.data?.morning === true;
      const e = day.data?.evening === true;
      const pts = day.isFuture ? null : (m?1:0) + (e?1:0);
      const cls = day.isFuture ? 'future' : (pts===2?'perfect':(pts===1?'partial':'missed'));

      return `
        <div class="week-detail-item ${cls}">
          <div class="week-detail-date">
            <span class="week-detail-day">${DAYS_FULL[day.date.getDay()]}</span>
            <span class="week-detail-num">${day.dayNum}.${day.date.getMonth()+1}</span>
          </div>
          <div class="week-detail-routines">
            <span class="routine-badge ${m?'done':'missed'}">☀️ ${m?'✓':'○'}</span>
            <span class="routine-badge ${e?'done':'missed'}">🌙 ${e?'✓':'○'}</span>
          </div>
          <span class="week-detail-points">${day.isFuture?'-':`${pts}/2`}</span>
        </div>
      `;
    }).join('');
  }
}

function renderStats() {
  const isTotal = currentMonth === 'total';
  const isAvg = currentView === 'avg';
  const stats = isTotal ? getTotalStats() : (() => {
    const [y,m] = currentMonth.split('-').map(Number);
    return getMonthlyStats(y, m-1);
  })();

  // Gym
  document.getElementById('statGym').textContent = isTotal ? (isAvg ? `${stats.gym.avgPerMonth}/Mo` : stats.gym.count) : stats.gym.count;
  document.getElementById('labelGym').textContent = isTotal ? (isAvg ? 'Gym Ø/Monat' : 'Gym Gesamt') : 'Gym';
  document.getElementById('gymDaily').innerHTML =
    stats.gym.days.length ? stats.gym.days.map(d => `
      <div class="daily-item"><span class="daily-date">${formatDateShort(d.date)}</span><span class="daily-value good">🏋️ Gym</span></div>
    `).join('') : `<div class="daily-item"><span class="daily-value">Keine Einträge</span></div>`;

  // Steps (Summe ohne Rundung)
  document.getElementById('statSteps').textContent = isAvg
    ? (stats.steps.avg > 1000 ? `${(stats.steps.avg/1000).toFixed(1)}k` : (stats.steps.avg || '--'))
    : (stats.steps.total ? stats.steps.total.toLocaleString('de-DE') : '--');
  document.getElementById('labelSteps').textContent = isAvg ? 'Schritte/Tag' : `Schritte (${stats.steps.days.length} Tage)`;
  document.getElementById('stepsDaily').innerHTML =
    stats.steps.days.length ? stats.steps.days.map(d => `
      <div class="daily-item"><span class="daily-date">${formatDateShort(d.date)}</span><span class="daily-value neutral">${Number(d.steps).toLocaleString('de-DE')}</span></div>
    `).join('') : `<div class="daily-item"><span class="daily-value">Keine Einträge</span></div>`;

  // Fap
  document.getElementById('statFap').textContent = isTotal ? (isAvg ? `${stats.fap.avgPerMonth}/Mo` : stats.fap.count) : stats.fap.count;
  document.getElementById('labelFap').textContent = isTotal ? (isAvg ? 'Fap Ø/Monat' : 'Fap Gesamt') : 'Fap';
  document.getElementById('fapDaily').innerHTML =
    stats.fap.days.length ? stats.fap.days.map(d => `
      <div class="daily-item"><span class="daily-date">${formatDateShort(d.date)}</span><span class="daily-value bad">🚫 Fap</span></div>
    `).join('') : `<div class="daily-item"><span class="daily-value good">Keine Einträge 🎉</span></div>`;

  // Weight
  const weightDisplay = document.getElementById('weightDisplay');
  const labelWeight = document.getElementById('labelWeight');

  if (isTotal) {
    if (stats.weight.start !== null && stats.weight.end !== null) {
      weightDisplay.className = 'weight-display dual';
      weightDisplay.innerHTML = `
        <span class="month-value">${stats.weight.start}kg</span>
        <span class="weight-arrow">→</span>
        <span class="month-value">${stats.weight.end}kg</span>
      `;
      labelWeight.textContent = 'Start → Heute';
    } else {
      weightDisplay.className = 'weight-display';
      weightDisplay.innerHTML = `<span class="month-value">--</span>`;
      labelWeight.textContent = 'Gewicht';
    }
  } else {
    weightDisplay.className = 'weight-display';
    const diff = stats.weight.diff;
    weightDisplay.innerHTML = `<span class="month-value">${diff===null?'--':`${diff>0?'+':''}${diff}kg`}</span>`;
    labelWeight.textContent = 'Differenz';
  }

  document.getElementById('weightDaily').innerHTML =
    stats.weight.days.length ? stats.weight.days.map(d => `
      <div class="daily-item"><span class="daily-date">${formatDateShort(d.date)}</span><span class="daily-value neutral">${d.weight} kg</span></div>
    `).join('') : `<div class="daily-item"><span class="daily-value">Keine Einträge</span></div>`;
}

// =====================
// Events
// =====================
function bindEvents() {
  // Guard: nicht mehrfach binden (wichtig, falls du render/start mehrfach triggerst)
  if (window.__lifeStatsEventsBound) return;
  window.__lifeStatsEventsBound = true;

  // =========================
  // Expandables (Screentime/Routine/Woche + Stat-Kacheln)
  // =========================
  document.addEventListener('click', (e) => {
    // Nur wenn auf Header geklickt wurde
    const header = e.target.closest('.card-header, .stat-header');
    if (!header) return;

    // Wrapper finden, der aufklappbar ist
    let wrapper = header.closest('.expandable');
    if (!wrapper) {
      // Stat-Kacheln sind oft "div.stat-card expandable"
      wrapper = header.closest('.stat-card');
      if (!wrapper || !wrapper.classList.contains('expandable')) return;
    }

    wrapper.classList.toggle('open');
  });

  // =========================
  // Entry Toggles (Morgen/Abend/Gym/Fap)
  // =========================
  ['toggleMorning', 'toggleEvening', 'toggleGym', 'toggleFap'].forEach((id) => {
    const btn = document.getElementById(id);
    if (!btn) return;

    btn.onclick = () => {
      btn.dataset.active = (btn.dataset.active !== 'true').toString();
    };
  });

  // =========================
  // View Toggle (Ø / Σ)
  // =========================
  document.querySelectorAll('.view-btn').forEach((btn) => {
    btn.onclick = () => {
      document.querySelectorAll('.view-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      currentView = btn.dataset.view; // "avg" | "sum"
      if (typeof renderStats === 'function') renderStats();
    };
  });

  // =========================
  // Month Dropdown
  // =========================
  const monthSelect = document.getElementById('monthSelect');
  if (monthSelect) {
    monthSelect.onchange = () => {
      currentMonth = monthSelect.value; // "total" | "YYYY-MM"
      if (typeof renderStats === 'function') renderStats();
    };
  }

  // =========================
  // Save (lokal + ggf. Sheets)
  // =========================
  const saveBtn = document.getElementById('saveEntry');
  if (saveBtn) {
    saveBtn.onclick = async () => {
      await saveEntry();           // deine bestehende saveEntry()
      if (typeof updateSyncLockUI === 'function') updateSyncLockUI();
    };
  }

  // =========================
  // Pull: Sheets -> App
  // =========================
  const pullBtn = document.getElementById('pullSheetsBtn');
  if (pullBtn) {
    pullBtn.onclick = async () => {
      try {
        setStatus('⏳ Lade aus Sheets...');
        await pullFromSheets(); // deine bestehende Pull-Funktion
        populateMonthDropdown();
        setTodayDate();
        renderAll();
        setStatus('✅ Aus Sheets geladen');
      } catch (err) {
        setStatus('❌ Fehler beim Laden aus Sheets');
      }
      if (typeof updateSyncLockUI === 'function') updateSyncLockUI();
      setTimeout(() => setStatus(''), 2000);
    };
  }

  // =========================
  // Push: App -> Sheets (Datum)
  // =========================
  const pushBtn = document.getElementById('pushTodayBtn');
  if (pushBtn) {
    pushBtn.onclick = async () => {
      // Sync-Sperre (dein 10er-Lock)
      if (typeof canSyncToSheets === 'function' && !canSyncToSheets()) {
        setStatus(`🔒 Sync gesperrt: ${countMeaningfulEntries()}/${MIN_ENTRIES_TO_SYNC}`);
        setTimeout(() => setStatus(''), 2000);
        return;
      }

      const dateVal = document.getElementById('entryDate')?.value;
      const entry = data.find((d) => d.date === dateVal);

      if (!entry) {
        setStatus('⚠️ Kein lokaler Eintrag für dieses Datum');
        setTimeout(() => setStatus(''), 2000);
        return;
      }

      try {
        setStatus('⏳ Sende an Sheets...');
        await pushEntryToSheets(entry);
        setStatus('✅ Gesendet');
      } catch (err) {
        setStatus('❌ Fehler beim Senden');
      }
      setTimeout(() => setStatus(''), 2200);
    };
  }

  // =========================
  // Reset Secret
  // =========================
  const resetSecretBtn = document.getElementById('resetSecretBtn');
  if (resetSecretBtn) {
    resetSecretBtn.onclick = () => {
      localStorage.removeItem(SHEETS_SECRET_KEY);
      setStatus('🔑 Secret gelöscht (wird beim nächsten Sync neu abgefragt)');
      setTimeout(() => setStatus(''), 2200);
    };
  }

  // =========================
  // Reset lokale Daten
  // =========================
  const resetDataBtn = document.getElementById('resetData');
  if (resetDataBtn) {
    resetDataBtn.onclick = () => {
      if (confirm('Wirklich alle lokalen Daten löschen? (Sheets bleibt)')) {
        localStorage.removeItem('lifeStatsData');
        location.reload();
      }
    };
  }

  // Initial UI State
  if (typeof updateSyncLockUI === 'function') updateSyncLockUI();
}

// =====================
// Prefill entry form
// =====================
function setTodayDate() {
  const today = getToday();
  document.getElementById('entryDate').value = today;

  const t = getTodayData();

  document.getElementById('entryScreen').value = (t.screen !== null && t.screen !== undefined) ? hoursToTimeStr(t.screen) : '';
  document.getElementById('entrySteps').value = (t.steps ?? '') === null ? '' : (t.steps ?? '');
  document.getElementById('entryWeight').value = (t.weight ?? '') === null ? '' : (t.weight ?? '');

  document.getElementById('toggleMorning').dataset.active = (t.morning === true).toString();
  document.getElementById('toggleEvening').dataset.active = (t.evening === true).toString();
  document.getElementById('toggleGym').dataset.active = (t.gym === true).toString();
  document.getElementById('toggleFap').dataset.active = (t.fap === true).toString();
}

// =====================
// Save entry: local + push
// =====================
async function saveEntry() {
  const dateVal = document.getElementById('entryDate').value;
  const screenVal = document.getElementById('entryScreen').value || '';
  const stepsVal = document.getElementById('entrySteps').value || '';
  const weightVal = document.getElementById('entryWeight').value || '';

  const morning = document.getElementById('toggleMorning').dataset.active === 'true';
  const evening = document.getElementById('toggleEvening').dataset.active === 'true';
  const gym = document.getElementById('toggleGym').dataset.active === 'true';
  const fap = document.getElementById('toggleFap').dataset.active === 'true';

  if (!dateVal) return;

  let entry = data.find(d => d.date === dateVal);
  if (!entry) {
    entry = { date: dateVal };
    data.push(entry);
  }

  const screenHours = timeStrToHours(screenVal);
  entry.screen = (screenVal !== '' && screenHours !== null) ? screenHours : null;

  entry.steps = stepsVal !== '' ? parseInt(stepsVal.replace(/\D/g, ''), 10) : null;
  entry.weight = weightVal !== '' ? parseFloat(weightVal.replace(',', '.')) : null;

  entry.morning = morning;
  entry.evening = evening;
  entry.gym = gym;
  entry.fap = fap;

  data.sort((a,b)=> parseDate(a.date) - parseDate(b.date));
  saveData();
  populateMonthDropdown();
  renderAll();

  // Push to Sheets nur wenn freigeschaltet
  if (canSyncToSheets()) {
    try {
      setStatus('⏳ Speichere in Sheets...');
      await pushEntryToSheets(entry);
      setStatus('✅ Gesendet (Sheets no-cors)');
    } catch {
      setStatus('⚠️ Lokal gespeichert, Sheets nicht bestätigt');
    }
  } else {
    setStatus(`💾 Lokal gespeichert (${countMeaningfulEntries()}/${MIN_ENTRIES_TO_SYNC})`);
  }

  setTimeout(() => setStatus(''), 2500);
  updateSyncLockUI();
}

// =====================
// Start
// =====================
(function start(){
  loadData();
  populateMonthDropdown();
  setTodayDate();
  renderAll();
  bindEvents();
})();
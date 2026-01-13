// =====================
// Routinen (Basiszeiten)
// =====================
const routines = {
  morning: [
    ["Aufstehen & Trinken", "06:00"],
    ["Badezimmer", "06:05"],
    ["Anziehen & Packen", "06:30"],
    ["Tag planen", "06:40"],
    ["Bibel & Gebet", "06:45"],
    ["Frühstück", "07:00"]
  ],
  evening: [
    ["Bad / Duschen", "20:00"],
    ["Schlafbereit", "20:30"],
    ["Bibel lesen", "20:45"],
    ["Schlafen", "21:30"]
  ]
};

// ===== Storage Keys =====
const SLEEP_KEY = 'routineSleepDurationMin'; // number in minutes
const SCHEDULE_KEY = 'routineSchedule';

// ===== Default Schlaf =====
const DEFAULT_SLEEP_MIN = 8 * 60 + 30;

// ===== DOM =====
const actionEl = document.getElementById("action");
const timeEl = document.getElementById("newTime");
const sleepDurationEl = document.getElementById("sleepDuration");
const sleepHintEl = document.getElementById("sleepHint");

const outputEl = document.getElementById("routineText");
const wakeTimeEl = document.getElementById("wakeTime");
const sleepTimeEl = document.getElementById("sleepTime");

const confirmBtn = document.getElementById("confirmBtn");
const successMessage = document.getElementById("successMessage");

// ===== State =====
let currentShift = 0;
let currentMorningShift = 0;
let currentEveningShift = 0;
let sleepDurationMin = DEFAULT_SLEEP_MIN;

// =====================
// Helpers
// =====================
function timeToMinutes(t) {
  if (!t) return 0;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(m) {
  m = (m + 1440) % 1440;
  const h = Math.floor(m / 60);
  const min = m % 60;
  return String(h).padStart(2, "0") + ":" + String(min).padStart(2, "0");
}

function durationToStr(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${String(m).padStart(2, '0')}min`;
}

function parseDurationFromTimeInput(val) {
  // val wie "08:30" -> 510
  if (!val) return DEFAULT_SLEEP_MIN;
  const [h, m] = val.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return DEFAULT_SLEEP_MIN;
  return (h * 60 + m);
}

function durationToTimeInput(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// =====================
// Kernlogik: Shifts berechnen + Schlafdauer erzwingen
// =====================
function computeShifts(anchorType, anchorIndex, newTimeVal) {
  // Grundshift aus dem Anker
  const originalTime = routines[anchorType][anchorIndex][1];
  const shift = timeToMinutes(newTimeVal) - timeToMinutes(originalTime);

  let morningShift = shift;
  let eveningShift = shift;

  // Wake/Sleep aus verschobenen Zeiten
  let wake = timeToMinutes(routines.morning[0][1]) + morningShift;
  let sleep = timeToMinutes(routines.evening[routines.evening.length - 1][1]) + eveningShift;

  wake = (wake + 1440) % 1440;
  sleep = (sleep + 1440) % 1440;

  // aktuelle Schlafdauer (Minuten von Schlafen -> Aufwachen)
  let currentDur = (wake - sleep + 1440) % 1440;

  // delta: wie stark müssen wir korrigieren
  const delta = sleepDurationMin - currentDur;

  // Regel:
  // - Anker morgens -> Abend verschieben
  // - Anker abends -> Morgen verschieben
  if (delta !== 0) {
    if (anchorType === 'morning') {
      eveningShift -= delta; // bedtime früher/später, um Zielschlaf zu erreichen
    } else {
      morningShift += delta; // wake später/früher, um Zielschlaf zu erreichen
    }
  }

  return { morningShift, eveningShift, baseShift: shift };
}

// =====================
// Formatierung (Schlafen exakt ausgerichtet)
// =====================
function formatRoutine(routine, shift) {
  const TIME_COL_WIDTH = 13; // "HH:MM – HH:MM" Länge

  return routine.map((item, i) => {
    const startMinutes = timeToMinutes(item[1]) + shift;

    if (item[0] === "Schlafen") {
      const timeCol = minutesToTime(startMinutes);
      return `${timeCol.padEnd(TIME_COL_WIDTH)}   ${item[0]}`;
    }

    const nextItemIndex = i + 1;
    let endMinutes;

    if (nextItemIndex < routine.length) {
      endMinutes = timeToMinutes(routine[nextItemIndex][1]) + shift;
    } else {
      endMinutes = startMinutes + 15;
    }

    const timeCol = `${minutesToTime(startMinutes)} – ${minutesToTime(endMinutes)}`;
    return `${timeCol.padEnd(TIME_COL_WIDTH)}   ${item[0]}`;
  }).join("\n");
}

// =====================
// Wake/Sleep Zeiten anzeigen
// =====================
function updateWakeSleepUI(morningShift, eveningShift) {
  const wakeMinutes = timeToMinutes(routines.morning[0][1]) + morningShift;
  const sleepMinutes = timeToMinutes(routines.evening[routines.evening.length - 1][1]) + eveningShift;

  const wakeStr = minutesToTime(wakeMinutes);
  const sleepStr = minutesToTime(sleepMinutes);

  wakeTimeEl.textContent = wakeStr;
  sleepTimeEl.textContent = sleepStr;
}

// =====================
// Main update
// =====================
function updateRoutineText() {
  const actionValue = actionEl.value;
  const newTimeVal = timeEl.value;

  if (!newTimeVal) {
    outputEl.textContent = "Bitte eine Zeit wählen...";
    return;
  }

  const [routineType, indexStr] = actionValue.split("-");
  const index = parseInt(indexStr, 10);

  // Shifts berechnen (mit Schlafdauer-Korrektur)
  const shifts = computeShifts(routineType, index, newTimeVal);
  currentShift = shifts.baseShift;
  currentMorningShift = shifts.morningShift;
  currentEveningShift = shifts.eveningShift;

  updateWakeSleepUI(currentMorningShift, currentEveningShift);

  // Text generieren
  let text = "";

  if (routineType === "morning") {
    text += "🌙 GESTERN ABEND:\n";
    text += formatRoutine(routines.evening, currentEveningShift);
    text += "\n\n☀️ HEUTE MORGEN:\n";
    text += formatRoutine(routines.morning, currentMorningShift);
    text += "\n\n🌙 HEUTE ABEND:\n";
    text += formatRoutine(routines.evening, currentEveningShift);
  } else {
    text += "🌙 HEUTE ABEND:\n";
    text += formatRoutine(routines.evening, currentEveningShift);
    text += "\n\n☀️ MORGEN FRÜH:\n";
    text += formatRoutine(routines.morning, currentMorningShift);
  }

  outputEl.textContent = text;

  // UI reset
  confirmBtn.classList.remove('success');
  confirmBtn.querySelector('.confirm-text').textContent = 'Routine bestätigen';
  successMessage.classList.remove('show');
}

// =====================
// Confirm -> speichert wake/sleep für Seelenflamme
// =====================
function confirmRoutine() {
  // Aus den aktuellen Shifts final wake/sleep berechnen
  const wakeMinutes = (timeToMinutes(routines.morning[0][1]) + currentMorningShift + 1440) % 1440;
  const sleepMinutes = (timeToMinutes(routines.evening[routines.evening.length - 1][1]) + currentEveningShift + 1440) % 1440;

  const wakeTime = minutesToTime(wakeMinutes);
  const sleepTime = minutesToTime(sleepMinutes);

  const scheduleData = {
    wakeTime,
    sleepTime,
    wakeHour: Math.floor(wakeMinutes / 60),
    wakeMinute: wakeMinutes % 60,
    sleepHour: Math.floor(sleepMinutes / 60),
    sleepMinute: sleepMinutes % 60,
    sleepDurationMin,
    updatedAt: Date.now()
  };

  localStorage.setItem(SCHEDULE_KEY, JSON.stringify(scheduleData));
  localStorage.setItem(SLEEP_KEY, String(sleepDurationMin));

  // Feedback
  confirmBtn.classList.add('success');
  confirmBtn.querySelector('.confirm-text').textContent = 'Übernommen!';
  successMessage.classList.add('show');

  if (navigator.vibrate) navigator.vibrate([50, 30, 50]);

  setTimeout(() => {
    confirmBtn.classList.remove('success');
    confirmBtn.querySelector('.confirm-text').textContent = 'Routine bestätigen';
    successMessage.classList.remove('show');
  }, 2500);
}

// =====================
// Load saved sleep duration + UI
// =====================
function loadSavedSettings() {
  const savedSleep = localStorage.getItem(SLEEP_KEY);
  if (savedSleep) {
    const n = parseInt(savedSleep, 10);
    if (Number.isFinite(n) && n > 0 && n < 24 * 60) sleepDurationMin = n;
  }

  sleepDurationEl.value = durationToTimeInput(sleepDurationMin);
  sleepHintEl.textContent = `Ziel: ${durationToStr(sleepDurationMin)}`;

  // falls schon ein schedule gespeichert ist, zeig ihn kurz an
  const savedSchedule = localStorage.getItem(SCHEDULE_KEY);
  if (savedSchedule) {
    try {
      const s = JSON.parse(savedSchedule);
      if (s.wakeTime) wakeTimeEl.textContent = s.wakeTime;
      if (s.sleepTime) sleepTimeEl.textContent = s.sleepTime;
    } catch {}
  }
}

// =====================
// Events
// =====================
actionEl.addEventListener("change", updateRoutineText);
timeEl.addEventListener("input", updateRoutineText);
timeEl.addEventListener("change", updateRoutineText);

sleepDurationEl.addEventListener("input", () => {
  sleepDurationMin = parseDurationFromTimeInput(sleepDurationEl.value);
  sleepHintEl.textContent = `Ziel: ${durationToStr(sleepDurationMin)}`;
  localStorage.setItem(SLEEP_KEY, String(sleepDurationMin));
  updateRoutineText();
});
sleepDurationEl.addEventListener("change", () => {
  sleepDurationMin = parseDurationFromTimeInput(sleepDurationEl.value);
  sleepHintEl.textContent = `Ziel: ${durationToStr(sleepDurationMin)}`;
  localStorage.setItem(SLEEP_KEY, String(sleepDurationMin));
  updateRoutineText();
});

confirmBtn.addEventListener("click", confirmRoutine);

// =====================
// Start
// =====================
loadSavedSettings();
updateRoutineText();
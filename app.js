const FAMILY = ["Nel", "Santi", "Nico", "Aida", "Chary", "Pau", "Fabio", "Otro"];
const MOODS = [
  { value: "bien", emoji: "😊", label: "Se siente bien" },
  { value: "tranquila", emoji: "😌", label: "Tranquila" },
  { value: "durmiendo", emoji: "😴", label: "Durmiendo" },
  { value: "dolor", emoji: "😣", label: "Con dolor" },
  { value: "cansada", emoji: "🥱", label: "Cansada" },
  { value: "procedimiento", emoji: "🩺", label: "En procedimiento" },
  { value: "atencion", emoji: "🚨", label: "Necesita atención" }
];
const DEFAULT_MOOD = { value: "", updatedAt: 0 };

const initialState = {
  schedule: {},
  daily: {},
  therapies: { radio: false, chemo: false, updatedAt: 0 }
};

let state = structuredClone(initialState);
let selectedMood = DEFAULT_MOOD.value;
const dateKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const fromDateKey = (value) => { const [year, month, day] = value.split("-").map(Number); return new Date(year, month - 1, day, 12); };
const todayKey = () => dateKey(new Date());
let selectedDate = todayKey();
let adapter;
const $ = (selector) => document.querySelector(selector);
const el = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; };

const formatDateTime = (value) => {
  if (!value) return "";
  const date = typeof value === "number" ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(date);
};
const formatTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("es-CO", { hour: "numeric", minute: "2-digit" }).format(date);
};
const toInputDate = (value = Date.now()) => {
  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
};
const toInputTime = (value) => {
  const date = new Date(value);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
};
const timeOnSelectedDate = (value) => {
  const [hours, minutes] = value.split(":").map(Number);
  const date = fromDateKey(selectedDate);
  date.setHours(hours, minutes, 0, 0);
  return date.getTime();
};

function toast(message) {
  const node = $("#toast");
  node.textContent = message;
  node.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => node.classList.remove("show"), 2400);
}

function normalize(data = {}) {
  const schedule = data.schedule || {};
  const daily = data.daily || {};
  if (!data.schedule && data.shift) {
    const people = Array.isArray(data.shift.people) && data.shift.people.length ? data.shift.people : data.shift.person ? [data.shift.person] : [];
    schedule[todayKey()] = {
      shift: { ...data.shift, people },
      nightShift: { people: data.shift.night ? people : [], updatedAt: data.shift.updatedAt || 0 }
    };
  }
  Object.entries(schedule).forEach(([dayKey, day]) => {
    if (day.shift && !day.shifts) {
      const end = day.shift.until || (() => { const date = fromDateKey(dayKey); date.setHours(18, 0, 0, 0); return date.getTime(); })();
      const start = day.shift.start || end - (4 * 60 * 60 * 1000);
      day.shifts = { legacy: { ...day.shift, start, until: end, car: !!day.shift.car } };
    }
  });
  const dayForTimestamp = (timestamp) => timestamp ? dateKey(new Date(timestamp)) : todayKey();
  if (data.mood) {
    const moodDay = dayForTimestamp(data.mood.updatedAt);
    daily[moodDay] ||= {};
    daily[moodDay].mood ||= data.mood;
  }
  Object.entries(data.medications || {}).forEach(([id, medication]) => {
    const medicationDay = dayForTimestamp(medication.time || medication.createdAt);
    daily[medicationDay] ||= {};
    daily[medicationDay].medications ||= {};
    daily[medicationDay].medications[id] ||= medication;
  });
  Object.entries(data.comments || {}).forEach(([id, comment]) => {
    const commentDay = dayForTimestamp(comment.createdAt);
    daily[commentDay] ||= {};
    daily[commentDay].comments ||= {};
    daily[commentDay].comments[id] ||= comment;
  });
  return {
    schedule,
    daily,
    therapies: { ...initialState.therapies, ...(data.therapies || {}) }
  };
}

function render() {
  const { therapies } = state;
  const day = state.schedule[selectedDate] || {};
  const dailyDay = state.daily[selectedDate] || {};
  const mood = { ...DEFAULT_MOOD, ...(dailyDay.mood || {}) };
  const shifts = getDayShifts();
  const now = Date.now();
  const activeShift = selectedDate === todayKey() ? shifts.find((shift) => shift.start <= now && now < shift.until) : null;
  const nightShift = day.nightShift || { people: [] };
  const nightPeople = nightShift.people || [];
  const nightActive = selectedDate === todayKey() && !activeShift && nightPeople.length > 0;
  const shift = activeShift || (nightActive ? { people: nightPeople, until: "" } : { people: [], until: "" });
  const people = shift.people || [];
  const peopleText = people.join(", ");
  $("#current-person").textContent = peopleText || (selectedDate === todayKey() ? "Sin turno activo" : `${shifts.length} ${shifts.length === 1 ? "turno programado" : "turnos programados"}`);
  $("#current-avatar").textContent = people.length > 1 ? String(people.length) : people.length ? people[0][0].toUpperCase() : "—";
  $("#current-until").textContent = activeShift
    ? `${people.length > 1 ? "Están" : "Está"} hasta ${formatDateTime(shift.until)}`
    : nightActive ? "Turno nocturno activo" : "Revisa los horarios completos del día";
  $("#current-car").classList.toggle("visible", !!activeShift?.car);
  $("#night-people").textContent = nightPeople.length ? nightPeople.join(", ") : "Sin asignar";
  $("#night-active-status").textContent = nightActive ? "ACTIVO" : "";
  $("#night-active-status").classList.toggle("visible", nightActive);
  $("#schedule-date").value = selectedDate;
  const chosenDate = fromDateKey(selectedDate);
  const todayDate = fromDateKey(todayKey());
  const relativeDay = Math.round((chosenDate - todayDate) / (24 * 60 * 60 * 1000));
  const relativeLabel = relativeDay === -1 ? "Ayer" : relativeDay === 0 ? "Hoy" : relativeDay === 1 ? "Mañana" : "";
  const formattedDay = new Intl.DateTimeFormat("es-CO", { weekday: "short", day: "numeric", month: "short" }).format(chosenDate);
  const dayLabel = `ACOMPAÑAMIENTO · ${(relativeLabel || formattedDay).toUpperCase()}`;
  $("#selected-day-label").textContent = dayLabel;
  const compactDayLabel = relativeLabel || formattedDay;
  $("#med-day-label").textContent = compactDayLabel;
  $("#comments-day-label").textContent = compactDayLabel;
  renderShifts(shifts, activeShift?.id);

  document.querySelectorAll(".family-member").forEach((button) => {
    const active = button.dataset.person === "Otro"
      ? people.some((person) => !FAMILY.includes(person))
      : people.includes(button.dataset.person);
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  selectedMood = MOODS.some((option) => option.value === mood.value) ? mood.value : "";
  document.querySelectorAll(".mood-button").forEach((button) => {
    const active = button.dataset.mood === selectedMood;
    button.classList.toggle("selected", active);
    button.setAttribute("aria-checked", String(active));
  });
  $("#mood-meta").textContent = mood.updatedAt ? `Actualizado ${formatDateTime(mood.updatedAt)}` : "Elige un emoji";

  $("#radio-check").checked = !!therapies.radio;
  $("#chemo-check").checked = !!therapies.chemo;
  $("#radio-status").textContent = therapies.radio ? "Realizada ✓" : "Pendiente";
  $("#chemo-status").textContent = therapies.chemo ? "Realizada ✓" : "Pendiente";
  $("#therapy-meta").textContent = therapies.updatedAt ? `Actualizado ${formatDateTime(therapies.updatedAt)}` : "";
  renderMeds();
  renderComments();
}

function getDayShifts() {
  const shifts = state.schedule[selectedDate]?.shifts || {};
  return Object.entries(shifts)
    .map(([id, value]) => ({ id, ...value, people: value.people || [] }))
    .filter((shift) => shift.start && shift.until)
    .sort((a, b) => a.start - b.start);
}

function renderShifts(shifts, activeId = "") {
  const container = $("#shift-list");
  container.replaceChildren();
  if (!shifts.length) return container.append(el("p", "empty-state", "Todavía no hay turnos programados."));
  shifts.forEach((shift) => {
    const row = el("article", `scheduled-shift${shift.id === activeId ? " active" : ""}`);
    const hours = el("div", "shift-hours");
    hours.append(document.createTextNode(formatTime(shift.start)), el("span", "", `hasta ${formatTime(shift.until)}`));
    const info = el("div", "shift-info");
    info.append(el("b", "", shift.people.join(", ") || "Sin acompañante"));
    if (shift.car) info.append(el("small", "", "🚗 Llega en carro"));
    const actions = el("div", "shift-actions");
    const edit = el("button", "", "✎"); edit.type = "button"; edit.title = "Editar turno";
    edit.addEventListener("click", () => openShift("", shift.id));
    const remove = el("button", "", "×"); remove.type = "button"; remove.title = "Eliminar turno";
    remove.addEventListener("click", async () => {
      if (!confirm(`¿Eliminar el turno de ${formatTime(shift.start)}?`)) return;
      await adapter.remove(`schedule/${selectedDate}/shifts/${shift.id}`);
      toast("Turno eliminado");
    });
    actions.append(edit, remove);
    row.append(hours, info, actions);
    container.append(row);
  });
}

function renderMeds() {
  const container = $("#med-list");
  container.replaceChildren();
  const medsForDay = state.daily[selectedDate]?.medications || {};
  const meds = Object.entries(medsForDay).map(([id, value]) => ({ id, ...value })).sort((a, b) => (b.time || 0) - (a.time || 0));
  if (!meds.length) return container.append(el("p", "empty-state", "Todavía no hay medicinas registradas."));
  meds.forEach((med) => {
    const row = el("article", "entry");
    const info = el("div");
    info.append(el("h3", "", med.name || "Medicina"));
    info.append(el("p", "", med.dose || ""));
    info.append(el("p", "entry-author", `Actualizó: ${med.author || "sin registrar"}`));
    const side = el("div");
    side.append(el("div", "entry-time", formatTime(med.time)));
    const remove = el("button", "delete-button", "Eliminar");
    remove.type = "button";
    remove.addEventListener("click", async () => {
      if (!confirm(`¿Eliminar el registro de ${med.name}?`)) return;
      await adapter.remove(`daily/${selectedDate}/medications/${med.id}`);
      toast("Registro eliminado");
    });
    side.append(remove);
    row.append(info, side);
    container.append(row);
  });
}

function renderComments() {
  const container = $("#comment-list");
  container.replaceChildren();
  const commentsForDay = state.daily[selectedDate]?.comments || {};
  const comments = Object.entries(commentsForDay).map(([id, value]) => ({ id, ...value })).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  if (!comments.length) return container.append(el("p", "empty-state", "Aún no hay comentarios. Deja el primero 💛"));
  comments.forEach((comment) => {
    const article = el("article", "comment");
    const top = el("div", "comment-top");
    top.append(el("b", "", comment.author || "Familia"));
    const time = el("time", "", formatDateTime(comment.createdAt));
    top.append(time);
    article.append(top, el("p", "", comment.text || ""));
    const remove = el("button", "delete-button", "Eliminar");
    remove.type = "button";
    remove.addEventListener("click", async () => {
      if (!confirm("¿Eliminar este comentario?")) return;
      await adapter.remove(`daily/${selectedDate}/comments/${comment.id}`);
    });
    article.append(remove);
    container.append(article);
  });
}

function setupStaticUi() {
  const familyGrid = $("#family-grid");
  const picker = $("#shift-people");
  const nightPicker = $("#night-people-picker");
  FAMILY.forEach((name) => {
    const button = el("button", "family-member");
    button.type = "button";
    button.dataset.person = name;
    button.innerHTML = `<span class="member-dot"></span><span>${name}</span>`;
    button.addEventListener("click", () => openShift(name));
    familyGrid.append(button);
    const choice = el("label", "person-choice");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox"; checkbox.name = "shift-person"; checkbox.value = name;
    choice.append(checkbox, el("span", "", name));
    picker.append(choice);
    const nightChoice = el("label", "person-choice");
    const nightCheckbox = document.createElement("input");
    nightCheckbox.type = "checkbox"; nightCheckbox.name = "night-person"; nightCheckbox.value = name;
    nightChoice.append(nightCheckbox, el("span", "", name));
    nightPicker.append(nightChoice);
  });
  document.querySelector('input[name="shift-person"][value="Otro"]').addEventListener("change", (event) => {
    $("#shift-other-wrap").hidden = !event.target.checked;
    if (event.target.checked) $("#shift-other-name").focus();
  });
  document.querySelector('input[name="night-person"][value="Otro"]').addEventListener("change", (event) => {
    $("#night-other-wrap").hidden = !event.target.checked;
    if (event.target.checked) $("#night-other-name").focus();
  });
  const moods = $("#mood-options");
  MOODS.forEach((mood) => {
    const button = el("button", "mood-button");
    button.type = "button"; button.dataset.mood = mood.value; button.setAttribute("role", "radio");
    button.append(el("span", "", mood.emoji), document.createTextNode(mood.label));
    button.addEventListener("click", async () => {
      selectedMood = mood.value;
      document.querySelectorAll(".mood-button").forEach((node) => node.classList.toggle("selected", node === button));
      await adapter.set(`daily/${selectedDate}/mood`, { value: selectedMood, updatedAt: Date.now() });
      toast("Estado actualizado");
    });
    moods.append(button);
  });
}

function openShift(person = "", shiftId = "") {
  const shift = shiftId ? getDayShifts().find((item) => item.id === shiftId) || { people: [] } : { people: [] };
  const customPerson = (shift.people || []).find((name) => !FAMILY.includes(name)) || "";
  const selected = new Set((shift.people || []).map((name) => FAMILY.includes(name) ? name : "Otro"));
  if (person) selected.add(person);
  if (!selected.size) selected.add(FAMILY[0]);
  document.querySelectorAll('input[name="shift-person"]').forEach((input) => { input.checked = selected.has(input.value); });
  $("#shift-id").value = shiftId;
  $("#shift-dialog-title").textContent = shiftId ? "Editar turno" : "Agregar turno";
  $("#shift-other-name").value = customPerson;
  $("#shift-other-wrap").hidden = !selected.has("Otro");
  const defaultStart = new Date(fromDateKey(selectedDate));
  if (selectedDate === todayKey()) {
    const now = new Date();
    now.setMinutes(now.getMinutes() < 30 ? 30 : 60, 0, 0);
    defaultStart.setHours(now.getHours(), now.getMinutes(), 0, 0);
  } else defaultStart.setHours(8, 0, 0, 0);
  const defaultUntil = new Date(defaultStart.getTime() + 4 * 60 * 60 * 1000);
  $("#shift-start").value = toInputTime(shift.start || defaultStart);
  $("#shift-until").value = toInputTime(shift.until || defaultUntil);
  $("#shift-car").checked = !!shift.car;
  $("#shift-dialog").showModal();
}

function openNight() {
  const nightShift = state.schedule[selectedDate]?.nightShift || { people: [] };
  const customPerson = (nightShift.people || []).find((name) => !FAMILY.includes(name)) || "";
  const selected = new Set((nightShift.people || []).map((name) => FAMILY.includes(name) ? name : "Otro"));
  document.querySelectorAll('input[name="night-person"]').forEach((input) => { input.checked = selected.has(input.value); });
  $("#night-other-name").value = customPerson;
  $("#night-other-wrap").hidden = !selected.has("Otro");
  $("#night-dialog").showModal();
}

function changeDay(offset) {
  const date = fromDateKey(selectedDate);
  date.setDate(date.getDate() + offset);
  selectedDate = dateKey(date);
  render();
}

function bindEvents() {
  document.querySelectorAll(".close-button").forEach((button) => {
    button.addEventListener("click", () => button.closest("dialog")?.close());
  });
  $("#edit-shift").addEventListener("click", () => openShift());
  $("#add-shift").addEventListener("click", () => openShift());
  $("#previous-day").addEventListener("click", () => changeDay(-1));
  $("#next-day").addEventListener("click", () => changeDay(1));
  $("#go-today").addEventListener("click", () => { selectedDate = todayKey(); render(); });
  $("#med-previous").addEventListener("click", () => changeDay(-1));
  $("#med-next").addEventListener("click", () => changeDay(1));
  $("#med-today").addEventListener("click", () => { selectedDate = todayKey(); render(); });
  $("#comments-previous").addEventListener("click", () => changeDay(-1));
  $("#comments-next").addEventListener("click", () => changeDay(1));
  $("#comments-today").addEventListener("click", () => { selectedDate = todayKey(); render(); });
  $("#schedule-date").addEventListener("change", (event) => { if (event.target.value) { selectedDate = event.target.value; render(); } });
  $("#shift-form").addEventListener("submit", async (event) => {
    if (event.submitter?.value === "cancel") return;
    event.preventDefault();
    const people = [...document.querySelectorAll('input[name="shift-person"]:checked')].map((input) => input.value);
    const otherIndex = people.indexOf("Otro");
    if (otherIndex >= 0) {
      const otherName = $("#shift-other-name").value.trim();
      if (!otherName) return toast("Escribe el nombre de la otra persona");
      people[otherIndex] = otherName;
    }
    if (!people.length) return toast("Elige al menos una persona");
    const start = timeOnSelectedDate($("#shift-start").value);
    const until = timeOnSelectedDate($("#shift-until").value);
    if (until <= start) return toast("La hora de salida debe ser posterior a la llegada");
    const value = { people, person: people[0], start, until, car: $("#shift-car").checked, updatedAt: Date.now() };
    const shiftId = $("#shift-id").value;
    if (shiftId) await adapter.set(`schedule/${selectedDate}/shifts/${shiftId}`, value);
    else await adapter.push(`schedule/${selectedDate}/shifts`, value);
    $("#shift-dialog").close(); toast(shiftId ? "Turno actualizado" : "Turno agregado");
  });
  $("#edit-night").addEventListener("click", openNight);
  $("#night-form").addEventListener("submit", async (event) => {
    if (event.submitter?.value === "cancel") return;
    event.preventDefault();
    const people = [...document.querySelectorAll('input[name="night-person"]:checked')].map((input) => input.value);
    const otherIndex = people.indexOf("Otro");
    if (otherIndex >= 0) {
      const otherName = $("#night-other-name").value.trim();
      if (!otherName) return toast("Escribe el nombre de la otra persona");
      people[otherIndex] = otherName;
    }
    await adapter.set(`schedule/${selectedDate}/nightShift`, { people, updatedAt: Date.now() });
    $("#night-dialog").close(); toast(people.length ? "Turno nocturno actualizado" : "Turno nocturno sin asignar");
  });
  ["radio", "chemo"].forEach((kind) => {
    $(`#${kind}-check`).addEventListener("change", async () => {
      await adapter.set("therapies", { ...state.therapies, [kind]: $(`#${kind}-check`).checked, updatedAt: Date.now() });
      toast("Tratamiento actualizado");
    });
  });
  $("#add-med").addEventListener("click", () => {
    $("#med-form").reset();
    $("#med-time").value = toInputTime(Date.now());
    $("#med-author").value = localStorage.getItem("xime-user") || "";
    $("#med-dialog").showModal();
  });
  $("#med-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const author = $("#med-author").value.trim();
    localStorage.setItem("xime-user", author);
    await adapter.push(`daily/${selectedDate}/medications`, { name: $("#med-name").value.trim(), dose: $("#med-dose").value.trim(), time: timeOnSelectedDate($("#med-time").value), author, createdAt: Date.now() });
    $("#med-dialog").close(); toast("Medicina agregada");
  });
  $("#comment-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const author = $("#comment-author").value.trim(); localStorage.setItem("xime-user", author);
    await adapter.push(`daily/${selectedDate}/comments`, { author, text: $("#comment-text").value.trim(), createdAt: Date.now() });
    $("#comment-text").value = ""; toast("Comentario publicado");
  });
  $("#comment-author").value = localStorage.getItem("xime-user") || "";
}

function localAdapter() {
  const key = "xime-family-state-v1";
  const emit = () => { state = normalize(JSON.parse(localStorage.getItem(key) || "{}")); render(); };
  const save = () => { localStorage.setItem(key, JSON.stringify(state)); emit(); };
  window.addEventListener("storage", emit);
  return {
    listen: emit,
    async set(path, value) {
      const parts = path.split("/"); let target = state;
      parts.slice(0, -1).forEach((part) => { target[part] ||= {}; target = target[part]; });
      target[parts.at(-1)] = value; save();
    },
    async push(path, value) {
      const parts = path.split("/"); let target = state;
      parts.forEach((part) => { target[part] ||= {}; target = target[part]; });
      target[crypto.randomUUID()] = value; save();
    },
    async remove(path) {
      const parts = path.split("/"); let target = state;
      parts.slice(0, -1).forEach((part) => { target = target?.[part]; });
      if (target) delete target[parts.at(-1)]; save();
    }
  };
}

async function firebaseAdapter(config) {
  const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js");
  const { getDatabase, ref, onValue, set, push, remove } = await import("https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js");
  const app = initializeApp(config);
  const db = getDatabase(app);
  return {
    listen() { onValue(ref(db, "xime"), (snapshot) => { state = normalize(snapshot.val() || {}); render(); }, () => setConnection(false)); },
    async set(path, value) { await set(ref(db, `xime/${path}`), value); },
    async push(path, value) { await push(ref(db, `xime/${path}`), value); },
    async remove(path) { await remove(ref(db, `xime/${path}`)); }
  };
}

function setConnection(online, local = false) {
  const pill = $("#connection-pill");
  pill.className = `live-pill ${online ? "online" : "offline"}`;
  pill.querySelector("b").textContent = local ? "Modo de prueba local" : online ? "En vivo · familia conectada" : "Sin conexión";
}

async function start() {
  setupStaticUi(); bindEvents();
  const config = window.XIME_FIREBASE_CONFIG || {};
  const configured = config.apiKey && config.databaseURL && !config.apiKey.includes("PEGA");
  try {
    adapter = configured ? await firebaseAdapter(config) : localAdapter();
    setConnection(true, !configured);
    adapter.listen();
  } catch (error) {
    console.error(error);
    adapter = localAdapter(); setConnection(true, true); adapter.listen();
    toast("Firebase no respondió; usando modo local");
  }
}

start();

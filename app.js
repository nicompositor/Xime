const FAMILY = ["Nel", "Santi", "Nico", "Aida", "Chary", "Pau", "Fabio", "Otro"];
const MOODS = [
  { value: "muy-bien", emoji: "😊", label: "Muy bien" },
  { value: "bien", emoji: "🙂", label: "Bien" },
  { value: "tranquila", emoji: "😌", label: "Tranquila" },
  { value: "cansada", emoji: "😴", label: "Cansada" },
  { value: "regular", emoji: "😕", label: "Regular" }
];

const initialState = {
  schedule: {},
  mood: { value: "tranquila", note: "", updatedAt: 0 },
  therapies: { radio: false, chemo: false, updatedAt: 0 },
  medications: {},
  comments: {}
};

let state = structuredClone(initialState);
let selectedMood = state.mood.value;
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

function toast(message) {
  const node = $("#toast");
  node.textContent = message;
  node.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => node.classList.remove("show"), 2400);
}

function normalize(data = {}) {
  const schedule = data.schedule || {};
  if (!data.schedule && data.shift) {
    const people = Array.isArray(data.shift.people) && data.shift.people.length ? data.shift.people : data.shift.person ? [data.shift.person] : [];
    schedule[todayKey()] = {
      shift: { ...data.shift, people },
      nightShift: { people: data.shift.night ? people : [], updatedAt: data.shift.updatedAt || 0 }
    };
  }
  return {
    schedule,
    mood: { ...initialState.mood, ...(data.mood || {}) },
    therapies: { ...initialState.therapies, ...(data.therapies || {}) },
    medications: data.medications || {},
    comments: data.comments || {}
  };
}

function render() {
  const { mood, therapies } = state;
  const day = state.schedule[selectedDate] || {};
  const shift = day.shift || { people: [], until: "" };
  const nightShift = day.nightShift || { people: [] };
  const people = shift.people || [];
  const peopleText = people.join(", ");
  $("#current-person").textContent = peopleText || "Sin turno asignado";
  $("#current-avatar").textContent = people.length > 1 ? String(people.length) : people.length ? people[0][0].toUpperCase() : "—";
  $("#current-until").textContent = shift.until
    ? `${people.length > 1 ? "Están" : "Está"} hasta ${formatDateTime(shift.until)}`
    : "Elige quiénes están con ella";
  const nightPeople = nightShift.people || [];
  $("#night-people").textContent = nightPeople.length ? nightPeople.join(", ") : "Sin asignar";
  $("#schedule-date").value = selectedDate;
  const chosenDate = fromDateKey(selectedDate);
  const dayLabel = selectedDate === todayKey()
    ? "ACOMPAÑAMIENTO · HOY"
    : `ACOMPAÑAMIENTO · ${new Intl.DateTimeFormat("es-CO", { weekday: "short", day: "numeric", month: "short" }).format(chosenDate).toUpperCase()}`;
  $("#selected-day-label").textContent = dayLabel;

  document.querySelectorAll(".family-member").forEach((button) => {
    const active = button.dataset.person === "Otro"
      ? people.some((person) => !FAMILY.includes(person))
      : people.includes(button.dataset.person);
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  selectedMood = mood.value || "tranquila";
  document.querySelectorAll(".mood-button").forEach((button) => {
    const active = button.dataset.mood === selectedMood;
    button.classList.toggle("selected", active);
    button.setAttribute("aria-checked", String(active));
  });
  if (document.activeElement !== $("#mood-note")) $("#mood-note").value = mood.note || "";
  $("#mood-meta").textContent = mood.updatedAt ? `Actualizado ${formatDateTime(mood.updatedAt)}` : "";

  $("#radio-check").checked = !!therapies.radio;
  $("#chemo-check").checked = !!therapies.chemo;
  $("#radio-status").textContent = therapies.radio ? "Realizada ✓" : "Pendiente";
  $("#chemo-status").textContent = therapies.chemo ? "Realizada ✓" : "Pendiente";
  $("#therapy-meta").textContent = therapies.updatedAt ? `Actualizado ${formatDateTime(therapies.updatedAt)}` : "";
  renderMeds();
  renderComments();
}

function renderMeds() {
  const container = $("#med-list");
  container.replaceChildren();
  const meds = Object.entries(state.medications).map(([id, value]) => ({ id, ...value })).sort((a, b) => (b.time || 0) - (a.time || 0));
  if (!meds.length) return container.append(el("p", "empty-state", "Todavía no hay medicinas registradas."));
  meds.forEach((med) => {
    const row = el("article", "entry");
    const info = el("div");
    info.append(el("h3", "", med.name || "Medicina"));
    info.append(el("p", "", med.dose || ""));
    const side = el("div");
    side.append(el("div", "entry-time", formatTime(med.time)));
    const remove = el("button", "delete-button", "Eliminar");
    remove.type = "button";
    remove.addEventListener("click", async () => {
      if (!confirm(`¿Eliminar el registro de ${med.name}?`)) return;
      await adapter.remove(`medications/${med.id}`);
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
  const comments = Object.entries(state.comments).map(([id, value]) => ({ id, ...value })).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
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
      await adapter.remove(`comments/${comment.id}`);
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
    button.addEventListener("click", () => { selectedMood = mood.value; document.querySelectorAll(".mood-button").forEach((node) => node.classList.toggle("selected", node === button)); });
    moods.append(button);
  });
}

function openShift(person = "") {
  const shift = state.schedule[selectedDate]?.shift || { people: [] };
  const customPerson = (shift.people || []).find((name) => !FAMILY.includes(name)) || "";
  const selected = new Set((shift.people || []).map((name) => FAMILY.includes(name) ? name : "Otro"));
  if (person) selected.add(person);
  if (!selected.size) selected.add(FAMILY[0]);
  document.querySelectorAll('input[name="shift-person"]').forEach((input) => { input.checked = selected.has(input.value); });
  $("#shift-other-name").value = customPerson;
  $("#shift-other-wrap").hidden = !selected.has("Otro");
  const defaultUntil = new Date(fromDateKey(selectedDate)); defaultUntil.setHours(18, 0, 0, 0);
  $("#shift-until").value = shift.until ? toInputDate(shift.until) : toInputDate(defaultUntil);
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
  $("#edit-shift").addEventListener("click", () => openShift());
  $("#previous-day").addEventListener("click", () => changeDay(-1));
  $("#next-day").addEventListener("click", () => changeDay(1));
  $("#go-today").addEventListener("click", () => { selectedDate = todayKey(); render(); });
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
    await adapter.set(`schedule/${selectedDate}/shift`, { people, person: people[0], until: new Date($("#shift-until").value).getTime(), updatedAt: Date.now() });
    $("#shift-dialog").close(); toast("Turno actualizado");
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
  $("#save-mood").addEventListener("click", async () => {
    await adapter.set("mood", { value: selectedMood, note: $("#mood-note").value.trim(), updatedAt: Date.now() });
    toast("Estado actualizado");
  });
  ["radio", "chemo"].forEach((kind) => {
    $(`#${kind}-check`).addEventListener("change", async () => {
      await adapter.set("therapies", { ...state.therapies, [kind]: $(`#${kind}-check`).checked, updatedAt: Date.now() });
      toast("Tratamiento actualizado");
    });
  });
  $("#add-med").addEventListener("click", () => {
    $("#med-form").reset(); $("#med-time").value = toInputDate(); $("#med-dialog").showModal();
  });
  $("#med-form").addEventListener("submit", async (event) => {
    if (event.submitter?.value === "cancel") return;
    event.preventDefault();
    await adapter.push("medications", { name: $("#med-name").value.trim(), dose: $("#med-dose").value.trim(), time: new Date($("#med-time").value).getTime(), createdAt: Date.now() });
    $("#med-dialog").close(); toast("Medicina agregada");
  });
  $("#comment-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const author = $("#comment-author").value.trim(); localStorage.setItem("xime-user", author);
    await adapter.push("comments", { author, text: $("#comment-text").value.trim(), createdAt: Date.now() });
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
    async push(path, value) { state[path][crypto.randomUUID()] = value; save(); },
    async remove(path) { const [group, id] = path.split("/"); delete state[group][id]; save(); }
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

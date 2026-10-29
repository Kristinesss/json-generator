let teamList = [];

function flattenTeams(data) {
  const out = [];
  const keys = ["premierLeague", "championship", "bundesliga", "laLiga"];
  for (const key of keys) {
    const league = data[key];
    if (league && Array.isArray(league.teams)) {
      for (const name of league.teams) {
        out.push({ name, league: league.name });
      }
    }
  }
  return out;
}

function setupTeamAutocomplete(inputEl, options) {
  const wrap = inputEl.closest(".autocomplete-wrap");
  if (!wrap) return;

  const listEl = document.createElement("ul");
  listEl.className = "autocomplete-list hidden";
  listEl.setAttribute("role", "listbox");
  wrap.appendChild(listEl);

  let selectedIndex = -1;
  let blurTimer = null;

  function hide() {
    listEl.classList.add("hidden");
    listEl.innerHTML = "";
    selectedIndex = -1;
  }

  function showMatches() {
    const value = inputEl.value.trim().toLowerCase();
    const limit = 50;
    const teams = options.teams || teamList;
    const filtered = value === ""
      ? teams.slice(0, limit)
      : teams.filter(t => t.name.toLowerCase().includes(value)).slice(0, limit);
    selectedIndex = filtered.length > 0 ? 0 : -1;
    listEl.innerHTML = "";
    if (filtered.length === 0) {
      hide();
      return;
    }
    for (let i = 0; i < filtered.length; i++) {
      const li = document.createElement("li");
      li.setAttribute("role", "option");
      li.dataset.name = filtered[i].name;
      li.textContent = filtered[i].name;
      const leagueSpan = document.createElement("span");
      leagueSpan.className = "league";
      leagueSpan.textContent = filtered[i].league;
      li.appendChild(leagueSpan);
      if (i === 0) li.classList.add("active");
      listEl.appendChild(li);
    }
    listEl.classList.remove("hidden");
  }

  function selectItem(name) {
    inputEl.value = name;
    hide();
    if (options.onSelect) options.onSelect();
  }

  inputEl.addEventListener("input", showMatches);
  inputEl.addEventListener("focus", showMatches);

  listEl.addEventListener("click", (e) => {
    const li = e.target.closest("li");
    if (li && li.dataset.name) {
      selectItem(li.dataset.name);
    }
  });

  inputEl.addEventListener("keydown", (e) => {
    if (listEl.classList.contains("hidden")) return;
    const items = listEl.querySelectorAll("li");
    if (e.key === "ArrowDown") {
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
      items.forEach((el, i) => el.classList.toggle("active", i === selectedIndex));
      if (selectedIndex >= 0) items[selectedIndex].scrollIntoView({ block: "nearest" });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, 0);
      items.forEach((el, i) => el.classList.toggle("active", i === selectedIndex));
      if (selectedIndex >= 0) items[selectedIndex].scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter") {
      if (selectedIndex >= 0 && items[selectedIndex] && items[selectedIndex].dataset.name) {
        e.preventDefault();
        selectItem(items[selectedIndex].dataset.name);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      hide();
      inputEl.blur();
    }
  });

  inputEl.addEventListener("blur", () => {
    blurTimer = setTimeout(hide, 150);
  });
  listEl.addEventListener("mousedown", (e) => e.preventDefault());

  wrap.addEventListener("mousedown", (e) => {
    if (e.target === listEl || listEl.contains(e.target)) {
      clearTimeout(blurTimer);
    }
  });
}

function safeBaseFilename(value) {
  return (value || "vg-live-event")
    .trim()
    .replace(/\.(mp4|json)$/i, "")
    || "vg-live-event";
}

// Inside a shared Claude artifact the page cannot start downloads itself,
// so it asks the viewer through the downloads capability. Elsewhere it
// falls back to a normal browser download.
async function saveJSON(filename, text) {
  const downloads = window.claude && window.claude.use
    ? await window.claude.use("downloads").catch(() => null)
    : null;
  if (downloads) {
    await downloads.save({ filename, data: text });
    return;
  }
  const blob = new Blob([text], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function normalizeFilenameInput(inputEl) {
  const cleaned = safeBaseFilename(inputEl.value);
  if (inputEl.value !== "" && inputEl.value !== cleaned) {
    inputEl.value = cleaned;
  }
}

function setupTabs() {
  const tabs = ["Fotball", "PL", "Annet"].map(name => ({
    tab: document.getElementById(`tab${name}`),
    panel: document.getElementById(`panel${name}`)
  }));

  function showTab(which) {
    document.querySelectorAll(".autocomplete-list").forEach(el => el.classList.add("hidden"));
    for (const t of tabs) {
      t.tab.classList.toggle("active", t === which);
      t.panel.classList.toggle("active", t === which);
    }
  }

  tabs.forEach(t => t.tab.addEventListener("click", () => showTab(t)));
}

function setupFotball(prefix = "fotball", teams = teamList, defaultKeyword = "") {
  const ids = ["title", "eventId", "type", "team", "person", "keyword", "filename", "homeScore", "awayScore"];
  const els = Object.fromEntries(ids.map(id => [id, document.getElementById(`${prefix}_${id}`)]));
  const preview = document.getElementById(`${prefix}_preview`);
  const status = document.getElementById(`${prefix}_status`);
  const videoName = document.getElementById(`${prefix}_videoName`);
  const jsonName = document.getElementById(`${prefix}_jsonName`);
  const toVgYes = document.getElementById(`${prefix}_toVgYes`);
  const toVgNo = document.getElementById(`${prefix}_toVgNo`);

  let sendToVgLive = true;

  function getScoreString() {
    const home = els.homeScore.value === "" ? "0" : els.homeScore.value;
    const away = els.awayScore.value === "" ? "0" : els.awayScore.value;
    return `${home}-${away}`;
  }

  function syncKeywordWithVgLive() {
    if (sendToVgLive) {
      if (els.keyword.value === "not-vglive") {
        els.keyword.value = defaultKeyword;
      }
    } else {
      els.keyword.value = "not-vglive";
    }
  }

  function updateVgLiveButtons() {
    toVgYes.classList.toggle("active", sendToVgLive);
    toVgNo.classList.toggle("active", !sendToVgLive);
  }

  function buildPayload() {
    return {
      title: els.title.value,
      schibstedSportEventId: els.eventId.value,
      incidentType: els.type.value,
      incidentTeam: els.team.value,
      incidentPerson: els.person.value,
      incidentDate: new Date().toISOString(),
      scoreDuringIncident: getScoreString(),
      keyword: els.keyword.value
    };
  }

  function updatePreview() {
    normalizeFilenameInput(els.filename);
    syncKeywordWithVgLive();
    const payload = buildPayload();
    const base = safeBaseFilename(els.filename.value);
    preview.value = JSON.stringify(payload, null, 2);
    videoName.textContent = `${base}.mp4`;
    jsonName.textContent = `${base}.json`;
    status.textContent = "";
  }

  function downloadJSON() {
    normalizeFilenameInput(els.filename);
    syncKeywordWithVgLive();
    const payload = buildPayload();
    const base = safeBaseFilename(els.filename.value);
    updatePreview();
    saveJSON(`${base}.json`, JSON.stringify(payload, null, 2))
      .then(() => { status.textContent = `Lastet ned: ${base}.json`; })
      .catch(e => { status.textContent = e && e.code === "declined" ? "Nedlasting avbrutt." : "Kunne ikke laste ned filen."; });
  }

  ids.forEach(id => els[id].addEventListener("input", updatePreview));
  document.getElementById(`${prefix}_downloadBtn`).addEventListener("click", downloadJSON);
  document.getElementById(`${prefix}_resetBtn`).addEventListener("click", () => {
    els.title.value = "";
    els.eventId.value = "";
    els.type.value = "Highlights";
    els.team.value = "";
    els.person.value = "";
    els.keyword.value = defaultKeyword;
    els.filename.value = "";
    els.homeScore.value = "0";
    els.awayScore.value = "0";
    sendToVgLive = true;
    updateVgLiveButtons();
    updatePreview();
  });

  toVgYes.addEventListener("click", () => {
    sendToVgLive = true;
    updateVgLiveButtons();
    updatePreview();
  });

  toVgNo.addEventListener("click", () => {
    sendToVgLive = false;
    updateVgLiveButtons();
    updatePreview();
  });

  els.type.value = "Highlights";
  els.keyword.value = defaultKeyword;
  els.filename.value = "";
  els.homeScore.value = "0";
  els.awayScore.value = "0";
  updateVgLiveButtons();
  updatePreview();

  if (teams.length > 0) {
    setupTeamAutocomplete(els.team, { teams, onSelect: updatePreview });
  }
}

function setupAnnet() {
  const ids = ["title", "eventId", "type", "team", "person", "keyword", "filename"];
  const els = Object.fromEntries(ids.map(id => [id, document.getElementById(`annet_${id}`)]));
  const preview = document.getElementById("annet_preview");
  const status = document.getElementById("annet_status");
  const videoName = document.getElementById("annet_videoName");
  const jsonName = document.getElementById("annet_jsonName");
  const toVgYes = document.getElementById("annet_toVgYes");
  const toVgNo = document.getElementById("annet_toVgNo");

  let sendToVgLive = true;

  function syncKeywordWithVgLive() {
    if (sendToVgLive) {
      if (els.keyword.value === "" || els.keyword.value === "not-vglive") {
        els.keyword.value = "vglive";
      }
    } else {
      els.keyword.value = "not-vglive";
    }
  }

  function updateVgLiveButtons() {
    toVgYes.classList.toggle("active", sendToVgLive);
    toVgNo.classList.toggle("active", !sendToVgLive);
  }

  function buildPayload() {
    return {
      title: els.title.value,
      schibstedSportEventId: els.eventId.value,
      importance: "",
      incidentType: els.type.value,
      incidentTeam: els.team.value,
      incidentPerson: els.person.value,
      incidentDate: new Date().toISOString(),
      scoreDuringIncident: "",
      keyword: els.keyword.value
    };
  }

  function updatePreview() {
    normalizeFilenameInput(els.filename);
    syncKeywordWithVgLive();
    const payload = buildPayload();
    const base = safeBaseFilename(els.filename.value);
    preview.value = JSON.stringify(payload, null, 2);
    videoName.textContent = `${base}.mp4`;
    jsonName.textContent = `${base}.json`;
    status.textContent = "";
  }

  function downloadJSON() {
    normalizeFilenameInput(els.filename);
    syncKeywordWithVgLive();
    const payload = buildPayload();
    const base = safeBaseFilename(els.filename.value);
    updatePreview();
    saveJSON(`${base}.json`, JSON.stringify(payload, null, 2))
      .then(() => { status.textContent = `Lastet ned: ${base}.json`; })
      .catch(e => { status.textContent = e && e.code === "declined" ? "Nedlasting avbrutt." : "Kunne ikke laste ned filen."; });
  }

  ids.forEach(id => els[id].addEventListener("input", updatePreview));
  document.getElementById("annet_downloadBtn").addEventListener("click", downloadJSON);
  document.getElementById("annet_resetBtn").addEventListener("click", () => {
    els.title.value = "";
    els.eventId.value = "";
    els.type.value = "Highlights";
    els.team.value = "";
    els.person.value = "";
    els.keyword.value = "";
    els.filename.value = "";
    sendToVgLive = true;
    updateVgLiveButtons();
    updatePreview();
  });

  toVgYes.addEventListener("click", () => {
    sendToVgLive = true;
    updateVgLiveButtons();
    updatePreview();
  });

  toVgNo.addEventListener("click", () => {
    sendToVgLive = false;
    updateVgLiveButtons();
    updatePreview();
  });

  els.type.value = "Highlights";
  els.filename.value = "";
  updateVgLiveButtons();
  updatePreview();

  if (teamList.length > 0) {
    setupTeamAutocomplete(els.team, { onSelect: updatePreview });
  }
}

function runApp() {
  setupTabs();
  setupFotball();
  setupFotball("pl", teamList.filter(t => t.league === "Premier League"), "Premier League");
  setupAnnet();
}

fetch("teams.json")
  .then(r => r.json())
  .then(data => {
    teamList = flattenTeams(data);
    runApp();
  })
  .catch(e => {
    console.warn("Could not load teams.json", e);
    runApp();
  });

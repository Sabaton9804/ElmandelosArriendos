const properties = Array.isArray(window.ELMAN_PROPERTIES) ? window.ELMAN_PROPERTIES : [];

const FEATURE_LABELS = {
  parqueadero: "Parqueadero",
  amoblado: "Amoblado",
  balcon: "Balcón",
  terraza: "Terraza",
  ascensor: "Ascensor",
  deposito: "Depósito",
  piscina: "Piscina",
  gimnasio: "Gimnasio",
  vigilancia: "Vigilancia",
  domotica: "Domótica",
  mascotas: "Mascotas",
  aire: "Aire acond.",
  chimenea: "Chimenea",
  jardin: "Jardín",
  bbq: "BBQ",
  conjunto: "Conjunto",
};

const PAGE_SIZE = 9;

const state = {
  city: "todos",
  op: "todos",
  tipo: "todos",
  habs: "todos",
  banos: "todos",
  min: "",
  max: "",
  q: "",
  features: new Set(),
  activeId: null,
  page: 1,
};

const grid = document.getElementById("grid");
const pager = document.getElementById("pager");
const countEl = document.getElementById("count");
const pitch = document.getElementById("pitch");
const panel = document.getElementById("map-panel");
const detail = document.getElementById("detail");
const detailContent = document.getElementById("detail-content");

const markersById = new Map();
let map;
let markerLayer;
let galleryIndex = 0;

function opLabel(op) {
  if (op === "venta") return "Venta";
  if (op === "renta") return "Renta corta";
  return "Arriendo";
}

function cityLabel(city) {
  if (city === "medellin") return "Medellín";
  if (city === "cartagena") return "Cartagena";
  return "Bogotá";
}

function intentLabel(op) {
  if (op === "venta") return "Quiero comprar / agendar visita";
  if (op === "renta") return "Quiero reservar noches";
  return "Quiero arrendar este inmueble";
}

function waLink(p, intent) {
  const text = intent
    ? `${intent}: ${p.title} — ${p.price}`
    : `Hola, me interesa: ${p.title} (${opLabel(p.op)}) — ${p.price}`;
  return `https://wa.me/573017972737?text=${encodeURIComponent(text)}`;
}

function activeFeatures(p) {
  return Object.entries(p.features || {})
    .filter(([, v]) => v)
    .map(([k]) => k);
}

function filtered() {
  const q = state.q.trim().toLowerCase();
  const min = state.min === "" ? null : Number(state.min);
  const max = state.max === "" ? null : Number(state.max);

  return properties.filter((p) => {
    if (state.city !== "todos") {
      if (state.city === "bogota" && !(p.city === "bogota" || p.city === "cartagena")) return false;
      if (state.city === "medellin" && p.city !== "medellin") return false;
    }
    if (state.op !== "todos" && p.op !== state.op) return false;
    if (state.tipo !== "todos" && p.tipo !== state.tipo) return false;
    if (state.habs !== "todos" && (p.habs || 0) < Number(state.habs)) return false;
    if (state.banos !== "todos" && (p.banos || 0) < Number(state.banos)) return false;
    if (min != null && !Number.isNaN(min) && p.priceNum < min) return false;
    if (max != null && !Number.isNaN(max) && p.priceNum > max) return false;
    if (q && !(`${p.title} ${p.place} ${(p.tags || []).join(" ")}`.toLowerCase().includes(q))) return false;
    for (const feat of state.features) {
      if (!p.features?.[feat]) return false;
    }
    return true;
  });
}

function pinIcon(p, active) {
  const cls = [
    "pin-icon",
    p.op === "venta" ? "is-venta" : "",
    p.op === "renta" ? "is-renta" : "",
    active ? "is-active" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return L.divIcon({
    className: "",
    html: `<div class="${cls}">●</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  });
}

function showPanel(p) {
  panel.hidden = false;
  panel.innerHTML = `
    ${p.img ? `<img src="${p.img}" alt="" />` : ""}
    <p class="price">${p.price}${p.op === "arriendo" ? ' <span style="font-size:0.7rem;color:#a8a29a;font-family:Manrope,sans-serif">/ mes</span>' : ""}</p>
    <h3>${p.title}</h3>
    <p class="meta">${opLabel(p.op)} · ${cityLabel(p.city)} · ${p.place}</p>
    <div class="map-panel-actions">
      <button type="button" class="btn btn-primary btn-sm" data-open="${p.id}">Ver ficha</button>
      <a class="btn btn-wa btn-sm" href="${waLink(p)}" target="_blank" rel="noopener">WhatsApp</a>
    </div>
  `;
  panel.querySelector("[data-open]")?.addEventListener("click", () => openDetail(p.id));
}

function setActive(id, { fly = true } = {}) {
  state.activeId = id;
  const p = properties.find((x) => x.id === id);
  if (!p) return;

  markersById.forEach((marker, mid) => {
    const item = properties.find((x) => x.id === mid);
    if (item) marker.setIcon(pinIcon(item, mid === id));
  });

  document.querySelectorAll(".card").forEach((card) => {
    card.classList.toggle("is-active", Number(card.dataset.id) === id);
  });

  showPanel(p);
  if (fly && map) {
    map.flyTo([p.lat, p.lng], Math.max(map.getZoom(), 13), { duration: 0.6 });
    const m = markersById.get(id);
    if (m) m.openPopup();
  }
}

function featurePills(p, limit = 4) {
  return activeFeatures(p)
    .slice(0, limit)
    .map((k) => `<span class="mini-chip">${FEATURE_LABELS[k] || k}</span>`)
    .join("");
}

function pageSlice(list) {
  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  if (state.page > totalPages) state.page = totalPages;
  if (state.page < 1) state.page = 1;
  const start = (state.page - 1) * PAGE_SIZE;
  return {
    pageItems: list.slice(start, start + PAGE_SIZE),
    totalPages,
    total: list.length,
    start: list.length ? start + 1 : 0,
    end: Math.min(start + PAGE_SIZE, list.length),
  };
}

function renderPager(total, totalPages) {
  if (!pager) return;
  if (total <= PAGE_SIZE) {
    pager.hidden = true;
    pager.innerHTML = "";
    return;
  }
  pager.hidden = false;

  const buttons = [];
  const windowSize = 5;
  let from = Math.max(1, state.page - Math.floor(windowSize / 2));
  let to = Math.min(totalPages, from + windowSize - 1);
  from = Math.max(1, to - windowSize + 1);

  buttons.push(
    `<button type="button" class="page-btn" data-page="${state.page - 1}" ${state.page <= 1 ? "disabled" : ""}>Anterior</button>`
  );
  if (from > 1) {
    buttons.push(`<button type="button" class="page-btn" data-page="1">1</button>`);
    if (from > 2) buttons.push(`<span class="page-ellipsis">…</span>`);
  }
  for (let i = from; i <= to; i++) {
    buttons.push(
      `<button type="button" class="page-btn${i === state.page ? " is-active" : ""}" data-page="${i}">${i}</button>`
    );
  }
  if (to < totalPages) {
    if (to < totalPages - 1) buttons.push(`<span class="page-ellipsis">…</span>`);
    buttons.push(
      `<button type="button" class="page-btn" data-page="${totalPages}">${totalPages}</button>`
    );
  }
  buttons.push(
    `<button type="button" class="page-btn" data-page="${state.page + 1}" ${state.page >= totalPages ? "disabled" : ""}>Siguiente</button>`
  );

  pager.innerHTML = `
    <p class="pager-meta">Mostrando <strong>${(state.page - 1) * PAGE_SIZE + 1}–${Math.min(state.page * PAGE_SIZE, total)}</strong> de <strong>${total}</strong></p>
    <div class="pager-btns">${buttons.join("")}</div>
  `;

  pager.querySelectorAll(".page-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const next = Number(btn.dataset.page);
      if (!next || next < 1 || next > totalPages || next === state.page) return;
      state.page = next;
      render({ scrollList: true });
    });
  });
}

function renderCards(list) {
  const { pageItems, totalPages, total } = pageSlice(list);
  countEl.textContent = String(total);
  renderPager(total, totalPages);

  if (!total) {
    grid.innerHTML = `<div class="empty">No hay inmuebles con esos filtros. Quita alguno y vuelve a intentar.</div>`;
    return;
  }

  grid.innerHTML = pageItems
    .map((p) => {
      const sold = p.available === false;
      const specs = [
        p.m2 ? `${p.m2} m²` : null,
        p.habs ? `${p.habs} hab` : null,
        p.banos ? `${p.banos} baños` : null,
      ]
        .filter(Boolean)
        .join(" · ");
      return `
      <article class="card${state.activeId === p.id ? " is-active" : ""}" data-id="${p.id}">
        <div class="card-media" style="background-image:url('${p.img || ""}')">
          <div class="card-badges">
            <span class="badge badge-op">${opLabel(p.op)}</span>
            <span class="badge">${cityLabel(p.city)}</span>
            ${sold ? '<span class="badge badge-sold">No disponible</span>' : ""}
          </div>
        </div>
        <div class="card-body">
          <p class="card-price">${p.price}${p.op === "arriendo" ? ' <span style="font-size:0.72rem;color:#a8a29a;font-family:Manrope,sans-serif;font-weight:700">/ mes</span>' : ""}</p>
          <h3 class="card-title">${p.title}</h3>
          <p class="card-meta">${p.place}${specs ? ` · ${specs}` : ""}</p>
          <div class="mini-chips">${featurePills(p)}</div>
          <div class="card-actions">
            <button type="button" class="btn btn-primary btn-sm btn-open" data-id="${p.id}">Ver ficha</button>
            <a class="btn btn-wa btn-sm" href="${waLink(p)}" target="_blank" rel="noopener">WhatsApp</a>
          </div>
        </div>
      </article>`;
    })
    .join("");

  grid.querySelectorAll(".card").forEach((card) => {
    card.addEventListener("click", (e) => {
      if (e.target.closest("a")) return;
      const id = Number(card.dataset.id);
      if (e.target.closest(".btn-open")) {
        openDetail(id);
        return;
      }
      openDetail(id);
    });
  });
}

function renderMarkers(list) {
  if (typeof L === "undefined" || !markerLayer.clearLayers) return;
  markersById.clear();
  markerLayer.clearLayers();

  list.forEach((p) => {
    const marker = L.marker([p.lat, p.lng], { icon: pinIcon(p, p.id === state.activeId) });
    marker.bindPopup(`<strong>${opLabel(p.op)}</strong><br/>${p.price}`);
    marker.on("click", () => {
      setActive(p.id, { fly: false });
    });
    marker.addTo(markerLayer);
    markersById.set(p.id, marker);
  });
}

function fitMap(list) {
  if (!map || typeof L === "undefined" || !list.length) return;
  const bounds = L.latLngBounds(list.map((p) => [p.lat, p.lng]));
  map.fitBounds(bounds.pad(0.18), { maxZoom: 12 });
}

function render({ scrollList = false } = {}) {
  const list = filtered();
  renderCards(list);
  renderMarkers(list);
  if (!state.activeId || !list.some((p) => p.id === state.activeId)) {
    panel.hidden = true;
  }
  if (scrollList) {
    document.getElementById("listado")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function resetPageAndRender() {
  state.page = 1;
  render();
  fitMap(filtered());
}

function setCity(city) {
  state.city = city;
  document.querySelectorAll(".nav-link[data-city]").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.city === city);
  });
  resetPageAndRender();
}

function openDetail(id) {
  const p = properties.find((x) => x.id === id);
  if (!p) return;
  state.activeId = id;
  galleryIndex = 0;
  const imgs = p.images?.length ? p.images : p.img ? [p.img] : [];
  const feats = activeFeatures(p)
    .map((k) => `<li>${FEATURE_LABELS[k] || k}</li>`)
    .join("");
  const specs = `
    <div class="detail-specs">
      ${p.m2 ? `<div><strong>${p.m2}</strong><span>m²</span></div>` : ""}
      ${p.habs ? `<div><strong>${p.habs}</strong><span>Hab</span></div>` : ""}
      ${p.banos ? `<div><strong>${p.banos}</strong><span>Baños</span></div>` : ""}
      ${p.estrato ? `<div><strong>${p.estrato}</strong><span>Estrato</span></div>` : ""}
      <div><strong>${opLabel(p.op)}</strong><span>Operación</span></div>
    </div>`;

  detailContent.innerHTML = `
    <div class="detail-grid">
      <div class="detail-gallery">
        <div class="detail-main-photo" id="gallery-main" style="background-image:url('${imgs[0] || ""}')"></div>
        <div class="detail-thumbs" id="gallery-thumbs">
          ${imgs
            .map(
              (src, i) =>
                `<button type="button" class="thumb${i === 0 ? " is-active" : ""}" data-i="${i}" style="background-image:url('${src}')"></button>`
            )
            .join("")}
        </div>
      </div>
      <div class="detail-info">
        <p class="detail-kicker">${cityLabel(p.city)} · ${p.place}</p>
        <h2>${p.title}</h2>
        <p class="detail-price">${p.price}${p.op === "arriendo" ? " <small>/ mes</small>" : ""}</p>
        ${specs}
        <p class="detail-desc">${p.description || "Inmueble publicado por El Man de los Arriendos. Escríbenos por WhatsApp para agendar visita, estudios o más info."}</p>
        ${feats ? `<h3 class="detail-h3">Características</h3><ul class="detail-feat">${feats}</ul>` : ""}
        <div class="detail-actions">
          <a class="btn btn-primary" href="${waLink(p, intentLabel(p.op))}" target="_blank" rel="noopener">${intentLabel(p.op)}</a>
          <a class="btn btn-wa" href="${waLink(p, "Hola, quiero más información de")}" target="_blank" rel="noopener">WhatsApp inmediato</a>
          <button type="button" class="btn btn-ghost" id="btn-fav">Guardar en favoritos</button>
          <a class="btn btn-ghost" href="${p.url}" target="_blank" rel="noopener">Ver en web actual</a>
        </div>
        <p class="detail-note">Flujo demo: en la versión real aquí va formulario de solicitud + CRM de leads.</p>
      </div>
    </div>
  `;

  detail.hidden = false;
  document.body.classList.add("detail-open");
  history.replaceState(null, "", `#inmueble-${p.id}`);

  detailContent.querySelectorAll(".thumb").forEach((btn) => {
    btn.addEventListener("click", () => {
      galleryIndex = Number(btn.dataset.i);
      const main = document.getElementById("gallery-main");
      main.style.backgroundImage = `url('${imgs[galleryIndex]}')`;
      detailContent.querySelectorAll(".thumb").forEach((t) => t.classList.remove("is-active"));
      btn.classList.add("is-active");
    });
  });

  document.getElementById("btn-fav")?.addEventListener("click", (e) => {
    e.target.textContent = "✓ Guardado (demo)";
    e.target.disabled = true;
  });
}

function closeDetail() {
  detail.hidden = true;
  document.body.classList.remove("detail-open");
  if (location.hash.startsWith("#inmueble-")) {
    history.replaceState(null, "", location.pathname + location.search);
  }
}

function initMap() {
  if (typeof L === "undefined") {
    console.error("Leaflet no cargó");
    document.getElementById("map").innerHTML =
      '<div class="empty" style="height:100%;display:grid;place-items:center">No se pudo cargar el mapa. Revisa tu conexión.</div>';
    markerLayer = { clearLayers() {}, addLayer() {} };
    return;
  }

  map = L.map("map", {
    scrollWheelZoom: false,
    zoomControl: true,
  }).setView([4.65, -74.08], 11);

  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    attribution: "&copy; OpenStreetMap &copy; CARTO",
    subdomains: "abcd",
    maxZoom: 19,
  }).addTo(map);

  markerLayer = L.layerGroup().addTo(map);
  map.on("click", () => map.scrollWheelZoom.enable());
  map.on("mouseout", () => map.scrollWheelZoom.disable());
}

document.querySelectorAll(".nav-link[data-city]").forEach((btn) => {
  btn.addEventListener("click", () => setCity(btn.dataset.city));
});
document.querySelectorAll(".city-card").forEach((btn) => {
  btn.addEventListener("click", () => {
    setCity(btn.dataset.city);
    document.getElementById("listado").scrollIntoView({ behavior: "smooth" });
  });
});

function bindSelect(id, key) {
  document.getElementById(id).addEventListener("change", (e) => {
    state[key] = e.target.value;
    resetPageAndRender();
  });
}
bindSelect("f-op", "op");
bindSelect("f-tipo", "tipo");
bindSelect("f-habs", "habs");
bindSelect("f-banos", "banos");

document.getElementById("f-min").addEventListener("input", (e) => {
  state.min = e.target.value;
  state.page = 1;
  render();
});
document.getElementById("f-max").addEventListener("input", (e) => {
  state.max = e.target.value;
  state.page = 1;
  render();
});
document.getElementById("f-q").addEventListener("input", (e) => {
  state.q = e.target.value;
  state.page = 1;
  render();
});

document.querySelectorAll("#feature-filters .chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    const feat = chip.dataset.feat;
    if (state.features.has(feat)) {
      state.features.delete(feat);
      chip.classList.remove("is-on");
    } else {
      state.features.add(feat);
      chip.classList.add("is-on");
    }
    resetPageAndRender();
  });
});

document.getElementById("btn-clear-filters").addEventListener("click", () => {
  state.op = "todos";
  state.tipo = "todos";
  state.habs = "todos";
  state.banos = "todos";
  state.min = "";
  state.max = "";
  state.q = "";
  state.features.clear();
  ["f-op", "f-tipo", "f-habs", "f-banos"].forEach((id) => {
    document.getElementById(id).value = "todos";
  });
  document.getElementById("f-min").value = "";
  document.getElementById("f-max").value = "";
  document.getElementById("f-q").value = "";
  document.querySelectorAll("#feature-filters .chip").forEach((c) => c.classList.remove("is-on"));
  resetPageAndRender();
});

document.getElementById("btn-fit").addEventListener("click", () => fitMap(filtered()));
document.getElementById("btn-map-nav").addEventListener("click", () => {
  document.getElementById("mapa").scrollIntoView({ behavior: "smooth" });
});
document.getElementById("btn-pitch").addEventListener("click", () => pitch.showModal());
document.getElementById("detail-close").addEventListener("click", closeDetail);

/* -------- Auth demo (UI only) -------- */
const authDialog = document.getElementById("auth-dialog");
const formLogin = document.getElementById("form-login");
const formSignup = document.getElementById("form-signup");
const authActions = document.getElementById("auth-actions");
const userChip = document.getElementById("user-chip");

function initials(name) {
  return (
    String(name || "EM")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() || "")
      .join("") || "EM"
  );
}

function setAuthTab(tab) {
  document.querySelectorAll(".auth-tab").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.tab === tab);
  });
  formLogin.hidden = tab !== "login";
  formSignup.hidden = tab !== "signup";
}

function openAuth(tab = "login") {
  setAuthTab(tab);
  authDialog.showModal();
}

function closeAuth() {
  authDialog.close();
}

function setLoggedIn(user) {
  localStorage.setItem("elman_demo_user", JSON.stringify(user));
  authActions.hidden = true;
  userChip.hidden = false;
  document.getElementById("user-name").textContent = user.name || user.email;
  document.getElementById("user-avatar").textContent = initials(user.name || user.email);
  closeAuth();
}

function setLoggedOut() {
  localStorage.removeItem("elman_demo_user");
  authActions.hidden = false;
  userChip.hidden = true;
}

function restoreSession() {
  try {
    const raw = localStorage.getItem("elman_demo_user");
    if (!raw) return;
    setLoggedIn(JSON.parse(raw));
  } catch {
    setLoggedOut();
  }
}

document.getElementById("btn-login").addEventListener("click", () => openAuth("login"));
document.getElementById("btn-signup").addEventListener("click", () => openAuth("signup"));
document.getElementById("auth-close").addEventListener("click", closeAuth);
document.getElementById("btn-logout").addEventListener("click", setLoggedOut);

document.querySelectorAll(".auth-tab").forEach((btn) => {
  btn.addEventListener("click", () => setAuthTab(btn.dataset.tab));
});

formLogin.addEventListener("submit", (e) => {
  e.preventDefault();
  const data = new FormData(formLogin);
  setLoggedIn({
    name: String(data.get("email") || "").split("@")[0],
    email: String(data.get("email") || ""),
  });
});

formSignup.addEventListener("submit", (e) => {
  e.preventDefault();
  const data = new FormData(formSignup);
  setLoggedIn({
    name: String(data.get("name") || "Usuario"),
    email: String(data.get("email") || ""),
    phone: String(data.get("phone") || ""),
  });
});

document.querySelectorAll(".btn-social").forEach((btn) => {
  btn.addEventListener("click", () => {
    setLoggedIn({
      name: `Usuario ${btn.dataset.provider}`,
      email: `${btn.dataset.provider.toLowerCase()}@demo.elman`,
    });
  });
});

authDialog.addEventListener("click", (e) => {
  if (e.target === authDialog) closeAuth();
});

window.addEventListener("hashchange", () => {
  const m = location.hash.match(/^#inmueble-(\d+)$/);
  if (m) openDetail(Number(m[1]));
  else closeDetail();
});

restoreSession();
initMap();
render();
fitMap(filtered());

const boot = location.hash.match(/^#inmueble-(\d+)$/);
if (boot) openDetail(Number(boot[1]));

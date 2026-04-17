const socket = io();
let map;
let appState;
let selectedSectorId = null;
let pointMode = false;
let pendingPointLatLng = null;
const sectorLayers = new Map();
const pointLayers = new Map();

const els = {
  userName: document.getElementById('userName'),
  sectorEmpty: document.getElementById('sectorEmpty'),
  sectorForm: document.getElementById('sectorForm'),
  sectorName: document.getElementById('sectorName'),
  sectorUpdated: document.getElementById('sectorUpdated'),
  sectorStatus: document.getElementById('sectorStatus'),
  sectorAssignedTo: document.getElementById('sectorAssignedTo'),
  sectorNote: document.getElementById('sectorNote'),
  activityList: document.getElementById('activityList'),
  onlineStatus: document.getElementById('onlineStatus'),
  resetViewBtn: document.getElementById('resetViewBtn'),
  togglePointMode: document.getElementById('togglePointMode'),
  pointModal: document.getElementById('pointModal'),
  pointTitle: document.getElementById('pointTitle'),
  pointNote: document.getElementById('pointNote'),
  cancelPointBtn: document.getElementById('cancelPointBtn'),
  savePointBtn: document.getElementById('savePointBtn'),
  exportBtn: document.getElementById('exportBtn'),
  importInput: document.getElementById('importInput')
};

const statusStyle = {
  'unassigned': { color: '#64748b', fillColor: '#94a3b8' },
  'in-progress': { color: '#b45309', fillColor: '#f59e0b' },
  'covered': { color: '#15803d', fillColor: '#22c55e' },
  'recheck': { color: '#b91c1c', fillColor: '#ef4444' }
};

function getUserName() {
  return els.userName.value.trim() || 'Volunteer';
}

els.userName.value = localStorage.getItem('searchUserName') || '';
els.userName.addEventListener('change', () => {
  localStorage.setItem('searchUserName', els.userName.value.trim());
});

function initMap(meta) {
  map = L.map('map').setView(meta.center, meta.zoom || 10);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  map.on('click', (e) => {
    if (!pointMode) return;
    pendingPointLatLng = e.latlng;
    els.pointTitle.value = '';
    els.pointNote.value = '';
    els.pointModal.classList.remove('hidden');
  });
}

function renderState() {
  if (!map) initMap(appState.meta);

  appState.sectors.forEach((sector) => {
    const style = getSectorStyle(sector.status);
    if (sectorLayers.has(sector.id)) {
      const layer = sectorLayers.get(sector.id);
      layer.setStyle(style);
      layer.setPopupContent(buildSectorPopup(sector));
      return;
    }

    const rect = L.rectangle(sector.bounds, {
      ...style,
      weight: 2,
      fillOpacity: 0.28
    }).addTo(map);

    rect.on('click', () => selectSector(sector.id));
    rect.bindPopup(buildSectorPopup(sector));
    sectorLayers.set(sector.id, rect);
  });

  pointLayers.forEach((layer, id) => {
    if (!appState.points.find((p) => p.id === id)) {
      map.removeLayer(layer);
      pointLayers.delete(id);
    }
  });

  appState.points.forEach((point) => {
    if (pointLayers.has(point.id)) return;
    const marker = L.marker([point.lat, point.lng]).addTo(map);
    marker.bindPopup(buildPointPopup(point));
    pointLayers.set(point.id, marker);
  });

  renderActivity();
}

function buildSectorPopup(sector) {
  return `
    <strong>${sector.id}: ${sector.name}</strong><br>
    Status: ${prettyStatus(sector.status)}<br>
    Assigned: ${sector.assignedTo || '—'}<br>
    Note: ${sector.note || '—'}<br>
    <button onclick="window.selectSectorById('${sector.id}')" style="margin-top:8px;">Open details</button>
  `;
}

function buildPointPopup(point) {
  const safeTitle = escapeHtml(point.title || 'Search point');
  const safeNote = escapeHtml(point.note || '');
  const safeBy = escapeHtml(point.addedBy || 'Unknown');
  return `
    <strong>${safeTitle}</strong><br>
    ${safeNote || 'No note'}<br>
    <small>Added by ${safeBy}</small><br>
    <button class="point-delete-btn" onclick="window.deletePoint('${point.id}')">Delete point</button>
  `;
}

function selectSector(id) {
  const sector = appState.sectors.find((s) => s.id === id);
  if (!sector) return;
  selectedSectorId = id;
  els.sectorEmpty.classList.add('hidden');
  els.sectorForm.classList.remove('hidden');
  els.sectorName.textContent = `${sector.id}: ${sector.name}`;
  els.sectorUpdated.textContent = sector.updatedAt ? `Updated ${formatTime(sector.updatedAt)} by ${sector.updatedBy || 'Unknown'}` : 'Not updated yet';
  els.sectorStatus.value = sector.status;
  els.sectorAssignedTo.value = sector.assignedTo || getUserName();
  els.sectorNote.value = sector.note || '';

  const layer = sectorLayers.get(id);
  if (layer) map.fitBounds(layer.getBounds(), { padding: [30, 30] });
}

window.selectSectorById = selectSector;

function renderActivity() {
  els.activityList.innerHTML = '';
  appState.activity.slice(0, 40).forEach((item) => {
    const div = document.createElement('div');
    div.className = 'activity-item';
    div.innerHTML = `${escapeHtml(item.text)}<span class="activity-time">${formatTime(item.timestamp)}</span>`;
    els.activityList.appendChild(div);
  });
  if (!appState.activity.length) {
    els.activityList.innerHTML = '<div class="activity-item">No activity yet.</div>';
  }
}

function getSectorStyle(status) {
  return statusStyle[status] || statusStyle['unassigned'];
}

function prettyStatus(status) {
  return status.replace('-', ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}

function formatTime(value) {
  return new Date(value).toLocaleString();
}

function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

els.sectorForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!selectedSectorId) return;
  socket.emit('sector:update', {
    id: selectedSectorId,
    status: els.sectorStatus.value,
    assignedTo: els.sectorAssignedTo.value.trim(),
    note: els.sectorNote.value.trim(),
    updatedBy: getUserName()
  });
});

els.resetViewBtn.addEventListener('click', () => {
  if (!appState?.meta || !map) return;
  map.setView(appState.meta.center, appState.meta.zoom || 10);
});

els.togglePointMode.addEventListener('click', () => {
  pointMode = !pointMode;
  els.togglePointMode.textContent = `Add point: ${pointMode ? 'On' : 'Off'}`;
});

els.cancelPointBtn.addEventListener('click', () => {
  els.pointModal.classList.add('hidden');
  pendingPointLatLng = null;
});

els.savePointBtn.addEventListener('click', () => {
  if (!pendingPointLatLng) return;
  socket.emit('point:add', {
    lat: pendingPointLatLng.lat,
    lng: pendingPointLatLng.lng,
    title: els.pointTitle.value.trim() || 'Search point',
    note: els.pointNote.value.trim(),
    addedBy: getUserName()
  });
  els.pointModal.classList.add('hidden');
  pendingPointLatLng = null;
});

window.deletePoint = (id) => {
  if (!confirm('Delete this point?')) return;
  socket.emit('point:delete', { id, deletedBy: getUserName() });
};

els.exportBtn.addEventListener('click', async () => {
  const response = await fetch('/api/export', { method: 'POST' });
  const data = await response.json();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `search-backup-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

els.importInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const text = await file.text();
  const json = JSON.parse(text);
  const response = await fetch('/api/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(json)
  });
  if (!response.ok) alert('Import failed.');
  e.target.value = '';
});

socket.on('connect', () => {
  els.onlineStatus.textContent = 'Live';
});

socket.on('disconnect', () => {
  els.onlineStatus.textContent = 'Offline';
});

socket.on('state:init', (state) => {
  appState = state;
  renderState();
  if (selectedSectorId) selectSector(selectedSectorId);
});

socket.on('sector:updated', ({ sector, activity }) => {
  const idx = appState.sectors.findIndex((s) => s.id === sector.id);
  if (idx >= 0) appState.sectors[idx] = sector;
  appState.activity.unshift(activity);
  appState.activity = appState.activity.slice(0, 200);
  const layer = sectorLayers.get(sector.id);
  if (layer) {
    layer.setStyle({ ...getSectorStyle(sector.status), weight: 2, fillOpacity: 0.28 });
    layer.setPopupContent(buildSectorPopup(sector));
  }
  renderActivity();
  if (selectedSectorId === sector.id) selectSector(sector.id);
});

socket.on('point:added', ({ point, activity }) => {
  appState.points.push(point);
  appState.activity.unshift(activity);
  renderState();
});

socket.on('point:deleted', ({ id, activity }) => {
  appState.points = appState.points.filter((p) => p.id !== id);
  appState.activity.unshift(activity);
  renderState();
});

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'state.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DEFAULT_STATE = {
  meta: {
    title: 'Clark Hill / Thurmond Lake Search Coordination',
    subtitle: 'Volunteer coverage map for CSRA search efforts',
    center: [33.8005, -82.2968],
    zoom: 10,
    lastUpdated: null
  },
  sectors: [
    { id: 'S-01', name: 'West Lake Access', bounds: [[33.93, -82.56], [33.86, -82.44]], status: 'unassigned', assignedTo: '', note: '', updatedAt: null, updatedBy: '' },
    { id: 'S-02', name: 'Mistletoe / Central West', bounds: [[33.86, -82.56], [33.79, -82.44]], status: 'unassigned', assignedTo: '', note: '', updatedAt: null, updatedBy: '' },
    { id: 'S-03', name: 'Southwest Shoreline', bounds: [[33.79, -82.56], [33.72, -82.44]], status: 'unassigned', assignedTo: '', note: '', updatedAt: null, updatedBy: '' },

    { id: 'S-04', name: 'North Central Lake', bounds: [[33.93, -82.44], [33.86, -82.32]], status: 'unassigned', assignedTo: '', note: '', updatedAt: null, updatedBy: '' },
    { id: 'S-05', name: 'Dam / Mid-Lake Core', bounds: [[33.86, -82.44], [33.79, -82.32]], status: 'unassigned', assignedTo: '', note: '', updatedAt: null, updatedBy: '' },
    { id: 'S-06', name: 'South Central Shore', bounds: [[33.79, -82.44], [33.72, -82.32]], status: 'unassigned', assignedTo: '', note: '', updatedAt: null, updatedBy: '' },

    { id: 'S-07', name: 'North East Access / SC', bounds: [[33.93, -82.32], [33.86, -82.20]], status: 'unassigned', assignedTo: '', note: '', updatedAt: null, updatedBy: '' },
    { id: 'S-08', name: 'Parksville / East Mid', bounds: [[33.86, -82.32], [33.79, -82.20]], status: 'unassigned', assignedTo: '', note: '', updatedAt: null, updatedBy: '' },
    { id: 'S-09', name: 'Southeast Boat Access', bounds: [[33.79, -82.32], [33.72, -82.20]], status: 'unassigned', assignedTo: '', note: '', updatedAt: null, updatedBy: '' }
  ],
  points: [
    { id: 'P-1', lat: 33.8205, lng: -82.2810, title: 'Possible boat ramp / access point', note: 'Use this layer for parking spots, ramps, trailheads, or tips.', addedBy: 'System', createdAt: new Date().toISOString() }
  ],
  activity: []
};

function loadState() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(DEFAULT_STATE, null, 2));
    return structuredClone(DEFAULT_STATE);
  }
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (err) {
    console.error('Failed to load state, resetting.', err);
    fs.writeFileSync(DATA_FILE, JSON.stringify(DEFAULT_STATE, null, 2));
    return structuredClone(DEFAULT_STATE);
  }
}

function saveState() {
  state.meta.lastUpdated = new Date().toISOString();
  fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2));
}

let state = loadState();

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/state', (req, res) => {
  res.json(state);
});

app.post('/api/export', (req, res) => {
  res.setHeader('Content-Disposition', `attachment; filename="search-state-${Date.now()}.json"`);
  res.json(state);
});

app.post('/api/import', (req, res) => {
  const incoming = req.body;
  if (!incoming || !Array.isArray(incoming.sectors) || !Array.isArray(incoming.activity)) {
    return res.status(400).json({ error: 'Invalid import file.' });
  }
  state = incoming;
  saveState();
  io.emit('state:init', state);
  res.json({ ok: true });
});

io.on('connection', (socket) => {
  socket.emit('state:init', state);

  socket.on('sector:update', (payload) => {
    const sector = state.sectors.find((s) => s.id === payload.id);
    if (!sector) return;

    sector.status = payload.status ?? sector.status;
    sector.assignedTo = payload.assignedTo ?? sector.assignedTo;
    sector.note = payload.note ?? sector.note;
    sector.updatedBy = payload.updatedBy || 'Unknown';
    sector.updatedAt = new Date().toISOString();

    const entry = {
      id: `A-${Date.now()}`,
      type: 'sector',
      text: `${sector.updatedBy} updated ${sector.id} (${sector.name}) to ${sector.status.replace('-', ' ')}`,
      timestamp: sector.updatedAt
    };
    state.activity.unshift(entry);
    state.activity = state.activity.slice(0, 200);

    saveState();
    io.emit('sector:updated', { sector, activity: entry });
  });

  socket.on('point:add', (payload) => {
    const point = {
      id: `P-${Date.now()}`,
      lat: payload.lat,
      lng: payload.lng,
      title: payload.title || 'Search point',
      note: payload.note || '',
      addedBy: payload.addedBy || 'Unknown',
      createdAt: new Date().toISOString()
    };
    state.points.push(point);
    const entry = {
      id: `A-${Date.now() + 1}`,
      type: 'point',
      text: `${point.addedBy} added point: ${point.title}`,
      timestamp: point.createdAt
    };
    state.activity.unshift(entry);
    state.activity = state.activity.slice(0, 200);
    saveState();
    io.emit('point:added', { point, activity: entry });
  });

  socket.on('point:delete', (payload) => {
    const idx = state.points.findIndex((p) => p.id === payload.id);
    if (idx === -1) return;
    const removed = state.points.splice(idx, 1)[0];
    const entry = {
      id: `A-${Date.now()}`,
      type: 'point',
      text: `${payload.deletedBy || 'Unknown'} removed point: ${removed.title}`,
      timestamp: new Date().toISOString()
    };
    state.activity.unshift(entry);
    state.activity = state.activity.slice(0, 200);
    saveState();
    io.emit('point:deleted', { id: removed.id, activity: entry });
  });

  socket.on('disconnect', () => {});
});

server.listen(PORT, () => {
  console.log(`Search app running on http://localhost:${PORT}`);
});

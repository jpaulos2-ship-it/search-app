# Clark Hill / Thurmond Lake Search Coordination Web App

A simple shared web app for volunteer search coordination. It is designed for urgent community-led search efforts where many people need to see the same coverage map and avoid duplicate searching.

## What it does

- Shared live map for phones and laptops
- Preloaded search sectors for the Clarks Hill / J. Strom Thurmond Lake area
- Sector status tracking: Unassigned / In Progress / Covered / Recheck
- Assignment field for volunteers or teams
- Notes on each sector
- Extra map points for ramps, trailheads, tips, pull-offs, or parking spots
- Activity feed showing updates in real time
- Export / import JSON backup
- Persistent saved state on the server

## Fastest deployment options

### Option A: Run locally on a Mac

1. Install Node.js
2. Open Terminal in this folder
3. Run:

```bash
npm install
npm start
```

4. Open `http://localhost:3000`
5. To let others connect on the same Wi-Fi or hotspot, find your Mac IP:

```bash
ipconfig getifaddr en0
```

Then teammates open:

```text
http://YOUR-IP:3000
```

### Option B: Deploy online with Render

1. Create a free GitHub repo and upload this folder
2. Create a new Web Service in Render
3. Connect the GitHub repo
4. Use these settings:
   - Build Command: `npm install`
   - Start Command: `npm start`
5. Deploy
6. Share the Render URL with volunteers

This is the best option if volunteers are spread out and not all on the same network.

### Option C: Deploy on Railway

Similar to Render:
- push to GitHub
- create a new Railway project from the repo
- it should detect Node automatically
- start command: `npm start`

## Important notes

- This app is a field coordination aid, not a substitute for law enforcement or official SAR command tools.
- Use sectors to prevent duplicate coverage.
- Use points for sightings, ramps, parking locations, trailheads, or local tips.
- Keep one person updating the map in a consistent way if possible.

## Suggested real-world workflow

- Team lead claims sectors and assigns volunteers
- Volunteers mark sectors `In Progress` when entering them
- Volunteers mark sectors `Covered` when complete
- Use `Recheck` if weather, darkness, water access, or visibility made the search incomplete
- Add points for truck sightings, boat launches, shoreline pull-offs, hunting access points, and local tips

## Files

- `server.js` - Express + Socket.IO backend
- `public/` - frontend app
- `data/state.json` - saved live state

## Good next upgrades

- login or admin PIN
- GPS breadcrumb tracks
- photo uploads
- custom sector drawing
- printable search report
- volunteer roster and contact list
- official ramp / access point import

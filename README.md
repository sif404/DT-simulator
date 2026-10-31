# AXN Digital Twin · Hussain Stadium

Digital twin of Hussain Stadium and its surrounding district for AXN (AMRA Exchange Nexus). All data is synthetic.

```
Simulator  ->  MQTT broker  ->  Twin service  ->  Dashboard (3D scene + ops panels)
server/sim.js   Aedes           server/twin.js     public/index.html
```

- **Simulator** publishes raw readings only (`axn/sim/gate/{A-D}`, `axn/sim/env`, `axn/sim/venue`, `axn/sim/child/child1`).
- **Twin service** turns readings into state, Smart Exit, anomalies, alerts, evacuation and what-if, and publishes `axn/twin/state` (retained, every second). When child location consent is off it publishes no coordinates.
- **Dashboard** reads only `axn/twin/state` and sends commands: `axn/cmd/stadium`, `axn/cmd/child`, `axn/cmd/clock`, `axn/cmd/safe`, and `axn/consent/child1`.
- **MQTT access control:** the server's internal client uses a random per-process credential. Public clients can subscribe only to `axn/twin/state` and publish only schema-validated, rate-limited commands/consent updates. Retained public publishes and raw simulator-topic access are denied. The TCP MQTT listener is removed; WebSocket MQTT shares the web port.
- **WebSocket protections:** origin allow-list (GitHub Pages plus same-origin and local development by default), bounded message size, connection cap, and Aedes slow-client protection. Set Render's `ALLOWED_ORIGINS` environment variable to a comma-separated list if you use another frontend domain.
- **Health check:** `/healthz` reports ready only after the internal MQTT client connects.
- **Demo fallback:** if no broker is reachable within a few seconds, the dashboard runs the same simulator and twin inside the page, and the header chip says so.

## Run locally

```
npm install
npm start          # http://localhost:8080 (MQTT over WebSocket on the same port; no public TCP listener)
npm run check
```

Node.js 20 or newer is required.

## Deploy from GitHub

1. Push this repo to GitHub (branch `main`).
2. **Backend:** create a Web Service on Render from the repo. `render.yaml` configures the service and its `/healthz` health check. The free tier sleeps when idle, so open it once before a demo.
3. **Frontend on GitHub Pages:** in the repo go to Settings → Pages → Source: GitHub Actions. Set `window.AXN_BROKER='wss://YOUR-RENDER-HOST'` in `public/config.js` and push. Use the exact Render hostname assigned to your service.
4. The Pages workflow validates server and dashboard JavaScript, refreshes and commits the npm lockfile when dependency versions change, runs the production dependency audit, and deploys the frontend only after verification passes.
5. Alternatively, open the backend dashboard directly on its Render URL; it connects to its own MQTT broker automatically.

You can also try a broker without editing files: `https://sif404.github.io/DT-simulator/?broker=wss://YOUR-RENDER-HOST`.

## Known limits

- There is one shared simulation per server. Anyone who opens the public dashboard can still change the demo scenarios for every viewer; topic ACLs limit broker access but do not provide user accounts or per-user authorization. Do not use this public demo for real child-location or other sensitive data.
- Anomaly detection is a threshold plus a z-score on simulator-injected spikes. It checks the twin's logic and does not discover unknowns.
- Crowd movement in the scene is statistical, following the flows, not tracking individuals.
- The dashboard loads mqtt.js and fonts from CDNs, so it needs internet.

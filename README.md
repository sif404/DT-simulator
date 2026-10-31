# AXN Digital Twin · Hussain Stadium

Digital twin of Hussain Stadium and its surrounding district for AXN (AMRA Exchange Nexus). All data is synthetic.

```
Simulator  ->  MQTT broker  ->  Twin service  ->  Dashboard (3D scene + ops panels)
server/sim.js   Aedes           server/twin.js     public/index.html
```

- **Simulator** publishes raw readings only (`axn/sim/gate/{A-D}`, `axn/sim/env`, `axn/sim/venue`, `axn/sim/child/child1`).
- **Twin service** turns readings into state, Smart Exit, anomalies, alerts, evacuation and what-if, and publishes `axn/twin/state` (retained, every second). When child location consent is off it publishes no coordinates.
- **Dashboard** reads `axn/twin/state` and sends commands: `axn/cmd/stadium`, `axn/cmd/child`, `axn/cmd/clock`, `axn/cmd/safe`, and `axn/consent/child1`.
- **Demo fallback:** if no broker is reachable within a few seconds, the dashboard runs the same simulator and twin inside the page, and the header chip says so.

## Run locally
```
npm install
npm start          # http://localhost:8080 (MQTT over WebSocket on the same port, TCP on 1883)
```

## Deploy from GitHub
1. Push this repo to GitHub (branch `main`).
2. **Backend:** create a free Web Service on Render from the repo. `render.yaml` is already set up. You get a URL like `https://axn-twin.onrender.com`. The free tier sleeps when idle, so open it once before a demo.
3. **Frontend on GitHub Pages:** in the repo go to Settings, Pages, Source: GitHub Actions. Edit `public/config.js` and set `window.AXN_BROKER='wss://axn-twin.onrender.com'`, then push. The workflow in `.github/workflows/pages.yml` publishes `public/`.
4. Put the Pages link in the slides.

You can also try a broker without editing files: `https://<user>.github.io/<repo>/?broker=wss://your-host`.

## Known limits
- There is one shared simulation per server. Anyone who presses a scenario button changes it for every viewer.
- Anomaly detection is a threshold plus a z-score on simulator-injected spikes. It checks the twin's logic and does not discover unknowns.
- Crowd movement in the scene is statistical, following the flows, not tracking individuals.
- The dashboard loads mqtt.js and fonts from CDNs, so it needs internet.

# JARVIS Spatial Interface

**JARVIS holographic spatial interface: webcam hand control + real object identification (COCO-SSD) rendered as controllable 3D proxies.**

A browser-based spatial UI experiment. Point your webcam, and JARVIS identifies real objects in the frame (via COCO-SSD) and projects them as controllable 3D proxies you can manipulate by hand gesture.

## What it does

- **Webcam hand tracking** — MediaPipe hands detect gestures; gestures drive interaction
- **Real object detection** — COCO-SSD identifies objects in the camera feed (person, cup, laptop, etc.)
- **3D proxy rendering** — detected objects appear as controllable 3D proxies in the scene
- **Spatial UI** — holographic-style interface rendered in-browser with Three.js

## Quick start

```bash
cd jarvis-spatial
npm install
npx http-server .
# open http://localhost:8080/index.html
```

Requires a webcam. Works best in Chrome/Edge.

## Files

- `index.html` — basic entry point
- `index-advanced.html`, `index-v2.html`, `index-v3.html`, `index-v4.html` — iterative builds
- `signaling.js` — WebSocket signaling for multi-user scenarios
- `build-helmet.mjs` — 3D model build helper
- `models/` — 3D assets
- `phone.html` — mobile/phone-oriented variant

## Tech

Three.js, MediaPipe Hands, COCO-SSD, WebSocket. Zero backend — runs entirely in the browser.

## Status

Experimental spatial UI proof-of-concept. Built Aug 2026.

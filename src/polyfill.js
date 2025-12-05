// src/polyfill.js   ← CREATE THIS FILE
// This runs BEFORE anything else in the renderer
window.global = window;
window.process = window.process || { env: { DEBUG: undefined } };
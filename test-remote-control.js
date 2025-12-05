// Test Remote Control - Run this in Electron DevTools Console

// Test if nut.js is working
console.log("=== Testing nut.js Remote Control ===");

// Test 1: Mouse Move
console.log("Test 1: Moving mouse to 500, 500");
window.electronAPI.remoteControl.executeMouseMove(500, 500)
    .then(result => console.log("Mouse move result:", result))
    .catch(err => console.error("Mouse move error:", err));

// Test 2: Mouse Click (after 2 seconds)
setTimeout(() => {
    console.log("Test 2: Clicking at current position");
    window.electronAPI.remoteControl.executeMouseClick("left", 500, 500)
        .then(result => console.log("Mouse click result:", result))
        .catch(err => console.error("Mouse click error:", err));
}, 2000);

// Test 3: Keyboard Type (after 4 seconds)
setTimeout(() => {
    console.log("Test 3: Typing 'Hello'");
    window.electronAPI.remoteControl.executeKeyboard("Hello", "type")
        .then(result => console.log("Keyboard result:", result))
        .catch(err => console.error("Keyboard error:", err));
}, 4000);

console.log("Tests scheduled. Watch for results...");

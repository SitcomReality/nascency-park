import { Engine, SEED_TYPES, SEED_COLORS } from './engine.js';
import { Renderer } from './renderer.js';
import { AudioSystem } from './audio.js';

// Configuration
const GRID_W = 64;
const GRID_H = 64;
const FPS_MAX = 60;

// State
let isPlaying = false;
let simSpeed = 10; // Ticks per second roughly
let lastTickTime = 0;
let selectedTool = SEED_TYPES.LIFE;
let brushSize = 1;

// Systems
const engine = new Engine(GRID_W, GRID_H);
const canvas = document.getElementById('world');
const renderer = new Renderer(canvas, engine);
const audio = new AudioSystem();

// UI Elements
const ui = {
    tick: document.getElementById('tick-counter'),
    pop: document.getElementById('population'),
    btnPlay: document.getElementById('btn-play-pause'),
    btnReset: document.getElementById('btn-reset'),
    btnStep: document.getElementById('btn-step'),
    btnTools: document.getElementById('btn-tools'),
    btnRules: document.getElementById('btn-rules'),
    panelTools: document.getElementById('panel-tools'),
    panelRules: document.getElementById('panel-rules'),
    seedPalette: document.getElementById('seed-palette'),
    brushInput: document.getElementById('brush-size'),
    toolIndicator: document.getElementById('active-tool-indicator'),
    toolName: document.getElementById('tool-name'),
    ruleDesc: document.getElementById('current-rule-desc'),
    simSpeed: document.getElementById('sim-speed')
};

// Descriptions for rules
const RULE_DESCRIPTIONS = {
    'classic': "The Game of Life. Cells survive with 2-3 neighbors, born with 3. A balance of order and chaos.",
    'bloom': "A spiral dance. Photons emit light, Roots chase it, and Decay follows. Creates spinning floral patterns.",
    'forest': "Geometric growth. Crystals branch only when they have space, forming rigid, tree-like structures.",
    'predator': "An ecosystem in balance. Predators hunt Prey, Prey eats Grass. Watch populations cycle."
};

// --- Initialization ---

function init() {
    generateSeedButtons();
    setupEventListeners();
    setupTouchHandling();
    
    // Start loop
    requestAnimationFrame(loop);
    
    // Initialize random start
    randomize(0.1);
}

function generateSeedButtons() {
    Object.keys(SEED_TYPES).forEach(key => {
        if (key === 'EMPTY') return; // Eraser is separate logic usually, but we'll add it
        createSeedBtn(key, SEED_TYPES[key]);
    });
    
    // Add Eraser explicitly
    createSeedBtn('ERASE', SEED_TYPES.EMPTY);
}

function createSeedBtn(label, type) {
    const btn = document.createElement('div');
    btn.className = 'seed-btn';
    btn.style.backgroundColor = SEED_COLORS[type];
    if (type === SEED_TYPES.EMPTY) {
        btn.style.backgroundColor = '#333';
        btn.innerHTML = '<span style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#fff;font-size:10px">X</span>';
    }
    
    btn.onclick = () => {
        selectedTool = type;
        updateUI();
        showToolIndicator(label);
    };
    
    if (type === selectedTool) btn.classList.add('selected');
    ui.seedPalette.appendChild(btn);
}

// --- Core Loop ---

function loop(timestamp) {
    requestAnimationFrame(loop);

    // Simulation Update Control
    if (isPlaying) {
        const interval = 1000 / simSpeed;
        if (timestamp - lastTickTime > interval) {
            engine.step();
            lastTickTime = timestamp;
            audio.processTick({ alive: engine.aliveCount });
            updateStats();
        }
    }

    renderer.draw();
}

// --- Interaction Logic ---

function randomize(density) {
    engine.reset();
    for(let i=0; i<engine.size; i++) {
        if(Math.random() < density) {
            // Use current tool logic or default life
            engine.grid[i] = (engine.ruleSet === 'classic') ? SEED_TYPES.LIFE : 
                             (engine.ruleSet === 'predator' ? SEED_TYPES.ROOT : SEED_TYPES.CRYSTAL);
        }
    }
}

function handleInput(screenX, screenY) {
    const coords = renderer.screenToGrid(screenX, screenY);
    if (coords) {
        // Apply brush size
        const r = parseInt(brushSize) - 1;
        for(let dy = -r; dy <= r; dy++) {
            for(let dx = -r; dx <= r; dx++) {
                engine.setCell(coords.x + dx, coords.y + dy, selectedTool);
            }
        }
        audio.playInteractionTone(selectedTool);
        // Resume audio context on first interaction if needed
        audio.resume(); 
    }
}

// --- Event Listeners ---

function setupEventListeners() {
    // Transport
    ui.btnPlay.onclick = () => {
        isPlaying = !isPlaying;
        ui.btnPlay.className = isPlaying ? 'icon-btn playing' : 'icon-btn paused';
        audio.resume();
    };
    
    ui.btnReset.onclick = () => {
        engine.reset();
        updateStats();
    };

    ui.btnStep.onclick = () => {
        isPlaying = false;
        ui.btnPlay.className = 'icon-btn paused';
        engine.step();
        updateStats();
    };

    // Tab Switching
    ui.btnTools.onclick = () => togglePanel('tools');
    ui.btnRules.onclick = () => togglePanel('rules');

    // Brush Size
    ui.brushInput.oninput = (e) => {
        brushSize = e.target.value;
        showToolIndicator(`Size: ${brushSize}`);
    };

    // Speed
    ui.simSpeed.oninput = (e) => {
        simSpeed = parseInt(e.target.value);
    };

    // Rule Presets
    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.onclick = () => {
            // Update visual state
            document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Update Logic
            const preset = btn.dataset.preset;
            engine.ruleSet = preset;
            engine.reset();
            
            // Set default tool for this preset
            if (preset === 'classic') selectedTool = SEED_TYPES.LIFE;
            if (preset === 'bloom') selectedTool = SEED_TYPES.PHOTON;
            if (preset === 'forest') selectedTool = SEED_TYPES.CRYSTAL;
            if (preset === 'predator') selectedTool = SEED_TYPES.DECAY;

            ui.ruleDesc.textContent = RULE_DESCRIPTIONS[preset];
            updateUI();
            
            // Seed initial state
            randomize(0.15);
        };
    });
}

// Touch & Mouse Handling
function setupTouchHandling() {
    let isDrawing = false;

    // Mouse
    canvas.addEventListener('mousedown', (e) => { isDrawing = true; handleInput(e.clientX, e.clientY); });
    window.addEventListener('mouseup', () => isDrawing = false);
    canvas.addEventListener('mousemove', (e) => { if(isDrawing) handleInput(e.clientX, e.clientY); });

    // Touch
    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault(); // Prevent scrolling
        isDrawing = true;
        handleInput(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: false });
    
    canvas.addEventListener('touchend', () => isDrawing = false);
    
    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if(isDrawing) handleInput(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: false });
}

// --- UI Helpers ---

function togglePanel(panelName) {
    const toolsOpen = ui.panelTools.classList.contains('open');
    const rulesOpen = ui.panelRules.classList.contains('open');

    // Close all first
    ui.panelTools.classList.remove('open');
    ui.panelRules.classList.remove('open');
    ui.btnTools.classList.remove('active');
    ui.btnRules.classList.remove('active');

    if (panelName === 'tools' && !toolsOpen) {
        ui.panelTools.classList.add('open');
        ui.btnTools.classList.add('active');
    }
    else if (panelName === 'rules' && !rulesOpen) {
        ui.panelRules.classList.add('open');
        ui.btnRules.classList.add('active');
    }
}

function showToolIndicator(text) {
    ui.toolName.textContent = text;
    ui.toolIndicator.classList.add('visible');
    clearTimeout(ui.toolTimeout);
    ui.toolTimeout = setTimeout(() => {
        ui.toolIndicator.classList.remove('visible');
    }, 1500);
}

function updateUI() {
    // Update seed selection highlights
    const seedBtns = ui.seedPalette.children;
    for (let btn of seedBtns) {
        btn.classList.remove('selected');
        // Determine type from color (hacky but saves DOM storage) or re-generate
    }
    // Easier to just regenerate buttons or store reference? 
    // Let's clear and regen to ensure state is clean
    ui.seedPalette.innerHTML = '';
    generateSeedButtons();
}

function updateStats() {
    ui.tick.innerText = `Tick: ${engine.generation}`;
    ui.pop.innerText = `Alive: ${engine.aliveCount}`;
}

// Boot
init();
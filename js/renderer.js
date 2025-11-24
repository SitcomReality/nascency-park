// Renderer: Handles the Canvas drawing
import { SEED_TYPES, SEED_COLORS } from './engine.js';

export class Renderer {
    constructor(canvas, engine) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d', { alpha: false }); // Alpha false for perf
        this.engine = engine;
        
        this.cellSize = 0;
        this.offsetX = 0;
        this.offsetY = 0;
        this.scale = 1;

        // Setup interaction handling
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        
        // Calculate optimal cell size to fit grid initially
        const minDim = Math.min(this.canvas.width, this.canvas.height);
        const maxGridDim = Math.max(this.engine.width, this.engine.height);
        
        // Base cell size
        this.baseCellSize = Math.floor(minDim / maxGridDim);
        if (this.baseCellSize < 1) this.baseCellSize = 1;
        
        this.centerView();
    }

    centerView() {
        const gridPxlW = this.engine.width * this.baseCellSize * this.scale;
        const gridPxlH = this.engine.height * this.baseCellSize * this.scale;
        
        this.offsetX = (this.canvas.width - gridPxlW) / 2;
        this.offsetY = (this.canvas.height - gridPxlH) / 2;
    }

    // Coordinate conversion for mouse/touch
    screenToGrid(screenX, screenY) {
        const effectiveSize = this.baseCellSize * this.scale;
        const gx = Math.floor((screenX - this.offsetX) / effectiveSize);
        const gy = Math.floor((screenY - this.offsetY) / effectiveSize);
        
        if (gx >= 0 && gx < this.engine.width && gy >= 0 && gy < this.engine.height) {
            return { x: gx, y: gy };
        }
        return null;
    }

    draw() {
        const { width, height, grid, meta } = this.engine;
        const ctx = this.ctx;
        const effectiveSize = Math.max(1, this.baseCellSize * this.scale); // Prevent 0 size

        // Clear background
        ctx.fillStyle = '#0a0b15';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Optimization: Only draw visible area? 
        // For now, Grid is small enough (60x60) to draw all.
        
        // Draw Grid Content
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const i = y * width + x;
                const type = grid[i];
                
                if (type !== SEED_TYPES.EMPTY) {
                    const px = this.offsetX + x * effectiveSize;
                    const py = this.offsetY + y * effectiveSize;
                    
                    // Cull off-screen
                    if (px < -effectiveSize || py < -effectiveSize || 
                        px > this.canvas.width || py > this.canvas.height) continue;

                    ctx.fillStyle = SEED_COLORS[type];
                    
                    // Add some variation based on energy/meta
                    if (meta[i] < 0.5) {
                        ctx.globalAlpha = 0.5 + meta[i]; // Fade based on life
                    } else {
                        ctx.globalAlpha = 1.0;
                    }

                    // Draw cell with slight padding for grid look if large enough
                    const gap = effectiveSize > 4 ? 1 : 0;
                    ctx.fillRect(px, py, effectiveSize - gap, effectiveSize - gap);
                    
                    // Glow effect for high energy cells (simple overlap)
                    if (effectiveSize > 6 && meta[i] > 0.8) {
                        ctx.globalAlpha = 0.3;
                        ctx.fillRect(px - 2, py - 2, effectiveSize + 4, effectiveSize + 4);
                    }
                    
                    ctx.globalAlpha = 1.0;
                }
            }
        }
        
        // Draw Border around play area
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 2;
        ctx.strokeRect(
            this.offsetX, 
            this.offsetY, 
            width * effectiveSize, 
            height * effectiveSize
        );
    }
}
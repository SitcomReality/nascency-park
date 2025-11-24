// Engine: The Logic of Nascency Park

export const SEED_TYPES = {
    EMPTY: 0,
    PHOTON: 1,
    ROOT: 2,
    CRYSTAL: 3,
    DECAY: 4,
    LIFE: 5 // Classic Game of Life cell
};

// Colors for the renderer to reference
export const SEED_COLORS = {
    [SEED_TYPES.EMPTY]: '#0a0b15', // Using background color
    [SEED_TYPES.PHOTON]: '#fffbac',
    [SEED_TYPES.ROOT]: '#4facfe',
    [SEED_TYPES.CRYSTAL]: '#d585ff',
    [SEED_TYPES.DECAY]: '#ff4b4b',
    [SEED_TYPES.LIFE]: '#00f260'
};

export class Engine {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.size = width * height;

        // Double buffering
        this.grid = new Uint8Array(this.size);
        this.nextGrid = new Uint8Array(this.size);
        this.meta = new Float32Array(this.size); // For storing "energy" or age

        this.ruleSet = 'classic';
        this.generation = 0;
        this.aliveCount = 0;

        // Pre-calculate neighbor offsets for Moore neighborhood
        this.offsets = [
            -width - 1, -width, -width + 1,
            -1,                 1,
            width - 1,  width,  width + 1
        ];
    }

    reset() {
        this.grid.fill(SEED_TYPES.EMPTY);
        this.nextGrid.fill(SEED_TYPES.EMPTY);
        this.meta.fill(0);
        this.generation = 0;
        this.aliveCount = 0;
    }

    // Get array index from x, y
    idx(x, y) {
        // Wrap around logic (toroidal surface)
        const wx = (x + this.width) % this.width;
        const wy = (y + this.height) % this.height;
        return wy * this.width + wx;
    }

    setCell(x, y, type) {
        const i = this.idx(x, y);
        this.grid[i] = type;
        this.meta[i] = 1.0; // Reset energy on manual set
    }

    step() {
        let newAliveCount = 0;

        // Process every cell
        // Note: To optimize simple loop, we handle edge cases by simple wrapping math in idx
        // Ideally we avoid idx() call in hot loop, but for readability and robust wrapping we use logic

        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const i = y * this.width + x;
                const type = this.grid[i];
                const energy = this.meta[i];

                const neighbors = this.countNeighbors(x, y);

                // Execute Active Rule Set
                const nextState = this.applyRules(type, neighbors, energy, x, y);

                this.nextGrid[i] = nextState.type;
                this.meta[i] = nextState.energy;

                if (nextState.type !== SEED_TYPES.EMPTY) {
                    newAliveCount++;
                }
            }
        }

        // Swap buffers
        const temp = this.grid;
        this.grid = this.nextGrid;
        this.nextGrid = temp;

        this.generation++;
        this.aliveCount = newAliveCount;
    }

    countNeighbors(cx, cy) {
        const counts = {
            [SEED_TYPES.PHOTON]: 0,
            [SEED_TYPES.ROOT]: 0,
            [SEED_TYPES.CRYSTAL]: 0,
            [SEED_TYPES.DECAY]: 0,
            [SEED_TYPES.LIFE]: 0,
            total: 0
        };

        for (let i = 0; i < 8; i++) {
            // Manual wrap math for speed
            let nx = cx + (i===0||i===3||i===5 ? -1 : (i===2||i===4||i===7 ? 1 : 0));
            let ny = cy + (i<3 ? -1 : (i>4 ? 1 : 0));

            if (nx < 0) nx = this.width - 1;
            else if (nx >= this.width) nx = 0;
            if (ny < 0) ny = this.height - 1;
            else if (ny >= this.height) ny = 0;

            const ni = ny * this.width + nx;
            const type = this.grid[ni];

            if (type !== SEED_TYPES.EMPTY) {
                counts[type] = (counts[type] || 0) + 1;
                counts.total++;
            }
        }
        return counts;
    }

    applyRules(type, neighbors, energy, x, y) {
        let nextType = type;
        let nextEnergy = Math.max(0, energy - 0.01); // Default entropy

        switch (this.ruleSet) {

            // ------------------------------------------
            // SCENARIO 1: CLASSIC (Conwayish)
            // ------------------------------------------
            case 'classic':
                // We treat all non-empty as "Life" for generic Conway, 
                // or specifically the LIFE seed.
                if (type === SEED_TYPES.EMPTY) {
                    if (neighbors.total === 3) nextType = SEED_TYPES.LIFE;
                } else {
                    if (neighbors.total < 2 || neighbors.total > 3) nextType = SEED_TYPES.EMPTY;
                }
                break;

            // ------------------------------------------
            // SCENARIO 2: SPIRAL BLOOM
            // Photon emits, Root chases, Decay cleans
            // ------------------------------------------
            case 'bloom':
                // Root Growth
                if (type === SEED_TYPES.EMPTY) {
                    // Roots grow into empty space if near a Root AND near a Photon
                    if (neighbors[SEED_TYPES.ROOT] > 0 && neighbors[SEED_TYPES.PHOTON] > 0) {
                        nextType = SEED_TYPES.ROOT;
                        nextEnergy = 1.0;
                    }
                    // Spontaneous Photon generation in high energy zones (chaos)
                    else if (neighbors[SEED_TYPES.ROOT] > 4 && Math.random() < 0.01) {
                        nextType = SEED_TYPES.PHOTON;
                    }
                }
                else if (type === SEED_TYPES.ROOT) {
                    // Roots die if crowded
                    if (neighbors[SEED_TYPES.ROOT] > 5) nextType = SEED_TYPES.DECAY;
                    nextEnergy -= 0.02; 
                    if (nextEnergy <= 0) nextType = SEED_TYPES.EMPTY;
                }
                else if (type === SEED_TYPES.PHOTON) {
                    // Photons move/dim
                    nextEnergy -= 0.05;
                    if (nextEnergy <= 0) nextType = SEED_TYPES.EMPTY;
                }
                else if (type === SEED_TYPES.DECAY) {
                    nextType = SEED_TYPES.EMPTY; // Decays instantly
                }
                break;

            // ------------------------------------------
            // SCENARIO 3: FRACTAL FOREST
            // Crystal growth based on parity/symmetry
            // ------------------------------------------
            case 'forest':
                if (type === SEED_TYPES.EMPTY) {
                    // Grow crystal if exactly 1 neighbor (branching)
                    if (neighbors[SEED_TYPES.CRYSTAL] === 1) {
                        // Chance to branch varies to create gaps
                        if (Math.random() < 0.3) {
                            nextType = SEED_TYPES.CRYSTAL;
                            nextEnergy = 1.0;
                        }
                    }
                } else if (type === SEED_TYPES.CRYSTAL) {
                    // Old crystals turn to stone (Root visualized as stone here) or die
                    if (energy < 0.5) {
                        // Static state
                    }
                    nextEnergy -= 0.01;
                    // Overcrowded crystals shatter
                    if (neighbors[SEED_TYPES.CRYSTAL] > 4) nextType = SEED_TYPES.DECAY;
                } else if (type === SEED_TYPES.DECAY) {
                    nextType = SEED_TYPES.EMPTY;
                }
                break;

            // ------------------------------------------
            // SCENARIO 4: PREDATOR PREY
            // Photon=Prey, Decay=Predator, Root=Grass
            // ------------------------------------------
            case 'predator':
                // Root (Grass) grows randomly
                if (type === SEED_TYPES.EMPTY) {
                    if (Math.random() < 0.005) nextType = SEED_TYPES.ROOT;
                    else if (neighbors[SEED_TYPES.ROOT] > 1 && Math.random() < 0.05) nextType = SEED_TYPES.ROOT;
                }
                // Photon (Prey) eats Root
                else if (type === SEED_TYPES.ROOT) {
                   if (neighbors[SEED_TYPES.PHOTON] > 0) nextType = SEED_TYPES.EMPTY; // Eaten
                }
                else if (type === SEED_TYPES.PHOTON) {
                    // Dies of hunger
                    if (energy <= 0) nextType = SEED_TYPES.EMPTY;
                    // Eaten by Decay (Predator)
                    else if (neighbors[SEED_TYPES.DECAY] > 0) nextType = SEED_TYPES.EMPTY;
                    // Reproduce if ate recently (high energy) and space available
                    else if (energy > 0.8 && neighbors[SEED_TYPES.EMPTY] > 0 && Math.random() < 0.1) {
                        // Replication happens in neighbor check for empty, but here we just survive
                    }

                    // Simplified: If touching Root, gain energy. Else lose.
                    if (neighbors[SEED_TYPES.ROOT] > 0) nextEnergy = 1.0;
                    else nextEnergy -= 0.1;
                }
                else if (type === SEED_TYPES.DECAY) {
                    // Dies of hunger
                    if (energy <= 0) nextType = SEED_TYPES.EMPTY;

                    // Eats Photon
                    if (neighbors[SEED_TYPES.PHOTON] > 0) nextEnergy = 1.0;
                    else nextEnergy -= 0.05;
                }

                // Reproduction logic (Spawning new entities into empty slots)
                // This is tricky in a strict 1-pass CA. 
                // Usually requires a 2nd pass or probabilistic spawning in EMPTY block.
                // Handled in EMPTY block for Grass.
                // For movers, we simulate by spawning neighbors.
                if (type === SEED_TYPES.EMPTY) {
                     if (neighbors[SEED_TYPES.PHOTON] >= 2 && Math.random() < 0.1) nextType = SEED_TYPES.PHOTON;
                     if (neighbors[SEED_TYPES.DECAY] >= 2 && neighbors[SEED_TYPES.PHOTON] > 0) nextType = SEED_TYPES.DECAY;
                }

                break;
        }

        return { type: nextType, energy: nextEnergy };
    }
}
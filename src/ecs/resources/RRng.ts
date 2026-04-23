export class RRng {
    seed: number = 0;

    randomize_seed() {
        this.seed = Math.floor(Math.random() * 1000000);
    }

    set_seed(seed: number) {
        this.seed = seed;
    }

    nextFloat(): number {
        this.seed = (1664525 * this.seed + 1013904223) >>> 0;
        return this.seed / 4294967296;
    }
}
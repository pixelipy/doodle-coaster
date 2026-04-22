import { Vector3 } from "three";

export class RGrid {
    // This resource can store grid-related data such as cell size, grid dimensions, etc.
    cellSize: number = 1;

    constructor({ cellSize = 1 }: { cellSize?: number } = {}) {
        this.cellSize = cellSize;
    }


    worldToGrid(position: Vector3): Vector3 {
        return new Vector3(
            Math.round(position.x / this.cellSize),
            Math.round(position.y / this.cellSize),
            Math.round(position.z / this.cellSize)
        );
    }
}
import type { Line, Vector3 } from "three";
import { Component } from "../core/component";

export class CTrack extends Component {
    rawPoints: Vector3[] = [];
    physicsPoints: Vector3[] = [];
    cumulativeLengths: number[] = [];
    trackLength: number = 0;
    sampled: Vector3[] = []; // rendered directly from the deterministic rail
    lineMesh: Line | null = null;

    setLineMesh(line: Line) {
        this.lineMesh = line;
    }
}
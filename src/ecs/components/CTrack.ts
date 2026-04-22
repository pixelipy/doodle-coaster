import type { CatmullRomCurve3, Line, Vector3 } from "three";
import { Component } from "../core/component";

export class CTrack extends Component {
    rawPoints: Vector3[] = [];
    curve: CatmullRomCurve3 | null = null;
    curveLength: number = 0;
    sampled: Vector3[] = []; //for rendering
    lineMesh: Line | null = null;

    setLineMesh(line: Line) {
        this.lineMesh = line;
    }
}
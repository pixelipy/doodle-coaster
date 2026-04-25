import type { Line, Vector3 } from "three";
import { Component } from "../core/component";

export type TrackRole = "player" | "stationStub"
export type TrackPointLock = "free" | "protected"

export class CTrack extends Component {
    rawPoints: Vector3[] = [];
    physicsPoints: Vector3[] = [];
    cumulativeLengths: number[] = [];
    trackLength: number = 0;
    sampled: Vector3[] = []; // rendered directly from the deterministic rail
    lineMesh: Line | null = null;
    trackRole: TrackRole = "player";
    stationId: string | null = null;
    immutable: boolean = false;
    pointLocks: TrackPointLock[] = [];

    setLineMesh(line: Line) {
        this.lineMesh = line;
    }

    setRawPoints(rawPoints: Vector3[], pointLocks?: TrackPointLock[]) {
        this.rawPoints = rawPoints.map(point => point.clone());
        this.pointLocks = this.rawPoints.map((_, index) => pointLocks?.[index] ?? "free");
    }

    pushRawPoint(point: Vector3, lock: TrackPointLock = "free") {
        this.rawPoints.push(point.clone());
        this.pointLocks.push(lock);
    }

    unshiftRawPoint(point: Vector3, lock: TrackPointLock = "free") {
        this.rawPoints.unshift(point.clone());
        this.pointLocks.unshift(lock);
    }

    replaceRawPoint(index: number, point: Vector3) {
        this.rawPoints[index] = point.clone();
        if (this.pointLocks[index] === undefined) {
            this.pointLocks[index] = "free";
        }
    }

    getPointLock(index: number): TrackPointLock {
        return this.pointLocks[index] ?? "free";
    }

    isPointProtected(index: number) {
        return this.getPointLock(index) === "protected";
    }

    isEndpointProtected(endpoint: "start" | "end") {
        if (this.rawPoints.length === 0) return false;
        return endpoint === "start"
            ? this.isPointProtected(0)
            : this.isPointProtected(this.rawPoints.length - 1);
    }
}

import { Component } from "../core/component";

export class CStation extends Component {
    stationId: string;
    kind: "start" | "goal";
    boostSpeed: number;
    stubTrackId: number | null;
    radius: number;

    constructor(
        stationId: string,
        kind: "start" | "goal",
        boostSpeed: number,
        radius: number,
        stubTrackId: number | null = null
    ) {
        super();
        this.stationId = stationId;
        this.kind = kind;
        this.boostSpeed = boostSpeed;
        this.radius = radius;
        this.stubTrackId = stubTrackId;
    }
}

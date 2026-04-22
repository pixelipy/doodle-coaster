import { Vector3 } from "three";

export class CCart {
    trackId: number | null = null;
    lastTrackId: number | null = null;
    t: number = 0; //0-1 along the track

    speed: number = 0.2; //units per second, along the track

    attached: boolean = false;
    reattachCooldown: number = 0;

    velocity: Vector3 = new Vector3(); //for physics when detached
}
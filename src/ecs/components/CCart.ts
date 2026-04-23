import { Vector3 } from "three";

export class CCart {
    trackId: number | null = null;
    lastTrackId: number | null = null;
    t: number = 0; //0-1 along the track

    speed: number = 0.2; //units per second, along the track
    defaultSpeed: number = this.speed;

    attached: boolean = false;
    reattachCooldown: number = 0;

    angularVelocity: number = 0; // for physics when detached, in radians per second. Positive is clockwise when looking in the direction of travel.
    prevTrackAngle: number | null = null; // keeps track of angle on previous frame.

    spawnPosition: Vector3 = new Vector3();
    spawnRotation: Vector3 = new Vector3();
    velocity: Vector3 = new Vector3(); //for physics when detached
}
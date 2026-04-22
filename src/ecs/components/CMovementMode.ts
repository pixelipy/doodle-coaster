import { Vector3 } from "three";

//how the entity moves. it will "hop" from one grid cell to another
export class CGridMovement {
    isMoving: boolean = false;

    start: Vector3 = new Vector3();
    target: Vector3 = new Vector3();

    progress: number = 0; // 0 to 1
    duration: number = 0.2; // seconds

    hopHeight: number = 0.75; // how high the hop is
    hopSquash: number = 0.2; // how much the entity squashes during the hop
}

//just a tag for now
export class CContinuousMovement {}
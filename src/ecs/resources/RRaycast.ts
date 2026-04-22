import { Plane, Raycaster, Vector2, Vector3 } from "three";

export class RRaycast{
    raycaster = new Raycaster();
    mouseNDC = new Vector2(); //normalized device coordinates of mouse
    hitPoint = new Vector3();
    plane: Plane = new Plane(new Vector3(0, 0, 1), 0); //plane at z=0 facing up
}
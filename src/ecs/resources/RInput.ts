//gets player inputs

import { Vector2, Vector3 } from "three"

export class RInput {
    keysDown: Set<string> = new Set()
    keysPressed: Set<string> = new Set()
    keysReleased: Set<string> = new Set()

    lmbDown: boolean = false
    lmbPressed: boolean = false
    lmbReleased: boolean = false

    mmbDown: boolean = false
    mmbPressed: boolean = false
    mmbReleased: boolean = false

    rmbDown: boolean = false
    rmbPressed: boolean = false
    rmbReleased: boolean = false

    mousePosition: Vector2 = new Vector2() //in screen space, z=0
    mouseDelta: Vector2 = new Vector2() //change in mouse position since last frame
}
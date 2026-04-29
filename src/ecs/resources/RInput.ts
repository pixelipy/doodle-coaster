//gets player inputs

import { Vector2 } from "three"

export class RInput {
    keysDown: Set<string> = new Set()
    keysPressed: Set<string> = new Set()
    keysReleased: Set<string> = new Set()
    keysPressedBuffered: Set<string> = new Set()
    keysReleasedBuffered: Set<string> = new Set()

    actionsDown: Set<string> = new Set()
    actionsPressed: Set<string> = new Set()
    actionsReleased: Set<string> = new Set()
    actionsPressedBuffered: Set<string> = new Set()
    actionsReleasedBuffered: Set<string> = new Set()

    lmbDown: boolean = false
    lmbPressed: boolean = false
    lmbReleased: boolean = false

    mmbDown: boolean = false
    mmbPressed: boolean = false
    mmbReleased: boolean = false

    rmbDown: boolean = false
    rmbPressed: boolean = false
    rmbReleased: boolean = false

    swipeUp: boolean = false
    swipeDown: boolean = false
    swipeLeft: boolean = false
    swipeRight: boolean = false

    mousePosition: Vector2 = new Vector2() //in screen space, z=0
    mouseDelta: Vector2 = new Vector2() //change in mouse position since last frame

    panDelta = {x: 0, y: 0} //for panning with middle mouse button
    zoomDelta: number = 0 //positive for scrolling up, negative for scrolling down
    
    //mobile
    touches = new Map<number, {x: number, y: number}>()
    activeDrawTouchId: number | null = null
    previousDrawTouchPosition: { x: number, y: number } | null = null
    swipeStartTouchPosition: { x: number, y: number } | null = null
    swipeConsumedOnActiveTouch: boolean = false
    touchGestureActive: boolean = false

    //internal
    previousPinchDistance: number = 0
    previousTouchCenter = {x: 0, y: 0}
}

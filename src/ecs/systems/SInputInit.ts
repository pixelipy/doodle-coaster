//generates input map, and resets it every frame
import { System } from "../core/system";
import { World } from "../core/world";
import { RInput } from "../resources/RInput";
import { ESimulationState, RSimulationState } from "../resources/RSimulationState";

export class SInputInit extends System {

    constructor() {
        super();
    }

    init(world: World): void {
        const input = world.getResource(RInput)!;
        const simulationState = world.getResource(RSimulationState)!;
        const SWIPE_THRESHOLD_PX = 48;

        const normalizeKey = (key: string, code?: string) => {
            if (key === " " || key === "Space" || key === "Spacebar" || code === "Space") {
                return " "
            }

            return key
        }

        const clearSwipeTracking = () => {
            input.swipeStartTouchPosition = null;
            input.swipeConsumedOnActiveTouch = false;
        };

        const clearDrawTouch = () => {
            input.activeDrawTouchId = null;
            input.previousDrawTouchPosition = null;
            clearSwipeTracking();
        };

        const releasePrimaryTouch = () => {
            if (input.lmbDown) {
                input.lmbDown = false;
                input.lmbReleased = true;
            }

            clearDrawTouch();
        };

        const beginPrimaryTouch = (touch: Touch) => {
            input.activeDrawTouchId = touch.identifier;
            input.previousDrawTouchPosition = { x: touch.clientX, y: touch.clientY };
            input.swipeStartTouchPosition = { x: touch.clientX, y: touch.clientY };
            input.swipeConsumedOnActiveTouch = false;
            input.mousePosition.set(touch.clientX, touch.clientY);
            input.mouseDelta.set(0, 0);

            if (!input.lmbDown) {
                input.lmbPressed = true;
            }

            input.lmbDown = true;
        };

        const resetGestureTracking = () => {
            input.previousPinchDistance = 0;
            input.previousTouchCenter = { x: 0, y: 0 };
            input.panDelta.x = 0;
            input.panDelta.y = 0;
        };

        const syncGestureTrackingFromTouches = () => {
            if (input.touches.size !== 2) {
                resetGestureTracking();
                return;
            }

            const [p1, p2] = Array.from(input.touches.values());
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            input.previousPinchDistance = Math.sqrt(dx * dx + dy * dy);
            input.previousTouchCenter = {
                x: (p1.x + p2.x) / 2,
                y: (p1.y + p2.y) / 2,
            };
        };

        const triggerSwipe = (direction: "up" | "down" | "left" | "right") => {
            input.swipeConsumedOnActiveTouch = true;

            if (direction === "up") {
                input.swipeUp = true;
                input.keysPressed.add(" ");
                input.keysPressedBuffered.add(" ");
                return;
            }

            if (direction === "down") {
                input.swipeDown = true;
                return;
            }

            if (direction === "left") {
                input.swipeLeft = true;
                return;
            }

            input.swipeRight = true;
        };

        const maybeTriggerSwipe = (touch: Touch) => {
            if (simulationState.state !== ESimulationState.Playing) return;
            if (input.touchGestureActive || input.swipeConsumedOnActiveTouch) return;

            const start = input.swipeStartTouchPosition;
            if (!start) return;

            const dx = touch.clientX - start.x;
            const dy = touch.clientY - start.y;

            if (Math.abs(dx) < SWIPE_THRESHOLD_PX && Math.abs(dy) < SWIPE_THRESHOLD_PX) {
                return;
            }

            if (Math.abs(dy) >= Math.abs(dx)) {
                triggerSwipe(dy < 0 ? "up" : "down");
                return;
            }

            triggerSwipe(dx < 0 ? "left" : "right");
        };

        window.addEventListener("keydown", (e) => {
            const normalizedKey = normalizeKey(e.key, e.code)

            if (!input.keysDown.has(normalizedKey)) {
                input.keysPressed.add(normalizedKey);
                input.keysPressedBuffered.add(normalizedKey);
            }
            input.keysDown.add(normalizedKey);
        });

        window.addEventListener("keyup", (e) => {
            const normalizedKey = normalizeKey(e.key, e.code)

            input.keysDown.delete(normalizedKey);
            input.keysReleased.add(normalizedKey);
            input.keysReleasedBuffered.add(normalizedKey);
        });

        window.addEventListener("mousedown", (e) => {
            if (e.button === 0) {
                if (!input.lmbDown) {
                    input.lmbPressed = true;
                }
                input.lmbDown = true;
            } else if (e.button === 1) {
                if (!input.mmbDown) {
                    input.mmbPressed = true;
                }
                input.mmbDown = true;
                e.preventDefault();
            } else if (e.button === 2) {
                if (!input.rmbDown) {
                    input.rmbPressed = true;
                }
                input.rmbDown = true;
            }
        });

        window.addEventListener("mouseup", (e) => {
            if (e.button === 0) {
                input.lmbDown = false;
                input.lmbReleased = true;
            } else if (e.button === 1) {
                input.mmbDown = false;
                input.mmbReleased = true;
            } else if (e.button === 2) {
                input.rmbDown = false;
                input.rmbReleased = true;
            }
        });

        window.addEventListener("mousemove", (e) => {
            input.mouseDelta.set(e.movementX, e.movementY);
            input.mousePosition.set(e.clientX, e.clientY);

            if (input.mmbDown) {
                input.panDelta.x = e.movementX;
                input.panDelta.y = e.movementY;
            }
        });

        window.addEventListener("wheel", (e) => {
            input.zoomDelta += e.deltaY;
            e.preventDefault();
        }, { passive: false });

        // touch

        window.addEventListener("touchstart", (e) => {
            for (let touch of e.touches) {
                input.touches.set(touch.identifier, { x: touch.clientX, y: touch.clientY });
            }

            if (input.touches.size === 1 && !input.touchGestureActive) {
                const touch = e.touches[0];
                if (touch) {
                    beginPrimaryTouch(touch);
                }
            } else if (input.touches.size === 2) {
                releasePrimaryTouch();
                input.touchGestureActive = true;
                syncGestureTrackingFromTouches();
            }
        });


        // -------------------------
        // TOUCH MOVE
        // -------------------------
        window.addEventListener("touchmove", (e) => {

            for (const t of e.touches) {
                input.touches.set(t.identifier, { x: t.clientX, y: t.clientY });
            }

            if (input.touches.size === 1 && !input.touchGestureActive && input.activeDrawTouchId !== null) {
                const activeTouch = Array.from(e.touches).find(touch => touch.identifier === input.activeDrawTouchId);
                if (activeTouch) {
                    maybeTriggerSwipe(activeTouch);

                    const previousPosition = input.previousDrawTouchPosition ?? {
                        x: activeTouch.clientX,
                        y: activeTouch.clientY,
                    };

                    input.mousePosition.set(activeTouch.clientX, activeTouch.clientY);
                    input.mouseDelta.set(
                        activeTouch.clientX - previousPosition.x,
                        activeTouch.clientY - previousPosition.y
                    );
                    input.previousDrawTouchPosition = {
                        x: activeTouch.clientX,
                        y: activeTouch.clientY,
                    };
                }
            } else if (input.touches.size === 2) {
                input.touchGestureActive = true;

                const pts = Array.from(input.touches.values());
                const p1 = pts[0];
                const p2 = pts[1];

                // -------------------------
                // PINCH → zoomDelta
                // -------------------------
                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (input.previousPinchDistance !== 0) {
                    input.zoomDelta -= (dist - input.previousPinchDistance);
                }

                input.previousPinchDistance = dist;

                // -------------------------
                // PAN → panDelta
                // -------------------------
                const cx = (p1.x + p2.x) / 2;
                const cy = (p1.y + p2.y) / 2;

                if (input.previousTouchCenter.x !== 0 || input.previousTouchCenter.y !== 0) {
                    input.panDelta.x += (cx - input.previousTouchCenter.x);
                    input.panDelta.y += (cy - input.previousTouchCenter.y);
                }

                input.previousTouchCenter.x = cx;
                input.previousTouchCenter.y = cy;
            }

            e.preventDefault();
        }, { passive: false });


        window.addEventListener("touchend", (e) => {
            const endedDrawTouch = Array.from(e.changedTouches)
                .some(touch => touch.identifier === input.activeDrawTouchId);

            for (const touch of e.changedTouches) {
                input.touches.delete(touch.identifier);
            }

            if (endedDrawTouch) {
                releasePrimaryTouch();
            }

            if (input.touches.size === 2) {
                input.touchGestureActive = true;
                syncGestureTrackingFromTouches();
            } else {
                input.touchGestureActive = false;
                resetGestureTracking();
                clearDrawTouch();
            }
        })

        window.addEventListener("touchcancel", (e) => {
            const cancelledDrawTouch = Array.from(e.changedTouches)
                .some(touch => touch.identifier === input.activeDrawTouchId);

            for (const touch of e.changedTouches) {
                input.touches.delete(touch.identifier);
            }

            if (cancelledDrawTouch) {
                releasePrimaryTouch();
            }

            input.touchGestureActive = input.touches.size === 2;
            if (input.touchGestureActive) {
                syncGestureTrackingFromTouches();
            } else {
                resetGestureTracking();
                clearDrawTouch();
            }
        });
    }

}

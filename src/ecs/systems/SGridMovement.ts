import { CGridMovement } from "../components/CMovementMode"
import { CPosition, CRotation, CScale } from "../components/CTransform"
import { System } from "../core/system"
import type { World } from "../core/world"

function lerpAngle(a: number, b: number, t: number) {
  let diff = b - a
    diff = ((diff + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI
  return a + diff * t
}

function pulse(t: number, start: number, end: number) {
        const normalized = Math.min(1, Math.max(0, (t - start) / (end - start)))
        return Math.sin(normalized * Math.PI)
}

export class SGridMovement extends System {

    update(world: World, delta: number): void {
        const movers = world.query( CGridMovement, CPosition, CRotation, CScale)!

        for (const [_e, movement, position, rotation, scale] of movers) {
            if (!movement.isMoving) continue

            movement.progress += delta / movement.duration

            const t = Math.min(movement.progress, 1)

            // horizontal interpolation
            position.position.lerpVectors(
                movement.start,
                movement.target,
                t
            )

            //also rotate in the direction of movement, so it faces the direction it's moving
            const direction = movement.target.clone().sub(movement.start)
            const targetRotation = Math.atan2(direction.x, direction.z)
            rotation.rotation.y = lerpAngle(rotation.rotation.y, targetRotation, t)

            // Stretch on takeoff, squash on landing, with a small damped wobble.
            const takeoffStretch = pulse(t, 0, 0.35) * movement.hopSquash
            const landingSquash = pulse(t, 0.55, 1) * movement.hopSquash * 1.15
            const elastic = Math.sin(t * Math.PI * 6) * (1 - t) * movement.hopSquash * 0.12

            const yScale = Math.max(0.7, 1 + takeoffStretch - landingSquash + elastic)
            const xzScale = Math.max(0.8, 1 - takeoffStretch * 0.35 + landingSquash * 0.35 - elastic * 0.2)

            scale.scale.set(xzScale, yScale, xzScale)

            
            // hop arc (parabola)
            const height = 4 * movement.hopHeight * t * (1 - t)
            position.position.y = movement.start.y + height

            if (t >= 1) {
                // snap exactly
                position.position.copy(movement.target)
                scale.scale.set(1, 1, 1)
                movement.isMoving = false
            }
        }
    }
}
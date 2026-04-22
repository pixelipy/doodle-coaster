import { System } from "../core/system"
import { World } from "../core/world"
import { CCart } from "../components/CCart"
import { CTrack } from "../components/CTrack"
import { CPosition, CRotation } from "../components/CTransform"
import { CVelocity } from "../components/CVelocity"
import { ESimulationState, RSimulationState } from "../resources/RSimulationState"
import { Vector3 } from "three"

const GRAVITY = 6
const ATTACH_DIST = 0.12
const REATTACH_COOLDOWN = 0.15
const MIN_SPEED = 0.35
const MAX_SPEED = 8
const MAX_FORCE = 10
const ROTATION_EPSILON = 0.001

export class SCart extends System {

    private alignRotation(rotation: CRotation, tangent: Vector3, speed: number) {

        let facing = tangent

        // avoid flipping when almost stopped
        if (Math.abs(speed) > 0.01) {
            facing = speed >= 0 ? tangent : tangent.clone().negate()
        }

        if (facing.lengthSq() <= ROTATION_EPSILON * ROTATION_EPSILON) return

        rotation.rotation.x = 0
        rotation.rotation.y = 0
        rotation.rotation.z = Math.atan2(facing.y, facing.x)
        rotation.dirty = true
    }

    private alignRotationToVelocity(rotation: CRotation, velocity: Vector3) {
        const planarSpeedSq = velocity.x * velocity.x + velocity.y * velocity.y
        if (planarSpeedSq <= ROTATION_EPSILON * ROTATION_EPSILON) return

        rotation.rotation.x = 0
        rotation.rotation.y = 0
        rotation.rotation.z = Math.atan2(velocity.y, velocity.x)
        rotation.dirty = true
    }

    update(world: World, dt: number): void {

        const sim = world.getResource(RSimulationState)!
        if (sim.state !== ESimulationState.Playing) return

        for (const [e, cart, pos, vel] of world.query3(CCart, CPosition, CVelocity)) {

            const rotation = world.getComponent(e, CRotation)
            cart.reattachCooldown = Math.max(0, cart.reattachCooldown - dt)

            // -------------------------
            // FREE
            // -------------------------
            if (!cart.attached) {

                vel.velocity.y -= GRAVITY * dt

                const prevPos = pos.position.clone()

                pos.position.addScaledVector(vel.velocity, dt)
                pos.dirty = true

                if (rotation) this.alignRotationToVelocity(rotation, vel.velocity)

                this.tryAttach(world, cart, prevPos, pos, vel, rotation)
                continue
            }

            // -------------------------
            // ATTACHED
            // -------------------------
            const track = world.getComponent(cart.trackId!, CTrack)
            if (!track || !track.curve) continue

            const curve = track.curve
            const length = curve.getLength()
            if (length <= ROTATION_EPSILON) continue

            const tangent = curve.getTangentAt(cart.t).normalize()

            // gravity along slope
            const slope = tangent.y
            cart.speed += -GRAVITY * slope * dt
            cart.speed = Math.max(Math.min(cart.speed, MAX_SPEED), -MAX_SPEED)

            const nextT = Math.max(0, Math.min(1, cart.t + (cart.speed * dt) / length))
            const nextPoint = curve.getPointAt(nextT)
            const nextTangent = curve.getTangentAt(nextT).normalize()

            const railVelocity = nextTangent.clone().multiplyScalar(cart.speed)

            // stall
            if (Math.abs(cart.speed) < MIN_SPEED && nextT > 0.95) {
                this.detach(cart, vel, railVelocity)
                continue
            }

            // derail
            if (nextT < 0.99) {
                const lookT = Math.min(nextT + 0.01, 1)
                const lookTan = curve.getTangentAt(lookT).normalize()
                const turn = 1 - nextTangent.dot(lookTan)
                const force = cart.speed * cart.speed * turn

                if (force > MAX_FORCE) {
                    this.detach(cart, vel, railVelocity)
                    continue
                }
            }

            // end of track
            if (nextT <= 0 || nextT >= 1) {
                this.detach(cart, vel, railVelocity)
                continue
            }

            // apply transform
            cart.t = nextT
            pos.position.copy(nextPoint)
            pos.dirty = true
            vel.velocity.copy(railVelocity)

            // ✅ FIXED ROTATION (this was missing)
            if (rotation) {
                this.alignRotation(rotation, nextTangent, cart.speed)
            }
        }
    }

    private detach(cart: CCart, vel: CVelocity, releaseVelocity: Vector3) {
        vel.velocity.copy(releaseVelocity)
        cart.attached = false
        cart.lastTrackId = cart.trackId
        cart.trackId = null
        cart.reattachCooldown = REATTACH_COOLDOWN
    }

    private tryAttach(
        world: World,
        cart: CCart,
        prevPos: Vector3,
        pos: CPosition,
        vel: CVelocity,
        rotation?: CRotation
    ) {

        let bestTrackId: number | null = null
        let bestTrack: CTrack | null = null
        let bestT = 0
        let bestPoint: Vector3 | null = null
        let bestDist = ATTACH_DIST

        for (const [trackId, track] of world.query1(CTrack)) {

            // block only same track during cooldown
            if (cart.reattachCooldown > 0 && trackId === cart.lastTrackId) continue

            if (!track.sampled || track.sampled.length < 2) continue

            for (let i = 0; i < track.sampled.length - 1; i++) {

                const a = track.sampled[i]
                const b = track.sampled[i + 1]
                if (!a || !b) continue

                const closest = closestPointBetweenSegments(prevPos, pos.position, a, b)
                if (!closest) continue

                const d = closest.distanceTo(pos.position)

                if (d < bestDist) {
                    bestDist = d
                    bestTrackId = trackId
                    bestTrack = track
                    bestPoint = closest

                    const segLen = a.distanceTo(b)
                    const localT = segLen > 0 ? a.distanceTo(closest) / segLen : 0
                    bestT = (i + localT) / (track.sampled.length - 1)
                }
            }
        }

        if (!bestTrack || bestTrackId === null || !bestPoint) return

        cart.t = bestT
        cart.trackId = bestTrackId
        cart.lastTrackId = bestTrackId

        pos.position.copy(bestPoint)
        pos.dirty = true

        const tangent = bestTrack.curve!.getTangentAt(cart.t).normalize()

        const projectedSpeed = vel.velocity.dot(tangent)
        cart.speed = Math.max(Math.min(projectedSpeed, MAX_SPEED), -MAX_SPEED)

        vel.velocity.copy(tangent).multiplyScalar(cart.speed)

        if (rotation) {
            this.alignRotation(rotation, tangent, cart.speed)
        }

        cart.attached = true
    }
}

function closestPointBetweenSegments(
    p1: Vector3,
    p2: Vector3,
    a: Vector3,
    b: Vector3
): Vector3 | null {

    const ab = b.clone().sub(a)
    const lenSq = ab.lengthSq()
    if (lenSq === 0) return a.clone()

    const ap = p1.clone().sub(a)
    const t = Math.max(0, Math.min(1, ap.dot(ab) / lenSq))

    return a.clone().add(ab.multiplyScalar(t))
}
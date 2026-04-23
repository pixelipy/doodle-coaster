import { System } from "../core/system"
import { World } from "../core/world"
import { CCart } from "../components/CCart"
import { CTrack } from "../components/CTrack"
import { CPosition, CRotation } from "../components/CTransform"
import { CVelocity } from "../components/CVelocity"
import { ESimulationState, RSimulationState } from "../resources/RSimulationState"
import { Vector3 } from "three"

const GRAVITY = 3
const ATTACH_DIST = 0.2
const REATTACH_COOLDOWN = 0.3
const MAX_SPEED = 8
const ROTATION_EPSILON = 0.0001

export class SCart extends System {

    private normalizeAtAngle(angle: number) {
        while (angle > Math.PI) angle -= 2 * Math.PI
        while (angle < -Math.PI) angle += 2 * Math.PI
        return angle
    }

    private tangentAngle(direction: Vector3) {
        if (direction.lengthSq() < ROTATION_EPSILON) return null
        return Math.atan2(direction.y, direction.x)
    }

    private setRotationAngle(rotation: CRotation, angle: number) {
        rotation.rotation.x = 0
        rotation.rotation.y = 0
        rotation.rotation.z = angle
        rotation.dirty = true
    }

    private resetCart(world: World, entity: number, cart: CCart, pos: CPosition, vel: CVelocity) {
        pos.position.copy(cart.spawnPosition)
        pos.dirty = true

        vel.velocity.set(0, 0, 0)

        const rotation = world.getComponent(entity, CRotation)
        if (rotation) {
            rotation.rotation.copy(cart.spawnRotation)
            rotation.dirty = true
        }

        cart.attached = false
        cart.trackId = null
        cart.lastTrackId = null
        cart.t = 0
        cart.speed = cart.defaultSpeed
        cart.angularVelocity = 0
        cart.reattachCooldown = 0
    }

    update(world: World, dt: number): void {

        const sim = world.getResource(RSimulationState)!

        if (sim.state === ESimulationState.DrawingTrack) {
            for (const [e, cart, pos, vel] of world.query3(CCart, CPosition, CVelocity)) {
                this.resetCart(world, e, cart, pos, vel)
            }

            return
        }

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

                if (rotation){
                    this.setRotationAngle(rotation, this.normalizeAtAngle(rotation.rotation.z + cart.angularVelocity * dt))
                }

                this.tryAttach(world, cart, prevPos, pos, vel, rotation)
                continue
            }

            // -------------------------
            // ATTACHED
            // -------------------------
            const track = world.getComponent(cart.trackId!, CTrack)
            if (!track || !track.curve) continue

            const curve = track.curve
            const length = track.curveLength
            if (length <= ROTATION_EPSILON) continue

            const tangent = curve.getTangentAt(cart.t)

            // gravity along slope
            const slope = tangent.y
            cart.speed += -GRAVITY * slope * dt

            // clamp speed
            cart.speed = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, cart.speed))

            // move along curve
            const nextT = cart.t + (cart.speed * dt) / length

            // end of track → detach
            if (nextT <= 0 || nextT >= 1) {
                const releaseTangent = curve.getTangentAt(cart.t)
                const releaseVelocity = releaseTangent.clone().multiplyScalar(cart.speed)

                this.detach(cart, vel, releaseVelocity)
                continue
            }

            const clampedT = Math.max(0, Math.min(1, nextT))
            const nextPoint = curve.getPointAt(clampedT)
            const nextTangent = curve.getTangentAt(clampedT)

            const railVelocity = nextTangent.clone().multiplyScalar(cart.speed)

            // apply transform
            cart.t = clampedT
            pos.position.copy(nextPoint)
            pos.dirty = true

            vel.velocity.copy(railVelocity)

            const angle = this.tangentAngle(nextTangent)
            if (angle != null) {
                if (cart.prevTrackAngle !== null && dt > 0) {
                    const deltaAngle = this.normalizeAtAngle(angle - cart.prevTrackAngle)
                    cart.angularVelocity = deltaAngle / dt
                }else{
                    cart.angularVelocity = 0
                }
                cart.prevTrackAngle = angle

                if (rotation) this.setRotationAngle(rotation, angle)
            }
        }
    }

    private detach(cart: CCart, vel: CVelocity, releaseVelocity: Vector3) {
        vel.velocity.copy(releaseVelocity)
        cart.attached = false
        cart.lastTrackId = cart.trackId
        cart.trackId = null
        cart.prevTrackAngle = null
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

        const tangent = bestTrack.curve!.getTangentAt(cart.t)

        const projectedSpeed = vel.velocity.dot(tangent)
        cart.speed = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, projectedSpeed))

        vel.velocity.copy(tangent).multiplyScalar(cart.speed)

        const angle = this.tangentAngle(tangent)
        if (angle != null) {
            cart.prevTrackAngle = angle
            cart.angularVelocity = 0
            if (rotation) this.setRotationAngle(rotation, angle)
        }

        cart.attached = true
    }
}

function closestPointBetweenSegments(
    p1: Vector3,
    _p2: Vector3,
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
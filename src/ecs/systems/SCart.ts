import { System } from "../core/system"
import { World } from "../core/world"
import { CCart } from "../components/CCart"
import { CStation } from "../components/CStation"
import { CTrack } from "../components/CTrack"
import { CPosition, CRotation } from "../components/CTransform"
import { CVelocity } from "../components/CVelocity"
import { ESimulationState, RSimulationState } from "../resources/RSimulationState"
import { RLevel } from "../resources/RLevel"
import { RTime } from "../resources/RTime"
import { Vector3 } from "three"
import { sampleTrackRailAtDistance, sampleTrackRailAtSegmentDistance } from "../utils/trackRail"
import { findConnectedTrackEndpoint } from "../utils/trackEndpoints"
import { RSettings } from "../resources/RSettings"
import { RInput } from "../resources/RInput"

let GRAVITY = 3
let ATTACH_DIST = 0.2
let REATTACH_COOLDOWN = 0.3
let MAX_SPEED = 7
let ANGULAR_VELOCITY_BUILD_RATE = 90
let ANGULAR_VELOCITY_DECAY_RATE = 8
let MAX_ANGULAR_VELOCITY = 18

const ROTATION_EPSILON = 0.0001
const ATTACH_EPSILON = 1e-6
const DEBUG_ATTACH_DIAGNOSTICS = false
const ANGULAR_VELOCITY_SAMPLE_DISTANCE = 0.3
const ANGULAR_VELOCITY_EPSILON = 1e-4
const TRACK_CONNECTION_DIST = 0.05
const GOAL_CAPTURE_DISTANCE = 0.08

type TrackAttachCandidate = {
    trackId: number
    track: CTrack
    segmentIndex: number
    pointOnTrack: Vector3
    distanceSq: number
    endDistanceSq: number
    curveT: number
}

export class SCart extends System {

    init(world: World): void {
        let settings = world.getResource(RSettings)!

        GRAVITY = settings.physics.GRAVITY
        ATTACH_DIST = settings.cart.ATTACH_DIST
        REATTACH_COOLDOWN = settings.cart.REATTACH_COOLDOWN
        MAX_SPEED = settings.cart.MAX_SPEED
        ANGULAR_VELOCITY_BUILD_RATE = settings.cart.ANGULAR_VELOCITY_BUILD_RATE
        ANGULAR_VELOCITY_DECAY_RATE = settings.cart.ANGULAR_VELOCITY_DECAY_RATE
        MAX_ANGULAR_VELOCITY = settings.cart.MAX_ANGULAR_VELOCITY
    }

    private normalizeAtAngle(angle: number) {
        while (angle > Math.PI) angle -= 2 * Math.PI
        while (angle < -Math.PI) angle += 2 * Math.PI
        return angle
    }

    private tangentAngle(direction: Vector3) {
        if (direction.lengthSq() < ROTATION_EPSILON) return null
        return Math.atan2(direction.y, direction.x)
    }

    private closestVisualAngle(angle: number, referenceAngle: number) {
        const direct = this.normalizeAtAngle(angle)
        const flipped = this.normalizeAtAngle(angle + Math.PI)

        const directDelta = Math.abs(this.normalizeAtAngle(direct - referenceAngle))
        const flippedDelta = Math.abs(this.normalizeAtAngle(flipped - referenceAngle))

        return flippedDelta < directDelta ? flipped : direct
    }

    private setRotationAngle(rotation: CRotation, angle: number) {
        rotation.rotation.x = 0
        rotation.rotation.y = 0
        rotation.rotation.z = angle
        rotation.dirty = true
    }

    private resolveVisualAngle(direction: Vector3, referenceAngle: number) {
        const angle = this.tangentAngle(direction)
        if (angle == null) return null
        return this.closestVisualAngle(angle, referenceAngle)
    }

    private resolveAngularVelocityFromAngles(
        currentVisualAngle: number | null,
        nextVisualAngle: number | null,
        dt: number
    ) {
        if (currentVisualAngle == null || nextVisualAngle == null || dt <= 0) {
            return 0
        }

        const angularVelocity = this.normalizeAtAngle(nextVisualAngle - currentVisualAngle) / dt
        if (Math.abs(angularVelocity) <= ANGULAR_VELOCITY_EPSILON) {
            return 0
        }

        return angularVelocity
    }

    private clampAngularVelocity(angularVelocity: number) {
        return Math.max(-MAX_ANGULAR_VELOCITY, Math.min(MAX_ANGULAR_VELOCITY, angularVelocity))
    }

    private moveToward(current: number, target: number, maxDelta: number) {
        if (current < target) return Math.min(current + maxDelta, target)
        if (current > target) return Math.max(current - maxDelta, target)
        return current
    }

    private chooseAngularVelocityTarget(curvatureAngularVelocity: number, measuredAngularVelocity: number) {
        return Math.abs(measuredAngularVelocity) > Math.abs(curvatureAngularVelocity)
            ? measuredAngularVelocity
            : curvatureAngularVelocity
    }

    private advanceAccumulatedAngularVelocity(
        currentAngularVelocity: number,
        targetAngularVelocity: number,
        dt: number
    ) {
        const clampedCurrent = this.clampAngularVelocity(currentAngularVelocity)
        const clampedTarget = this.clampAngularVelocity(targetAngularVelocity)
        if (dt <= 0) return clampedCurrent

        const maxDelta = Math.abs(clampedTarget) > ANGULAR_VELOCITY_EPSILON
            ? ANGULAR_VELOCITY_BUILD_RATE * dt
            : ANGULAR_VELOCITY_DECAY_RATE * dt
        const nextAngularVelocity = Math.abs(clampedTarget) > ANGULAR_VELOCITY_EPSILON
            ? this.moveToward(clampedCurrent, clampedTarget, maxDelta)
            : this.moveToward(clampedCurrent, 0, maxDelta)

        if (Math.abs(nextAngularVelocity) <= ANGULAR_VELOCITY_EPSILON) {
            return 0
        }

        return this.clampAngularVelocity(nextAngularVelocity)
    }

    private resolveTrackSpinTarget(
        track: CTrack,
        distanceAlongTrack: number,
        speed: number,
        referenceAngle: number,
        measuredAngularVelocity: number = 0
    ) {
        const curvatureAngularVelocity = this.estimateTrackAngularVelocity(
            track,
            distanceAlongTrack,
            speed,
            referenceAngle
        )

        return this.chooseAngularVelocityTarget(curvatureAngularVelocity, measuredAngularVelocity)
    }

    private sampleTrackDirection(
        track: CTrack,
        distanceAlongTrack: number,
        halfWindow: number
    ) {
        const startDistance = Math.max(0, distanceAlongTrack - halfWindow)
        const endDistance = Math.min(track.trackLength, distanceAlongTrack + halfWindow)
        if (endDistance - startDistance <= ROTATION_EPSILON) return null

        const startSample = sampleTrackRailAtDistance(
            track.physicsPoints,
            track.cumulativeLengths,
            track.trackLength,
            startDistance
        )
        const endSample = sampleTrackRailAtDistance(
            track.physicsPoints,
            track.cumulativeLengths,
            track.trackLength,
            endDistance
        )
        if (!startSample || !endSample) return null

        const direction = endSample.point.clone().sub(startSample.point)
        if (direction.lengthSq() <= ROTATION_EPSILON) return null

        return direction
    }

    private estimateTrackAngularVelocity(
        track: CTrack,
        distanceAlongTrack: number,
        speed: number,
        referenceAngle: number
    ) {
        if (track.trackLength <= ROTATION_EPSILON) return 0
        if (Math.abs(speed) <= ROTATION_EPSILON) return 0

        const d1 = Math.max(0, distanceAlongTrack - ANGULAR_VELOCITY_SAMPLE_DISTANCE)
        const d2 = Math.min(track.trackLength, distanceAlongTrack + ANGULAR_VELOCITY_SAMPLE_DISTANCE)
        const ds = d2 - d1
        if (ds <= ROTATION_EPSILON) return 0

        const direction1 = this.sampleTrackDirection(track, d1, ANGULAR_VELOCITY_SAMPLE_DISTANCE)
        const direction2 = this.sampleTrackDirection(track, d2, ANGULAR_VELOCITY_SAMPLE_DISTANCE)
        if (!direction1 || !direction2) return 0

        const velocity1 = direction1.multiplyScalar(speed >= 0 ? 1 : -1)
        const velocity2 = direction2.multiplyScalar(speed >= 0 ? 1 : -1)
        const angle1 = this.resolveVisualAngle(velocity1, referenceAngle)
        const angle2 = this.resolveVisualAngle(velocity2, angle1 ?? referenceAngle)
        if (angle1 == null || angle2 == null) return 0

        const deltaAngle = this.normalizeAtAngle(angle2 - angle1)
        return deltaAngle / (ds / Math.abs(speed))
    }

    private beginInterpolatedStep(pos: CPosition, rotation?: CRotation) {
        pos.previousPosition.copy(pos.position)

        if (rotation) {
            rotation.previousRotation.copy(rotation.rotation)
        }
    }

    private resetCart(world: World, entity: number, cart: CCart, pos: CPosition, vel: CVelocity) {
        pos.position.copy(cart.spawnPosition)
        pos.previousPosition.copy(cart.spawnPosition)
        pos.dirty = true

        vel.velocity.set(0, 0, 0)

        const rotation = world.getComponent(entity, CRotation)
        if (rotation) {
            rotation.rotation.copy(cart.spawnRotation)
            rotation.previousRotation.copy(cart.spawnRotation)
            rotation.dirty = true
        }

        cart.attached = false
        cart.trackId = null
        cart.lastTrackId = null
        cart.t = 0
        cart.distanceAlongTrack = 0
        cart.speed = cart.defaultSpeed
        cart.angularVelocity = 0
        cart.prevTrackAngle = null
        cart.reattachCooldown = 0
        cart.lastBoostStationId = null
        cart.goalReached = false
    }

    private updateFreeCart(
        world: World,
        cart: CCart,
        pos: CPosition,
        vel: CVelocity,
        dt: number,
        rotation?: CRotation
    ) {
        vel.velocity.y -= GRAVITY * dt

        const prevPos = pos.position.clone()
        pos.position.addScaledVector(vel.velocity, dt)
        pos.dirty = true

        if (rotation) {
            rotation.rotation.z += cart.angularVelocity * dt
            rotation.dirty = true
            cart.prevTrackAngle = rotation.rotation.z
        }

        this.tryAttach(world, cart, prevPos, pos, vel, rotation)
    }

    private updateAttachedCart(
        world: World,
        cart: CCart,
        pos: CPosition,
        vel: CVelocity,
        dt: number,
        rotation?: CRotation
    ) {
        const input = world.getResource(RInput)!

        const track = world.getComponent(cart.trackId!, CTrack)
        if (!track || track.physicsPoints.length < 2) return

        const length = track.trackLength
        if (length <= ROTATION_EPSILON) return

        const currentSample = sampleTrackRailAtDistance(
            track.physicsPoints,
            track.cumulativeLengths,
            track.trackLength,
            cart.distanceAlongTrack
        )
        if (!currentSample) return

        const tangent = currentSample.tangent

        if (track.trackRole !== "stationStub") {
            cart.lastBoostStationId = null
        }

        //car jump!
        const level = world.getResource(RLevel)
        if (level && level.enabledAbilities.includes("jump")) {
            // Implement jump logic here
            if (input.keysDown.has(" ")){
                //detach immediatelly and jump with current speed + boost
            }

            if (input.keysReleased.has(" ")){
                // Implement logic for when the jump key is released
            }
        }


        cart.speed += -GRAVITY * tangent.y * dt
        cart.speed = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, cart.speed))
        this.applyStationBoostIfNeeded(world, cart, track)

        const nextDistance = cart.distanceAlongTrack + cart.speed * dt
        if (nextDistance <= 0 || nextDistance >= length) {
            const transferred = this.tryTransferAtTrackEnd(
                world,
                track,
                cart,
                pos,
                vel,
                rotation,
                dt,
                nextDistance
            )
            if (!transferred) {
                this.detachAtTrackEnd(track, cart, vel, rotation, tangent, dt, nextDistance)
            }
            return
        }

        const clampedDistance = Math.max(0, Math.min(length, nextDistance))
        const nextSample = sampleTrackRailAtDistance(
            track.physicsPoints,
            track.cumulativeLengths,
            track.trackLength,
            clampedDistance
        )
        if (!nextSample) return

        const currentReferenceAngle = rotation ? rotation.rotation.z : cart.prevTrackAngle ?? 0
        const currentVisualAngle = this.resolveVisualAngle(tangent, currentReferenceAngle)
        const updated = this.applyTrackSample(world, track, cart, pos, vel, rotation, dt, nextSample, currentVisualAngle)
        if (!updated) {
            return
        }

        if (this.checkGoalStationArrival(world, cart, track, pos, vel, rotation)) {
            return
        }
    }

    private applyTrackSample(
        world: World,
        track: CTrack,
        cart: CCart,
        pos: CPosition,
        vel: CVelocity,
        rotation: CRotation | undefined,
        dt: number,
        sample: NonNullable<ReturnType<typeof sampleTrackRailAtDistance>>,
        currentVisualAngle: number | null = null
    ) {
        const railVelocity = sample.tangent.clone().multiplyScalar(cart.speed)

        cart.distanceAlongTrack = sample.distanceAlongTrack
        cart.t = track.trackLength <= ROTATION_EPSILON ? 0 : sample.distanceAlongTrack / track.trackLength
        pos.position.copy(sample.point)
        pos.dirty = true
        vel.velocity.copy(railVelocity)

        const currentReferenceAngle = rotation ? rotation.rotation.z : cart.prevTrackAngle ?? 0
        const resolvedCurrentVisualAngle = currentVisualAngle ?? this.resolveVisualAngle(sample.tangent, currentReferenceAngle)
        const nextReferenceAngle = resolvedCurrentVisualAngle ?? currentReferenceAngle
        const nextVisualAngle = this.resolveVisualAngle(railVelocity, nextReferenceAngle)

        if (nextVisualAngle == null) return false

        const measuredAngularVelocity = this.resolveAngularVelocityFromAngles(
            resolvedCurrentVisualAngle,
            nextVisualAngle,
            dt
        )
        const targetAngularVelocity = this.resolveTrackSpinTarget(
            track,
            cart.distanceAlongTrack,
            cart.speed,
            nextVisualAngle,
            measuredAngularVelocity
        )
        cart.angularVelocity = this.advanceAccumulatedAngularVelocity(
            cart.angularVelocity,
            targetAngularVelocity,
            dt
        )
        cart.prevTrackAngle = nextVisualAngle

        if (rotation) {
            this.setRotationAngle(rotation, nextVisualAngle)
        }

        const level = world.getResource(RLevel)
        if (level?.completed) {
            vel.velocity.set(0, 0, 0)
            cart.angularVelocity = 0
        }

        return true
    }

    private getStationForTrack(world: World, track: CTrack) {
        if (track.trackRole !== "stationStub" || !track.stationId) {
            return null
        }

        const level = world.getResource(RLevel)
        const stationEntityId = level?.stationEntities.get(track.stationId)
        if (stationEntityId == null) {
            return null
        }

        return world.getComponent(stationEntityId, CStation) ?? null
    }

    private applyStationBoostIfNeeded(world: World, cart: CCart, track: CTrack) {
        const station = this.getStationForTrack(world, track)
        if (!station || station.kind !== "start") return
        if (cart.lastBoostStationId === station.stationId) return

        cart.speed = Math.max(cart.speed, station.boostSpeed)
        cart.speed = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, cart.speed))
        cart.lastBoostStationId = station.stationId
    }

    private tryTransferAtTrackEnd(
        world: World,
        track: CTrack,
        cart: CCart,
        pos: CPosition,
        vel: CVelocity,
        rotation: CRotation | undefined,
        dt: number,
        nextDistance: number
    ) {
        if (cart.trackId == null) return false

        const exitEndpoint = nextDistance <= 0 ? "start" : "end"
        const overflow = nextDistance <= 0 ? -nextDistance : nextDistance - track.trackLength
        const continuation = findConnectedTrackEndpoint(world, cart.trackId, exitEndpoint, TRACK_CONNECTION_DIST)
        if (!continuation) return false

        const nextTrack = world.getComponent(continuation.trackId, CTrack)
        if (!nextTrack || nextTrack.physicsPoints.length < 2 || nextTrack.trackLength <= ROTATION_EPSILON) {
            return false
        }

        const nextSpeed = continuation.endpoint === "start"
            ? Math.abs(cart.speed)
            : -Math.abs(cart.speed)

        const targetDistance = continuation.endpoint === "start"
            ? Math.min(nextTrack.trackLength, overflow)
            : Math.max(0, nextTrack.trackLength - overflow)

        const sample = sampleTrackRailAtDistance(
            nextTrack.physicsPoints,
            nextTrack.cumulativeLengths,
            nextTrack.trackLength,
            targetDistance
        )
        if (!sample) return false

        cart.trackId = continuation.trackId
        cart.lastTrackId = continuation.trackId
        cart.speed = nextSpeed

        const currentReferenceAngle = rotation ? rotation.rotation.z : cart.prevTrackAngle ?? 0
        const currentVisualAngle = this.resolveVisualAngle(vel.velocity, currentReferenceAngle)
        const updated = this.applyTrackSample(world, nextTrack, cart, pos, vel, rotation, dt, sample, currentVisualAngle)
        if (!updated) return false

        this.checkGoalStationArrival(world, cart, nextTrack, pos, vel, rotation)
        return true
    }

    private checkGoalStationArrival(
        world: World,
        cart: CCart,
        track: CTrack,
        pos: CPosition,
        vel: CVelocity,
        rotation?: CRotation
    ) {
        const station = this.getStationForTrack(world, track)
        if (!station || station.kind !== "goal") return false
        if (cart.distanceAlongTrack > GOAL_CAPTURE_DISTANCE) return false

        const level = world.getResource(RLevel)
        if (level) {
            level.completed = true
        }

        cart.goalReached = true
        cart.speed = 0
        cart.distanceAlongTrack = 0
        cart.t = 0
        cart.angularVelocity = 0
        vel.velocity.set(0, 0, 0)

        const stopPoint = track.physicsPoints[0] ?? pos.position
        pos.position.copy(stopPoint)
        pos.previousPosition.copy(stopPoint)
        pos.dirty = true

        if (rotation && cart.prevTrackAngle != null) {
            this.setRotationAngle(rotation, cart.prevTrackAngle)
            rotation.previousRotation.copy(rotation.rotation)
        }

        return true
    }

    private detachAtTrackEnd(
        track: CTrack,
        cart: CCart,
        vel: CVelocity,
        rotation: CRotation | undefined,
        tangent: Vector3,
        dt: number,
        nextDistance: number
    ) {
        const releaseDistance = Math.max(0, Math.min(track.trackLength, nextDistance))
        const releaseSample = sampleTrackRailAtDistance(
            track.physicsPoints,
            track.cumulativeLengths,
            track.trackLength,
            releaseDistance
        )
        const releaseTangent = releaseSample?.tangent ?? tangent
        const releaseVelocity = releaseTangent.clone().multiplyScalar(cart.speed)

        const currentReferenceAngle = rotation ? rotation.rotation.z : cart.prevTrackAngle ?? 0
        const currentVisualAngle = this.resolveVisualAngle(vel.velocity, currentReferenceAngle)
        const releaseReferenceAngle = currentVisualAngle ?? currentReferenceAngle
        const releaseVisualAngle = this.resolveVisualAngle(releaseVelocity, releaseReferenceAngle)
        const measuredReleaseAngularVelocity = this.resolveAngularVelocityFromAngles(
            currentVisualAngle,
            releaseVisualAngle,
            dt
        )
        const releaseAngularVelocity = this.resolveTrackSpinTarget(
            track,
            releaseDistance,
            cart.speed,
            releaseVisualAngle ?? currentReferenceAngle,
            measuredReleaseAngularVelocity
        )

        cart.angularVelocity = this.advanceAccumulatedAngularVelocity(
            cart.angularVelocity,
            releaseAngularVelocity,
            dt,
        )

        if (releaseVisualAngle != null) {
            cart.prevTrackAngle = releaseVisualAngle

            if (rotation) {
                this.setRotationAngle(rotation, releaseVisualAngle)
            }
        }

        this.detach(cart, vel, releaseVelocity)
    }

    update(world: World, _dt: number): void {

        const sim = world.getResource(RSimulationState)!
        const time = world.getResource(RTime)!
        const level = world.getResource(RLevel)

        if (sim.state === ESimulationState.DrawingTrack) {
            if (level) {
                level.completed = false
            }

            for (const [e, cart, pos, vel] of world.query3(CCart, CPosition, CVelocity)) {
                this.resetCart(world, e, cart, pos, vel)
            }

            return
        }

        if (time.pendingFixedSteps <= 0) return

        for (let step = 0; step < time.pendingFixedSteps; step++) {
            const dt = time.fixedTimestep

            for (const [e, cart, pos, vel] of world.query3(CCart, CPosition, CVelocity)) {
                const rotation = world.getComponent(e, CRotation)
                this.beginInterpolatedStep(pos, rotation)
                cart.reattachCooldown = Math.max(0, cart.reattachCooldown - dt)

                if (cart.goalReached || level?.completed) {
                    vel.velocity.set(0, 0, 0)
                    cart.angularVelocity = 0
                    continue
                }

                if (!cart.attached) {
                    this.updateFreeCart(world, cart, pos, vel, dt, rotation)
                    continue
                }

                this.updateAttachedCart(world, cart, pos, vel, dt, rotation)
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

        let bestCandidate: TrackAttachCandidate | null = null
        const maxAttachDistSq = ATTACH_DIST * ATTACH_DIST
        const debugCandidates: TrackAttachCandidate[] = []

        for (const [trackId, track] of world.query1(CTrack)) {

            if (cart.reattachCooldown > 0 && trackId === cart.lastTrackId) continue
            const physicsPoints = track.physicsPoints
            if (!physicsPoints || physicsPoints.length < 2) continue

            for (let i = 0; i < physicsPoints.length - 1; i++) {

                const a = physicsPoints[i]
                const b = physicsPoints[i + 1]
                if (!a || !b) continue

                const closest = closestPointsBetweenSegments(prevPos, pos.position, a, b)
                if (!closest || closest.distanceSq > maxAttachDistSq + ATTACH_EPSILON) continue

                const segmentStartDistance = track.cumulativeLengths[i]
                const segmentEndDistance = track.cumulativeLengths[i + 1]
                if (segmentStartDistance === undefined || segmentEndDistance === undefined) continue

                const segmentLength = segmentEndDistance - segmentStartDistance
                const trackDistance = segmentStartDistance + segmentLength * closest.tSecond
                const railSample = sampleTrackRailAtSegmentDistance(
                    physicsPoints,
                    track.cumulativeLengths,
                    i,
                    trackDistance
                )
                if (!railSample) continue

                const candidate: TrackAttachCandidate = {
                    trackId,
                    track,
                    segmentIndex: i,
                    pointOnTrack: railSample.point,
                    distanceSq: closest.pointOnFirst.distanceToSquared(railSample.point),
                    endDistanceSq: closest.pointOnFirst.distanceToSquared(pos.position),
                    curveT: track.trackLength <= ROTATION_EPSILON ? 0 : railSample.distanceAlongTrack / track.trackLength,
                }

                if (DEBUG_ATTACH_DIAGNOSTICS) {
                    debugCandidates.push(candidate)
                }

                if (isBetterTrackAttachCandidate(candidate, bestCandidate)) {
                    bestCandidate = candidate
                }
            }
        }

        if (!bestCandidate) return

        const bestT = bestCandidate.curveT
        const bestDistance = bestCandidate.track.trackLength <= ROTATION_EPSILON
            ? 0
            : bestT * bestCandidate.track.trackLength

        if (DEBUG_ATTACH_DIAGNOSTICS) {
            console.log("[SCart attach]", {
                trackId: bestCandidate.trackId,
                segmentIndex: bestCandidate.segmentIndex,
                distanceSq: bestCandidate.distanceSq,
                endDistanceSq: bestCandidate.endDistanceSq,
                resolvedT: bestT,
                candidateCount: debugCandidates.length,
                candidates: debugCandidates
                    .slice()
                    .sort((a, b) => a.distanceSq - b.distanceSq || a.trackId - b.trackId || a.segmentIndex - b.segmentIndex)
                    .map(candidate => ({
                        trackId: candidate.trackId,
                        segmentIndex: candidate.segmentIndex,
                        distanceSq: candidate.distanceSq,
                        endDistanceSq: candidate.endDistanceSq,
                        curveT: candidate.curveT,
                    })),
            })
        }

        cart.t = bestT
        cart.distanceAlongTrack = bestDistance
        cart.trackId = bestCandidate.trackId
        cart.lastTrackId = bestCandidate.trackId

        // Attaching snaps onto the rail sample chosen from the swept free-fall segment.
        pos.position.copy(bestCandidate.pointOnTrack)
        pos.previousPosition.copy(bestCandidate.pointOnTrack)
        pos.dirty = true

        const attachSample = sampleTrackRailAtDistance(
            bestCandidate.track.physicsPoints,
            bestCandidate.track.cumulativeLengths,
            bestCandidate.track.trackLength,
            cart.distanceAlongTrack
        )
        if (!attachSample) return

        const projectedSpeed = vel.velocity.dot(attachSample.tangent)
        cart.speed = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, projectedSpeed))

        if (DEBUG_ATTACH_DIAGNOSTICS) {
            console.log("[SCart attach winner]", {
                trackId: bestCandidate.trackId,
                resolvedT: cart.t,
                projectedSpeed: cart.speed,
            })
        }

        vel.velocity.copy(attachSample.tangent).multiplyScalar(cart.speed)

        const angle = this.tangentAngle(vel.velocity)
        if (angle != null) {
            const referenceAngle = rotation ? rotation.rotation.z : angle
            const visualAngle = this.closestVisualAngle(angle, referenceAngle)

            cart.prevTrackAngle = visualAngle
            cart.angularVelocity = this.clampAngularVelocity(this.resolveTrackSpinTarget(
                bestCandidate.track,
                cart.distanceAlongTrack,
                cart.speed,
                visualAngle
            ))
            if (rotation) {
                this.setRotationAngle(rotation, visualAngle)
                rotation.previousRotation.copy(rotation.rotation)
            }
        }

        cart.attached = true
    }
}

function isBetterTrackAttachCandidate(
    candidate: TrackAttachCandidate,
    current: TrackAttachCandidate | null
): boolean {
    if (!current) return true
    if (candidate.distanceSq < current.distanceSq - ATTACH_EPSILON) return true
    if (candidate.distanceSq > current.distanceSq + ATTACH_EPSILON) return false

    if (candidate.endDistanceSq < current.endDistanceSq - ATTACH_EPSILON) return true
    if (candidate.endDistanceSq > current.endDistanceSq + ATTACH_EPSILON) return false

    if (candidate.trackId !== current.trackId) return candidate.trackId < current.trackId
    if (candidate.segmentIndex !== current.segmentIndex) return candidate.segmentIndex < current.segmentIndex

    return candidate.curveT < current.curveT
}

function closestPointsBetweenSegments(
    p1: Vector3,
    p2: Vector3,
    q1: Vector3,
    q2: Vector3
): { pointOnFirst: Vector3, pointOnSecond: Vector3, distanceSq: number, tFirst: number, tSecond: number } | null {

    const d1 = p2.clone().sub(p1)
    const d2 = q2.clone().sub(q1)
    const r = p1.clone().sub(q1)
    const a = d1.dot(d1)
    const e = d2.dot(d2)
    const f = d2.dot(r)

    let s = 0
    let t = 0

    if (a <= ATTACH_EPSILON && e <= ATTACH_EPSILON) {
        return {
            pointOnFirst: p1.clone(),
            pointOnSecond: q1.clone(),
            distanceSq: p1.distanceToSquared(q1),
            tFirst: 0,
            tSecond: 0,
        }
    }

    if (a <= ATTACH_EPSILON) {
        s = 0
        t = clamp01(f / e)
    } else {
        const c = d1.dot(r)

        if (e <= ATTACH_EPSILON) {
            t = 0
            s = clamp01(-c / a)
        } else {
            const b = d1.dot(d2)
            const denom = a * e - b * b

            if (Math.abs(denom) > ATTACH_EPSILON) {
                s = clamp01((b * f - c * e) / denom)
            }

            const tNumerator = b * s + f

            if (tNumerator <= 0) {
                t = 0
                s = clamp01(-c / a)
            } else if (tNumerator >= e) {
                t = 1
                s = clamp01((b - c) / a)
            } else {
                t = tNumerator / e
            }
        }
    }

    const pointOnFirst = p1.clone().addScaledVector(d1, s)
    const pointOnSecond = q1.clone().addScaledVector(d2, t)

    return {
        pointOnFirst,
        pointOnSecond,
        distanceSq: pointOnFirst.distanceToSquared(pointOnSecond),
        tFirst: s,
        tSecond: t,
    }
}

function clamp01(value: number) {
    return Math.max(0, Math.min(1, value))
}

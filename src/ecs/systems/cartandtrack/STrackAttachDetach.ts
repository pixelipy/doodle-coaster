import { Vector3 } from "three"
import { CCart } from "../../components/cartandtrack/CCart"
import { CCartMotion } from "../../components/cartandtrack/CCartMotion"
import { CCartOrientation } from "../../components/cartandtrack/CCartOrientation"
import { CJump } from "../../components/abilities/CJump"
import { CTrackAttachment } from "../../components/cartandtrack/CTrackAttachment"
import { CTrack } from "../../components/cartandtrack/CTrack"
import { CPosition, CRotation } from "../../components/CTransform"
import { CVelocity } from "../../components/CVelocity"
import { System } from "../../core/system"
import { World } from "../../core/world"
import { RLevel } from "../../resources/RLevel"
import { ESimulationState, RSimulationState } from "../../resources/RSimulationState"
import { RSettings } from "../../resources/RSettings"
import { RTime } from "../../resources/RTime"
import { applyTrackSample, type CartOrientationSettings } from "../../utils/cartandtrack/cartRailKinematics"
import {
    advanceAccumulatedAngularVelocity,
    clampAngularVelocity,
    closestVisualAngle,
    resolveAngularVelocityFromAngles,
    resolveTrackSpinTarget,
    resolveVisualAngle,
    setRotationAngle,
    tangentAngle,
} from "../../utils/cartandtrack/cartOrientation"
import { findConnectedTrackEndpoint } from "../../utils/cartandtrack/trackEndpoints"
import { sampleTrackRailAtDistance, sampleTrackRailAtSegmentDistance } from "../../utils/cartandtrack/trackRail"
import {
    closestPointsBetweenSegments,
    isBetterTrackAttachCandidate,
    type TrackAttachCandidate,
    TRACK_ATTACH_EPSILON,
} from "../../utils/cartandtrack/trackAttach"
import { SJump } from "../abilities/SJump"

let GRAVITY = 3
let ATTACH_DIST = 0.2
let REATTACH_COOLDOWN = 0.3
let MAX_SPEED = 7
let ANGULAR_VELOCITY_BUILD_RATE = 90
let ANGULAR_VELOCITY_DECAY_RATE = 8
let MAX_ANGULAR_VELOCITY = 18

const DEBUG_ATTACH_DIAGNOSTICS = false
const TRACK_CONNECTION_DIST = 0.05

export class STrackAttachDetach extends System {
    init(world: World): void {
        const settings = world.getResource(RSettings)!

        GRAVITY = settings.physics.GRAVITY
        ATTACH_DIST = settings.cart.ATTACH_DIST
        REATTACH_COOLDOWN = settings.cart.REATTACH_COOLDOWN
        MAX_SPEED = settings.cart.MAX_SPEED
        ANGULAR_VELOCITY_BUILD_RATE = settings.cart.ANGULAR_VELOCITY_BUILD_RATE
        ANGULAR_VELOCITY_DECAY_RATE = settings.cart.ANGULAR_VELOCITY_DECAY_RATE
        MAX_ANGULAR_VELOCITY = settings.cart.MAX_ANGULAR_VELOCITY
    }

    static getOrientationSettings(): CartOrientationSettings {
        return {
            angularVelocityBuildRate: ANGULAR_VELOCITY_BUILD_RATE,
            angularVelocityDecayRate: ANGULAR_VELOCITY_DECAY_RATE,
            maxAngularVelocity: MAX_ANGULAR_VELOCITY,
        }
    }

    static detach(
        attachment: CTrackAttachment,
        vel: CVelocity,
        releaseVelocity: Vector3,
        jump?: CJump,
        coyoteTangent?: Vector3
    ) {
        vel.velocity.copy(releaseVelocity)
        attachment.attached = false
        attachment.lastTrackId = attachment.trackId
        attachment.trackId = null
        attachment.reattachCooldown = REATTACH_COOLDOWN
        SJump.markDetached(jump, coyoteTangent)
    }

    static tryTransferAtTrackEnd(
        world: World,
        track: CTrack,
        motion: CCartMotion,
        attachment: CTrackAttachment,
        orientation: CCartOrientation,
        pos: CPosition,
        vel: CVelocity,
        rotation: CRotation | undefined,
        dt: number,
        nextDistance: number,
        jump?: CJump
    ) {
        if (attachment.trackId == null) return false

        const exitEndpoint = nextDistance <= 0 ? "start" : "end"
        const overflow = nextDistance <= 0 ? -nextDistance : nextDistance - track.trackLength
        const continuation = findConnectedTrackEndpoint(world, attachment.trackId, exitEndpoint, TRACK_CONNECTION_DIST)
        if (!continuation) return false

        const nextTrack = world.getComponent(continuation.trackId, CTrack)
        if (!nextTrack || nextTrack.physicsPoints.length < 2) return false

        const nextSpeed = continuation.endpoint === "start"
            ? Math.abs(motion.speed)
            : -Math.abs(motion.speed)

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

        attachment.trackId = continuation.trackId
        attachment.lastTrackId = continuation.trackId
        motion.speed = nextSpeed

        const currentReferenceAngle = rotation ? rotation.rotation.z : orientation.prevTrackAngle ?? 0
        const currentVisualAngle = resolveVisualAngle(vel.velocity, currentReferenceAngle)
        const updated = applyTrackSample(
            nextTrack,
            attachment,
            motion,
            orientation,
            pos,
            vel,
            rotation,
            dt,
            sample,
            this.getOrientationSettings(),
            currentVisualAngle
        )
        if (!updated) return false

        if (jump) {
            SJump.markGrounded(jump, sample.tangent)
        }

        return true
    }

    static detachAtTrackEnd(
        track: CTrack,
        motion: CCartMotion,
        attachment: CTrackAttachment,
        orientation: CCartOrientation,
        vel: CVelocity,
        rotation: CRotation | undefined,
        tangent: Vector3,
        dt: number,
        nextDistance: number,
        jump?: CJump
    ) {
        const releaseDistance = Math.max(0, Math.min(track.trackLength, nextDistance))
        const releaseSample = sampleTrackRailAtDistance(
            track.physicsPoints,
            track.cumulativeLengths,
            track.trackLength,
            releaseDistance
        )
        const releaseTangent = releaseSample?.tangent ?? tangent
        const releaseVelocity = releaseTangent.clone().multiplyScalar(motion.speed)

        const currentReferenceAngle = rotation ? rotation.rotation.z : orientation.prevTrackAngle ?? 0
        const currentVisualAngle = resolveVisualAngle(vel.velocity, currentReferenceAngle)
        const releaseReferenceAngle = currentVisualAngle ?? currentReferenceAngle
        const releaseVisualAngle = resolveVisualAngle(releaseVelocity, releaseReferenceAngle)
        const measuredReleaseAngularVelocity = resolveAngularVelocityFromAngles(
            currentVisualAngle,
            releaseVisualAngle,
            dt
        )
        const releaseAngularVelocity = resolveTrackSpinTarget(
            track,
            releaseDistance,
            motion.speed,
            releaseVisualAngle ?? currentReferenceAngle,
            measuredReleaseAngularVelocity
        )

        orientation.angularVelocity = applyReleaseAngularVelocity(
            orientation.angularVelocity,
            releaseAngularVelocity,
            dt
        )

        if (releaseVisualAngle != null) {
            orientation.prevTrackAngle = releaseVisualAngle

            if (rotation) {
                setRotationAngle(rotation, releaseVisualAngle)
            }
        }

        this.detach(attachment, vel, releaseVelocity, jump, releaseTangent)
    }

    static tryAttach(
        world: World,
        motion: CCartMotion,
        attachment: CTrackAttachment,
        orientation: CCartOrientation,
        prevPos: Vector3,
        pos: CPosition,
        vel: CVelocity,
        rotation?: CRotation,
        jump?: CJump
    ) {
        let bestCandidate: TrackAttachCandidate | null = null
        const maxAttachDistSq = ATTACH_DIST * ATTACH_DIST
        const debugCandidates: TrackAttachCandidate[] = []

        for (const [trackId, track] of world.query1(CTrack)) {
            if (attachment.reattachCooldown > 0 && trackId === attachment.lastTrackId) continue
            const physicsPoints = track.physicsPoints
            if (physicsPoints.length < 2) continue

            for (let i = 0; i < physicsPoints.length - 1; i++) {
                const a = physicsPoints[i]
                const b = physicsPoints[i + 1]
                if (!a || !b) continue

                const closest = closestPointsBetweenSegments(prevPos, pos.position, a, b)
                if (!closest || closest.distanceSq > maxAttachDistSq + TRACK_ATTACH_EPSILON) continue

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
                    curveT: track.trackLength <= 0 ? 0 : railSample.distanceAlongTrack / track.trackLength,
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

        const bestDistance = bestCandidate.track.trackLength <= 0
            ? 0
            : bestCandidate.curveT * bestCandidate.track.trackLength

        if (DEBUG_ATTACH_DIAGNOSTICS) {
            console.log("[STrackAttachDetach attach]", {
                trackId: bestCandidate.trackId,
                segmentIndex: bestCandidate.segmentIndex,
                distanceSq: bestCandidate.distanceSq,
                endDistanceSq: bestCandidate.endDistanceSq,
                resolvedT: bestCandidate.curveT,
                candidateCount: debugCandidates.length,
            })
        }

        attachment.trackId = bestCandidate.trackId
        attachment.lastTrackId = bestCandidate.trackId
        attachment.distanceAlongTrack = bestDistance
        attachment.t = bestCandidate.curveT

        pos.position.copy(bestCandidate.pointOnTrack)
        pos.dirty = true

        const attachSample = sampleTrackRailAtDistance(
            bestCandidate.track.physicsPoints,
            bestCandidate.track.cumulativeLengths,
            bestCandidate.track.trackLength,
            attachment.distanceAlongTrack
        )
        if (!attachSample) return

        const projectedSpeed = vel.velocity.dot(attachSample.tangent)
        motion.speed = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, projectedSpeed))
        vel.velocity.copy(attachSample.tangent).multiplyScalar(motion.speed)

        const angle = tangentAngle(vel.velocity)
        if (angle != null) {
            const referenceAngle = rotation ? rotation.rotation.z : angle
            const visualAngle = closestVisualAngle(angle, referenceAngle)

            orientation.prevTrackAngle = visualAngle
            orientation.angularVelocity = clampAngularVelocity(
                resolveTrackSpinTarget(
                    bestCandidate.track,
                    attachment.distanceAlongTrack,
                    motion.speed,
                    visualAngle
                ),
                MAX_ANGULAR_VELOCITY
            )

            if (rotation) {
                setRotationAngle(rotation, visualAngle)
            }
        }

        attachment.attached = true
        if (jump) {
            SJump.markGrounded(jump, attachSample.tangent)

            if (SJump.tryConsumeQueuedTrackJump(attachment, motion, orientation, jump, vel, attachSample.tangent)) {
                return
            }
        }
    }

    update(world: World, _dt: number): void {
        const sim = world.getResource(RSimulationState)!
        const time = world.getResource(RTime)!
        const level = world.getResource(RLevel)

        if (sim.state === ESimulationState.DrawingTrack) return
        if (time.pendingFixedSteps <= 0) return

        for (let step = 0; step < time.pendingFixedSteps; step++) {
            const dt = time.fixedTimestep

            for (const [entity, cart, motion, attachment, orientation, pos, vel] of world.query(
                CCart,
                CCartMotion,
                CTrackAttachment,
                CCartOrientation,
                CPosition,
                CVelocity
            )) {
                attachment.reattachCooldown = Math.max(0, attachment.reattachCooldown - dt)

                if (cart.goalReached || level?.completed) {
                    continue
                }

                if (attachment.attached) {
                    continue
                }

                const jump = world.getComponent(entity, CJump)
                if (!jump) {
                    vel.velocity.y -= GRAVITY * dt
                }

                const prevPos = pos.position.clone()
                pos.position.addScaledVector(vel.velocity, dt)
                pos.dirty = true

                const rotation = world.getComponent(entity, CRotation)
                if (rotation) {
                    rotation.rotation.z += orientation.angularVelocity * dt
                    rotation.dirty = true
                    orientation.prevTrackAngle = rotation.rotation.z
                }

                STrackAttachDetach.tryAttach(world, motion, attachment, orientation, prevPos, pos, vel, rotation, jump ?? undefined)
            }
        }
    }
}

function applyReleaseAngularVelocity(currentAngularVelocity: number, targetAngularVelocity: number, dt: number) {
    return advanceAccumulatedAngularVelocity(
        currentAngularVelocity,
        targetAngularVelocity,
        dt,
        ANGULAR_VELOCITY_BUILD_RATE,
        ANGULAR_VELOCITY_DECAY_RATE,
        MAX_ANGULAR_VELOCITY
    )
}

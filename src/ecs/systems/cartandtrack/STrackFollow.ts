import { CCart } from "../../components/cartandtrack/CCart"
import { CCartMotion } from "../../components/cartandtrack/CCartMotion"
import { CCartOrientation } from "../../components/cartandtrack/CCartOrientation"
import { CJump } from "../../components/abilities/CJump"
import { CStation } from "../../components/CStation"
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
import { applyTrackSample } from "../../utils/cartandtrack/cartRailKinematics"
import { CART_ROTATION_EPSILON, resolveVisualAngle, setRotationAngle } from "../../utils/cartandtrack/cartOrientation"
import { sampleTrackRailAtDistance } from "../../utils/cartandtrack/trackRail"
import { SJump } from "../abilities/SJump"
import { STrackAttachDetach } from "./STrackAttachDetach"

let GRAVITY = 3
let MAX_SPEED = 7

const GOAL_CAPTURE_DISTANCE = 0.08

export class STrackFollow extends System {
    init(world: World): void {
        const settings = world.getResource(RSettings)!

        GRAVITY = settings.physics.GRAVITY
        MAX_SPEED = settings.cart.MAX_SPEED
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

    private applyStationBoostIfNeeded(world: World, motion: CCartMotion, track: CTrack) {
        const station = this.getStationForTrack(world, track)
        if (!station || station.kind !== "start") return
        if (motion.lastBoostStationId === station.stationId) return

        motion.speed = Math.max(motion.speed, station.boostSpeed)
        motion.speed = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, motion.speed))
        motion.lastBoostStationId = station.stationId
    }

    private checkGoalStationArrival(
        world: World,
        cart: CCart,
        motion: CCartMotion,
        attachment: CTrackAttachment,
        orientation: CCartOrientation,
        track: CTrack,
        pos: CPosition,
        vel: CVelocity,
        rotation?: CRotation
    ) {
        const station = this.getStationForTrack(world, track)
        if (!station || station.kind !== "goal") return false
        if (attachment.distanceAlongTrack > GOAL_CAPTURE_DISTANCE) return false

        const level = world.getResource(RLevel)
        if (level) {
            level.completed = true
        }

        cart.goalReached = true
        motion.speed = 0
        attachment.distanceAlongTrack = 0
        attachment.t = 0
        orientation.angularVelocity = 0
        vel.velocity.set(0, 0, 0)

        const stopPoint = track.physicsPoints[0] ?? pos.position
        pos.position.copy(stopPoint)
        pos.previousPosition.copy(stopPoint)
        pos.dirty = true

        if (rotation && orientation.prevTrackAngle != null) {
            setRotationAngle(rotation, orientation.prevTrackAngle)
            rotation.previousRotation.copy(rotation.rotation)
        }

        return true
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
                if (cart.goalReached || level?.completed || !attachment.attached || attachment.trackId == null) {
                    continue
                }

                const track = world.getComponent(attachment.trackId, CTrack)
                if (!track || track.physicsPoints.length < 2) continue
                if (track.trackLength <= CART_ROTATION_EPSILON) continue

                const currentSample = sampleTrackRailAtDistance(
                    track.physicsPoints,
                    track.cumulativeLengths,
                    track.trackLength,
                    attachment.distanceAlongTrack
                )
                if (!currentSample) continue

                const tangent = currentSample.tangent
                const jump = world.getComponent(entity, CJump)
                if (jump) {
                    SJump.markGrounded(jump, tangent)
                }

                if (track.trackRole !== "stationStub") {
                    motion.lastBoostStationId = null
                }

                motion.speed += -GRAVITY * tangent.y * dt
                motion.speed = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, motion.speed))
                this.applyStationBoostIfNeeded(world, motion, track)

                const nextDistance = attachment.distanceAlongTrack + motion.speed * dt
                const rotation = world.getComponent(entity, CRotation)

                if (nextDistance <= 0 || nextDistance >= track.trackLength) {
                    const transferred = STrackAttachDetach.tryTransferAtTrackEnd(
                        world,
                        track,
                        motion,
                        attachment,
                        orientation,
                        pos,
                        vel,
                        rotation,
                        dt,
                        nextDistance,
                        jump ?? undefined
                    )

                    if (transferred) {
                        const nextTrack = attachment.trackId == null ? null : world.getComponent(attachment.trackId, CTrack)
                        if (nextTrack) {
                            this.checkGoalStationArrival(world, cart, motion, attachment, orientation, nextTrack, pos, vel, rotation)
                        }
                    } else {
                        STrackAttachDetach.detachAtTrackEnd(
                            track,
                            motion,
                            attachment,
                            orientation,
                            vel,
                            rotation,
                            tangent,
                            dt,
                            nextDistance,
                            jump ?? undefined
                        )
                    }

                    continue
                }

                const nextSample = sampleTrackRailAtDistance(
                    track.physicsPoints,
                    track.cumulativeLengths,
                    track.trackLength,
                    Math.max(0, Math.min(track.trackLength, nextDistance))
                )
                if (!nextSample) continue

                const currentReferenceAngle = rotation ? rotation.rotation.z : orientation.prevTrackAngle ?? 0
                const currentVisualAngle = resolveVisualAngle(tangent, currentReferenceAngle)
                const updated = applyTrackSample(
                    track,
                    attachment,
                    motion,
                    orientation,
                    pos,
                    vel,
                    rotation,
                    dt,
                    nextSample,
                    STrackAttachDetach.getOrientationSettings(),
                    currentVisualAngle
                )
                if (!updated) continue

                this.checkGoalStationArrival(world, cart, motion, attachment, orientation, track, pos, vel, rotation)
            }
        }
    }
}

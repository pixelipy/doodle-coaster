import { CCartMotion } from "../components/cartandtrack/CCartMotion"
import { CCartOrientation } from "../components/cartandtrack/CCartOrientation"
import { CTrackAttachment } from "../components/cartandtrack/CTrackAttachment"
import { CTrack } from "../components/cartandtrack/CTrack"
import { CPosition, CRotation } from "../components/CTransform"
import { CVelocity } from "../components/CVelocity"
import {
    advanceAccumulatedAngularVelocity,
    CART_ROTATION_EPSILON,
    resolveAngularVelocityFromAngles,
    resolveTrackSpinTarget,
    resolveVisualAngle,
    setRotationAngle,
} from "./cartOrientation"
import { sampleTrackRailAtDistance } from "./trackRail"

export type CartOrientationSettings = {
    angularVelocityBuildRate: number
    angularVelocityDecayRate: number
    maxAngularVelocity: number
}

export function applyTrackSample(
    track: CTrack,
    attachment: CTrackAttachment,
    motion: CCartMotion,
    orientation: CCartOrientation,
    pos: CPosition,
    vel: CVelocity,
    rotation: CRotation | undefined,
    dt: number,
    sample: NonNullable<ReturnType<typeof sampleTrackRailAtDistance>>,
    orientationSettings: CartOrientationSettings,
    currentVisualAngle: number | null = null
) {
    const railVelocity = sample.tangent.clone().multiplyScalar(motion.speed)

    attachment.distanceAlongTrack = sample.distanceAlongTrack
    attachment.t = track.trackLength <= CART_ROTATION_EPSILON ? 0 : sample.distanceAlongTrack / track.trackLength
    pos.position.copy(sample.point)
    pos.dirty = true
    vel.velocity.copy(railVelocity)

    const currentReferenceAngle = rotation ? rotation.rotation.z : orientation.prevTrackAngle ?? 0
    const resolvedCurrentVisualAngle = currentVisualAngle ?? resolveVisualAngle(sample.tangent, currentReferenceAngle)
    const nextReferenceAngle = resolvedCurrentVisualAngle ?? currentReferenceAngle
    const nextVisualAngle = resolveVisualAngle(railVelocity, nextReferenceAngle)

    if (nextVisualAngle == null) return false

    const measuredAngularVelocity = resolveAngularVelocityFromAngles(
        resolvedCurrentVisualAngle,
        nextVisualAngle,
        dt
    )
    const targetAngularVelocity = resolveTrackSpinTarget(
        track,
        attachment.distanceAlongTrack,
        motion.speed,
        nextVisualAngle,
        measuredAngularVelocity
    )
    orientation.angularVelocity = advanceAccumulatedAngularVelocity(
        orientation.angularVelocity,
        targetAngularVelocity,
        dt,
        orientationSettings.angularVelocityBuildRate,
        orientationSettings.angularVelocityDecayRate,
        orientationSettings.maxAngularVelocity
    )
    orientation.prevTrackAngle = nextVisualAngle

    if (rotation) {
        setRotationAngle(rotation, nextVisualAngle)
    }

    return true
}

import { Vector3 } from "three"
import { CTrack } from "../components/cartandtrack/CTrack"
import { CRotation } from "../components/CTransform"
import { sampleTrackRailAtDistance } from "./trackRail"

export const CART_ROTATION_EPSILON = 0.0001
export const CART_ANGULAR_VELOCITY_EPSILON = 1e-4
export const CART_ANGULAR_VELOCITY_SAMPLE_DISTANCE = 0.3

export function normalizeAtAngle(angle: number) {
    while (angle > Math.PI) angle -= 2 * Math.PI
    while (angle < -Math.PI) angle += 2 * Math.PI
    return angle
}

export function tangentAngle(direction: Vector3) {
    if (direction.lengthSq() < CART_ROTATION_EPSILON) return null
    return Math.atan2(direction.y, direction.x)
}

export function closestVisualAngle(angle: number, referenceAngle: number) {
    const direct = normalizeAtAngle(angle)
    const flipped = normalizeAtAngle(angle + Math.PI)

    const directDelta = Math.abs(normalizeAtAngle(direct - referenceAngle))
    const flippedDelta = Math.abs(normalizeAtAngle(flipped - referenceAngle))

    return flippedDelta < directDelta ? flipped : direct
}

export function setRotationAngle(rotation: CRotation, angle: number) {
    rotation.rotation.x = 0
    rotation.rotation.y = 0
    rotation.rotation.z = angle
    rotation.dirty = true
}

export function resolveVisualAngle(direction: Vector3, referenceAngle: number) {
    const angle = tangentAngle(direction)
    if (angle == null) return null
    return closestVisualAngle(angle, referenceAngle)
}

export function resolveAngularVelocityFromAngles(
    currentVisualAngle: number | null,
    nextVisualAngle: number | null,
    dt: number
) {
    if (currentVisualAngle == null || nextVisualAngle == null || dt <= 0) {
        return 0
    }

    const angularVelocity = normalizeAtAngle(nextVisualAngle - currentVisualAngle) / dt
    if (Math.abs(angularVelocity) <= CART_ANGULAR_VELOCITY_EPSILON) {
        return 0
    }

    return angularVelocity
}

export function clampAngularVelocity(angularVelocity: number, maxAngularVelocity: number) {
    return Math.max(-maxAngularVelocity, Math.min(maxAngularVelocity, angularVelocity))
}

export function moveToward(current: number, target: number, maxDelta: number) {
    if (current < target) return Math.min(current + maxDelta, target)
    if (current > target) return Math.max(current - maxDelta, target)
    return current
}

export function chooseAngularVelocityTarget(curvatureAngularVelocity: number, measuredAngularVelocity: number) {
    return Math.abs(measuredAngularVelocity) > Math.abs(curvatureAngularVelocity)
        ? measuredAngularVelocity
        : curvatureAngularVelocity
}

export function advanceAccumulatedAngularVelocity(
    currentAngularVelocity: number,
    targetAngularVelocity: number,
    dt: number,
    buildRate: number,
    decayRate: number,
    maxAngularVelocity: number
) {
    const clampedCurrent = clampAngularVelocity(currentAngularVelocity, maxAngularVelocity)
    const clampedTarget = clampAngularVelocity(targetAngularVelocity, maxAngularVelocity)
    if (dt <= 0) return clampedCurrent

    const maxDelta = Math.abs(clampedTarget) > CART_ANGULAR_VELOCITY_EPSILON
        ? buildRate * dt
        : decayRate * dt
    const nextAngularVelocity = Math.abs(clampedTarget) > CART_ANGULAR_VELOCITY_EPSILON
        ? moveToward(clampedCurrent, clampedTarget, maxDelta)
        : moveToward(clampedCurrent, 0, maxDelta)

    if (Math.abs(nextAngularVelocity) <= CART_ANGULAR_VELOCITY_EPSILON) {
        return 0
    }

    return clampAngularVelocity(nextAngularVelocity, maxAngularVelocity)
}

export function sampleTrackDirection(
    track: CTrack,
    distanceAlongTrack: number,
    halfWindow: number
) {
    const startDistance = Math.max(0, distanceAlongTrack - halfWindow)
    const endDistance = Math.min(track.trackLength, distanceAlongTrack + halfWindow)
    if (endDistance - startDistance <= CART_ROTATION_EPSILON) return null

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
    if (direction.lengthSq() <= CART_ROTATION_EPSILON) return null

    return direction
}

export function estimateTrackAngularVelocity(
    track: CTrack,
    distanceAlongTrack: number,
    speed: number,
    referenceAngle: number
) {
    if (track.trackLength <= CART_ROTATION_EPSILON) return 0
    if (Math.abs(speed) <= CART_ROTATION_EPSILON) return 0

    const d1 = Math.max(0, distanceAlongTrack - CART_ANGULAR_VELOCITY_SAMPLE_DISTANCE)
    const d2 = Math.min(track.trackLength, distanceAlongTrack + CART_ANGULAR_VELOCITY_SAMPLE_DISTANCE)
    const ds = d2 - d1
    if (ds <= CART_ROTATION_EPSILON) return 0

    const direction1 = sampleTrackDirection(track, d1, CART_ANGULAR_VELOCITY_SAMPLE_DISTANCE)
    const direction2 = sampleTrackDirection(track, d2, CART_ANGULAR_VELOCITY_SAMPLE_DISTANCE)
    if (!direction1 || !direction2) return 0

    const velocity1 = direction1.multiplyScalar(speed >= 0 ? 1 : -1)
    const velocity2 = direction2.multiplyScalar(speed >= 0 ? 1 : -1)
    const angle1 = resolveVisualAngle(velocity1, referenceAngle)
    const angle2 = resolveVisualAngle(velocity2, angle1 ?? referenceAngle)
    if (angle1 == null || angle2 == null) return 0

    const deltaAngle = normalizeAtAngle(angle2 - angle1)
    return deltaAngle / (ds / Math.abs(speed))
}

export function resolveTrackSpinTarget(
    track: CTrack,
    distanceAlongTrack: number,
    speed: number,
    referenceAngle: number,
    measuredAngularVelocity: number = 0
) {
    const curvatureAngularVelocity = estimateTrackAngularVelocity(
        track,
        distanceAlongTrack,
        speed,
        referenceAngle
    )

    return chooseAngularVelocityTarget(curvatureAngularVelocity, measuredAngularVelocity)
}

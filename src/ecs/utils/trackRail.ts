import { Vector3 } from "three"

const TRACK_EPSILON = 1e-6

export type TrackRailSample = {
    point: Vector3
    tangent: Vector3
    segmentIndex: number
    segmentT: number
    distanceAlongTrack: number
}

// Build a deterministic rail by locally smoothing the raw stroke, then resampling it at fixed arc-length spacing.
export function buildTrackRail(rawPoints: Vector3[], spacing: number, smoothingPasses: number = 0) {
    if (rawPoints.length === 0) {
        return {
            physicsPoints: [] as Vector3[],
            cumulativeLengths: [] as number[],
            trackLength: 0,
        }
    }

    if (rawPoints.length === 1) {
        return {
            physicsPoints: [rawPoints[0].clone()],
            cumulativeLengths: [0],
            trackLength: 0,
        }
    }

    // Keep the editable raw points as the source of truth, but derive a smoother local polyline for movement.
    const smoothedPoints = smoothTrackPoints(rawPoints, smoothingPasses)

    const physicsPoints: Vector3[] = [smoothedPoints[0].clone()]
    let distanceFromLastPoint = 0

    for (let i = 0; i < smoothedPoints.length - 1; i++) {
        const start = smoothedPoints[i]
        const end = smoothedPoints[i + 1]
        if (!start || !end) continue

        const segment = end.clone().sub(start)
        const segmentLength = segment.length()
        if (segmentLength <= TRACK_EPSILON) continue

        const direction = segment.normalize()
        let traversedOnSegment = 0
        let remainingOnSegment = segmentLength

        while (distanceFromLastPoint + remainingOnSegment >= spacing) {
            const distanceToNextPoint = spacing - distanceFromLastPoint
            traversedOnSegment += distanceToNextPoint

            const nextPoint = start.clone().addScaledVector(direction, traversedOnSegment)
            pushUniquePoint(physicsPoints, nextPoint)

            distanceFromLastPoint = 0
            remainingOnSegment = segmentLength - traversedOnSegment
        }

        distanceFromLastPoint += remainingOnSegment
    }

    pushUniquePoint(physicsPoints, smoothedPoints[smoothedPoints.length - 1].clone())

    const cumulativeLengths = buildCumulativeLengths(physicsPoints)
    const trackLength = cumulativeLengths.length > 0
        ? cumulativeLengths[cumulativeLengths.length - 1]
        : 0

    return {
        physicsPoints,
        cumulativeLengths,
        trackLength,
    }
}

// Sample the deterministic rail by normalized progress so systems can share one lookup path.
export function sampleTrackRailAtNormalizedT(
    physicsPoints: Vector3[],
    cumulativeLengths: number[],
    trackLength: number,
    normalizedT: number
): TrackRailSample | null {
    if (physicsPoints.length === 0) return null

    if (physicsPoints.length === 1 || trackLength <= TRACK_EPSILON) {
        return {
            point: physicsPoints[0].clone(),
            tangent: new Vector3(1, 0, 0),
            segmentIndex: 0,
            segmentT: 0,
            distanceAlongTrack: 0,
        }
    }

    const targetDistance = clamp(normalizedT, 0, 1) * trackLength
    return sampleTrackRailAtDistance(physicsPoints, cumulativeLengths, trackLength, targetDistance)
}

// Sample the deterministic rail by world distance along the track.
export function sampleTrackRailAtDistance(
    physicsPoints: Vector3[],
    cumulativeLengths: number[],
    trackLength: number,
    targetDistance: number
): TrackRailSample | null {
    if (physicsPoints.length === 0) return null

    if (physicsPoints.length === 1 || trackLength <= TRACK_EPSILON) {
        return {
            point: physicsPoints[0].clone(),
            tangent: new Vector3(1, 0, 0),
            segmentIndex: 0,
            segmentT: 0,
            distanceAlongTrack: 0,
        }
    }

    const clampedDistance = clamp(targetDistance, 0, trackLength)
    let segmentIndex = cumulativeLengths.length - 2

    for (let i = 0; i < cumulativeLengths.length - 1; i++) {
        const startDistance = cumulativeLengths[i]
        const endDistance = cumulativeLengths[i + 1]

        if (clampedDistance <= endDistance || i === cumulativeLengths.length - 2) {
            segmentIndex = i
            break
        }

        if (endDistance <= startDistance + TRACK_EPSILON) continue
    }

    return sampleTrackRailAtSegmentDistance(
        physicsPoints,
        cumulativeLengths,
        segmentIndex,
        clampedDistance
    )
}

// Sample the deterministic rail inside one known segment while preserving exact projected progress.
export function sampleTrackRailAtSegmentDistance(
    physicsPoints: Vector3[],
    cumulativeLengths: number[],
    segmentIndex: number,
    targetDistance: number
): TrackRailSample | null {
    const a = physicsPoints[segmentIndex]
    const b = physicsPoints[segmentIndex + 1]
    const startDistance = cumulativeLengths[segmentIndex]
    const endDistance = cumulativeLengths[segmentIndex + 1]

    if (!a || !b || startDistance === undefined || endDistance === undefined) return null

    const segment = b.clone().sub(a)
    const segmentLength = segment.length()
    const tangent = segmentLength <= TRACK_EPSILON
        ? new Vector3(1, 0, 0)
        : segment.clone().normalize()

    const localDistance = clamp(targetDistance - startDistance, 0, Math.max(0, endDistance - startDistance))
    const segmentT = segmentLength <= TRACK_EPSILON
        ? 0
        : clamp(localDistance / segmentLength, 0, 1)

    return {
        point: a.clone().lerp(b, segmentT),
        tangent,
        segmentIndex,
        segmentT,
        distanceAlongTrack: startDistance + localDistance,
    }
}

function buildCumulativeLengths(points: Vector3[]) {
    const cumulativeLengths: number[] = []
    let total = 0

    for (let i = 0; i < points.length; i++) {
        if (i === 0) {
            cumulativeLengths.push(0)
            continue
        }

        total += points[i].distanceTo(points[i - 1])
        cumulativeLengths.push(total)
    }

    return cumulativeLengths
}

function pushUniquePoint(points: Vector3[], point: Vector3) {
    const lastPoint = points[points.length - 1]
    if (!lastPoint || lastPoint.distanceToSquared(point) > TRACK_EPSILON * TRACK_EPSILON) {
        points.push(point)
    }
}

function clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value))
}

// Smooth the stroke with a deterministic local corner-cutting pass while preserving endpoints.
function smoothTrackPoints(rawPoints: Vector3[], smoothingPasses: number) {
    if (rawPoints.length < 3 || smoothingPasses <= 0) {
        return rawPoints.map(point => point.clone())
    }

    let points = rawPoints.map(point => point.clone())

    for (let pass = 0; pass < smoothingPasses; pass++) {
        points = chaikinSmooth(points)
    }

    return points
}

// Use Chaikin subdivision for a smooth, local, deterministic path without global spline behavior.
function chaikinSmooth(points: Vector3[]) {
    if (points.length < 3) {
        return points.map(point => point.clone())
    }

    const smoothed: Vector3[] = [points[0].clone()]

    for (let i = 0; i < points.length - 1; i++) {
        const current = points[i]
        const next = points[i + 1]
        if (!current || !next) continue

        const q = current.clone().lerp(next, 0.25)
        const r = current.clone().lerp(next, 0.75)

        pushUniquePoint(smoothed, q)
        pushUniquePoint(smoothed, r)
    }

    pushUniquePoint(smoothed, points[points.length - 1].clone())
    return smoothed
}
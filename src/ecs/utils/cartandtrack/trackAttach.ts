import { Vector3 } from "three"
import { CTrack } from "../../components/cartandtrack/CTrack"

export const TRACK_ATTACH_EPSILON = 1e-6

export type TrackAttachCandidate = {
    trackId: number
    track: CTrack
    segmentIndex: number
    pointOnTrack: Vector3
    distanceSq: number
    endDistanceSq: number
    curveT: number
}

export function isBetterTrackAttachCandidate(
    candidate: TrackAttachCandidate,
    current: TrackAttachCandidate | null
): boolean {
    if (!current) return true
    if (candidate.distanceSq < current.distanceSq - TRACK_ATTACH_EPSILON) return true
    if (candidate.distanceSq > current.distanceSq + TRACK_ATTACH_EPSILON) return false

    if (candidate.endDistanceSq < current.endDistanceSq - TRACK_ATTACH_EPSILON) return true
    if (candidate.endDistanceSq > current.endDistanceSq + TRACK_ATTACH_EPSILON) return false

    if (candidate.trackId !== current.trackId) return candidate.trackId < current.trackId
    if (candidate.segmentIndex !== current.segmentIndex) return candidate.segmentIndex < current.segmentIndex

    return candidate.curveT < current.curveT
}

export function closestPointsBetweenSegments(
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

    if (a <= TRACK_ATTACH_EPSILON && e <= TRACK_ATTACH_EPSILON) {
        return {
            pointOnFirst: p1.clone(),
            pointOnSecond: q1.clone(),
            distanceSq: p1.distanceToSquared(q1),
            tFirst: 0,
            tSecond: 0,
        }
    }

    if (a <= TRACK_ATTACH_EPSILON) {
        s = 0
        t = clamp01(f / e)
    } else {
        const c = d1.dot(r)

        if (e <= TRACK_ATTACH_EPSILON) {
            t = 0
            s = clamp01(-c / a)
        } else {
            const b = d1.dot(d2)
            const denom = a * e - b * b

            if (Math.abs(denom) > TRACK_ATTACH_EPSILON) {
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

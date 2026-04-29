import { Vector3 } from "three";
import { CTrack } from "../components/cartandtrack/CTrack";
import type { World } from "../core/world";

export type TrackEndpoint = "start" | "end"

export type ConnectedTrackEndpoint = {
    trackId: number
    endpoint: TrackEndpoint
}

export function getTrackStartPoint(track: CTrack): Vector3 | null {
    return track.rawPoints[0]?.clone() ?? null
}

export function getTrackEndPoint(track: CTrack): Vector3 | null {
    return track.rawPoints[track.rawPoints.length - 1]?.clone() ?? null
}

export function findConnectedTrackEndpoint(
    world: World,
    trackId: number,
    endpoint: TrackEndpoint,
    maxDist: number
): ConnectedTrackEndpoint | null {
    const track = world.getComponent(trackId, CTrack)
    if (!track) return null

    const sourcePoint = endpoint === "start"
        ? getTrackStartPoint(track)
        : getTrackEndPoint(track)
    if (!sourcePoint) return null

    let match: ConnectedTrackEndpoint | null = null

    for (const [candidateTrackId, candidateTrack] of world.query1(CTrack)) {
        if (candidateTrackId === trackId || candidateTrack.rawPoints.length < 2) continue

        const endpoints: TrackEndpoint[] = ["start", "end"]
        for (const candidateEndpoint of endpoints) {
            const candidatePoint = candidateEndpoint === "start"
                ? getTrackStartPoint(candidateTrack)
                : getTrackEndPoint(candidateTrack)
            if (!candidatePoint) continue
            if (candidatePoint.distanceTo(sourcePoint) > maxDist) continue

            if (match !== null) {
                return null
            }

            match = {
                trackId: candidateTrackId,
                endpoint: candidateEndpoint,
            }
        }
    }

    return match
}

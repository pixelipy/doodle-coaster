import { BufferGeometry, CatmullRomCurve3, Vector3 } from "three"
import { System } from "../core/system"
import { RInput } from "../resources/RInput"
import { CTrack } from "../components/CTrack"
import { RRaycast } from "../resources/RRaycast"
import { RTrackManager } from "../resources/RTrackManager"
import { World } from "../core/world"
import { FTrack } from "../factories/trackFactory"

const MIN_DIST = 0.1
const SNAP_DIST = 0.1

export class SDrawTrack extends System {

    update(world: World, _deltaTime: number): void {
        const input = world.getResource(RInput)!
        const drawing = world.getResource(RTrackManager)!
        const raycast = world.getResource(RRaycast)!

        // Start drawing or extend an existing snapped endpoint.
        if (input.lmbPressed) {
            const mouse = raycast.hitPoint.clone()
            mouse.z = 0

            const snap = findClosestEndpoint(world, mouse, SNAP_DIST)

            if (snap) {
                drawing.currentTrackId = snap.trackId
                drawing.extendFromStart = snap.endpoint === "start"
            } else {
                const entity = FTrack(world)
                const track = world.getComponent(entity, CTrack)!
                track.rawPoints.push(mouse)
                drawing.currentTrackId = entity
                drawing.extendFromStart = false
            }
        }

        // 🔹 Stop drawing
        if (input.lmbReleased && drawing.currentTrackId !== null) {
            const track = world.getComponent(drawing.currentTrackId, CTrack)

            if (track && track.rawPoints.length < 2) {
                world.destroyEntity(drawing.currentTrackId)
            }

            drawing.currentTrackId = null
            drawing.extendFromStart = false
            return
        }

        // 🔹 Nothing to draw
        if (drawing.currentTrackId === null) return

        const track = world.getComponent(drawing.currentTrackId, CTrack)
        if (!track) return

        let dirty = false

        // 🔹 Add points
        if (input.lmbDown) {
            const p = raycast.hitPoint.clone()
            p.z = 0

            const anchor = drawing.extendFromStart
                ? track.rawPoints[0]
                : track.rawPoints[track.rawPoints.length - 1]

            if (!anchor || anchor.distanceTo(p) > MIN_DIST) {
                if (drawing.extendFromStart) {
                    track.rawPoints.unshift(p)
                } else {
                    track.rawPoints.push(p)
                }

                dirty = true
            }
        }

        // 🔹 Rebuild spline
        if (dirty && track.rawPoints.length >= 2) {
            track.curve = new CatmullRomCurve3(track.rawPoints)
            track.curveLength = track.curve.getLength()
            track.sampled = track.curve.getSpacedPoints(Math.min(200, track.rawPoints.length * 10))

            if (track.lineMesh) {
                track.lineMesh.geometry.dispose()
                track.lineMesh.geometry = new BufferGeometry().setFromPoints(track.sampled)
            }
        }
    }
}


// Helper: find closest track endpoint.
function findClosestEndpoint(
    world: World,
    p: Vector3,
    maxDist: number
): { trackId: number, endpoint: "start" | "end" } | null {

    let closestTrackId: number | null = null
    let closestEndpoint: "start" | "end" | null = null
    let minDist = maxDist

    for (const [trackId, track] of world.query1(CTrack)) {
        if (track.rawPoints.length < 2) continue

        const first = track.rawPoints[0]

        const last = track.rawPoints[track.rawPoints.length - 1]

        // check start
        const d1 = first.distanceTo(p)
        if (d1 < minDist) {
            minDist = d1
            closestTrackId = trackId
            closestEndpoint = "start"
        }

        // check end
        const d2 = last.distanceTo(p)
        if (d2 < minDist) {
            minDist = d2
            closestTrackId = trackId
            closestEndpoint = "end"
        }
    }

    if (closestTrackId === null || closestEndpoint === null) return null

    return {
        trackId: closestTrackId,
        endpoint: closestEndpoint
    }
}
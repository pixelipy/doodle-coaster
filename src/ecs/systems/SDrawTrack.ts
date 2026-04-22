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
const TANGENT_PUSH = 0.05

export class SDrawTrack extends System {

    update(world: World, _deltaTime: number): void {
        const input = world.getResource(RInput)!
        const drawing = world.getResource(RTrackManager)!
        const raycast = world.getResource(RRaycast)!

        // 🔹 Start new track
        if (input.lmbPressed) {
            const mouse = raycast.hitPoint.clone()
            mouse.z = 0

            const snap = findClosestEndpointWithTangent(world, mouse, SNAP_DIST)

            const entity = FTrack(world)
            const track = world.getComponent(entity, CTrack)!

            if (snap) {
                const { point, tangent } = snap

                // start exactly on endpoint
                track.rawPoints.push(point.clone())

                // push slightly along tangent so curve continues smoothly
                const next = point.clone().add(tangent.clone().multiplyScalar(TANGENT_PUSH))
                track.rawPoints.push(next)
            } else {
                track.rawPoints.push(mouse)
            }

            drawing.currentTrackId = entity
        }

        // 🔹 Stop drawing
        if (input.lmbReleased && drawing.currentTrackId !== null) {
            const track = world.getComponent(drawing.currentTrackId, CTrack)

            if (track && track.rawPoints.length < 2) {
                world.destroyEntity(drawing.currentTrackId)
            }

            drawing.currentTrackId = null
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

            const last = track.rawPoints[track.rawPoints.length - 1]

            if (!last || last.distanceTo(p) > MIN_DIST) {
                track.rawPoints.push(p)
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


// Helper: find closest endpoint + tangent
function findClosestEndpointWithTangent(
    world: World,
    p: Vector3,
    maxDist: number
): { point: Vector3, tangent: Vector3 } | null {

    let closestPoint: Vector3 | null = null
    let closestTangent: Vector3 | null = null
    let minDist = maxDist

    for (const [, track] of world.query1(CTrack)) {
        if (track.rawPoints.length < 2) continue

        const first = track.rawPoints[0]
        const second = track.rawPoints[1]

        const last = track.rawPoints[track.rawPoints.length - 1]
        const beforeLast = track.rawPoints[track.rawPoints.length - 2]

        // check start
        const d1 = first.distanceTo(p)
        if (d1 < minDist) {
            minDist = d1
            closestPoint = first
            closestTangent = first.clone().sub(second).normalize() // outward
        }

        // check end
        const d2 = last.distanceTo(p)
        if (d2 < minDist) {
            minDist = d2
            closestPoint = last
            closestTangent = last.clone().sub(beforeLast).normalize() // outward
        }
    }

    if (!closestPoint || !closestTangent) return null

    return {
        point: closestPoint,
        tangent: closestTangent
    }
}
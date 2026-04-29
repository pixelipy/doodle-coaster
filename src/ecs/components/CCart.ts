import { Vector3 } from "three"
import type { World } from "../core/world"
import { CJump, createJumpComponent } from "./CJump"
import { RSettings } from "../resources/RSettings"

export type CartAbilityId = "jump"

export class CCart {
    trackId: number | null = null
    lastTrackId: number | null = null
    t: number = 0 //0-1 along the track
    distanceAlongTrack: number = 0

    speed: number = 0.2 //units per second, along the track
    defaultSpeed: number = this.speed

    attached: boolean = false
    reattachCooldown: number = 0

    angularVelocity: number = 0 // for physics when detached, in radians per second. Positive is clockwise when looking in the direction of travel.
    prevTrackAngle: number | null = null // keeps track of angle on previous frame.
    lastBoostStationId: string | null = null
    goalReached: boolean = false

    spawnPosition: Vector3 = new Vector3()
    spawnRotation: Vector3 = new Vector3()
    velocity: Vector3 = new Vector3() //for physics when detached

    addAbility(world: World, entityId: number, abilityId: CartAbilityId) {
        if (abilityId === "jump") {
            if (world.hasComponent(entityId, CJump)) {
                return world.getComponent(entityId, CJump)!
            }

            const settings = world.getResource(RSettings)!
            return world.addComponent(entityId, createJumpComponent(settings))
        }

        throw new Error(`Unsupported cart ability "${abilityId}"`)
    }

    removeAbility(world: World, entityId: number, abilityId: CartAbilityId) {
        if (abilityId === "jump") {
            world.removeComponent(entityId, CJump)
            return
        }

        throw new Error(`Unsupported cart ability "${abilityId}"`)
    }
}

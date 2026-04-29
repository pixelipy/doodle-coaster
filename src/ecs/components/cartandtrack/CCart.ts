import type { World } from "../../core/world"
import { CJump, createJumpComponent } from "../CJump"
import { RSettings } from "../../resources/RSettings"

export type CartAbilityId = "jump"

export class CCart {
    goalReached: boolean = false

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

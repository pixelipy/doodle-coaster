import { CCart } from "../../components/cartandtrack/CCart"
import { CCartMotion } from "../../components/cartandtrack/CCartMotion"
import { CCartOrientation } from "../../components/cartandtrack/CCartOrientation"
import { CCartSpawnState } from "../../components/cartandtrack/CCartSpawnState"
import { CJump } from "../../components/abilities/CJump"
import { CTrackAttachment } from "../../components/cartandtrack/CTrackAttachment"
import { CPosition, CRotation } from "../../components/CTransform"
import { CVelocity } from "../../components/CVelocity"
import { System } from "../../core/system"
import { World } from "../../core/world"
import { RLevel } from "../../resources/RLevel"
import { ESimulationState, RSimulationState } from "../../resources/RSimulationState"
import { RTime } from "../../resources/RTime"
import { SJump } from "../abilities/SJump"

export class SCartLifecycle extends System {
    private beginInterpolatedStep(pos: CPosition, rotation?: CRotation) {
        pos.previousPosition.copy(pos.position)

        if (rotation) {
            rotation.previousRotation.copy(rotation.rotation)
        }
    }

    private resetCart(
        world: World,
        entity: number,
        cart: CCart,
        spawn: CCartSpawnState,
        motion: CCartMotion,
        attachment: CTrackAttachment,
        orientation: CCartOrientation,
        pos: CPosition,
        vel: CVelocity
    ) {
        pos.position.copy(spawn.spawnPosition)
        pos.previousPosition.copy(spawn.spawnPosition)
        pos.dirty = true

        vel.velocity.set(0, 0, 0)

        const rotation = world.getComponent(entity, CRotation)
        if (rotation) {
            rotation.rotation.copy(spawn.spawnRotation)
            rotation.previousRotation.copy(spawn.spawnRotation)
            rotation.dirty = true
        }

        attachment.attached = false
        attachment.trackId = null
        attachment.lastTrackId = null
        attachment.t = 0
        attachment.distanceAlongTrack = 0
        attachment.reattachCooldown = 0

        motion.speed = motion.defaultSpeed
        motion.lastBoostStationId = null

        orientation.angularVelocity = 0
        orientation.prevTrackAngle = null

        cart.goalReached = false

        const jump = world.getComponent(entity, CJump)
        if (jump) {
            SJump.resetState(jump)
        }
    }

    update(world: World, _deltaTime: number): void {
        const sim = world.getResource(RSimulationState)!
        const time = world.getResource(RTime)!
        const level = world.getResource(RLevel)

        if (sim.state === ESimulationState.DrawingTrack) {
            if (level) {
                level.completed = false
            }

            for (const [entity, cart, spawn, motion, attachment, orientation, pos, vel] of world.query(
                CCart,
                CCartSpawnState,
                CCartMotion,
                CTrackAttachment,
                CCartOrientation,
                CPosition,
                CVelocity
            )) {
                this.resetCart(world, entity, cart, spawn, motion, attachment, orientation, pos, vel)
            }

            return
        }

        if (time.pendingFixedSteps <= 0) return

        for (let step = 0; step < time.pendingFixedSteps; step++) {
            for (const [entity, cart, orientation, pos, vel] of world.query(
                CCart,
                CCartOrientation,
                CPosition,
                CVelocity
            )) {
                const rotation = world.getComponent(entity, CRotation)
                this.beginInterpolatedStep(pos, rotation)

                if (cart.goalReached || level?.completed) {
                    vel.velocity.set(0, 0, 0)
                    orientation.angularVelocity = 0
                }
            }
        }
    }
}

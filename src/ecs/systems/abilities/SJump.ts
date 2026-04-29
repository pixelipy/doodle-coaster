import { Vector3 } from "three"
import { CCart } from "../../components/cartandtrack/CCart"
import { CCartMotion } from "../../components/cartandtrack/CCartMotion"
import { CCartOrientation } from "../../components/cartandtrack/CCartOrientation"
import { CJump } from "../../components/abilities/CJump"
import { CTrackAttachment } from "../../components/cartandtrack/CTrackAttachment"
import { CVelocity } from "../../components/CVelocity"
import { System } from "../../core/system"
import type { World } from "../../core/world"
import { RInput } from "../../resources/RInput"
import { RLevel } from "../../resources/RLevel"
import { ESimulationState, RSimulationState } from "../../resources/RSimulationState"
import { RSettings } from "../../resources/RSettings"
import { RTime } from "../../resources/RTime"

let GRAVITY = 3
let REATTACH_COOLDOWN = 0.3
let JUMP_BLEND_FACTOR = 0.25
let JUMP_LAUNCH_MODE: "up" | "blended" = "up"

const ROTATION_EPSILON = 0.0001

export class SJump extends System {
    init(world: World): void {
        const settings = world.getResource(RSettings)!

        GRAVITY = settings.physics.GRAVITY
        REATTACH_COOLDOWN = settings.cart.REATTACH_COOLDOWN
        JUMP_BLEND_FACTOR = settings.cart.JUMP_BLEND_FACTOR
        JUMP_LAUNCH_MODE = settings.cart.JUMP_LAUNCH_MODE
    }

    static resetState(jump: CJump) {
        jump.jumpBufferTimer = 0
        jump.coyoteTimer = 0
        jump.lastGroundTangent.set(1, 0, 0)
    }

    static markGrounded(jump: CJump, tangent: Vector3) {
        jump.lastGroundTangent.copy(tangent)
        jump.coyoteTimer = jump.coyoteTime
    }

    static markDetached(jump: CJump | undefined, coyoteTangent?: Vector3) {
        if (!jump) return

        if (coyoteTangent) {
            jump.lastGroundTangent.copy(coyoteTangent)
            jump.coyoteTimer = jump.coyoteTime
            return
        }

        jump.coyoteTimer = 0
    }

    static tryConsumeQueuedTrackJump(
        attachment: CTrackAttachment,
        motion: CCartMotion,
        orientation: CCartOrientation,
        jump: CJump,
        vel: CVelocity,
        tangent: Vector3
    ) {
        if (jump.jumpBufferTimer <= 0) return false

        const carryVelocity = tangent.clone().multiplyScalar(motion.speed)
        const jumpImpulseVelocity = this.resolveJumpImpulseDirection(tangent).multiplyScalar(jump.jumpPower)
        const releaseVelocity = carryVelocity.add(jumpImpulseVelocity)

        vel.velocity.copy(releaseVelocity)
        attachment.attached = false
        attachment.lastTrackId = attachment.trackId
        attachment.trackId = null
        attachment.reattachCooldown = REATTACH_COOLDOWN
        orientation.angularVelocity = 0
        jump.jumpBufferTimer = 0
        jump.coyoteTimer = 0
        return true
    }

    static tryConsumeQueuedCoyoteJump(
        orientation: CCartOrientation,
        jump: CJump,
        vel: CVelocity
    ) {
        if (jump.jumpBufferTimer <= 0 || jump.coyoteTimer <= 0) return false

        const jumpImpulseVelocity = this.resolveJumpImpulseDirection(jump.lastGroundTangent)
            .multiplyScalar(jump.jumpPower)

        vel.velocity.add(jumpImpulseVelocity)
        orientation.angularVelocity = 0
        jump.jumpBufferTimer = 0
        jump.coyoteTimer = 0
        return true
    }

    private static resolveJumpNormal(tangent: Vector3) {
        const normal = new Vector3(-tangent.y, tangent.x, 0)
        if (normal.lengthSq() <= ROTATION_EPSILON) {
            return new Vector3(0, 1, 0)
        }

        normal.normalize()
        if (normal.y < 0) {
            normal.multiplyScalar(-1)
        }

        return normal
    }

    private static resolveJumpImpulseDirection(tangent: Vector3) {
        if (JUMP_LAUNCH_MODE === "up") {
            return new Vector3(0, 1, 0)
        }

        const jumpNormal = this.resolveJumpNormal(tangent)
        const blendedDirection = new Vector3(0, 1, 0).lerp(jumpNormal, JUMP_BLEND_FACTOR)
        if (blendedDirection.lengthSq() <= ROTATION_EPSILON) {
            return new Vector3(0, 1, 0)
        }

        return blendedDirection.normalize()
    }

    private queueBufferedJump(jump: CJump) {
        jump.jumpBufferTimer = Math.max(jump.jumpBufferTimer, jump.jumpBufferingTime)
    }

    private tickJumpTimers(jump: CJump, dt: number) {
        jump.jumpBufferTimer = Math.max(0, jump.jumpBufferTimer - dt)
        jump.coyoteTimer = Math.max(0, jump.coyoteTimer - dt)
    }

    private isJumpHeld(input: RInput, jump: CJump) {
        return input.keysDown.has(jump.keyboardInput) || input.actionsDown.has(jump.touchActionInput)
    }

    private shouldQueueJump(input: RInput, jump: CJump) {
        return input.keysPressedBuffered.has(jump.keyboardInput) || input.actionsPressedBuffered.has(jump.touchActionInput)
    }

    private applyMidairGravity(attachment: CTrackAttachment, jump: CJump, vel: CVelocity, input: RInput, dt: number) {
        if (attachment.attached) return

        let gravityModifier = 1

        if (vel.velocity.y > 0 && !this.isJumpHeld(input, jump)) {
            gravityModifier = jump.jumpEarlyGravityModifier
        } else if (Math.abs(vel.velocity.y) <= jump.apexVerticalSpeedWindow) {
            gravityModifier = jump.apexGravityModifier
        }

        vel.velocity.y -= GRAVITY * gravityModifier * dt
    }

    update(world: World, _deltaTime: number): void {
        const sim = world.getResource(RSimulationState)!
        const time = world.getResource(RTime)!
        const level = world.getResource(RLevel)
        const input = world.getResource(RInput)!

        if (sim.state === ESimulationState.DrawingTrack) {
            return
        }

        if (time.pendingFixedSteps <= 0) return

        const consumedKeys = new Set<string>()
        const consumedActions = new Set<string>()

        for (const [_entityId, _cart, jump] of world.query2(CCart, CJump)) {
            if (this.shouldQueueJump(input, jump)) {
                this.queueBufferedJump(jump)
                consumedKeys.add(jump.keyboardInput)
                consumedActions.add(jump.touchActionInput)
            }
        }

        for (const key of consumedKeys) {
            input.keysPressedBuffered.delete(key)
        }

        for (const actionId of consumedActions) {
            input.actionsPressedBuffered.delete(actionId)
        }

        for (let step = 0; step < time.pendingFixedSteps; step++) {
            const dt = time.fixedTimestep

            for (const [_entityId, cart, motion, attachment, orientation, jump, vel] of world.query(
                CCart,
                CCartMotion,
                CTrackAttachment,
                CCartOrientation,
                CJump,
                CVelocity
            )) {
                if (cart.goalReached || level?.completed) {
                    continue
                }

                this.tickJumpTimers(jump, dt)

                if (attachment.attached) {
                    SJump.tryConsumeQueuedTrackJump(attachment, motion, orientation, jump, vel, jump.lastGroundTangent)
                    continue
                }

                SJump.tryConsumeQueuedCoyoteJump(orientation, jump, vel)
                this.applyMidairGravity(attachment, jump, vel, input, dt)
            }
        }
    }
}

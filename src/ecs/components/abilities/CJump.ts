import { Vector3 } from "three"
import { RSettings } from "../../resources/RSettings"
import { Component } from "../../core/component"

export class CJump extends Component {
    jumpPower: number = 0
    jumpEarlyGravityModifier: number = 1
    apexGravityModifier: number = 1
    apexVerticalSpeedWindow: number = 0
    coyoteTime: number = 0
    jumpBufferingTime: number = 0
    keyboardInput: string = " "
    touchActionInput: string = "screenTap"

    jumpBufferTimer: number = 0
    coyoteTimer: number = 0
    lastGroundTangent: Vector3 = new Vector3(1, 0, 0)
}

export function createJumpComponent(settings: RSettings) {
    const jump = new CJump()

    jump.jumpPower = settings.cart.JUMP_BOOST
    jump.jumpEarlyGravityModifier = settings.cart.JUMP_EARLY_GRAVITY_MODIFIER
    jump.apexGravityModifier = settings.cart.APEX_GRAVITY_MODIFIER
    jump.apexVerticalSpeedWindow = settings.cart.APEX_VERTICAL_SPEED_WINDOW
    jump.coyoteTime = settings.cart.COYOTE_TIME
    jump.jumpBufferingTime = settings.cart.JUMP_BUFFER_TIME
    jump.keyboardInput = " "
    jump.touchActionInput = "screenTap"

    return jump
}

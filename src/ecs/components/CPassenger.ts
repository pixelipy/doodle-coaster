import { Vector3 } from "three";
import { Component } from "../core/component";

export class CPassenger extends Component {

    cartId: number | null = null
    attached: boolean = false

    offset: Vector3 = new Vector3(0, 0, 0) // position relative to cart

    prevCartVy: number = 0 // last frame cart vertical velocity
    airtimeCooldown: number = 0 // prevents instant eject after attach
    airtimeTimer: number = 0

    constructor(cartId: number | null = null) {
        super()

        this.cartId = cartId
        this.attached = cartId !== null
    }
}
import { Vector3 } from "three";
import { Component } from "../core/component";

export class CPassenger extends Component {

    cartId: number | null = null
    homeCartId: number | null = null
    attached: boolean = false

    offset: Vector3 = new Vector3(0, 0, 0) // position relative to cart
    spawnPosition: Vector3 = new Vector3(0, 0, 0)

    airtimeCooldown: number = 0 // prevents instant eject after attach
    airtimeTimer: number = 0
    weight: number = 1; // relative passenger weight. Affects how fast it falls.

    constructor(cartId: number | null = null) {
        super()

        this.cartId = cartId
        this.attached = cartId !== null
    }
}
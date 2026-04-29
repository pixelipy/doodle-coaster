import { Component } from "../../core/component"

export class CCartMotion extends Component {
    speed: number = 0.2
    defaultSpeed: number = this.speed
    lastBoostStationId: string | null = null
}

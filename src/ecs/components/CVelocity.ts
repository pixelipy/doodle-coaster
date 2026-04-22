import { Vector3 } from "three";
import { Component } from "../core/component";

export class CVelocity extends Component {
    velocity: Vector3 = new Vector3(0, 0, 0);

    constructor({velocity}: {velocity?: Vector3} = {}) {
        super();
        if (velocity) this.velocity.copy(velocity);
    }
}
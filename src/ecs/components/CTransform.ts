import { Vector3 } from "three";
import { Component } from "../core/component";

export class CPosition extends Component {
    position: Vector3 = new Vector3(0, 0, 0);
    previousPosition: Vector3 = new Vector3(0, 0, 0);
    dirty: boolean = false;

    constructor({ position }: { position?: Vector3 } = {}) {
        super();
        if (position) {
            this.position.copy(position);
            this.previousPosition.copy(position);
        }
    }
}

export class CRotation extends Component {
    rotation: Vector3 = new Vector3(0, 0, 0);
    previousRotation: Vector3 = new Vector3(0, 0, 0);
    dirty: boolean = false;

    constructor({ rotation }: { rotation?: Vector3 } = {}) {
        super();
        if (rotation) {
            this.rotation.copy(rotation);
            this.previousRotation.copy(rotation);
        }
    }
}

export class CScale extends Component {
    scale: Vector3 = new Vector3(1, 1, 1);
    dirty: boolean = false;

    constructor({ scale }: { scale?: Vector3 } = {}) {
        super();
        if (scale) this.scale.copy(scale);
    }
}
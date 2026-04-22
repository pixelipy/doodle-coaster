import type { Object3D } from "three";
import { Component } from "../core/component";

export class CObject3D extends Component {
    object3D: Object3D;
    mesh: Object3D | undefined;

    constructor(object3D: Object3D, mesh?: Object3D) {
        super();
        this.object3D = object3D;
        this.mesh = mesh;
    }
}
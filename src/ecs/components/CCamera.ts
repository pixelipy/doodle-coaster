import { PerspectiveCamera, Vector3 } from "three";
import { Component } from "../core/component";

export class CCamera extends Component {
    
    targetId: number;
    smoothness: number;
    offset: number;
    cameraObject: PerspectiveCamera; // This will hold the actual Three.js camera object
    rotation: Vector3; 

    constructor(targetId: number, camera: PerspectiveCamera, {smoothness = 5, offset = -60, rotation = new Vector3(-Math.PI/4, Math.PI/8, 0)} : {smoothness?: number, offset?: number, rotation?: Vector3} = {}) {
        super();
        this.targetId = targetId;
        this.cameraObject = camera;
        this.smoothness = smoothness;
        this.offset = offset;
        this.rotation = rotation;
    }
}
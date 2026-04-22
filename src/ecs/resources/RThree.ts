//class to setup a three.js scene, camera, and renderer

import { WebGLRenderer, Scene, PerspectiveCamera, DirectionalLight, AmbientLight } from "three";

export class RThree{
    scene: Scene
    renderer: WebGLRenderer
    camera: PerspectiveCamera

    constructor(){
        this.scene = new Scene();
        this.renderer = new WebGLRenderer({antialias: true, canvas: document.getElementById("game") as HTMLCanvasElement});
        this.camera = new PerspectiveCamera(10, window.innerWidth / window.innerHeight, 0.1, 100);
        this.camera.position.z = 5
    
        const ambientLight = new AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        const directionalLight = new DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(10, 20, 10);
        this.scene.add(directionalLight);
    
    
    }
}
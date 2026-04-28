//class to setup a three.js scene, camera, and renderer

import { WebGLRenderer, Scene, PerspectiveCamera, Color, AgXToneMapping} from "three";

export class RThree{
    scene: Scene
    renderer: WebGLRenderer
    camera: PerspectiveCamera

    constructor(){
        this.scene = new Scene();
        this.renderer = new WebGLRenderer({antialias: true, canvas: document.getElementById("game") as HTMLCanvasElement});
        this.camera = new PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
        this.camera.position.z = 5

        //this.renderer.outputColorSpace = SRGBColorSpace;
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.toneMapping = AgXToneMapping;
        this.renderer.toneMappingExposure = 1.2;

        this.scene.background = new Color(0x1D2B53); // Dark blue background
    }
}
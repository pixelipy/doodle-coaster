import { Component } from "../core/component";
import { AnimationPlayer } from "../utils/animationPlayer";
import type { AnimatedObject3D } from "../resources/RAssetManager";

export class CAnimation extends Component {
    animationPlayer: AnimationPlayer;

    constructor(model: AnimatedObject3D){
        super();
        this.animationPlayer = new AnimationPlayer(model);
    }
}

import { AnimationMixer } from "three";
import type { AnimatedObject3D } from "../resources/RAssetManager";

class AnimationPlayer {
    mixer: AnimationMixer
    object: AnimatedObject3D
    constructor(model: AnimatedObject3D) {
        this.mixer = new AnimationMixer(model);
        this.object = model;
    }

    playAnimation(name: string, {staticAnim = false, startTime = 0} : {staticAnim?: boolean, startTime?: number} = {}) {
        const clip = this.object.animations.find((animation) => animation.name === name);

        if (clip) {
            const action = this.mixer.clipAction(clip);
            action.reset();
            action.play();
            
            if (staticAnim) {
                action.time = startTime;
                this.mixer.update(0);
                action.paused = true;
            }
        }
    }
}

export { AnimationPlayer };

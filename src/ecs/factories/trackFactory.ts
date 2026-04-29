import { Group } from "three";
import { CTrack } from "../components/cartandtrack/CTrack";
import { World } from "../core/world";
import { RThree } from "../resources/RThree";
import { Factory } from "../core/factory";
import { destroyTrackRender } from "../utils/cartandtrack/trackVisuals";

export class FTrack extends Factory {

    init(world: World): number {
        const three = world.getResource(RThree)!;
        const scene = three.scene;
        const renderRoot = new Group();
        scene.add(renderRoot);

        const trackId = world.createEntity();
        world.addComponent(trackId, new CTrack());

        const track = world.getComponent(trackId, CTrack)!;
        track.setRenderRoot(renderRoot);

        this.id = trackId

        return trackId;
    }

    static destroy(world: World, entityId: number) {
        const track = world.getComponent(entityId, CTrack)
        if (!track) return

        destroyTrackRender(track)
    }
}

import { BufferGeometry, Line, LineBasicMaterial } from "three";
import { CTrack } from "../components/CTrack";
import { World } from "../core/world";
import { RThree } from "../resources/RThree";
import { Factory } from "../core/factory";

export class FTrack extends Factory {

    init(world: World): number {
        const three = world.getResource(RThree)!;
        const scene = three.scene;
        const line = new Line(new BufferGeometry(), new LineBasicMaterial({ color: 0xff0000 }));
        scene.add(line);

        const trackId = world.createEntity();
        world.addComponent(trackId, new CTrack());

        const track = world.getComponent(trackId, CTrack)!;
        track.setLineMesh(line);

        this.id = trackId

        return trackId;
    }

    static destroy(world: World, entityId: number) {
        const track = world.getComponent(entityId, CTrack)
        console.log("destroying track", entityId, track)

        if (track?.lineMesh) {

            const mesh = track.lineMesh

            // 1. remove from scene
            mesh.parent?.remove(mesh)

            // 2. dispose geometry
            mesh.geometry.dispose()

            // 3. dispose material
            if (Array.isArray(mesh.material)) {
                mesh.material.forEach(m => m.dispose())
            } else {
                mesh.material.dispose()
            }
        }
    }
}
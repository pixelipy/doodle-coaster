import { BufferGeometry, Line, LineBasicMaterial } from "three";
import { CTrack } from "../components/CTrack";
import { World } from "../core/world";
import { RThree } from "../resources/RThree";

export function FTrack(world: World): number {
    const three = world.getResource(RThree)!;
    const scene = three.scene;
    const line = new Line(new BufferGeometry(), new LineBasicMaterial({ color: 0xff0000 }));
    scene.add(line);

    const trackId = world.createEntity();
    world.addComponent(trackId, new CTrack());

    const track = world.getComponent(trackId, CTrack)!;
    track.setLineMesh(line);

    return trackId;
}
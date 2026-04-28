import { World } from './ecs/core/world';
import './style.css'

//three
import { GridHelper } from 'three';
import { Vector3 } from 'three/src/math/Vector3.js';

//resources
import { RThree } from './ecs/resources/RThree';
import { RTime } from './ecs/resources/RTime';
import { RWindow } from './ecs/resources/RWindow';
import { RAssetManager } from './ecs/resources/RAssetManager';
import { RInput } from './ecs/resources/RInput';
import { RGrid } from './ecs/resources/RGrid';
import { RTrackManager } from './ecs/resources/RTrackManager';
import { RSimulationState } from './ecs/resources/RSimulationState';
import { RRng } from './ecs/resources/RRng';
import { RSettings } from './ecs/resources/RSettings';
import { RRaycast } from './ecs/resources/RRaycast';
import { RLevel } from './ecs/resources/RLevel';
import { RUI } from './ecs/resources/RUI';
import { RTrackProfiles } from './ecs/resources/RTrackProfiles';
import { RTrackVisualCache } from './ecs/resources/RTrackVisualCache';

//factories
import { FCamera } from './ecs/factories/cameraFactory';

//systems
import { STransformSync } from './ecs/systems/STransformSync';
import { SInputReset } from './ecs/systems/SInputReset';
import { SInputInit } from './ecs/systems/SInputInit';
import { STime } from './ecs/systems/STime';
import { SRender } from './ecs/systems/SRender';
import { SRaycastPlane } from './ecs/systems/SRaycastPlane';
import { SDrawTrack } from './ecs/systems/SDrawTrack';
import { SCart } from './ecs/systems/SCart';
import { SUpdateSimulation } from './ecs/systems/SUpdateSimulation';
import { SPassenger } from './ecs/systems/SPassenger';
import { SCameraController } from './ecs/systems/SCameraController';

//utils
import { loadLevelDefinition, spawnLevel } from './ecs/utils/levelLoader';
import { loadRailProfileCollection } from './ecs/utils/railProfileLoader';
import { SUI } from './ecs/systems/SUI';
import { REvents } from './ecs/resources/REvents';
import { RDebugger } from './ecs/resources/RDebugger';
import { SDebugger } from './ecs/systems/SDebugger';

const world = new World();
const three = new RThree();

const grid = new GridHelper(200, 200 / 4);
grid.position.add(new Vector3(0.2, -15, 0.0)); // Slightly lower the grid to prevent z-fighting with the player
three.scene.add(grid);

const assetManager = new RAssetManager();
await assetManager.loadAll({
    models: [
    //carts
    //carts
    {
        key: 'cart-classic',
        url: '/assets/models/carts/classic.glb'
    },
    {
        key: 'separator-classic',
        url: '/assets/models/rail-separators/classic.glb'
    },
    ], textures: [
        {
            key: 'gradientMap',
            url: '/assets/textures/gradientMap.png'
        }
    ]
});

const trackProfiles = new RTrackProfiles();
trackProfiles.loadCollection(await loadRailProfileCollection('/rail-profiles/profiles.json'));

//Initilize Resources
world.addResource(new RDebugger());
world.addResource(new REvents());
world.addResource(new RSettings());
world.addResource(three);
world.addResource(assetManager);
world.addResource(new RRng());
world.addResource(new RTrackManager());
world.addResource(new RGrid({ cellSize: 1.5 }));
world.addResource(new RTime());
world.addResource(new RWindow());
world.addResource(new RInput());
world.addResource(new RRaycast());
world.addResource(new RSimulationState());
world.addResource(new RLevel());
world.addResource(new RUI());
world.addResource(trackProfiles);
world.addResource(new RTrackVisualCache());

//initialize entities
const levelDefinition = await loadLevelDefinition('/levels/level-001.json');
const { cartId } = spawnLevel(world, levelDefinition);

//creates camera component
FCamera(world, cartId);

//systems
world.addSystem(new SInputInit());
world.addSystem(new SUI());
world.addSystem(new SUpdateSimulation())
world.addSystem(new SRaycastPlane());
world.addSystem(new STime());
world.addSystem(new SCart());
world.addSystem(new SPassenger());
world.addSystem(new SCameraController());
world.addSystem(new STransformSync());
world.addSystem(new SDrawTrack());
world.addSystem(new SDebugger());
world.addSystem(new SRender());
world.addSystem(new SInputReset());

let lastTime = performance.now();

function gameloop() {
    const now = performance.now();
    const deltaTime = (now - lastTime) / 1000;
    lastTime = now;
    world.update(deltaTime);
    requestAnimationFrame(gameloop);
}

gameloop();

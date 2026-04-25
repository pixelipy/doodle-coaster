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

//factories

//systems
import { STransformSync } from './ecs/systems/STransformSync';
import { SInputReset } from './ecs/systems/SInputReset';
import { SInputInit } from './ecs/systems/SInputInit';
import { STime } from './ecs/systems/STime';
import { SRender } from './ecs/systems/SRender';
import { RRaycast } from './ecs/resources/RRaycast';
import { SRaycastPlane } from './ecs/systems/SRaycastPlane';
import { SDrawTrack } from './ecs/systems/SDrawTrack';
import { RTrackManager } from './ecs/resources/RTrackManager';
import { SCart } from './ecs/systems/SCart';
import { RSimulationState } from './ecs/resources/RSimulationState';
import { SUpdateSimulation } from './ecs/systems/SUpdateSimulation';
import { SPassenger } from './ecs/systems/SPassenger';
import { SCameraController } from './ecs/systems/SCameraController';
import { FCamera } from './ecs/factories/cameraFactory';
import { RRng } from './ecs/resources/RRng';
import { RSettings } from './ecs/resources/RSettings';
import { RLevel } from './ecs/resources/RLevel';
import { loadLevelDefinition, spawnLevel } from './ecs/utils/levelLoader';

const world = new World();
const three = new RThree();

const grid = new GridHelper(200, 200 / 4);
grid.position.add(new Vector3(0.2, -15, 0.0)); // Slightly lower the grid to prevent z-fighting with the player
three.scene.add(grid);

const assetManager = new RAssetManager();
await assetManager.loadAll({
    models: [{
        key: 'player',
        url: '/assets/models/animals/animal-cow.glb'
    }]
});

//Initilize Resources
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

//initialize entities
const levelDefinition = await loadLevelDefinition('/levels/level-001.json');
const { cartId } = spawnLevel(world, levelDefinition);

//creates camera component
FCamera(world, cartId);

//systems
world.addSystem(new SInputInit());
world.addSystem(new SUpdateSimulation())
world.addSystem(new SRaycastPlane());
world.addSystem(new STime());
world.addSystem(new SCart());
world.addSystem(new SPassenger());
world.addSystem(new STransformSync());
world.addSystem(new SCameraController());
world.addSystem(new SDrawTrack());
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

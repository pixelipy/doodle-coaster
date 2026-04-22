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
import { RPlayerSettings } from './ecs/resources/RPlayerSettings';
import { RGrid } from './ecs/resources/RGrid';

//factories

//systems
import { STransformSync } from './ecs/systems/STransformSync';
import { SInputReset } from './ecs/systems/SInputReset';
import { SInputInit } from './ecs/systems/SInputInit';
import { SMovement } from './ecs/systems/SMovement';
import { STime } from './ecs/systems/STime';
import { SRender } from './ecs/systems/SRender';

const world = new World();
const three = new RThree();

const grid = new GridHelper(100, 100/1.5);
grid.position.add(new Vector3(0.2, -0.5, 0.0)); // Slightly lower the grid to prevent z-fighting with the player
three.scene.add(grid);

const assetManager = new RAssetManager();
await assetManager.loadAll({
    models: [{
        key: 'player',
        url: '/assets/models/animals/animal-cow.glb'
    }]
});

//Initilize Resources
world.addResource(three);
world.addResource(assetManager);
world.addResource(new RPlayerSettings());
world.addResource(new RGrid({ cellSize: 1.5 }));
world.addResource(new RTime());
world.addResource(new RWindow());
world.addResource(new RInput());

//initialize entities

//systems
world.addSystem(new SInputInit());
world.addSystem(new STime());
world.addSystem(new SMovement());
world.addSystem(new STransformSync());
world.addSystem(new SRender());
world.addSystem(new SInputReset());

let lastTime = performance.now();

function gameloop() {
    const deltaTime = (performance.now() - lastTime) / 1000;
    lastTime = performance.now();
    world.update(deltaTime);
    requestAnimationFrame(gameloop);
}

gameloop();
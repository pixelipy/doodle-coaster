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
import { STime } from './ecs/systems/STime';
import { SRender } from './ecs/systems/SRender';
import { RRaycast } from './ecs/resources/RRaycast';
import { SRaycastPlane } from './ecs/systems/SRaycastPlane';
import { SDrawTrack } from './ecs/systems/SDrawTrack';
import { RTrackManager } from './ecs/resources/RTrackManager';
import { SCart } from './ecs/systems/SCart';
import { FCart } from './ecs/factories/cartFactory';
import { RSimulationState } from './ecs/resources/RSimulationState';
import { SUpdateSimulation } from './ecs/systems/SUpdateSimulation';
import { CPosition, CRotation } from './ecs/components/CTransform';
import { CCart } from './ecs/components/CCart';
import { FPassenger } from './ecs/factories/passengerFactory';
import { CPassenger } from './ecs/components/CPassenger';
import { SPassenger } from './ecs/systems/SPassenger';
import { CVelocity } from './ecs/components/CVelocity';
import { SCameraController } from './ecs/systems/SCameraController';
import { FCamera } from './ecs/factories/cameraFactory';

const world = new World();
const three = new RThree();

const grid = new GridHelper(100, 100 / 1.5);
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
world.addResource(new RTrackManager());
world.addResource(new RPlayerSettings());
world.addResource(new RGrid({ cellSize: 1.5 }));
world.addResource(new RTime());
world.addResource(new RWindow());
world.addResource(new RInput());
world.addResource(new RRaycast());
world.addResource(new RSimulationState());

//initialize entities
//FTrack(world);
const cartId = FCart(world);

const cartPos = world.getComponent(cartId, CPosition)!;
cartPos.position.set(0, 0, 0.0);
const cart = world.getComponent(cartId, CCart)!;
cart.spawnPosition.copy(cartPos.position);

const cartRotation = world.getComponent(cartId, CRotation)!;
cart.spawnRotation.copy(cartRotation.rotation);

// number of passengers
const count = 4 // try 4 (2x2), 9 (3x3), etc.
const size = Math.ceil(Math.sqrt(count)) // grid size

const spacing = 0.12
const height = 0.15

for (let i = 0; i < count; i++) {

    const x = i % size
    const z = Math.floor(i / size)

    // center the grid
    const offsetX = (x - (size - 1) / 2) * spacing
    const offsetZ = (z - (size - 1) / 2) * spacing

    const offset = new Vector3(offsetX, height, offsetZ)

    // 🔴 IMPORTANT: spawn already at correct position
    const spawnPos = cartPos.position.clone().add(offset)

    const p = FPassenger(world, spawnPos)
    const passenger = world.getComponent(p, CPassenger)!

    passenger.offset.copy(offset)
    passenger.spawnPosition.copy(spawnPos)
    passenger.attached = true
    passenger.cartId = cartId
    passenger.homeCartId = cartId
    passenger.airtimeCooldown = 0.3
    passenger.weight = 1 + (Math.random() - 0.5) * 0.05; // random weight for fun

    const vel = world.getComponent(p, CVelocity)!
    const cartVel = world.getComponent(cartId, CVelocity)!

    vel.velocity.copy(cartVel.velocity)
}

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
    const deltaTime = (performance.now() - lastTime) / 1000;
    lastTime = performance.now();
    world.update(deltaTime);
    requestAnimationFrame(gameloop);
}

gameloop();
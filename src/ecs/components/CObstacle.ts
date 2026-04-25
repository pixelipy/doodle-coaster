import { Component } from "../core/component";

export class CObstacle extends Component {
    obstacleId: string;
    radius: number;

    constructor(obstacleId: string, radius: number) {
        super();
        this.obstacleId = obstacleId;
        this.radius = radius;
    }
}

export class RPlayerSettings {
    // This resource can store player settings such as controls, preferences, etc.
    // For now, it's just an empty class, but you can expand it as needed

    speed: number;
    acceleration: number;

    constructor({ speed = 5, acceleration = 10 }: { speed?: number, acceleration?: number } = {}) {
        this.speed = speed;
        this.acceleration = acceleration;
    }
}
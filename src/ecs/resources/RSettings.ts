export class RSettings {
    camera: {
        PAN_SPEED: number,
        DEFAULT_Z_VALUE_DESKTOP: number,
        DEFAULT_X_VALUE_DESKTOP: number,
        DEFAULT_Y_VALUE_DESKTOP: number,
        DRAWING_Z_VALUE_DESKTOP: number,
        DEFAULT_Z_VALUE_MOBILE: number,
        DEFAULT_X_VALUE_MOBILE: number,
        DEFAULT_Y_VALUE_MOBILE: number,
        DRAWING_Z_VALUE_MOBILE: number,
        ZOOM_SPEED: number,
        MOBILE_PAN_SPEED: number,
        MOBILE_ZOOM_SPEED: number,
        MIN_ZOOM_DESKTOP: number,
        MAX_ZOOM_DESKTOP: number,
        MIN_ZOOM_MOBILE: number,
        MAX_ZOOM_MOBILE: number,
    }
    
    
    physics: {
        GRAVITY: number,
    }

    track: {
        SAMPLE_DISTANCE: number,
        SNAP_TO_POINT_DISTANCE: number,
        ERASER_RADIUS: number,
        ALLOW_SELF_JOINS: boolean,
        PHYSICS_POINT_SPACING: number,
        RAIL_SMOOTHING_PASSES: number,
    }

    cart: {
        MAX_SPEED: number,
        ATTACH_DIST: number,
        REATTACH_COOLDOWN: number,
        JUMP_BOOST: number,
        JUMP_BUFFER_TIME: number,
        COYOTE_TIME: number,
        JUMP_LAUNCH_MODE: "up" | "blended",
        JUMP_BLEND_FACTOR: number,
        ANGULAR_VELOCITY_BUILD_RATE: number,
        ANGULAR_VELOCITY_DECAY_RATE: number,
        MAX_ANGULAR_VELOCITY: number,
    }

    passenger: {
        REATTACH_DIST: number,
        MIN_SEPARATION_BEFORE_REATTACHING: number,
        DETACH_BOOST: number,
        AIR_SPIN_SPEED_X: number,
        AIR_SPIN_SPEED_Z: number,

        SUPPORT_THRESHOLD: number,
        AIRBORNE_SUPPORT_THRESHOLD: number,
    }

    constructor() {
        this.physics = {
            GRAVITY: 5,
        }

        this.track = {
            SAMPLE_DISTANCE: 0.3,
            SNAP_TO_POINT_DISTANCE: 0.2,
            ERASER_RADIUS: 0.45,
            ALLOW_SELF_JOINS: false,
            PHYSICS_POINT_SPACING: 0.05,
            RAIL_SMOOTHING_PASSES: 2,
        }

        this.cart = {
            MAX_SPEED: 4,
            ATTACH_DIST: 0.0,
            REATTACH_COOLDOWN: 0.3,
            JUMP_BOOST: 2.5,
            JUMP_BUFFER_TIME: 0.12,
            COYOTE_TIME: 0.1,
            JUMP_LAUNCH_MODE: "blended",
            JUMP_BLEND_FACTOR: 0.5,
            ANGULAR_VELOCITY_BUILD_RATE: 90,
            ANGULAR_VELOCITY_DECAY_RATE: 8,
            MAX_ANGULAR_VELOCITY: 18,
        }

        this.passenger = {
            REATTACH_DIST: 0.25,
            MIN_SEPARATION_BEFORE_REATTACHING: 0.35,
            DETACH_BOOST: 0.25,
            AIR_SPIN_SPEED_X: 0,
            AIR_SPIN_SPEED_Z: -7,
            SUPPORT_THRESHOLD: -12,
            AIRBORNE_SUPPORT_THRESHOLD: -3,
        }

        this.camera = {
            PAN_SPEED: 0.01,
            ZOOM_SPEED: 0.01,
            MOBILE_PAN_SPEED: 0.015,
            MOBILE_ZOOM_SPEED: 0.02,
            DEFAULT_Z_VALUE_DESKTOP: 3,
            DEFAULT_X_VALUE_DESKTOP: -1,
            DEFAULT_Y_VALUE_DESKTOP: 1,
            DRAWING_Z_VALUE_DESKTOP: 4,

            DEFAULT_Z_VALUE_MOBILE: 4,
            DEFAULT_X_VALUE_MOBILE: -1,
            DEFAULT_Y_VALUE_MOBILE: 1,
            DRAWING_Z_VALUE_MOBILE: 5,

            MIN_ZOOM_DESKTOP: 1,
            MAX_ZOOM_DESKTOP: 5,
            MIN_ZOOM_MOBILE: 1,
            MAX_ZOOM_MOBILE: 10,
        }
    }
}

import * as THREE from "three";

export class GradientLitMaterial extends THREE.ShaderMaterial {

    constructor(params: {
        map: THREE.Texture,
        color?: THREE.ColorRepresentation,
    }) {
        const color = new THREE.Color(params.color ?? 0xffffff);

        super({
            uniforms: {
                map: { value: params.map },
                color: { value: color }
            },

            vertexShader: `
                varying vec2 vUv;
                varying vec3 vNormal;

                void main() {

                    vUv = uv;

                    vec3 transformed = position;
                    vec3 transformedNormal = normal;

                    #ifdef USE_INSTANCING
                        transformed = (instanceMatrix * vec4(position, 1.0)).xyz;
                        transformedNormal = mat3(instanceMatrix) * normal;
                    #endif

                    vNormal = normalize(normalMatrix * transformedNormal);

                    gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
                }
            `,

            fragmentShader: `
                uniform sampler2D map;
                uniform vec3 color;

                varying vec2 vUv;
                varying vec3 vNormal;

                void main() {

                    // gradient mask
                    float g = texture2D(map, vUv).r;

                    // two-color ramp
                    vec3 baseColor = mix(color, vec3(0.0), g);

                    gl_FragColor = vec4(baseColor, 1.0);

                    #include <tonemapping_fragment>
	                #include <colorspace_fragment>
                }
            `,

            transparent: false
        });

    }
}
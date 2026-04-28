import * as THREE from "three";

export class GradientLitMaterial extends THREE.ShaderMaterial {

    constructor(params: {
        map: THREE.Texture,
        darkColor?: THREE.ColorRepresentation,
        lightColor?: THREE.ColorRepresentation,
    }) {
        const lightColor = new THREE.Color(params.lightColor ?? 0xffffff);
        const darkColor = new THREE.Color(params.darkColor ?? 0x000000);

        super({
            uniforms: {
                map: { value: params.map },
                darkColor: { value: darkColor },
                lightColor: { value: lightColor }
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
                uniform vec3 darkColor;
                uniform vec3 lightColor;

                varying vec2 vUv;
                varying vec3 vNormal;

                void main() {

                    // gradient mask
                    float g = texture2D(map, vUv).r;

                    // two-color ramp
                    vec3 baseColor = mix(lightColor, darkColor, g);

                    gl_FragColor = vec4(baseColor, 1.0);

                    #include <tonemapping_fragment>
	                #include <colorspace_fragment>
                }
            `,

            transparent: false
        });

    }
}
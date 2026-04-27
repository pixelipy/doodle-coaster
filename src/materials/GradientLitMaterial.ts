import * as THREE from "three";

export class GradientLitMaterial extends THREE.ShaderMaterial {

    constructor(params: {
        map: THREE.Texture,
        lightDir?: THREE.Vector3,
        lightColor?: THREE.ColorRepresentation
    }) {

        const lightDir = (params.lightDir ?? new THREE.Vector3(0, 1, 0)).clone().normalize();

        const lightColor = new THREE.Color(params.lightColor ?? 0xffffff);
        const darkColor = lightColor.clone().multiplyScalar(0.5);



        super({

            uniforms: {
                map: { value: params.map },
                lightDir: { value: lightDir },
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
                uniform vec3 lightDir;
                uniform vec3 darkColor;
                uniform vec3 lightColor;

                varying vec2 vUv;
                varying vec3 vNormal;

                void main() {

                    // gradient mask
                    float g = texture2D(map, vUv).r;

                    // two-color ramp
                    vec3 baseColor = mix(lightColor, darkColor, g);

                    // lighting
                    vec3 n = normalize(vNormal);
                    float light = dot(n, lightDir) * 0.5 + 0.5;

                    // final
                    vec3 finalColor = baseColor;

                    gl_FragColor = vec4(finalColor, 1.0);
                }
            `,

            transparent: false
        });

        // enable instancing support
        this.defines = { USE_INSTANCING: '' };
    }
}
import type { Color } from "three";
import * as THREE from "three";

export class GradientLitSpecularMaterial extends THREE.ShaderMaterial {

    constructor(params: {
        map: THREE.Texture,
        lightDir?: THREE.Vector3,
        darkColor?: THREE.ColorRepresentation,
        lightColor?: THREE.ColorRepresentation,
        shininess?: number,
        specularStrength?: number
    }) {

        const lightDir = (params.lightDir ?? new THREE.Vector3(0, 1, 0)).clone().normalize();
        const lightColor = new THREE.Color(params.lightColor ?? 0xffffff);
        const darkColor = new THREE.Color(params.darkColor ?? 0x000000);

        const specularColor = clampColor(lightColor.clone().multiplyScalar(5.0));
        const shininess = params.shininess ?? 32;
        const specularStrength = params.specularStrength ?? 1.0;

        super({
            uniforms: {
                map: { value: params.map },
                lightDir: { value: lightDir },
                darkColor: { value: darkColor },
                lightColor: { value: lightColor },
                specularColor: { value: specularColor },
                shininess: { value: shininess },
                specularStrength: { value: specularStrength }
            },

            vertexShader: `
                varying vec2 vUv;
                varying vec3 vNormal;
                varying vec3 vViewDir;

                void main() {

                    vUv = uv;

                    vec3 transformed = position;
                    vec3 transformedNormal = normal;

                    #ifdef USE_INSTANCING
                        transformed = (instanceMatrix * vec4(position, 1.0)).xyz;
                        transformedNormal = mat3(instanceMatrix) * normal;
                    #endif

                    // view space position
                    vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);

                    vNormal = normalize(normalMatrix * transformedNormal);
                    vViewDir = normalize(-mvPosition.xyz);

                    gl_Position = projectionMatrix * mvPosition;
                }
            `,

            fragmentShader: `
                uniform sampler2D map;
                uniform vec3 lightDir;
                uniform vec3 darkColor;
                uniform vec3 lightColor;
                uniform vec3 specularColor;
                uniform float shininess;
                uniform float specularStrength;

                varying vec2 vUv;
                varying vec3 vNormal;
                varying vec3 vViewDir;

                void main() {

                    // gradient mask
                    float g = texture2D(map, vUv).r;

                    // correct order
                    vec3 baseColor = mix(lightColor, darkColor, g);

                    vec3 n = normalize(vNormal);
                    vec3 l = normalize(lightDir);
                    vec3 v = normalize(vViewDir);

                    // diffuse
                    float light = dot(n, l) * 0.0 + 1.0;

                    // specular (Phong)
                    vec3 r = reflect(-l, n);
                    float spec = pow(max(dot(r, v), 0.0), shininess) * specularStrength;

                    // optional: keep spec only on lit side
                    spec *= light;

                    vec3 finalColor = baseColor * light + specularColor * spec;

                    gl_FragColor = vec4(finalColor, 1.0);

                    #include <tonemapping_fragment>
                    #include <colorspace_fragment>
                }
            `,

            transparent: false
        });
    }
}

function clampColor(color: Color) {
    color.r = Math.min(1, Math.max(0, color.r));
    color.g = Math.min(1, Math.max(0, color.g));
    color.b = Math.min(1, Math.max(0, color.b));
    return color;
}
import { Color, ShaderMaterial, Vector3, type ColorRepresentation } from "three";

export class PipeMaterial extends ShaderMaterial {

    constructor(params: {
        lightDir?: Vector3,
        lightColor?: ColorRepresentation,
        shininess?: number
    }) {

        const lightDir = (params.lightDir ?? new Vector3(0, 1, 0)).clone().normalize();
        const lightColor = new Color(params.lightColor ?? 0xffffff);
        const darkColor = lightColor.clone().multiplyScalar(0.2);
        const specularColor = clampColor(lightColor.clone().multiplyScalar(5.0));
        const shininess = params.shininess ?? 32;

        super({

            uniforms: {
                lightDir: { value: lightDir },
                darkColor: { value: darkColor },
                lightColor: { value: lightColor },
                specularColor: { value: specularColor },
                shininess: { value: shininess }
            },

            vertexShader: `
                varying vec3 vNormal;
                varying vec3 vViewDir;

                void main() {

                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);

                    vNormal = normalize(normalMatrix * normal);
                    vViewDir = normalize(-mvPosition.xyz);

                    gl_Position = projectionMatrix * mvPosition;
                }
            `,

            fragmentShader: `
                uniform vec3 lightDir;
                uniform vec3 darkColor;
                uniform vec3 lightColor;
                uniform vec3 specularColor;
                uniform float shininess;

                varying vec3 vNormal;
                varying vec3 vViewDir;

                void main() {

                    vec3 n = normalize(vNormal);
                    vec3 l = normalize(lightDir);
                    vec3 v = normalize(vViewDir);

                    // DIFFUSE (your ramp)
                    float light = dot(n, l) * 0.5 + 0.5;
                    vec3 baseColor = mix(darkColor, lightColor, light);

                    // SPECULAR (cheap phong)
                    vec3 r = reflect(-l, n);
                    float spec = pow(max(dot(r, v), 0.0), shininess);

                    // FINAL
                    vec3 finalColor = baseColor + specularColor * spec;

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
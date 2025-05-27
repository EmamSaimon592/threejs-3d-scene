// main.js or index.js
import './style.css';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
// import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

// === Basic Setup ===
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xffffff);

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(5, 0, 5);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({
  powerPreference: 'high-performance',
  antialias: false,
  stencil: false,
  depth: false,
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.NoToneMapping;
document.querySelector('.corridor').appendChild(renderer.domElement);

// === Lighting ===
scene.add(new THREE.AmbientLight(0xffffff, 0.5));

const keyLight = new THREE.DirectionalLight(0xffffff, 0.5);
keyLight.position.set(5, 8, 5);
keyLight.castShadow = true;
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0xffffff, 0.5);
fillLight.position.set(-5, 3, -5);
scene.add(fillLight);

const light1 = new THREE.PointLight(0xffffff, 2, 1);
light1.position.set(2, 3, 2);
scene.add(light1);

const light2 = new THREE.PointLight(0xffffff, 2, 1);
light2.position.set(-2, 3, -2);
scene.add(light2);

// === Parallax Controls ===
let mouseX = 0;
let mouseY = 0;
const windowHalfX = window.innerWidth / 2;
const windowHalfY = window.innerHeight / 2;

let initialAngle = Math.PI / 4;
// let radius = Math.sqrt(50);
let radius = 15;

let currentAngle = initialAngle;
let targetAngle = initialAngle;
let currentY = 0;
let targetY = 0;

document.addEventListener('mousemove', event => {
  mouseX = (event.clientX - windowHalfX) / windowHalfX;
  mouseY = (event.clientY - windowHalfY) / windowHalfY;
  targetAngle = initialAngle + -mouseX * 0.35;
  targetY = -mouseY * 1.5;
});

// === Emissive Colors ===
const colorMap = {
  screen: new THREE.Color(0x00ff00),
  lamp: new THREE.Color(0xffaa00),
  light: new THREE.Color(0xffffff),
  default: new THREE.Color(0xffffff),
};

// === Load GLTF Model ===
const loader = new GLTFLoader();
loader.load('/3d-assets/scene.gltf', gltf => {
  const model = gltf.scene;

  model.traverse(child => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;

      if (child.material) {
        let emissiveColor = colorMap.default;
        for (const [key, color] of Object.entries(colorMap)) {
          if (child.name.toLowerCase().includes(key)) {
            emissiveColor = color;
            break;
          }
        }

        const newMaterial = new THREE.MeshStandardMaterial({
          color: child.material.color,
          map: child.material.map,
          emissive: emissiveColor,
          emissiveIntensity: 0,
          roughness: 0.5,
          metalness: 0.125,
        });

        if (child.material.map) {
          newMaterial.map.encoding = THREE.sRGBEncoding;
          newMaterial.map.flipY = false;
        }

        child.material = newMaterial;
      }
    }
  });

  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  model.position.sub(center);

  scene.add(model);
  document.querySelector('.loading').style.display = 'none';
});

// === Film Grain Shader ===
const FilmGrainShader = {
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0.0 },
    noiseIntensity: { value: 0.05 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float time;
    uniform float noiseIntensity;
    varying vec2 vUv;

    float rand(vec2 co){
      return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
    }

    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      float noise = rand(vUv + time);
      color.rgb += noise * noiseIntensity;
      gl_FragColor = color;
    }
  `,
};

const filmGrainPass = new ShaderPass(FilmGrainShader);

// === Postprocessing ===
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(
  new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    2.0,
    0.25,
    0.5
  )
);
composer.addPass(filmGrainPass);

// === Animation Loop ===
function lerp(start, end, factor) {
  return start + (end - start) * factor;
}

function animate() {
  requestAnimationFrame(animate);
  filmGrainPass.uniforms.time.value = performance.now() * 0.001;

  currentAngle = lerp(currentAngle, targetAngle, 0.025);
  currentY = lerp(currentY, targetY, 0.025);

  camera.position.x = Math.cos(currentAngle) * radius;
  camera.position.z = Math.sin(currentAngle) * radius;
  camera.position.y = lerp(camera.position.y, currentY, 0.05);
  camera.lookAt(0, 0, 0);

  composer.render();
}
animate();

// === Resize Handler ===
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', onWindowResize, false);

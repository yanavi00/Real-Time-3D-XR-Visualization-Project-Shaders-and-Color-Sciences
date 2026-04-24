// shaderscolorsciences.js
// Reusable functions for exercises 

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { XRButton } from 'three/addons/webxr/XRButton.js';
import { HTMLMesh } from 'three/addons/interactive/HTMLMesh.js';
import { InteractiveGroup } from 'three/addons/interactive/InteractiveGroup.js';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';


// Create a basic Three.js scene with camera, renderer, and controls
export function createBasicScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a1a);

  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 0, 3);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(1);
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;

  const sourceCanvas = document.createElement('canvas');
  const sourceCtx = sourceCanvas.getContext('2d');
  const videoElement = document.createElement('video');
  videoElement.autoplay = true;
  videoElement.muted = true;
  videoElement.playsInline = true;
  videoElement.loop = true;
  
  return { scene, camera, renderer, controls, sourceCanvas, sourceCtx, videoElement };
}

// Set up WebXR with basic controller support and an optional HTML panel for instructions
// If xrTargetObject is provided, it is moved in front of the user when XR starts.
export function setupXR(renderer, scene, camera, orbitControls = null, htmlPanel = null, xrTargetObject = null) {
  renderer.xr.enabled = true;

  let savedTransform = null;

  renderer.xr.addEventListener('sessionstart', () => {
    if (orbitControls) orbitControls.enabled = false;
    if (!xrTargetObject) return;
    savedTransform = {
      position: xrTargetObject.position.clone(),
      quaternion: xrTargetObject.quaternion.clone(),
      scale: xrTargetObject.scale.clone()
    };

    // Place the visualized object in front of the user at a comfortable height.
    xrTargetObject.position.set(0.0, 1.5, -2.0);
    xrTargetObject.quaternion.identity();
    xrTargetObject.scale.set(1.0, 1.0, 1.0);
  });

  renderer.xr.addEventListener('sessionend', () => {
    if (orbitControls) orbitControls.enabled = true;
    if (!xrTargetObject || !savedTransform) return;
    xrTargetObject.position.copy(savedTransform.position);
    xrTargetObject.quaternion.copy(savedTransform.quaternion);
    xrTargetObject.scale.copy(savedTransform.scale);
    savedTransform = null;
  });

  document.body.appendChild(XRButton.createButton(renderer));

  const controller1 = renderer.xr.getController(0);
  const controller2 = renderer.xr.getController(1);
  scene.add(controller1);
  scene.add(controller2);

  const controllerModelFactory = new XRControllerModelFactory();

  const grip1 = renderer.xr.getControllerGrip(0);
  grip1.add(controllerModelFactory.createControllerModel(grip1));
  scene.add(grip1);

  const grip2 = renderer.xr.getControllerGrip(1);
  grip2.add(controllerModelFactory.createControllerModel(grip2));
  scene.add(grip2);

  if (htmlPanel) {
    const group = new InteractiveGroup(renderer, camera);
    group.listenToPointerEvents(renderer, camera);
    group.listenToXRControllerEvents(controller1);
    group.listenToXRControllerEvents(controller2);
    scene.add(group);

    const mesh = new HTMLMesh(htmlPanel);
    mesh.position.set(-0.9, 0.8, -1.2);
    mesh.rotation.x = -0.25;
    mesh.scale.setScalar(1.2);
    group.add(mesh);
  }
}

// Keep camera and renderer in sync with viewport size
export function setupResize(renderer, camera) {
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

// Load image pixels as ImageData for CPU-side processing
export async function loadImageData(src) {
  const loader = new THREE.ImageLoader();
  const image = await loader.loadAsync(src);

  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;

  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

// Load either an image or a video source using the same flow as ex1
export async function loadMediaSource(mediaSource, sourceCanvas, sourceCtx, videoElement) {
  if (mediaSource.type === 'video') {
    videoElement.src = mediaSource.src;
    await new Promise((resolve) => {
      if (videoElement.readyState >= 1) {
        resolve();
        return;
      }
      videoElement.onloadedmetadata = () => resolve();
    });

    await videoElement.play();
    sourceCanvas.width = videoElement.videoWidth;
    sourceCanvas.height = videoElement.videoHeight;
    return;
  }

  const imageData = await loadImageData(mediaSource.src);
  sourceCanvas.width = imageData.width;
  sourceCanvas.height = imageData.height;
  sourceCtx.putImageData(imageData, 0, 0);
}

// Read the current video frame into ImageData when a frame is available
export function getFrameImageData(sourceCtx, sourceCanvas, videoElement) {
  if (!videoElement || videoElement.readyState < 2) {
    return null;
  }

  sourceCtx.drawImage(videoElement, 0, 0, sourceCanvas.width, sourceCanvas.height);
  return sourceCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
}

// Reusable dropdown to switch the displayed color space
export function createColorSpaceSelector(onChange, initialValue = 0) {
  const controlsDiv = document.createElement('div');
  controlsDiv.style.cssText = 'position: absolute; top: 10px; left: 10px; background: rgba(255, 255, 255, 0.95); padding: 15px; border-radius: 5px; font-family: Arial; z-index: 100;';

  const label = document.createElement('label');
  label.textContent = 'Color Space: ';
  label.style.marginRight = '10px';
  label.style.fontWeight = 'bold';

  const select = document.createElement('select');
  select.style.cssText = 'padding: 8px; font-size: 14px; cursor: pointer;';
  select.innerHTML = `
    <option value="0">RGB</option>
    <option value="1">HSV</option>
    <option value="2">CIEXYZ</option>
    <option value="3">CIExyY</option>
    <option value="4">CIELAB</option>
    <option value="5">CIELCH</option>
  `;
  select.value = String(initialValue);

  select.addEventListener('change', (event) => {
    const value = parseInt(event.target.value, 10);
    onChange(value);
  });

  controlsDiv.appendChild(label);
  controlsDiv.appendChild(select);
  document.body.appendChild(controlsDiv);

  return { controlsDiv, select };
}

// GLSL functions for color space conversions
export const colorConversionsGLSL = `
        // sRGB to linear RGB
        vec3 sRGBToLinear(vec3 c) {
          return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
        }

        // RGB to CIEXYZ
        vec3 rgbToXyz(vec3 c) {
          c = sRGBToLinear(c);
          mat3 matrix = mat3(
            0.4124564, 0.2126729, 0.0193339,
            0.3575761, 0.7151522, 0.1191920,
            0.1804375, 0.0721750, 0.9503041
          );
          return matrix * c;
        }

        // CIEXYZ to CIExyY
        vec3 xyzToXyY(vec3 xyz) {
          float sum = xyz.x + xyz.y + xyz.z;
          sum = max(sum, 1e-10);
          return vec3(xyz.x / sum, xyz.y / sum, xyz.y);
        }

        // Helper function for LAB conversion
        float labHelper(float t) {
          float delta = 6.0 / 29.0;
          return t > delta * delta * delta ? pow(t, 1.0/3.0) : t / (3.0 * delta * delta) + 4.0/29.0;
        }

        // CIEXYZ to CIELAB
        vec3 xyzToLab(vec3 xyz) {
          vec3 white = vec3(0.95047, 1.00000, 1.08883);
          vec3 normalized = xyz / white;
          vec3 f = vec3(labHelper(normalized.x), labHelper(normalized.y), labHelper(normalized.z));
          float L = 116.0 * f.y - 16.0;
          float a = 500.0 * (f.x - f.y);
          float b = 200.0 * (f.y - f.z);
          return vec3(L, a, b);
        }

        // CIELAB to CIELCH
        vec3 labToLch(vec3 lab) {
          float C = length(lab.yz);
          float h = atan(lab.z, lab.y);
          return vec3(lab.x, C, h);
        }

        // RGB to HSV
        vec3 rgbToHsv(vec3 c) {
          vec4 K = vec4(0.0, -1.0/3.0, 2.0/3.0, -1.0);
          vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
          vec4 q = mix(p, vec4(p.xyw, c.r), step(p.x, c.r));
          float d = q.x - min(q.w, q.y);
          return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + 1e-10)), d / (q.x + 1e-10), q.x);
        }

        // RGB to CIELAB wrapper
        vec3 rgbToLab(vec3 c) {
          return xyzToLab(rgbToXyz(c));
        }

        // RGB to CIELCH wrapper
        vec3 rgbToLch(vec3 c) {
          return labToLch(rgbToLab(c));
        }

        // Normalize CIELAB to roughly [0, 1] for visualization
        vec3 normalizeLab(vec3 lab) {
          float L = clamp(lab.x / 100.0, 0.0, 1.0);
          float a = clamp((lab.y + 128.0) / 255.0, 0.0, 1.0);
          float b = clamp((lab.z + 128.0) / 255.0, 0.0, 1.0);
          return vec3(L, a, b);
        }

        // Normalize CIELCH to roughly [0, 1] for visualization
        vec3 normalizeLch(vec3 lch) {
          float L = clamp(lch.x / 100.0, 0.0, 1.0);
          float C = clamp(lch.y / 150.0, 0.0, 1.0);
          float h = fract(lch.z / 6.28318530718 + 1.0);
          return vec3(L, C, h);
        }

        // Convert color based on selected space
        vec3 convertColor(vec3 rgb, int space) {
          if (space == 0) return rgb;
          else if (space == 1) return rgbToHsv(rgb);
          else if (space == 2) return rgbToXyz(rgb);
          else if (space == 3) return xyzToXyY(rgbToXyz(rgb));
          else if (space == 4) return normalizeLab(rgbToLab(rgb));
          else if (space == 5) return normalizeLch(rgbToLch(rgb));
          return rgb;
        }
`;

// GLSL helper to select one component from a converted color space
export const componentSelectionGLSL = `
        float getNormalizedComponent(vec3 rgb, int colorSpace, int component) {
          vec3 converted = convertColor(rgb, colorSpace);
          component = clamp(component, 0, 2);
          return clamp(converted[component], 0.0, 1.0);
        }
`;

export async function loadTexture(src) {
  const loader = new THREE.TextureLoader();
  const texture = await loader.loadAsync(src);

  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;

  return texture;
}

export async function loadMediaTexture(mediaSource) {
  if (mediaSource.type === 'video') {
    const videoElement = document.createElement('video');
    videoElement.autoplay = true;
    videoElement.muted = true;
    videoElement.playsInline = true;
    videoElement.loop = true;
    videoElement.src = mediaSource.src;

    await new Promise((resolve) => {
      if (videoElement.readyState >= 1) {
        resolve();
        return;
      }
      videoElement.onloadedmetadata = () => resolve();
    });

    try {
      await videoElement.play();
    } catch (error) {
      console.warn('Video autoplay blocked. Start playback with a user gesture.', error);
    }

    const texture = new THREE.VideoTexture(videoElement);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;

    return {
      texture,
      width: videoElement.videoWidth,
      height: videoElement.videoHeight,
      videoElement,
      isVideo: true
    };
  }

  const texture = await loadTexture(mediaSource.src);
  return {
    texture,
    width: texture.image.width,
    height: texture.image.height,
    videoElement: null,
    isVideo: false
  };
}
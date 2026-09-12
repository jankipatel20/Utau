import { useRef, useEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import { useGLTF, Environment, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import gsap from "gsap";

type AnomalyType = "gearbox" | "generator" | "bearing" | null;
interface Props { activeAnomaly: AnomalyType; }

// The exterior turbine is ~8148 units tall! We scale it down to 15.
const TARGET_HEIGHT = 15;
const ORIGINAL_HEIGHT = 8147.95;
const MODEL_SCALE = TARGET_HEIGHT / ORIGINAL_HEIGHT; 
// ── Safely clone scene and materials ──────────────────────────────────────────
import { SkeletonUtils } from "three-stdlib";

function cloneSceneWithTransparency(scene: THREE.Group, initialOpacity: number, enableShadows: boolean = false): THREE.Group {
  const clone = SkeletonUtils.clone(scene) as THREE.Group;
  clone.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = enableShadows;
      mesh.receiveShadow = enableShadows;
      
      const newMats: THREE.Material[] = [];
      const origMats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      
      origMats.forEach(m => {
        const newMat = m.clone();
        newMat.transparent = true;
        newMat.opacity = initialOpacity;
        newMat.needsUpdate = true;
        newMat.depthWrite = initialOpacity > 0.5; // Avoid weird sorting issues when transparent
        
        if ((newMat as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
          (newMat as THREE.MeshStandardMaterial).envMapIntensity = 2.0;
          if ((newMat as THREE.MeshStandardMaterial).metalness !== undefined) {
             (newMat as THREE.MeshStandardMaterial).roughness = Math.max(0.4, (newMat as THREE.MeshStandardMaterial).roughness);
          }
        }
        newMats.push(newMat);
      });
      
      mesh.material = newMats.length === 1 ? newMats[0] : newMats;
    }
  });
  return clone;
}

// ── GSAP Fade function ────────────────────────────────────────────────────────
function fadeTo(scene: THREE.Group, targetOpacity: number, duration = 1.0) {
  scene.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.isMesh) {
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((m) => {
        gsap.to(m, { opacity: targetOpacity, duration, ease: "power2.inOut" });
      });
    }
  });
}


// (NormalizedFaultModel removed to prevent loading extra models)

// ── Main Viewer ───────────────────────────────────────────────────────────────
export default function TurbineViewer({ activeAnomaly }: Props) {
  const { camera } = useThree();
  const orbitRef = useRef<any>(null);

  // Load RAW scenes
  const { scene: rawExt }  = useGLTF("/src/assets/Turbine_Exterior.glb");
  const { scene: rawNac }  = useGLTF("/src/assets/Nacelle_Shell.glb");

  // Create clones for the massive main turbine
  const extScene = useMemo(() => cloneSceneWithTransparency(rawExt as THREE.Group, 1, true), [rawExt]);
  const nacScene = useMemo(() => cloneSceneWithTransparency(rawNac as THREE.Group, 0, false), [rawNac]);

  // Propagate anomaly instantly so the Queue Manager in TopologyPanel handles timing
  const shown = activeAnomaly;

  // Set initial camera position
  useEffect(() => {
    camera.position.set(0, 10.5, 22);
    if (orbitRef.current) {
      orbitRef.current.target.set(0, 10.5, 0);
      orbitRef.current.update();
    }
  }, [camera]);

  // ── GSAP Transitions ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (shown === null) {
      // Return to healthy state
      fadeTo(extScene, 1, 1.2);
      fadeTo(nacScene, 0, 1.2);

      gsap.to(camera.position, { x: 0, y: 10.5, z: 22, duration: 2, ease: "power2.inOut" });
      if (orbitRef.current) {
        gsap.to(orbitRef.current.target, { 
          x: 0, y: 10.5, z: 0, 
          duration: 2, ease: "power2.inOut",
          onUpdate: () => orbitRef.current?.update()
        });
      }
    } else {
      // Zoom into fault state
      fadeTo(extScene, 0, 1.0);
      fadeTo(nacScene, 1, 1.0);

      // The models are positioned at Y = 4.0
      const targetY = 4.0;
      
      // Specific camera targeting to look directly at the loaded component
      const targetLookX = shown === "gearbox" ? -1 : shown === "generator" ? 1 : 0;
      const targetCamX = shown === "gearbox" ? -3 : shown === "generator" ? 3 : 0;

      // By pointing the camera slightly ABOVE the component, the component renders lower on the screen.
      const lookAtY = targetY + 1.5;
      const camY = lookAtY + 1.5;

      gsap.to(camera.position, { x: targetCamX, y: camY, z: 11, duration: 2.5, ease: "power3.inOut" });
      if (orbitRef.current) {
        gsap.to(orbitRef.current.target, { 
          x: targetLookX, y: lookAtY, z: 0, 
          duration: 2.5, ease: "power3.inOut",
          onUpdate: () => orbitRef.current?.update()
        });
      }
    }
  }, [shown, camera, extScene, nacScene]);

  return (
    <>
      <OrbitControls 
        ref={orbitRef} 
        enablePan 
        enableZoom 
        minDistance={2} 
        maxDistance={60} 
        autoRotate={shown === null}
        autoRotateSpeed={1.0}
      />
      
      <ambientLight intensity={1.5} color="#fff8ee" />
      <directionalLight position={[10, 15, 10]} intensity={3.0} castShadow />
      <directionalLight position={[-10, 10, -5]} intensity={1.5} color="#a0c0ff" />
      <Environment preset="warehouse" />

      {/* Main Turbine Assembly */}
      <group scale={MODEL_SCALE} position={[0, 0, 0]}>
        <primitive object={extScene} />
        <primitive object={nacScene} />
      </group>

      {/* Grid Floor */}
      <gridHelper args={[60, 60, "#443311", "#221a08"]} position={[0, -0.05, 0]} />
    </>
  );
}

useGLTF.preload("/src/assets/Turbine_Exterior.glb");
useGLTF.preload("/src/assets/Nacelle_Shell.glb");

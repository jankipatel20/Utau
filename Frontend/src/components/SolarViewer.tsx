import { useRef, useEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import { useGLTF, Environment, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import gsap from "gsap";
import { SkeletonUtils } from "three-stdlib";

export type SolarAnomalyType = "inverter" | "panel" | "junction_box" | null;
interface Props { activeAnomaly: SolarAnomalyType; }

const MODEL_SCALE = 2.5; 
const FAULT_HEIGHT = 1.5;

// ── Safely clone scene and materials ──────────────────────────────────────────
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
        newMat.depthWrite = initialOpacity > 0.5;
        
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
export default function SolarViewer({ activeAnomaly }: Props) {
  const { camera } = useThree();
  const orbitRef = useRef<any>(null);

  // Load RAW scenes
  const { scene: rawExt }  = useGLTF("/src/assets/solar_array_exterior.glb");

  const extScene = useMemo(() => cloneSceneWithTransparency(rawExt as THREE.Group, 1, true), [rawExt]);

  const shown = activeAnomaly;

  useEffect(() => {
    camera.position.set(0, 6, 12);
    if (orbitRef.current) {
      orbitRef.current.target.set(0, 0.5, 0);
      orbitRef.current.update();
    }
  }, [camera]);

  // ── GSAP Transitions ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (shown === null) {
      fadeTo(extScene, 1, 1.2);

      gsap.to(camera.position, { x: 0, y: 6, z: 12, duration: 2, ease: "power2.inOut" });
      if (orbitRef.current) {
        gsap.to(orbitRef.current.target, { 
          x: 0, y: 0.5, z: 0, 
          duration: 2, ease: "power2.inOut",
          onUpdate: () => orbitRef.current?.update()
        });
      }
    } else {
      // Keep the solar farm fully visible since we removed the extra fault models
      fadeTo(extScene, 1.0, 1.0);
      
      const targetLookX = shown === "panel" ? -2 : shown === "inverter" ? 2 : 0;
      const targetCamX = shown === "panel" ? -4 : shown === "inverter" ? 4 : 0;

      gsap.to(camera.position, { x: targetCamX, y: FAULT_HEIGHT + 1.5, z: 10, duration: 2.5, ease: "power3.inOut" });
      if (orbitRef.current) {
        gsap.to(orbitRef.current.target, { 
          x: targetLookX, y: FAULT_HEIGHT, z: 0, 
          duration: 2.5, ease: "power3.inOut",
          onUpdate: () => orbitRef.current?.update()
        });
      }
    }
  }, [shown, camera, extScene]);

  return (
    <>
      <OrbitControls 
        ref={orbitRef} 
        enablePan 
        enableZoom 
        minDistance={2} 
        maxDistance={60} 
        autoRotate={shown === null}
        autoRotateSpeed={0.5}
      />
      
      <ambientLight intensity={1.5} color="#fff8ee" />
      <directionalLight position={[10, 15, 10]} intensity={3.0} castShadow />
      <directionalLight position={[-10, 10, -5]} intensity={1.5} color="#a0c0ff" />
      <Environment preset="warehouse" />

      {/* Main Solar Array */}
      <group scale={MODEL_SCALE} position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, Math.PI]}>
        <primitive object={extScene} />
      </group>

      {/* Grid Floor */}
      <gridHelper args={[60, 60, "#443311", "#221a08"]} position={[0, -0.05, 0]} />
    </>
  );
}

useGLTF.preload("/src/assets/solar_array_exterior.glb");

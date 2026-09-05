import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useAppStore } from "../store/appStore";

function MoonSphere() {
  const mesh = useRef<THREE.Mesh>(null);
  const texture = useMemo(() => {
    const loader = new THREE.TextureLoader();
    const tex = loader.load("/full-moon.png");
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);

  useFrame((_, delta) => {
    if (mesh.current) mesh.current.rotation.y += delta * 0.08;
  });

  return (
    <mesh ref={mesh} scale={2.15}>
      <sphereGeometry args={[1, 64, 64]} />
      <meshStandardMaterial map={texture} roughness={0.95} metalness={0.05} />
    </mesh>
  );
}

export function MoonScene({ className = "" }: { className?: string }) {
  const theme = useAppStore((s) => s.theme);
  return (
    <div className={`h-full w-full ${className}`}>
      <Canvas camera={{ position: [0, 0, 6.2], fov: 42 }}>
        <color attach="background" args={[theme === "dark" ? "#02040a" : "#b9d9f7"]} />
        <ambientLight intensity={theme === "dark" ? 0.35 : 0.7} />
        <directionalLight position={[4, 2, 3]} intensity={theme === "dark" ? 1.4 : 1.1} />
        {theme === "dark" ? <Stars radius={80} depth={40} count={1200} factor={3} saturation={0} fade speed={0.4} /> : null}
        <MoonSphere />
        <OrbitControls enablePan={false} minDistance={4} maxDistance={10} autoRotate={false} />
      </Canvas>
    </div>
  );
}

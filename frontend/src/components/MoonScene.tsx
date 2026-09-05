import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import { Suspense, useMemo, useRef } from "react";
import * as THREE from "three";
import { useAppStore } from "../store/appStore";

function MoonSphere() {
  const mesh = useRef<THREE.Mesh>(null);
  const texture = useMemo(() => {
    const loader = new THREE.TextureLoader();
    // Equirectangular lunar albedo — wraps cleanly on a UV sphere (no black seam).
    const tex = loader.load("/moon-albedo.jpg");
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 16;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  }, []);

  useFrame((_, delta) => {
    if (!mesh.current) return;
    // Smooth axial spin; clamp delta so tab-switches don't jump
    const step = Math.min(delta, 0.05);
    mesh.current.rotation.y += step * 0.065;
  });

  return (
    <mesh ref={mesh} scale={2.15} rotation={[0.08, 0.4, 0.05]}>
      <sphereGeometry args={[1, 128, 128]} />
      <meshStandardMaterial
        map={texture}
        roughness={0.9}
        metalness={0}
        // Earthshine — far side stays textured, never pure black
        emissive={new THREE.Color("#a0a0a0")}
        emissiveIntensity={0.35}
        emissiveMap={texture}
      />
    </mesh>
  );
}

export function MoonScene({ className = "" }: { className?: string }) {
  const theme = useAppStore((s) => s.theme);
  const dark = theme === "dark";

  return (
    <div className={`h-full w-full ${className}`}>
      <Canvas
        camera={{ position: [0, 0.25, 6.2], fov: 42 }}
        dpr={[1, 1.75]}
        gl={{ antialias: true, powerPreference: "high-performance" }}
      >
        <color attach="background" args={[dark ? "#02040a" : "#b9d9f7"]} />

        {/* Sun + earthshine fill so every longitude stays readable while orbiting */}
        <ambientLight intensity={dark ? 0.85 : 0.95} />
        <hemisphereLight
          color={dark ? "#eef2ff" : "#ffffff"}
          groundColor={dark ? "#3a3440" : "#b8c4d8"}
          intensity={dark ? 0.9 : 0.65}
        />
        <directionalLight position={[5, 2.4, 3.2]} intensity={dark ? 1.25 : 1.05} color="#fff6e8" />
        <directionalLight position={[-5, 1, -2]} intensity={dark ? 0.85 : 0.55} color="#c4d0ff" />
        <directionalLight position={[0, 0, 6]} intensity={dark ? 0.4 : 0.28} color="#ffffff" />
        <pointLight position={[-3, 2, 4]} intensity={dark ? 0.35 : 0.2} color="#ffffff" distance={20} />

        {dark ? (
          <Stars radius={80} depth={40} count={1400} factor={3} saturation={0} fade speed={0.25} />
        ) : null}

        <Suspense fallback={null}>
          <MoonSphere />
        </Suspense>

        <OrbitControls
          makeDefault
          enablePan={false}
          enableDamping
          dampingFactor={0.06}
          rotateSpeed={0.45}
          zoomSpeed={0.55}
          minDistance={4.2}
          maxDistance={9.5}
          minPolarAngle={0.4}
          maxPolarAngle={Math.PI - 0.4}
          autoRotate
          autoRotateSpeed={0.28}
        />
      </Canvas>
    </div>
  );
}

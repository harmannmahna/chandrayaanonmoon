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
    // Smooth axial spin; keep delta-clamped so tab-switches don't jump
    const step = Math.min(delta, 0.05);
    mesh.current.rotation.y += step * 0.065;
  });

  return (
    <mesh ref={mesh} scale={2.15} rotation={[0.08, 0.4, 0.05]}>
      <sphereGeometry args={[1, 128, 128]} />
      <meshStandardMaterial
        map={texture}
        roughness={0.88}
        metalness={0}
        // Soft earthshine — night side stays visible, never pure black
        emissive={new THREE.Color("#7a7a7a")}
        emissiveIntensity={0.18}
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

        {/* Balanced lighting: sun + earthshine fill so the far side stays readable */}
        <ambientLight intensity={dark ? 0.75 : 0.9} />
        <hemisphereLight
          color={dark ? "#e8eeff" : "#ffffff"}
          groundColor={dark ? "#2a2430" : "#b8c4d8"}
          intensity={dark ? 0.85 : 0.6}
        />
        <directionalLight
          position={[5, 2.4, 3.2]}
          intensity={dark ? 1.35 : 1.1}
          color="#fff6e8"
        />
        <directionalLight position={[-5, 0.8, -2]} intensity={dark ? 0.7 : 0.45} color="#b8c8ff" />
        <directionalLight position={[0, 0, 6]} intensity={dark ? 0.35 : 0.25} color="#ffffff" />

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

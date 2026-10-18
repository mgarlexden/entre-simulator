// Shared pieces for the ChangeUp store scenes (고깃집 and 카페): walls that hide on the camera side, a storefront of
// glass with the door gap, pendant lamps, low-poly people (store3d/Figures) seated or standing, and orbit controls
// that frame the room for any canvas size. Scene frame: room centred on the origin, front (street) wall at +z.
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { Box, C } from "../store3d/Building";
import { Figures, hash, type FigPose } from "../store3d/Figures";

export const WALL_H = 2.6;

// A wall that hides when the camera is above the roofline on its outer side, so the default view looks in over it.
// A low skirting stays so the room keeps its outline.
export function Wall({ p, s, color, outside, children }: {
  p: [number, number, number]; s: [number, number, number]; color: string; outside: (c: THREE.Vector3) => boolean; children?: React.ReactNode;
}) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ camera }) => {
    if (ref.current) ref.current.visible = !(camera.position.y > WALL_H + 0.6 && outside(camera.position));
  });
  return (
    <>
      <group ref={ref}>
        <Box p={p} s={s} color={color} receive />
        {children}
      </group>
      <Box p={[p[0], 0.06, p[2]]} s={[s[0], 0.12, s[2]]} color={color} />
    </>
  );
}

// Glass front along z, from x0 to x1, with the door gap (door.x = gap centre). Thin frame so it barely hides the room.
export function Storefront({ x0, x1, z, door, frame = "#4f555c", mat = true }: { x0: number; x1: number; z: number; door: { x: number; w: number }; frame?: string; mat?: boolean }) {
  const H = WALL_H;
  const dl = Math.max(x0, door.x - door.w / 2), dr = Math.min(x1, door.x + door.w / 2);
  const segs = ([[x0, dl], [dr, x1]] as [number, number][]).filter(([a, b]) => b - a > 0.05);
  return (
    <group>
      {segs.map(([a, b]) => {
        const n = Math.max(1, Math.round((b - a) / 2.2)), pw = (b - a) / n, m = (a + b) / 2;
        return (
          <group key={a}>
            <Box p={[m, 0.09, z]} s={[b - a, 0.18, 0.09]} color={frame} />
            <Box p={[m, H - 0.04, z]} s={[b - a, 0.08, 0.09]} color={frame} />
            <Box p={[m, H / 2 + 0.05, z]} s={[b - a, H - 0.26, 0.02]} color={C.glass} opacity={0.16} />
            {Array.from({ length: n + 1 }, (_, i) => <Box key={i} p={[a + pw * i, H / 2, z]} s={[0.05, H, 0.08]} color={frame} />)}
          </group>
        );
      })}
      {/* door: header and transom over the gap, a leaf standing open to the street (inside stays clear), a mat */}
      <Box p={[(dl + dr) / 2, 2.12, z]} s={[dr - dl, 0.07, 0.09]} color={frame} />
      <Box p={[(dl + dr) / 2, (2.15 + H) / 2, z]} s={[dr - dl, H - 2.2, 0.02]} color={C.glass} opacity={0.16} />
      <group position={[dr - 0.02, 0, z + 0.04]} rotation={[0, 1.2, 0]}>
        <Box p={[-(dr - dl) * 0.45, 1.06, 0]} s={[(dr - dl) * 0.9, 2.04, 0.02]} color={C.glass} opacity={0.22} />
        <Box p={[-(dr - dl) * 0.9, 1.06, 0]} s={[0.04, 2.04, 0.05]} color={frame} />
        <Box p={[-(dr - dl) * 0.75, 1.0, 0.04]} s={[0.025, 0.5, 0.025]} color={C.steel} metal={0.6} />
      </group>
      {mat && <Box p={[(dl + dr) / 2, 0.006, z - 0.45]} s={[dr - dl, 0.012, 0.7]} color="#4a4f55" />}
    </group>
  );
}

// A pendant lamp hanging from the (undrawn) ceiling: cord, shade, warm bulb.
export function Pendant({ x, z, y = 1.8, color = "#2f3337" }: { x: number; z: number; y?: number; color?: string }) {
  const top = WALL_H + 0.25;
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, (top + y) / 2, 0]}><cylinderGeometry args={[0.008, 0.008, top - y, 4]} /><meshStandardMaterial color="#1d1f22" /></mesh>
      <mesh position={[0, y - 0.09, 0]} castShadow>
        <coneGeometry args={[0.17, 0.2, 18, 1, true]} />
        <meshStandardMaterial color={color} roughness={0.5} metalness={0.2} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, y - 0.17, 0]}><sphereGeometry args={[0.05, 10, 8]} /><meshStandardMaterial color="#fff3d6" emissive="#ffd38a" emissiveIntensity={1.4} /></mesh>
    </group>
  );
}

// The cafe's light rig, shared so both stores read the same: warm sky, soft fill, one shadow-casting sun from the
// front-left sized to the room (r = half the span to cover). dim < 1 darkens it (a closed day).
export function StoreLights({ w, d, r, dim = 1 }: { w: number; d: number; r: number; dim?: number }) {
  return (
    <>
      <color attach="background" args={["#e9eef6"]} />
      <hemisphereLight args={["#fff7ea", "#c9c2b6", 0.75 * dim]} />
      <ambientLight intensity={0.45 * dim} />
      <directionalLight position={[-w * 0.4, 12, d * 0.6 + 4]} intensity={1.5 * dim} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004}
        shadow-camera-left={-r} shadow-camera-right={r} shadow-camera-top={r} shadow-camera-bottom={-r} shadow-camera-far={40} />
    </>
  );
}

// ---- people
export type Person = {
  x: number; z: number; heading: number; // forward = (sin h, 0, cos h)
  seated: boolean; seed: number; lift?: number; // lift raises a seated person onto a tall stool
  shirt?: string; apron?: string | null; armsUp?: number;
};
const SHIRTS = ["#e0735a", "#3f6fb5", "#e9c46a", "#6a8f5b", "#9b6fb0", "#f2f0ea", "#2f3a4a", "#d98aa0", "#4f9aa3", "#b5654a"];
const PANTS = ["#2f3a4a", "#3b3f45", "#5a4a3c", "#2c4a6b", "#6b6f75"];
const SKIN = ["#f1d3b8", "#e8c19c", "#d9a97f", "#f5dcc6"];
const HAIR = ["#1f1a17", "#3a2a20", "#5b4030", "#2a2522", "#7a5a3a"];
const pick = (a: string[], seed: number, k: number) => a[Math.floor(hash(seed * 7 + k) * a.length)];

function Crowd({ list }: { list: Person[] }) {
  const cols = useMemo(() => list.map((p) => ({
    shirt: new THREE.Color(p.shirt ?? pick(SHIRTS, p.seed, 1)), pants: new THREE.Color(pick(PANTS, p.seed, 2)),
    skin: new THREE.Color(pick(SKIN, p.seed, 3)), hair: new THREE.Color(pick(HAIR, p.seed, 4)),
    apron: p.apron ? new THREE.Color(p.apron) : null, scale: 0.94 + 0.1 * hash(p.seed * 7 + 5),
  })), [list]);
  const poseAt = useCallback((i: number, out: FigPose) => {
    const p = list[i], c = cols[i];
    if (!p || !c) { out.visible = false; return; }
    out.visible = true; out.x = p.x; out.z = p.z; out.heading = p.heading; out.seated = p.seated; out.walk = NaN;
    out.scale = c.scale; out.shirt = c.shirt; out.pants = c.pants; out.skin = c.skin; out.hair = c.hair;
    out.apron = c.apron; out.umbrella = null; out.armsUp = p.armsUp ?? 0;
  }, [list, cols]);
  return <Figures count={list.length} poseAt={poseAt} />;
}

// Figures has no height offset, so people on tall stools go in their own lifted group.
export function People({ list }: { list: Person[] }) {
  const groups = useMemo(() => {
    const m = new Map<number, Person[]>();
    for (const p of list) {
      const k = p.lift ?? 0;
      m.set(k, [...(m.get(k) ?? []), p]);
    }
    return [...m.entries()];
  }, [list]);
  return <>{groups.map(([lift, ps]) => <group key={lift} position={[0, lift, 0]}><Crowd list={ps} /></group>)}</>;
}

// ---- camera
// Orbit controls that frame a box [x0, z0, x1, z1] (plus WALL_H of height) from the front-right, for whatever size the
// canvas has, with room left for the panels laid over it. Re-frames when the box or the canvas size changes; between
// those the viewer orbits freely.
export function FitControls({ box, dir = [0.55, 0.95, 1.25], pad = 1.25, lift = 0 }: {
  box: [number, number, number, number]; dir?: [number, number, number]; pad?: number; lift?: number;
}) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  const ctl = useRef<React.ComponentRef<typeof OrbitControls>>(null);
  const [dist, setDist] = useState(12);
  const [x0, z0, x1, z1] = box;
  useLayoutEffect(() => {
    const target = new THREE.Vector3((x0 + x1) / 2, 0.5 + lift, (z0 + z1) / 2);
    const fwd = new THREE.Vector3(...dir).normalize().negate(); // camera -> target
    const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
    const up = new THREE.Vector3().crossVectors(right, fwd);
    const tv = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2), th = tv * (size.width / Math.max(1, size.height));
    let d = 0;
    const p = new THREE.Vector3();
    for (const x of [x0, x1]) for (const y of [0, WALL_H]) for (const z of [z0, z1]) {
      p.set(x, y, z).sub(target);
      const f = p.dot(fwd);
      d = Math.max(d, Math.abs(p.dot(right)) / th - f, Math.abs(p.dot(up)) / tv - f);
    }
    d *= pad;
    camera.position.copy(target).addScaledVector(fwd, -d);
    camera.near = 0.1;
    camera.far = d * 6 + 50;
    camera.lookAt(target);
    camera.updateProjectionMatrix();
    if (ctl.current) {
      // limits first: update() clamps to them, and the props still hold the previous fit's distance on first mount
      ctl.current.minDistance = Math.min(4, d * 0.5);
      ctl.current.maxDistance = d * 1.8;
      ctl.current.target.copy(target);
      ctl.current.update();
    }
    setDist(d);
    // dir is a constant per caller; the box is compared by value
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [x0, z0, x1, z1, lift, size.width, size.height, camera, pad]);
  return <OrbitControls ref={ctl} makeDefault enablePan={false} minDistance={Math.min(4, dist * 0.5)} maxDistance={dist * 1.8} minPolarAngle={0.2} maxPolarAngle={1.35} />;
}

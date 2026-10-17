// 카페 3D 목업: 엔진(/cafe/preview)이 준 배치(layout, roster)를 상자로만 그린다. 구조 확인용이고, 건희의 3D가 이 위를 덮어쓴다.
// 좌표계는 엔진과 같다: 원점은 방 모서리, +x는 앞벽(창·문)을 따라, +z는 방 안쪽, rot_deg는 위에서 본 시계 방향 회전.
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { GLGuard } from "../shared/GLGuard";

export type LayoutItem = { id: string; type: string; x: number; z: number; rot_deg: number; fits: boolean; w: number; d: number; unassigned?: boolean };
export type RosterItem = { id: string; role: string; label_ko: string; x: number; z: number; fits: boolean };
export type Room3D = { width_m: number; depth_m: number; door: { x: number; w: number } };

// type -> [높이 m, 색, 바닥에서 띄운 높이]
const LOOK: Record<string, [number, string, number?]> = {
  table: [0.74, "#b98a5e"], chair: [0.45, "#7a8da6"], bar_counter: [1.05, "#8a5a3c"], bar_seat: [0.65, "#5b6f8a"],
  espresso: [0.5, "#2b2d30", 0.9], grinder: [0.4, "#4a4d52", 0.9], showcase: [1.1, "#cfe3ee"], oven: [0.6, "#9aa0a6", 0.9],
  kiosk: [1.5, "#256abf"], pos: [0.35, "#33465f", 0.9], fridge: [1.9, "#dfe4ea"], ice_maker: [0.9, "#c9d6e2"], sink: [0.9, "#b8c4d0"],
};
const GHOST = "#d64545";

function Box({ p, s, color, opacity = 1 }: { p: [number, number, number]; s: [number, number, number]; color: string; opacity?: number }) {
  return <mesh position={p} castShadow receiveShadow><boxGeometry args={s} /><meshStandardMaterial color={color} transparent={opacity < 1} opacity={opacity} roughness={0.7} /></mesh>;
}

function Item({ it }: { it: LayoutItem }) {
  const [h, col, lift = 0] = LOOK[it.type] ?? [0.5, "#999"];
  const color = it.fits ? col : GHOST;
  return (
    <group position={[it.x, 0, it.z]} rotation={[0, -(it.rot_deg * Math.PI) / 180, 0]}>
      <Box p={[0, lift + h / 2, 0]} s={[it.w, h, it.d]} color={color} opacity={it.fits ? 1 : 0.55} />
    </group>
  );
}

function Person({ x, z, color }: { x: number; z: number; color: string }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.55, 0]} castShadow><capsuleGeometry args={[0.17, 0.7, 4, 8]} /><meshStandardMaterial color={color} /></mesh>
      <mesh position={[0, 1.28, 0]} castShadow><sphereGeometry args={[0.15, 12, 12]} /><meshStandardMaterial color="#f0d2b6" /></mesh>
    </group>
  );
}

// occupancy: 0~1, 의자(와 바 좌석) 가운데 손님이 앉은 비율. 앉은 의자 위에 손님 모형을 올린다.
export default function CafeRoom3D({ room, layout, roster = [], occupancy = 0, height = 420 }: { room: Room3D; layout: LayoutItem[]; roster?: RosterItem[]; occupancy?: number; height?: number | "fill" }) {
  const { width_m: W, depth_m: D } = room;
  const seats = layout.filter((i) => (i.type === "chair" || i.type === "bar_seat") && i.fits && !i.unassigned);
  const filled = Math.round(seats.length * Math.max(0, Math.min(1, occupancy)));
  const cx = W / 2, cz = D / 2;
  return (
    <div className="cs-3d" style={{ height: height === "fill" ? "100%" : height, borderRadius: height === "fill" ? 0 : undefined }} role="img" aria-label="카페 구조 3D 목업. 테이블, 의자, 카운터, 머신 위치를 상자로 보여 줘요">
      <GLGuard>
        <Canvas shadows camera={{ position: [cx + W * 0.55, Math.max(W, D) * 0.95, cz + D * 1.35], fov: 40 }} dpr={[1, 2]}>
          <ambientLight intensity={1.1} />
          <directionalLight position={[cx - 6, 12, cz + 8]} intensity={1.6} castShadow />
          <group position={[-cx, 0, -cz]}>
            <Box p={[cx, -0.025, cz]} s={[W, 0.05, D]} color="#e9e2d4" />
            {/* 뒤·왼쪽 벽만 낮게 세워 안이 보이게 한다. 앞벽(z=0)에는 문 자리만 표시 */}
            <Box p={[cx, 0.6, D + 0.05]} s={[W, 1.2, 0.1]} color="#d8cdbb" opacity={0.85} />
            <Box p={[-0.05, 0.6, cz]} s={[0.1, 1.2, D]} color="#d8cdbb" opacity={0.85} />
            <Box p={[room.door.x, 0.02, 0.05]} s={[room.door.w, 0.04, 0.1]} color="#2e9d63" />
            {layout.map((it) => <Item key={it.id} it={it} />)}
            {seats.slice(0, filled).map((s) => <Person key={`g-${s.id}`} x={s.x} z={s.z} color="#e0735a" />)}
            {roster.map((r) => <Person key={r.id} x={r.x} z={r.z} color={r.role === "barista" ? "#35614a" : r.role === "cashier" ? "#d4a032" : "#43648a"} />)}
          </group>
          <OrbitControls enablePan={false} target={[0, 0.4, 0]} minDistance={5} maxDistance={32} minPolarAngle={0.2} maxPolarAngle={1.35} />
        </Canvas>
      </GLGuard>
    </div>
  );
}

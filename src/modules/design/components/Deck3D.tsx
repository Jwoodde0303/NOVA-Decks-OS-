"use client";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { DeckAnalysis, DeckDesignModel } from "@/modules/design/model";
import type { FramingResult } from "@/modules/framing/generate";

const FT = 1 / 12; // scene units are feet; model is inches

/** Rotatable 3D preview built from the same design model (and generated framing) as the plan and takeoff. */
export function Deck3D({ model, analysis, framing, boardColor }: { model: DeckDesignModel; analysis: DeckAnalysis; framing?: FramingResult; boardColor?: string }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{ scene: THREE.Scene; group: THREE.Group; controls: OrbitControls; camera: THREE.PerspectiveCamera } | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.shadowMap.enabled = true;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xe9eef2);
    const camera = new THREE.PerspectiveCamera(40, mount.clientWidth / mount.clientHeight, 0.1, 500);
    camera.position.set(30, 16, 32);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI / 2 + 0.35; // allow looking slightly up under the deck to see framing

    scene.add(new THREE.HemisphereLight(0xffffff, 0xb8b0a0, 0.9));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(20, 30, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = sun.shadow.camera.bottom = -40;
    sun.shadow.camera.right = sun.shadow.camera.top = 40;
    scene.add(sun);

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: 0x9fb48a }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const group = new THREE.Group();
    scene.add(group);
    sceneRef.current = { scene, group, controls, camera };

    let frame = 0;
    const loop = () => {
      controls.update();
      renderer.render(scene, camera);
      frame = requestAnimationFrame(loop);
    };
    loop();
    const ro = new ResizeObserver(() => {
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    });
    ro.observe(mount);
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      controls.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    const s = sceneRef.current;
    if (!s) return;
    s.group.clear();
    buildDeck(s.group, model, analysis, framing, boardColor);
    const w = model.widthIn * FT;
    const d = model.depthIn * FT;
    s.controls.target.set(w / 2, (model.heightIn * FT) / 2, d / 2);
    s.controls.update();
  }, [model, analysis, framing, boardColor]);

  return <div ref={mountRef} className="h-full w-full" />;
}

function box(w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number, group: THREE.Group, shadow = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  m.receiveShadow = true;
  group.add(m);
  return m;
}

function buildDeck(group: THREE.Group, m: DeckDesignModel, a: DeckAnalysis, f: FramingResult | undefined, boardColor?: string) {
  const w = m.widthIn * FT;
  const d = m.depthIn * FT;
  const h = Math.max(m.heightIn * FT, 0.3);
  const deckingT = 1 * FT;
  const base = new THREE.Color(boardColor ?? "#b98a5a");
  const boardMat = new THREE.MeshStandardMaterial({ color: base, roughness: 0.85 });
  const boardMatAlt = new THREE.MeshStandardMaterial({ color: base.clone().multiplyScalar(0.92), roughness: 0.85 });
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x8c7352, roughness: 0.9 }); // treated lumber
  const beamMat = new THREE.MeshStandardMaterial({ color: 0x75603f, roughness: 0.9 });
  const postMat = new THREE.MeshStandardMaterial({ color: 0x6b5236, roughness: 0.9 });
  const concrete = new THREE.MeshStandardMaterial({ color: 0xb9b5ad, roughness: 1 });
  const houseMat = new THREE.MeshStandardMaterial({ color: 0xdcd6cc, roughness: 1 });
  const railMat = new THREE.MeshStandardMaterial({ color: 0x2f2f2f, roughness: 0.6, metalness: 0.3 });
  const hardware = new THREE.MeshStandardMaterial({ color: 0x9aa3ab, metalness: 0.6, roughness: 0.4 });

  // House wall behind the deck (y up, x along the house, z out from the house)
  box(w + 8, h + 10, 1, houseMat, w / 2, (h + 10) / 2, -0.5, group, false);

  // Deck boards: rows parallel to the house at the product pitch
  const pitch = (a.decking?.effectiveWidthIn ?? 6) * FT;
  const rows = Math.ceil(d / pitch);
  const topOfJoists = h - deckingT;
  for (let i = 0; i < rows; i++) {
    const depthHere = Math.min(pitch - 0.02, d - i * pitch);
    if (depthHere <= 0) break;
    box(w, deckingT, depthHere, i % 2 ? boardMatAlt : boardMat, w / 2, h - deckingT / 2, i * pitch + depthHere / 2, group);
  }

  if (f) {
    const jd = f.joists.depthIn * FT;
    const jt = 1.5 * FT;
    const jLen = (f.beam.type === "dropped" ? m.depthIn : m.depthIn - f.beam.widthIn) * FT;
    // Ledger at the house
    box(w, jd, jt, frameMat, w / 2, topOfJoists - jd / 2, jt / 2, group);
    // Joists
    for (const x of f.joists.positionsIn) box(jt, jd, jLen, frameMat, Math.min(Math.max(x * FT, jt / 2), w - jt / 2), topOfJoists - jd / 2, jLen / 2, group);
    // Rim joist (dropped beam)
    if (f.joists.rimJoist) box(w, jd, jt, frameMat, w / 2, topOfJoists - jd / 2, d - jt / 2, group);
    // Beam
    const bd = f.beam.depthIn * FT;
    const bw = f.beam.widthIn * FT;
    const bz = f.beam.centerlineFromHouseIn * FT;
    const beamTop = f.beam.type === "dropped" ? topOfJoists - jd : topOfJoists;
    box(w, bd, bw, beamMat, w / 2, beamTop - bd / 2, bz, group);
    // Posts + footings
    const ps = (f.posts.size === "6x6" ? 5.5 : 3.5) * FT;
    const postH = Math.max(f.posts.heightIn, 1) * FT;
    for (const x of f.posts.positionsIn) {
      box(ps, postH, ps, postMat, x * FT, beamTop - bd - postH / 2, bz, group);
      const r = ((f.footings.roundIn ?? 16) / 2) * FT;
      const pier = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.25, 24), concrete);
      pier.position.set(x * FT, 0.12, bz);
      group.add(pier);
    }
    // Blocking over beam
    if (f.joists.blockingOverBeam) {
      const xs = f.joists.positionsIn;
      for (let i = 0; i < xs.length - 1; i++) box((xs[i + 1]! - xs[i]!) * FT - jt, jd * 0.6, jt, frameMat, ((xs[i]! + xs[i + 1]!) / 2) * FT, topOfJoists - (jd * 0.6) / 2, bz, group);
    }
    // Tension ties at the ledger (Method 1)
    for (const j of f.posts.lateral.tensionTieJoistIndexes) box(0.3, 0.12, 1.2, hardware, f.joists.positionsIn[j]! * FT, topOfJoists - jd * 0.5, 0.7, group, false);
    // Knee braces at posts (Method 2)
    if (f.posts.lateral.methods.includes("method-2-knee-bracing-at-beam")) {
      const leg = 2;
      for (const x of f.posts.positionsIn) {
        for (const dir of [-1, 1]) {
          const brace = box(0.125, 0.46, leg * Math.SQRT2, frameMat, x * FT + (dir * leg) / 2, beamTop - bd - leg / 2, bz + 0.3, group);
          brace.rotation.x = 0;
          brace.rotation.z = dir * (Math.PI / 4);
        }
      }
    }
    // Guard posts + rails
    if (f.guards.required) {
      const railH = 3;
      for (const p of f.guards.posts) box(0.29, railH + 0.6, 0.29, railMat, p.x * FT, h + railH / 2 - 0.3, p.y * FT, group);
      for (const r of f.guards.runs) {
        const len = Math.hypot(r.to.x - r.from.x, r.to.y - r.from.y) * FT;
        const top = box(len, 0.15, 0.15, railMat, ((r.from.x + r.to.x) / 2) * FT, h + railH, ((r.from.y + r.to.y) / 2) * FT, group, false);
        top.rotation.y = -Math.atan2(r.to.y - r.from.y, r.to.x - r.from.x);
        const bot = box(len, 0.12, 0.12, railMat, ((r.from.x + r.to.x) / 2) * FT, h + 0.3, ((r.from.y + r.to.y) / 2) * FT, group, false);
        bot.rotation.y = top.rotation.y;
      }
    }
  } else {
    // Fallback schematic when framing is not supplied
    box(w, 0.8, d, frameMat, w / 2, h - 0.45, d / 2, group);
    for (const x of [0.5, w - 0.5]) for (const z of [0.5, d - 0.5]) box(0.5, h, 0.5, postMat, x, h / 2 - 0.1, z, group);
  }

  // Stair: stringers, risers and treads from the shared schematic
  const risers = a.stairSchematic.risers;
  const riseEach = h / risers;
  const run = a.stairSchematic.totalRunIn > 0 ? (a.stairSchematic.totalRunIn / Math.max(1, a.stairSchematic.treads)) * FT : 10 * FT;
  const left = a.outerEdge.leftSegmentIn * FT;
  const open = a.outerEdge.stairOpeningIn * FT;
  const stairW = Math.max(open, 0.5);
  const stairMat = a.valid && (!f || f.ok) ? boardMat : new THREE.MeshStandardMaterial({ color: 0xc8605c, roughness: 0.8 });
  const stringerCount = f?.stair.stringerCount ?? 2;
  const totalRun = run * Math.max(1, a.stairSchematic.treads);
  for (let i = 0; i < stringerCount; i++) {
    const x = left + (stringerCount === 1 ? stairW / 2 : (i * stairW) / (stringerCount - 1));
    const len = Math.hypot(totalRun, h);
    const s = box(0.125, 0.94, len, frameMat, x, h / 2 - 0.5, d + totalRun / 2, group);
    s.rotation.x = Math.atan2(h, totalRun);
  }
  for (let i = 0; i < risers - 1; i++) {
    const y = h - riseEach * (i + 1);
    box(stairW, 0.1, run, stairMat, left + stairW / 2, y, d + run * i + run / 2, group);
    box(stairW, riseEach, 0.07, frameMat, left + stairW / 2, y - riseEach / 2 + 0.05, d + run * i, group, false);
  }
  if (!a.valid) {
    const over = Math.max(0, m.stair.offsetIn + m.stair.widthIn - m.widthIn) * FT;
    if (over > 0) box(over, 0.2, Math.max(totalRun, 1), new THREE.MeshStandardMaterial({ color: 0xa3302e, transparent: true, opacity: 0.5 }), w + over / 2, h, d + totalRun / 2, group, false);
  }
}

"use client";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { DeckAnalysis, DeckDesignModel } from "@/modules/design/model";

const FT = 1 / 12; // scene units are feet; model is inches

/** Rotatable 3D preview built from the same design model as the plan and takeoff. */
export function Deck3D({ model, analysis }: { model: DeckDesignModel; analysis: DeckAnalysis }) {
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
    camera.position.set(28, 18, 30);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI / 2 - 0.02;

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
    buildDeck(s.group, model, analysis);
    const w = model.widthIn * FT;
    const d = model.depthIn * FT;
    s.controls.target.set(w / 2, (model.heightIn * FT) / 2, d / 2);
    s.controls.update();
  }, [model, analysis]);

  return <div ref={mountRef} className="h-full w-full" />;
}

function buildDeck(group: THREE.Group, m: DeckDesignModel, a: DeckAnalysis) {
  const w = m.widthIn * FT;
  const d = m.depthIn * FT;
  const h = Math.max(m.heightIn * FT, 0.3);
  const boardMat = new THREE.MeshStandardMaterial({ color: 0xb98a5a, roughness: 0.85 });
  const boardMatAlt = new THREE.MeshStandardMaterial({ color: 0xa97b4d, roughness: 0.85 });
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x6b5236, roughness: 0.9 });
  const houseMat = new THREE.MeshStandardMaterial({ color: 0xdcd6cc, roughness: 1 });
  const railMat = new THREE.MeshStandardMaterial({ color: 0x2f2f2f, roughness: 0.6, metalness: 0.3 });

  // House wall behind the deck (y runs up, x along house, z out from house)
  const house = new THREE.Mesh(new THREE.BoxGeometry(w + 8, h + 10, 1), houseMat);
  house.position.set(w / 2, (h + 10) / 2, -0.5);
  house.receiveShadow = true;
  group.add(house);

  // Rim/frame
  const rim = new THREE.Mesh(new THREE.BoxGeometry(w, 0.8, d), frameMat);
  rim.position.set(w / 2, h - 0.45, d / 2);
  rim.castShadow = true;
  group.add(rim);

  // Deck boards: rows parallel to house, 5.5" face with a small gap inside a 6" (or product) pitch
  const pitch = (a.decking?.effectiveWidthIn ?? 6) * FT;
  const rows = Math.ceil(d / pitch);
  for (let i = 0; i < rows; i++) {
    const depthHere = Math.min(pitch - 0.04, d - i * pitch);
    if (depthHere <= 0) break;
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, depthHere), i % 2 ? boardMatAlt : boardMat);
    b.position.set(w / 2, h, i * pitch + depthHere / 2);
    b.castShadow = true;
    b.receiveShadow = true;
    group.add(b);
  }

  // Posts (schematic)
  const postGeo = new THREE.BoxGeometry(0.5, h, 0.5);
  const postXs = [0.5, w - 0.5];
  if (w > 10) postXs.splice(1, 0, w / 2);
  for (const x of postXs) {
    for (const z of [0.5, d - 0.5]) {
      const p = new THREE.Mesh(postGeo, frameMat);
      p.position.set(x, h / 2 - 0.1, z);
      p.castShadow = true;
      group.add(p);
    }
  }

  // Guard rail on open perimeter (sides + outer edge minus stair opening) — schematic
  const railH = 3;
  const addRail = (x1: number, z1: number, x2: number, z2: number) => {
    const len = Math.hypot(x2 - x1, z2 - z1);
    if (len < 0.2) return;
    const top = new THREE.Mesh(new THREE.BoxGeometry(len, 0.15, 0.15), railMat);
    top.position.set((x1 + x2) / 2, h + railH, (z1 + z2) / 2);
    top.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
    group.add(top);
    const n = Math.max(1, Math.floor(len / 4));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.15, railH, 0.15), railMat);
      post.position.set(x1 + (x2 - x1) * t, h + railH / 2, z1 + (z2 - z1) * t);
      group.add(post);
    }
  };
  addRail(0, 0, 0, d);
  addRail(w, 0, w, d);
  const left = a.outerEdge.leftSegmentIn * FT;
  const open = a.outerEdge.stairOpeningIn * FT;
  addRail(0, d, left, d);
  addRail(left + open, d, w, d);

  // Stair: schematic stepped boxes projecting out from the outer edge
  const risers = a.stairSchematic.risers;
  const riseEach = h / risers;
  const run = 11 * FT;
  const stairW = Math.max(open, 0.5);
  const stairMat = a.valid ? boardMat : new THREE.MeshStandardMaterial({ color: 0xc8605c, roughness: 0.8 });
  for (let i = 0; i < risers - 1; i++) {
    const tread = new THREE.Mesh(new THREE.BoxGeometry(stairW, 0.12, run), stairMat);
    const y = h - riseEach * (i + 1);
    tread.position.set(left + stairW / 2, y, d + run * i + run / 2);
    tread.castShadow = true;
    group.add(tread);
    const riser = new THREE.Mesh(new THREE.BoxGeometry(stairW, riseEach, 0.08), frameMat);
    riser.position.set(left + stairW / 2, y - riseEach / 2 + 0.06, d + run * i);
    group.add(riser);
  }
  if (!a.valid) {
    // Visual flag for the invalid region beyond the deck edge
    const over = Math.max(0, m.stair.offsetIn + m.stair.widthIn - m.widthIn) * FT;
    if (over > 0) {
      const ghost = new THREE.Mesh(new THREE.BoxGeometry(over, 0.2, Math.max(run * (risers - 1), 1)), new THREE.MeshStandardMaterial({ color: 0xa3302e, transparent: true, opacity: 0.5 }));
      ghost.position.set(w + over / 2, h, d + (run * (risers - 1)) / 2);
      group.add(ghost);
    }
  }
}

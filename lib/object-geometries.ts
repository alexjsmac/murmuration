import * as THREE from "three";
import type { Shape } from "./types";

export const baseGeometries: Record<Shape, THREE.BufferGeometry> = {
  cube: new THREE.BoxGeometry(0.5, 0.5, 0.5),
  ico: new THREE.IcosahedronGeometry(0.42, 0),
  head: new THREE.IcosahedronGeometry(0.45, 1),
  cone: new THREE.ConeGeometry(0.3, 0.7, 6),
  axisGizmo: new THREE.BoxGeometry(0.01, 0.01, 0.01),
};

export const edgesByShape: Record<Shape, THREE.EdgesGeometry> = {
  cube: new THREE.EdgesGeometry(baseGeometries.cube, 15),
  ico: new THREE.EdgesGeometry(baseGeometries.ico, 1),
  head: new THREE.EdgesGeometry(baseGeometries.head, 1),
  cone: new THREE.EdgesGeometry(baseGeometries.cone, 15),
  axisGizmo: new THREE.EdgesGeometry(baseGeometries.axisGizmo, 1),
};

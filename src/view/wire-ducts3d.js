/**
 * 线槽几何：左右竖槽贯通内部全高，顶、底及每两排导轨之间为横槽。
 * 线槽不加盖板，柜内导线在三维视图中保持可见。
 */
import { DUCT_STANDARD } from "../data/cabinets/uolo.js";

const BODY = "#8f989c";
const WALL = "#b3bbbe";

/** Duct rectangles in cabinet coordinates (origin at inner-panel centre, mm). */
export function wireDuctRects(box) {
  const duct = box?.wireDucts;
  if (!duct) return [];
  const w = duct.width, width = box.width, height = box.height;
  const rects = [
    { x: -width / 2 + w / 2, y: 0, w, h: height, vertical: true },
    { x: width / 2 - w / 2, y: 0, w, h: height, vertical: true },
    { x: 0, y: height / 2 - w / 2, w: width - 2 * w, h: w, vertical: false },
    { x: 0, y: -height / 2 + w / 2, w: width - 2 * w, h: w, vertical: false },
  ];
  for (let row = 0; row < box.rows - 1; row++) {
    const railY = height / 2 - box.topRail - row * box.pitch;
    rects.push({ x: 0, y: railY - box.pitch / 2, w: width - 2 * w, h: w, vertical: false });
  }
  return rects;
}

// Cabinet shell walls are 3 mm thick on the inner edge and the mounting plate front sits at z = 3.75;
// ducts must not share any face with them or with each other, otherwise the coincident faces z-fight.
const SHELL = 3, PLATE_FRONT = 3.75, CLEAR = 0.5;

function renderRect(r, box) {
  let { x, y, w, h } = r;
  if (r.vertical) {
    const s = Math.sign(x);
    w -= SHELL + CLEAR; x -= s * (SHELL + CLEAR) / 2;
    h -= 2 * (SHELL + CLEAR);
  } else {
    w -= 2 * CLEAR;
    if (Math.abs(Math.abs(y) - (box.height / 2 - h / 2)) < 1e-6) {
      const s = Math.sign(y);
      h -= SHELL + CLEAR; y -= s * (SHELL + CLEAR) / 2;
    }
  }
  return { x, y, w, h, vertical: r.vertical };
}

/** @param {Function} cube Studio kit cube(group,w,h,d,x,y,z,color,radius,metalness) */
export function addWireDucts(cube, group, box) {
  const depth = box?.wireDucts?.depth || DUCT_STANDARD.ductDepth, wall = 3, z0 = PLATE_FRONT + 0.2;
  for (const r of wireDuctRects(box).map((rect) => renderRect(rect, box))) {
    cube(group, r.w, r.h, wall, r.x, r.y, z0 + wall / 2, BODY, 0.6, 0.2);
    const [dx, dy] = r.vertical ? [(r.w - wall) / 2, 0] : [0, (r.h - wall) / 2];
    for (const side of [-1, 1]) {
      cube(group, r.vertical ? wall : r.w - 2 * CLEAR, r.vertical ? r.h - 2 * CLEAR : wall, depth - wall - CLEAR, r.x + side * dx, r.y + side * dy, z0 + wall + CLEAR + (depth - wall - CLEAR) / 2, WALL, 0.6, 0.2);
    }
  }
}

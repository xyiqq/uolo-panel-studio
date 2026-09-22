/**
 * 断路器 / SPD / 漏保正面精绘（按贴图宽高比生成高分辨率纹理，避免竖图画布被拉糊）。
 */
import { paintModuleFace, faceTextureSize } from "./module-face.js";
import { Is, ye, THREE } from "./three-shim.js";

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} W
 * @param {number} H
 * @param {object} product
 */
export function paintBreakerFace(ctx, W, H, product) {
  paintModuleFace(ctx, W, H, product);
}

/**
 * @param {*} kit Studio kit (ja)
 * @param {object} product
 * @param {number} faceWmm
 * @param {number} faceHmm
 */
export function makeBreakerFaceTexture(kit, product, faceWmm, faceHmm) {
  const { width: texW, height: texH } = faceTextureSize(faceWmm, faceHmm);
  const key = `breaker-vector-v1:${texW}x${texH}:` + JSON.stringify(product);
  if (kit.textures.has(key)) return kit.textures.get(key);

  const canvas = document.createElement("canvas");
  canvas.width = texW;
  canvas.height = texH;
  const ctx = canvas.getContext("2d", { alpha: false });
  paintBreakerFace(ctx, texW, texH, product);

  const tex = new Is(canvas);
  tex.colorSpace = ye;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  kit.textures.set(key, tex);
  kit.own(tex);
  return tex;
}

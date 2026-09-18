import fs from "fs";

const chunk = fs.readFileSync(process.env.TEMP + "/studio-app.js", "utf8");
const header = `/**
 * Studio3D 与机柜模型构建（自 V4 压缩代码恢复）。
 * three 短名见 ./three-shim.js；导体色见 domain。
 */
import {
  ar, qe, mo, Io, AA, sr, Qs, Xs, za, ke, Te,
  rA, Bs, Ts, rr, Yt, Dr, pA, Pe,
  X, pt, jt, St, $t, $e, Ee, Ra, DA, Ls,
  Or, nr, Ws, Is, cA, Ia,
  Be, ye, qi, vi, XA, RA, dr,
} from "./three-shim.js";
import { CONDUCTOR_COLORS as Ue } from "../data/constants.js";

`;
const body = chunk.replace(/;?\s*$/, "");
const footer = `

export { Qo as Studio3D, Qo };
`;
fs.writeFileSync("src/view/studio3d.js", header + body + footer);
console.log("wrote", fs.statSync("src/view/studio3d.js").size);

/**
 * DALI 总线电源。占位按厂家常见 DIN 模位，须以 Spec 复核。
 */
import { makeSmartProduct } from "./_smart-factory.js";
import { dinRail } from "./din-layout.js";

export const DALI_PSU_PRODUCTS = [
  makeSmartProduct({
    id: "lunatone-dali-ps",
    brand: "Lunatone",
    name: "DALI PS",
    sku: "DALI-PS",
    kind: "psu",
    zone: "control",
    protocol: ["dali"],
    powerInput: "LN",
    psuOutput: null,
    ...dinRail({
      modules: 1,
      widthMm: 18,
      heightMm: 90,
      depthMm: 58,
      source: { file: "Lunatone DALI PS 常见 1TE", url: "https://www.lunatone.com/", pages: "TE" },
    }),
  }),
  makeSmartProduct({
    id: "tridonic-dali-ps2",
    brand: "Tridonic",
    name: "DALI PS2",
    sku: "DALI-PS2",
    kind: "psu",
    zone: "control",
    protocol: ["dali"],
    powerInput: "LN",
    psuOutput: null,
    ...dinRail({
      modules: 1,
      widthMm: 18,
      heightMm: 90,
      depthMm: 58,
      source: { file: "Tridonic DALI PS2 常见 1TE", url: "https://www.tridonic.com/", pages: "TE" },
    }),
  }),
  makeSmartProduct({
    id: "mdt-scn-dali64",
    brand: "MDT",
    name: "SCN-DALI64",
    sku: "SCN-DALI64",
    kind: "psu",
    zone: "control",
    protocol: ["dali", "knx"],
    powerInput: "LN",
    psuOutput: null,
    ...dinRail({
      modules: 4,
      widthMm: 72,
      heightMm: 90,
      depthMm: 70,
      source: { file: "MDT SCN-DALI64 常见 4TE", url: "https://www.mdt.de/", pages: "TE" },
    }),
  }),
  makeSmartProduct({
    id: "abb-dg-s",
    brand: "ABB",
    name: "DG/S",
    sku: "DG/S",
    kind: "psu",
    zone: "control",
    protocol: ["dali"],
    powerInput: "LN",
    psuOutput: null,
    ...dinRail({
      modules: 2,
      widthMm: 36,
      heightMm: 90,
      depthMm: 64,
      source: { file: "ABB DG/S 常见 2MW", url: "https://new.abb.com/", pages: "MW" },
    }),
  }),
];

/**
 * 明纬导轨电源。HDR 尺寸来自 MEAN WELL 目录 WxHxD；MDR/NDR 来自系列规格书。
 */
import { makeSmartProduct } from "./_smart-factory.js";
import { dinRail } from "./din-layout.js";

const brand = "明纬";

/** @type {Record<string, {w:number,h:number,d:number,m:number,url?:string}>} */
const DIMS = {
  "HDR-15": { w: 17.5, h: 90, d: 54.5, m: 1, url: "https://www.meanwell.com/productSearch.aspx?pkeywords=HDR" },
  "HDR-30": { w: 35, h: 90, d: 54.5, m: 2 },
  "HDR-60": { w: 52.5, h: 90, d: 54.5, m: 3 },
  "HDR-100": { w: 70, h: 90, d: 54.5, m: 4 },
  "HDR-150": { w: 105, h: 90, d: 54.5, m: 6 },
  "MDR-20": { w: 22.5, h: 90, d: 100, m: 2 },
  "MDR-40": { w: 40, h: 90, d: 100, m: 3 },
  "MDR-60": { w: 40, h: 90, d: 100, m: 3 },
  "NDR-75": { w: 32, h: 125.2, d: 102, m: 2 },
  "NDR-120": { w: 40, h: 125.2, d: 113.5, m: 3 },
  "NDR-240": { w: 63, h: 125.2, d: 113.5, m: 4 },
  "DLP-04R": { w: 35, h: 90, d: 54.5, m: 2, url: "https://www.meanwell.com/meanwell_products.html" },
};

export const MEANWELL_PSU_PRODUCTS = Object.entries(DIMS).map(([sku, dim]) =>
  makeSmartProduct({
    id: `meanwell-${sku.toLowerCase()}`,
    brand,
    name: sku,
    sku,
    kind: "psu",
    zone: "control",
    powerInput: "LN",
    protocol: sku === "DLP-04R" ? ["dali"] : null,
    psuOutput: null,
    note: sku === "DLP-04R"
      ? "DALI 总线电源，外形按官方 DLP-04R 资料。"
      : "系列外形已核；未指定输出电压后缀，具体电压、电流及降额须按完整订货型号选择。",
    ...dinRail({
      modules: dim.m,
      widthMm: dim.w,
      heightMm: dim.h,
      depthMm: dim.d,
      source: {
        file: `MEAN WELL ${sku} Dimension`,
        url: dim.url || (sku.startsWith("HDR") ? "https://www.meanwell.com/productSearch.aspx?pkeywords=HDR" : `https://www.meanwell.com/Upload/PDF/${sku}/${sku}-SPEC.PDF`),
        pages: `${dim.w}×${dim.h}×${dim.d} mm`,
      },
    }),
  })
);

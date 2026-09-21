/**
 * 智能/多品牌产品汇总。
 */
import { CRESTRON_PRODUCTS } from "./smart-crestron.js";
import { LUTRON_PRODUCTS } from "./smart-lutron.js";
import { KNX_PRODUCTS } from "./smart-knx.js";
import { TUYA_DIN_PRODUCTS } from "./smart-tuya-din.js";
import { MEANWELL_PSU_PRODUCTS } from "./psu-meanwell.js";
import { DALI_PSU_PRODUCTS } from "./psu-dali.js";
import { PHOENIX_TERMINAL_PRODUCTS } from "./terminal-phoenix.js";

/** @type {object[]} */
export const SMART_PRODUCTS = [
  ...CRESTRON_PRODUCTS,
  ...LUTRON_PRODUCTS,
  ...KNX_PRODUCTS,
  ...TUYA_DIN_PRODUCTS,
  ...MEANWELL_PSU_PRODUCTS,
  ...DALI_PSU_PRODUCTS,
  ...PHOENIX_TERMINAL_PRODUCTS,
];

export {
  CRESTRON_PRODUCTS,
  LUTRON_PRODUCTS,
  KNX_PRODUCTS,
  TUYA_DIN_PRODUCTS,
  MEANWELL_PSU_PRODUCTS,
  DALI_PSU_PRODUCTS,
  PHOENIX_TERMINAL_PRODUCTS,
};

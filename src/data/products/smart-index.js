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
import { NETWORK_SWITCH_PRODUCTS } from "./network-switches.js";
import { BULL_PDU_PRODUCTS } from './pdu-bull.js';
import { USMART_PRODUCTS } from './smart-usmart.js';

/** @type {object[]} */
export const SMART_PRODUCTS = [
  ...USMART_PRODUCTS,
  ...BULL_PDU_PRODUCTS,
  ...NETWORK_SWITCH_PRODUCTS,
  ...CRESTRON_PRODUCTS,
  ...LUTRON_PRODUCTS,
  ...KNX_PRODUCTS,
  ...TUYA_DIN_PRODUCTS,
  ...MEANWELL_PSU_PRODUCTS,
  ...DALI_PSU_PRODUCTS,
  ...PHOENIX_TERMINAL_PRODUCTS,
];

export {
  USMART_PRODUCTS,
  CRESTRON_PRODUCTS,
  LUTRON_PRODUCTS,
  KNX_PRODUCTS,
  TUYA_DIN_PRODUCTS,
  MEANWELL_PSU_PRODUCTS,
  DALI_PSU_PRODUCTS,
  PHOENIX_TERMINAL_PRODUCTS,
};

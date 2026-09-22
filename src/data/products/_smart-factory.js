/**
 * 智能/待核产品公共工厂。
 * 电气额定默认 null；外形尺寸仅在调用方传入已核验值时写入，禁止编造。
 */

export const PENDING = "参数待核";
export const VERIFIED_DIM = "外形已按厂家资料核验；电气额定仍待核";
export const PENDING_SOURCE = {
  file: "厂家资料待补",
  url: null,
  pages: null,
};

const KIND_COLOR = {
  mcb: "#2a6d8d",
  rcbo: "#2a6d8d",
  rccb: "#2a6d8d",
  relay: "#5a7a8a",
  contactor: "#5a7a8a",
  dimmer: "#6a6a8a",
  meter: "#5a8a7a",
  psu: "#7a8a5a",
  gateway: "#8a6a5a",
  timer: "#6a7a6a",
  terminal: "#8a8f96",
};

/**
 * @param {object} fields
 */
export function makeSmartProduct(fields) {
  const kind = fields.kind;
  const hasDim =
    Number.isFinite(fields.width) &&
    Number.isFinite(fields.modules) &&
    fields.width > 0 &&
    fields.modules > 0;
  return {
    brand: fields.brand,
    name: fields.name,
    sku: fields.sku ?? fields.id,
    id: fields.id,
    kind,
    zone: fields.zone ?? (kind === "psu" || kind === "gateway" || kind === "meter" ? "control" : kind === "mcb" || kind === "rcbo" ? "power" : "control"),
    protocol: fields.protocol ?? null,
    channels: fields.channels ?? null,
    channelAmps: fields.channelAmps ?? null,
    channelWatts: fields.channelWatts ?? null,
    powerInput: fields.powerInput ?? null,
    loadPowerInput: fields.loadPowerInput ?? null,
    daliPowerSupply: fields.daliPowerSupply ?? null,
    busConsumption: fields.busConsumption ?? null,
    psuOutput: fields.psuOutput ?? null,
    meter: fields.meter ?? null,
    heatW: fields.heatW ?? null,
    poles: fields.poles ?? null,
    protectedPoles: fields.protectedPoles ?? null,
    amps: fields.amps ?? null,
    width: hasDim ? fields.width : null,
    height: Number.isFinite(fields.height) ? fields.height : null,
    depth: Number.isFinite(fields.depth) ? fields.depth : null,
    modules: hasDim ? fields.modules : null,
    color: fields.color ?? KIND_COLOR[kind] ?? "#6a7580",
    availability: fields.availability ?? (hasDim ? VERIFIED_DIM : PENDING),
    source: fields.source ?? { ...PENDING_SOURCE },
    smart: fields.smart ?? true,
    terminalColor: fields.terminalColor ?? null,
    conductor: fields.conductor ?? null,
    note:
      fields.note ??
      (hasDim
        ? "导轨占位已按厂家资料填入；电流/总线等电气额定仍待核，不得据图直接施工。"
        : "参数待厂家资料核验后填入，禁止凭印象填写。无外形尺寸时无法上架三维箱体。"),
  };
}

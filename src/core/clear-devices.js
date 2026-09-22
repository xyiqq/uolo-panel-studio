/** 清空装配及其关联数据，保留项目配置、器件库和源表负荷。 */
export function clearDevices(design) {
  design.circuits = [];
  design.modules = [];
  design.buses = [];
  design.protectGroups = [];
  design.includeMain = false;
  design.includeSpd = false;
  design.includeNeutralBar = false;
  design.includeEarthBar = false;
  design.mainProductId = null;
  design.spdProductId = null;
  design.positions = {};
  design.connections = {};
  design.states = {};
  design.wireOverrides = {};
  design.disconnected = [];
  return design;
}

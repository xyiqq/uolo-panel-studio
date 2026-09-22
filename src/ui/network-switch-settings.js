import {SWITCH_ORIENTATIONS,normalizeSwitchSettings} from '../core/network-switch-settings.js';
import {esc} from '../view/terminal-connections.js';
export function networkSwitchFields(product,module={}) {
  if(!product?.networkPorts)return '';
  const settings=normalizeSwitchSettings(module,product),kind=product.networkProfile?"网关":"交换机";
  return `<section class="network-switch-fields"><h3>${kind}朝向与网口信息</h3><label class="field"><span>${kind}朝向</span><select data-switch-orientation="${esc(module.id||'')}">${SWITCH_ORIENTATIONS.map(([key,label])=>`<option value="${key}" ${settings.switchOrientation===key?'selected':''}>${label}</option>`).join('')}</select></label><p class="tiny">填写用途或连接设备，会直接显示在机身标签上；每口最多24字。</p><div class="network-port-inputs">${Object.entries(settings.switchPortLabels).map(([port,label])=>`<label class="field"><span>网口 ${port}${product.networkPortNames?.[+port-1]?" · "+esc(product.networkPortNames[+port-1]):""}</span><input data-switch-port="${port}" data-switch-module="${esc(module.id||'')}" value="${esc(label)}" maxlength="24" placeholder="如：客厅AP / NVR / 上联"></label>`).join('')}</div></section>`;
}
export function readNetworkSwitchFields(root,product) {
  return normalizeSwitchSettings({switchOrientation:root.querySelector('[data-switch-orientation]')?.value,switchPortLabels:Object.fromEntries([...root.querySelectorAll('[data-switch-port]')].map(el=>[el.dataset.switchPort,el.value]))},product);
}

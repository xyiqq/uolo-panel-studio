import {normalizePduSettings} from '../core/pdu-settings.js';
import {esc} from '../view/terminal-connections.js';
export function pduFields(product,module={}){
  if(!product?.outletCount)return '';
  const s=normalizePduSettings(module,product),size={length:product.pduPhysicalLength,height:product.pduPhysicalHeight,depth:product.pduPhysicalDepth,...s.pduSize};
  return `<section class="pdu-fields"><h3>PDU安装与插位设备</h3><label class="field"><span>PDU安装方向</span><select data-pdu-orientation="${esc(module.id||'')}"><option value="vertical" ${s.pduOrientation==='vertical'?'selected':''}>竖装</option><option value="horizontal" ${s.pduOrientation==='horizontal'?'selected':''}>横装</option></select></label><p class="tiny">${esc(product.note)}</p><div class="network-port-inputs">${[['length','建模长度 mm',100,1600],['height','建模面宽 mm',40,120],['depth','建模深度 mm',20,160]].map(([key,label,min,max])=>`<label class="field"><span>${label}</span><input type="number" min="${min}" max="${max}" step="0.1" data-pdu-size="${key}" data-pdu-module="${esc(module.id||'')}" value="${size[key]}"></label>`).join('')}</div><p class="tiny">填写所接设备名称，保存后直接显示在对应插位旁。额定为整条PDU总额定，不可按插位数相乘。</p><div class="network-port-inputs">${Object.entries(s.outletLabels).map(([n,label])=>`<label class="field"><span>插位 ${n} 所接设备</span><input data-pdu-outlet="${n}" data-pdu-module="${esc(module.id||'')}" value="${esc(label)}" maxlength="24" placeholder="如：交换机 / 网关 / NAS"></label>`).join('')}</div></section>`;
}
export function readPduFields(root,product){
  const fields=[...root.querySelectorAll('[data-pdu-size]')];
  if(fields.some(el=>!el.value||!el.checkValidity()))throw new Error('请填写范围内的PDU建模尺寸');
  return normalizePduSettings({pduOrientation:root.querySelector('[data-pdu-orientation]')?.value,pduSize:Object.fromEntries(fields.map(el=>[el.dataset.pduSize,Number(el.value)])),outletLabels:Object.fromEntries([...root.querySelectorAll('[data-pdu-outlet]')].map(el=>[el.dataset.pduOutlet,el.value]))},product);
}

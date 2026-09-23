// @vitest-environment jsdom
import {it,expect,vi} from 'vitest';
import {openDuctCabinetDialog} from '../../src/ui/duct-cabinet-dialog.js';
import {createBlankDesign} from '../../src/data/design-templates.js';
import {validateDesign,buildAssembly} from '../../src/core/domain.js';

it('按输入的内部尺寸实时预览，生成自定义线槽箱并切换，方案可重新校验与装配',()=>{
  document.body.innerHTML='<div id="m"></div>';
  const design=createBlankDesign();
  const close=vi.fn(),toast=vi.fn();
  openDuctCabinetDialog({open:(_t,html)=>{document.querySelector('#m').innerHTML=html;},close,toast,commit:fn=>fn(design)});
  const set=(id,v)=>{const el=document.querySelector('#duct-'+id);el.value=v;el.dispatchEvent(new Event('input'));};
  set('innerWidth','800');set('innerHeight','1300');
  expect(document.querySelector('#duct-preview').textContent).toContain('外形 870×1390×170 mm');
  expect(document.querySelector('#duct-preview').textContent).toContain('7 排');
  set('rows','20');
  expect(document.querySelector('#duct-save').disabled).toBe(true);
  set('rows','6');set('sideMargin','50');
  expect(document.querySelector('#duct-preview').textContent).toContain('外形 900×1390');
  document.querySelector('#duct-save').click();
  expect(close).toHaveBeenCalled();
  const cab=design.customCabinets.at(-1);
  expect(design.cabinet).toBe(cab.id);expect(cab.wireDucts.width).toBe(40);expect(cab.rows).toBe(6);
  const reloaded=validateDesign(JSON.parse(JSON.stringify(design)));
  const a=buildAssembly(reloaded);
  expect(a.box.wireDucts.zoneWidth).toBe(720);expect(a.box.outer.slice(0,2)).toEqual([900,1390]);
});

// @vitest-environment jsdom
import {expect,it} from 'vitest';
import {bindDaliPowerFields,daliPowerFields} from '../../src/ui/dali-power-settings.js';
import {findProduct} from '../../src/core/domain.js';

it('edits two independent supplies, releases a previous selection, and clears both for INT',()=>{
  const gateway={id:'GW',productId:'crestron-din-dali-2',daliPowerMode:'EXT',daliLoopSupplies:{1:'PS1',2:'PS2'}};
  const design={modules:[gateway,...['PS1','PS2'].map(id=>({id,productId:'lunatone-dali-ps-24033444'}))],buses:[]};
  const resolve=id=>findProduct(design,id);
  document.body.innerHTML=daliPowerFields(gateway);
  const read=bindDaliPowerFields(document.body,design,gateway,resolve(gateway.productId),resolve);
  const field=id=>document.getElementById(id);
  const choose=(id,v)=>{const select=field(id);select.value=v;select.dispatchEvent(new Event('change'));};
  expect(field('mod-dali-budget').textContent).toContain('2 W');
  expect([...field('mod-dali-supply-1').options].map(o=>o.value)).toEqual(['','PS1']);
  choose('mod-dali-supply-1','');
  choose('mod-dali-supply-2','PS1');
  choose('mod-dali-supply-1','PS2');
  expect(read()).toEqual({mode:'EXT',loopSupplies:{1:'PS2',2:'PS1'}});
  choose('mod-dali-mode','INT');
  expect(read()).toEqual({mode:'INT',loopSupplies:{}});
  expect(field('mod-dali-supplies').hidden).toBe(true);
  expect(field('mod-dali-budget').textContent).toContain('9 W');
  expect(gateway.daliLoopSupplies).toEqual({1:'PS1',2:'PS2'});
});

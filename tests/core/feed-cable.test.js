import {it,expect} from 'vitest';
import {createBlankDesign} from '../../src/data/design-templates.js';
import {validateDesign,auditDesign,auditWiring,buildWiring} from '../../src/core/domain.js';

const design=(feedAmbient,feedBunched)=>validateDesign(createBlankDesign({supply:'three',mainAmps:80,feedAmbient,feedBunched}));

it('进户电缆载流满足总开时保留初筛说明且无 WIRE_IZ',()=>{
  const d=design(30,1),supply=auditDesign(d).find(i=>i.code==='SUPPLY_CAPACITY');
  expect(supply.text).toContain('25mm² 按录入敷设条件初筛');
  expect(auditWiring(buildWiring(d),d).some(i=>i.code==='WIRE_IZ'&&i.text.startsWith('入户电缆'))).toBe(false);
});

it.each([[45,1],[40,3]])('环境 %s°C、并敷 %s 根时进户电缆超出载流表，要求人工选型并报 WIRE_IZ',(ambient,bunched)=>{
  const d=design(ambient,bunched),supply=auditDesign(d).find(i=>i.code==='SUPPLY_CAPACITY');
  expect(supply.text).toContain('进户电缆需人工选型');
  expect(supply.text).not.toContain('初筛');
  expect(auditWiring(buildWiring(d),d).some(i=>i.level==='error'&&i.code==='WIRE_IZ'&&i.text.startsWith('入户电缆'))).toBe(true);
});

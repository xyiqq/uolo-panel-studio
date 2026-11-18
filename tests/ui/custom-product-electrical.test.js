// @vitest-environment jsdom
import {describe, it, expect} from 'vitest';
import {customElectricalFields, readCustomElectrical} from '../../src/ui/custom-product-electrical.js';
import {normalizeCustomElectrical} from '../../src/core/custom-product-electrical.js';

const escape = value => String(value).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
function render(product) {
  document.body.innerHTML=customElectricalFields(product,(label,input)=>`<label>${label}${input}</label>`,escape)+'<input id="lib-source" value="https://example.com/spec">';
  return document.body;
}
describe('custom electrical editor fields',()=>{
  it('renders and reads existing supply spelling, source and PSU units without losing them',()=>{
    const root=render({powerInput:'DC12',loadPowerInput:'LN',psuOutput:{voltage:12,milliamps:500},source:{file:'Spec <2026>',pages:'3–4'},busConsumption:{unit:'mA',value:10}});
    expect(root.querySelector('#lib-control-power').value).toBe('DC12');
    expect(readCustomElectrical(root,'psu')).toMatchObject({powerInput:'DC12',loadPowerInput:'LN',psuOutput:{voltage:12,amps:.5,watts:null},source:{file:'Spec <2026>',pages:'3–4'},busConsumption:{unit:'mA',value:10}});
  });
  it('keeps new products unknown and never offers legacy inferred supply',()=>{
    const root=render({powerInput:'unknown',loadPowerInput:'unknown'});
    expect(root.querySelector('#lib-control-power option[value="legacy"]')).toBeNull();
    expect(readCustomElectrical(root,'relay')).toMatchObject({powerInput:'unknown',loadPowerInput:'unknown',busConsumption:null,powerConsumptionW:null,channelAmps:null});
  });
  it('keeps legacy omitted fields omitted and rejects negative form entries',()=>{
    const root=render({});
    expect(readCustomElectrical(root,'relay').powerInput).toBeUndefined();
    root.querySelector('#lib-channel-watts').value='-1';
    expect(()=>normalizeCustomElectrical({...readCustomElectrical(root,'relay'),kind:'relay'})).toThrow('通道功率');
  });
});

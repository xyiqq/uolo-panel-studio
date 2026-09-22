// @vitest-environment jsdom
import {it, expect, vi} from 'vitest';
import {renderTerminalConnections} from '../../src/ui/terminal-connections.js';

function fixture() {
  const design={modules:[{id:'T1',productId:'terminal'},{id:'T2',productId:'terminal',terminalConnections:{1:{output:'K1:CH2_OUT'}}},{id:'K1',productId:'relay',label:'继电器'}]};
  const resolve=id=>id==='terminal'?{kind:'terminal',poles:4,terminalColor:'gray'}:{kind:'relay',channels:8};
  const root=document.createElement('div');
  const commit=vi.fn(fn=>fn(design));
  renderTerminalConnections({root,design,resolve,commit,download:vi.fn(),terminalId:'T1'});
  const select=(index,value)=>{
    const el=root.querySelector(`[data-connection="${index}"] [data-field="output"]`);
    el.value=value;
    el.dispatchEvent(new Event('change',{bubbles:true}));
  };
  return {root,design,commit,select};
}

it('defaults to 1.5 and confirms same-group gauge and padded sequential numbers without saving early',()=>{
  const {root,design,commit}=fixture();
  const field=(i,key)=>root.querySelector(`[data-connection="${i}"] [data-field="${key}"]`);
  const change=(i,key,value)=>{field(i,key).value=value;field(i,key).dispatchEvent(new Event('change',{bubbles:true}));};
  expect(field(0,'section').value).toBe('1.5');
  change(0,'section','2.5');
  expect(field(1,'section').value).toBe('1.5');
  root.querySelector('[data-batch-prompt="section"] [data-batch-apply]').click();
  expect([0,1,2,3].map(i=>field(i,'section').value)).toEqual(['2.5','2.5','2.5','2.5']);
  expect(field(4,'section').value).toBe('1.5');
  change(2,'wireNo','OLD');change(4,'wireNo','WL-010');change(0,'wireNo','WL-009');
  root.querySelector('[data-batch-prompt="wireNo"] [data-batch-apply]').click();
  expect([0,1,2,3].map(i=>field(i,'wireNo').value)).toEqual(['WL-009','WL-011','OLD','WL-012']);
  expect(commit).not.toHaveBeenCalled();
  root.querySelector('#terminal-save').click();
  expect(design.modules[0].terminalConnections[4]).toMatchObject({wireNo:'WL-012',section:2.5});
});

it('allows declining gauge propagation and requires a numeric suffix for numbering',()=>{
  const {root}=fixture();
  const change=(key,value)=>{const el=root.querySelector(`[data-connection="0"] [data-field="${key}"]`);el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}));};
  change('section','4');root.querySelector('[data-batch-dismiss]').click();
  expect(root.querySelector('[data-connection="1"] [data-field="section"]').value).toBe('1.5');
  change('wireNo','LIGHT');expect(root.querySelector('[data-batch-prompt="wireNo"]')).toBeNull();
  expect(root.querySelector('.terminal-status').textContent).toContain('末尾请填写数字');
});

it('asks after first selection, fills draft after confirmation and persists only with save',()=>{
  const {root,design,commit,select}=fixture();
  select(0,'K1:CH1_OUT');
  expect(root.querySelector('[data-sequence-prompt]').textContent).toContain('后续 3 节');
  expect(root.querySelector('[data-connection="1"] [data-field="output"]').value).toBe('');
  root.querySelector('[data-sequence-apply]').click();
  expect([0,1,2,3].map(i=>root.querySelector(`[data-connection="${i}"] [data-field="output"]`).value)).toEqual(['K1:CH1_OUT','K1:CH3_OUT','K1:CH4_OUT','K1:CH5_OUT']);
  expect(root.querySelector('[data-sequence-prompt]')).toBeNull();
  expect(commit).not.toHaveBeenCalled();
  expect(design.modules[0].terminalConnections).toBeUndefined();
  root.querySelector('#terminal-save').click();
  expect(commit).toHaveBeenCalledOnce();
  expect(design.modules[0].terminalConnections[4].output).toBe('K1:CH5_OUT');
  expect(design.modules[1].terminalConnections[1].output).toBe('K1:CH2_OUT');
});

it('allows manual selection, only prompts on the first slice, and clears prompt when deselected',()=>{
  const {root,select}=fixture();
  select(1,'K1:CH3_OUT');
  expect(root.querySelector('[data-sequence-prompt]')).toBeNull();
  select(0,'K1:CH1_OUT');
  root.querySelector('[data-sequence-dismiss]').click();
  expect(root.querySelector('[data-sequence-prompt]')).toBeNull();
  select(0,'K1:CH4_OUT');
  expect(root.querySelector('[data-sequence-prompt]')).not.toBeNull();
  select(0,'');
  expect(root.querySelector('[data-sequence-prompt]')).toBeNull();
  expect(root.querySelector('[data-connection="1"] [data-field="output"]').value).toBe('K1:CH3_OUT');
});

import {it,expect,vi} from 'vitest';
import {createDefaultDesign,buildAssembly,clone} from '../../src/core/domain.js';
import {normalizeModules,nextModuleId} from '../../src/core/modules.js';

it('品牌下没有候选保护器件时回路标为不合格而不是崩溃',()=>{
  const d=clone(createDefaultDesign());d.brand='NoSuchBrand';
  const branches=buildAssembly(d).nodes.filter(n=>n.role==='branch'&&n.circuit.voltage===220);
  expect(branches.length).toBeGreaterThan(0);
  expect(branches.every(n=>n.product&&n.match.valid===false)).toBe(true);
});

it('SPD 产品缺失时给出明确错误',()=>{
  const d=clone(createDefaultDesign());d.includeSpd=true;d.spdProductId='NOPE';
  expect(()=>buildAssembly(d)).toThrow('未核实的产品 NOPE');
});

it('丢弃非法模块时输出告警',()=>{
  const warn=vi.spyOn(console,'warn').mockImplementation(()=>{});
  const d={modules:[{id:'BAD1',productId:'missing'}]};
  normalizeModules(d,()=>{throw new Error('未知产品');});
  expect(d.modules).toEqual([]);
  expect(warn).toHaveBeenCalledWith(expect.stringContaining('BAD1'));
  warn.mockRestore();
});

it('模块编号超过 999 仍按序递增',()=>{
  const modules=Array.from({length:1000},(_,i)=>({id:`K${i+1}`}));
  const id=nextModuleId({modules},'relay');
  expect(id).toMatch(/^[A-Z]+\d+$/);
  expect(modules.some(m=>m.id===id)).toBe(false);
});

import {it, expect} from 'vitest';
import {sequentialTerminalRows} from '../../src/core/terminal-connections.js';

const outputs = ['K1:CH1_OUT','K1:CH2_OUT','K1:CH3_OUT','K2:CH1_OUT','K2:CH2_OUT'].map(value=>({value}));
const row = (pole,output='',terminalId='T1',color='gray') => ({terminalId,pole,output,color,loadName:'客厅',wireNo:'L1'});

it('fills only later empty slices in this group, skipping occupied channels and preserving metadata',()=>{
  const rows=[row(1,'K1:CH1_OUT'),row(2),row(3,'K2:CH2_OUT'),row(4),row(1,'K1:CH2_OUT','T2'),row(2,'','T2')];
  const before=structuredClone(rows);
  const result=sequentialTerminalRows(rows,outputs,'T1');
  expect(result.count).toBe(2);
  expect(result.rows.map(r=>r.output)).toEqual(['K1:CH1_OUT','K1:CH3_OUT','K2:CH2_OUT','K2:CH1_OUT','K1:CH2_OUT','']);
  expect(result.rows[1].loadName).toBe('客厅');
  expect(result.rows[1].wireNo).toBe('L1');
  expect(rows).toEqual(before);
});

it('starts after the selected channel, follows numerical pole order and stops when channels run out',()=>{
  const result=sequentialTerminalRows([row(1,'K1:CH3_OUT'),row(4),row(3),row(2)],outputs,'T1');
  expect(result.count).toBe(2);
  expect(result.rows.map(r=>r.output)).toEqual(['K1:CH3_OUT','','K2:CH2_OUT','K2:CH1_OUT']);
});

it('does nothing for blue terminals or an empty, unknown or absent first selection',()=>{
  for(const rows of [[row(1,'K1:CH1_OUT','T1','blue'),row(2,'','T1','blue')],[row(1),row(2)],[row(1,'missing'),row(2)],[row(2)]]) {
    expect(sequentialTerminalRows(rows,outputs,'T1')).toEqual({rows,count:0});
  }
});

import {it,expect} from 'vitest';
import {preferredInstallPosition} from '../../src/ui/install-position.js';

it('保留自动、空闲位置，并在位置占用时优先同排后续空位',()=>{
  const slots=[{row:0,slot:0},{row:2,slot:0},{row:2,slot:8},{row:3,slot:0}];
  expect(preferredInstallPosition(slots,'auto')).toBe('auto');
  expect(preferredInstallPosition(slots,'2_8')).toBe('2_8');
  expect(preferredInstallPosition(slots,'2_4')).toBe('2_8');
  expect(preferredInstallPosition(slots,'2_20')).toBe('2_0');
  expect(preferredInstallPosition(slots,'1_0')).toBe('2_0');
  expect(preferredInstallPosition(slots,'99_0')).toBe('0_0');
  expect(preferredInstallPosition([],'2_4')).toBe('auto');
});

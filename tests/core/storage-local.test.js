// @vitest-environment jsdom
import {beforeEach,it,expect,vi} from 'vitest';
import {localStorageAdapter} from '../../src/storage/index.js';

beforeEach(()=>localStorage.clear());

it('按 id 加载不存在的方案时返回空，而不是回退到 V4 旧方案',async()=>{
  localStorage.setItem('panel-studio-v4',JSON.stringify({name:'旧方案'}));
  expect(await localStorageAdapter.load('missing')).toBeNull();
  const id=await localStorageAdapter.save({name:'新方案'});
  expect((await localStorageAdapter.load(id)).name).toBe('新方案');
});

it('存储配额不足时抛出可读错误',async()=>{
  const spy=vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new DOMException('full','QuotaExceededError');});
  await expect(localStorageAdapter.save({name:'x'})).rejects.toThrow('本机存储空间不足');
  spy.mockRestore();
});

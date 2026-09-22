import {describe,it,expect} from 'vitest';
import {createDefaultDesign,validateDesign} from '../../src/core/domain.js';

describe('进线示意显示设置',()=>{
  it('新旧方案均隐藏进线示意，不改接线数据',()=>{
    const design=createDefaultDesign();
    expect(validateDesign(design).showSupplyIllustration).toBe(false);
    expect(validateDesign({...design,showSupplyIllustration:true}).showSupplyIllustration).toBe(false);
    const hidden=validateDesign(JSON.parse(JSON.stringify({...design,showSupplyIllustration:false})));
    expect(hidden.showSupplyIllustration).toBe(false);
    expect(hidden.circuits).toEqual(validateDesign(design).circuits);
    expect(hidden.connections).toEqual(validateDesign(design).connections);
  });
});

import {VALUES} from './rules.js?v=18';
export const BLACK_PANELS=VALUES.filter(value=>![5,15,100].includes(value));
export class BlackPanelBonuses{
 constructor(random=Math.random){this.random=random;this.reset();}
 reset(){const pool=[...BLACK_PANELS];this.targets=['coins','free-spin'].map(kind=>{const i=Math.min(pool.length-1,Math.max(0,Math.floor(this.random()*pool.length)));return{value:pool.splice(i,1)[0],kind,claimed:false};});}
 get active(){return this.targets.filter(target=>!target.claimed);}
 claim(value,{full,stage,total}){if(!full||stage!=='normal'||total>100||total<=0||!BLACK_PANELS.includes(value))return null;const target=this.targets.find(t=>t.value===value&&!t.claimed);if(!target)return null;target.claimed=true;return{value,kind:target.kind};}
}

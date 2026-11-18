const assert = require('node:assert/strict');
const B = require('../binary-model.js');
const p={m1:1.2,m2:.8,r1:1.2,r2:.8,t1:6500,t2:4500,period:3,inc:89,e:.4,omega:40};
let count=0;
function test(name,fn){fn();count++;console.log('PASS '+name);}
function close(a,b,t=1e-7){assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);}
test('Kepler residual over supported eccentricities',()=>{for(const e of [0,.2,.8])for(let j=-100;j<=100;j++){let M=j*Math.PI/100,E=B.kepler(M,e);close(Math.sin(E-e*Math.sin(E)),Math.sin(M),1e-12);}});
test('eccentric RV is the derivative of the plotted orbit and conserves momentum',()=>{const d=B.derive(p);for(let j=0;j<100;j++){const t=j/100,h=1e-6,a=B.sample(p,t-h,d),b=B.sample(p,t+h,d),c=B.sample(p,t,d);close(c.rv1,-(b.star1.z-a.star1.z)*6.957e5/(2*h*p.period*86400),1e-5);close(p.m1*c.rv1+p.m2*c.rv2,0);}});
test('eccentric contacts and non-half-period eclipse spacing',()=>{const d=B.derive(p);assert.ok(Math.abs(Math.abs(d.primaryPhase-d.secondaryPhase)-.5)>.05);for(const ev of d.events){close(B.sample(p,ev.start,d).separation,p.r1+p.r2);close(B.sample(p,ev.end,d).separation,p.r1+p.r2);assert.ok(ev.end>ev.start);}});
test('third light dilutes depth without changing geometry',()=>{const a=B.derive(p),q={...p,third:2},b=B.derive(q);close(a.depth1/3,b.depth1);close(a.primaryPhase,b.primaryPhase);});
test('limb integral agrees with analytic centered linear occultation',()=>{const r=.4,u=.6;const exact=((1-u)*r*r+2*u/3*(1-(1-r*r)**1.5))/(1-u/3);close(B.blockedFraction(1,r,0,{u,v:0}),exact,2e-5);});
test('quadratic annulus convergence',()=>{for(const sep of [0,.2,.8,1.2])close(B.blockedFraction(1,.7,sep,{u:.4,v:.2},256),B.blockedFraction(1,.7,sep,{u:.4,v:.2},4096),6e-5);});
test('exposure integral converges and wraps',()=>{const q={...p,exposure:20},d=B.derive(q);for(const t of [0,d.primaryPhase,d.events[0].start]){close(B.observedFlux(q,t,d),B.observedFlux(q,t,d,256),2e-5);close(B.observedFlux(q,t,d),B.observedFlux(q,t+1,d));}});
test('collision at periastron invalidates flux',()=>{const q={...p,e:.8,r1:2,r2:2};assert.equal(B.derive(q).valid,false);assert.equal(B.sample(q,0).flux,null);});
test('invalid advanced values are rejected',()=>{for(const change of [{e:.9},{omega:NaN},{third:-1},{noise:-1},{exposure:500},{ld1:'quadratic',u1:.9,v1:.2}])assert.throws(()=>B.derive({...p,...change}),{name:'RangeError'});});
test('noise fixed and approximately standard normal',()=>{const v=Array.from({length:5000},(_,j)=>B.gaussian(j));close(B.gaussian(1),B.gaussian(1));assert.ok(Math.abs(v.reduce((a,b)=>a+b,0)/v.length)<.05);assert.ok(Math.abs(v.reduce((a,b)=>a+b*b,0)/v.length-1)<.06);});
console.log(`${count} advanced tests passed`);

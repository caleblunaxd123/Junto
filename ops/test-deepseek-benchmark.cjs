const {test} = require('node:test');
const assert = require('node:assert/strict');
const {estimateUpperCost,reserve,requestBody,evaluate} = require('./deepseek-benchmark.cjs');
const corpus = require('../ai/seed-cases.json');
test('Budget is reserved before a request and survives failed/unknown outcomes',()=>{
  let state = {version:1,attempts:[]};
  for(let i=0;i<20;i++) state=reserve(state,'fictional-'+i);
  assert.throws(()=>reserve(state,'more'));
  assert.throws(()=>reserve(state,'fictional-0'));
  assert.equal(state.attempts.reduce((n,a)=>n+a.reservedUsd,0).toFixed(2),'1.00');
  assert.throws(()=>reserve({version:1,attempts:[{reservedUsd:-1}]},'bad'));
});
test('Only curated fictional inputs, bounded output and disabled thinking',()=>{
  assert.throws(()=>requestBody({text:'private user data'}));
  for(const c of corpus.cases) {
    const body=requestBody(c);
    assert.equal(body.max_tokens,512); assert.equal(body.thinking.type,'disabled'); assert.equal(body.model,'deepseek-flash');
    assert.equal(body.response_format.type,'json_object');
  }
  assert.ok(estimateUpperCost(5000,512)<0.05);
  assert.throws(()=>estimateUpperCost(100,513)); assert.throws(()=>estimateUpperCost(NaN,50));
});
test('Unknown names, missing confirmation and invented financial results fail',()=>{
  const c=corpus.cases[0];
  const answer={action:'propose',payer:'Ana',participants:c.members,invited:[],split:'equal',question:'',explanation:'',quotedNetCents:null,confirmationRequired:true};
  assert.ok(evaluate(c,answer));
  assert.equal(evaluate(c,{...answer,payer:'Unknown'}),false);
  assert.equal(evaluate(c,{...answer,confirmationRequired:false}),false);
  const explain=corpus.cases.find(c=>c.expected.action==='explain');
  const response={...answer,action:'explain',payer:null,participants:[],split:null,explanation:'Te corresponde cobrar el saldo verificado.',quotedNetCents:explain.expected.net,confirmationRequired:false};
  assert.ok(evaluate(explain,response)); assert.equal(evaluate(explain,{...response,quotedNetCents:1}),false);
});

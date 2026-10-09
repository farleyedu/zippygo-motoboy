const {test}=require('node:test'),assert=require('node:assert/strict');
const {load}=require('../lote3/session-tests.cjs');
const {parseCents,paymentError,readyToComplete}=load('src/delivery/completionRules.ts');
test('Centavos são inteiros; rejeita arredondamento e formatos ambíguos',()=>{assert.equal(parseCents('86,90'),8690);assert.equal(parseCents('100.5'),10050);assert.equal(parseCents('86,901'),null);assert.equal(parseCents('1.000,00'),null);assert.equal(parseCents('-1'),null);});
test('Duas partes, troco e recebimento explícito',()=>{const parts=[{method:'pix',amount:20,receivedConfirmed:true},{method:'dinheiro',amount:66.90,cashReceived:100,receivedConfirmed:true}];assert.equal(paymentError(86.9,parts),null);parts[1].cashReceived=60;assert.ok(paymentError(86.9,parts));parts[1].cashReceived=100;parts[0].receivedConfirmed=false;assert.ok(paymentError(86.9,parts));});
test('Arraste exige todas as conferências devidas',()=>{const c={requiresCode:true,requiresPayment:true,requiresProof:true,total:86.9};const parts=[{method:'pix',amount:86.9,receivedConfirmed:true}];assert.equal(readyToComplete(c,true,parts,'prova'),true);assert.equal(readyToComplete(c,false,parts,'prova'),false);assert.equal(readyToComplete(c,true,parts),false);assert.equal(readyToComplete(c,true,[],'prova'),false);});

test('Entrega exige todos os produtos e segunda conferência das bebidas',()=>{
  const context={requiresCode:false,requiresPayment:false,requiresProof:false,checklist:{version:'bag-v2',detailsUnavailable:false,items:[{key:'combo',name:'Combo',quantity:2,extra:false},{key:'suco',name:'Suco',quantity:2,extra:true}]}};
  const check={pedidoId:23,version:'bag-v2',confirmedKeys:['combo','suco'],recheckedExtraKeys:[]};
  assert.equal(readyToComplete(context,false,[],undefined,check),false);
  check.recheckedExtraKeys=['suco'];assert.equal(readyToComplete(context,false,[],undefined,check),true);
  check.version='bag-v1';assert.equal(readyToComplete(context,false,[],undefined,check),false);
  check.version='bag-v2';check.confirmedKeys=['combo'];assert.equal(readyToComplete(context,false,[],undefined,check),false);
});

test('Pedido sem itens exige confirmação manual e reconfirmação dos volumes',()=>{
  const context={requiresCode:false,requiresPayment:false,requiresProof:false,checklist:{version:'manual-v1',detailsUnavailable:true,items:[]}};
  assert.equal(readyToComplete(context,false,[]),false);
  const check={pedidoId:23,version:'manual-v1',confirmedKeys:['manual'],recheckedExtraKeys:[]};
  assert.equal(readyToComplete(context,false,[],undefined,check),false);
  check.recheckedExtraKeys=['manual'];assert.equal(readyToComplete(context,false,[],undefined,check),true);
});

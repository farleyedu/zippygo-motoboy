// QA do bundle Expo real, com API e WebSocket interceptados. Nenhuma conta/pedido real.
const {chromium}=require(process.env.QA_PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const base=process.env.QA_BASE_URL||'http://127.0.0.1:8196',out=path.resolve(__dirname,'../../../.expo/validation-etapa34');
const user={id:'qa34',nome:'Farley QA',email:'qa34@exemplo.com',role:'motoboy'},shop={id:'11111111-1111-1111-1111-111111111111',nome:'Forno & Lenha QA'};
const session={sessionId:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',epoch:7,isEnded:false,heartbeatIntervalSeconds:60,version:1};
const order={id:23,nomeCliente:'Maria Oliveira',enderecoEntrega:'Rua dos Ipês, 128',bairro:'Jardim Primavera',cidade:'Campinas',estado:'SP',latitude:-22.9,longitude:-47.06,value:86.90,statusPagamento:'a_receber',requerCodigoEntrega:true,observacoes:'Entregar na portaria.'};
const current={pedidoId:23,position:1,status:'en_route',assignedAtUtc:new Date().toISOString(),pickedUpAtUtc:new Date().toISOString(),arrivedAtUtc:new Date().toISOString(),pedido:order};
const queue={motoboyId:1,estabelecimentoId:shop.id,version:3,current,next:[{...current,pedidoId:24,position:2,status:'assigned',pedido:{...order,id:24,nomeCliente:'Rafael Santos',requerCodigoEntrega:false,statusPagamento:'pago',value:64}}],routeState:'delivering',politicas:{allowMotoboyReorder:true,allowMotoboyRefuse:true,transferPolicy:'direct'}};
const results=[],errors=[];let browser;
async function setup(options={}){
  const state={queue:structuredClone(queue),calls:[],receipt:null,mode:'',...options};
  const context=await browser.newContext({viewport:{width:options.width||390,height:844},permissions:['geolocation'],geolocation:{latitude:-22.9,longitude:-47.06},reducedMotion:'reduce'});
  await context.addInitScript(({user,shop,session,dark,login,draft,corrupt})=>{
    localStorage.setItem('zippygo.design.preferences.v1',JSON.stringify({dark,reducedMotion:true}));
    if(!login)for(const [k,v] of Object.entries({'zippygo.user':JSON.stringify(user),authToken:'principal-qa','zippygo.token':'principal-qa','zippygo.estabelecimentoAtual':JSON.stringify(shop),operationalAccessToken:'operacional-qa',operationalUserId:user.id,operationalEstablishmentId:shop.id,operationalSession:JSON.stringify(session)}))localStorage.setItem(k,v);
    if(draft)sessionStorage.setItem(`zippygo.completion.${user.id}`,JSON.stringify(draft));
    if(corrupt)sessionStorage.setItem(`zippygo.completion.${user.id}`,'{incompleto');
  },{user,shop,session,dark:!!options.dark,login:!!options.login,draft:options.draft,corrupt:!!options.corrupt});
  const page=await context.newPage();page.setDefaultTimeout(20000);page.setDefaultNavigationTimeout(60000);page.on('pageerror',e=>errors.push(e.message));await page.routeWebSocket(/.*/,ws=>ws.close());
  await page.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url()),p=url.pathname;
    if(!p.startsWith('/api/'))return url.origin===base||['data:','blob:'].includes(url.protocol)?route.continue():route.abort();
    const body=req.postData()?JSON.parse(req.postData()):null;state.calls.push({p,method:req.method(),body});
    const ok=data=>route.fulfill({json:{success:true,data}}),fail=(status,error,code)=>route.fulfill({status,json:{success:false,error,code}});
    if(p.endsWith('/motoboys/me/vinculos'))return ok([{estabelecimentoId:shop.id,nome:shop.nome,tipoAcesso:'motoboy',statusVinculo:'ativo',statusEstabelecimento:'ativo'}]);
    if(p.endsWith('/session'))return ok(session);
    if(p.endsWith('/heartbeat'))return ok({accessToken:'operacional-qa',session});
    if(p.endsWith('/queue'))return ok(state.queue);
    if(p.endsWith('/perfil')||p.endsWith('/veiculo'))return ok({motoboyId:1,nome:user.nome,email:user.email,telefone:'11999999999',cidade:'Campinas',uf:'SP',modeloMoto:'Honda CG 160',placaMoto:'ABC1D23',anoMoto:2024,statusCadastro:'ativo'});
    if(p.endsWith('/documentos'))return ok([]);
    if(p.endsWith('/preferences'))return ok({compartilharLocalizacaoCliente:true});
    if(p.endsWith('/store'))return ok({nome:shop.nome,latitude:-22.9,longitude:-47.06,rua:'Rua da Loja',numero:'100',cidade:'Campinas',uf:'SP'});
    if(p.endsWith('/transfer-targets'))return ok([{motoboyId:2,nome:'Diego Martins',hasCurrentDelivery:false,queueSize:0}]);
    if(p.endsWith('/transfers'))return ok([{id:7,pedidoId:23,toMotoboyNome:'Diego Martins',status:'pending_approval',policy:'establishment_approval',requestedAtUtc:new Date().toISOString()}]);
    if(/completion\/(23|24)$/.test(p)){const id=Number(p.split('/').pop());return ok({pedidoId:id,version:state.queue.version,nomeCliente:id===23?order.nomeCliente:'Rafael Santos',total:id===23?86.9:64,requiresCode:id===23,requiresPayment:id===23,requiresProof:false});}
    if(p.endsWith('/code'))return body.codigo==='4821'?ok(true):fail(422,'Esse código não confere.','DELIVERY_CODE_INVALID');
    if(p.endsWith('/proof') && p.includes('/completion/')){
      if(req.method()==='POST'){state.photo=body.base64;return ok('cccccccc-cccc-cccc-cccc-cccccccccccc');}
      return ok(state.photo?'data:image/png;base64,'+state.photo:null);
    }
    if(p.endsWith('/completion')&&req.method()==='POST'){
      if(state.mode==='no-server')return route.abort('failed');
      if(state.receipt?.operationId!==body.operationId){state.receipt={operationId:body.operationId,pedidoId:body.expectedPedidoId,nomeCliente:order.nomeCliente,total:86.9,completedAtUtc:new Date().toISOString(),codeChecked:true,paidBeforeDelivery:false,payments:body.payments,proofId:body.proofId};state.queue.current=state.queue.next.shift();state.queue.version++;}
      if(state.mode==='ack-lost')return route.abort('failed');
      return ok({receipt:state.receipt,queue:state.queue});
    }
    if(p.includes('/receipts/'))return state.receipt?ok(state.receipt):fail(404,'Conclusão ainda não registrada.','COMPLETION_NOT_FOUND');
    return ok(null);
  });
  const goto=async route=>{
    await page.goto(base+route);
    await page.waitForFunction(()=>[...document.querySelectorAll('[role="button"],button')].some(el=>Object.keys(el).some(k=>k.startsWith('__reactProps$'))));
    await page.evaluate(()=>document.fonts.ready);
    if(route.startsWith('/confirmacaoEntrega'))await page.getByText(route.includes('24')?'Código dispensado':'Código do cliente',{exact:true}).filter({visible:true}).waitFor();
    if(route==='/perfil')await page.getByText(user.nome,{exact:true}).filter({visible:true}).waitFor();
    if(route==='/minhaMoto')await page.getByText('Honda CG 160',{exact:true}).filter({visible:true}).waitFor();
  };
  return{state,context,page,goto};
}
async function snap(page,name){
  await page.evaluate(()=>{window.scrollTo(0,0);for(const el of document.querySelectorAll('*'))if(el.scrollTop)el.scrollTop=0;return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});
  await page.screenshot({path:path.join(out,name+'.png'),fullPage:true});
}
(async()=>{
  fs.mkdirSync(out,{recursive:true});browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  const routes=['/perfil','/dadosPessoais','/minhaMoto','/documentos','/configuracoes','/somVibracao','/privacidade','/oferta','/rota','/retirada','/turno','/mapa','/retornoLoja','/ocorrencia','/clienteAusente','/transferencia','/acompanharTransferencia?id=7','/estadoRota?tipo=conflict','/chegadaEntrega','/conexao','/confirmacaoEntrega?id=23','/VerificationScreen','/cobrarEntrega','/dividirPagamento','/comprovanteEntrega'];
  for(const dark of [false,true]){
    const f=await setup({dark});
    for(const route of routes){if(route==='/oferta')f.state.queue.offer={offerId:'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',expiresAtUtc:new Date(Date.now()+120000).toISOString(),stops:[current]};else delete f.state.queue.offer;
      await f.goto(route);await snap(f.page,(dark?'escuro-':'claro-')+route.split('?')[0].slice(1));
      assert.equal(await f.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,route+' overflow');
    }await f.context.close();
  }
  results.push(`${routes.length} rotas em claro/escuro, sem overflow horizontal; chamadas externas interceptadas. Web não comprova GPS em segundo plano.`);
  for(const dark of [false,true]){
    const narrow=await setup({dark,width:320});
    for(const route of ['/perfil','/chegadaEntrega','/confirmacaoEntrega?id=23','/VerificationScreen','/cobrarEntrega','/dividirPagamento','/comprovanteEntrega','/conexao']){
      await narrow.goto(route);assert.equal(await narrow.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,route+' overflow em 320 px');
      await snap(narrow.page,(dark?'escuro-':'claro-')+route.split('?')[0].slice(1)+'-320');
    }await narrow.context.close();
  }
  results.push('Oito telas críticas também em 320 px, claro/escuro, sem overflow horizontal.');
  const f=await setup();await f.goto('/confirmacaoEntrega?id=23');await f.page.getByRole('button',{name:'Conferir código ↗'}).click();
  for(let i=0;i<4;i++)await f.page.getByRole('textbox',{name:`Dígito ${i+1} do código`}).fill('0');
  await f.page.getByRole('button',{name:'Validar código'}).click();await f.page.getByText('Esse código não confere.').filter({visible:true}).waitFor();
  for(let i=0;i<4;i++)await f.page.getByRole('textbox',{name:`Dígito ${i+1} do código`}).fill('4821'[i]);
  await f.page.getByRole('button',{name:'Validar código'}).click();await f.page.getByText('Código validado e protegido.').filter({visible:true}).waitFor();assert.equal(await f.page.getByRole('textbox',{name:'Dígito 1 do código'}).isEditable(),false);
  await f.page.getByRole('button',{name:'Voltar à conferência'}).click();await f.page.getByRole('button',{name:'Cobrar e conferir ↗'}).click();
  await f.page.getByRole('textbox',{name:'Dinheiro recebido'}).fill('80,00');await f.page.getByRole('checkbox').click();await f.page.getByRole('button',{name:'Recebimento conferido',exact:true}).click();await f.page.getByText('Confira o dinheiro recebido e entregue o troco.').waitFor();
  await f.page.getByRole('textbox',{name:'Dinheiro recebido'}).fill('100,00');await f.page.getByRole('checkbox').click();await f.page.getByRole('button',{name:'Recebimento conferido',exact:true}).click();
  assert.equal(f.state.calls.filter(c=>c.p.endsWith('/completion')&&c.method==='POST').length,0);
  await snap(f.page,'finish-conferido');
  const draft=await f.page.evaluate(()=>JSON.parse(sessionStorage.getItem('zippygo.completion.qa34')));assert.equal(draft.request.payments[0].cashReceived,100);assert.equal(draft.codeChecked,true);
  results.push('Código inválido/válido e visível desabilitado; dinheiro insuficiente, troco e preparo sem POST de conclusão.');
  await f.page.getByRole('button',{name:'Revisar recebimento ↗'}).click();await f.page.getByRole('button',{name:'Dividir em duas formas'}).click();
  await f.page.getByRole('combobox',{name:'Forma de pagamento da parte 1'}).selectOption('pix');await f.page.getByRole('combobox',{name:'Forma de pagamento da parte 2'}).selectOption('credito');
  await f.page.getByRole('textbox',{name:'Valor desta parte',exact:true}).nth(0).fill('50,00');await f.page.getByRole('textbox',{name:'Valor desta parte',exact:true}).nth(1).fill('36,90');
  await f.page.getByRole('checkbox').nth(0).click();await f.page.getByRole('checkbox').nth(1).click();await f.page.getByRole('button',{name:'Recebimentos conferidos',exact:true}).click();
  let prepared=await f.page.evaluate(()=>JSON.parse(sessionStorage.getItem('zippygo.completion.qa34')));assert.deepEqual(prepared.request.payments.map(p=>p.amount),[50,36.9]);
  await f.page.getByRole('button',{name:'Adicionar foto ↗'}).click();
  const chooser=f.page.waitForEvent('filechooser');await f.page.getByRole('button',{name:'Escolher foto do aparelho'}).click();
  const png=await f.page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=32;canvas.height=24;const c=canvas.getContext('2d');c.fillStyle='#306cdf';c.fillRect(0,0,32,24);return canvas.toDataURL('image/png').split(',')[1];});
  await(await chooser).setFiles({name:'pedido-qa.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});await f.page.getByRole('button',{name:'Anexar esta foto'}).click();
  await f.page.getByRole('button',{name:'Substituir foto ↗'}).waitFor();prepared=await f.page.evaluate(()=>JSON.parse(sessionStorage.getItem('zippygo.completion.qa34')));assert.equal(prepared.request.proofId,'cccccccc-cccc-cccc-cccc-cccccccccccc');
  assert.equal(f.state.calls.filter(c=>c.p.endsWith('/completion')&&c.method==='POST').length,0);
  await f.page.getByRole('button',{name:'Substituir foto ↗'}).click();await f.page.locator('img[src^="data:image/png;base64,"]').filter({visible:true}).waitFor();await snap(f.page,'foto-anexada-revisada');await f.page.getByRole('button',{name:'Voltar à conferência'}).click();
  results.push('Divisão Pix/crédito exata com confirmação de ambas; seleção e upload da foto, revisão autorizada e volta à conferência sem concluir ou cobrar.');
  const handle=f.page.getByTestId('delivery-slide-handle').filter({visible:true});await handle.scrollIntoViewIfNeeded();
  await handle.click();assert.equal(f.state.calls.filter(c=>c.p.endsWith('/completion')&&c.method==='POST').length,0,'Toque não conclui');
  let bounds=await handle.boundingBox();await f.page.mouse.move(bounds.x+25,bounds.y+24);await f.page.mouse.down();await f.page.mouse.move(bounds.x+125,bounds.y+24,{steps:8});await f.page.mouse.up();
  assert.equal(f.state.calls.filter(c=>c.p.endsWith('/completion')&&c.method==='POST').length,0,'Arraste parcial não conclui');
  f.state.mode='ack-lost';bounds=await handle.boundingBox();await f.page.mouse.move(bounds.x+25,bounds.y+24);await f.page.mouse.down();await f.page.mouse.move(bounds.x+325,bounds.y+24,{steps:15});await f.page.mouse.up();
  await f.page.getByRole('button',{name:'Consultar resultado',exact:true}).waitFor();await snap(f.page,'conclusao-resposta-perdida');
  assert.equal(f.state.calls.filter(c=>c.p.endsWith('/completion')&&c.method==='POST').length,1);assert.equal(f.state.queue.current.pedidoId,24);
  await f.page.getByRole('button',{name:'Consultar resultado',exact:true}).click();await f.page.getByText('Recibo de entrega').waitFor();await snap(f.page,'recibo-apos-arraste');
  assert.equal(f.state.calls.filter(c=>c.p.endsWith('/completion')&&c.method==='POST').length,1,'Consulta de recibo não cobra novamente');
  await f.goto('/confirmacaoEntrega?id=24');await f.page.getByText('Código dispensado').waitFor();assert.equal(f.state.queue.current.pedidoId,24);await snap(f.page,'proxima-entrega-paga');
  await f.context.close();results.push('Toque e arraste parcial não concluem; arraste completo com resposta perdida guarda pendência, consulta recupera recibo sem POST duplicado, próximo pedido pago abre nova conferência.');
  // Restaurar um envio incerto testa a consulta, sem novo pagamento nem avanço local.
  const pending={...draft,phase:'pending'};const p=await setup({draft:pending});p.state.receipt={operationId:draft.request.operationId,pedidoId:23,nomeCliente:order.nomeCliente,total:86.9,completedAtUtc:new Date().toISOString(),codeChecked:true,paidBeforeDelivery:false,payments:draft.request.payments};
  await p.goto('/entregaPendente');await p.page.getByText('Recibo de entrega').waitFor();assert.equal(p.state.calls.filter(c=>c.p.endsWith('/completion')&&c.method==='POST').length,0);await snap(p.page,'recibo-recuperado');await p.context.close();results.push('Reabertura de envio incerto encontra recibo pelo usuário sem repetir POST.');
  const retry=await setup({draft:pending});await retry.goto('/entregaPendente');await retry.page.getByRole('button',{name:'Reenviar a mesma conferência'}).click();await retry.page.getByText('Recibo de entrega').waitFor();
  assert.deepEqual(retry.state.calls.find(c=>c.p.endsWith('/completion')&&c.method==='POST').body,draft.request);assert.equal(retry.state.queue.current.pedidoId,24);await retry.context.close();results.push('Sem recibo, reenvio preserva chave e corpo originais e conclui somente o pedido original.');
  const blocked=await setup({draft:pending,mode:'no-server'});await blocked.goto('/configuracoes');await blocked.page.getByRole('button',{name:'Sair da conta',exact:true}).click();
  await blocked.page.getByRole('button',{name:'Encerrar turno e sair',exact:true}).click();await blocked.page.getByText('Consulte a conclusão pendente antes de sair da conta. Seu acesso foi mantido.').waitFor();
  assert.equal(await blocked.page.evaluate(()=>localStorage.getItem('authToken')),'principal-qa');assert.equal(blocked.state.calls.some(c=>c.method==='DELETE'&&c.p.endsWith('/session')),false);await blocked.context.close();
  results.push('Logout bloqueado durante conclusão incerta; token e turno preservados, sem DELETE de sessão.');
  const corrupt=await setup({corrupt:true});await corrupt.goto('/configuracoes');await corrupt.page.getByRole('button',{name:'Sair da conta',exact:true}).click();
  await corrupt.page.getByRole('button',{name:'Encerrar turno e sair',exact:true}).click();await corrupt.page.getByText('A conferência salva ainda não pôde ser verificada. Aguarde a recuperação antes de sair da conta.').waitFor();
  assert.equal(await corrupt.page.evaluate(()=>localStorage.getItem('authToken')),'principal-qa');
  await corrupt.page.goto(base+'/confirmacaoEntrega?id=23');await corrupt.page.getByText('A conferência salva não pôde ser verificada. Não sobrescreva esse registro; peça orientação à loja.').waitFor();
  assert.equal(await corrupt.page.evaluate(()=>sessionStorage.getItem('zippygo.completion.qa34')),'{incompleto');assert.equal(corrupt.state.calls.some(c=>c.method==='DELETE'&&c.p.endsWith('/session')),false);assert.equal(corrupt.state.calls.some(c=>c.method==='POST'&&c.p.endsWith('/completion')),false);await corrupt.context.close();
  results.push('Registro local ilegível não é sobrescrito; bloqueia nova conferência/logout, preservando token e turno.');
  for(const dark of[false,true]){const l=await setup({dark,login:true});await l.goto('/login');await snap(l.page,dark?'login-escuro':'login-claro');await l.context.close();}
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'resultado.json'),JSON.stringify({results,errors},null,2));console.log(JSON.stringify({results,errors},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();});

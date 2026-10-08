const { chromium } = require('playwright');
const { setup, setBrowser } = require('../validacao-etapa5/browser-tests.cjs');
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true }); setBrowser(browser);
  try {
    const f = await setup(390, false, { keepMetroWebSocket: true }), id='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    f.page.on('requestfailed', r=>console.log('FAILED',r.url(),r.failure()));
    f.page.on('pageerror', e=>console.log('ERROR',e.message));
    const cdp=await f.context.newCDPSession(f.page);await cdp.send('Network.enable');
    cdp.on('Network.requestWillBeSent',e=>{if(e.type==='Document')console.log('DOCUMENT',e.request.url,JSON.stringify(e.initiator));});
    await f.page.route(/tile\.openstreetmap\.org/,r=>r.abort());
    await f.page.route('**/api/v2/motoboys/me/session/queue',r=>r.fulfill({json:{success:true,data:{motoboyId:1,estabelecimentoId:'11111111-1111-1111-1111-111111111111',version:12,next:[],current:null,routeState:'idle',politicas:{},offer:{offerId:id,expiresAtUtc:new Date(Date.now()+300000).toISOString(),stops:[{pedidoId:23,position:1,status:'offered',pedido:{bairro:'Centro'},earnings:{mode:'delivery',rate:10,amount:10}}]}}}}));
    await f.page.route('**/api/v2/motoboys/me/session/queue/offer/accept',r=>{console.log('ACCEPT',r.request().postData());return r.fulfill({status:409,json:{success:false,error:'Confira novamente os ganhos.'}});});
    await f.goto('/oferta');await f.page.getByText('Total das entregas desta oferta').waitFor();
    const button=f.page.getByRole('button',{name:'Aceitar e conferir rota',exact:true});
    await f.page.screenshot({path:require('node:path').join(__dirname,'captures/offer-debug.png')});
    console.log('BUTTON',await button.boundingBox());
    await button.click();await f.page.getByText('Confira novamente os ganhos.',{exact:true}).waitFor();console.log('OK OFFER');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

// Captura exclusivamente o HTML aprovado. Não altera os arquivos da referência.
const {chromium}=require(process.env.QA_PLAYWRIGHT_MODULE||'playwright');
const path=require('node:path'),fs=require('node:fs');
(async()=>{
  const out=path.resolve(__dirname,'../../../.expo/validation-etapa34');fs.mkdirSync(out,{recursive:true});
  const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:1200},reducedMotion:'reduce'});
    await page.goto('file:///'+path.resolve(__dirname,'../../prototipo-motoboy/index.html').replaceAll('\\','/'));
    await page.evaluate(()=>document.fonts.ready);
    await page.addStyleTag({content:'.phone{transform:none!important}.phone-stage{transform:none!important}#app{width:390px!important}'});
    const metrics=[];
    for(const dark of [false,true])for(const id of ['login','finish','code','charge','split','proof','success','profile','vehicle','settings','route','pickup']){
      await page.evaluate(({id,dark})=>{state.night=dark;state.motionReduced=true;go(id);},{id,dark});
      await page.locator('#app').screenshot({path:path.join(out,`original-${dark?'escuro':'claro'}-${id}.png`)});
      metrics.push(await page.evaluate(({id,dark})=>{const root=document.querySelector('.app-page'),c=getComputedStyle(root);return{id,dark,pageColor:c.backgroundColor,pageBackground:c.backgroundImage,padding:c.padding,font:getComputedStyle(document.querySelector('h1')).fontFamily};},{id,dark}));
    }
    fs.writeFileSync(path.join(out,'original-metricas.json'),JSON.stringify(metrics,null,2));
    console.log('24 capturas do HTML original.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

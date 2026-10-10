// Production web bundle, real local API + loopback SMTP. No request goes to production or friends.
const assert=require('node:assert/strict');const path=require('node:path');const fs=require('node:fs');
const {chromium,webkit}=require('playwright-core');const {PrismaClient}=require('@prisma/client');
require('./local-qa.cjs').localQa();
const helpers=require('./test-share-email-api.cjs');const db=new PrismaClient();
const WEB='http://127.0.0.1:8090';const API='http://127.0.0.1:3029/api';const suffix=Date.now();
async function run(){
 const smtp=await helpers.startSmtp();const server=helpers.startApi(3029,{PUBLIC_WEB_URL:'https://junto.lunalav.pe',FRONTEND_URL:WEB,SMTP_HOST:'127.0.0.1',SMTP_PORT:String(smtp.port),SMTP_USER:'qa@example.invalid',SMTP_PASS:'fictional-only',SMTP_ALLOW_INSECURE_LOCAL:'true',EMAIL_FROM:'JUNTO <no-reply@example.invalid>'});
 let browser, closing=false;
 try{
  await server.ready;
  const engine=process.env.JUNTO_QA_WEBKIT==='true'?webkit:chromium;
  browser=await engine.launch(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true}:{headless:true});
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const errors=[];
  await context.route('**/*',async route=>{
   const request=route.request();const u=new URL(request.url());
   if(u.origin===WEB)return route.continue();
   if(u.origin==='https://junto.lunalav.pe'&&u.pathname.startsWith('/api/')){
    if(request.method()==='OPTIONS')return route.fulfill({status:204,headers:{'Access-Control-Allow-Origin':WEB,'Access-Control-Allow-Methods':'GET,POST,PUT,PATCH,DELETE','Access-Control-Allow-Headers':'authorization,content-type'}});
    // Regression: sharing immediately must not depend on the slow group-detail query.
    if(request.method()==='GET' && /^\/api\/grupos\/[0-9a-f-]{36}$/.test(u.pathname))await new Promise(r=>setTimeout(r,5000));
    if(closing)return route.abort().catch(()=>undefined);
    const response=await fetch(API+u.pathname.slice('/api'.length)+u.search,{method:request.method(),headers:{...request.headers(),host:'127.0.0.1:3029',origin:WEB},body:request.postData()||undefined});
    return route.fulfill({status:response.status,body:Buffer.from(await response.arrayBuffer()),headers:{'Content-Type':response.headers.get('content-type')||'application/json','Access-Control-Allow-Origin':WEB}});
   }
   throw new Error('Unapproved external request in QA: '+u.origin);
  });
  const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',error=>errors.push(error.message));
  await page.goto(WEB+'/app/',{waitUntil:'networkidle'});
  await page.getByRole('button',{name:'Crear mi cuenta gratis'}).click();
  await page.getByRole('button',{name:'Crear cuenta →',exact:true}).click();
  await page.getByText('Escribe al menos 2 caracteres: así te reconocerán.',{exact:true}).waitFor();
  const email=`qa-web-beta-${suffix}@example.invalid`, password=`BetaQA${suffix}!`;
  await page.getByPlaceholder('Ej. Camila Torres').fill('Camila QA');
  await page.getByPlaceholder('nombre@correo.com').fill(email);
  await page.getByPlaceholder('Mínimo 8 caracteres y un número').fill(password);
  await page.getByRole('button',{name:'Crear cuenta →',exact:true}).click();
  await page.waitForURL(/verify-email/);
  const user=await db.usuario.findUniqueOrThrow({where:{email}});
  assert.equal(user.emailVerificado,false);
  assert.ok(helpers.inbox.some(raw=>helpers.decode(raw).includes(email)), 'SMTP captured verification for fictional account');
  const otp=page.getByLabel('Código de verificación de 6 dígitos',{exact:true});await otp.fill(user.otpCode);
  await page.waitForURL(url=>!url.pathname.includes('verify-email'),{timeout:15000});
  assert.ok(await page.evaluate(()=>sessionStorage.getItem('junto.session.accessToken')));
  assert.equal(await page.evaluate(()=>localStorage.getItem('accessToken')),null);
  await page.goto(WEB+'/app/grupos/crear');
  await page.getByLabel('Nombre del grupo').fill('Cartagena Beta QA');
  await page.getByRole('button',{name:'Crear grupo',exact:true}).click();
  await page.getByText('¡Grupo creado!',{exact:true}).waitFor();
  await page.getByLabel('Correo o celular para invitar').fill('incorrecto');
  await page.getByRole('button',{name:'Invitar',exact:true}).click();
  await page.getByText(/Escribe un correo válido/).waitFor();
  await page.getByRole('button',{name:'Enviar invitación por correo',exact:true}).click();
  await page.getByPlaceholder('nombre@correo.com').fill('amigo-ios@example.invalid');
  await page.getByRole('button',{name:'Enviar desde JUNTO',exact:true}).click();
  await page.getByRole('button',{name:'Enviar',exact:true}).click();
  await page.getByText('Enviado al proveedor de correo',{exact:true}).waitFor();
  assert.ok(helpers.inbox.some(raw=>helpers.decode(raw).includes('amigo-ios@example.invalid')&&helpers.decode(raw).includes('Ver invitación')));
  await page.goto(WEB+'/app/perfil');
  await page.getByRole('button',{name:/Cerrar sesión/}).click();
  await page.getByRole('button',{name:'Cerrar sesión',exact:true}).click();
  await page.waitForURL(/\/login/);
  assert.equal(await page.evaluate(()=>sessionStorage.getItem('junto.session.accessToken')),null);
  await page.getByPlaceholder('nombre@correo.com').fill(email);
  await page.getByPlaceholder('Tu contraseña').fill(password);
  await page.getByRole('button',{name:'Iniciar sesión →',exact:true}).click();
  await page.waitForURL(url=>!url.pathname.includes('/login'));
  await page.reload({waitUntil:'networkidle'});
  assert.ok(await page.evaluate(()=>sessionStorage.getItem('junto.session.accessToken')));
  assert.deepEqual(errors,[]);
  fs.mkdirSync(path.join(__dirname,'artifacts'),{recursive:true});await page.screenshot({path:path.join(__dirname,'artifacts',engine===webkit?'beta-webkit-invite.png':'beta-chrome-invite.png')});
  console.log(JSON.stringify({result:'PASS',engine:engine===webkit?'WebKit mobile viewport':'Chromium mobile viewport',scope:'fictional registration, email verification, browser-session credential storage, group creation, bad invitation validation, invitation SMTP, logout, login and reload'}));
 }finally{closing=true;if(browser)await browser.close();server.child.kill();smtp.close();await db.$disconnect();await helpers.disconnect();}
}
run().catch(error=>{console.error(error.message);process.exitCode=1;});

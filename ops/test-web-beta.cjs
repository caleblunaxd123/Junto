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
  const viewportWidth=Number(process.env.JUNTO_QA_WIDTH||390);
  const context=await browser.newContext({viewport:{width:viewportWidth,height:900},isMobile:viewportWidth<768,hasTouch:viewportWidth<768});
  const errors=[];let whatsappDraft='';
  await context.route('**/*',async route=>{
   const request=route.request();const u=new URL(request.url());
   if(u.origin===WEB)return route.continue();
   if(u.origin==='https://wa.me'){whatsappDraft=request.url();return route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>QA draft capture only</title>No WhatsApp request sent.'});}
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
  const artifactDir=path.join(__dirname,'artifacts');fs.mkdirSync(artifactDir,{recursive:true});
  async function layoutCheck(label, screenshot=false){
   await page.waitForTimeout(400); // inspect settled layouts, not a modal's slide animation
   const width=page.viewportSize().width;
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),'No document overflow: '+label+' '+width);
   const fields=page.locator('input:visible');
   for(let i=0;i<await fields.count();i++){const box=await fields.nth(i).boundingBox();assert.ok(box.width>30&&box.x>=-1&&box.x+box.width<=width+1,'Usable input inside viewport: '+label);if(width>=1024)assert.ok(box.width<750,'Form is bounded on desktop: '+label);}
   if(screenshot)await page.screenshot({path:path.join(artifactDir,`responsive-${engine===webkit?'webkit':'chrome'}-${label}-${width}.png`)});
  }
  await page.goto(WEB+'/app/',{waitUntil:'networkidle'});
  await layoutCheck('onboarding',true);
  await page.getByRole('button',{name:'Crear mi cuenta gratis'}).click();
  await layoutCheck('register',true);
  await page.getByRole('button',{name:'Crear cuenta →',exact:true}).click();
  await page.getByText('Escribe al menos 2 caracteres: así te reconocerán.',{exact:true}).waitFor();
  assert.equal(await page.getByPlaceholder('Ej. Camila Torres').evaluate(el=>document.activeElement===el),true,'Validation focuses first invalid field');
  const email=`qa-web-beta-${suffix}@example.invalid`, password=`BetaQA${suffix}!`;
  await page.getByPlaceholder('Ej. Camila Torres').fill('Camila QA');
  await page.getByPlaceholder('nombre@correo.com').filter({visible:true}).fill(email);
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
  // Responsive changes must not remount the navigator or erase a logged-in session.
  for(const width of [360,390,768,1024,1440,1920]){
   await page.setViewportSize({width,height:900});await page.waitForTimeout(250);
   await layoutCheck('home',width===390||width===1440);
   assert.ok(await page.evaluate(()=>sessionStorage.getItem('junto.session.accessToken')));
   const sidebar=page.getByLabel('Navegación principal',{exact:true});
   assert.equal(await sidebar.isVisible(),width>=1024);
   if(width>=1024)assert.equal(await page.getByRole('tab',{name:/Inicio/}).isVisible(),false);
  }
  await page.setViewportSize({width:viewportWidth,height:900});
  await page.goto(WEB+'/app/grupos/crear');
  await page.getByLabel('Nombre del grupo').fill('Cartagena Beta QA');
  await page.getByRole('button',{name:'Crear grupo',exact:true}).last().click();
  await page.getByText('¡Grupo creado!',{exact:true}).waitFor();
  await page.getByLabel('Correo o celular para invitar').fill('incorrecto');
  await page.getByRole('button',{name:'Preparar',exact:true}).click();
  await page.getByText(/Escribe un correo válido/).waitFor();
  await page.getByLabel('Correo o celular para invitar').fill('amigo-ios@example.invalid');
  await page.getByRole('button',{name:'Preparar',exact:true}).click();
  assert.equal(await page.getByPlaceholder('nombre@correo.com').inputValue(),'amigo-ios@example.invalid');
  await layoutCheck('email',true);
  if(viewportWidth>=768){const box=await page.getByPlaceholder('nombre@correo.com').boundingBox();assert.ok(box.x>100&&box.width<650,'Centered email dialog');}
  if(viewportWidth>=1024){await page.setViewportSize({width:viewportWidth,height:600});await layoutCheck('email-short-window',true);assert.equal(await page.getByPlaceholder('nombre@correo.com').inputValue(),'amigo-ios@example.invalid');}
  await page.getByRole('button',{name:'Enviar desde JUNTO',exact:true}).click();
  await page.getByRole('button',{name:'Enviar',exact:true}).click();
  await page.getByText('Enviado al proveedor de correo',{exact:true}).waitFor();
  await page.setViewportSize({width:viewportWidth,height:900});
  assert.ok(helpers.inbox.some(raw=>helpers.decode(raw).includes('amigo-ios@example.invalid')&&helpers.decode(raw).includes('Ver invitación')));
  await page.getByRole('button',{name:'Volver a las opciones para compartir',exact:true}).click();
  await page.getByRole('button',{name:'Cerrar vista para compartir',exact:true}).click();
  await page.getByLabel('Correo o celular para invitar').fill('999888777');
  await page.getByRole('button',{name:'Preparar',exact:true}).click();
  await page.waitForURL(url=>url.origin==='https://wa.me');
  const draft=new URL(whatsappDraft);assert.equal(draft.pathname,'/51999888777');assert.match(draft.searchParams.get('text'),/Cartagena Beta QA/);
  await page.goto(WEB+'/app/perfil');
  await page.getByRole('button',{name:/Cerrar sesión/}).click();
  await page.getByRole('button',{name:'Cerrar sesión',exact:true}).click();
  await page.waitForURL(/\/login/);
  await layoutCheck('login',true);
  assert.equal(await page.evaluate(()=>sessionStorage.getItem('junto.session.accessToken')),null);
  await page.getByPlaceholder('nombre@correo.com').filter({visible:true}).fill(email);
  await page.getByPlaceholder('Tu contraseña').filter({visible:true}).fill(password);
  await page.getByPlaceholder('Tu contraseña').filter({visible:true}).press('Enter');
  await page.waitForURL(url=>!url.pathname.includes('/login'));
  await page.reload({waitUntil:'networkidle'});
  assert.ok(await page.evaluate(()=>sessionStorage.getItem('junto.session.accessToken')));
  if(viewportWidth>=1024){
   await page.getByRole('link',{name:'Actividad',exact:true}).click();await page.waitForURL(/actividad/);await layoutCheck('activity');
   await page.getByRole('link',{name:'Inicio',exact:true}).click();await page.waitForURL(url=>url.pathname==='/app/'||url.pathname==='/app');
   await page.getByRole('button',{name:'Agregar',exact:true}).click();await page.getByText('¿Qué quieres agregar?',{exact:true}).waitFor();await layoutCheck('create-dialog',true);await page.getByRole('button',{name:'Cancelar',exact:true}).click();
  }
  await page.goto(WEB+'/app/cuentas/rapida');
  await page.getByLabel('Total de la cuenta',{exact:true}).fill('500');await page.getByLabel('Cada uno paga lo que consumió',{exact:true}).click();await page.getByRole('button',{name:'Continuar con las personas →',exact:true}).click();
  const amounts=page.getByPlaceholder('0.00',{exact:true});await amounts.nth(0).fill('100');await amounts.nth(1).fill('150');await amounts.nth(2).fill('130');await page.getByText('Falta asignar: S/ 120.00',{exact:true}).waitFor();assert.ok(await page.getByRole('button',{name:'Revisar reparto →',exact:true}).isDisabled());await layoutCheck('bill-validation',true);
  await amounts.nth(2).fill('250');await page.getByRole('button',{name:'Revisar reparto →',exact:true}).click();await layoutCheck('bill-review');
  // Recover the fictional local account. Nothing is sent to a real provider.
  await page.goto(WEB+'/app/perfil');await page.getByRole('button',{name:/Cerrar sesión/}).click();await page.getByRole('button',{name:'Cerrar sesión',exact:true}).click();await page.waitForURL(/\/login/);
  await page.getByRole('link',{name:'¿Olvidaste tu contraseña?',exact:true}).click();await page.getByLabel('Correo para recuperar cuenta',{exact:true}).fill('no-es-correo');await page.getByRole('button',{name:'Solicitar código',exact:true}).click();await page.getByText('Usa un correo como nombre@correo.com, sin espacios.',{exact:true}).waitFor();
  await page.getByLabel('Correo para recuperar cuenta',{exact:true}).fill(email);await page.getByLabel('Correo para recuperar cuenta',{exact:true}).press('Enter');await page.getByLabel('Código de recuperación',{exact:true}).waitFor();
  const resetUser=await db.usuario.findUniqueOrThrow({where:{email}});assert.equal(resetUser.otpPurpose,'reset');
  await page.getByLabel('Código de recuperación',{exact:true}).fill(resetUser.otpCode);await page.getByLabel('Nueva contraseña',{exact:true}).fill(password+'2');await page.getByLabel('Confirmar nueva contraseña',{exact:true}).fill('diferente');await page.getByRole('button',{name:'Actualizar contraseña',exact:true}).click();await page.getByText('Las contraseñas no coinciden. Escríbelas igual en ambos campos.',{exact:true}).waitFor();await layoutCheck('recovery',true);
  await page.getByLabel('Confirmar nueva contraseña',{exact:true}).fill(password+'2');await page.getByLabel('Confirmar nueva contraseña',{exact:true}).press('Enter');await page.getByText('Contraseña actualizada',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Ir a iniciar sesión',exact:true}).click();await page.waitForURL(/\/login/);await page.waitForTimeout(400);await page.getByRole('textbox',{name:'Correo electrónico',exact:true}).fill(email);await page.getByPlaceholder('Tu contraseña').filter({visible:true}).fill(password+'2');await page.getByPlaceholder('Tu contraseña').filter({visible:true}).press('Enter');await page.waitForURL(url=>!url.pathname.includes('/login'));
  await page.getByRole('button',{name:/Cartagena Beta QA/}).waitFor();await layoutCheck('dashboard',true);
  await page.getByRole('button',{name:/Cartagena Beta QA/}).click();await page.getByRole('button',{name:'Opciones del grupo',exact:true}).waitFor();await layoutCheck('group',true);
  await page.getByRole('button',{name:'Opciones del grupo',exact:true}).click();await layoutCheck('group-options',true);await page.getByRole('button',{name:'Cerrar',exact:true}).click();
  assert.deepEqual(errors,[]);
  fs.mkdirSync(path.join(__dirname,'artifacts'),{recursive:true});await page.screenshot({path:path.join(__dirname,'artifacts',engine===webkit?'beta-webkit-invite.png':'beta-chrome-invite.png')});
  console.log(JSON.stringify({result:'PASS',engine:engine===webkit?'WebKit':'Chromium',viewportWidth,resizeWidths:[360,390,768,1024,1440,1920],scope:'fictional registration, email verification, responsive navigation, bounded forms/dialogs, invitation SMTP, WhatsApp draft, logout, keyboard login, reload, exact 500 bill validation, password recovery and group/menu'}));
 }finally{closing=true;if(browser)await browser.close();server.child.kill();smtp.close();await db.$disconnect();await helpers.disconnect();}
}
run().catch(error=>{console.error(error.message);process.exitCode=1;});

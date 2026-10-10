// Explicitly authorized, bounded production QA. Never use friends' addresses.
const {chromium,webkit}=require('playwright-core');
const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');const assert=require('node:assert/strict');
const HOST='https://junto.lunalav.pe';const EMAIL='calebluna41+junto-beta@gmail.com';
const file=path.join(__dirname,'artifacts','production-beta-private.json');
const phase=process.argv[2];
if(process.env.JUNTO_AUTHORIZED_GMAIL_QA!=='true')throw new Error('Explicit authorized test switch required');
let state=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{email:EMAIL,password:'BetaQA1!'+crypto.randomBytes(18).toString('hex')};
if(state.email!==EMAIL)throw new Error('QA recipient changed; refusing');
function save(){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(state),{mode:0o600});}
async function request(route,body,token){const response=await fetch(HOST+'/api'+route,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});const data=await response.json();if(!response.ok)throw new Error(`API ${route}: ${response.status} ${data.error||data.message||'request rejected'}`);return data;}
async function browserTest(task){const browser=await(process.env.JUNTO_QA_WEBKIT==='true'?webkit:chromium).launch(process.env.JUNTO_QA_WEBKIT==='true'?{headless:true}:{headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});try{const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const errors=[];const page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message));await task(page);assert.deepEqual(errors,[]);}finally{await browser.close();}}
async function login(page){await page.goto(HOST+'/app/login',{waitUntil:'networkidle'});await page.getByPlaceholder('nombre@correo.com').fill(EMAIL);await page.getByPlaceholder('Tu contraseña').fill(state.password);await page.getByRole('button',{name:'Iniciar sesión →',exact:true}).click();await page.waitForURL(url=>!url.pathname.includes('/login'));assert.ok(await page.evaluate(()=>sessionStorage.getItem('junto.session.accessToken')));}
async function run(){
 if(phase==='register'){
  if(state.registered)throw new Error('Registration already submitted: do not resend');save();
  await browserTest(async page=>{await page.goto(HOST+'/app/',{waitUntil:'networkidle'});await page.getByRole('button',{name:'Crear mi cuenta gratis'}).click();await page.getByPlaceholder('Ej. Camila Torres').fill('JUNTO Beta Prueba');await page.getByPlaceholder('nombre@correo.com').fill(EMAIL);await page.getByPlaceholder('Mínimo 8 caracteres y un número').fill(state.password);await page.getByRole('button',{name:'Crear cuenta →',exact:true}).click();await page.waitForURL(/verify-email/);});state.registered=true;state.startedAt=Date.now();save();
 }else if(phase==='verify'){
  assert.match(process.env.JUNTO_QA_OTP||'',/^\d{6}$/);const auth=await request('/auth/verify-email',{email:EMAIL,otp:process.env.JUNTO_QA_OTP});state.oldRefresh=auth.refreshToken;state.verified=true;save();
 }else if(phase==='session'){
  await browserTest(async page=>{await login(page);await page.reload({waitUntil:'networkidle'});assert.ok(await page.evaluate(()=>sessionStorage.getItem('junto.session.accessToken')));await page.goto(HOST+'/app/perfil');await page.getByRole('button',{name:/Cerrar sesión/}).click();await page.getByRole('button',{name:'Cerrar sesión',exact:true}).click();await page.waitForURL(/\/login/);assert.equal(await page.evaluate(()=>sessionStorage.getItem('junto.session.accessToken')),null);});
 }else if(phase==='recover'){
  if(state.recoveryRequested)throw new Error('Recovery already requested: do not resend');
  await browserTest(async page=>{await page.goto(HOST+'/app/forgot-password',{waitUntil:'networkidle'});await page.getByLabel('Correo para recuperar cuenta',{exact:true}).fill(EMAIL);await page.getByRole('button',{name:'Solicitar código',exact:true}).click();await page.getByLabel('Código de recuperación',{exact:true}).waitFor();});state.recoveryRequested=true;save();
 }else if(phase==='reset'){
  assert.match(process.env.JUNTO_QA_OTP||'',/^\d{6}$/);state.newPassword='BetaReset2!'+crypto.randomBytes(18).toString('hex');save();
  // Use the existing recovery code without requesting another email.
  await request('/auth/reset-password',{email:EMAIL,otp:process.env.JUNTO_QA_OTP,newPassword:state.newPassword});
  const rejected=await fetch(HOST+'/api/auth/refresh',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({refreshToken:state.oldRefresh})});assert.equal(rejected.status,401);
  state.password=state.newPassword;delete state.newPassword;delete state.oldRefresh;state.reset=true;save();await browserTest(login);
 }else if(phase==='invite'){
  if(state.invitationSent)throw new Error('Invitation already sent: do not resend');
  await browserTest(async page=>{await login(page);if(state.groupCreated){const auth=await request('/auth/login',{email:EMAIL,password:state.password});const groups=await request('/grupos',null,auth.accessToken);const group=groups.find(g=>g.nombre==='Prueba ficticia · JUNTO Beta');assert.ok(group);state.groupId=group.id;await page.goto(HOST+'/app/grupos/agregar-personas?grupoId='+group.id);}else{await page.goto(HOST+'/app/grupos/crear');await page.getByLabel('Nombre del grupo').fill('Prueba ficticia · JUNTO Beta');await page.getByRole('button',{name:'Crear grupo',exact:true}).click();await page.getByText('¡Grupo creado!',{exact:true}).waitFor();state.groupCreated=true;save();}await page.getByRole('button',{name:'Enviar invitación por correo',exact:true}).click();await page.getByPlaceholder('nombre@correo.com').fill(EMAIL);await page.getByRole('button',{name:'Enviar desde JUNTO',exact:true}).click();await page.getByRole('button',{name:'Enviar',exact:true}).click();await page.getByText('Enviado al proveedor de correo',{exact:true}).waitFor();state.invitationSent=true;save();await page.screenshot({path:path.join(__dirname,'artifacts','production-beta-invitation.png')});});
 }else if(phase==='quick-bill'){
  if(state.billId)throw new Error('Fictional bill already saved; do not duplicate');
  await browserTest(async page=>{await login(page);await page.goto(HOST+'/app/cuentas/rapida');await page.getByLabel('Total de la cuenta',{exact:true}).fill('500');await page.getByLabel('Cada uno paga lo que consumió',{exact:true}).click();await page.getByRole('button',{name:'Continuar con las personas →',exact:true}).click();const amounts=page.getByPlaceholder('0.00',{exact:true});await amounts.nth(0).fill('100');await amounts.nth(1).fill('150');await amounts.nth(2).fill('130');await page.getByText('Falta asignar: S/ 120.00',{exact:true}).waitFor();assert.ok(await page.getByRole('button',{name:'Revisar reparto →',exact:true}).isDisabled());await page.screenshot({path:path.join(__dirname,'artifacts','production-beta-500-validation.png')});await amounts.nth(2).fill('250');await page.getByRole('button',{name:'Revisar reparto →',exact:true}).click();await page.getByPlaceholder('Ej. Cumple de Ana').fill('Ficticia 500 · QA');await page.getByRole('button',{name:'Guardar reparto',exact:true}).click();await page.waitForURL(/rapida-detalle/);state.billId=new URL(page.url()).searchParams.get('id');assert.ok(state.billId);save();await page.reload({waitUntil:'networkidle'});await page.getByText('Ficticia 500 · QA',{exact:true}).waitFor();});
 }else if(phase==='login-webkit'){await browserTest(login);}
 else throw new Error('Unknown QA phase');
 console.log('PASS production beta: '+phase+'; only the explicitly authorized fictional Gmail alias. No friend contacted.');
}
run().catch(error=>{console.error(error.message);process.exitCode=1;});

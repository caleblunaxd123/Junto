// Add beta install metadata to the generated Expo export, never to the native application.
const fs=require('node:fs');const path=require('node:path');
const root=path.resolve(__dirname,'../../apps/mobile/dist-beta');
const htmlPath=path.join(root,'index.html');let html=fs.readFileSync(htmlPath,'utf8');
html=html.replace('lang="en"','lang="es"').replace('You need to enable JavaScript to run this app.','Activa JavaScript para usar JUNTO.');
if(!html.includes('manifest.webmanifest'))html=html.replace('</head>','<link rel="manifest" href="/app/manifest.webmanifest"><meta name="theme-color" content="#00856A"><meta name="apple-mobile-web-app-capable" content="yes"><link rel="apple-touch-icon" href="/app/icon.png"></head>');
fs.writeFileSync(htmlPath,html);fs.copyFileSync(path.resolve(__dirname,'../../apps/mobile/assets/brand/icon-v2.png'),path.join(root,'icon.png'));
fs.writeFileSync(path.join(root,'manifest.webmanifest'),JSON.stringify({name:'JUNTO · Beta',short_name:'JUNTO',lang:'es-PE',id:'/app/',start_url:'/app/',scope:'/app/',display:'standalone',background_color:'#FFFCF7',theme_color:'#00856A',icons:[{src:'/app/icon.png',sizes:'1024x1024',type:'image/png',purpose:'any'}]},null,2));
console.info('Beta metadata ready; no service worker or API offline cache installed.');

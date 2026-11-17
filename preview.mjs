// Development preview serves explicitly allowed deliverables; no directory access.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
const allowed=new Map([['/','SteakLab.html'],['/SteakLab.html','SteakLab.html'],['/plan.html','plan.html'],['/design/logo-concepts.html','design/logo-concepts.html']]);
for(let i=1;i<=10;i++){const file='design/logos/'+String(i).padStart(2,'0')+'.svg';allowed.set('/'+file,file);}
http.createServer(async(req,res)=>{const file=allowed.get(req.url.split('?')[0]);if(!file){res.writeHead(404);res.end();return;}try{const body=await readFile(new URL(file,import.meta.url));res.writeHead(200,{'Content-Type':file.endsWith('.svg')?'image/svg+xml':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(body);}catch{res.writeHead(404);res.end();}}).listen(8847,'127.0.0.1',()=>console.log('Local preview: http://127.0.0.1:8847'));

// Development preview serves only the two deliverable HTML files; no directory access.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
const allowed=new Map([['/','SteakLab.html'],['/SteakLab.html','SteakLab.html'],['/plan.html','plan.html']]);
http.createServer(async(req,res)=>{const file=allowed.get(req.url.split('?')[0]);if(!file){res.writeHead(404);res.end();return;}try{const body=await readFile(new URL(file,import.meta.url));res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(body);}catch{res.writeHead(404);res.end();}}).listen(8847,'127.0.0.1',()=>console.log('Local preview: http://127.0.0.1:8847'));

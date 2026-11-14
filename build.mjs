import {readFile,writeFile} from 'node:fs/promises';
const base=new URL('./',import.meta.url);
let html=await readFile(new URL('src/shell.html',base),'utf8');
for(const [marker,file] of [['STYLE','style.css'],['I18N','i18n.js'],['PHYSICS','physics.js'],['RUNNER','runner.js'],['DISPLAY','display.js'],['SCENE','scene.js'],['APP','app.js']]){
 const text=await readFile(new URL('src/'+file,base),'utf8');
 if(text.includes('</script>'))throw new Error('Unexpected script closing tag in '+file);
 html=html.replace('/*__'+marker+'__*/',()=>text);
}
await writeFile(new URL('SteakLab.html',base),html);
console.log('SteakLab.html bygget: '+Math.round(Buffer.byteLength(html)/1024)+' KB, ingen eksterne afhængigheder.');
await writeFile(new URL('index.html',base),html);

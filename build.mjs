import {readFile,writeFile} from 'node:fs/promises';
const base=new URL('./',import.meta.url);
let html=await readFile(new URL('src/shell.html',base),'utf8');
const logo=await readFile(new URL('assets/steaklab-ribeye-small.png',base));
html=html.replace('/*__LOGO__*/','data:image/png;base64,'+logo.toString('base64'));
const voicePhrases=JSON.parse(await readFile(new URL('assets/voice/en/phrases.json',base),'utf8'));
const voiceClips={};
for(const id of Object.keys(voicePhrases)){
 try{voiceClips[id]='data:audio/mpeg;base64,'+(await readFile(new URL('assets/voice/en/'+id+'.mp3',base))).toString('base64');}
 catch(error){if(error.code!=='ENOENT')throw error;}
}
const completeVoice=Object.keys(voiceClips).length===Object.keys(voicePhrases).length;
for(const [marker,file] of [['STYLE','style.css'],['I18N','i18n.js'],['PHYSICS','physics.js'],['RUNNER','runner.js'],['DISPLAY','display.js'],['SCENE','scene.js'],['APP','app.js']]){
 const text=await readFile(new URL('src/'+file,base),'utf8');
 if(text.includes('</script>'))throw new Error('Unexpected script closing tag in '+file);
 html=html.replace('/*__'+marker+'__*/',()=>text);
}
html=html.replace('/*__VOICE__*/',()=>JSON.stringify(completeVoice?voiceClips:{}));
console.log(completeVoice?'English ElevenLabs voice embedded.':'ElevenLabs clips not generated yet; English browser voice remains active.');
await writeFile(new URL('SteakLab.html',base),html);
console.log('SteakLab.html bygget: '+Math.round(Buffer.byteLength(html)/1024)+' KB, ingen eksterne afhængigheder.');
await writeFile(new URL('index.html',base),html);

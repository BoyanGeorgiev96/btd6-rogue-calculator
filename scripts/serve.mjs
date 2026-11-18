import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve, sep, extname} from 'node:path';
import {versionedIndex, changelogPage} from './release-pages.mjs';
const root=resolve(process.argv[2] || '.');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'};
const server=http.createServer(async(req,res)=>{
  try {
    const path=resolve(root, '.' + decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/\/$/,'/index.html'));
    if(!path.startsWith(root+sep)){res.writeHead(403).end();return;}
    let body;
    if(root===resolve('.')&&path===resolve('changelog.html'))body=await changelogPage();
    else {
      body=await readFile(path);
      if(root===resolve('.')&&path===resolve('index.html'))body=(await versionedIndex(body.toString())).replace('./source/rogue-lab-source.tar.gz', './DISTRIBUTION.md').replace(' data-release-source download', '').replace('Download matching source', 'Source distribution');
    }
    res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream'}).end(body);
  }catch{res.writeHead(404).end('Not found');}
});
server.listen(Number(process.env.PORT)||5173,'127.0.0.1',()=>console.log(`Local: http://127.0.0.1:${server.address().port}`));

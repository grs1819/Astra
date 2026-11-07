import http from 'node:http';
import {readFile} from 'node:fs/promises';
const files = {
  '/terrain.js':'terrain.js', '/':'index.html', '/app.js':'app.js', '/style.css':'style.css', '/town.js':'town.js', '/water.js':'water.js', '/water-view.js':'water-view.js', '/navigation.js':'navigation.js', '/villagers.js':'villagers.js',
  '/vendor/three.module.js':'vendor/three.module.js',
  '/vendor/three.core.js':'vendor/three.core.js',
  '/vendor/OrbitControls.js':'vendor/OrbitControls.js',
  '/assets/stillwater-mark.png':'assets/stillwater-mark.png',
  '/assets/stillwater-icon.png':'assets/stillwater-icon.png',
  '/assets/stillwater-logo.png':'assets/stillwater-logo.png',
};
const contentTypes={js:'text/javascript',css:'text/css',html:'text/html',png:'image/png'};
http.createServer(async(req,res)=>{
  const path=files[new URL(req.url,'http://localhost').pathname];
  if(!path){res.writeHead(404);res.end('Not found');return;}
  try{
    const data=await readFile(new URL(path,import.meta.url));
    res.setHeader('Content-Type',contentTypes[path.split('.').pop()]);
    res.end(data);
  }catch{res.writeHead(500);res.end('Unable to load file');}
}).listen(Number(process.env.PORT)||5173,'0.0.0.0',()=>console.log('Stillwater running on port '+(process.env.PORT||5173)));

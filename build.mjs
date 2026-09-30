import {cp,mkdir,rm} from 'node:fs/promises';
import './scripts/check.mjs';
await mkdir('dist',{recursive:true});await cp('public','dist',{recursive:true});await rm('dist/config.js',{force:true});
console.log('MONO build complete: dist');

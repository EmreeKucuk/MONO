import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spotifyContent} from '../public/spotify-url.js';
import {sanitizeWorkspace} from '../public/state-schema.js';
import {renderSpotify} from '../public/spotify-widget.js';
import {readFile} from 'node:fs/promises';

const id='37i9dQZF1DXcBWIGoYBM5M';
test('Spotify links canonicalize and survive workspace schema loading',()=>{
  for(const type of ['track','playlist','album']) {
    const url=`https://open.spotify.com/${type}/${id}`;
    for(const input of [url+'?si=test',url.replace('.com/','.com/intl-tr/'),url.replace('.com/','.com/embed/')]) {
      assert.equal(spotifyContent(input).url,url);
      const state=sanitizeWorkspace({widgets:[{id:'music',type:'spotify',spotifyUrl:input}],events:[]});
      assert.equal(state.widgets[0].spotifyUrl,url);
      assert.match(renderSpotify(state.widgets[0]),/title="Spotify/);
    }
  }
});
test('malicious saved Spotify URLs cannot become iframe sources or HTML attributes',()=>{
  const inputs=[`http://open.spotify.com/track/${id}`,`https://open.spotify.com.evil.test/track/${id}`,`https://evil.test/track/${id}`,`https://user:pass@open.spotify.com/track/${id}`,`https://open.spotify.com:444/track/${id}`,'javascript:alert(1)',`https://open.spotify.com/track/${id}" onload="alert(1)`, '<iframe src="https://evil.test"></iframe>'];
  for(const input of inputs) {
    assert.equal(spotifyContent(input),null);
    assert.doesNotMatch(renderSpotify({spotifyUrl:input}),/<iframe/);
    assert.equal(sanitizeWorkspace({widgets:[{type:'spotify',spotifyUrl:input}],events:[]}).widgets[0].spotifyUrl,'');
  }
});
test('local and Vercel CSP permit only Spotify frames and offline cache includes new modules',async()=>{
  const local=await readFile(new URL('../server.mjs',import.meta.url),'utf8');
  const config=JSON.parse(await readFile(new URL('../vercel.json',import.meta.url),'utf8'));
  const remote=config.headers[0].headers.find(header=>header.key==='Content-Security-Policy').value;
  for(const csp of [local,remote])assert.match(csp,/frame-src https:\/\/open\.spotify\.com https:\/\/sdk\.scdn\.co;/);
  const sw=await readFile(new URL('../public/sw.js',import.meta.url),'utf8');
  for(const asset of ['spotify-url.js','spotify-widget.js','spotify-tracks.js','spotify-stages.js','styles/spotify.css'])assert.ok(sw.includes(asset));
});


// Never accept user-provided iframe HTML or forward arbitrary URLs to Spotify.
export function spotifyContent(value) {
  if(typeof value!=='string'||value.length>2048)return null;
  try {
    const url=new URL(value.trim());
    if(url.protocol!=='https:'||url.hostname!=='open.spotify.com'||url.port||url.username||url.password)return null;
    const match=url.pathname.match(/^\/(?:intl-[a-z]{2}(?:-[a-z]{2})?\/)?(?:embed\/)?(track|playlist|album)\/([a-zA-Z0-9]{22})\/?$/i);
    if(!match)return null;
    const type=match[1].toLowerCase(),id=match[2];
    return {type,id,url:`https://open.spotify.com/${type}/${id}`,embed:`https://open.spotify.com/embed/${type}/${id}?theme=0`};
  } catch { return null; }
}

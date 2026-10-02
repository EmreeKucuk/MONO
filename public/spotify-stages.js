// One wheel gesture advances one full panel; nested lists still scroll normally.
export function bindSpotifyStages(root){
  const card=root.closest('.widget'),scroller=root.querySelector('.spotify-account');
  const stages=[...scroller.querySelectorAll('[data-spotify-stage]')],nav=root.querySelector('.spotify-stage-nav');
  let paged=false,locked=false,timer;
  const index=()=>Math.max(0,Math.min(stages.length-1,Math.round(scroller.scrollTop/Math.max(1,scroller.clientHeight))));
  const update=()=>nav.querySelectorAll('button').forEach((button,i)=>button.setAttribute('aria-pressed',String(i===index())));
  function go(next){
    const target=Math.max(0,Math.min(stages.length-1,next));
    scroller.scrollTo({top:target*scroller.clientHeight,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
  }
  function sync(){
    const next=card.dataset.gridCols==='1'&&card.dataset.gridRows==='1';
    if(next===paged)return;
    paged=next;card.classList.toggle('spotify-paged',paged);nav.hidden=!paged;
    locked=false;clearTimeout(timer);scroller.scrollTop=0;update();
  }
  function wheel(event){
    if(!paged||event.ctrlKey||Math.abs(event.deltaY)<2||Math.abs(event.deltaX)>Math.abs(event.deltaY))return;
    if(locked){event.preventDefault();clearTimeout(timer);timer=setTimeout(()=>locked=false,220);return;}
    // Expanded device settings and the song list own their scrolling until the edge.
    for(let node=event.target;node&&node!==scroller;node=node.parentElement){
      const style=getComputedStyle(node);
      if(/auto|scroll/.test(style.overflowY)&&node.scrollHeight>node.clientHeight+1){
        if(event.deltaY>0&&node.scrollTop+node.clientHeight<node.scrollHeight-1||event.deltaY<0&&node.scrollTop>1)return;
      }
    }
    event.preventDefault();locked=true;timer=setTimeout(()=>locked=false,220);
    go(index()+(event.deltaY>0?1:-1));
  }
  const key=event=>{
    if(!paged||event.target.matches('input,select,textarea')||!['PageDown','PageUp'].includes(event.key))return;
    event.preventDefault();go(index()+(event.key==='PageDown'?1:-1));
  };
  const click=event=>{const button=event.target.closest('[data-stage-go]');if(button)go(Number(button.dataset.stageGo));};
  const focus=event=>{if(!paged)return;const stage=event.target.closest('[data-spotify-stage]');if(stage){scroller.scrollTop=stages.indexOf(stage)*scroller.clientHeight;update();}};
  scroller.addEventListener('wheel',wheel,{passive:false});scroller.addEventListener('scroll',update);scroller.addEventListener('keydown',key);scroller.addEventListener('focusin',focus);nav.addEventListener('click',click);
  const dimensions=new MutationObserver(sync);dimensions.observe(card,{attributes:true,attributeFilter:['data-grid-cols','data-grid-rows']});
  const removal=new MutationObserver(()=>{if(card.isConnected)return;clearTimeout(timer);dimensions.disconnect();removal.disconnect();scroller.removeEventListener('wheel',wheel);scroller.removeEventListener('scroll',update);scroller.removeEventListener('keydown',key);scroller.removeEventListener('focusin',focus);nav.removeEventListener('click',click);});
  removal.observe(document.querySelector('#app'),{childList:true,subtree:true});sync();
}

// Shared navigation keeps choosing a game separate from restarting a round.
export function setupGameMenu({beforeOpen=()=>{},afterClose=()=>{}}={}){
 const get=id=>document.getElementById(id),menu=get('games-menu');
 const triggers=['games-button','round-games','result-games'].map(get).filter(Boolean);
 const status=get('games-link-status'),fallback=get('games-link-fallback'),linkField=get('games-link-url');
 const copyButtons=[...document.querySelectorAll('[data-copy-link]')];
 let copyRequest=0;
 const resetLinks=()=>{copyRequest++;status.textContent='';fallback.hidden=true;for(const button of copyButtons)button.textContent='Copy link';};
 const expanded=value=>{for(const button of triggers)button.setAttribute('aria-expanded',String(value));};
 const open=()=>{
  if(menu.open)return;
  resetLinks();
  beforeOpen();
  for(const dialog of document.querySelectorAll('dialog[open]'))if(dialog!==menu)dialog.close();
  menu.showModal();expanded(true);
 };
 for(const button of triggers)button.onclick=open;
 // Leave opening to native links so the browser receives the original tap.
 // Clipboard access can be denied in an embedded game; keep a manual fallback.
 for(const button of copyButtons)button.onclick=async()=>{
  const link=get(button.dataset.copyLink),request=++copyRequest;
  for(const other of copyButtons)other.textContent='Copy link';
  fallback.hidden=true;status.textContent='';button.disabled=true;
  try{
   if(!globalThis.navigator?.clipboard?.writeText)throw new Error('Clipboard unavailable');
   await navigator.clipboard.writeText(link.href);
   if(request!==copyRequest)return;
   button.textContent='Copied';status.textContent='Link copied. Paste it into your browser.';
  }catch{
   if(request!==copyRequest)return;
   get('games-link-label').textContent=button.dataset.gameName+' link';
   linkField.value=link.href;fallback.hidden=false;
   status.textContent='Press and hold the link to copy it, then paste it into your browser.';
   linkField.focus({preventScroll:true});linkField.select();
  }finally{button.disabled=false;}
 };
 linkField.onclick=()=>linkField.select();
 get('games-close').onclick=get('games-resume').onclick=()=>menu.close();
 menu.addEventListener('close',()=>{resetLinks();expanded(false);afterClose();get('games-button').focus?.({preventScroll:true});});
 menu.addEventListener('click',event=>{if(event.target!==menu)return;const r=menu.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)menu.close();});
 return {open};
}

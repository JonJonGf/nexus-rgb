'use strict';
window.NexusLibrary={create(hooks){
  const T=window.NexusI18n,make=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined){e.textContent=T(text);if(tag!=='label')e.dataset.i18n=text;}if(cls)e.className=cls;return e;};let favorites=false,category='';
  const tools=document.querySelector('.picker-tools'),favorite=make('button','★ Favoritos','button subtle'),select=make('select');favorite.type='button';favorite.id='library-favorites';favorite.setAttribute('aria-pressed','false');select.id='library-category';select.setAttribute('aria-label',T('Filtrar por categoria'));tools.append(favorite,select);
  favorite.addEventListener('click',()=>{favorites=!favorites;favorite.setAttribute('aria-pressed',String(favorites));hooks.refresh();});select.addEventListener('change',()=>{category=select.value;hooks.refresh();});
  async function patch(body){try{await hooks.patch(body);hooks.refresh();}catch(e){hooks.toast(T(e.message));}}
  const transition=make('select'),label=make('label','Transição entre perfis');label.id='library-transition-label';label.replaceChildren(make('span','Transição entre perfis'));transition.id='library-transition';for(const ms of [0,150,300,600,1000]){const option=make('option',ms?ms+' ms':'Imediata');option.value=ms;transition.append(option);}label.append(transition);document.querySelector('#settings-fps-form').after(label);
  transition.addEventListener('change',()=>patch({transitionMs:Number(transition.value)}));
  function prefs(){return hooks.state()?.library||{favorites:[],categories:{},transitionMs:0};}
  return {
    update(admin){favorite.hidden=false;transition.disabled=!admin;if(document.activeElement!==transition)transition.value=String(prefs().transitionMs||0);},
    filter(cards){const p=prefs(),names=[...new Set(Object.values(p.categories))].sort(),chosen=category;select.replaceChildren();const all=make('option','Todas as categorias');all.value='';select.append(all);for(const name of names){const option=make('option');option.textContent=name;option.value=name;select.append(option);}select.value=names.includes(chosen)?chosen:'';category=select.value;return cards.filter(c=>{const key=c.kind+':'+c.id;return (!favorites||p.favorites.includes(key))&&(!category||p.categories[key]===category);});},
    decorate(button,card,admin){
      const wrapper=make('div',undefined,'library-entry'),actions=make('div',undefined,'library-card-tools'),key=card.kind+':'+card.id,p=prefs(),star=make('button',p.favorites.includes(key)?'★':'☆','library-star');star.type='button';star.setAttribute('aria-label',T('Favorito')+': '+card.name);star.setAttribute('aria-pressed',String(p.favorites.includes(key)));star.disabled=!admin;star.addEventListener('click',()=>patch({key,favorite:!prefs().favorites.includes(key)}));actions.append(star);
      if(admin){const menu=make('details'),summary=make('summary','Organizar'),input=make('input');input.value=p.categories[key]||'';input.maxLength=40;input.setAttribute('aria-label',T('Categoria')+': '+card.name);input.placeholder=T('Categoria');input.addEventListener('change',()=>patch({key,category:input.value}));menu.append(summary,input);
        if(['profile','spatial'].includes(card.kind)){const copy=make('button','Criar cópia','text-button');copy.type='button';copy.addEventListener('click',async()=>{copy.disabled=true;try{await hooks.duplicate(card);}catch(e){hooks.toast(T(e.message));}finally{copy.disabled=false;}});menu.append(copy);}actions.append(menu);
      }
      wrapper.append(button,actions);return wrapper;
    }
  };
}};

// 箱庭の本体。下の読み込みが済んでから呼ばれる。シンプルなポータルを出すときは呼ばれない
function PORTAL_MAIN(){
try{
(function(){
'use strict';

// 画面に出る文言。site.ts の ui を index.astro が #portal-ui に JSON で書く
var UI=JSON.parse(document.getElementById('portal-ui').textContent);

// ---------- データ：HTML のリンク一覧（#plain）から読む ----------
// d:区画の番号　li:シンプルなポータルでの項目
var plainEl=document.getElementById('plain'), DALL=[], ALL=[];
[].forEach.call(plainEl.querySelectorAll('section'),function(sec,d){
  DALL.push({id:sec.getAttribute('data-id'),color:sec.getAttribute('data-color'),sec:sec});
  [].forEach.call(sec.querySelectorAll('a'),function(a){
    ALL.push({name:a.querySelector('b').textContent,cat:a.querySelector('small').textContent,desc:a.querySelector('span').textContent,
              d:d,color:a.getAttribute('data-color'),href:a.getAttribute('href'),arch:a.getAttribute('data-arch')||undefined,li:a.parentNode});
  });
});
// 件数を絞る見本。site.ts の sample が true で、見本の10件のときだけ使える（index.astro が #app に data-sample を書く）
var SAMPLE=document.getElementById('app').hasAttribute('data-sample')&&ALL.length===10;
var PICK={4:[0,1,2,3],5:[0,1,2,3,4],6:[0,1,2,3,4,5],7:[0,1,2,3,4,5,7],8:[0,1,2,3,4,5,7,8],9:[0,1,2,3,4,5,6,7,8]};
function pickOf(n){ return n===ALL.length?ALL.map(function(_,ix){return ix;}):PICK[n]; }
// 確認用：?split=5-3-2 のように書くと、先頭から順に区画へ割り振る（?n より優先）
var SPLIT=null;
function makeSet(n){
  var jc=DALL.map(function(){return 0;}), first=[], last=[], links=[];
  var pick=pickOf(n), force=null;
  if(SPLIT){ pick=[]; force=[]; SPLIT.forEach(function(c,di){ for(var a=0;a<c;a++){ pick.push(pick.length); force.push(di); } }); }
  pick.forEach(function(ix,q){
    var s=ALL[ix], L={}, k; for(k in s)L[k]=s[k];
    if(force)L.d=force[q];
    L.n=(q<9?'0':'')+(q+1); L.j=jc[L.d]++;
    if(first[L.d]===undefined)first[L.d]=L.n; last[L.d]=L.n;
    links.push(L);
  });
  var dist=[];
  DALL.forEach(function(d,i){
    if(jc[i]>0){ d.at=dist.length; dist.push({id:d.id,color:d.color,range:first[i]===last[i]?first[i]:first[i]+'–'+last[i]}); }
  });
  // 見本で件数を絞っているあいだは、シンプルなポータルも同じ顔ぶれにする（区画は HTML のまま）
  ALL.forEach(function(s2,ix){ s2.li.hidden=pick.indexOf(ix)<0; });
  DALL.forEach(function(d){ d.sec.hidden=!d.sec.querySelector('li:not([hidden])'); });
  links.forEach(function(L){ L.d=DALL[L.d].at; }); // d は使っている区画だけの通し番号にする
  return {links:links,dist:dist};
}

// ---------- サンプルの状態（URL の ?n=4〜10） ----------
var COUNT=ALL.length;
(function(){
  if(!SAMPLE)return;
  try{
    var q=new URLSearchParams(location.search), n=parseInt(q.get('n'),10);
    if(pickOf(n))COUNT=n;
    var sp=(q.get('split')||'').split('-').map(Number), tot=sp.reduce(function(a,c){return a+c;},0);
    if(sp.length>=1&&sp.length<=3&&sp.every(function(c){return c>=1&&c===Math.floor(c);})&&tot>=4&&tot<=10){ SPLIT=sp; COUNT=tot; }
  }catch(_){}
})();
var SET=makeSet(COUNT), LINKS=SET.links, DIST=SET.dist, N=LINKS.length;

// 建物の部品。models.js は window.PORTAL_ASSETS[pack] を登録する。組み立ての規則は kenney-buildings.js
var PACK={pack:'kenney-modular',src:'assets/kenney-modular/models.js'};
// 盤を歩く人と動物（見本）。人は骨組みが共通なので、動きは RIG の1体分だけを持たせて使い回す
var LIFE_PACKS={people:{pack:'kenney-characters',src:'assets/kenney-characters/models.js'},pets:{pack:'kenney-pets',src:'assets/kenney-pets/models.js'}};
var RIG='character-male-a';
var PEOPLE=['character-female-a','character-male-b','character-female-e','character-male-c','character-female-b','character-worker',
            'character-male-e','character-female-f','character-male-g','character-robot','character-male-f','character-male-a'];
var PETS=['animal-dog','animal-cat','animal-bunny','animal-chick','animal-fox','animal-pig','animal-penguin','animal-panda'];

var RM=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
var FINE=window.matchMedia&&window.matchMedia('(hover: hover) and (pointer: fine)').matches;

var app=document.getElementById('app'), canvas=document.getElementById('gl'),
    labelsEl=document.getElementById('labels'), wash=document.getElementById('wash'),
    hd=document.getElementById('hd'), ft=document.getElementById('ft'),
    cap=document.getElementById('cap'), toastEl=document.getElementById('toast'),
    hint=document.getElementById('hint'), legendEl=document.getElementById('legend'),
    swEl=document.getElementById('sw'), loadEl=document.getElementById('load');
var capNum=cap.querySelector('.cnum'), capName=cap.querySelector('.cname'), capDesc=cap.querySelector('.cdesc');

var vw=1,vh=1, sel=-1, opening=null, lastTouch=false, GL=null, clearTimer=0, toastTimer=0;
// 箱庭をやめて、シンプルなポータルを見せる。WebGL が使えない・描画が壊れた・コンテキストが失われたとき
var plainMode=!document.documentElement.classList.contains('gl');
function toPlain(why){
  plainMode=true; GL=null; opening=null;
  document.documentElement.classList.remove('gl');
  if(why&&window.console)console.warn('箱庭を表示できないため、リンクの一覧を表示します。',why);
}
var SELW=224, STEM=11;

function clamp(v,a,b){return v<a?a:(v>b?b:v);}
function esc(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;');}

// ---------- ラベルの DOM（番号順） ----------
var els=[], items=[];
function buildLabels(){
  labelsEl.innerHTML=''; els=[]; items=[]; sel=-1;
  legendEl.innerHTML=DIST.map(function(d){
    return '<li style="--c:'+d.color+'">'+d.id+' <small>'+d.range+'</small></li>';
  }).join('');
  LINKS.forEach(function(L,i){
    var a=document.createElement('a');
    a.className='lb'; a.href=L.href; a.style.setProperty('--c',L.color);
    a.setAttribute('aria-label',L.n+' '+L.name+' ('+DIST[L.d].id+' / '+L.cat+') '+L.desc);
    a.innerHTML='<span class="head"><span class="num">'+L.n+'</span><span class="nm">'+esc(L.name)+
      '</span><span class="arr" aria-hidden="true">→</span></span>'+
      '<span class="more"><span class="cat">'+DIST[L.d].id+' ／ '+esc(L.cat)+'</span><span class="desc">'+esc(L.desc)+
      '</span><span class="go">'+esc(UI.open)+'</span></span><i class="stem" aria-hidden="true"></i>';
    labelsEl.appendChild(a);
    els.push(a);
    items.push({i:i,el:a,head:a.querySelector('.head'),stem:a.querySelector('.stem'),w:150,h:36,ax:0,ay:0,x:0,by:0,ty:0,y:null});

    a.addEventListener('pointerenter',function(e){ if(e.pointerType==='mouse'&&!opening) select(i); });
    a.addEventListener('pointerleave',function(e){ if(e.pointerType==='mouse') scheduleClear(); });
    a.addEventListener('pointerdown',function(e){ lastTouch=e.pointerType!=='mouse'; });
    a.addEventListener('focus',function(){ if(!opening) select(i); });
    a.addEventListener('click',function(e){
      if(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return; // 別のタブで開く操作は、ブラウザーに任せる
      e.preventDefault(); openLink(i);
    });
    a.addEventListener('keydown',function(e){
      var d=null;
      if(e.key==='ArrowRight')d=[1,0]; else if(e.key==='ArrowLeft')d=[-1,0];
      else if(e.key==='ArrowUp')d=[0,-1]; else if(e.key==='ArrowDown')d=[0,1];
      else if(e.key==='Escape'){ a.blur(); select(-1); return; }
      if(!d)return;
      e.preventDefault();
      var nb=neighbour(i,d[0],d[1]);
      if(nb>=0) els[nb].focus();
    });
  });
  sel=0; select(-1);
}

// 矢印キー：画面上でその方向にいちばん近いラベルへ
function neighbour(i,dx,dy){
  var r0=items[i].head.getBoundingClientRect(), x0=r0.left+r0.width/2, y0=r0.top+r0.height/2;
  var best=-1,bs=1e9;
  for(var k=0;k<N;k++){
    if(k===i)continue;
    var r=items[k].head.getBoundingClientRect(), x=r.left+r.width/2-x0, y=r.top+r.height/2-y0;
    var along=x*dx+y*dy, perp=Math.abs(x*dy-y*dx);
    if(along<8)continue;
    var sc=along+perp*2;
    if(sc<bs){bs=sc;best=k;}
  }
  return best;
}

function select(i){
  clearTimeout(clearTimer);
  if(i===sel)return;
  if(sel>=0&&els[sel])els[sel].classList.remove('sel');
  sel=i;
  if(i>=0){
    var L=LINKS[i];
    els[i].classList.add('sel');
    cap.style.setProperty('--c',L.color);
    capNum.textContent=L.n; capName.textContent=L.name;
    capDesc.textContent=DIST[L.d].id+' ／ '+L.cat+' — '+L.desc;
  }else{
    cap.style.removeProperty('--c');
    capNum.textContent=N+' LINKS'; capName.textContent=app.dataset.title; // サイトの名前。index.astro が #app に書く
    capDesc.textContent=UI.idle;
  }
}
function scheduleClear(){
  clearTimeout(clearTimer);
  clearTimer=setTimeout(function(){
    if(opening)return;
    if(document.activeElement&&document.activeElement.classList&&document.activeElement.classList.contains('lb'))return;
    select(-1);
  },420);
}
function toast(msg){
  toastEl.textContent=msg; toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer=setTimeout(function(){toastEl.classList.remove('show');},2400);
}
function isDemo(i){ return !LINKS[i].href||LINKS[i].href==='#'; }
function goTo(i){ if(!isDemo(i)) location.href=LINKS[i].href; }
function openLink(i){
  if(opening)return;
  select(i);
  var msg=UI.opening.replace('{name}',LINKS[i].name)+(isDemo(i)?UI.demo:'');
  if(!GL||RM){
    toast(msg); goTo(i);
    if(lastTouch){ setTimeout(function(){ if(!opening) select(-1); },1200); }
    return;
  }
  GL.startOpen(i,msg);
}
function measure(){
  for(var k=0;k<N;k++){
    if(k===sel)continue;
    var w=items[k].head.offsetWidth,h=items[k].head.offsetHeight;
    if(w>0){items[k].w=w;items[k].h=h;}
  }
}

buildLabels();
hint.textContent=FINE?UI.hintPointer:UI.hintTouch;
swEl.hidden=!SAMPLE;

// ---------- サンプル用の切り替え ----------
function syncButtons(){
  var bs=swEl.querySelectorAll('button');
  for(var i=0;i<bs.length;i++){
    var v=bs[i].getAttribute('data-v');
    bs[i].setAttribute('aria-pressed',String(Number(v)===COUNT));
  }
}
function setLoading(on){ loadEl.classList.toggle('show',!!on); }
function setState(n){
  if(opening)return;
  if(n===COUNT&&!SPLIT)return;
  SPLIT=null; COUNT=n;
  SET=makeSet(COUNT); LINKS=SET.links; DIST=SET.dist; N=LINKS.length;
  buildLabels(); measure();
  syncButtons();
  try{ history.replaceState(null,'',location.pathname+'?n='+COUNT); }catch(_){}
  setLoading(false);
  if(GL) GL.build();
}
swEl.addEventListener('click',function(e){
  var bt=e.target.closest?e.target.closest('button'):null;
  if(!bt)return;
  setState(Number(bt.getAttribute('data-v')));
});
syncButtons();

// ---------- three.js ----------
function initGL(){
  var T3=window.THREE;
  if(!T3) throw new Error('three.js を読み込めません');
  var renderer=new T3.WebGLRenderer({canvas:canvas,antialias:true,alpha:true});
  var PR=Math.min(window.devicePixelRatio||1,2);
  renderer.setPixelRatio(PR);
  renderer.setClearColor(0x000000,0);
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=T3.PCFSoftShadowMap;
  // 出力はリニアのまま。部品のテクスチャもリニア扱いにして揃える
  renderer.outputEncoding=T3.LinearEncoding;
  var maxAniso=renderer.capabilities.getMaxAnisotropy();

  var scene=new T3.Scene();
  var camera=new T3.OrthographicCamera(-10,10,10,-10,0.1,200);
  var hemi=new T3.HemisphereLight(0xffffff,0x3a4270,0.72); scene.add(hemi);
  var key=new T3.DirectionalLight(0xfff3e0,0.62);
  key.position.set(-10,18,8);
  key.castShadow=true;
  key.shadow.mapSize.set(1024,1024);
  key.shadow.camera.left=-14; key.shadow.camera.right=14;
  key.shadow.camera.top=14; key.shadow.camera.bottom=-14;
  key.shadow.camera.near=1; key.shadow.camera.far=60;
  key.shadow.bias=-0.0008; key.shadow.normalBias=0.03; key.shadow.radius=3;
  scene.add(key);

  var board=new T3.Group(); board.rotation.order='YXZ'; scene.add(board);
  var bGroup=new T3.Group(); board.add(bGroup);
  var SLAB=new T3.Color(0x1d2749);

  function box(w,h,d){return new T3.BoxGeometry(w,h,d);}
  function mk(geo,mat,edge,op){
    var m=new T3.Mesh(geo,mat); m.castShadow=true; m.receiveShadow=true;
    if(edge!==undefined&&edge!==null){
      m.add(new T3.LineSegments(new T3.EdgesGeometry(geo,25),
        new T3.LineBasicMaterial({color:edge,transparent:true,opacity:op||0.55})));
    }
    return m;
  }
  function std(color,extra){
    var o={color:color,roughness:0.88,metalness:0,flatShading:true};
    if(extra)for(var k in extra)o[k]=extra[k];
    return new T3.MeshStandardMaterial(o);
  }

  var towers=[], proxies=[];
  function newB(i,H,foot){
    var root=new T3.Group(), rot=new T3.Group(); root.add(rot);
    var px=new T3.Mesh(box(foot,H,foot),new T3.MeshBasicMaterial({visible:false}));
    px.position.y=H/2; px.userData.i=i; rot.add(px); proxies.push(px);
    bGroup.add(root);
    return {root:root,rot:rot,H:H,kx:1,ky:1,xzf:0,selS:1.22,jump:0,baseY:0.05,
            pal:null,ring:null,sy:1,sv:0,glow:0,shown:false};
  }

  // ---------- アセットの読み込み ----------
  var packState={}, parsed={}, parsing={}, packTex={}, loader=null; // parsing：解析中のモデルと、その終わりを待つ人
  function loadScript(P,cb){
    var st=packState[P.pack];
    if(st&&st.done){ cb(st.err); return; }
    if(st){ st.cbs.push(cb); return; }
    st=packState[P.pack]={done:false,err:null,cbs:[cb]};
    function fin(err){ st.done=true; st.err=err; var c=st.cbs; st.cbs=[]; c.forEach(function(f){f(err);}); }
    if(window.PORTAL_ASSETS&&window.PORTAL_ASSETS[P.pack]){ fin(null); return; }
    var s=document.createElement('script'); s.src=P.src;
    s.onload=function(){ fin(window.PORTAL_ASSETS&&window.PORTAL_ASSETS[P.pack]?null:new Error('パックが登録されていません')); };
    s.onerror=function(){ packState[P.pack]=null; st.done=true; var c=st.cbs; st.cbs=[]; c.forEach(function(f){f(new Error(P.src+' を読み込めません'));}); };
    document.head.appendChild(s);
  }
  function haveAll(P,names){
    var c=parsed[P.pack]; if(!c)return false;
    for(var i=0;i<names.length;i++) if(!c[names[i]])return false;
    return true;
  }
  function ensure(P,names,cb){
    if(!T3.GLTFLoader){ cb(new Error('GLTFLoader を読み込めません')); return; }
    loadScript(P,function(err){
      if(err){ cb(err); return; }
      var A=window.PORTAL_ASSETS[P.pack], c=parsed[P.pack]||(parsed[P.pack]={}), w=parsing[P.pack]||(parsing[P.pack]={});
      var todo=names.filter(function(n){return !c[n];}), left=todo.length, failed=null;
      if(!left){ cb(null); return; }
      if(!loader) loader=new T3.GLTFLoader();
      todo.forEach(function(name){
        var json=A.models[name];
        // cb は読み込み器の外で呼ぶ。中で呼ぶと、cb の中の例外が読み込みの失敗として握りつぶされる
        function done(e){ if(e&&!failed)failed=e; if(--left===0) setTimeout(function(){ cb(failed); },0); }
        if(!json){ done(new Error('モデルがありません: '+name)); return; }
        if(w[name]){ w[name].push(done); return; } // 先の呼び出しが解析している。終わるのを待つ
        w[name]=[done];
        function fin(e){ var q=w[name]; delete w[name]; q.forEach(function(f){ f(e); }); }
        (json.images||[]).forEach(function(im){ if(im.uri==='__TEXTURE__') im.uri=A.texture; });
        // Kenney の glTF は texCoord:0 だけの KHR_texture_transform を持つ。何も変えない指定なので外す（r128 が警告を出すため）
        (json.materials||[]).forEach(function(m){
          var bt=m.pbrMetallicRoughness&&m.pbrMetallicRoughness.baseColorTexture, ex=bt&&bt.extensions&&bt.extensions.KHR_texture_transform;
          if(ex&&Object.keys(ex).length===1&&ex.texCoord===0) delete bt.extensions;
        });
        try{
          loader.parse(JSON.stringify(json),'',function(g){
            c[name]=prepModel(P.pack,g.scene); c[name].anims=g.animations; fin(null);
          },function(e){ fin(e||new Error('parse')); });
        }catch(e){ fin(e); }
      });
    });
  }
  // 読み込んだ部品に影とテクスチャの共有を設定し、箱を測る
  function prepModel(pack,obj){
    obj.updateMatrixWorld(true);
    obj.traverse(function(n){
      if(!n.isMesh)return;
      n.castShadow=true; n.receiveShadow=true; n.userData.shared=true;
      var m=n.material;
      if(m&&m.map){
        if(!packTex[pack]){ packTex[pack]=m.map; m.map.encoding=T3.LinearEncoding; m.map.anisotropy=maxAniso; }
        else m.map=packTex[pack]; // 1枚のテクスチャをパック内で共有
        m.needsUpdate=true;
      }
    });
    return {obj:obj,box:new T3.Box3().setFromObject(obj)};
  }

  function clearGroup(g){
    g.traverse(function(n){
      if(n.userData&&n.userData.shared)return; // 部品の形とマテリアルは使い回す
      if(n.geometry)n.geometry.dispose();
      if(n.material)n.material.dispose();
    });
    while(g.children.length) g.remove(g.children[0]);
  }

  // 読み込み中の仮の建物。ラベルはこれを基準にすぐ置く
  function buildGhost(L,i){
    var w=G.lot*0.8, H=1.5, T=newB(i,H,w);
    var c=new T3.Color(L.color);
    var m=new T3.Mesh(box(w,H,w),new T3.MeshBasicMaterial({color:c,transparent:true,opacity:0.14,depthWrite:false}));
    m.add(new T3.LineSegments(new T3.EdgesGeometry(m.geometry),new T3.LineBasicMaterial({color:c,transparent:true,opacity:0.7})));
    m.position.y=H/2; T.rot.add(m); T.selS=1.08;
    return T;
  }
  function ring(color,rOut,rIn,seg,th,x,y,z,ry){
    var g=new T3.RingGeometry(rIn,rOut,seg,1,th);
    var m=new T3.Mesh(g,new T3.MeshBasicMaterial({color:color,transparent:true,opacity:0.5,depthWrite:false,side:T3.DoubleSide}));
    m.rotation.x=-Math.PI/2;
    var h=new T3.Group(); h.add(m); h.position.set(x,y,z); h.rotation.y=ry||0; bGroup.add(h);
    return m.material;
  }
  // ---------- Kenney モジュラー：部品を組んで建物を作る（規則は kenney-buildings.js） ----------
  var MOD_SEED='|kenney208'; // 見本の10件で形がばらけるものを 400 通りから選んだ。無作為だと10件中の型は 6〜7 種が普通
  function genMod(L){ return PortalBuildings.plan(L.name,{seed:MOD_SEED,tall:L.d===0,arch:L.arch}); }
  var plazaPlan=PortalBuildings.plaza;
  // パレット：1枚の色見本テクスチャを差し替えると全体の色が変わる。マテリアルはパレットごとに2つ（通常／選択中）
  var PAL=null;
  function ensurePal(cb){
    if(PAL){ cb(null); return; }
    var A=window.PORTAL_ASSETS['kenney-modular'], base=packTex['kenney-modular'], bm=null, c=parsed['kenney-modular'], nm;
    for(nm in c){ c[nm].obj.traverse(function(o){ if(!bm&&o.isMesh)bm=o.material; }); if(bm)break; }
    if(!base||!bm){ cb(new Error('パレットの元がありません')); return; }
    var srcs={d:A.texture,a:A.textures&&A.textures.a,b:A.textures&&A.textures.b}, keys=['d','a','b'], imgs={}, left=keys.length, bad=null;
    function mkPal(image){
      var t=base.clone(); t.image=image; t.needsUpdate=true;
      var m=bm.clone(); m.map=t; m.needsUpdate=true;
      var h=m.clone(); h.emissive=new T3.Color(0xffffff); h.emissiveIntensity=0.22;
      return {mat:m,hi:h};
    }
    // 実行時の色替え：暖色（壁・土台）の色相だけを回した色見本を canvas で作る
    function hueShift(img,deg,sat){
      var cv=document.createElement('canvas'); cv.width=img.width; cv.height=img.height;
      var g=cv.getContext('2d'); g.drawImage(img,0,0);
      var id=g.getImageData(0,0,cv.width,cv.height), p=id.data, col=new T3.Color(), hsl={h:0,s:0,l:0};
      for(var q=0;q<p.length;q+=4){
        col.setRGB(p[q]/255,p[q+1]/255,p[q+2]/255); col.getHSL(hsl);
        if(hsl.s>0.12&&hsl.h>0.01&&hsl.h<0.14){
          col.setHSL((hsl.h+deg/360)%1,Math.min(1,hsl.s*sat),hsl.l);
          p[q]=Math.round(col.r*255); p[q+1]=Math.round(col.g*255); p[q+2]=Math.round(col.b*255);
        }
      }
      g.putImageData(id,0,0); return cv;
    }
    function fin(){
      if(bad){ cb(bad); return; }
      try{
        var P2={}; keys.forEach(function(k2){ P2[k2]=mkPal(imgs[k2]); });
        P2.h1=mkPal(hueShift(imgs.d,318,1.05)); // ばら色
        P2.h2=mkPal(hueShift(imgs.d,140,0.85)); // 青緑
        P2.h3=mkPal(hueShift(imgs.d,235,0.9));  // すみれ色
        PAL=P2; cb(null);
      }catch(e){ cb(e); }
    }
    keys.forEach(function(k2){
      var im=new Image();
      im.onload=function(){ imgs[k2]=im; if(--left===0)fin(); };
      im.onerror=function(){ bad=new Error('パレット '+k2+' を読み込めません'); if(--left===0)fin(); };
      im.src=srcs[k2]||srcs.d;
    });
  }
  function modGroup(plan,pal){
    var pack='kenney-modular', grp=new T3.Group(), meshes=[];
    plan.parts.forEach(function(p){
      var M=parsed[pack][p.n], o=M.obj.clone(true), h=new T3.Group();
      o.traverse(function(nd){ if(nd.isMesh){ nd.material=pal.mat; nd.userData.shared=true; meshes.push(nd); } });
      if(p.k==='w') o.position.z=-0.5-M.box.min.z; // 背面を合わせる
      else if(p.k==='p') o.position.z=-M.box.min.z; // 板の裏を壁に合わせる
      h.add(o); h.position.set(p.x,p.y,p.z); h.rotation.y=p.r*Math.PI/2; grp.add(h);
    });
    grp.updateMatrixWorld(true);
    var bb=new T3.Box3().setFromObject(grp), sz=bb.getSize(new T3.Vector3()), c=bb.getCenter(new T3.Vector3());
    var foot=Math.max(sz.x,sz.z), s=Math.min(G.lot/foot*(foot<1.6?0.74:1),G.hmax*1.12/sz.y); // 1マス幅の塔は敷地いっぱいまでは広げない
    grp.position.set(-c.x,-bb.min.y,-c.z);
    var holder=new T3.Group(); holder.add(grp); holder.scale.setScalar(s);
    return {obj:holder,meshes:meshes,H:sz.y*s,foot:foot*s,s:s};
  }
  // 区画の色：PRODUCTS は同梱の標準、SUPPORT と COMPANY は実行時に作った色（区画の色に寄せる）。
  // 区画が1つだけのときは1棟ずつ別の色：標準／同梱 a／実行時のばら色／同梱 b
  var MOD_DIST=['d','h2','h3'], MOD_FOUR=['d','a','h1','b'];
  function modPalKey(L){ return DIST.length===1?MOD_FOUR[L.j%4]:MOD_DIST[L.d%3]; }
  function buildMod(L,i,plan){
    var cell=cellOf(L.d,L.j), pal=PAL[modPalKey(L)], g=modGroup(plan,pal);
    var T=newB(i,g.H,g.foot*1.05);
    T.rot.add(g.obj); T.rot.rotation.y=G.rotY;
    T.pal=pal; T.meshes=g.meshes; T.hi=false; T.color=new T3.Color(L.color);
    T.selS=1.1; T.xzf=1; T.jump=1.6;
    T.root.position.set(cell.x,0.05,cell.z);
    var r=g.foot*0.7071;
    T.ring=ring(T.color,r*1.16,r*1.02,4,Math.PI/4,cell.x,0.062,cell.z,G.rotY);
    return T;
  }

  // ---------- レイアウト（縦長／横長 × 件数） ----------
  var G=null, staticG=null, gen=0, t0=performance.now(), riseT0=t0;
  function computeLayout(portrait){
    var nz=DIST.length, cnt=[], i, j, c, r;
    for(i=0;i<nz;i++)cnt.push(0);
    LINKS.forEach(function(L){cnt[L.d]++;});
    var g={portrait:portrait,n:N,cells:[],zones:[],empty:[],maxS:92};
    var D2R=Math.PI/180, dx,dz,st,gap,slots,cell;
    if(portrait){ // 2列。区画は奥から手前へ
      // 区画ごとの行数は件数から決まる。盤の大きさの区分は行の合計で決める
      var rows=cnt.map(function(c2){return Math.ceil(c2/2);}), TR=rows.reduce(function(a,b){return a+b;},0);
      g.size=TR<=2?'big':(TR<=4?'mid':'std'); gap=nz>1?0.3:0;
      if(g.size==='big'){ dx=3.3; dz=4.4; st=0.7; g.lot=2.3; g.hmax=3.6; g.el=44*D2R; g.maxS=160; }
      else if(g.size==='mid'){ dx=3.45; dz=2.5; st=0.7; g.lot=1.55; g.hmax=2.5; g.el=48*D2R; g.maxS=110; }
      else{ dx=3.45; dz=1.85; st=0.7; g.lot=1.3; g.hmax=2.0; g.el=48*D2R; }
      var mx=0.2,mz=0.35;
      g.W=2*dx+2*mx; g.D=2*mz+gap*(nz-1);
      for(i=0;i<nz;i++) g.D+=st+rows[i]*dz;
      g.az=0; g.rotY=-0.62;
      var z0=-g.D/2+mz;
      for(i=0;i<nz;i++){
        var zd=st+rows[i]*dz;
        var front=nz===1; // 区画が1つのときは、区画名を建物に隠れない手前に置く
        g.zones.push({x:0,z:z0+zd/2,w:2*dx,d:zd,sx:0,sz:front?z0+zd-st/2:z0+st/2,sw:2*dx-0.5,sd:st-0.14,
          grid:{x0:-dx,z0:z0+(front?0:st),nx:2,nz:rows[i],single:cnt[i]===1}});
        slots=rows[i]*2;
        for(j=0;j<slots;j++){
          c=j%2; r=(j/2)|0;
          cell={d:i,j:j,x:(c-0.5)*dx,z:z0+(front?0:st)+(r+0.5)*dz};
          if(cnt[i]===1){ if(j===0){ cell.x=0; cell.z=z0+(front?0:st)+rows[i]*dz/2; g.cells.push(cell); } }
          else if(j<cnt[i]) g.cells.push(cell); else g.empty.push(cell);
        }
        z0+=zd+gap;
      }
    }else{ // 区画は左から右へ
      // 4件までは横1列、それより多ければ奥行き2列。区画ごとの列数は件数から決まる
      var R=N<=4?1:2, cols=cnt.map(function(c2){return Math.ceil(c2/R);}), TC=cols.reduce(function(a,b){return a+b;},0);
      g.size=R===1?'big':(TC<=4?'mid':'std'); gap=nz>1?0.35:0;
      if(g.size==='big'){ dx=3.3; dz=3.7; st=0.8; g.lot=2.25; g.hmax=3.6; g.az=24*D2R; g.el=34*D2R; g.maxS=170; }
      else if(g.size==='mid'){ dx=3.0; dz=3.1; st=0.8; g.lot=1.9; g.hmax=2.8; g.az=35*D2R; g.el=36*D2R; g.maxS=120; }
      else{ dx=3.0; dz=3.1; st=0.8; g.lot=1.9; g.hmax=3.0; g.az=35*D2R; g.el=36*D2R; }
      var m=0.45;
      g.W=2*m+gap*(nz-1); for(i=0;i<nz;i++) g.W+=cols[i]*dx;
      g.D=R*dz+st+2*m; g.rotY=0;
      var zb=-g.D/2+m, x0=-g.W/2+m;
      for(i=0;i<nz;i++){
        var zw=cols[i]*dx;
        g.zones.push({x:x0+zw/2,z:0,w:zw,d:R*dz+st,sx:x0+zw/2,sz:zb+R*dz+st/2,sw:zw-0.5,sd:st-0.16,
          grid:{x0:x0,z0:zb,nx:cols[i],nz:R,single:cnt[i]===1}});
        slots=cols[i]*R;
        for(j=0;j<slots;j++){
          c=j%cols[i]; r=(j/cols[i])|0;
          cell={d:i,j:j,x:x0+(c+0.5)*dx,z:zb+(r+0.5)*dz};
          if(cnt[i]===1){ if(j===0){ cell.x=x0+zw/2; cell.z=zb+R*dz/2; g.cells.push(cell); } }
          else if(j<cnt[i]) g.cells.push(cell); else g.empty.push(cell);
        }
        x0+=zw+gap;
      }
    }
    g.dx=dx; g.dz=dz;
    return g;
  }
  function cellOf(d,j){
    for(var q=0;q<G.cells.length;q++){ if(G.cells[q].d===d&&G.cells[q].j===j) return G.cells[q]; }
    return G.cells[0];
  }
  // 区画名のテクスチャ（盤面に寝かせる）
  function stripTex(d,sw,sd){
    var cw=1024,ch=128,cv=document.createElement('canvas'); cv.width=cw; cv.height=ch;
    var g=cv.getContext('2d'), lw=ch*sw/sd; // 歪まない論理幅
    g.scale(cw/lw,1);
    g.fillStyle=d.color; g.textBaseline='middle';
    var fs=92;
    g.font='700 '+fs+'px "JetBrains Mono",ui-monospace,Menlo,Consolas,monospace';
    var a=g.measureText(d.id).width;
    if(a+16>lw){ fs=Math.floor(fs*(lw-16)/a); g.font='700 '+fs+'px "JetBrains Mono",ui-monospace,Menlo,Consolas,monospace'; a=g.measureText(d.id).width; }
    g.textAlign='left'; g.fillText(d.id,8,ch/2+4);
    g.font='500 64px "JetBrains Mono",ui-monospace,Menlo,Consolas,monospace';
    var b=g.measureText(d.range).width;
    if(lw-a-b-16>40){ // 幅が足りない区画では番号の範囲を省く
      g.textAlign='right'; g.fillText(d.range,lw-8,ch/2+4);
      g.globalAlpha=0.45;
      if(lw-a-b-80>20) g.fillRect(8+a+32,ch/2-3,lw-a-b-80,6);
    }
    var tex=new T3.CanvasTexture(cv); tex.anisotropy=maxAniso; return tex;
  }
  function disposeTree(o){
    o.traverse(function(n){
      if(n.geometry)n.geometry.dispose();
      if(n.material){ if(n.material.map)n.material.map.dispose(); n.material.dispose(); }
    });
  }
  function buildStatic(){
    if(staticG){board.remove(staticG);disposeTree(staticG);}
    staticG=new T3.Group(); board.add(staticG);
    var slab=mk(box(G.W,0.5,G.D),std(SLAB),0x6f82c4,0.8); slab.position.y=-0.25; staticG.add(slab);
    var u1=mk(box(G.W*0.7,0.35,G.D*0.7),std(0x151c38),0x4a5a94,0.6); u1.position.y=-0.675; staticG.add(u1);
    var u2=mk(box(G.W*0.4,0.3,G.D*0.4),std(0x10162e),0x4a5a94,0.5); u2.position.y=-1.0; staticG.add(u2);
    G.zones.forEach(function(z,i){
      var dc=new T3.Color(DIST[i].color);
      var plate=mk(box(z.w-0.12,0.05,z.d-0.12),std(SLAB.clone().lerp(dc,0.2)),dc.getHex(),0.9);
      plate.castShadow=false; plate.position.set(z.x,0.025,z.z); staticG.add(plate);
      var pl=new T3.Mesh(new T3.PlaneGeometry(z.sw,z.sd),
        new T3.MeshBasicMaterial({map:stripTex(DIST[i],z.sw,z.sd),transparent:true,depthWrite:false}));
      pl.rotation.x=-Math.PI/2; pl.position.set(z.sx,0.065,z.sz); staticG.add(pl);
    });
  }
  function makeBuildings(){
    clearGroup(bGroup); towers=[]; proxies=[];
    var plan=LINKS.map(genMod), plaza=G.empty.length?plazaPlan():null, seen={}, names=[];
    plan.concat(plaza?[plaza]:[]).forEach(function(p){ p.parts.forEach(function(q){ if(!seen[q.n]){seen[q.n]=1;names.push(q.n);} }); });
    if(haveAll(PACK,names)&&PAL){
      LINKS.forEach(function(L,i){ towers.push(buildMod(L,i,plan[i])); });
      // 空きマスには縁つきの小さな広場を置く（リンクではない）
      G.empty.forEach(function(e){
        var pg=modGroup(plaza,PAL[MOD_DIST[e.d%3]]);
        pg.obj.scale.multiplyScalar(0.8); pg.obj.position.set(e.x,0.05,e.z); pg.obj.rotation.y=G.rotY; bGroup.add(pg.obj);
      });
      makeLife();
      return;
    }
    clearLife();
    // 読み込みが済むまでは仮の建物を立てる
    LINKS.forEach(function(L,i){
      var T=buildGhost(L,i), c=cellOf(L.d,L.j);
      T.root.position.set(c.x,0.05,c.z); T.rot.rotation.y=G.rotY;
      towers.push(T);
    });
    var my=gen;
    setLoading(true);
    ensure(PACK,names,function(err){
      if(err){ loaded(err); return; }
      ensurePal(loaded);
    });
    function loaded(err){
      if(my!==gen)return; // 途中で切り替えられた
      setLoading(false);
      if(err){ toast(UI.buildingsFailed); if(window.console)console.warn(err); return; }
      makeBuildings(); riseT0=performance.now(); frameBoard();
    }
  }
  // ---------- にぎわい：歩く人と動物（見本） ----------
  // 人と動物はリンクではない。クリックの当たり判定には入れず、通路（マスの境目）だけを歩かせる。
  var lifeG=new T3.Group(); board.add(lifeG);
  var actors=[], lifeGen=0, lifeT0=0, nav=[], lifePad=0;
  function clearLife(){
    lifeGen++;
    actors.forEach(function(A){ A.mixer.stopAllAction(); A.mixer.uncacheRoot(A.obj); });
    lifeG.traverse(function(n){ if(n.isSkinnedMesh&&n.skeleton) n.skeleton.dispose(); });
    clearGroup(lifeG); actors=[];
  }
  // 通路の網：区画ごとの格子の交点を節にして、マスの境目に沿ってつなぐ。隣の区画とは向かい合う節どうしをつなぐ
  function buildNav(){
    var nodes=[], per=[];
    function link(a,b){ if(a===undefined||b===undefined||a===b||nodes[a].nb.indexOf(b)>=0)return; nodes[a].nb.push(b); nodes[b].nb.push(a); }
    G.zones.forEach(function(z,zi){
      var g=z.grid, map={}, c, r; per.push(map);
      for(c=0;c<=g.nx;c++)for(r=0;r<=g.nz;r++){
        if(g.single&&((c>0&&c<g.nx)||(r>0&&r<g.nz)))continue; // 1棟だけの区画は建物が中央に立つので、外周だけを通す
        map[c+','+r]=nodes.length; nodes.push({x:g.x0+c*G.dx,z:g.z0+r*G.dz,nb:[],zi:zi,c:c,r:r});
      }
    });
    G.zones.forEach(function(z,zi){
      var g=z.grid, map=per[zi], c, r, k, a;
      for(c=0;c<=g.nx;c++)for(r=0;r<=g.nz;r++){
        a=map[c+','+r]; if(a===undefined)continue;
        for(k=c+1;k<=g.nx;k++) if(map[k+','+r]!==undefined){ link(a,map[k+','+r]); break; }
        for(k=r+1;k<=g.nz;k++) if(map[c+','+k]!==undefined){ link(a,map[c+','+k]); break; }
      }
      nodes.forEach(function(p,pi){
        if(p.zi!==zi||(G.portrait?p.r!==g.nz:p.c!==g.nx))return;
        nodes.forEach(function(q,qi){
          if(q.zi!==zi+1)return;
          if(G.portrait?(q.r===0&&Math.abs(q.x-p.x)<0.01):(q.c===0&&Math.abs(q.z-p.z)<0.01)) link(pi,qi);
        });
      });
    });
    return nodes;
  }
  function lifeRng(seed){ var a=seed>>>0; return function(){ a=(Math.imul(a,1664525)+1013904223)>>>0; return a/4294967296; }; }
  // 何を置くかを決める。人も動物も、件数の半分（切り捨て、最小1）。顔ぶれは件数で決まる。
  // 動物は1匹ずつ、独りで歩くか、誰か1人についていくかを無作為に決める。1人に何匹ついてもよい
  function planLife(){
    var out=[], k, n=Math.max(1,Math.floor(N/2)), rank=[];
    for(k=0;k<n;k++){ out.push({kind:'people',name:PEOPLE[(N+k*5)%PEOPLE.length]}); rank.push(0); }
    for(k=0;k<n;k++){
      var sp={kind:'pets',name:PETS[(N+1+k*3)%PETS.length]};
      if(Math.random()<0.5){ sp.lead=Math.floor(Math.random()*n); sp.rank=++rank[sp.lead]; } // rank：その人の後ろで何番目か
      out.push(sp);
    }
    return out;
  }
  function makeLife(){
    clearLife();
    var plan=planLife();
    if(!T3.SkeletonUtils){ if(window.console)console.warn('SkeletonUtils を読み込めないため、人と動物は出しません。'); return; }
    var my=lifeGen, need={people:[],pets:[]}, kinds, left, bad=null;
    plan.forEach(function(p){ if(need[p.kind].indexOf(p.name)<0) need[p.kind].push(p.name); });
    if(need.people.length&&need.people.indexOf(RIG)<0) need.people.push(RIG);
    kinds=['people','pets'].filter(function(k){ return need[k].length>0; }); left=kinds.length;
    kinds.forEach(function(k){
      ensure(LIFE_PACKS[k],need[k],function(err){
        if(err)bad=err;
        if(--left>0||my!==lifeGen)return;
        if(bad){ if(window.console)console.warn('人と動物のデータを読み込めませんでした。',bad); return; }
        populate(plan);
      });
    });
  }
  function setAnim(A,name){
    if(A.cur===name||!A.acts[name])return;
    var next=A.acts[name]; next.reset().play();
    if(RM){ if(A.cur) A.acts[A.cur].stop(); }
    else{ next.fadeIn(0.18); if(A.cur) A.acts[A.cur].fadeOut(0.18); }
    A.cur=name;
  }
  function populate(plan){
    var rnd=lifeRng(N*97+G.zones.length*13+(G.portrait?1:0)), hP=G.lot*0.34; // hP：人の背の高さ（盤の単位）。建物の1階より少し高い、おもちゃの縮尺
    nav=buildNav(); lifeT0=performance.now(); lifePad=hP*0.5;
    plan.forEach(function(sp,ix){
      var P=LIFE_PACKS[sp.kind], M=parsed[P.pack][sp.name], o=T3.SkeletonUtils.clone(M.obj);
      o.traverse(function(n){ if(n.isMesh) n.frustumCulled=false; });
      var tall=sp.kind==='people'?hP:hP*0.62, sc=tall/(M.box.max.y-M.box.min.y);
      var root=new T3.Group(); root.add(o);
      var clips=sp.kind==='people'?parsed[P.pack][RIG].anims:M.anims, mixer=new T3.AnimationMixer(o), acts={};
      clips.forEach(function(c){ acts[c.name]=mixer.clipAction(c); });
      var A={kind:sp.kind,root:root,obj:o,mixer:mixer,acts:acts,cur:null,sc:sc,ix:ix,yaw:0,x:0,z:0,pause:0,moving:true,trail:[],lead:null};
      lifeG.add(root); root.position.y=0.05;
      if(sp.lead===undefined){
        A.at=Math.floor(rnd()*nav.length); A.prev=-1;
        A.speed=(sp.kind==='people'?1.05:1.35)*hP*(0.9+rnd()*0.25);
        A.off=hP*0.24; A.pp=sp.kind==='people'?0.22:0.4; // off：通路の中心からの寄せ幅　pp：節で立ち止まる確率
        nextLeg(A,rnd);
        A.u=rnd()*0.8; setAnim(A,RM?'idle':'walk');
      }else{
        A.lead=sp.lead; A.back=hP*0.75*sp.rank; A.near=hP*0.06; // back：人からの距離　near：これより近ければ止まる
        setAnim(A,'idle');
      }
      actors.push(A);
    });
    actors.forEach(function(A){ if(A.lead!==null) A.lead=actors[A.lead]; }); // 人は必ず動物より先に並んでいる
    lifeTick(0,performance.now()); // 動きを減らす設定でも、最初の姿勢と位置は入れる
    actors.forEach(function(A){ A.mixer.update(0); });
  }
  function nextLeg(A,rnd){
    var nb=nav[A.at].nb, c=nb.filter(function(n){ return n!==A.prev; });
    if(!c.length) c=nb;
    A.to=c[Math.floor((rnd||Math.random)()*c.length)];
    var a=nav[A.at], b=nav[A.to]; A.len=Math.sqrt((b.x-a.x)*(b.x-a.x)+(b.z-a.z)*(b.z-a.z)); A.u=0;
  }
  function turn(A,dx,dz,k){
    var want=Math.atan2(dx,dz), d=want-A.yaw;
    while(d>Math.PI)d-=2*Math.PI; while(d<-Math.PI)d+=2*Math.PI;
    A.yaw+=d*Math.min(1,k); A.root.rotation.y=A.yaw;
  }
  // dt が 0 のときは、位置と向きを目標へ一気に合わせるだけで進めない
  function lifeTick(dt,now){
    if(!actors.length)return;
    var snap=dt===0||RM, q, A, a, b, tx, tz, dx, dz, f;
    for(q=0;q<actors.length;q++){
      A=actors[q];
      var grow=RM?1:ease(clamp((now-lifeT0-350-A.ix*70)/380,0,1));
      A.obj.scale.setScalar(A.sc*Math.max(0.001,grow));
      if(A.lead){ // 人についていく動物：その人の足あとを、決まった距離だけ後ろからたどる
        var L=A.lead, tr=L.trail, acc=0, w, px=L.x, pz=L.z;
        // 足あとがまだ短いときは、人の真後ろに置く
        tx=L.x-Math.sin(L.yaw)*A.back; tz=L.z-Math.cos(L.yaw)*A.back;
        for(w=0;w<tr.length;w++){
          acc+=Math.sqrt((tr[w].x-px)*(tr[w].x-px)+(tr[w].z-pz)*(tr[w].z-pz)); px=tr[w].x; pz=tr[w].z;
          if(acc>=A.back){ tx=px; tz=pz; break; }
        }
        tx=clamp(tx,-G.W/2+lifePad,G.W/2-lifePad); tz=clamp(tz,-G.D/2+lifePad,G.D/2-lifePad);
        dx=tx-A.x; dz=tz-A.z; f=Math.sqrt(dx*dx+dz*dz);
        if(snap){ A.x=tx; A.z=tz; A.yaw=L.yaw; A.root.rotation.y=A.yaw; }
        else{
          A.x+=dx*Math.min(1,dt*6); A.z+=dz*Math.min(1,dt*6);
          if(f>A.near) turn(A,dx,dz,dt*9);
          setAnim(A,f>A.near?'walk':'idle');
        }
      }else{
        if(!snap){
          if(A.pause>0){
            A.pause-=dt;
            if(A.pause<=0){ nextLeg(A); setAnim(A,'walk'); A.moving=true; }
          }else{
            A.u+=A.speed*dt/A.len;
            if(A.u>=1){
              A.prev=A.at; A.at=A.to;
              if(Math.random()<A.pp){
                A.pause=1.2+Math.random()*2.6; A.moving=false; A.u=0;
                setAnim(A,A.kind==='pets'&&Math.random()<0.5?'eat':'idle');
              }else nextLeg(A);
            }
          }
        }
        if(A.moving){ // 立ち止まっている間は、その場から動かさない
        a=nav[A.at]; b=nav[A.to]; dx=b.x-a.x; dz=b.z-a.z;
        f=Math.sqrt(dx*dx+dz*dz)||1;
        // 進む向きの右側に寄って歩く（すれ違っても重ならない）
        tx=a.x+dx*A.u-(dz/f)*A.off; tz=a.z+dz*A.u+(dx/f)*A.off;
        // 外周の通路は盤の縁に近いので、体がはみ出さないよう内側に収める
        tx=clamp(tx,-G.W/2+lifePad,G.W/2-lifePad); tz=clamp(tz,-G.D/2+lifePad,G.D/2-lifePad);
        if(snap){ A.x=tx; A.z=tz; }
        else{ A.x+=(tx-A.x)*Math.min(1,dt*7); A.z+=(tz-A.z)*Math.min(1,dt*7); }
        turn(A,dx,dz,snap?1:dt*9);
        }
        // 足あと：ついてくる動物がたどる。新しい順に 0.04 ごと
        if(A.kind==='people'&&(!A.trail.length||Math.abs(A.trail[0].x-A.x)+Math.abs(A.trail[0].z-A.z)>0.04)){ A.trail.unshift({x:A.x,z:A.z}); if(A.trail.length>140)A.trail.pop(); }
      }
      A.root.position.x=A.x; A.root.position.z=A.z;
      if(!snap) A.mixer.update(dt);
    }
  }

  function setCamera(){
    var ce=Math.cos(G.el);
    camera.position.set(Math.sin(G.az)*ce*60,Math.sin(G.el)*60,Math.cos(G.az)*ce*60);
    camera.up.set(0,1,0); camera.lookAt(0,0,0); camera.updateMatrixWorld(true);
  }
  function build(){
    gen++;
    G=computeLayout(vw/vh<0.8);
    buildStatic(); makeBuildings(); setCamera();
    order=[]; for(var oi=0;oi<N;oi++)order.push(oi);
    t0=riseT0=performance.now();
    yaw=0; yv=0; dragYaw=0;
    frameBoard();
  }

  // ---------- 正投影の枠を盤に合わせる ----------
  var base={cx:0,cy:0,pcx:0,pcy:0,s:40}, tmp=new T3.Vector3();
  function applyFrustum(k,tx,ty){
    var s=base.s*(1+k*0.9);
    var Ax=base.cx+(tx-base.cx)*k, Ay=base.cy+(ty-base.cy)*k;
    var Px=base.pcx+(vw/2-base.pcx)*k, Py=base.pcy+(vh*0.5-base.pcy)*k;
    camera.left=Ax-Px/s; camera.right=camera.left+vw/s;
    camera.top=Ay+Py/s; camera.bottom=camera.top-vh/s;
    camera.updateProjectionMatrix();
  }
  function frameBoard(){
    var x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;
    function acc(x,y,z){
      tmp.set(x,y,z).applyMatrix4(camera.matrixWorldInverse);
      if(tmp.x<x0)x0=tmp.x; if(tmp.x>x1)x1=tmp.x; if(tmp.y<y0)y0=tmp.y; if(tmp.y>y1)y1=tmp.y;
    }
    for(var a=-1;a<=1;a+=2)for(var b=-1;b<=1;b+=2){ acc(a*G.W/2,0,b*G.D/2); acc(a*G.W/2,-0.5,b*G.D/2); }
    towers.forEach(function(T){ var p=T.root.position; acc(p.x,T.baseY+T.H*T.ky,p.z); });
    var hb=hd.getBoundingClientRect().bottom, ftop=ft.getBoundingClientRect().top;
    var ax0=10, ax1=vw-10, ay0=hb+52, ay1=ftop-12;
    if(ay1-ay0<80){ ay0=hb+8; ay1=Math.max(ay0+80,ftop-4); }
    var bw=Math.max(0.01,x1-x0), bh=Math.max(0.01,y1-y0);
    base.s=Math.min((ax1-ax0)/bw,(ay1-ay0)/bh,G.maxS);
    base.cx=(x0+x1)/2; base.cy=(y0+y1)/2; base.pcx=(ax0+ax1)/2; base.pcy=(ay0+ay1)/2;
    applyFrustum(0,0,0);
    for(var q=0;q<N;q++)items[q].y=null; // ラベルは即座に置き直す
  }
  function fit(){
    vw=Math.max(1,app.clientWidth); vh=Math.max(1,app.clientHeight);
    renderer.setSize(vw,vh,false);
    var portrait=vw/vh<0.8;
    if(!G||G.portrait!==portrait||G.n!==N) build();
    else frameBoard();
  }

  // ---------- 粒子 ----------
  var PN=70, pp=new Float32Array(PN*3), pspd=[];
  for(var pi=0;pi<PN;pi++){
    pp[pi*3]=(Math.random()-0.5)*30; pp[pi*3+1]=Math.random()*13-4; pp[pi*3+2]=(Math.random()-0.5)*26;
    pspd.push(0.15+Math.random()*0.4);
  }
  var pgeo=new T3.BufferGeometry(); pgeo.setAttribute('position',new T3.BufferAttribute(pp,3));
  var points=new T3.Points(pgeo,new T3.PointsMaterial({color:0xf4efe4,size:2*PR,sizeAttenuation:false,
    transparent:true,opacity:0.5,depthWrite:false}));
  points.frustumCulled=false; scene.add(points);

  // ---------- ポインタ ----------
  var ray=new T3.Raycaster(), ndc=new T3.Vector2();
  var ptr={x:0,y:0}, down=null, dragging=false, dragYaw=0, yaw=0, yv=0, tiltX=0, tiltZ=0;
  var MAXYAW=35*Math.PI/180;
  function pick(x,y){
    ndc.set(x/vw*2-1,-(y/vh*2-1));
    ray.setFromCamera(ndc,camera);
    var hits=ray.intersectObjects(proxies,false);
    return hits.length?hits[0].object.userData.i:-1;
  }
  canvas.addEventListener('pointerdown',function(e){
    if(opening)return;
    lastTouch=e.pointerType!=='mouse';
    down={id:e.pointerId,x:e.clientX,y:e.clientY,yaw:yaw,drag:false};
    try{canvas.setPointerCapture(e.pointerId);}catch(_){}
    var h=pick(e.clientX,e.clientY);
    if(h>=0) select(h); // 触れた瞬間に選択
  });
  canvas.addEventListener('pointermove',function(e){
    if(e.pointerType==='mouse'){ ptr.x=e.clientX/vw*2-1; ptr.y=-(e.clientY/vh*2-1); }
    if(down&&e.pointerId===down.id){
      var mx=e.clientX-down.x, my=e.clientY-down.y;
      if(!down.drag&&Math.sqrt(mx*mx+my*my)>8){ down.drag=true; dragging=true; canvas.classList.add('drag'); }
      if(down.drag) dragYaw=clamp(down.yaw+mx*0.006,-MAXYAW,MAXYAW);
    }else if(e.pointerType==='mouse'&&!opening){
      var h=pick(e.clientX,e.clientY);
      if(h>=0){ select(h); canvas.style.cursor='pointer'; }
      else{ canvas.style.cursor=''; if(sel>=0) scheduleClear(); }
    }
  });
  function release(e){
    if(!down||e.pointerId!==down.id)return;
    var d=down; down=null; dragging=false; canvas.classList.remove('drag');
    if(e.type==='pointerup'&&!d.drag){
      var h=pick(e.clientX,e.clientY);
      if(h>=0) openLink(h); else select(-1);
    }
  }
  canvas.addEventListener('pointerup',release);
  canvas.addEventListener('pointercancel',release);
  document.addEventListener('mouseleave',function(){ ptr.x=0; ptr.y=0; });

  // ---------- 開く演出 ----------
  function startOpen(i,msg){
    var T=towers[i];
    tmp.set(0,T.H*0.6,0); T.root.localToWorld(tmp); tmp.applyMatrix4(camera.matrixWorldInverse);
    opening={i:i,t0:performance.now(),msg:msg,tx:tmp.x,ty:tmp.y,toasted:false};
    wash.style.setProperty('--c',LINKS[i].color);
    labelsEl.classList.add('opening');
  }
  function ease(p){return p<0.5?2*p*p:1-Math.pow(-2*p+2,2)/2;}
  function back(p){var c1=1.70158,c3=c1+1;return 1+c3*Math.pow(p-1,3)+c1*Math.pow(p-1,2);}

  // ---------- ラベルの配置（投影＋重なり解消） ----------
  var order=[];
  function layoutLabels(dt){
    var k,it,T,w;
    for(k=0;k<N;k++){
      it=items[k]; T=towers[k];
      tmp.set(0,T.H+0.1/T.ky,0); T.root.localToWorld(tmp); tmp.project(camera);
      it.ax=(tmp.x+1)/2*vw; it.ay=(1-tmp.y)/2*vh;
      it.bx=it.ax-it.w/2;
      if(!opening) it.bx=clamp(it.bx,5,Math.max(5,vw-5-it.w));
      it.by=it.ay-STEM;
    }
    // 手前（画面の下）から置き、重なったら上へ逃がす。旗竿が伸びる
    order.sort(function(a,b){return (items[b].by-items[a].by)||(a-b);});
    var placed=[];
    for(k=0;k<N;k++){
      it=items[order[k]];
      var by=it.by, moved=true, guard=0;
      while(moved&&guard++<40){
        moved=false;
        for(var p=0;p<placed.length;p++){
          var o=placed[p];
          if(it.bx<o.bx+o.w+4&&it.bx+it.w+4>o.bx&&by>o.ty-o.h-4&&by-it.h<o.ty+4){ by=o.ty-o.h-5; moved=true; }
        }
      }
      it.ty=by; placed.push(it);
    }
    var f=RM?1:Math.min(1,dt*14);
    for(k=0;k<N;k++){
      it=items[k];
      it.y=(it.y===null)?it.ty:it.y+(it.ty-it.y)*f;
      var x=it.bx, y=it.y; w=it.w;
      if(k===sel){
        w=SELW; x=it.ax-w/2;
        if(!opening){
          x=clamp(x,5,Math.max(5,vw-5-w));
          var eh=it.el.offsetHeight, top=hd.getBoundingClientRect().bottom+4;
          if(y-eh<top) y=top+eh;
        }
      }
      it.el.style.transform='translate3d('+x.toFixed(1)+'px,'+y.toFixed(1)+'px,0) translateY(-100%)';
      it.stem.style.height=Math.max(0,it.ay-y).toFixed(1)+'px';
      it.stem.style.left=clamp(it.ax-x,6,w-6).toFixed(1)+'px';
    }
  }

  // ---------- 毎フレーム ----------
  var last=t0;
  function frame(now){
    if(plainMode)return;
    requestAnimationFrame(frame);
    try{ step(now); }
    catch(err){ toPlain(err); } // 描画が壊れたらシンプルなポータルに切り替える
  }
  // GPU の都合で描画の土台が失われることがある（タブの開きすぎ、スマホでのアプリ切り替えなど）
  canvas.addEventListener('webglcontextlost',function(){ toPlain(new Error('WebGL のコンテキストが失われました')); });
  function step(now){
    var t=now/1000, dt=Math.min(0.05,Math.max(0.001,(now-last)/1000)), e=now-t0, er=now-riseT0, k, j;
    last=now;
    for(k=0;k<N;k++){
      var T=towers[k], on=sel===k;
      var p=RM?1:clamp((er-60-k*45)/420,0,1), rise=RM?1:back(p);
      if(!T.shown&&(RM||e>=60+k*45)){ T.shown=true; els[k].classList.add('on'); }
      var tg=on?T.selS:1;
      if(RM){ T.sy=tg; T.glow=on?0.4:0; }
      else{
        T.sv+=((tg-T.sy)*190-T.sv*15)*dt; T.sy+=T.sv*dt;
        T.glow+=((on?0.4:0)-T.glow)*Math.min(1,dt*10);
      }
      if(T.pal){ // パレットごとの共有マテリアルを、選択中だけ光る版に差し替える
        var hi=T.glow>0.03;
        if(hi!==T.hi){ T.hi=hi; var mm=hi?T.pal.hi:T.pal.mat; for(j=0;j<T.meshes.length;j++) T.meshes[j].material=mm; }
        if(on) T.pal.hi.emissive.copy(T.color);
      }
      if(T.ring) T.ring.opacity=0.4+T.glow*1.5;
      var sx=T.kx*(1+(T.sy-1)*T.xzf);
      T.root.scale.set(sx,Math.max(0.001,T.ky*rise*T.sy),sx);
      if(T.jump) T.root.position.y=T.baseY+Math.max(0,(T.sy-1)*T.jump);
    }
    if(RM){
      yaw=dragging?dragYaw:0;
      board.rotation.set(0,yaw,0); board.position.y=0;
    }else{
      if(dragging){ yaw+=(dragYaw-yaw)*Math.min(1,dt*20); yv=0; }
      else{ yv+=((0-yaw)*70-yv*9)*dt; yaw+=yv*dt; }
      var f=Math.min(1,dt*4);
      tiltX+=(-ptr.y*0.06-tiltX)*f; tiltZ+=(-ptr.x*0.055-tiltZ)*f;
      board.rotation.set(tiltX+Math.sin(t*0.5)*0.012,yaw+Math.sin(t*0.35)*0.02,tiltZ);
      board.position.y=Math.sin(t*0.9)*0.09+(1-ease(clamp(e/500,0,1)))*-1.2;
      for(k=0;k<PN;k++){ pp[k*3+1]+=pspd[k]*dt; if(pp[k*3+1]>9)pp[k*3+1]=-4; }
      pgeo.attributes.position.needsUpdate=true;
    }
    if(opening){
      var q=now-opening.t0, z;
      if(q<520) z=ease(q/520); else if(q<860) z=1; else if(q<1340) z=1-ease((q-860)/480); else z=-1;
      if(q>=520&&!opening.toasted){ opening.toasted=true; toast(opening.msg); }
      if(z<0){
        var went=opening.i;
        opening=null; labelsEl.classList.remove('opening'); wash.style.opacity='0'; applyFrustum(0,0,0);
        goTo(went); // 寄る演出が済んでから移動する
        if(lastTouch){ if(document.activeElement&&document.activeElement.blur)document.activeElement.blur(); select(-1); }
      }else{
        wash.style.opacity=(z*0.85).toFixed(3); applyFrustum(z,opening.tx,opening.ty);
      }
    }
    lifeTick(dt,now);
    scene.updateMatrixWorld();
    layoutLabels(dt);
    renderer.render(scene,camera);
  }

  fit();
  requestAnimationFrame(frame);
  return {
    fit:fit,
    build:build,
    rebuild:function(){ if(G){ buildStatic(); } },
    startOpen:startOpen
  };
}

if(!plainMode){
  try{ GL=initGL(); }
  catch(err){ toPlain(err); }
}

measure();
// フォントが使えるようになったら、札の寸法を測り直し、区画名を描き直す。
// フォントの CSS は本体より後に届くこともあるので、届いたときにも呼ばれる（PORTAL_BOOT.onFont）
function refit(){
  if(!document.fonts||!document.fonts.load)return;
  var again=function(){ measure(); if(GL){ GL.rebuild(); GL.fit(); } };
  Promise.all([document.fonts.load('900 15px "Noto Sans JP"',plainEl.textContent),
               document.fonts.load('700 12px "JetBrains Mono"','PORTAL 0123456789')]).then(again,again);
}
window.PORTAL_BOOT.onFont=refit;
refit();
var rz=0;
function onResize(){
  cancelAnimationFrame(rz);
  rz=requestAnimationFrame(function(){ measure(); if(GL) GL.fit(); });
}
window.addEventListener('resize',onResize);
window.addEventListener('orientationchange',onResize);
if(window.visualViewport) window.visualViewport.addEventListener('resize',onResize);
})();
}catch(err){ // 準備の途中で止まったら、箱庭をやめてシンプルなポータルを見せる
  document.documentElement.className='';
  if(window.console)console.warn('箱庭を準備できないため、リンクの一覧を表示します。',err);
}
}
// 箱庭を出すときだけ、フォントとライブラリを取りに行く。シンプルなポータルでは何も読み込まない
(function(){
  var root=document.documentElement;
  if(!root.classList.contains('gl'))return;
  var font=document.createElement('link'); font.rel='stylesheet';
  font.href='https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@500;700&family=Noto+Sans+JP:wght@500;700;900&display=swap';
  font.onload=function(){ var f=window.PORTAL_BOOT.onFont; if(f) f(); }; // 本体より後に届いたら、測り直しと描き直しを頼む
  document.head.appendChild(font);
  var srcs=['https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
            'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js',
            'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/utils/SkeletonUtils.js',
            'kenney-buildings.js'], left=srcs.length;
  srcs.forEach(function(src){
    var el=document.createElement('script'); el.src=src; el.async=false; // async=false で、並べた順に実行される
    el.onload=function(){
      if(--left>0)return;
      if(!root.classList.contains('gl'))return; // 待ち時間を過ぎて、もう一覧を見せている
      window.PORTAL_BOOT.started=true;
      PORTAL_MAIN();
    };
    el.onerror=function(){ root.className=''; }; // 届かなければ、すぐに一覧を見せる
    document.head.appendChild(el);
  });
})();

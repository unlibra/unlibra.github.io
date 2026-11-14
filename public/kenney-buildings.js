// Kenney Modular Buildings の部品を、名前から決まる規則で組み立てる。
// three.js には触れない。返すのは部品の並び（名前・位置・向き）だけ。
//   PortalBuildings.plan(name, {seed, tall, arch}) → {arch, parts:[{n,x,y,z,r,k}]}
//     seed  サイトごとの文字列。変えると全部の建物が変わる
//     tall  true なら階数を1つ足す
//     arch  型を名指しする（ARCHS のどれか）。省くと名前から決まる。細部はどちらでも名前から決まる
//   同じ引数なら、盤の他のリンクに関係なく同じ結果になる。
// 部品を1つずつ描いて確かめたこと：
//  ・壁ブロックは 1×0.625×1。窓や扉は +Z の面だけにある（他の3面は無地）
//  ・階段つき1階は高さ 0.8375。帯（roof-flat-detail-*）は 0.2125 で、帯＋壁＝階段つき1階
//  ・張り出しのある部品は原点が箱の中心にずれている → 置く側で背面を z=-0.5 に合わせ直す（k:'w'）
//  ・r を 1 足すごとに +Z→+X→-Z→-X と向く
(function(root){
'use strict';
  var FH=0.625, GH=0.8375, BH=0.2125;
  function hash(s){ // FNV-1a
    var h=2166136261;
    for(var i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619)>>>0; }
    return h>>>0;
  }
  var M_MAIN=[
    {s:'building-window',l:'building-window-right',r:'building-window-left'},
    {s:'building-windows'},{s:'building-windows-round'},{s:'building-window-wide'},
    {s:'building-window-large',l:'building-window-large-left',r:'building-window-large-right'},
    {s:'building-window-sill',l:'building-window-right-sill',r:'building-window-left-sill'},
    {s:'building-windows-sills'},{s:'building-windows-sills-round'},{s:'building-window-wide-sill'},
    {s:'building-windows',high:1}
  ];
  var M_ACC=[{s:'building-window-balcony'},{s:'building-window-awnings'},{s:'building-window-balcony'},
    {s:'building-window-wide-sill'},{s:'building-windows-round'},{s:'building-window-large',l:'building-window-large-left',r:'building-window-large-right'}];
  var M_DOOR=['building-door','building-door-window','building-door-window-narrow','building-window-door-window','building-window-door-window-round'];
  var M_STEP=['building-steps-narrow','building-steps-wide','building-steps-narrow-windows','building-steps-narrow-windows-round'];
  var M_PANEL=['window-brown','window-white','window-brown-round-top','window-white-tall','window-brown-wide','window-white-detailed','window-white-round-wide','window-brown-tall'];
  var M_ARCH=[['tower',2],['chamfer',1.5],['slab',2],['shop',2],['house',2],['cottage',1.5],['hall',2],['step',2.5],['ell',1.5]];
  var M_FLAT=[['roof-flat-border-side',[0]],['roof-flat-border-corner',[0,1]],['roof-flat-border-straight',[1,3]],
              ['roof-flat-border-end',[0,1,3]],['roof-flat-border-center',[0,1,2,3]]];
  function rng(seed){ // mulberry32
    var a=seed>>>0;
    return function(){ a=(a+0x6D2B79F5)>>>0; var t=a; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; };
  }
  function flatRoof(E){ // 露出している辺の組 → 縁つき屋根の部品と向き
    if(!E.length) return ['roof-flat-center',0];
    var key=E.slice().sort().join('');
    for(var p=0;p<M_FLAT.length;p++)for(var k=0;k<4;k++){
      if(M_FLAT[p][1].map(function(d){return (d+k)%4;}).sort().join('')===key) return [M_FLAT[p][0],k];
    }
    return ['roof-flat-center',0];
  }
  var ARCHS=M_ARCH.map(function(a){return a[0];});
  function plan(name,o){
    if(typeof name!=='string'||!o||typeof o.seed!=='string') throw new Error('plan(name,{seed}) の name と seed は文字列で渡す');
    if(o.arch!==undefined&&ARCHS.indexOf(o.arch)<0) throw new Error('知らない型: '+o.arch);
    var R=rng(hash(name+o.seed)), out=[];
    function ri(a,b){return a+Math.floor(R()*(b-a+1));}
    function pk(a){return a[Math.floor(R()*a.length)];}
    var tot=0,q; for(q=0;q<M_ARCH.length;q++)tot+=M_ARCH[q][1];
    var x=R()*tot, arch=M_ARCH[0][0];
    for(q=0;q<M_ARCH.length;q++){ x-=M_ARCH[q][1]; if(x<0){arch=M_ARCH[q][0];break;} }
    if(o.arch!==undefined) arch=o.arch;
    var prod=o.tall?1:0, w=1, dp=1, fl={}, roof='flat', ground='door', i, k, f, n;
    function fill(nn){ for(var a=0;a<w;a++)for(var b=0;b<dp;b++)fl[a+','+b]=nn; }
    switch(arch){
      case 'tower': fill(ri(3,4)+prod); roof=pk(['top','ring','top','cap']); ground=pk(['steps','steps','door']); break;
      case 'chamfer': fill(ri(2,3)+prod); roof=pk(['cring','chigh']); ground='chamfer'; break;
      case 'slab': w=2; fill(ri(2,3)+prod); roof=pk(['flat','flat','slant']); ground=pk(['door','steps','shop']); break;
      case 'shop': w=2; dp=pk([1,1,2]); fill(ri(1,2)); ground='shop'; break;
      case 'house': dp=2; fill(ri(1,2)); roof=pk(['gable','gable','slant']); ground=pk(['steps','door']); break;
      case 'cottage': w=2; fill(ri(1,2)); roof=pk(['gable','slant']); ground=pk(['steps','door']); break;
      case 'hall': w=2; dp=2; fill(ri(1,2)+prod); roof=pk(['hip','slant','flat']); ground=pk(['steps','door','shop']); break;
      case 'step': w=2; dp=pk([1,2]); fill(ri(1,2));
        var tall=ri(3,4)+prod, lay=dp===1?pk(['l','r']):pk(['back','l','corner']);
        if(lay==='l'){ fl['0,0']=tall; if(dp===2)fl['0,1']=tall; }
        else if(lay==='r') fl['1,0']=tall;
        else if(lay==='back'){ fl['0,0']=tall; fl['1,0']=tall; }
        else fl['0,0']=tall;
        ground=pk(['door','steps','shop']); break;
      default: w=2; dp=2; n=ri(1,2); fl['0,0']=n+ri(0,1)+prod; fl['1,0']=fl['0,0']; fl['0,1']=n; ground=pk(['door','steps']); // ell：手前右が欠けた L 字
    }
    function F(a,b){ return fl[a+','+b]||0; }
    var maxF=0, minF=9; for(q in fl){ if(fl[q]>maxF)maxF=fl[q]; if(fl[q]<minF)minF=fl[q]; }
    if(maxF!==minF||arch==='ell') roof='flat';
    var main=pk(M_MAIN), acc=pk(M_ACC), pat=ri(0,3), band=(maxF>=3&&R()<0.45)?pk(['roof-flat-detail-b','roof-flat-detail-c']):null;
    if(main.high&&maxF<3) main=M_MAIN[1];
    if(arch==='chamfer') band=null; // 角を落とした塔に合う帯の部品がない
    var flatTop=roof==='flat'||roof==='top'||roof==='ring';
    var topBand=(flatTop&&R()<0.5)?pk(['roof-flat-detail-b','roof-flat-detail-c']):null;
    var panel=pk(M_PANEL), ac=R()<0.6, door=pk(M_DOOR), stp=pk(M_STEP), awn=pk(['roof-flat-awning-a','roof-flat-awning-b','roof-flat-awning-c']);
    var slantVar=pk(['roof-slanted-window','roof-slanted-detail','roof-slanted']), topKind=pk(['round','square']);
    var cself=pk(['building-corner-window','building-corner-window-sill','building-corner-window-narrow']);
    var gi=arch==='ell'?0:ri(0,w-1), acCell=ri(0,w*dp-1);
    var hg=ground==='steps'?GH:FH, shop=ground==='shop';
    // 階ごとの高さ。帯は全部の柱で同じ高さに入るので、段違いでも線がそろう
    var yF=[0], bandY=[], y=hg+(shop?BH:0);
    for(f=1;f<maxF;f++){ yF[f]=y; y+=FH; if(band&&f%2===1){ bandY[f]=y; y+=BH; } }
    function colTop(nn){ return nn===1?hg+(shop?BH:0):yF[nn-1]+FH; }
    function put(nm,cx,cy,cz,r,kind){ out.push({n:nm,x:cx,y:cy,z:cz,r:r||0,k:kind||''}); }
    function wallName(st,ci,f2,nn,facing){
      if(st.high){
        if(f2%2===1&&f2+1<nn) return 'building-windows-high-middle';
        if(f2%2===0&&f2>=2) return 'building-windows-high-top-'+topKind;
        return 'building-windows';
      }
      if(facing===0&&w===2&&st.l) return ci===0?st.l:st.r;
      return st.s;
    }
    var pnarrow=panel.indexOf('white')>0?'window-white-narrow':'window-brown-narrow';
    for(i=0;i<w;i++)for(k=0;k<dp;k++){
      n=F(i,k); if(!n)continue;
      var cx=i-(w-1)/2, cz=k-(dp-1)/2;
      for(f=0;f<n;f++){
        var front=F(i,k+1)<=f, side=F(i+1,k)<=f, dir=front?0:(side?1:-1), by=yF[f], nm, isDoor=false;
        if(arch==='chamfer'){
          nm=cself;
          if(n>=3&&f===n-2) nm='building-corner-window-middle';
          if(n>=3&&f===n-1) nm='building-corner-window-top-'+topKind;
          put(nm,cx,by,cz,0,'w');
          put(pnarrow,cx-0.22,by+0.1,cz+0.5,0,'p');
          put(pnarrow,cx+0.5,by+0.1,cz-0.22,1,'p');
          continue;
        }
        if(dir<0) nm='building-block';
        else if(f===0){
          isDoor=dir===0&&i===gi;
          if(isDoor) nm=ground==='steps'?stp:(shop?'building-door-window':door);
          else nm=shop?wallName(M_MAIN[4],i,0,n,dir):wallName(main.high?M_MAIN[1]:main,i,0,n,dir);
        }else{
          var useAcc=(pat===1&&f===n-1)||(pat===2&&f===1)||(pat===3&&f%2===1);
          nm=wallName(useAcc&&dir===0&&!main.high?acc:main,i,f,n,dir);
        }
        if(f===0&&ground==='steps'&&!isDoor){ put('roof-flat-detail-c',cx,0,cz,0,''); by=BH; } // 帯で底上げして階段つき1階と高さをそろえる
        put(nm,cx,by,cz,dir<0?0:dir,'w');
        if(front&&side) put(panel,cx+0.5,(f===0&&ground==='steps'?BH:by)+0.1,cz,1,'p'); // 無地の側面に窓の板を貼る
        if(f===0&&shop) put(dir<0?'roof-flat-detail-c':awn,cx,hg,cz,dir<0?0:dir,'');
        if(band&&bandY[f]!==undefined&&n>f+1) put(band,cx,bandY[f],cz,0,'');
      }
      // 屋根
      var ty=colTop(n), rr;
      if(topBand&&roof!=='cap'){ put(topBand,cx,ty,cz,0,''); ty+=BH; }
      switch(roof){
        case 'top': put('roof-flat-top',cx,ty,cz,0,''); if(ac) put('detail-ac-a',cx+0.12,ty+BH,cz-0.1,0,''); break;
        case 'cap': put('roof-flat-detail-a',cx,ty,cz,0,''); put('roof-flat-top',cx,ty+BH,cz,0,''); break;
        case 'ring': put('roof-flat-border-center',cx,ty,cz,0,''); if(ac) put('detail-ac-a',cx-0.08,ty+0.1,cz+0.05,0,''); break;
        case 'cring': put('roof-flat-border-center-corner',cx,ty,cz,0,''); break;
        case 'chigh': put('roof-flat-corner-high',cx,ty,cz,0,''); break;
        case 'gable': put('roof-gable',cx,ty,cz,w===1?0:1,''); break;
        case 'slant':
          rr=(dp===2&&k===0)?2:0;
          put(rr===0&&i===gi?slantVar:'roof-slanted',cx,ty,cz,rr,''); break;
        case 'hip':
          rr=(i===1&&k===1)?0:(i===1&&k===0)?1:(i===0&&k===0)?2:3;
          put('roof-slanted-corner-c',cx,ty,cz,rr,''); break;
        default:
          var E=[], nb=[[0,1],[1,0],[0,-1],[-1,0]];
          for(q=0;q<4;q++) if(F(i+nb[q][0],k+nb[q][1])<n) E.push(q);
          rr=flatRoof(E); put(rr[0],cx,ty,cz,rr[1],'');
          if(ac&&i*dp+k===acCell) put('detail-ac-a',cx+0.08,ty+0.1,cz-0.06,0,'');
      }
    }
    return {arch:arch,parts:out};
  }
  function plazaPlan(){
    var out=[], i, k, q, nb=[[0,1],[1,0],[0,-1],[-1,0]];
    for(i=0;i<2;i++)for(k=0;k<2;k++){
      var E=[]; for(q=0;q<4;q++){ var a=i+nb[q][0], b=k+nb[q][1]; if(a<0||a>1||b<0||b>1)E.push(q); }
      var rr=flatRoof(E); out.push({n:rr[0],x:i-0.5,y:0,z:k-0.5,r:rr[1],k:''});
    }
    out.push({n:'detail-ac-a',x:-0.4,y:0.1,z:-0.3,r:0,k:''});
    return {arch:'plaza',parts:out};
  }
  var api={ARCHS:ARCHS,plan:plan,plaza:plazaPlan,hash:hash};
  if(typeof module==='object'&&module.exports) module.exports=api; else root.PortalBuildings=api;
})(this);

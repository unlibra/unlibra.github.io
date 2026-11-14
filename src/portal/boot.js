// 箱庭を出せるなら箱庭の見た目にする。出せないときは、何もしなければシンプルなポータルが見える。
// ?plain=1 はシンプルなポータルを確かめるための指定
(function(){
  if(/[?&]plain=1(&|$)/.test(location.search))return;
  // WebGL が止められた環境でも機能の名前は残っているので、実際にコンテキストを作って確かめる
  var cv=document.createElement('canvas'), ctx=null;
  try{ ctx=cv.getContext('webgl2')||cv.getContext('webgl'); }catch(_){}
  if(!ctx)return;
  var lose=ctx.getExtension('WEBGL_lose_context'); if(lose)lose.loseContext(); // 確認用のコンテキストはすぐ手放す
  var root=document.documentElement; root.className='gl';
  // ライブラリは body の末尾で取りに行く。届かない回線ではいつまでも始まらないので、待つのは4秒までにして一覧を見せる
  window.PORTAL_BOOT={started:false};
  setTimeout(function(){ if(!window.PORTAL_BOOT.started) root.className=''; },4000);
})();

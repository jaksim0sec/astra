(function(global){
"use strict";

const STYLE_ID="ovll-mascot-style";
const DEFAULT_COLOR="#4b94ff";

function installStyle(){
  if(document.getElementById(STYLE_ID)) return;

  const style=document.createElement("style");
  style.id=STYLE_ID;
  style.textContent=`
@property --react-color{
  syntax:"<color>";
  inherits:true;
  initial-value:#4b94ff;
}

.ovll-mascot{
  --size:2.25rem;
  --eye-w:.38rem;
  --eye-h:.39rem;
  --eye-sx:1;
  --eye-sy:1;
  --eye-tilt-l:0deg;
  --eye-tilt-r:0deg;
  --ex:0rem;
  --ey:0rem;
  --blink:1;
  --lean:0deg;
  --sx:1;
  --sy:1;
  --react-color:#4b94ff;

  position:absolute;
  z-index:1000;
  left:0;
  top:0;
  width:var(--size);
  aspect-ratio:1;
  overflow:hidden;

  display:flex;
  align-items:center;
  justify-content:center;
  gap:.34rem;

  padding:0;
  border:.0625rem solid rgba(0,0,0,.16);
  border-radius:42% 38% 44% 40% / 40% 44% 38% 42%;

  background:
    radial-gradient(
      circle at 24% 72%,
      color-mix(in srgb,var(--react-color) 34%,transparent),
      transparent 47%
    ),
    radial-gradient(
      circle at 80% 22%,
      rgba(66,126,255,.27),
      transparent 45%
    ),
    rgba(0,0,0,.31);

  box-shadow:
    -.1rem .08rem .72rem
      color-mix(in srgb,var(--react-color) 20%,transparent),
    .12rem -.08rem .7rem rgba(66,126,255,.14),
    0 .3rem 1rem rgba(0,0,0,.15);

  backdrop-filter:blur(1rem) saturate(1.08);
  -webkit-backdrop-filter:blur(1rem) saturate(1.08);

  transform:translate(-50%,-50%);
  rotate:var(--lean);
  scale:var(--sx) var(--sy);

  transition:
    rotate .22s cubic-bezier(.2,.82,.2,1),
    scale .22s cubic-bezier(.2,.82,.2,1),
    filter .18s ease,
    border-color .18s ease,
    --react-color .2s ease;

  animation:ovll-idle 4s ease-in-out infinite;

  cursor:grab;
  touch-action:none;
  user-select:none;
  -webkit-user-select:none;
}

.ovll-mascot::before{
  content:"";
  position:absolute;
  inset:0;
  border-radius:inherit;

  background:
    radial-gradient(
      circle at 30% 24%,
      var(--react-color),
      transparent 58%
    );

  opacity:.12;
  transition:opacity .18s ease;
  pointer-events:none;
}

.ovll-mascot-eye{
  position:relative;
  z-index:1;
  width:var(--eye-w);
  height:var(--eye-h);
  border-radius:99rem;
  background:rgba(0,0,0,.8);

  transform:
    translate(var(--ex),var(--ey))
    rotate(var(--eye-tilt,0deg))
    scale(
      var(--eye-sx),
      calc(var(--blink) * var(--eye-sy))
    );

  transition:
    transform .17s cubic-bezier(.2,.8,.2,1),
    width .18s cubic-bezier(.2,.8,.2,1),
    height .18s cubic-bezier(.2,.8,.2,1);

  pointer-events:none;
}

.ovll-mascot-eye:first-child{
  --eye-tilt:var(--eye-tilt-l);
}

.ovll-mascot-eye:last-child{
  --eye-tilt:var(--eye-tilt-r);
}

.ovll-mascot[data-mood="idle"]{
  --eye-sx:1;
  --eye-sy:1;
  --eye-tilt-l:0deg;
  --eye-tilt-r:0deg;
}

.ovll-mascot[data-mood="attention"]{
  --eye-sx:1.04;
  --eye-sy:.95;
  --eye-tilt-l:-1.5deg;
  --eye-tilt-r:1.5deg;
}

.ovll-mascot[data-mood="curious"]{
  --eye-sx:1.07;
  --eye-sy:1.05;
  --eye-tilt-l:2deg;
  --eye-tilt-r:-2deg;
}

.ovll-mascot[data-mood="happy"]{
  --eye-sx:1.08;
  --eye-sy:.84;
  --eye-tilt-l:-2.5deg;
  --eye-tilt-r:2.5deg;
}

.ovll-mascot[data-mood="working"]{
  --eye-sx:.96;
  --eye-sy:1.08;
  --eye-tilt-l:-1deg;
  --eye-tilt-r:1deg;
}

.ovll-mascot[data-mood="bumped"]{
  --eye-sx:1.1;
  --eye-sy:.77;
  --eye-tilt-l:3deg;
  --eye-tilt-r:-3deg;
}

:root.dark .ovll-mascot{
  border-color:rgba(255,255,255,.16);
  background:
    radial-gradient(
      circle at 24% 72%,
      color-mix(in srgb,var(--react-color) 30%,transparent),
      transparent 47%
    ),
    radial-gradient(
      circle at 80% 22%,
      rgba(66,126,255,.23),
      transparent 45%
    ),
    rgba(255,255,255,.31);

  box-shadow:
    -.1rem .08rem .72rem
      color-mix(in srgb,var(--react-color) 18%,transparent),
    .12rem -.08rem .7rem rgba(66,126,255,.12),
    0 .3rem 1rem rgba(0,0,0,.22);
}

:root.dark .ovll-mascot-eye{
  background:rgba(255,255,255,.8);
}

.ovll-mascot.moving{
  animation:none;
}

.ovll-mascot.pushed{
  animation:none;
}

.ovll-mascot.returning{
  animation:none;
}

.ovll-mascot.grabbed{
  animation:none;
  --sx:1.08;
  --sy:.92;
  cursor:grabbing;
}

.ovll-mascot.attention{
  filter:brightness(1.045);
}

.ovll-mascot.curious{
  animation:none;

  border-color:
    color-mix(
      in srgb,
      var(--react-color) 72%,
      transparent
    );

  filter:brightness(1.06);
}

.ovll-mascot.curious::before{
  opacity:.3;
}

.ovll-mascot.curious.close{
  --sx:1.045;
  --sy:.97;

  border-color:
    color-mix(
      in srgb,
      var(--react-color) 90%,
      transparent
    );
}

.ovll-mascot.curious.close::before{
  opacity:.42;
}

.ovll-mascot.working{
  animation:ovll-working 1.1s ease-in-out infinite;
}

.ovll-mascot.pop{
  animation:ovll-pop .3s cubic-bezier(.18,.88,.25,1.2);
}

.ovll-mascot.boop{
  animation:ovll-boop .34s cubic-bezier(.18,.88,.25,1.25);
}

.ovll-mascot.bump{
  animation:ovll-bump .24s cubic-bezier(.18,.9,.25,1);
}

@keyframes ovll-idle{
  0%,100%{translate:0 0}
  50%{translate:0 -.09rem}
}

@keyframes ovll-working{
  0%,100%{filter:brightness(1)}
  50%{filter:brightness(1.055)}
}

@keyframes ovll-pop{
  0%,100%{scale:var(--sx) var(--sy)}
  48%{scale:1.12 .88}
}

@keyframes ovll-boop{
  0%,100%{scale:var(--sx) var(--sy)}
  30%{scale:1.12 .88}
  58%{scale:.96 1.08}
}

@keyframes ovll-bump{
  0%,100%{scale:var(--sx) var(--sy)}
  45%{scale:1.06 .94}
}

@media(prefers-reduced-motion:reduce){
  .ovll-mascot{
    animation:none!important;
  }
}
`;

  document.head.appendChild(style);
}

function mount(world,canvas){
  installStyle();

  const viewport=canvas.root;
  const orb=document.createElement("button");

  orb.type="button";
  orb.className="ovll-mascot";
  orb.tabIndex=-1;
  orb.setAttribute("aria-label","OVLL");
  orb.innerHTML=
    '<span class="ovll-mascot-eye"></span>'+
    '<span class="ovll-mascot-eye"></span>';

  world.appendChild(orb);
  orb.dataset.mood="idle";

  let x=0;
  let y=0;

  let drag=null;
  let motion=null;
  let focusId=null;
  let attentionUntil=0;
  let connectionClose=false;
  let lastIntentMove=0;
  let moodTimer=null;
  let connectionColor=false;

  let blinkTimer=null;
  let viewportTimer=null;
  let motionFrame=null;
  let busyFrame=null;

  const cleanup=[];

  const center=rect=>({
    x:rect.left+rect.width/2,
    y:rect.top+rect.height/2
  });

  const nodeEl=id=>{
    if(id==null) return null;

    return[
      ...viewport.querySelectorAll(
        ".vc-node"
      )
    ].find(
      node=>
        node.dataset.nodeId===
        String(id)
    )||null;
  };

  function nodeColor(id){
    const node=nodeEl(id);

    return node
      ?getComputedStyle(node)
        .getPropertyValue("--node-color")
        .trim()||DEFAULT_COLOR
      :DEFAULT_COLOR;
  }

  function worldPoint(clientX,clientY){
    const rect=
      viewport.getBoundingClientRect();

    const raw=
      getComputedStyle(world).transform;

    const matrix=
      raw==="none"
        ?new DOMMatrix()
        :new DOMMatrix(raw);

    return new DOMPoint(
      clientX-rect.left,
      clientY-rect.top
    ).matrixTransform(
      matrix.inverse()
    );
  }

  function clientPoint(wx,wy){
    const rect=
      viewport.getBoundingClientRect();

    const raw=
      getComputedStyle(world).transform;

    const matrix=
      raw==="none"
        ?new DOMMatrix()
        :new DOMMatrix(raw);

    const point=
      new DOMPoint(
        wx,
        wy
      ).matrixTransform(matrix);

    return{
      x:rect.left+point.x,
      y:rect.top+point.y
    };
  }

  function render(){
    orb.style.left=x+"px";
    orb.style.top=y+"px";
  }

  function eyes(dx=0,dy=0){
    orb.style.setProperty(
      "--ex",
      `${dx}rem`
    );

    orb.style.setProperty(
      "--ey",
      `${dy}rem`
    );
  }

  function lookAt(clientX,clientY,amount=.065){
    const c=
      center(
        orb.getBoundingClientRect()
      );

    const dx=clientX-c.x;
    const dy=clientY-c.y;
    const d=
      Math.hypot(dx,dy)||1;

    eyes(
      dx/d*amount,
      dy/d*amount
    );
  }

  function blink(){
    orb.style.setProperty(
      "--blink",
      ".08"
    );

    setTimeout(
      ()=>orb.style.setProperty(
        "--blink",
        "1"
      ),
      90
    );
  }

  function pulse(name,duration){
    orb.classList.remove(name);
    void orb.offsetWidth;
    orb.classList.add(name);

    setTimeout(
      ()=>orb.classList.remove(name),
      duration
    );
  }

  function nodeVisible(node){
    const view=
      viewport.getBoundingClientRect();

    const rect=
      node.getBoundingClientRect();

    return(
      rect.right>view.left&&
      rect.left<view.right&&
      rect.bottom>view.top&&
      rect.top<view.bottom
    );
  }

  function restoreGaze(){
    const node=
      focusId&&
      performance.now()<attentionUntil
        ?nodeEl(focusId)
        :null;

    if(
      node&&
      nodeVisible(node)
    ){
      const c=
        center(
          node.getBoundingClientRect()
        );

      lookAt(
        c.x,
        c.y,
        .08
      );

      return;
    }

    eyes();
  }

  function stopMotion(){
    if(motionFrame!==null){
      cancelAnimationFrame(motionFrame);
      motionFrame=null;
    }

    motion=null;

    orb.classList.remove(
      "moving",
      "pushed",
      "returning"
    );

    orb.style.setProperty("--lean","0deg");
    orb.style.setProperty("--sx","1");
    orb.style.setProperty("--sy","1");

    restoreGaze();
  }

  /*
    한 번의 반응 = 한 번의 swoosh.
    거리는 항상 orb 크기에 비례한 고정값.
  */
  function swooshToward(
    clientX,
    clientY,
    {
      step=2.35,
      duration=320
    }={}
  ){
    if(drag)
      return false;

    const rect=orb.getBoundingClientRect();
    const current=center(rect);

    const dx=clientX-current.x;
    const dy=clientY-current.y;
    const distance=Math.hypot(dx,dy);

    if(distance<rect.width*.8)
      return false;

    if(motionFrame!==null)
      cancelAnimationFrame(motionFrame);

    const moveDistance=
      rect.width*step;

    const ux=dx/distance;
    const uy=dy/distance;

    const endClient={
      x:current.x+ux*moveDistance,
      y:current.y+uy*moveDistance
    };

    const endWorld=
      worldPoint(
        endClient.x,
        endClient.y
      );

    const startX=x;
    const startY=y;
    const deltaX=endWorld.x-startX;
    const deltaY=endWorld.y-startY;
    const started=performance.now();

    motion={
      x:endClient.x,
      y:endClient.y
    };

    orb.classList.add("moving");

    orb.style.setProperty(
      "--lean",
      `${Math.max(
        -5,
        Math.min(
          5,
          ux*4.5
        )
      )}deg`
    );

    orb.style.setProperty("--sx","1.025");
    orb.style.setProperty("--sy",".982");

    eyes(
      ux*.075,
      uy*.075
    );

    function frame(now){
      const t=Math.min(
        1,
        (now-started)/duration
      );

      /*
        빠르게 출발하고 짧게 정착.
        linear 느낌 없이 딱 "슥".
      */
      const eased=
        1-Math.pow(1-t,3);

      x=startX+deltaX*eased;
      y=startY+deltaY*eased;

      render();

      if(t<1){
        motionFrame=
          requestAnimationFrame(frame);

        return;
      }

      motionFrame=null;
      motion=null;

      orb.classList.remove("moving");

      orb.style.setProperty("--lean","0deg");
      orb.style.setProperty("--sx","1");
      orb.style.setProperty("--sy","1");

      restoreGaze();
    }

    motionFrame=
      requestAnimationFrame(frame);

    return true;
  }

  /*
    node 중심이 아니라 node 바깥의 가장 가까운 쪽을 향한다.
    그래서 node 위로 파고드는 이상한 이동 방지.
  */
  function nodeTarget(node){
    const nodeRect=node.getBoundingClientRect();
    const orbRect=orb.getBoundingClientRect();

    const current=center(orbRect);
    const nodeCenter=center(nodeRect);
    const gap=orbRect.width*.9;

    /*
      높이는 항상 node 중앙축.
      좌우 중 orb가 있는 쪽으로 docking.
    */
    return{
      x:
        current.x<nodeCenter.x
          ?nodeRect.left-gap
          :nodeRect.right+gap,
      y:nodeCenter.y
    };
  }

  function reactMoveToNode(id){
    const node=nodeEl(id);

    if(!node||!nodeVisible(node))
      return false;

    const orbRect=
      orb.getBoundingClientRect();

    const target=
      nodeTarget(node);

    const current=
      center(orbRect);

    const distance=
      Math.hypot(
        target.x-current.x,
        target.y-current.y
      );

    /*
      이미 충분히 가까우면 계산/이동 끝.
      시선 반응만 유지.
    */
    /*
      가까운 action은 눈으로만 반응.
      orb 지름 6.5개 이상 떨어진 경우에만 몸을 움직임.
    */
    if(distance<=orbRect.width*8)
      return false;

    /*
      input / expand 같은 연속 event가 들어와도
      매번 움직이지 않도록 제한.
    */
    const now=performance.now();

    if(
      motion||
      now-lastIntentMove<1400
    ){
      return false;
    }

    lastIntentMove=now;

    return swooshToward(
      target.x,
      target.y,
      {
        duration:320
      }
    );
  }

  function focusNode(
    id,
    {
      approach=false,
      pop=false
    }={}
  ){
    const node=nodeEl(id);

    if(!node)
      return;

    focusId=String(id);
    attentionUntil=performance.now()+850;

    orb.classList.add("attention");
    setMood("attention",850);

    if(nodeVisible(node)){
      const c=
        center(
          node.getBoundingClientRect()
        );

      lookAt(
        c.x,
        c.y,
        .08
      );

      if(approach)
        reactMoveToNode(id);
    }

    if(pop)
      pulse("pop",300);

    setTimeout(()=>{
      if(
        focusId===String(id)&&
        performance.now()>=attentionUntil&&
        !motion
      ){
        focusId=null;

        orb.classList.remove(
          "attention"
        );

        restoreGaze();
      }
    },870);
  }

  function overlaps(node){
    const a=
      orb.getBoundingClientRect();

    const b=
      node.getBoundingClientRect();

    return(
      a.right>b.left&&
      a.left<b.right&&
      a.bottom>b.top&&
      a.top<b.bottom
    );
  }

  function pushFromNode(node){
    if(
      !(node instanceof Element)||
      !overlaps(node)
    ){
      return false;
    }

    /*
      전부 screen 좌표 기준이라 Canvas zoom이 이미 반영됨.
      작은 화면에서는 viewport 크기 자체로 최대 이동량도 제한.
    */
    const orbRect=orb.getBoundingClientRect();
    const nodeRect=node.getBoundingClientRect();
    const view=viewport.getBoundingClientRect();

    const oc=center(orbRect);
    const nc=center(nodeRect);

    let dx=oc.x-nc.x;
    let dy=oc.y-nc.y;
    let distance=Math.hypot(dx,dy);

    if(distance<1){
      dx=1;
      dy=0;
      distance=1;
    }

    const ux=dx/distance;
    const uy=dy/distance;

    const margin=
      orbRect.width*.65+8;

    /*
      기본 push는 orb 2.6개 정도.
      단, 작은 viewport에서는 짧은 축의 16%를 넘지 않음.
    */
    const wanted=Math.min(
      orbRect.width*2.6,
      Math.min(
        view.width,
        view.height
      )*.16
    );

    /*
      이동 방향으로 실제 화면 안에 남아있는 거리 계산.
      edge를 뚫고 날아가는 걸 여기서 차단.
    */
    const roomX=
      ux>0
        ?view.right-margin-oc.x
        :ux<0
          ?oc.x-(view.left+margin)
          :Infinity;

    const roomY=
      uy>0
        ?view.bottom-margin-oc.y
        :uy<0
          ?oc.y-(view.top+margin)
          :Infinity;

    const maxX=
      Math.abs(ux)>.001
        ?Math.max(0,roomX/Math.abs(ux))
        :Infinity;

    const maxY=
      Math.abs(uy)>.001
        ?Math.max(0,roomY/Math.abs(uy))
        :Infinity;

    const travel=Math.max(
      0,
      Math.min(
        wanted,
        maxX,
        maxY
      )
    );

    if(travel<2)
      return false;

    /*
      swooshToward 자체 step 제한보다
      우리가 계산한 target까지 정확히 갈 수 있게 step 산출.
    */
    swooshToward(
      oc.x+ux*travel,
      oc.y+uy*travel,
      {
        step:travel/orbRect.width,
        duration:300
      }
    );

    setMood("bumped",360);
    pulse("bump",220);
    blink();

    return true;
  }

  function ensureVisible(){
    const view=
      viewport.getBoundingClientRect();

    const rect=
      orb.getBoundingClientRect();

    const c=center(rect);
    const margin=
      rect.width/2+14;

    const sx=Math.max(
      view.left+margin,
      Math.min(
        view.right-margin,
        c.x
      )
    );

    const sy=Math.max(
      view.top+margin,
      Math.min(
        view.bottom-margin,
        c.y
      )
    );

    if(
      Math.abs(sx-c.x)<1&&
      Math.abs(sy-c.y)<1
    ){
      return;
    }

    swooshToward(
      sx,
      sy,
      {
        step:4,
        duration:380
      }
    );
  }

  function scheduleVisible(){
    clearTimeout(
      viewportTimer
    );

    viewportTimer=
      setTimeout(
        ensureVisible,
        180
      );
  }

  const MOODS={
    idle:"#378cff",
    attention:"#4aa8ff",
    curious:"#39c6e8",
    happy:"#6878ff",
    working:"#7665e8",
    bumped:"#44b6d9"
  };

  function setMood(name,duration=0){
    clearTimeout(moodTimer);

    const mood=MOODS[name]
      ?name
      :"idle";

    orb.dataset.mood=mood;

    if(!connectionColor){
      orb.style.setProperty(
        "--react-color",
        MOODS[mood]
      );
    }

    if(duration){
      moodTimer=setTimeout(()=>{
        orb.dataset.mood="idle";

        if(!connectionColor){
          orb.style.setProperty(
            "--react-color",
            MOODS.idle
          );
        }
      },duration);
    }
  }

  function setReactColor(id){
    connectionColor=true;

    orb.style.setProperty(
      "--react-color",
      nodeColor(id)
    );
  }

  function resetReactColor(){
    connectionColor=false;

    orb.style.setProperty(
      "--react-color",
      MOODS[orb.dataset.mood]||
      MOODS.idle
    );
  }

  function connectionMove(data){
    const c=
      center(
        orb.getBoundingClientRect()
      );

    const distance=
      Math.hypot(
        data.x-c.x,
        data.y-c.y
      );

    if(distance>145){
      connectionEnd(false,false);
      return;
    }

    orb.classList.add(
      "curious"
    );

    setMood("curious");

    lookAt(
      data.x,
      data.y,
      distance<62
        ?.1
        :.08
    );

    connectionClose=
      distance<62;

    orb.classList.toggle(
      "close",
      connectionClose
    );
  }

  function connectionEnd(
    boop,
    reset=true
  ){
    connectionClose=false;

    orb.classList.remove(
      "curious",
      "close"
    );

    setMood(
      boop
        ?"happy"
        :"idle",
      boop
        ?480
        :0
    );

    if(boop){
      pulse(
        "boop",
        360
      );

      blink();
    }

    restoreGaze();

    if(reset){
      setTimeout(
        resetReactColor,
        boop
          ?360
          :160
      );
    }
  }

  function pointerDown(event){
    if(
      event.button!==undefined&&
      event.button!==0
    ){
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    stopMotion();

    const point=
      worldPoint(
        event.clientX,
        event.clientY
      );

    drag={
      id:event.pointerId,
      dx:x-point.x,
      dy:y-point.y
    };

    orb.classList.add(
      "grabbed"
    );

    try{
      orb.setPointerCapture(
        event.pointerId
      );
    }catch{}
  }

  function pointerMove(event){
    if(
      !drag||
      drag.id!==event.pointerId
    ){
      return;
    }

    const point=
      worldPoint(
        event.clientX,
        event.clientY
      );

    x=point.x+drag.dx;
    y=point.y+drag.dy;

    render();
  }

  function pointerUp(event){
    if(
      !drag||
      drag.id!==event.pointerId
    ){
      return;
    }

    drag=null;

    orb.classList.remove(
      "grabbed"
    );

    try{
      orb.releasePointerCapture(
        event.pointerId
      );
    }catch{}

    scheduleVisible();
  }

  function listen(
    node,
    type,
    handler,
    options
  ){
    node.addEventListener(
      type,
      handler,
      options
    );

    cleanup.push(
      ()=>node.removeEventListener(
        type,
        handler,
        options
      )
    );
  }

  function bind(name,handler){
    const off=
      canvas.on(
        name,
        handler
      );

    if(typeof off==="function")
      cleanup.push(off);
  }

  listen(
    orb,
    "pointerdown",
    pointerDown
  );

  listen(
    orb,
    "pointermove",
    pointerMove
  );

  listen(
    orb,
    "pointerup",
    pointerUp
  );

  listen(
    orb,
    "pointercancel",
    pointerUp
  );

  listen(
    viewport,
    "pointermove",
    event=>{
      if(
        drag||
        connectionClose||
        motion||
        performance.now()<
          attentionUntil
      ){
        return;
      }

      lookAt(
        event.clientX,
        event.clientY,
        .055
      );
    },
    {passive:true}
  );

  bind(
    "select",
    id=>{
      if(id)
        focusNode(id);
    }
  );

  bind(
    "nodeAdd",
    node=>
      requestAnimationFrame(
        ()=>{
          setMood("happy",620);

          focusNode(
            node.id,
            {
              approach:true,
              pop:true
            }
          );
        }
      )
  );

  bind(
    "nodeEdit",
    event=>
      focusNode(
        event.id
      )
  );

  bind(
    "nodeExpand",
    event=>{
      focusNode(
        event.id
      );

      const node=
        nodeEl(event.id);

      if(node)
        pushFromNode(node);
    }
  );

  bind(
    "nodeDragStart",
    event=>{
      stopMotion();

      focusNode(
        event.id
      );
    }
  );

  bind(
    "nodeDragMove",
    event=>{
      const node=
        nodeEl(event.id);

      if(!node)
        return;

      const c=
        center(
          node.getBoundingClientRect()
        );

      lookAt(
        c.x,
        c.y,
        .075
      );

      pushFromNode(node);
    }
  );

  bind(
    "nodeDragEnd",
    event=>{
      focusNode(
        event.id
      );

      scheduleVisible();
    }
  );

  bind(
    "nodeRemove",
    node=>{
      if(
        focusId===
        String(node.id)
      ){
        focusId=null;
      }

      pulse(
        "pop",
        260
      );
    }
  );

  bind(
    "connectionDragStart",
    event=>{
      setReactColor(
        event.anchor?.node
      );

      connectionClose=false;
    }
  );

  bind(
    "connectionDragMove",
    connectionMove
  );

  bind(
    "connectionDragEnd",
    event=>
      connectionEnd(
        !event.connected&&
        !event.cancelled&&
        connectionClose
      )
  );

  bind(
    "connect",
    connection=>
      focusNode(
        connection.to.node,
        {
          pop:true
        }
      )
  );

  bind(
    "viewport",
    ()=>{
      scheduleVisible();
    }
  );

  bind(
    "workflowApplied",
    ()=>{
      scheduleVisible();
    }
  );

  function scheduleBlink(){
    clearTimeout(
      blinkTimer
    );

    blinkTimer=
      setTimeout(()=>{
        if(
          !drag&&
          !connectionClose
        ){
          blink();
        }

        scheduleBlink();
      },2600+Math.random()*3600);
  }

  scheduleBlink();

  let wasBusy=false;

  function watchBusy(){
    const busy=
      !!global.AstraApp?.isBusy?.();

    if(busy!==wasBusy){
      wasBusy=busy;

      orb.classList.toggle(
        "working",
        busy
      );

      setMood(
        busy
          ?"working"
          :"idle"
      );
    }

    busyFrame=
      requestAnimationFrame(
        watchBusy
      );
  }

  watchBusy();

  const view=
    viewport.getBoundingClientRect();

  const initial=
    worldPoint(
      view.left+view.width*.72,
      view.top+view.height*.65
    );

  x=initial.x;
  y=initial.y;
  render();

  requestAnimationFrame(
    scheduleVisible
  );

  return{
    element:orb,

    destroy(){
      stopMotion();

      cancelAnimationFrame(
        motionFrame
      );

      cancelAnimationFrame(
        busyFrame
      );

      clearTimeout(
        blinkTimer
      );

      clearTimeout(
        viewportTimer
      );

      clearTimeout(
        moodTimer
      );

      cleanup
        .splice(0)
        .forEach(fn=>{
          try{
            fn();
          }catch{}
        });

      orb.remove();
    }
  };
}

function init(){
  const viewport=
    document.querySelector(
      "#canvas-viewport"
    );

  const world=
    document.querySelector(
      "#canvas-world"
    );

  if(
    !viewport||
    !world||
    global.ovllCanvasMascot
  ){
    return;
  }

  let tries=0;

  function wait(){
    const canvas=
      global.getMountedCanvasNode?.(
        viewport
      );

    if(!canvas){
      if(tries++<360)
        requestAnimationFrame(wait);

      return;
    }

    const mascot=
      global.ovllCanvasMascot=
        mount(
          world,
          canvas
        );

    const sync=()=>{
      mascot.element.hidden=
        global.AstraUI?.getMode?.()!=="canvas";
    };

    global.AstraUI?.on?.(
      "modechange",
      sync
    );

    sync();
  }

  wait();
}

if(
  document.readyState==="loading"
){
  document.addEventListener(
    "DOMContentLoaded",
    init,
    {once:true}
  );
}else{
  init();
}

})(window);

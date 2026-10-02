(function(global){
"use strict";

const STYLE_ID="ovll-mascot-style";
const DEFAULT_COLOR="#4b94ff";

function installStyle(){
  if(document.getElementById(STYLE_ID)) return;

  const style=document.createElement("style");
  style.id=STYLE_ID;
  style.textContent=`
.ovll-mascot{
  --agent-color:#4b94ff;
  --react-color:var(--agent-color);
  --agent-size:2.25rem;

  --body-color:#000;
  --eye-color:#fff;

  --eye-w:.42rem;
  --eye-h:.46rem;

  --ex:0rem;
  --ey:0rem;
  --gaze-sx:1;
  --gaze-sy:1;
  --eye-tilt:0deg;

  --blink:1;
  --lean:0deg;
  --sx:1;
  --sy:1;

  position:absolute;
  z-index:1000;
  left:0;
  top:0;

  width:var(--agent-size);
  aspect-ratio:1;

  display:flex;
  align-items:center;
  justify-content:center;

  padding:0;
  overflow:hidden;

  border:0;
  border-radius:50%;

  background:var(--body-color);

  box-shadow:
    0 .22rem .65rem rgba(0,0,0,.18);

  transform:translate(-50%,-50%);
  rotate:var(--lean);
  scale:var(--sx) var(--sy);

  transition:
    rotate .3s cubic-bezier(.16,.84,.22,1),
    scale .28s cubic-bezier(.16,.84,.22,1),
    background .2s ease,
    box-shadow .2s ease,
    filter .18s ease;

  animation:ovll-idle 6.5s ease-in-out infinite;

  cursor:grab;
  touch-action:none;
  user-select:none;
  -webkit-user-select:none;
}

.ovll-mascot-eye{
  position:relative;
  z-index:1;

  width:var(--eye-w);
  height:var(--eye-h);

  border-radius:999rem;
  background:var(--eye-color);

  transform:
    translate(var(--ex),var(--ey))
    rotate(var(--eye-tilt))
    scale(
      var(--gaze-sx),
      calc(var(--blink) * var(--gaze-sy))
    );

  transition:
    transform .24s cubic-bezier(.16,.84,.22,1),
    width .24s cubic-bezier(.16,.84,.22,1),
    height .24s cubic-bezier(.16,.84,.22,1),
    border-radius .24s cubic-bezier(.16,.84,.22,1),
    background .2s ease;

  pointer-events:none;
}

.ovll-mascot[data-mood="idle"]{
  --eye-w:.42rem;
  --eye-h:.46rem;
}

.ovll-mascot[data-mood="focus"],
.ovll-mascot[data-mood="attention"]{
  --eye-w:.43rem;
  --eye-h:.48rem;
}

.ovll-mascot[data-mood="curious"]{
  --eye-w:.47rem;
  --eye-h:.47rem;
}

.ovll-mascot[data-mood="surprised"]{
  --eye-w:.54rem;
  --eye-h:.54rem;
}

.ovll-mascot[data-mood="annoyed"]{
  --eye-w:.55rem;
  --eye-h:.12rem;
}

.ovll-mascot[data-mood="success"]{
  --eye-w:.48rem;
  --eye-h:.34rem;
}

.ovll-mascot[data-mood="working"]{
  --eye-w:.36rem;
  --eye-h:.51rem;
}

.ovll-mascot[data-mood="bumped"]{
  --eye-w:.5rem;
  --eye-h:.18rem;
}

:root.dark .ovll-mascot{
  --body-color:#fff;
  --eye-color:#000;

  box-shadow:
    0 .22rem .72rem rgba(0,0,0,.3);
}

.ovll-mascot.connecting{
  background:
    radial-gradient(
      circle at 27% 74%,
      color-mix(
        in srgb,
        var(--react-color) 78%,
        transparent
      ),
      transparent 60%
    ),
    radial-gradient(
      circle at 78% 20%,
      color-mix(
        in srgb,
        var(--react-color) 34%,
        transparent
      ),
      transparent 52%
    ),
    var(--body-color);

  box-shadow:
    0 .22rem .7rem rgba(0,0,0,.2),
    0 0 .75rem
      color-mix(
        in srgb,
        var(--react-color) 25%,
        transparent
      );
}

.ovll-mascot.moving,
.ovll-mascot.pushed,
.ovll-mascot.returning,
.ovll-mascot.curious{
  animation:none;
}

.ovll-mascot.grabbed{
  animation:none;
  --sx:1.07;
  --sy:.93;
  cursor:grabbing;
}

.ovll-mascot.working{
  animation:ovll-working 1.25s ease-in-out infinite;
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
  50%{translate:0 -.03rem}
}

@keyframes ovll-working{
  0%,100%{filter:brightness(1)}
  50%{filter:brightness(.86)}
}

@keyframes ovll-pop{
  0%,100%{scale:var(--sx) var(--sy)}
  48%{scale:1.1 .9}
}

@keyframes ovll-boop{
  0%,100%{scale:var(--sx) var(--sy)}
  30%{scale:1.1 .9}
  58%{scale:.97 1.05}
}

@keyframes ovll-bump{
  0%,100%{scale:var(--sx) var(--sy)}
  45%{scale:1.05 .95}
}

@media(prefers-reduced-motion:reduce){
  .ovll-mascot{
    animation:none!important;
  }
}
`;

  document.head.appendChild(style);
}

function mount(world,canvas,options={}){
  installStyle();

  const viewport=canvas.root;
  const orb=document.createElement("button");

  orb.type="button";
  orb.className="ovll-mascot";
  orb.tabIndex=-1;
  orb.setAttribute("aria-label","OVLL");
  orb.innerHTML=
    '<span class="ovll-mascot-eye"></span>';

  world.appendChild(orb);
  orb.dataset.mood="idle";

  const agentColor=
    options.color||
    DEFAULT_COLOR;

  orb.style.setProperty(
    "--agent-color",
    agentColor
  );

  orb.style.setProperty(
    "--react-color",
    agentColor
  );

  if(options.size){
    orb.style.setProperty(
      "--agent-size",
      String(options.size)
    );
  }

  let x=0;
  let y=0;

  let drag=null;
  let motion=null;
  let focusId=null;
  let attentionUntil=0;
  let connectionClose=false;
  let lastIntentMove=0;
  let lastWorkflowId=null;
  let gazePriority=0;
  let gazeUntil=0;
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
    const max=.17;

    const nx=Math.max(
      -1,
      Math.min(
        1,
        dx/max
      )
    );

    const ny=Math.max(
      -1,
      Math.min(
        1,
        dy/max
      )
    );

    orb.style.setProperty(
      "--ex",
      `${dx}rem`
    );

    orb.style.setProperty(
      "--ey",
      `${dy}rem`
    );

    orb.style.setProperty(
      "--gaze-sx",
      String(
        1-Math.abs(nx)*.34
      )
    );

    orb.style.setProperty(
      "--gaze-sy",
      String(
        1-Math.abs(ny)*.12
      )
    );

    orb.style.setProperty(
      "--eye-tilt",
      `${nx*ny*-9}deg`
    );
  }

  function lookAt(clientX,clientY,amount=.15){
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
      dy/d*amount*.82
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
    const now=performance.now();

    const active=
      focusId&&
      now<attentionUntil
        ?nodeEl(focusId)
        :null;

    if(
      active&&
      nodeVisible(active)
    ){
      const c=
        center(
          active.getBoundingClientRect()
        );

      lookAt(
        c.x,
        c.y,
        .17
      );

      return;
    }

    const recent=
      lastWorkflowId
        ?nodeEl(lastWorkflowId)
        :null;

    if(
      recent&&
      nodeVisible(recent)
    ){
      const c=
        center(
          recent.getBoundingClientRect()
        );

      lookAt(
        c.x,
        c.y,
        .105
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
    이동은 직선이 아니라 quadratic bezier.
    경로 근처 node가 있으면 반대쪽으로 control point를 밀어
    자연스럽게 피해 간다.
  */
  function swooshToward(
    clientX,
    clientY,
    {
      step=2.35,
      duration=380
    }={}
  ){
    if(drag)
      return false;

    const rect=
      orb.getBoundingClientRect();

    const current=
      center(rect);

    const dx=
      clientX-current.x;

    const dy=
      clientY-current.y;

    const distance=
      Math.hypot(dx,dy);

    if(distance<rect.width*.8)
      return false;

    if(motionFrame!==null)
      cancelAnimationFrame(motionFrame);

    const moveDistance=
      Math.min(
        distance,
        rect.width*step
      );

    const ux=dx/distance;
    const uy=dy/distance;

    const endClient={
      x:current.x+ux*moveDistance,
      y:current.y+uy*moveDistance
    };

    const lineX=
      endClient.x-current.x;

    const lineY=
      endClient.y-current.y;

    const lineLength=
      Math.hypot(lineX,lineY)||1;

    const normal={
      x:-lineY/lineLength,
      y:lineX/lineLength
    };

    let bend=
      Math.min(
        rect.width*.72,
        lineLength*.14
      );

    let bendSign=
      lineX>=0
        ?-1
        :1;

    let closest=
      Infinity;

    viewport
      .querySelectorAll(".vc-node")
      .forEach(node=>{
        if(!nodeVisible(node))
          return;

        const r=
          node.getBoundingClientRect();

        const nc=
          center(r);

        const projection=
          Math.max(
            0,
            Math.min(
              1,
              (
                (nc.x-current.x)*lineX+
                (nc.y-current.y)*lineY
              )/
              (lineLength*lineLength)
            )
          );

        if(
          projection<.08||
          projection>.92
        ){
          return;
        }

        const px=
          current.x+
          lineX*projection;

        const py=
          current.y+
          lineY*projection;

        const signed=
          (nc.x-px)*normal.x+
          (nc.y-py)*normal.y;

        const clearance=
          Math.abs(signed)-
          Math.max(
            r.width,
            r.height
          )*.56-
          rect.width*.78;

        if(clearance<closest){
          closest=clearance;

          if(clearance<0){
            bendSign=
              signed>=0
                ?-1
                :1;

            bend=Math.max(
              bend,
              Math.min(
                lineLength*.42,
                Math.abs(signed)+
                Math.max(
                  r.width,
                  r.height
                )*.62+
                rect.width*1.15
              )
            );
          }
        }
      });

    const controlClient={
      x:
        (current.x+endClient.x)/2+
        normal.x*bend*bendSign,
      y:
        (current.y+endClient.y)/2+
        normal.y*bend*bendSign
    };

    const startWorld={
      x,
      y
    };

    const controlWorld=
      worldPoint(
        controlClient.x,
        controlClient.y
      );

    const endWorld=
      worldPoint(
        endClient.x,
        endClient.y
      );

    const started=
      performance.now();

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

    orb.style.setProperty("--sx","1.018");
    orb.style.setProperty("--sy",".986");

    eyes(
      ux*.15,
      uy*.12
    );

    function frame(now){
      const t=Math.min(
        1,
        (now-started)/duration
      );

      const eased=
        t<.5
          ?4*t*t*t
          :1-Math.pow(-2*t+2,3)/2;

      const omt=
        1-eased;

      x=
        omt*omt*startWorld.x+
        2*omt*eased*controlWorld.x+
        eased*eased*endWorld.x;

      y=
        omt*omt*startWorld.y+
        2*omt*eased*controlWorld.y+
        eased*eased*endWorld.y;

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
      pop=false,
      mood="focus",
      duration=1050,
      priority=3
    }={}
  ){
    const node=nodeEl(id);

    if(!node)
      return;

    const now=
      performance.now();

    if(
      now<gazeUntil&&
      priority<gazePriority
    ){
      return;
    }

    focusId=String(id);
    lastWorkflowId=String(id);

    gazePriority=priority;
    gazeUntil=now+duration;
    attentionUntil=gazeUntil;

    orb.classList.add("attention");

    setMood(
      mood,
      duration
    );

    if(nodeVisible(node)){
      const c=
        center(
          node.getBoundingClientRect()
        );

      lookAt(
        c.x,
        c.y,
        mood==="surprised"
          ?.18
          :.16
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
        gazePriority=0;

        orb.classList.remove(
          "attention"
        );

        restoreGaze();
      }
    },duration+30);
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

  const MOODS=
    new Set([
      "idle",
      "focus",
      "attention",
      "curious",
      "surprised",
      "annoyed",
      "success",
      "working",
      "bumped"
    ]);

  function setMood(name,duration=0){
    clearTimeout(moodTimer);

    const mood=
      MOODS.has(name)
        ?name
        :"idle";

    orb.dataset.mood=mood;

    if(duration){
      moodTimer=setTimeout(()=>{
        orb.dataset.mood="idle";
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
      agentColor
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
      "curious",
      "connecting"
    );

    gazePriority=9;
    gazeUntil=performance.now()+260;

    setMood("curious");

    lookAt(
      data.x,
      data.y,
      distance<62
        ?.2
        :.16
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
      "close",
      "connecting"
    );

    gazePriority=0;
    gazeUntil=0;

    setMood(
      boop
        ?"success"
        :"idle",
      boop
        ?520
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


  bind(
    "select",
    id=>{
      if(id){
        focusNode(
          id,
          {
            priority:1,
            duration:700
          }
        );
      }
    }
  );

  bind(
    "nodeAdd",
    node=>
      requestAnimationFrame(
        ()=>{
          focusNode(
            node.id,
            {
              approach:true,
              pop:true,
              mood:"surprised",
              duration:1250,
              priority:6
            }
          );
        }
      )
  );

  bind(
    "nodeEdit",
    event=>
      focusNode(
        event.id,
        {
          mood:"focus",
          duration:1250,
          priority:5
        }
      )
  );

  bind(
    "nodeExpand",
    event=>{
      focusNode(
        event.id,
        {
          mood:"focus",
          duration:900,
          priority:4
        }
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
        event.id,
        {
          mood:"focus",
          duration:1200,
          priority:7
        }
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

      lastWorkflowId=
        String(event.id);

      gazePriority=8;
      gazeUntil=
        performance.now()+260;

      lookAt(
        c.x,
        c.y,
        .17
      );

      pushFromNode(node);
    }
  );

  bind(
    "nodeDragEnd",
    event=>{
      focusNode(
        event.id,
        {
          mood:"focus",
          duration:850,
          priority:6
        }
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

      setMood(
        "annoyed",
        720
      );

      gazePriority=5;
      gazeUntil=
        performance.now()+720;

      eyes(
        0,
        -.07
      );

      pulse(
        "bump",
        240
      );

      setTimeout(
        restoreGaze,
        740
      );
    }
  );

  bind(
    "connectionDragStart",
    event=>{
      setReactColor(
        event.anchor?.node
      );

      orb.classList.add(
        "connecting"
      );

      const anchorId=
        event.anchor?.node;

      if(anchorId!=null){
        focusNode(
          anchorId,
          {
            mood:"focus",
            duration:1300,
            priority:8
          }
        );
      }

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
          pop:true,
          mood:"surprised",
          duration:950,
          priority:9
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

      if(!busy){
        restoreGaze();
      }
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

    global.createOvllCanvasMascot=
      options=>
        mount(
          world,
          canvas,
          options||{}
        );

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

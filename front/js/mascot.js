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
  --size:2.6rem;
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
  gap:.42rem;

  padding:0;
  border:.0625rem solid rgba(0,0,0,.16);
  border-radius:50%;

  background:rgba(0,0,0,.31);

  box-shadow:
    inset 0 .05rem .22rem rgba(255,255,255,.05),
    0 .3rem 1rem rgba(0,0,0,.12);

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

  width:.28rem;
  height:.68rem;
  border-radius:99rem;

  background:rgba(0,0,0,.8);

  transform:
    translate(var(--ex),var(--ey))
    scaleY(var(--blink));

  transition:
    transform .15s cubic-bezier(.2,.8,.2,1),
    width .16s ease,
    height .16s ease;

  pointer-events:none;
}

:root.dark .ovll-mascot{
  border-color:rgba(255,255,255,.16);
  background:rgba(255,255,255,.31);

  box-shadow:
    inset 0 .05rem .22rem rgba(255,255,255,.06),
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

  let x=0;
  let y=0;
  let vx=0;
  let vy=0;

  let drag=null;
  let motion=null;
  let focusId=null;
  let attentionUntil=0;

  let connectionClose=false;
  let path=[];
  let pathIndex=0;
  let lastPathUpdate=0;

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

  function setMotion(next){
    motion=next;
    path=[];
    pathIndex=0;
    lastPathUpdate=0;

    orb.classList.remove(
      "moving",
      "pushed",
      "returning"
    );

    if(next?.type)
      orb.classList.add(next.type);

    if(
      next&&
      motionFrame===null
    ){
      motionFrame=
        requestAnimationFrame(
          stepMotion
        );
    }
  }

  function stopMotion(){
    motion=null;
    path=[];
    pathIndex=0;

    orb.classList.remove(
      "moving",
      "pushed",
      "returning"
    );

    orb.style.setProperty(
      "--lean",
      "0deg"
    );

    orb.style.setProperty(
      "--sx",
      "1"
    );

    orb.style.setProperty(
      "--sy",
      "1"
    );

    restoreGaze();
  }

  function pointBlocked(clientX,clientY,target=null){
    const view=
      viewport.getBoundingClientRect();

    const radius=
      orb.getBoundingClientRect()
        .width/2;

    const edge=
      radius+10;

    if(
      clientX<view.left+edge||
      clientX>view.right-edge||
      clientY<view.top+edge||
      clientY>view.bottom-edge
    ){
      return true;
    }

    for(
      const node of
      viewport.querySelectorAll(
        ".vc-node"
      )
    ){
      const rect=
        node.getBoundingClientRect();

      const padding=
        node===target
          ?radius+7
          :radius+12;

      if(
        clientX>rect.left-padding&&
        clientX<rect.right+padding&&
        clientY>rect.top-padding&&
        clientY<rect.bottom+padding
      ){
        return true;
      }
    }

    return false;
  }

  function dockPoints(node){
    const rect=
      node.getBoundingClientRect();

    const view=
      viewport.getBoundingClientRect();

    const radius=
      orb.getBoundingClientRect()
        .width/2;

    const gap=
      radius+15;

    return[
      {
        x:rect.right+gap,
        y:rect.top+rect.height/2
      },
      {
        x:rect.left-gap,
        y:rect.top+rect.height/2
      },
      {
        x:rect.left+rect.width/2,
        y:rect.bottom+gap
      },
      {
        x:rect.left+rect.width/2,
        y:rect.top-gap
      }
    ].filter(point=>
      point.x>view.left+radius+8&&
      point.x<view.right-radius-8&&
      point.y>view.top+radius+8&&
      point.y<view.bottom-radius-8&&
      !pointBlocked(
        point.x,
        point.y,
        node
      )
    );
  }

  function findPath(start,goal,target){
    const view=
      viewport.getBoundingClientRect();

    const cell=30;

    const cols=
      Math.max(
        1,
        Math.floor(
          view.width/cell
        )
      );

    const rows=
      Math.max(
        1,
        Math.floor(
          view.height/cell
        )
      );

    const toGrid=p=>({
      x:Math.max(
        0,
        Math.min(
          cols-1,
          Math.round(
            (p.x-view.left)/cell
          )
        )
      ),
      y:Math.max(
        0,
        Math.min(
          rows-1,
          Math.round(
            (p.y-view.top)/cell
          )
        )
      )
    });

    const toClient=p=>({
      x:view.left+p.x*cell,
      y:view.top+p.y*cell
    });

    const key=p=>
      `${p.x},${p.y}`;

    const first=
      toGrid(start);

    const last=
      toGrid(goal);

    const open=[
      {
        ...first,
        g:0,
        f:0
      }
    ];

    const came=
      new Map();

    const cost=
      new Map([
        [
          key(first),
          0
        ]
      ]);

    const dirs=[
      [1,0],[-1,0],
      [0,1],[0,-1],
      [1,1],[1,-1],
      [-1,1],[-1,-1]
    ];

    while(open.length){
      open.sort(
        (a,b)=>a.f-b.f
      );

      const current=
        open.shift();

      if(
        current.x===last.x&&
        current.y===last.y
      ){
        const result=[];
        let cursor={
          x:current.x,
          y:current.y
        };

        while(
          key(cursor)!==
          key(first)
        ){
          result.push(
            toClient(cursor)
          );

          cursor=
            came.get(
              key(cursor)
            );

          if(!cursor)
            break;
        }

        result.reverse();
        result.push(goal);

        return result;
      }

      for(const [dx,dy] of dirs){
        const next={
          x:current.x+dx,
          y:current.y+dy
        };

        if(
          next.x<0||
          next.y<0||
          next.x>=cols||
          next.y>=rows
        ){
          continue;
        }

        const point=
          toClient(next);

        const isGoal=
          next.x===last.x&&
          next.y===last.y;

        if(
          !isGoal&&
          pointBlocked(
            point.x,
            point.y,
            target
          )
        ){
          continue;
        }

        const nextCost=
          current.g+
          (
            dx&&dy
              ?1.414
              :1
          );

        const k=
          key(next);

        if(
          cost.has(k)&&
          cost.get(k)<=nextCost
        ){
          continue;
        }

        cost.set(
          k,
          nextCost
        );

        came.set(
          k,
          {
            x:current.x,
            y:current.y
          }
        );

        open.push({
          ...next,
          g:nextCost,
          f:
            nextCost+
            Math.hypot(
              last.x-next.x,
              last.y-next.y
            )
        });
      }
    }

    return null;
  }

  function bestPath(node){
    const start=
      center(
        orb.getBoundingClientRect()
      );

    let best=null;

    for(const goal of dockPoints(node)){
      const candidate=
        findPath(
          start,
          goal,
          node
        );

      if(!candidate)
        continue;

      let length=0;
      let previous=start;

      for(const point of candidate){
        length+=
          Math.hypot(
            point.x-previous.x,
            point.y-previous.y
          );

        previous=point;
      }

      if(
        !best||
        length<best.length
      ){
        best={
          path:candidate,
          length
        };
      }
    }

    return best?.path||null;
  }

  function updateNodePath(now){
    const node=
      nodeEl(
        motion?.nodeId
      );

    if(!node){
      stopMotion();
      return false;
    }

    /*
      이동 중에도 live DOM rect 기준으로
      expand / collapse / 위치 변경을 반영한다.
    */
    if(
      !path.length||
      now-lastPathUpdate>110
    ){
      const next=
        bestPath(node);

      if(next?.length){
        path=next;
        pathIndex=0;
      }

      lastPathUpdate=now;
    }

    return true;
  }

  function currentTarget(now){
    if(!motion)
      return null;

    if(motion.kind==="node"){
      if(!updateNodePath(now))
        return null;

      while(
        pathIndex<path.length-1
      ){
        const c=
          center(
            orb.getBoundingClientRect()
          );

        if(
          Math.hypot(
            path[pathIndex].x-c.x,
            path[pathIndex].y-c.y
          )>22
        ){
          break;
        }

        pathIndex++;
      }

      return path[pathIndex]||null;
    }

    if(motion.kind==="point"){
      return motion.client;
    }

    return null;
  }

  function stepMotion(now){
    motionFrame=null;

    if(
      !motion||
      drag
    ){
      return;
    }

    const target=
      currentTarget(now);

    if(!target){
      stopMotion();
      return;
    }

    const current=
      clientPoint(
        x,
        y
      );

    const dx=
      target.x-current.x;

    const dy=
      target.y-current.y;

    const distance=
      Math.hypot(dx,dy);

    const finalTarget=
      motion.kind==="point"||
      pathIndex>=path.length-1;

    if(
      finalTarget&&
      distance<2&&
      Math.hypot(vx,vy)<.08
    ){
      stopMotion();
      return;
    }

    const ux=
      distance
        ?dx/distance
        :0;

    const uy=
      distance
        ?dy/distance
        :0;

    const config=
      motion.type==="pushed"
        ?{
            max:3.6,
            accel:.17,
            brake:48
          }
        :motion.type==="returning"
          ?{
              max:1.875,
              accel:.055,
              brake:70
            }
          :{
              max:3,
              accel:.085,
              brake:58
            };

    const desired=
      Math.min(
        config.max,
        Math.max(
          .12,
          distance/config.brake*
          config.max
        )
      );

    vx+=
      (
        ux*desired-vx
      )*
      config.accel;

    vy+=
      (
        uy*desired-vy
      )*
      config.accel;

    const damping=
      distance<20
        ?.84
        :.965;

    vx*=damping;
    vy*=damping;

    /*
      client velocity를 world velocity로 변환.
      Canvas zoom 상태에서도 체감 속도 일정.
    */
    const here=
      worldPoint(
        current.x,
        current.y
      );

    const next=
      worldPoint(
        current.x+vx,
        current.y+vy
      );

    x+=next.x-here.x;
    y+=next.y-here.y;

    render();

    const speed=
      Math.hypot(vx,vy);

    if(speed>.02){
      const intensity=
        Math.min(
          1,
          speed/config.max
        );

      orb.style.setProperty(
        "--lean",
        `${vx/config.max*5}deg`
      );

      orb.style.setProperty(
        "--sx",
        String(
          1+intensity*.025
        )
      );

      orb.style.setProperty(
        "--sy",
        String(
          1-intensity*.018
        )
      );

      eyes(
        vx/speed*.07,
        vy/speed*.07
      );
    }

    motionFrame=
      requestAnimationFrame(
        stepMotion
      );
  }

  function moveToNode(id){
    const node=
      nodeEl(id);

    if(!node)
      return;

    setMotion({
      kind:"node",
      nodeId:String(id),
      type:"moving"
    });
  }

  function moveToClient(
    client,
    type="pushed"
  ){
    setMotion({
      kind:"point",
      client,
      type
    });
  }

  function focusNode(
    id,
    {
      approach=false,
      pop=false
    }={}
  ){
    const node=
      nodeEl(id);

    if(!node)
      return;

    focusId=
      String(id);

    attentionUntil=
      performance.now()+1100;

    orb.classList.add(
      "attention"
    );

    if(nodeVisible(node)){
      const nc=
        center(
          node.getBoundingClientRect()
        );

      const oc=
        center(
          orb.getBoundingClientRect()
        );

      const distance=
        Math.hypot(
          nc.x-oc.x,
          nc.y-oc.y
        );

      lookAt(
        nc.x,
        nc.y,
        .08
      );

      const view=
        viewport.getBoundingClientRect();

      const closeDistance=
        Math.min(
          view.width,
          view.height
        )*.45;

      if(
        approach&&
        distance>closeDistance
      ){
        moveToNode(id);
      }
    }

    if(pop)
      pulse("pop",320);

    setTimeout(()=>{
      if(
        focusId===String(id)&&
        performance.now()>=
          attentionUntil&&
        !motion
      ){
        focusId=null;

        orb.classList.remove(
          "attention"
        );

        restoreGaze();
      }
    },1120);
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

    const a=
      orb.getBoundingClientRect();

    const b=
      node.getBoundingClientRect();

    const ac=center(a);
    const bc=center(b);

    let dx=ac.x-bc.x;
    let dy=ac.y-bc.y;
    let distance=
      Math.hypot(dx,dy);

    if(distance<1){
      dx=1;
      dy=0;
      distance=1;
    }

    dx/=distance;
    dy/=distance;

    const overlapX=
      Math.min(a.right,b.right)-
      Math.max(a.left,b.left);

    const overlapY=
      Math.min(a.bottom,b.bottom)-
      Math.max(a.top,b.top);

    const push=
      Math.max(
        34,
        Math.min(
          112,
          Math.max(
            overlapX,
            overlapY
          )+
          a.width*.9
        )
      );

    moveToClient(
      {
        x:ac.x+dx*push,
        y:ac.y+dy*push
      },
      "pushed"
    );

    pulse(
      "bump",
      240
    );

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

    const sx=
      Math.max(
        view.left+margin,
        Math.min(
          view.right-margin,
          c.x
        )
      );

    const sy=
      Math.max(
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

    moveToClient(
      {
        x:sx,
        y:sy
      },
      "returning"
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

  function setReactColor(id){
    orb.style.setProperty(
      "--react-color",
      nodeColor(id)
    );
  }

  function resetReactColor(){
    orb.style.setProperty(
      "--react-color",
      DEFAULT_COLOR
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
      if(id){
        focusNode(
          id,
          {approach:true}
        );
      }
    }
  );

  bind(
    "nodeAdd",
    node=>
      requestAnimationFrame(
        ()=>focusNode(
          node.id,
          {
            approach:true,
            pop:true
          }
        )
      )
  );

  bind(
    "nodeEdit",
    event=>
      focusNode(
        event.id,
        {approach:true}
      )
  );

  bind(
    "nodeExpand",
    event=>{
      /*
        이동 중이어도 node DOM을 매 프레임
        다시 읽기 때문에 별도 route reset 불필요.
      */
      focusNode(
        event.id,
        {approach:true}
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
        event.id,
        {approach:true}
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

      if(
        motion?.nodeId===
        String(node.id)
      ){
        stopMotion();
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
        {pop:true}
      )
  );

  bind(
    "viewport",
    ()=>{
      if(
        motion?.kind==="node"
      ){
        /*
          viewport 이동 후에도 다음 frame에서
          현재 실제 rect로 route 재계산.
        */
        lastPathUpdate=0;
      }

      scheduleVisible();
    }
  );

  bind(
    "workflowApplied",
    ()=>{
      lastPathUpdate=0;
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

  function watchBusy(){
    orb.classList.toggle(
      "working",
      !!global.AstraApp?.isBusy?.()
    );

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

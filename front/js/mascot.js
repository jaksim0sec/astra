(function(global){
"use strict";

const STYLE_ID="ovll-mascot-style";
let nextId=0;

function installStyle(){
  if(document.getElementById(STYLE_ID)) return;

  const style=document.createElement("style");
  style.id=STYLE_ID;
  style.textContent=`
.ovll-mascot{
  --ovll-size:2.6rem;
  --ovll-eye-x:0rem;
  --ovll-eye-y:0rem;
  --ovll-blink:1;
  --ovll-lean-x:0deg;
  --ovll-lean-y:0rem;
  --ovll-squash-x:1;
  --ovll-squash-y:1;
  position:absolute;z-index:1000;left:0;top:0;
  width:var(--ovll-size);aspect-ratio:1;
  display:flex;align-items:center;justify-content:center;gap:.42rem;padding:0;
  border:.09375rem solid var(--line-strong);border-radius:50%;
  background:color-mix(in srgb,var(--panel-strong) 32%,var(--text) 68%);
  color:var(--text);box-shadow:var(--shadow-soft);
  backdrop-filter:blur(1.15rem) saturate(1.08);
  -webkit-backdrop-filter:blur(1.15rem) saturate(1.08);
  transform:
    translate(-50%,-50%)
    translateY(var(--ovll-lean-y))
    rotate(var(--ovll-lean-x))
    scale(var(--ovll-squash-x),var(--ovll-squash-y));
  transform-origin:50% 60%;
  cursor:grab;touch-action:none;user-select:none;-webkit-user-select:none;
  animation:ovll-float 4s ease-in-out infinite;
  transition:background .2s ease,border-color .2s ease,filter .2s ease;
}
.ovll-mascot-eye{
  width:.28rem;height:.68rem;border-radius:99rem;background:var(--bg);
  transform:translate(var(--ovll-eye-x),var(--ovll-eye-y)) scaleY(var(--ovll-blink));
  transition:transform .08s ease;pointer-events:none;
}
:root.dark .ovll-mascot{
  background:color-mix(in srgb,var(--panel-strong) 24%,var(--text) 76%);
}
:root.dark .ovll-mascot-eye{background:var(--text)}
.ovll-mascot.is-near{border-color:color-mix(in srgb,var(--line-strong) 35%,var(--text) 65%)}
.ovll-mascot.is-moving{
  animation:none;
  filter:brightness(1.035);
}
.ovll-mascot.is-avoiding{
  animation:none;
  filter:brightness(1.08);
}
.ovll-mascot.is-connection-curious{
  animation:none;
  border-color:color-mix(in srgb,var(--line-strong) 25%,var(--text) 75%);
  filter:brightness(1.08);
  --ovll-squash-x:1.07;
  --ovll-squash-y:.94;
}
.ovll-mascot.is-connection-close{
  --ovll-squash-x:1.13;
  --ovll-squash-y:.88;
  filter:brightness(1.13);
}
.ovll-mascot.is-connection-close .ovll-mascot-eye{
  --ovll-blink:.78;
}
.ovll-mascot.is-grabbed{cursor:grabbing;animation:none;transform:translate(-50%,-50%) scale(1.08,.92)}
.ovll-mascot.is-grabbed .ovll-mascot-eye{--ovll-blink:.58}
.ovll-mascot[data-state="thinking"]{animation:ovll-thinking 1.8s ease-in-out infinite}
.ovll-mascot[data-state="working"]{animation:ovll-working 1.1s ease-in-out infinite}
.ovll-mascot[data-state="sleeping"] .ovll-mascot-eye{--ovll-blink:.12}
.ovll-mascot.is-pop{animation:ovll-pop .38s cubic-bezier(.2,.9,.3,1.3)}
.ovll-mascot.is-startled{animation:ovll-startled .34s cubic-bezier(.2,.9,.3,1.2)}
@keyframes ovll-float{
  0%,100%{transform:translate(-50%,-50%) translateY(0)}
  50%{transform:translate(-50%,-50%) translateY(-.12rem)}
}
@keyframes ovll-thinking{
  0%,100%{transform:translate(-50%,-50%) rotate(-2deg)}
  50%{transform:translate(-50%,-50%) rotate(2deg) translateY(-.08rem)}
}
@keyframes ovll-working{
  0%,100%{transform:translate(-50%,-50%) scale(1)}
  50%{transform:translate(-50%,-50%) scale(1.045)}
}
@keyframes ovll-pop{
  0%{transform:translate(-50%,-50%) scale(1)}
  45%{transform:translate(-50%,-50%) scale(1.18,.82)}
  75%{transform:translate(-50%,-50%) scale(.94,1.08)}
  100%{transform:translate(-50%,-50%) scale(1)}
}
@keyframes ovll-startled{
  0%{transform:translate(-50%,-50%) scale(1)}
  35%{transform:translate(-50%,-50%) scale(.86,1.18)}
  100%{transform:translate(-50%,-50%) scale(1)}
}
@media(prefers-reduced-motion:reduce){.ovll-mascot{animation:none!important}}
`;

  document.head.appendChild(style);
}

function mount(target,options={}){
  if(typeof target==="string") target=document.querySelector(target);
  if(!(target instanceof Element))
    throw new TypeError("OvllMascot target must be an Element or selector");

  installStyle();

  const config={
    size:"2.6rem",
    watchBusy:true,
    behavior:{
      wander:false,
      avoidNodes:true,
      lookAtPointer:true,
      blink:true,
      startle:true,
      ...(options.behavior||{})
    },
    ...options
  };

  const element=document.createElement("button");
  element.type="button";
  element.className="ovll-mascot";
  element.dataset.ovllMascot=String(++nextId);
  element.dataset.state="idle";
  element.setAttribute("aria-label",config.label||"OVLL");
  element.tabIndex=config.tabIndex??-1;
  element.innerHTML='<span class="ovll-mascot-eye"></span><span class="ovll-mascot-eye"></span>';
  element.style.setProperty("--ovll-size",config.size);
  target.appendChild(element);

  const viewport=target.closest("#canvas-viewport")||target.parentElement;
  const events=new Map();

  let x=Number(config.x)||300;
  let y=Number(config.y)||240;
  let state="idle";
  let pointerId=null;
  let dragOffsetX=0;
  let dragOffsetY=0;
  let moved=false;
  let destroyed=false;
  let busyFrame=null;
  let blinkTimer=null;
  let idleTimer=null;
  let wanderTimer=null;
  let startleTimer=null;
  let wanderFrame=null;
  let lastUserMove=0;
  let lastPointer=null;
  let lastPointerTime=0;

  let motionFrame=null;
  let motionTarget=null;
  let velocityX=0;
  let velocityY=0;
  let facingX=0;
  let facingY=0;
  let motionPhase="idle";
  let motionStarted=0;
  let interestElement=null;
  let draggedNode=null;
  let collisionFrame=null;
  let connectionPointer=null;
  let connectionCurious=false;
  let connectionClose=false;
  let interestTimer=null;

  function on(name,handler){
    if(typeof handler!=="function") return ()=>{};
    if(!events.has(name)) events.set(name,new Set());
    events.get(name).add(handler);
    return ()=>off(name,handler);
  }

  function off(name,handler){
    events.get(name)?.delete(handler);
  }

  function emit(name,payload={}){
    for(const handler of events.get(name)||[]){
      try{handler(payload,api)}
      catch(error){console.error(error)}
    }
  }

  function render(){
    element.style.left=x+"px";
    element.style.top=y+"px";
  }

  function getWorldPoint(clientX,clientY){
    if(target.id==="canvas-world"&&viewport){
      const transform=getComputedStyle(target).transform;
      const matrix=transform==="none"?new DOMMatrix():new DOMMatrix(transform);
      const rect=viewport.getBoundingClientRect();
      return new DOMPoint(clientX-rect.left,clientY-rect.top).matrixTransform(matrix.inverse());
    }

    const rect=target.getBoundingClientRect();
    return {x:clientX-rect.left,y:clientY-rect.top};
  }

  function setEyes(dx=0,dy=0){
    element.style.setProperty("--ovll-eye-x",`${dx}rem`);
    element.style.setProperty("--ovll-eye-y",`${dy}rem`);
  }

  function lookAt(clientX,clientY){
    const rect=element.getBoundingClientRect();
    const dx=clientX-(rect.left+rect.width/2);
    const dy=clientY-(rect.top+rect.height/2);
    const distance=Math.hypot(dx,dy)||1;
    const amount=Math.min(.11,distance/1100);

    setEyes(
      dx/distance*amount,
      dy/distance*amount
    );

    element.classList.toggle("is-near",distance<95);
    return api;
  }

  function blink(){
    if(!config.behavior.blink||state==="sleeping") return api;

    element.style.setProperty("--ovll-blink",".08");

    setTimeout(()=>{
      if(!destroyed&&state!=="sleeping")
        element.style.setProperty("--ovll-blink","1");
    },105);

    emit("blink");
    return api;
  }

  function scheduleBlink(){
    clearTimeout(blinkTimer);
    if(!config.behavior.blink) return;

    blinkTimer=setTimeout(()=>{
      if(pointerId===null) blink();
      scheduleBlink();
    },2400+Math.random()*4000);
  }

  function idleLook(){
    clearTimeout(idleTimer);

    idleTimer=setTimeout(()=>{
      if(pointerId===null&&state==="idle"){
        const angle=Math.random()*Math.PI*2;
        const amount=.03+Math.random()*.06;

        setEyes(
          Math.cos(angle)*amount,
          Math.sin(angle)*amount
        );

        setTimeout(()=>{
          if(!destroyed&&pointerId===null)
            setEyes();
        },500+Math.random()*800);
      }

      idleLook();
    },1800+Math.random()*2800);
  }

  function pop(){
    element.classList.remove("is-pop");
    void element.offsetWidth;
    element.classList.add("is-pop");
    emit("react",{type:"pop"});
    return api;
  }

  function startle(){
    if(!config.behavior.startle||pointerId!==null) return api;

    element.classList.remove("is-startled");
    void element.offsetWidth;
    element.classList.add("is-startled");

    clearTimeout(startleTimer);
    startleTimer=setTimeout(()=>{
      element.classList.remove("is-startled");
    },360);

    emit("react",{type:"startled"});
    return api;
  }

  function setState(next){
    const allowed=["idle","thinking","working","sleeping"];
    next=allowed.includes(next)?next:"idle";

    if(state===next) return api;

    const previous=state;
    state=next;
    element.dataset.state=state;

    if(state==="sleeping"){
      element.style.setProperty("--ovll-blink",".12");
      setEyes();
    }else{
      element.style.setProperty("--ovll-blink","1");
    }

    emit("statechange",{state,previous});
    return api;
  }

  function react(type,data={}){
    switch(type){
      case "click":
      case "success":
        pop();
        break;
      case "startled":
      case "error":
        startle();
        break;
      case "thinking":
        setState("thinking");
        break;
      case "working":
        setState("working");
        break;
      case "sleep":
        setState("sleeping");
        break;
      case "wake":
      case "idle":
        setState("idle");
        break;
      case "node-created":
        if(data.element instanceof Element){
          focusElement(data.element,{
            approach:true,
            reason:"node-created"
          });
          pop();
        }
        break;

      case "node-selected":
        if(data.element instanceof Element)
          focusElement(data.element,{
            approach:false,
            reason:"node-selected"
          });
        break;

      case "node-edited":
        if(data.element instanceof Element)
          focusElement(data.element,{
            approach:true,
            reason:"node-edited"
          });
        break;

      case "node-moved":
        if(data.element instanceof Element)
          focusElement(data.element,{
            approach:false,
            reason:"node-moved"
          });
        break;
    }

    emit("reaction",{type,data});
    return api;
  }

  function move(nx,ny,source="api"){
    x=Number(nx)||0;
    y=Number(ny)||0;

    if(source==="user")
      lastUserMove=performance.now();

    render();
    emit("move",{x,y,source});
    return api;
  }

  function setBodyMotion(vx=0,vy=0,intensity=0){
    const speed=Math.hypot(vx,vy);
    const nx=speed?vx/speed:0;
    const ny=speed?vy/speed:0;

    facingX+=(nx-facingX)*.1;
    facingY+=(ny-facingY)*.1;

    element.style.setProperty(
      "--ovll-lean-x",
      `${facingX*intensity*7}deg`
    );

    element.style.setProperty(
      "--ovll-lean-y",
      `${facingY*intensity*.08}rem`
    );

    element.style.setProperty(
      "--ovll-squash-x",
      String(1+Math.abs(facingY)*intensity*.035)
    );

    element.style.setProperty(
      "--ovll-squash-y",
      String(1-Math.abs(facingY)*intensity*.025)
    );
  }

  function settleBody(){
    facingX*=.82;
    facingY*=.82;

    setBodyMotion(facingX,facingY,.25);

    if(Math.hypot(facingX,facingY)>.03)
      requestAnimationFrame(settleBody);
    else{
      element.style.setProperty("--ovll-lean-x","0deg");
      element.style.setProperty("--ovll-lean-y","0rem");
      element.style.setProperty("--ovll-squash-x","1");
      element.style.setProperty("--ovll-squash-y","1");
    }
  }

  function stopMotion(){
    motionTarget=null;
    motionPhase="idle";

    velocityX*=.45;
    velocityY*=.45;

    element.classList.remove("is-moving","is-avoiding");
    settleBody();

    return api;
  }

  function moveToward(tx,ty,reason="interest",force=false){
    if(!Number.isFinite(tx)||!Number.isFinite(ty)) return api;

    const dx=tx-x;
    const dy=ty-y;
    const distance=Math.hypot(dx,dy);

    if(distance<2) return api;

    const maxTravel=force?260:180;

    if(distance>maxTravel){
      tx=x+dx/distance*maxTravel;
      ty=y+dy/distance*maxTravel;
    }

    motionTarget={x:tx,y:ty,reason};
    motionPhase="orient";
    motionStarted=performance.now();

    element.classList.add("is-moving");

    /*
      먼저 목적지를 바라본다.
      위치가 움직이기 전에 의도가 보이게 함.
    */
    const direction=Math.hypot(tx-x,ty-y)||1;

    setEyes(
      (tx-x)/direction*.09,
      (ty-y)/direction*.09
    );

    setBodyMotion(
      (tx-x)/direction,
      (ty-y)/direction,
      .55
    );

    if(motionFrame===null)
      motionFrame=requestAnimationFrame(motionStep);

    emit("intent",{x:tx,y:ty,reason});

    return api;
  }

  function motionStep(now){
    motionFrame=null;

    if(destroyed||pointerId!==null||!motionTarget)
      return;

    const dx=motionTarget.x-x;
    const dy=motionTarget.y-y;
    const distance=Math.hypot(dx,dy);

    /*
      ORIENT
      약 140ms 동안 먼저 방향을 잡는다.
    */
    if(motionPhase==="orient"){
      if(now-motionStarted<140){
        motionFrame=requestAnimationFrame(motionStep);
        return;
      }

      motionPhase="thrust";
    }

    if(distance<1.2&&Math.hypot(velocityX,velocityY)<.18){
      const reason=motionTarget.reason;

      x=motionTarget.x;
      y=motionTarget.y;

      velocityX=0;
      velocityY=0;
      motionTarget=null;
      motionPhase="idle";

      render();

      element.classList.remove("is-moving","is-avoiding");
      settleBody();

      emit("arrive",{x,y,reason});
      return;
    }

    const nx=distance?dx/distance:0;
    const ny=distance?dy/distance:0;

    /*
      멀 때는 추진.
      가까워질수록 추진력을 줄이고 brake.
    */
    const desiredSpeed=Math.min(
      3.4,
      Math.max(.35,distance*.035)
    );

    const desiredX=nx*desiredSpeed;
    const desiredY=ny*desiredSpeed;

    const steering=distance<35?.055:.035;

    velocityX+=(desiredX-velocityX)*steering;
    velocityY+=(desiredY-velocityY)*steering;

    /*
      도착 직전에는 damping 증가.
    */
    const damping=
      distance<18?.82:
      distance<45?.91:
      .975;

    velocityX*=damping;
    velocityY*=damping;

    x+=velocityX;
    y+=velocityY;

    render();

    const speed=Math.hypot(velocityX,velocityY);

    setBodyMotion(
      velocityX,
      velocityY,
      Math.min(1,speed/3)
    );

    /*
      이동할 땐 cursor가 아니라
      자신의 진행 방향을 본다.
    */
    if(speed>.08){
      setEyes(
        velocityX/speed*.075,
        velocityY/speed*.075
      );
    }

    motionFrame=requestAnimationFrame(motionStep);
  }

  function connectionDistance(clientX,clientY){
    const rect=element.getBoundingClientRect();

    return Math.hypot(
      clientX-(rect.left+rect.width/2),
      clientY-(rect.top+rect.height/2)
    );
  }

  function connectionCuriosity(clientX,clientY){
    if(pointerId!==null) return;

    const distance=connectionDistance(clientX,clientY);

    /*
      선이 어느 정도 가까워졌을 때만 반응.
      Canvas 반대편에서부터 쳐다보지 않음.
    */
    if(distance>150){
      if(connectionCurious)
        endConnectionCuriosity();

      return;
    }

    connectionCurious=true;

    element.classList.add(
      "is-connection-curious"
    );

    lookAt(clientX,clientY);

    /*
      "어? 나?" 느낌.
      선 끝이 가까워질수록 살짝 앞으로 기울고 커짐.
    */
    const closeness=1-Math.min(1,distance/150);

    element.style.setProperty(
      "--ovll-lean-y",
      `${-.025-closeness*.055}rem`
    );

    const close=distance<58;

    if(close!==connectionClose){
      connectionClose=close;

      element.classList.toggle(
        "is-connection-close",
        close
      );

      if(close){
        blink();

        emit("reaction",{
          type:"connection-curious"
        });
      }
    }
  }

  function endConnectionCuriosity(){
    if(!connectionCurious) return;

    connectionCurious=false;
    connectionClose=false;

    element.classList.remove(
      "is-connection-curious",
      "is-connection-close"
    );

    setEyes();

    element.style.setProperty(
      "--ovll-lean-y",
      "0rem"
    );

    element.style.setProperty(
      "--ovll-squash-x",
      "1"
    );

    element.style.setProperty(
      "--ovll-squash-y",
      "1"
    );
  }

  function escapeFromNode(node){
    if(!(node instanceof Element)||!viewport) return;

    const orbRect=element.getBoundingClientRect();
    const nodeRect=node.getBoundingClientRect();

    const overlapX=Math.min(orbRect.right,nodeRect.right)-
      Math.max(orbRect.left,nodeRect.left);

    const overlapY=Math.min(orbRect.bottom,nodeRect.bottom)-
      Math.max(orbRect.top,nodeRect.top);

    if(overlapX<=0||overlapY<=0) return;

    const orbCX=orbRect.left+orbRect.width/2;
    const orbCY=orbRect.top+orbRect.height/2;
    const nodeCX=nodeRect.left+nodeRect.width/2;
    const nodeCY=nodeRect.top+nodeRect.height/2;

    let pushX=orbCX-nodeCX;
    let pushY=orbCY-nodeCY;

    const length=Math.hypot(pushX,pushY)||1;

    pushX/=length;
    pushY/=length;

    /*
      충돌 깊이에 비례해서 도망감.
      random 방향 없음.
    */
    const pushDistance=
      Math.max(overlapX,overlapY)+
      orbRect.width*.8;

    const targetClientX=orbCX+pushX*pushDistance;
    const targetClientY=orbCY+pushY*pushDistance;

    const point=getWorldPoint(
      targetClientX,
      targetClientY
    );

    element.classList.add("is-avoiding");

    moveToward(
      point.x,
      point.y,
      "node-collision",
      true
    );

    emit("avoid",{element:node});
  }

  function safePositionNear(elementTarget){
    if(!(elementTarget instanceof Element)||!viewport) return null;

    const nodeRect=elementTarget.getBoundingClientRect();
    const viewRect=viewport.getBoundingClientRect();
    const mascotSize=element.getBoundingClientRect().width;

    const gap=Math.max(8,mascotSize*.28);

    const candidates=[
      {
        x:nodeRect.right+gap+mascotSize/2,
        y:nodeRect.top+nodeRect.height*.5
      },
      {
        x:nodeRect.left-gap-mascotSize/2,
        y:nodeRect.top+nodeRect.height*.5
      },
      {
        x:nodeRect.left+nodeRect.width*.5,
        y:nodeRect.bottom+gap+mascotSize/2
      },
      {
        x:nodeRect.left+nodeRect.width*.5,
        y:nodeRect.top-gap-mascotSize/2
      }
    ];

    const valid=candidates.filter(point=>
      point.x>viewRect.left+mascotSize&&
      point.x<viewRect.right-mascotSize&&
      point.y>viewRect.top+mascotSize&&
      point.y<viewRect.bottom-mascotSize&&
      !nodeCollision(point.x,point.y,4)
    );

    if(!valid.length) return null;

    /*
      현재 위치에서 가장 가까운 안전 지점을 고름.
      랜덤 없음.
    */
    const mascotRect=element.getBoundingClientRect();
    const cx=mascotRect.left+mascotRect.width/2;
    const cy=mascotRect.top+mascotRect.height/2;

    valid.sort((a,b)=>
      Math.hypot(a.x-cx,a.y-cy)-
      Math.hypot(b.x-cx,b.y-cy)
    );

    return getWorldPoint(valid[0].x,valid[0].y);
  }

  function focusElement(targetElement,{approach=false,reason="interest"}={}){
    if(!(targetElement instanceof Element)) return api;

    interestElement=targetElement;

    const rect=targetElement.getBoundingClientRect();

    lookAt(
      rect.left+rect.width/2,
      rect.top+rect.height/2
    );

    clearTimeout(interestTimer);

    if(approach){
      const point=safePositionNear(targetElement);

      if(point){
        const mascotRect=element.getBoundingClientRect();
        const distance=Math.hypot(
          rect.left+rect.width/2-
            (mascotRect.left+mascotRect.width/2),
          rect.top+rect.height/2-
            (mascotRect.top+mascotRect.height/2)
        );

        /*
          이미 가까우면 괜히 움직이지 않음.
        */
        /*
          가까운 interaction에만 몸을 움직임.
          멀리 있는 작업까지 화면을 횡단하지 않음.
        */
        if(distance>75&&distance<320)
          moveToward(point.x,point.y,reason);
      }
    }

    interestTimer=setTimeout(()=>{
      if(interestElement===targetElement){
        interestElement=null;

        if(!motionTarget)
          setEyes();
      }
    },2600);

    emit("focus",{element:targetElement,reason});
    return api;
  }

  function nodeCollision(clientX,clientY,padding=48){
    if(!config.behavior.avoidNodes||!viewport) return false;

    for(const node of viewport.querySelectorAll(".vc-node")){
      const rect=node.getBoundingClientRect();

      if(
        clientX>rect.left-padding&&
        clientX<rect.right+padding&&
        clientY>rect.top-padding&&
        clientY<rect.bottom+padding
      ) return true;
    }

    return false;
  }

  function findSafePoint(){
    if(!viewport) return null;

    const rect=viewport.getBoundingClientRect();
    const margin=Math.max(50,element.getBoundingClientRect().width*1.5);

    for(let i=0;i<20;i++){
      const cx=rect.left+margin+Math.random()*Math.max(1,rect.width-margin*2);
      const cy=rect.top+margin+Math.random()*Math.max(1,rect.height-margin*2);

      if(!nodeCollision(cx,cy))
        return getWorldPoint(cx,cy);
    }

    return null;
  }

  function wander(){
    if(
      !config.behavior.wander||
      destroyed||
      pointerId!==null||
      state!=="idle"||
      performance.now()-lastUserMove<5000||
      global.AstraUI?.getMode?.()!=="canvas"
    ) return api;

    const point=findSafePoint();
    if(!point) return api;

    const fromX=x;
    const fromY=y;
    const distance=Math.hypot(point.x-x,point.y-y);

    if(distance<25) return api;

    const duration=Math.min(4500,Math.max(2000,distance*7));
    const started=performance.now();

    cancelAnimationFrame(wanderFrame);

    function step(now){
      if(
        destroyed||
        pointerId!==null||
        state!=="idle"||
        performance.now()-lastUserMove<5000
      ) return;

      const t=Math.min(1,(now-started)/duration);
      const eased=t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;

      x=fromX+(point.x-fromX)*eased;
      y=fromY+(point.y-fromY)*eased;
      render();

      if(t<1){
        wanderFrame=requestAnimationFrame(step);
      }else{
        emit("wander",{x,y});
      }
    }

    wanderFrame=requestAnimationFrame(step);
    return api;
  }

  function scheduleWander(){
    clearTimeout(wanderTimer);
    if(!config.behavior.wander) return;

    wanderTimer=setTimeout(()=>{
      wander();
      scheduleWander();
    },5000+Math.random()*4500);
  }

  function reactToPointer(clientX,clientY){
    if(!config.behavior.startle) return;

    const now=performance.now();

    if(lastPointer){
      const dt=Math.max(1,now-lastPointerTime);
      const speed=Math.hypot(
        clientX-lastPointer.x,
        clientY-lastPointer.y
      )/dt;

      const rect=element.getBoundingClientRect();
      const distance=Math.hypot(
        clientX-(rect.left+rect.width/2),
        clientY-(rect.top+rect.height/2)
      );

      if(speed>1.7&&distance<110)
        startle();
    }

    lastPointer={x:clientX,y:clientY};
    lastPointerTime=now;
  }

  function pointerDown(event){
    if(event.button!==undefined&&event.button!==0) return;

    event.preventDefault();
    event.stopPropagation();

    const point=getWorldPoint(event.clientX,event.clientY);

    pointerId=event.pointerId;
    dragOffsetX=x-point.x;
    dragOffsetY=y-point.y;
    moved=false;
    lastUserMove=performance.now();

    cancelAnimationFrame(wanderFrame);
    cancelAnimationFrame(motionFrame);
    motionFrame=null;
    motionTarget=null;
    velocityX=0;
    velocityY=0;

    element.classList.add("is-grabbed");

    try{element.setPointerCapture(pointerId)}catch{}

    emit("grab",{x,y});
  }

  function pointerMove(event){
    if(config.behavior.lookAtPointer)
      lookAt(event.clientX,event.clientY);

    reactToPointer(event.clientX,event.clientY);

    if(pointerId!==event.pointerId) return;

    event.preventDefault();
    event.stopPropagation();

    const point=getWorldPoint(event.clientX,event.clientY);
    const nx=point.x+dragOffsetX;
    const ny=point.y+dragOffsetY;

    if(Math.hypot(nx-x,ny-y)>.5)
      moved=true;

    x=nx;
    y=ny;
    render();
  }

  function pointerUp(event){
    if(pointerId!==event.pointerId) return;

    event.preventDefault();
    event.stopPropagation();

    try{element.releasePointerCapture(pointerId)}catch{}

    pointerId=null;
    lastUserMove=performance.now();
    element.classList.remove("is-grabbed");

    emit("release",{x,y,moved});

    if(!moved){
      react("click");
      config.onClick?.(api,event);
    }
  }

  function setBusy(value){
    return setState(value?"working":"idle");
  }

  function watchBusy(){
    if(destroyed) return;
    setBusy(!!global.AstraApp?.isBusy?.());
    busyFrame=requestAnimationFrame(watchBusy);
  }

  function destroy(){
    if(destroyed) return;

    destroyed=true;
    cancelAnimationFrame(busyFrame);
    cancelAnimationFrame(wanderFrame);
    cancelAnimationFrame(motionFrame);
    cancelAnimationFrame(collisionFrame);
    clearTimeout(interestTimer);
    clearTimeout(blinkTimer);
    clearTimeout(idleTimer);
    clearTimeout(wanderTimer);
    clearTimeout(startleTimer);
    events.clear();
    element.remove();
  }

  const api={
    element,
    target,
    on,
    off,
    move,
    lookAt,
    blink,
    pop,
    react,
    wander,
    moveToward,
    stopMotion,
    focusElement,
    escapeFromNode,
    connectionCuriosity,
    endConnectionCuriosity,
    setBusy,
    setState,
    destroy,

    getState(){
      return state;
    },

    getPosition(){
      return {x,y};
    },

    setSize(size){
      element.style.setProperty("--ovll-size",size);
      return api;
    },

    setBehavior(name,value){
      if(name in config.behavior)
        config.behavior[name]=!!value;
      return api;
    }
  };

  element.addEventListener("pointerdown",pointerDown);
  element.addEventListener("pointermove",pointerMove);
  element.addEventListener("pointerup",pointerUp);
  element.addEventListener("pointercancel",pointerUp);

  if(viewport){
    viewport.addEventListener("pointermove",event=>{
      if(pointerId!==null) return;

      reactToPointer(event.clientX,event.clientY);

      if(config.behavior.lookAtPointer)
        lookAt(event.clientX,event.clientY);
    },{passive:true});

    viewport.addEventListener("pointerleave",()=>{
      if(pointerId!==null) return;
      setEyes();
      element.classList.remove("is-near");
    });
  }

  element.addEventListener("dblclick",event=>{
    event.preventDefault();
    event.stopPropagation();
    wander();
  });

  element.addEventListener("animationend",event=>{
    if(event.animationName==="ovll-pop")
      element.classList.remove("is-pop");
  });

  render();
  scheduleBlink();
  idleLook();
  if(config.watchBusy)
    watchBusy();

  emit("ready");

  return api;
}

global.OvllMascot=Object.freeze({mount});

function mountCanvasMascot(){
  const world=document.querySelector("#canvas-world");
  const viewport=document.querySelector("#canvas-viewport");

  if(!world||!viewport||global.ovllCanvasMascot) return;

  const mascot=mount(world,{
    size:"2.6rem",
    watchBusy:true,
    behavior:{
      wander:false,
      avoidNodes:true,
      lookAtPointer:true,
      blink:true,
      startle:true
    }
  });

  global.ovllCanvasMascot=mascot;

  requestAnimationFrame(()=>{
    const rect=viewport.getBoundingClientRect();
    const transform=getComputedStyle(world).transform;
    const matrix=transform==="none"?new DOMMatrix():new DOMMatrix(transform);

    const point=new DOMPoint(
      rect.width*.72,
      rect.height*.65
    ).matrixTransform(matrix.inverse());

    mascot.move(point.x,point.y);
  });

  const syncVisibility=()=>{
    mascot.element.hidden=
      global.AstraUI?.getMode?.()!=="canvas";
  };

  global.AstraUI?.on?.("modechange",syncVisibility);
  syncVisibility();

  const nodes=document.querySelector("#canvas-nodes");

  if(nodes){

    /*
      Connection gesture observer.

      실제 connection engine은 canvasNode.js가 그대로 담당.
      mascot은 gesture를 보기만 함.
    */
    viewport.addEventListener("pointerdown",event=>{
      const port=event.target.closest(".vc-port-hit");
      if(!port) return;

      connectionPointer=event.pointerId;

      /*
        처음부터 orb가 반응하지 않음.
        사용자가 실제로 orb 쪽으로 선을 가져와야 반응.
      */
    },true);

    viewport.addEventListener("pointermove",event=>{
      if(connectionPointer!==event.pointerId)
        return;

      mascot.connectionCuriosity(
        event.clientX,
        event.clientY
      );
    },true);

    const finishConnectionReaction=event=>{
      if(connectionPointer!==event.pointerId)
        return;

      connectionPointer=null;

      const wasClose=connectionClose;

      mascot.endConnectionCuriosity();

      /*
        orb 바로 위에서 connection을 놓은 경우
        연결 대상으로 받아들이지는 않고
        짧게 "나한테 연결하려고?" 반응만 함.
      */
      if(wasClose){
        mascot.pop();

        setTimeout(()=>{
          if(mascot.getState()==="idle")
            mascot.blink();
        },220);
      }
    };

    viewport.addEventListener(
      "pointerup",
      finishConnectionReaction,
      true
    );

    viewport.addEventListener(
      "pointercancel",
      finishConnectionReaction,
      true
    );

    /*
      Click / select:
      관심은 주지만 매번 달려가지는 않음.
    */
    nodes.addEventListener("pointerdown",event=>{
      const node=event.target.closest(".vc-node");
      if(!node) return;

      draggedNode=node;
      mascot.react("node-selected",{element:node});
    },true);

    /*
      실제 form 편집:
      이건 사용자가 지금 집중하는 작업이므로
      mascot도 필요할 때 가까이 접근.
    */
    nodes.addEventListener("input",event=>{
      const node=event.target.closest(".vc-node");
      if(!node) return;

      mascot.react("node-edited",{element:node});
    },true);

    nodes.addEventListener("change",event=>{
      const node=event.target.closest(".vc-node");
      if(!node) return;

      mascot.react("node-edited",{element:node});
    },true);

    /*
      Node drag가 끝났으면 새 위치를 확인.
      따라다니지는 않고 시선만 옮김.
    */
    nodes.addEventListener("pointerup",event=>{
      const node=event.target.closest(".vc-node");

      if(node)
        mascot.react("node-moved",{element:node});

      draggedNode=null;
    },true);

    /*
      사용자가 node를 orb 쪽으로 밀면
      orb가 스스로 공간을 내준다.
    */
    const watchNodeCollision=()=>{
      if(draggedNode)
        escapeFromNode(draggedNode);

      collisionFrame=requestAnimationFrame(
        watchNodeCollision
      );
    };

    collisionFrame=requestAnimationFrame(
      watchNodeCollision
    );

    new MutationObserver(records=>{
      for(const record of records){
        for(const node of record.addedNodes){
          if(!(node instanceof Element)) continue;

          const added=node.matches(".vc-node")
            ?node
            :node.querySelector(".vc-node");

          if(added){
            mascot.react("node-created",{element:added});
            return;
          }
        }
      }
    }).observe(nodes,{childList:true,subtree:true});
  }
}

if(document.readyState==="loading")
  document.addEventListener("DOMContentLoaded",mountCanvasMascot);
else
  mountCanvasMascot();

})(window);

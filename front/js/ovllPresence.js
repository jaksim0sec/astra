(function(global){
"use strict";

const UI=global.AstraUI;
const chatPage=document.querySelector("#chat-page");
const chatMessages=document.querySelector("#chat-messages");
const canvasPage=document.querySelector("#canvas-page");

if(!chatPage||!chatMessages||!canvasPage){
  throw new Error("OvllPresence DOM 구조가 올바르지 않습니다.");
}

const PHASES=new Set([
  "idle",
  "welcome",
  "thinking",
  "speaking"
]);

const state={
  phase:"idle",
  mode:UI?.getMode?.()||"chat",
  previousMode:null,
  chatRow:null,
  chatOrb:null,
  welcomeMessage:null,
  canvasMascot:null,
  canvasSpeech:null,
  speechText:null,
  speechTimer:null,
  speechFrame:null,
  settleTimer:null,
  destroyed:false
};

const events=new Map();
const listeners=[];

function on(name,handler){
  if(typeof handler!=="function") return()=>{};
  if(!events.has(name)) events.set(name,new Set());
  events.get(name).add(handler);
  return()=>events.get(name)?.delete(handler);
}

function emit(name,payload){
  for(const handler of events.get(name)||[]){
    try{handler(payload,api);}catch(error){console.error(error);}
  }
}

function listen(element,type,handler,options){
  element.addEventListener(type,handler,options);
  listeners.push(()=>element.removeEventListener(type,handler,options));
}

function setPhase(next,detail={}){
  if(!PHASES.has(next)) next="idle";
  const previous=state.phase;
  state.phase=next;

  if(previous!==next){
    emit("phasechange",{
      phase:next,
      previous,
      ...detail
    });
  }
}

function ensureChatPresence(){
  if(state.chatRow?.isConnected){
    return state.chatRow;
  }

  const row=document.createElement("div");
  row.id="chat-ovll-presence";
  row.className=
    "astra-message astra-message-assistant astra-message-ovll-presence";
  row.dataset.ovllPresence="true";

  const body=document.createElement("div");
  body.className=
    "astra-message-body astra-message-ovll-body";

  const orb=document.createElement("button");
  orb.type="button";
  orb.className="chat-ovll-presence";
  orb.setAttribute("aria-label","오블");
  orb.innerHTML=
    '<span class="chat-ovll-presence-eye" aria-hidden="true"></span>';

  body.appendChild(orb);
  row.appendChild(body);
  chatMessages.appendChild(row);

  state.chatRow=row;
  state.chatOrb=orb;

  listen(orb,"click",event=>{
    event.preventDefault();
    reactChat();
  });

  return row;
}

function ensureWelcomeMessage(text){
  if(state.welcomeMessage?.isConnected){
    const body=
      state.welcomeMessage.querySelector(".astra-message-body");
    if(body) body.textContent=text;
    return state.welcomeMessage;
  }

  const message=document.createElement("div");
  message.className=
    "astra-message astra-message-assistant astra-message-welcome";
  message.dataset.role="assistant";
  message.dataset.ovllWelcome="true";

  const body=document.createElement("div");
  body.className="astra-message-body";
  body.textContent=text;

  message.appendChild(body);
  chatMessages.appendChild(message);
  state.welcomeMessage=message;

  return message;
}

function moveToEnd(){
  const row=ensureChatPresence();
  chatMessages.appendChild(row);
  return row;
}

function welcome(text="안녕. 뭘 만들어볼까?"){
  const row=ensureChatPresence();
  const message=ensureWelcomeMessage(
    String(text||"").trim()||"안녕. 뭘 만들어볼까?"
  );

  chatMessages.appendChild(row);
  chatMessages.appendChild(message);
  chatMessages.classList.add("is-welcome");

  setPhase("welcome");
  return message;
}

function beginConversation(){
  chatMessages.classList.remove("is-welcome");
  moveToEnd();

  if(state.phase==="welcome"){
    setPhase("idle");
  }
}

function reactChat(){
  const orb=state.chatOrb||ensureChatPresence().querySelector(".chat-ovll-presence");
  if(!orb) return;

  orb.classList.remove("is-reacting");
  void orb.offsetWidth;
  orb.classList.add("is-reacting");

  setTimeout(()=>{
    orb.classList.remove("is-reacting");
  },300);
}

function settleChat(){
  const orb=
    state.chatOrb||
    ensureChatPresence().querySelector(".chat-ovll-presence");

  if(!orb) return;

  orb.classList.remove("is-thinking");
  orb.classList.add("is-settling");
  orb.setAttribute("aria-label","오블");

  clearTimeout(state.settleTimer);
  state.settleTimer=setTimeout(()=>{
    orb.classList.remove("is-settling");
  },520);
}

function enterChatFromEdge(){
  const row=moveToEnd();
  const orb=state.chatOrb;

  requestAnimationFrame(()=>{
    const pageRect=chatPage.getBoundingClientRect();
    const rowRect=row.getBoundingClientRect();
    const orbWidth=
      orb?.getBoundingClientRect().width||36;

    const localLeft=
      Math.max(
        0,
        rowRect.left-pageRect.left
      );

    const distance=
      localLeft+
      orbWidth+
      18;

    row.style.setProperty(
      "--ovll-entry-x",
      `${-distance}px`
    );

    row.classList.remove(
      "is-entering-from-edge"
    );

    void row.offsetWidth;

    row.classList.add(
      "is-entering-from-edge"
    );

    setTimeout(()=>{
      row.classList.remove(
        "is-entering-from-edge"
      );
    },640);
  });
}

function ensureCanvasSpeech(){
  if(state.canvasSpeech?.isConnected){
    return state.canvasSpeech;
  }

  const bubble=document.createElement("div");
  bubble.id="ovll-canvas-speech";
  bubble.setAttribute("role","status");
  bubble.setAttribute("aria-live","polite");
  bubble.innerHTML=
    '<div class="ovll-canvas-speech-body"></div>';

  canvasPage.appendChild(bubble);
  state.canvasSpeech=bubble;

  return bubble;
}

function canvasMascotElement(){
  return(
    state.canvasMascot?.element||
    global.ovllCanvasMascot?.element||
    null
  );
}

function positionCanvasSpeech(){
  state.speechFrame=null;

  const bubble=state.canvasSpeech;
  const mascot=canvasMascotElement();

  if(
    !bubble||
    !bubble.classList.contains("is-visible")||
    !mascot||
    mascot.hidden
  ){
    return;
  }

  const pageRect=
    canvasPage.getBoundingClientRect();
  const mascotRect=
    mascot.getBoundingClientRect();

  const x=
    mascotRect.left-
    pageRect.left+
    mascotRect.width/2;

  const y=
    mascotRect.top-
    pageRect.top+
    mascotRect.height/2;

  bubble.style.left=`${x}px`;
  bubble.style.top=`${y}px`;

  const roomLeft=x;
  const roomRight=pageRect.width-x;

  bubble.classList.toggle(
    "is-left",
    roomLeft>roomRight
  );

  bubble.classList.toggle(
    "is-right",
    roomLeft<=roomRight
  );

  state.speechFrame=
    requestAnimationFrame(
      positionCanvasSpeech
    );
}

function startSpeechTracking(){
  if(state.speechFrame!==null) return;

  state.speechFrame=
    requestAnimationFrame(
      positionCanvasSpeech
    );
}

function stopSpeechTracking(){
  if(state.speechFrame===null) return;

  cancelAnimationFrame(
    state.speechFrame
  );

  state.speechFrame=null;
}

function showCanvasSpeech(text,{thinking=false,hold=5200}={}){
  const bubble=ensureCanvasSpeech();
  const body=bubble.querySelector(
    ".ovll-canvas-speech-body"
  );

  if(!body) return;

  clearTimeout(state.speechTimer);

  bubble.classList.toggle(
    "is-thinking",
    !!thinking
  );

  if(thinking){
    body.innerHTML=
      '<span class="ovll-speech-dot"></span><span class="ovll-speech-dot"></span><span class="ovll-speech-dot"></span>';
  }else{
    body.textContent=
      String(text??"").trim();
  }

  state.speechText=
    thinking
      ?null
      :String(text??"").trim();

  bubble.classList.remove(
    "is-visible"
  );

  requestAnimationFrame(()=>{
    bubble.classList.add(
      "is-visible"
    );
    startSpeechTracking();
  });

  if(!thinking&&hold>0){
    state.speechTimer=setTimeout(
      hideCanvasSpeech,
      hold
    );
  }
}

function hideCanvasSpeech(){
  clearTimeout(state.speechTimer);
  state.speechTimer=null;

  state.canvasSpeech?.classList.remove(
    "is-visible",
    "is-thinking"
  );

  stopSpeechTracking();
}

function thinking(){
  const row=moveToEnd();
  const orb=
    state.chatOrb||
    row.querySelector(".chat-ovll-presence");

  clearTimeout(state.settleTimer);

  orb?.classList.remove(
    "is-settling"
  );

  orb?.classList.add(
    "is-thinking"
  );

  orb?.setAttribute(
    "aria-label",
    "오블이 생각 중"
  );

  showCanvasSpeech("",{
    thinking:true,
    hold:0
  });

  setPhase("thinking");
  return row;
}

function settle(){
  settleChat();

  if(state.phase==="thinking"){
    setPhase("idle");
  }
}

function speak(text,options={}){
  const value=
    String(text??"").trim();

  if(!value) return;

  moveToEnd();
  settleChat();

  showCanvasSpeech(
    value,
    {
      thinking:false,
      hold:
        Number.isFinite(options.hold)
          ?options.hold
          :5200
    }
  );

  setPhase("speaking",{
    text:value
  });
}

function attachCanvasMascot(mascot){
  state.canvasMascot=mascot||null;

  if(
    state.canvasSpeech?.classList.contains(
      "is-visible"
    )
  ){
    startSpeechTracking();
  }

  return api;
}

function handleModeChange({
  mode,
  previous
}={}){
  state.previousMode=
    previous||state.mode;

  state.mode=
    mode||UI?.getMode?.()||"chat";

  if(
    state.previousMode==="canvas"&&
    state.mode==="chat"
  ){
    enterChatFromEdge();
  }

  if(state.mode==="canvas"){
    if(
      state.canvasSpeech?.classList.contains(
        "is-visible"
      )
    ){
      startSpeechTracking();
    }
  }else{
    stopSpeechTracking();
  }
}

UI?.on?.(
  "modechange",
  handleModeChange
);

const api={
  welcome,
  beginConversation,
  moveToEnd,
  thinking,
  settle,
  speak,
  hideCanvasSpeech,
  attachCanvasMascot,
  react(){
    reactChat();
    state.canvasMascot?.react?.();
  },
  getState(){
    return{
      phase:state.phase,
      mode:state.mode,
      previousMode:state.previousMode,
      speechText:state.speechText
    };
  },
  on,
  destroy(){
    if(state.destroyed) return;
    state.destroyed=true;

    clearTimeout(state.speechTimer);
    clearTimeout(state.settleTimer);
    stopSpeechTracking();

    listeners
      .splice(0)
      .forEach(cleanup=>{
        try{cleanup();}catch{}
      });

    events.clear();
    state.canvasSpeech?.remove();
    state.chatRow?.remove();
    state.welcomeMessage?.remove();
  }
};

global.OvllPresence=api;

})(window);

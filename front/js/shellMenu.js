(function(global){
"use strict";

const app=
  document.querySelector("#app");

if(!app){
  return;
}

const state={
  open:false,
  destroyed:false
};

const listeners=[];
const events=new Map();

function listen(node,type,handler,options){
  node.addEventListener(
    type,
    handler,
    options
  );

  listeners.push(
    ()=>node.removeEventListener(
      type,
      handler,
      options
    )
  );
}

function on(name,handler){
  if(typeof handler!=="function"){
    return()=>{};
  }

  if(!events.has(name)){
    events.set(
      name,
      new Set()
    );
  }

  events.get(name).add(
    handler
  );

  return()=>{
    events.get(name)?.delete(
      handler
    );
  };
}

function emit(name,payload){
  for(
    const handler
    of events.get(name)||[]
  ){
    try{
      handler(
        payload,
        api
      );
    }catch(error){
      console.error(error);
    }
  }
}

const root=
  document.createElement("div");

root.id="ovll-shell-menu";
root.innerHTML=`
  <button
    id="ovll-shell-menu-trigger"
    type="button"
    aria-label="더보기"
    aria-expanded="false"
    aria-controls="ovll-shell-menu-panel"
  >
    <span class="ovll-shell-menu-dots" aria-hidden="true">
      <i></i>
      <i></i>
      <i></i>
    </span>
  </button>

  <div
    id="ovll-shell-menu-backdrop"
    aria-hidden="true"
  ></div>

  <aside
    id="ovll-shell-menu-panel"
    aria-hidden="true"
    aria-label="메뉴"
  >
    <div class="ovll-shell-menu-panel-inner">

      <header class="ovll-shell-menu-header">
        <div
          class="ovll-shell-menu-slot"
          data-shell-slot="header"
        >
          <div
            class="ovll-shell-menu-brand-mark"
            aria-hidden="true"
          >
            <span></span>
          </div>
        </div>

        <button
          class="ovll-shell-menu-close"
          type="button"
          aria-label="메뉴 닫기"
        >
          <svg
            viewBox="0 0 20 20"
            fill="none"
            aria-hidden="true"
          >
            <path d="M5.5 5.5 14.5 14.5"></path>
            <path d="M14.5 5.5 5.5 14.5"></path>
          </svg>
        </button>
      </header>

      <div
        class="ovll-shell-menu-slot ovll-shell-menu-main"
        data-shell-slot="main"
      ></div>

      <footer
        class="ovll-shell-menu-slot ovll-shell-menu-footer"
        data-shell-slot="footer"
      ></footer>

    </div>
  </aside>
`;

app.appendChild(
  root
);

const trigger=
  root.querySelector(
    "#ovll-shell-menu-trigger"
  );

const backdrop=
  root.querySelector(
    "#ovll-shell-menu-backdrop"
  );

const panel=
  root.querySelector(
    "#ovll-shell-menu-panel"
  );

const closeButton=
  root.querySelector(
    ".ovll-shell-menu-close"
  );

const slotMap={
  header:
    root.querySelector(
      '[data-shell-slot="header"]'
    ),
  main:
    root.querySelector(
      '[data-shell-slot="main"]'
    ),
  footer:
    root.querySelector(
      '[data-shell-slot="footer"]'
    )
};

function setOpen(open){
  const next=
    !!open;

  if(
    state.destroyed||
    state.open===next
  ){
    return api;
  }

  state.open=next;

  root.classList.toggle(
    "is-open",
    next
  );

  trigger.setAttribute(
    "aria-expanded",
    String(next)
  );

  panel.setAttribute(
    "aria-hidden",
    String(!next)
  );

  backdrop.setAttribute(
    "aria-hidden",
    String(!next)
  );

  document.documentElement.classList.toggle(
    "shell-menu-open",
    next
  );

  if(next){
    requestAnimationFrame(
      ()=>closeButton.focus({
        preventScroll:true
      })
    );
  }else{
    requestAnimationFrame(
      ()=>trigger.focus({
        preventScroll:true
      })
    );
  }

  emit(
    "change",
    {
      open:next
    }
  );

  return api;
}

function open(){
  return setOpen(true);
}

function close(){
  return setOpen(false);
}

function toggle(){
  return setOpen(
    !state.open
  );
}

function replaceSlot(
  name,
  content
){
  const slot=
    slotMap[name];

  if(!slot){
    return api;
  }

  slot.replaceChildren();

  if(
    content===null||
    content===undefined
  ){
    return api;
  }

  if(
    content instanceof Node
  ){
    slot.appendChild(
      content
    );

    return api;
  }

  if(
    Array.isArray(content)
  ){
    content.forEach(item=>{
      if(item instanceof Node){
        slot.appendChild(item);
      }
    });

    return api;
  }

  slot.textContent=
    String(content);

  return api;
}

function getSlot(name){
  return slotMap[name]||null;
}

function createSection({
  title="",
  action=null,
  className=""
}={}){
  const section=
    document.createElement(
      "section"
    );

  section.className=
    [
      "ovll-shell-menu-section",
      className
    ]
      .filter(Boolean)
      .join(" ");

  if(
    title||
    action
  ){
    const head=
      document.createElement(
        "div"
      );

    head.className=
      "ovll-shell-menu-section-head";

    if(title){
      const heading=
        document.createElement(
          "div"
        );

      heading.className=
        "ovll-shell-menu-section-title";

      heading.textContent=
        String(title);

      head.appendChild(
        heading
      );
    }

    if(
      action instanceof Node
    ){
      head.appendChild(
        action
      );
    }

    section.appendChild(
      head
    );
  }

  const body=
    document.createElement(
      "div"
    );

  body.className=
    "ovll-shell-menu-section-body";

  section.appendChild(
    body
  );

  return{
    element:section,
    body
  };
}

listen(
  trigger,
  "click",
  toggle
);

listen(
  closeButton,
  "click",
  close
);

listen(
  backdrop,
  "click",
  close
);

listen(
  document,
  "keydown",
  event=>{
    if(
      event.key==="Escape"&&
      state.open
    ){
      close();
    }
  }
);

listen(
  panel,
  "pointerdown",
  event=>{
    event.stopPropagation();
  }
);

const api={
  open,
  close,
  toggle,
  on,
  isOpen(){
    return state.open;
  },
  getSlot,
  setHeader(content){
    return replaceSlot(
      "header",
      content
    );
  },
  setMain(content){
    return replaceSlot(
      "main",
      content
    );
  },
  setFooter(content){
    return replaceSlot(
      "footer",
      content
    );
  },
  createSection,
  destroy(){
    if(state.destroyed){
      return;
    }

    state.destroyed=true;

    document.documentElement.classList.remove(
      "shell-menu-open"
    );

    listeners
      .splice(0)
      .forEach(cleanup=>{
        try{
          cleanup();
        }catch{}
      });

    events.clear();
    root.remove();
  }
};

global.OvllShellMenu=
  Object.freeze(api);

})(window);

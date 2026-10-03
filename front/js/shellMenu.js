(function(global){
"use strict";

const Store =
  global.OvllWorkspaceStore;

const appStage =
  document.querySelector(
    "#app-stage"
  );

if(
  !appStage ||
  !Store
){
  return;
}

const state = {
  open:false,
  searchOpen:false,
  query:"",
  editing:null,
  destroyed:false,
  renderFrame:null,
  gesture:{
    active:false,
    horizontal:false,
    pointerId:null,
    startX:0,
    startY:0,
    lastX:0,
    lastTime:0,
    velocityX:0,
    dragX:0
  }
};

const listeners=[];
const events=new Map();

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

function icon(name){
  const icons={
    sidebar:`
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <rect x="3" y="3.25" width="14" height="13.5" rx="3" stroke="currentColor" stroke-width="1.4"/>
        <path d="M7.2 3.7v12.6" stroke="currentColor" stroke-width="1.4"/>
      </svg>
    `,
    close:`
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="m6.2 6.2 7.6 7.6M13.8 6.2l-7.6 7.6" stroke="currentColor" stroke-width="1.55" stroke-linecap="round"/>
      </svg>
    `,
    plus:`
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M10 4.25v11.5M4.25 10h11.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
    `,
    search:`
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <circle cx="8.8" cy="8.8" r="4.75" stroke="currentColor" stroke-width="1.45"/>
        <path d="m12.45 12.45 3.2 3.2" stroke="currentColor" stroke-width="1.45" stroke-linecap="round"/>
      </svg>
    `,
    chevron:`
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="m7.25 8 2.75 2.75L12.75 8" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `,
    chat:`
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M4 4.3h12v8.8H8.1L4 16v-3.1V4.3Z" stroke="currentColor" stroke-width="1.35" stroke-linejoin="round"/>
      </svg>
    `,
    context:`
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <circle cx="6.2" cy="7" r="2.1" stroke="currentColor" stroke-width="1.3"/>
        <circle cx="13.8" cy="7" r="2.1" stroke="currentColor" stroke-width="1.3"/>
        <path d="M4.5 14.8c.35-2.15 1.75-3.3 3.7-3.3h3.6c1.95 0 3.35 1.15 3.7 3.3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
      </svg>
    `,
    download:`
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M10 3.5v8m0 0 2.7-2.7M10 11.5 7.3 8.8M4 15.5h12" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `,
    upload:`
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M10 12.5v-8m0 0 2.7 2.7M10 4.5 7.3 7.2M4 15.5h12" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `,
    user:`
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <circle cx="10" cy="7.2" r="3" stroke="currentColor" stroke-width="1.35"/>
        <path d="M4.8 16c.45-2.8 2.2-4.25 5.2-4.25S14.75 13.2 15.2 16" stroke="currentColor" stroke-width="1.35" stroke-linecap="round"/>
      </svg>
    `,
    dots:`
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <circle cx="5" cy="10" r="1.15" fill="currentColor"/>
        <circle cx="10" cy="10" r="1.15" fill="currentColor"/>
        <circle cx="15" cy="10" r="1.15" fill="currentColor"/>
      </svg>
    `
  };

  return icons[name]||"";
}

const root=
  document.createElement(
    "div"
  );

root.id=
  "ovll-shell-menu";

root.innerHTML=`
  <button
    id="ovll-shell-menu-trigger"
    type="button"
    aria-label="사이드바 열기"
    aria-expanded="false"
    aria-controls="ovll-shell-menu-panel"
  >
    ${icon("sidebar")}
  </button>

  <div
    id="ovll-shell-menu-backdrop"
    aria-hidden="true"
  ></div>

  <aside
    id="ovll-shell-menu-panel"
    aria-hidden="true"
    aria-label="워크스페이스"
  >
    <div class="ovll-sidebar-inner">
      <header class="ovll-sidebar-header">
        <div class="ovll-sidebar-brand">
          <span class="ovll-sidebar-brand-orb" aria-hidden="true">
            <i></i>
          </span>
          <span class="ovll-sidebar-brand-name">ovll</span>
        </div>

        <button
          class="ovll-sidebar-icon-button"
          data-sidebar-action="close"
          type="button"
          aria-label="사이드바 닫기"
        >
          ${icon("close")}
        </button>
      </header>

      <div class="ovll-sidebar-primary">
        <button
          class="ovll-sidebar-primary-action"
          data-sidebar-action="new-chat"
          type="button"
        >
          <span class="ovll-sidebar-primary-icon">
            ${icon("plus")}
          </span>
          <span>새 대화</span>
        </button>

        <button
          class="ovll-sidebar-primary-action"
          data-sidebar-action="search"
          type="button"
          aria-expanded="false"
        >
          <span class="ovll-sidebar-primary-icon">
            ${icon("search")}
          </span>
          <span>검색</span>
          <span class="ovll-sidebar-keyhint">⌘ K</span>
        </button>

        <div
          class="ovll-sidebar-search"
          data-sidebar-search
          hidden
        >
          <span class="ovll-sidebar-search-icon">
            ${icon("search")}
          </span>
          <input
            type="search"
            placeholder="대화 검색"
            autocomplete="off"
            spellcheck="false"
            aria-label="대화 검색"
          >
          <button
            type="button"
            data-sidebar-action="search-close"
            aria-label="검색 닫기"
          >
            ${icon("close")}
          </button>
        </div>
      </div>

      <div
        class="ovll-sidebar-scroll"
        data-sidebar-scroll
      >
        <div
          class="ovll-sidebar-sections"
          data-sidebar-sections
        ></div>

        <div
          class="ovll-sidebar-contexts"
          data-sidebar-contexts
        ></div>
      </div>

      <footer class="ovll-sidebar-footer">
        <div class="ovll-sidebar-local-tools">
          <button
            type="button"
            data-sidebar-action="export"
            title="JSON 내보내기"
            aria-label="JSON 내보내기"
          >
            ${icon("download")}
          </button>
          <button
            type="button"
            data-sidebar-action="import"
            title="JSON 불러오기"
            aria-label="JSON 불러오기"
          >
            ${icon("upload")}
          </button>
          <span>로컬 저장</span>
        </div>

        <button
          type="button"
          class="ovll-sidebar-account"
          data-sidebar-action="login"
        >
          <span class="ovll-sidebar-account-avatar">
            ${icon("user")}
          </span>
          <span class="ovll-sidebar-account-copy">
            <strong>로그인</strong>
            <small>기기 간 동기화 준비</small>
          </span>
          <span class="ovll-sidebar-account-more">
            ${icon("dots")}
          </span>
        </button>
      </footer>
    </div>
  </aside>

  <input
    type="file"
    accept="application/json,.json"
    data-sidebar-import
    hidden
  >
`;

appStage.appendChild(
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

const sectionsRoot=
  root.querySelector(
    "[data-sidebar-sections]"
  );

const contextsRoot=
  root.querySelector(
    "[data-sidebar-contexts]"
  );

const searchBox=
  root.querySelector(
    "[data-sidebar-search]"
  );

const searchInput=
  searchBox?.querySelector(
    "input"
  );

const importInput=
  root.querySelector(
    "[data-sidebar-import]"
  );

function formatTime(timestamp){
  const value =
    Number(timestamp) || 0;

  if(!value) return "";

  const diff =
    Date.now() - value;

  if(diff < 60000){
    return "방금";
  }

  if(diff < 3600000){
    return `${Math.max(1,Math.floor(diff/60000))}분`;
  }

  if(diff < 86400000){
    return `${Math.max(1,Math.floor(diff/3600000))}시간`;
  }

  const date =
    new Date(value);

  return `${date.getMonth()+1}/${date.getDate()}`;
}

function activeConversation(){
  return Store
    .getActiveConversation?.();
}

function closeOnSmallScreen(){
  if(
    global.matchMedia?.(
      "(max-width: 60rem)"
    ).matches
  ){
    close();
  }
}

function currentSectionId(){
  const active =
    activeConversation();

  if(active?.sectionId){
    return active.sectionId;
  }

  return Store
    .getSnapshot()
    .sections
    .slice()
    .sort(
      (a,b)=>a.order-b.order
    )[0]
    ?.id ||
    "";
}

async function saveCurrentConversation(){
  try{
    await global.AstraApp
      ?.saveActiveConversation?.();
  }catch(error){
    console.warn(
      "ovll sidebar save before switch failed:",
      error
    );
  }
}

async function openConversation(
  conversationId
){
  const id =
    String(
      conversationId || ""
    );

  if(!id) return;

  await saveCurrentConversation();

  Store.activateConversation(
    id
  );

  await global.AstraApp
    ?.openConversation?.(
      id
    );

  closeOnSmallScreen();
}

async function createConversation(
  sectionId=currentSectionId()
){
  await saveCurrentConversation();

  const conversation =
    Store.createConversation({
      sectionId,
      title:"새 대화",
      activate:true
    });

  await global.AstraApp
    ?.openConversation?.(
      conversation.id
    );

  closeOnSmallScreen();
}

function setSearchOpen(
  open,
  focus=true
){
  state.searchOpen=
    !!open;

  searchBox.hidden=
    !state.searchOpen;

  root.classList.toggle(
    "is-searching",
    state.searchOpen
  );

  root.querySelector(
    '[data-sidebar-action="search"]'
  )
    ?.setAttribute(
      "aria-expanded",
      String(
        state.searchOpen
      )
    );

  if(
    state.searchOpen &&
    focus
  ){
    requestAnimationFrame(
      ()=>{
        searchInput?.focus({
          preventScroll:true
        });
        searchInput?.select();
      }
    );
  }

  if(!state.searchOpen){
    state.query="";
    if(searchInput){
      searchInput.value="";
    }
  }

  scheduleRender();
}

function renderInlineEditor(
  parent,
  type
){
  const row =
    document.createElement(
      "form"
    );

  row.className=
    "ovll-sidebar-inline-editor";

  const input =
    document.createElement(
      "input"
    );

  input.type="text";
  input.maxLength=
    type==="section"
      ?60
      :80;
  input.placeholder=
    type==="section"
      ?"섹션 이름"
      :"맥락 이름";
  input.autocomplete="off";

  row.appendChild(input);
  parent.appendChild(row);

  const finish=
    commit=>{
      const value=
        input.value.trim();

      if(
        commit &&
        value
      ){
        if(type==="section"){
          Store.createSection(
            value
          );
        }else{
          const bundle =
            Store.createContextBundle(
              value
            );

          const active =
            activeConversation();

          if(active){
            Store.assignContextBundle(
              active.id,
              bundle.id
            );

            global.AstraApp
              ?.refreshConversationContext?.();
          }
        }
      }

      state.editing=null;
      row.remove();
      scheduleRender();
    };

  row.addEventListener(
    "submit",
    event=>{
      event.preventDefault();
      finish(true);
    }
  );

  input.addEventListener(
    "keydown",
    event=>{
      if(event.key==="Escape"){
        event.preventDefault();
        finish(false);
      }
    }
  );

  input.addEventListener(
    "blur",
    ()=>{
      setTimeout(
        ()=>{
          if(row.isConnected){
            finish(
              !!input.value.trim()
            );
          }
        },
        0
      );
    },
    {once:true}
  );

  requestAnimationFrame(
    ()=>input.focus({
      preventScroll:true
    })
  );
}

function startEditor(type){
  if(state.editing){
    return;
  }

  state.editing=
    type;

  const target =
    type==="section"
      ?sectionsRoot
      :contextsRoot;

  renderInlineEditor(
    target,
    type
  );
}

function conversationItem(
  conversation,
  activeId
){
  const button =
    document.createElement(
      "button"
    );

  button.type="button";
  button.className=
    "ovll-sidebar-chat";
  button.dataset.conversationId=
    conversation.id;

  const active =
    conversation.id===activeId;

  button.classList.toggle(
    "is-active",
    active
  );

  button.setAttribute(
    "aria-current",
    active
      ?"page"
      :"false"
  );

  const iconNode =
    document.createElement(
      "span"
    );

  iconNode.className=
    "ovll-sidebar-chat-icon";
  iconNode.innerHTML=
    icon("chat");

  const copy =
    document.createElement(
      "span"
    );

  copy.className=
    "ovll-sidebar-chat-copy";

  const title =
    document.createElement(
      "span"
    );

  title.className=
    "ovll-sidebar-chat-title";
  title.textContent=
    conversation.title ||
    "새 대화";

  const meta =
    document.createElement(
      "span"
    );

  meta.className=
    "ovll-sidebar-chat-meta";
  meta.textContent=
    formatTime(
      conversation.updatedAt
    );

  copy.append(
    title,
    meta
  );

  button.append(
    iconNode,
    copy
  );

  return button;
}

function renderSearchResults(
  snapshot
){
  sectionsRoot
    .replaceChildren();

  contextsRoot
    .replaceChildren();

  const title =
    document.createElement(
      "div"
    );

  title.className=
    "ovll-sidebar-group-head";

  title.innerHTML=`
    <span>검색 결과</span>
    <small>${Store.search(state.query).length}</small>
  `;

  sectionsRoot.appendChild(
    title
  );

  const results=
    Store.search(
      state.query
    );

  const activeId=
    snapshot.workspace
      .activeConversationId;

  if(!results.length){
    const empty=
      document.createElement(
        "div"
      );
    empty.className=
      "ovll-sidebar-empty";
    empty.textContent=
      "찾는 대화가 없음";
    sectionsRoot.appendChild(
      empty
    );
    return;
  }

  for(const conversation of results){
    sectionsRoot.appendChild(
      conversationItem(
        conversation,
        activeId
      )
    );
  }
}

function sectionElement(
  section,
  conversations,
  activeId
){
  const sectionNode =
    document.createElement(
      "section"
    );

  sectionNode.className=
    "ovll-sidebar-section";
  sectionNode.dataset.sectionId=
    section.id;

  const header =
    document.createElement(
      "div"
    );

  header.className=
    "ovll-sidebar-section-head";

  const toggle =
    document.createElement(
      "button"
    );

  toggle.type="button";
  toggle.className=
    "ovll-sidebar-section-toggle";
  toggle.dataset.sidebarAction=
    "toggle-section";
  toggle.dataset.sectionId=
    section.id;
  toggle.setAttribute(
    "aria-expanded",
    String(!section.collapsed)
  );

  toggle.innerHTML=`
    <span class="ovll-sidebar-section-chevron">
      ${icon("chevron")}
    </span>
    <span class="ovll-sidebar-section-title"></span>
    <span class="ovll-sidebar-section-count">
      ${conversations.length}
    </span>
  `;

  toggle.querySelector(
    ".ovll-sidebar-section-title"
  ).textContent=
    section.title;

  const add =
    document.createElement(
      "button"
    );

  add.type="button";
  add.className=
    "ovll-sidebar-section-add";
  add.dataset.sidebarAction=
    "new-chat-section";
  add.dataset.sectionId=
    section.id;
  add.setAttribute(
    "aria-label",
    `${section.title}에 새 대화`
  );
  add.innerHTML=
    icon("plus");

  header.append(
    toggle,
    add
  );

  sectionNode.appendChild(
    header
  );

  if(!section.collapsed){
    const list=
      document.createElement(
        "div"
      );
    list.className=
      "ovll-sidebar-chat-list";

    const sorted=
      conversations
        .slice()
        .sort(
          (a,b)=>
            Number(b.updatedAt)-
            Number(a.updatedAt)
        );

    for(const conversation of sorted){
      list.appendChild(
        conversationItem(
          conversation,
          activeId
        )
      );
    }

    sectionNode.appendChild(
      list
    );
  }

  return sectionNode;
}

function renderSections(
  snapshot
){
  sectionsRoot
    .replaceChildren();

  const heading =
    document.createElement(
      "div"
    );

  heading.className=
    "ovll-sidebar-group-head";

  const label =
    document.createElement(
      "span"
    );
  label.textContent=
    "섹션";

  const add =
    document.createElement(
      "button"
    );

  add.type="button";
  add.dataset.sidebarAction=
    "new-section";
  add.setAttribute(
    "aria-label",
    "새 섹션"
  );
  add.innerHTML=
    icon("plus");

  heading.append(
    label,
    add
  );

  sectionsRoot.appendChild(
    heading
  );

  const sections=
    snapshot.sections
      .slice()
      .sort(
        (a,b)=>
          Number(a.order)-
          Number(b.order)
      );

  const activeId=
    snapshot.workspace
      .activeConversationId;

  for(const section of sections){
    const conversations=
      snapshot.conversations
        .filter(
          item =>
            item.sectionId===
            section.id
        );

    sectionsRoot.appendChild(
      sectionElement(
        section,
        conversations,
        activeId
      )
    );
  }
}

function renderContexts(
  snapshot
){
  contextsRoot
    .replaceChildren();

  const heading =
    document.createElement(
      "div"
    );

  heading.className=
    "ovll-sidebar-group-head ovll-sidebar-context-head";

  const label =
    document.createElement(
      "span"
    );
  label.textContent=
    "맥락";

  const add =
    document.createElement(
      "button"
    );
  add.type="button";
  add.dataset.sidebarAction=
    "new-context";
  add.setAttribute(
    "aria-label",
    "새 맥락 묶음"
  );
  add.innerHTML=
    icon("plus");

  heading.append(
    label,
    add
  );
  contextsRoot.appendChild(
    heading
  );

  const active =
    snapshot.conversations
      .find(
        item =>
          item.id===
          snapshot.workspace
            .activeConversationId
      );

  const activeContextId=
    active
      ?.contextBundleId ||
    "";

  for(
    const bundle of
    snapshot.contextBundles
      .slice()
      .sort(
        (a,b)=>
          Number(b.updatedAt)-
          Number(a.updatedAt)
      )
  ){
    const button =
      document.createElement(
        "button"
      );

    button.type="button";
    button.className=
      "ovll-sidebar-context";
    button.dataset.contextId=
      bundle.id;

    if(
      bundle.id===
      activeContextId
    ){
      button.classList.add(
        "is-active"
      );
    }

    button.innerHTML=`
      <span class="ovll-sidebar-context-icon">
        ${icon("context")}
      </span>
      <span class="ovll-sidebar-context-title"></span>
      <span class="ovll-sidebar-context-state">
        ${bundle.id===activeContextId?"사용 중":""}
      </span>
    `;

    button.querySelector(
      ".ovll-sidebar-context-title"
    ).textContent=
      bundle.title;

    contextsRoot.appendChild(
      button
    );
  }
}

function render(){
  state.renderFrame=null;

  if(state.destroyed){
    return;
  }

  const snapshot=
    Store.getSnapshot();

  if(
    state.searchOpen &&
    state.query
  ){
    renderSearchResults(
      snapshot
    );
  }else{
    renderSections(
      snapshot
    );
    renderContexts(
      snapshot
    );
  }
}

function scheduleRender(){
  if(
    state.renderFrame!==null
  ){
    return;
  }

  state.renderFrame=
    requestAnimationFrame(
      render
    );
}

function setOpen(open){
  const next=
    !!open;

  if(
    state.destroyed ||
    state.open===next
  ){
    return api;
  }

  state.open=
    next;

  state.gesture.dragX=0;
  root.style.removeProperty(
    "--sidebar-drag-x"
  );
  root.style.removeProperty(
    "--sidebar-drag-progress"
  );

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

  document.documentElement
    .classList.toggle(
      "shell-menu-open",
      next
    );

  if(next){
    scheduleRender();
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
  setSearchOpen(false,false);
  return setOpen(false);
}

function toggle(){
  return setOpen(
    !state.open
  );
}

function downloadWorkspace(){
  const blob=
    new Blob(
      [
        Store.exportJSON()
      ],
      {
        type:
          "application/json"
      }
    );

  const url=
    URL.createObjectURL(
      blob
    );

  const link=
    document.createElement(
      "a"
    );

  link.href=url;
  link.download=
    `ovll-workspace-${new Date().toISOString().slice(0,10)}.json`;

  document.body
    .appendChild(link);

  link.click();
  link.remove();

  setTimeout(
    ()=>URL.revokeObjectURL(url),
    1000
  );
}

async function importWorkspaceFile(
  file
){
  if(!file){
    return;
  }

  const text=
    await file.text();

  await saveCurrentConversation();

  Store.importJSON(
    text
  );

  const active=
    Store.getActiveConversation();

  if(active){
    await global.AstraApp
      ?.openConversation?.(
        active.id
      );
  }

  scheduleRender();
}

function handleClick(event){
  const conversation=
    event.target.closest(
      "[data-conversation-id]"
    );

  if(
    conversation &&
    root.contains(conversation)
  ){
    event.preventDefault();

    void openConversation(
      conversation
        .dataset
        .conversationId
    );
    return;
  }

  const context=
    event.target.closest(
      "[data-context-id]"
    );

  if(
    context &&
    root.contains(context)
  ){
    event.preventDefault();

    const active=
      activeConversation();

    if(active){
      Store.assignContextBundle(
        active.id,
        context.dataset.contextId
      );

      global.AstraApp
        ?.refreshConversationContext?.();
    }

    return;
  }

  const actionNode=
    event.target.closest(
      "[data-sidebar-action]"
    );

  const action=
    actionNode
      ?.dataset
      ?.sidebarAction;

  if(!action){
    return;
  }

  event.preventDefault();

  if(action==="close"){
    close();
    return;
  }

  if(action==="new-chat"){
    void createConversation();
    return;
  }

  if(action==="new-chat-section"){
    void createConversation(
      actionNode.dataset.sectionId
    );
    return;
  }

  if(action==="search"){
    setSearchOpen(
      !state.searchOpen
    );
    return;
  }

  if(action==="search-close"){
    setSearchOpen(false);
    return;
  }

  if(action==="new-section"){
    startEditor("section");
    return;
  }

  if(action==="new-context"){
    startEditor("context");
    return;
  }

  if(action==="toggle-section"){
    const section=
      Store.getSection(
        actionNode.dataset.sectionId
      );

    if(section){
      Store.setSectionCollapsed(
        section.id,
        !section.collapsed
      );
    }
    return;
  }

  if(action==="export"){
    downloadWorkspace();
    return;
  }

  if(action==="import"){
    importInput?.click();
    return;
  }

  if(action==="login"){
    emit(
      "login",
      {
        source:"sidebar"
      }
    );
  }
}

function beginGesture(event){
  if(
    !state.open ||
    state.destroyed ||
    event.button!==undefined &&
    event.button!==0
  ){
    return;
  }

  if(
    event.target.closest(
      "input,button,a"
    )
  ){
    return;
  }

  state.gesture.active=true;
  state.gesture.horizontal=false;
  state.gesture.pointerId=
    event.pointerId;
  state.gesture.startX=
    event.clientX;
  state.gesture.startY=
    event.clientY;
  state.gesture.lastX=
    event.clientX;
  state.gesture.lastTime=
    performance.now();
  state.gesture.velocityX=0;
  state.gesture.dragX=0;
}

function moveGesture(event){
  const gesture=
    state.gesture;

  if(
    !gesture.active ||
    gesture.pointerId!==
      event.pointerId
  ){
    return;
  }

  const dx=
    event.clientX-
    gesture.startX;

  const dy=
    event.clientY-
    gesture.startY;

  if(
    !gesture.horizontal
  ){
    if(
      Math.max(
        Math.abs(dx),
        Math.abs(dy)
      )<7
    ){
      return;
    }

    if(
      Math.abs(dy)>
      Math.abs(dx) ||
      dx>=0
    ){
      gesture.active=false;
      return;
    }

    gesture.horizontal=true;
    root.classList.add(
      "is-dragging"
    );

    try{
      panel.setPointerCapture(
        event.pointerId
      );
    }catch{}
  }

  event.preventDefault();

  const width=
    Math.max(
      1,
      panel
        .getBoundingClientRect()
        .width
    );

  gesture.dragX=
    Math.max(
      -width,
      Math.min(
        0,
        dx
      )
    );

  const progress=
    Math.max(
      0,
      Math.min(
        1,
        1+
        gesture.dragX/
        width
      )
    );

  root.style.setProperty(
    "--sidebar-drag-x",
    `${gesture.dragX}px`
  );

  root.style.setProperty(
    "--sidebar-drag-progress",
    String(progress)
  );

  const current=
    performance.now();

  const dt=
    Math.max(
      1,
      current-
      gesture.lastTime
    );

  const velocity=
    (
      event.clientX-
      gesture.lastX
    )/
    dt;

  gesture.velocityX=
    gesture.velocityX*.7+
    velocity*.3;

  gesture.lastX=
    event.clientX;
  gesture.lastTime=
    current;
}

function endGesture(event){
  const gesture=
    state.gesture;

  if(
    !gesture.active &&
    !gesture.horizontal
  ){
    return;
  }

  if(
    gesture.pointerId!==
      event.pointerId
  ){
    return;
  }

  const width=
    Math.max(
      1,
      panel
        .getBoundingClientRect()
        .width
    );

  const shouldClose=
    Math.abs(
      gesture.dragX
    )>
      width*.28 ||
    gesture.velocityX<
      -.48;

  gesture.active=false;
  gesture.horizontal=false;
  gesture.pointerId=null;

  root.classList.remove(
    "is-dragging"
  );

  root.style.removeProperty(
    "--sidebar-drag-x"
  );

  root.style.removeProperty(
    "--sidebar-drag-progress"
  );

  try{
    panel.releasePointerCapture(
      event.pointerId
    );
  }catch{}

  if(shouldClose){
    close();
  }
}

listen(
  trigger,
  "click",
  toggle
);

listen(
  backdrop,
  "click",
  close
);

listen(
  root,
  "click",
  handleClick
);

listen(
  searchInput,
  "input",
  event=>{
    state.query=
      event.target.value
        .trim();
    scheduleRender();
  }
);

listen(
  importInput,
  "change",
  event=>{
    const file=
      event.target
        .files?.[0];

    event.target.value="";

    void importWorkspaceFile(
      file
    ).catch(error=>{
      console.error(
        "ovll workspace import failed:",
        error
      );
    });
  }
);

listen(
  panel,
  "pointerdown",
  beginGesture,
  {
    passive:true
  }
);

listen(
  panel,
  "pointermove",
  moveGesture,
  {
    passive:false
  }
);

listen(
  panel,
  "pointerup",
  endGesture,
  {
    passive:true
  }
);

listen(
  panel,
  "pointercancel",
  endGesture,
  {
    passive:true
  }
);

listen(
  document,
  "keydown",
  event=>{
    if(
      event.key==="Escape" &&
      state.open
    ){
      if(state.searchOpen){
        setSearchOpen(false);
      }else{
        close();
      }
      return;
    }

    if(
      (
        event.metaKey ||
        event.ctrlKey
      ) &&
      event.key.toLowerCase()==="k"
    ){
      event.preventDefault();
      open();
      setSearchOpen(true);
    }
  }
);

const offStore=
  Store.on(
    "change",
    scheduleRender
  );

listeners.push(
  ()=>{
    try{
      offStore?.();
    }catch{}
  }
);

scheduleRender();

const api={
  open,
  close,
  toggle,
  on,
  isOpen(){
    return state.open;
  },
  refresh(){
    scheduleRender();
  },
  destroy(){
    if(state.destroyed){
      return;
    }

    state.destroyed=true;

    if(
      state.renderFrame!==null
    ){
      cancelAnimationFrame(
        state.renderFrame
      );
    }

    document.documentElement
      .classList.remove(
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

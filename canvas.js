(function () {
  'use strict';

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const MAX_CHAT_HISTORY = 40;
  let instanceSeq = 0;

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const dist = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
  const mid = (a, b) => ({
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2
  });

  const icons = {
    delete: `
      <svg viewBox="0 0 20 20" fill="none">
        <path d="M5.5 6.5h9M8 6.5V5h4v1.5M7 8.5v6.5h6V8.5"
          stroke="currentColor" stroke-width="1.5"
          stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M9 9.5v3.5M11 9.5v3.5"
          stroke="currentColor" stroke-width="1.35"
          stroke-linecap="round"/>
      </svg>`,

    toggle: `
      <svg viewBox="0 0 20 20" fill="none">
        <path d="M6 8l4 4 4-4"
          stroke="currentColor" stroke-width="1.6"
          stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`,

    attach: `
      <svg viewBox="0 0 20 20" fill="none">
        <path d="M7.2 10.8l4.7-4.7a2.55 2.55 0 0 1 3.6 3.6l-5.9 5.9a4.05 4.05 0 0 1-5.7-5.7l6-6"
          stroke="currentColor" stroke-width="1.55"
          stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`,

    send: `
      <svg viewBox="0 0 20 20" fill="none">
        <path d="M10 15.5V4.5M5.8 8.7L10 4.5l4.2 4.2"
          stroke="currentColor" stroke-width="1.7"
          stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`,

    add: `
      <svg class="vc-add-node-icon" viewBox="0 0 20 20" fill="none">
        <path d="M10 4v12M4 10h12"
          stroke="currentColor" stroke-width="1.55"
          stroke-linecap="round"/>
      </svg>`
  };

  const waitStyle = `
    .vc-composer.vc-ai-busy{cursor:wait}
    .vc-composer.vc-ai-busy .vc-chat-input{opacity:.62}
    .vc-composer.vc-ai-busy .vc-composer-button{cursor:wait}
    .vc-composer-button:disabled{opacity:.5;cursor:default}

    .vc-ai-spinner{
      display:block;
      width:15px;
      height:15px;
      border:1.7px solid currentColor;
      border-right-color:transparent;
      border-radius:50%;
      animation:vc-ai-spin .72s linear infinite
    }

    @keyframes vc-ai-spin{
      to{transform:rotate(360deg)}
    }

    .vc-composer-wrap{
      position:absolute;
      left:0;
      right:0;
      bottom:0;
      z-index:20;
      display:flex;
      flex-direction:column;
      align-items:center;
      padding:0 0 18px;
      pointer-events:none;
      background:linear-gradient(
        to top,
        color-mix(
          in srgb,
          var(--canvas) 76%,
          transparent
        ) 0,
        color-mix(
          in srgb,
          var(--canvas) 34%,
          transparent
        ) 38%,
        transparent 100%
      );
    }

    .vc-chat-history{
      width:min(calc(100% - 28px),560px);
      max-height:min(38vh,320px);
      margin:0 auto 9px;
      padding:10px 2px 1px;
      overflow-y:auto;
      overflow-x:hidden;
      display:flex;
      flex-direction:column;
      gap:9px;
      scrollbar-width:none;
      pointer-events:auto;
      opacity:0;
      transform:translateY(5px);
      transition:
        opacity .2s ease,
        transform .2s ease;
      mask-image:linear-gradient(
        to bottom,
        transparent 0,
        #000 10px,
        #000 100%
      );
      -webkit-mask-image:linear-gradient(
        to bottom,
        transparent 0,
        #000 10px,
        #000 100%
      );
    }

    .vc-chat-history::-webkit-scrollbar{
      display:none;
    }

    .vc-root.vc-chat-open .vc-chat-history{
      opacity:1;
      transform:none;
    }

    .vc-chat-message{
      display:flex;
      flex-direction:column;
      width:fit-content;
      max-width:88%;
      animation:vc-chat-in .2s ease both;
    }

    .vc-chat-message.user{
      align-self:flex-end;
      align-items:flex-end;
    }

    .vc-chat-message.assistant{
      align-self:flex-start;
      align-items:flex-start;
    }

    .vc-chat-bubble{
      max-width:100%;
      padding:8px 11px;
      border-radius:13px;
      color:var(--text);
      font-size:11px;
      line-height:1.55;
      letter-spacing:-.015em;
      white-space:pre-wrap;
      word-break:keep-all;
    }

    .vc-chat-message.user .vc-chat-bubble{
      background:var(--accent-soft);
      border:1px solid transparent;
      box-shadow:
        0 5px 16px rgba(0,0,0,.045);
    }

    .vc-chat-message.assistant .vc-chat-bubble{
      padding:2px 3px;
      background:transparent;
      border:0;
      box-shadow:none;
    }

    .vc-chat-question{
      margin-top:5px;
      padding-left:4px;
      color:var(--sub);
      font-size:10px;
      line-height:1.45;
      white-space:pre-wrap;
      word-break:keep-all;
    }

    .vc-chat-actions{
      display:flex;
      align-items:center;
      gap:5px;
      margin-top:7px;
      padding-left:3px;
    }

    .vc-chat-run{
      height:25px;
      padding:0 9px;
      border:1px solid var(--border);
      border-radius:8px;
      color:var(--text);
      background:color-mix(
        in srgb,
        var(--glass2) 78%,
        transparent
      );
      font-size:9px;
      font-weight:650;
      letter-spacing:-.01em;
      cursor:pointer;
      transition:
        background .15s ease,
        border-color .15s ease,
        opacity .15s ease,
        transform .15s ease;
      backdrop-filter:blur(16px);
      -webkit-backdrop-filter:blur(16px);
    }

    .vc-chat-run:hover{
      background:var(--soft);
    }

    .vc-chat-run:active{
      transform:translateY(1px);
    }

    .vc-chat-run:disabled{
      cursor:default;
      opacity:.55;
    }

    .vc-chat-message.vc-run-complete
    .vc-chat-run{
      color:var(--sub);
    }

    .vc-chat-message.vc-run-running
    .vc-chat-run{
      color:var(--accent);
      border-color:color-mix(
        in srgb,
        var(--accent) 30%,
        var(--border)
      );
    }

    .vc-chat-message.vc-run-error
    .vc-chat-run{
      color:var(--text);
    }

    .vc-composer{
      width:min(calc(100% - 28px),560px);
      min-height:46px;
      padding:5px;
      display:flex;
      align-items:flex-end;
      gap:4px;
      border:1px solid color-mix(
        in srgb,
        var(--border) 84%,
        transparent
      );
      border-radius:15px;
      background:color-mix(
        in srgb,
        var(--glass2) 84%,
        transparent
      );
      box-shadow:
        0 8px 30px rgba(0,0,0,.07),
        0 1px 2px rgba(0,0,0,.04);
      backdrop-filter:blur(24px);
      -webkit-backdrop-filter:blur(24px);
      pointer-events:auto;
      transition:
        border-color .2s ease,
        box-shadow .2s ease,
        background .2s ease;
    }

    .vc-composer:focus-within{
      border-color:color-mix(
        in srgb,
        var(--accent) 26%,
        var(--border)
      );
      box-shadow:
        0 10px 34px rgba(0,0,0,.08),
        0 0 0 3px
        color-mix(
          in srgb,
          var(--accent) 7%,
          transparent
        );
    }

    .vc-composer-button{
      width:36px;
      height:36px;
      flex:none;
      display:grid;
      place-items:center;
      padding:0;
      border:0;
      border-radius:10px;
      color:var(--sub);
      background:transparent;
      cursor:pointer;
      transition:
        background .15s ease,
        color .15s ease,
        transform .15s ease;
    }

    .vc-composer-button:hover{
      color:var(--text);
      background:var(--soft);
    }

    .vc-composer-button:active{
      transform:scale(.97);
    }

    .vc-composer-button svg{
      width:18px;
      height:18px;
    }

    .vc-send-button{
      color:#fff;
      background:var(--accent);
      box-shadow:
        0 5px 14px
        color-mix(
          in srgb,
          var(--accent) 20%,
          transparent
        );
    }

    .vc-send-button:hover{
      color:#fff;
      background:var(--accent);
    }

    .vc-chat-input{
      min-width:0;
      width:100%;
      max-height:115px;
      padding:9px 3px 9px;
      border:0;
      outline:0;
      resize:none;
      color:var(--text);
      background:transparent;
      font:inherit;
      font-size:11px;
      line-height:1.5;
      letter-spacing:-.015em;
      caret-color:var(--accent);
    }

    .vc-chat-input::placeholder{
      color:var(--faint);
    }

    .vc-file-input{
      display:none;
    }

    .vc-root.vc-chat-focus .vc-composer{
      background:color-mix(
        in srgb,
        var(--glass2) 90%,
        transparent
      );
    }

    .vc-node.vc-running{
      box-shadow:
        0 0 0 1px
        color-mix(
          in srgb,
          var(--accent) 60%,
          transparent
        ),
        0 7px 26px
        color-mix(
          in srgb,
          var(--accent) 14%,
          transparent
        );
    }

    .vc-node.vc-running::after{
      content:'';
      position:absolute;
      inset:-2px;
      border-radius:inherit;
      pointer-events:none;
      opacity:.55;
      background:
        linear-gradient(
          90deg,
          transparent,
          color-mix(
            in srgb,
            var(--accent) 35%,
            transparent
          ),
          transparent
        );
      animation:vc-node-running 1.4s linear infinite;
    }

    @keyframes vc-node-running{
      from{transform:translateX(-35%)}
      to{transform:translateX(35%)}
    }

    @keyframes vc-chat-in{
      from{
        opacity:0;
        transform:translateY(5px);
      }
      to{
        opacity:1;
        transform:translateY(0);
      }
    }

    @media(max-width:600px){
      .vc-composer-wrap{
        height:40vh;
        min-height:220px;
        max-height:430px;
        padding-bottom:
          max(12px,env(safe-area-inset-bottom));
        background:linear-gradient(
          to top,
          color-mix(
            in srgb,
            var(--canvas) 84%,
            transparent
          ) 0,
          color-mix(
            in srgb,
            var(--canvas) 54%,
            transparent
          ) 54%,
          transparent 100%
        );
      }

      .vc-chat-history{
        width:calc(100% - 24px);
        max-height:none;
        flex:1;
        margin-bottom:8px;
      }

      .vc-composer{
        width:calc(100% - 24px);
        border-radius:16px;
      }

      .vc-chat-message{
        max-width:91%;
      }
    }
  `;

  function createStyle() {
    if (document.getElementById('vc-ai-wait-style')) return;

    const style = document.createElement('style');
    style.id = 'vc-ai-wait-style';
    style.textContent = waitStyle;

    document.head.appendChild(style);
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, c => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[c]));
  }

  function svgEl(name, attrs = {}) {
    const el = document.createElementNS(SVG_NS, name);

    for (const [key, value] of Object.entries(attrs)) {
      el.setAttribute(key, value);
    }

    return el;
  }

  function clone(value) {
    try {
      return structuredClone(value);
    } catch {
      return JSON.parse(JSON.stringify(value));
    }
  }

  /*
    Chat history용 snapshot

    일반 workflow clone과 달리
    File 같은 큰 객체는 그대로 참조하고
    실제로 변할 수 있는 params만 얕게 복제한다.

    따라서 같은 파일을 40번 깊은 복사하지 않는다.
  */
  function snapshotWorkflow(workflow) {
    return {
      nodes:
        workflow.nodes.map(node => ({
          ...node,

          data:
            node.data
              ? {
                  ...node.data,

                  ...(node.data.params
                    ? {
                        params: {
                          ...node.data.params
                        }
                      }
                    : {})
                }
              : {}
        })),

      connections:
        workflow.connections.map(connection => ({
          ...connection,

          from: {
            ...connection.from
          },

          to: {
            ...connection.to
          },

          ...(connection.data
            ? {
                data: {
                  ...connection.data
                }
              }
            : {})
        }))
    };
  }

  window.mountVisualCanvas = async function (target, options = {}) {
    if (typeof target === 'string') {
      target = document.querySelector(target);
    }

    if (!(target instanceof Element)) {
      throw new TypeError(
        'target must be a DOM Element or selector'
      );
    }

    target._visualCanvas?.destroy?.();

    const definitions =
      options.nodeDefinitions ||
      await getNodeDefinitions();

    createStyle();

    const uid =
      `vc-${++instanceSeq}-${Math.random().toString(36).slice(2, 7)}`;

    const state = {
      nodes: [],
      connections: [],
      selectedNode: null,

      scale: 1,
      offset: { x: 0, y: 0 },

      pointers: new Map(),
      nodeDrag: null,
      canvasPan: null,
      pinch: null,
      connectionDrag: null,

      expansionAnimation: null,
      rafIds: new Set(),

      destroyed: false,
      addMenuOpen: false,
      validationTimer: null,
      aiBusy: false,

      chatRuns: [],
      pendingChatRun: null,

      execution: {
        status: 'idle',
        chatRunId: null,
        nodeId: null
      }
    };

    const registry = new Map(
      Object.entries(definitions).map(([type, definition]) => [
        type,
        normalizeNodeType(type, definition)
      ])
    );

    const events = new Map();
    const listeners = [];
    const observers = [];

    const root = document.createElement('div');
    root.className = 'vc-root';
    root.dataset.vcInstance = uid;

    root.innerHTML = `
      <div class="vc-canvas">
        <div class="vc-world">
          <svg
            class="vc-svg"
            viewBox="0 0 3000 3000"
            preserveAspectRatio="none"
          >
            <defs>
              <marker
                class="vc-arrow-marker"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto"
              >
                <path
                  d="M1 1L8 5L1 9"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                />
              </marker>
            </defs>

            <g class="vc-connection-layer"></g>
            <g class="vc-drag-connection-layer"></g>
          </svg>

          <div class="vc-nodes"></div>
        </div>
      </div>

      <div class="vc-zoom-indicator">100%</div>
      <div class="vc-validation"></div>

      <div class="vc-top-controls">
        <button
          type="button"
          class="vc-top-button vc-theme-button"
          aria-label="다크 모드"
        >◐</button>

        <button
          type="button"
          class="vc-top-button vc-add-button highB"
          aria-label="노드 추가"
          aria-expanded="false"
        >
          ${icons.add}
        </button>
      </div>

      <div class="vc-add-menu"></div>

      <div class="vc-composer-wrap">

        <div
          class="vc-chat-history"
          aria-live="polite"
          aria-label="Workflow 대화"
        ></div>

        <form class="vc-composer">

          <button
            type="button"
            class="vc-composer-button vc-attach-button"
            aria-label="파일 추가"
          >
            ${icons.attach}
          </button>

          <textarea
            rows="1"
            class="vc-chat-input"
            placeholder="무엇을 만들까요?"
          ></textarea>

          <button
            type="submit"
            class="vc-composer-button vc-send-button highB"
            aria-label="보내기"
          >
            ${icons.send}
          </button>
        </form>

        <input
          class="vc-file-input"
          type="file"
          multiple
          hidden
        >
      </div>
    `;

    target.appendChild(root);
    target._visualCanvas = null;

    const $ = selector => root.querySelector(selector);
    const $$ = selector => [...root.querySelectorAll(selector)];

    const canvas = $('.vc-canvas');
    const world = $('.vc-world');
    const nodesLayer = $('.vc-nodes');

    const connectionLayer = $('.vc-connection-layer');
    const dragConnectionLayer = $('.vc-drag-connection-layer');

    const zoomIndicator = $('.vc-zoom-indicator');
    const validationLayer = $('.vc-validation');

    const addButton = $('.vc-add-button');
    const addMenu = $('.vc-add-menu');
    const themeButton = $('.vc-theme-button');

    const chatForm = $('.vc-composer');
    const chatInput = $('.vc-chat-input');
    const attachButton = $('.vc-attach-button');
    const fileInput = $('.vc-file-input');
    const chatHistory = $('.vc-chat-history');

    const markerId = `${uid}-arrow`;
    $('.vc-arrow-marker').setAttribute('id', markerId);

    const nodeResizeObserver =
      new ResizeObserver(entries => {
        for (const entry of entries) {
          const node = getNode(
            entry.target.dataset.nodeId
          );

          if (node) {
            positionPorts(
              entry.target,
              getNodeType(node)
            );
          }
        }

        renderConnections();
      });

    function on(event, handler) {
      if (typeof handler !== 'function') {
        return () => {};
      }

      if (!events.has(event)) {
        events.set(event, new Set());
      }

      events.get(event).add(handler);

      return () => off(event, handler);
    }

    function off(event, handler) {
      events.get(event)?.delete(handler);
    }

    function emit(event, payload) {
      for (const fn of events.get(event) || []) {
        try {
          fn(payload, api);
        } catch (error) {
          console.error(error);
        }
      }
    }

    function listen(el, type, fn, opts) {
      el.addEventListener(type, fn, opts);
      listeners.push(
        () => el.removeEventListener(type, fn, opts
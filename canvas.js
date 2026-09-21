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
    .vc-composer-button:disabled{opacity:.55}

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

    .vc-chat-history{
      width:min(calc(100% - 28px),560px);
      height:100%;
      margin:0 auto 10px;
      overflow-y:auto;
      overflow-x:hidden;
      display:flex;
      flex-direction:column;
      gap:7px;
      scrollbar-width:none;
      pointer-events:auto;
    }

    .vc-chat-history::-webkit-scrollbar{
      display:none;
    }

    .vc-chat-message{
      display:flex;
      flex-direction:column;
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
      padding:9px 11px;
      border:1px solid var(--border);
      border-radius:13px;
      color:var(--text);
      font-size:11px;
      line-height:1.5;
      letter-spacing:-.015em;
      white-space:pre-wrap;
      word-break:keep-all;
      background:var(--glass2);
      box-shadow:0 6px 20px rgba(0,0,0,.055);
      backdrop-filter:blur(18px);
      -webkit-backdrop-filter:blur(18px);
    }

    .vc-chat-message.user .vc-chat-bubble{
      color:white;
      background:var(--accent);
      border-color:transparent;
      opacity:0.75
    }

    .vc-chat-question{
      margin-top:5px;
      padding-left:2px;
      color:var(--sub);
      font-size:10px;
      line-height:1.45;
      white-space:pre-wrap;
      word-break:keep-all;
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
  `;

  function createStyle() {
    //return; //비활성함
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
      pendingChatRun: null
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
        () => el.removeEventListener(type, fn, opts)
      );
    }

    function raf(fn) {
      const id = requestAnimationFrame(t => {
        state.rafIds.delete(id);

        if (!state.destroyed) {
          fn(t);
        }
      });

      state.rafIds.add(id);
      return id;
    }

    function getNode(id) {
      return state.nodes.find(
        node => node.id === id
      ) || null;
    }

    function getNodeElement(id) {
      return nodesLayer.querySelector(
        `.vc-node[data-node-id="${CSS.escape(String(id))}"]`
      );
    }

    function getNodeType(node) {
      return node
        ? registry.get(node.type) || null
        : null;
    }

    function screenToWorld(x, y) {
      return {
        x: (x - state.offset.x) / state.scale,
        y: (y - state.offset.y) / state.scale
      };
    }

    function renderTransform() {
      world.style.transform =
        `translate(${state.offset.x}px,${state.offset.y}px) ` +
        `scale(${state.scale})`;

      zoomIndicator.textContent =
        `${Math.round(state.scale * 100)}%`;
    }

    function connectionKey(connection) {
      return [
        connection.from.node,
        connection.from.port,
        connection.to.node,
        connection.to.port
      ].join(':');
    }

    function portDef(nodeId, portId, direction) {
      const type = getNodeType(getNode(nodeId));
      if (!type) return null;

      const ports =
        direction === 'input'
          ? type.inputs
          : type.outputs;

      return ports.find(
        port => String(port.id) === String(portId)
      ) || null;
    }

    function portEl(nodeId, portId, direction) {
      return nodesLayer.querySelector(
        `.vc-port-hit[data-node-id="${CSS.escape(String(nodeId))}"]` +
        `[data-port-id="${CSS.escape(String(portId))}"]` +
        `[data-port-dir="${direction}"]`
      );
    }

    function portPoint(nodeId, portId, direction) {
      const element =
        portEl(nodeId, portId, direction);

      if (!element) return null;

      const anchor =
        element.querySelector('.vc-port-anchor') ||
        element;

      const rect = anchor.getBoundingClientRect();
      const canvasRect =
        canvas.getBoundingClientRect();

      return {
        x:
          (
            rect.left +
            rect.width / 2 -
            canvasRect.left -
            state.offset.x
          ) / state.scale,

        y:
          (
            rect.top +
            rect.height / 2 -
            canvasRect.top -
            state.offset.y
          ) / state.scale
      };
    }

    function curve(a, b) {
      const dx = b.x - a.x;

      const bend = clamp(
        Math.abs(dx) * .22 +
        Math.abs(b.y - a.y) * .05,
        28,
        85
      );

      return `
        M ${a.x} ${a.y}
        C ${a.x + bend} ${a.y},
          ${b.x - bend} ${b.y},
          ${b.x} ${b.y}
      `.replace(/\s+/g, ' ');
    }

    function normalizePort(port, index, direction) {
      return {
        ...port,

        id: String(
          port.id ??
          `${direction}-${index}`
        ),

        name:
          port.name ??
          port.id,

        type:
          port.type ||
          'any',

        required:
          !!port.required,

        multiple:
          port.multiple !== false,

        accepts:
          Array.isArray(port.accepts) &&
          port.accepts.length
            ? [...port.accepts]
            : ['any']
      };
    }

    function normalizeNodeType(type, definition) {
      const d = {
        ...(definition || {})
      };

      d.inputs = (d.inputs || [])
        .map((port, i) =>
          normalizePort(
            port,
            i,
            'input'
          )
        );

      d.outputs = (d.outputs || [])
        .map((port, i) =>
          normalizePort(
            port,
            i,
            'output'
          )
        );

      d.params =
        Array.isArray(d.params)
          ? d.params
          : [];

      d.slots = {
        description: true,
        param: true,
        body: true,
        footer: true,
        ...(d.slots || {})
      };

      d.tag =
        d.tag ||
        type.toUpperCase();

      d.color =
        d.color ||
        '#888';

      d.icon =
        typeof d.icon === 'string'
          ? d.icon
          : '';

      return d;
    }

    function renderSlotContent(node, type) {
      const body = [];

      if (
        type.slots.description !== false &&
        (type.desc || type.description)
      ) {
        body.push(`
          <div class="vc-slot-description">
            ${escapeHtml(
              type.desc ||
              type.description ||
              ''
            )}
          </div>
        `);
      }

      if (
        type.slots.param !== false &&
        Array.isArray(type.params)
      ) {
        const values =
          node.data?.params || {};

        for (const param of type.params) {
          body.push(`
            <div class="vc-param-group">
              <label class="vc-param-label">
                ${escapeHtml(
                  param.name ||
                  param.id
                )}
              </label>

              <input
                class="vc-slot-param"
                type="text"
                data-param-id="${escapeHtml(param.id)}"
                value="${escapeHtml(values[param.id] ?? '')}"
                placeholder="${escapeHtml(param.placeholder || '')}"
              >
            </div>
          `);
        }
      }

      if (node.type === 'file') {
        const mime =
          node.data?.mime ||
          '알 수 없는 형식';

        const size =
          Number(node.data?.size || 0);

        const sizeText =
          size < 1024
            ? `${size} B`
            : size < 1024 * 1024
              ? `${(size / 1024).toFixed(1)} KB`
              : `${(size / 1024 / 1024).toFixed(1)} MB`;

        body.push(`
          <div class="vc-slot-custom">
            <div class="vc-file-meta">
              <span>${escapeHtml(mime)}</span>
              <span>${escapeHtml(sizeText)}</span>
            </div>
          </div>
        `);
      }

      if (
        type.slots.footer !== false &&
        type.footer
      ) {
        body.push(`
          <div class="vc-slot-custom">
            ${
              typeof type.footer === 'function'
                ? (
                    type.footer(node, {
                      node,
                      type,
                      instance: api
                    }) || ''
                  )
                : type.footer
            }
          </div>
        `);
      }

      return body.join('');
    }

    function renderPorts(node, ports, direction) {
      const className =
        direction === 'input'
          ? 'vc-input'
          : 'vc-output';

      return ports.map(port => `
        <div
          class="vc-port-hit ${className}"
          data-port-dir="${direction}"
          data-port-id="${escapeHtml(port.id)}"
          data-node-id="${escapeHtml(node.id)}"
        >
          <span class="vc-port-anchor">
            <span class="vc-port-pill"></span>
          </span>

          <span class="vc-port-label">
            ${escapeHtml(port.name)}
          </span>
        </div>
      `).join('');
    }

    function renderNodes() {
      nodeResizeObserver.disconnect();

      nodesLayer.textContent = '';

      for (const node of state.nodes) {
        const type = getNodeType(node);

        if (!type) continue;

        const el = document.createElement('div');

        const isImageFile =
          node.type === 'file' &&
          node.data?.mime?.startsWith('image/');

        el.className =
          'vc-node' +
          (node.type === 'start'
            ? ' vc-start-node'
            : '') +
          (node.type === 'file'
            ? ' vc-file-node'
            : '') +
          (isImageFile
            ? ' vc-image-file-node'
            : '') +
          (node.id === state.selectedNode
            ? ' vc-selected'
            : '') +
          (node.expanded
            ? ' vc-expanded'
            : '');

        if (
          isImageFile &&
          node.data?.previewUrl
        ) {
          el.style.setProperty(
            '--vc-file-bg',
            `url("${node.data.previewUrl}")`
          );
        }

        el.dataset.nodeId = node.id;
        el.style.left = `${node.x}px`;
        el.style.top = `${node.y}px`;
        el.style.setProperty(
          '--node-color',
          type.color
        );

        const fileName =
          node.type === 'file'
            ? node.data?.name ||
              '이름 없는 파일'
            : type.name;

        const fileExt =
          node.type === 'file' &&
          fileName.includes('.')
            ? fileName
                .split('.')
                .pop()
                .toUpperCase()
            : 'FILE';

        el.innerHTML = `
          <div class="vc-node-head">

            <span class="vc-node-icon">
              ${type.icon || ''}
            </span>

            ${
              node.type === 'file'
                ? `
                  <span class="vc-file-title-wrap">
                    <span
                      class="vc-file-title"
                      title="${escapeHtml(fileName)}"
                    >
                      ${escapeHtml(fileName)}
                    </span>

                    <span class="vc-file-type">
                      ${escapeHtml(fileExt)}
                    </span>
                  </span>
                `
                : `
                  <span class="vc-node-title">
                    ${escapeHtml(
                      type.name ||
                      node.type
                    )}
                  </span>
                `
            }

            ${
              node.type === 'start'
                ? `
                  <span class="vc-start-badge">
                    START
                  </span>
                `
                : ''
            }

            <div class="vc-node-actions">
              <button
                type="button"
                class="vc-node-action vc-node-toggle"
                data-action="toggle"
                aria-label="${
                  node.expanded
                    ? '상세 내용 닫기'
                    : '상세 내용 열기'
                }"
                aria-expanded="${!!node.expanded}"
              >
                ${icons.toggle}
              </button>
            </div>

          </div>

          <div class="vc-node-body">
            ${renderSlotContent(node, type)}
          </div>

          ${
            node.type !== 'start'
              ? `
                <div class="vc-node-footer">
                  <button
                    type="button"
                    class="vc-node-delete"
                    data-action="delete"
                    aria-label="노드 삭제"
                  >
                    ${icons.delete}
                    <span>삭제하기</span>
                  </button>
                </div>
              `
              : ''
          }

          ${renderPorts(
            node,
            type.inputs || [],
            'input'
          )}

          ${renderPorts(
            node,
            type.outputs || [],
            'output'
          )}
        `;

        nodesLayer.appendChild(el);
        positionPorts(el, type);
        nodeResizeObserver.observe(el);

        setNodeExpanded(
          el,
          !!node.expanded,
          true
        );
      }

      markConnectedPorts();
      raf(renderConnections);
    }

    function positionPorts(nodeEl, type) {
      if (!type) return;

      const height =
        Math.max(
          50,
          nodeEl.offsetHeight
        );

      const place = (
        selector,
        ports
      ) => {
        const elements =
          [...nodeEl.querySelectorAll(selector)];

        const count =
          Math.max(
            1,
            ports.length
          );

        elements.forEach(
          (el, index) => {
            const y =
              ((index + 1) /
                (count + 1)) *
              height;

            el.style.height = '32px';
            el.style.top = `${y - 16}px`;
            el.dataset.portId =
              ports[index].id;
          }
        );
      };

      place(
        '.vc-port-hit.vc-input',
        type.inputs || []
      );

      place(
        '.vc-port-hit.vc-output',
        type.outputs || []
      );
    }

    function markConnectedPorts() {
      for (const connection of state.connections) {
        portEl(
          connection.from.node,
          connection.from.port,
          'output'
        )
          ?.querySelector('.vc-port-pill')
          ?.classList.add('vc-connected');

        portEl(
          connection.to.node,
          connection.to.port,
          'input'
        )
          ?.querySelector('.vc-port-pill')
          ?.classList.add('vc-connected');
      }
    }

    function renderConnections() {
      connectionLayer.textContent = '';

      for (const connection of state.connections) {
        const a = portPoint(
          connection.from.node,
          connection.from.port,
          'output'
        );

        const b = portPoint(
          connection.to.node,
          connection.to.port,
          'input'
        );

        if (!a || !b) continue;

        const active =
          state.selectedNode ===
            connection.from.node ||
          state.selectedNode ===
            connection.to.node;

        const path = svgEl(
          'path',
          {
            d: curve(a, b),
            ...(active
              ? {
                  class: 'vc-connection vc-active'
                }
              : {
                  class: 'vc-connection'
                })
          }
        );

        if (active) {
          const node =
            getNode(
              state.selectedNode ===
                connection.from.node
                ? connection.from.node
                : connection.to.node
            );

          const type =
            getNodeType(node);

          if (type?.color) {
            path.style.stroke =
              type.color;
          }
        }

        connectionLayer.appendChild(path);

        if (!active) {
          connectionLayer.appendChild(
            svgEl('circle', {
              cx: a.x,
              cy: a.y,
              r: 2.8,
              class:
                'vc-connection-dot'
            })
          );

          connectionLayer.appendChild(
            svgEl('circle', {
              cx: b.x,
              cy: b.y,
              r: 2.8,
              class:
                'vc-connection-dot'
            })
          );
        }
      }

      if (state.connectionDrag) {
        renderDragConnection();
      }
    }

    function trackExpansion() {
      if (state.expansionAnimation) {
        cancelAnimationFrame(
          state.expansionAnimation
        );
      }

      const start = performance.now();
      const duration = 340;

      const tick = now => {
        renderConnections();

        if (now - start < duration) {
          state.expansionAnimation =
            requestAnimationFrame(tick);
        } else {
          state.expansionAnimation =
            null;
        }
      };

      state.expansionAnimation =
        requestAnimationFrame(tick);
    }

    function setNodeExpanded(
      element,
      expanded,
      immediate = false
    ) {
      const node =
        getNode(
          element?.dataset.nodeId
        );

      if (!element || !node) return;

      const body =
        element.querySelector(
          '.vc-node-body'
        );

      const toggle =
        element.querySelector(
          '.vc-node-toggle'
        );

      const type =
        getNodeType(node);

      node.expanded = expanded;

      element.classList.toggle(
        'vc-expanded',
        expanded
      );

      toggle?.setAttribute(
        'aria-expanded',
        String(expanded)
      );

      toggle?.setAttribute(
        'aria-label',
        expanded
          ? '상세 내용 닫기'
          : '상세 내용 열기'
      );

      const finish = () => {
        positionPorts(
          element,
          type
        );

        renderConnections();
      };

      if (immediate) {
        body.style.transition = 'none';
        element.style.transition = 'none';

        if (expanded) {
          element.style.height = 'auto';
          body.style.height = 'auto';
        } else {
          const head =
            element.querySelector(
              '.vc-node-head'
            );

          const collapsedHeight =
            head.offsetHeight + 20;

          body.style.height = '0px';
          element.style.height =
            `${collapsedHeight}px`;
        }

        positionPorts(
          element,
          type
        );

        raf(() => {
          body.style.transition = '';
          element.style.transition = '';
          finish();
        });

        return;
      }

      if (expanded) {
        element.style.height = 'auto';
        body.style.height = '0px';

        void element.offsetHeight;

        const targetHeight =
          body.scrollHeight;

        raf(() => {
          body.style.height =
            `${targetHeight}px`;

          trackExpansion();

          const end = event => {
            if (
              event.propertyName !==
              'height'
            ) {
              return;
            }

            body.removeEventListener(
              'transitionend',
              end
            );

            if (!node.expanded) return;

            body.style.height = 'auto';
            finish();
          };

          body.addEventListener(
            'transitionend',
            end
          );
        });

        return;
      }

      const currentHeight =
        body.scrollHeight;

      body.style.height =
        `${currentHeight}px`;

      element.style.height = 'auto';

      void element.offsetHeight;

      raf(() => {
        body.style.height = '0px';

        trackExpansion();

        const end = event => {
          if (
            event.propertyName !==
            'height'
          ) {
            return;
          }

          body.removeEventListener(
            'transitionend',
            end
          );

          if (node.expanded) return;

          element.style.height = 'auto';
          finish();
        };

        body.addEventListener(
          'transitionend',
          end
        );
      });
    }

    function uniqueId(prefix = 'n') {
      let id;

      do {
        id =
          `${prefix}${Date.now().toString(36)}` +
          `${Math.random()
            .toString(36)
            .slice(2, 7)}`;
      } while (getNode(id));

      return id;
    }

    function normalizeNode(input) {
      return {
        id: String(
          input.id ||
          uniqueId()
        ),

        type: String(
          input.type
        ),

        x:
          Number(input.x) || 0,

        y:
          Number(input.y) || 0,

        expanded:
          !!input.expanded,

        data:
          clone(input.data || {})
      };
    }

    function findNewNodePosition() {
      const rect =
        canvas.getBoundingClientRect();

      const mobile =
        window.innerWidth <= 600;

      const width =
        mobile ? 178 : 190;

      const margin = 28;

      const minX =
        (margin - state.offset.x) /
        state.scale;

      const minY =
        (margin - state.offset.y) /
        state.scale;

      const maxX =
        (
          rect.width -
          margin -
          width * state.scale -
          state.offset.x
        ) / state.scale;

      const maxY =
        (
          rect.height -
          115 -
          width * .4 * state.scale -
          state.offset.y
        ) / state.scale;

      const centerX =
        (minX + maxX) / 2;

      const centerY =
        (minY + maxY) / 2;

      const gap = 24;
      const h = 54;

      const spots = [
        [0, 0],
        [0, h + gap],
        [0, -h - gap],
        [-width - gap, 0],
        [width + gap, 0]
      ].map(([dx, dy]) => ({
        x:
          centerX -
          width / 2 +
          dx,

        y:
          centerY -
          h / 2 +
          dy
      }));

      return (
        spots.find(
          p =>
            p.x >= minX &&
            p.x <= maxX &&
            p.y >= minY &&
            p.y <= maxY &&
            !state.nodes.some(node =>
              Math.abs(node.x - p.x) <
                width + gap &&
              Math.abs(node.y - p.y) <
                h + gap
            )
        ) || {
          x: clamp(
            centerX - width / 2,
            minX,
            maxX
          ),

          y: clamp(
            centerY - h / 2,
            minY,
            maxY
          )
        }
      );
    }

    function addNode(
      type,
      nodeData = {}
    ) {
      if (!registry.has(type)) {
        throw new Error(
          `Unknown node type: ${type}`
        );
      }

      if (type === 'start') {
        const existing =
          state.nodes.find(
            node =>
              node.type === 'start'
          );

        if (existing) {
          selectNode(existing.id);
          closeAddMenu();
          return existing;
        }
      }

      const position =
        nodeData.x != null &&
        nodeData.y != null
          ? {
              x: Number(nodeData.x),
              y: Number(nodeData.y)
            }
          : findNewNodePosition();

      const node =
        normalizeNode({
          id:
            nodeData.id ||
            uniqueId(),

          type,

          x:
            position.x,

          y:
            position.y,

          expanded:
            true,

          data:
            nodeData.data
        });

      state.nodes.push(node);
      state.selectedNode = node.id;

      render();
      closeAddMenu();
      emit('change', getWorkflow());

      return node;
    }

    function removeNode(id) {
      const node = getNode(id);

      if (
        !node ||
        node.type === 'start'
      ) {
        return false;
      }

      state.connections =
        state.connections.filter(
          connection =>
            connection.from.node !== id &&
            connection.to.node !== id
        );

      const index =
        state.nodes.findIndex(
          node =>
            node.id === id
        );

      if (index < 0) {
        return false;
      }

      state.nodes.splice(index, 1);

      if (
        state.selectedNode === id
      ) {
        state.selectedNode = null;
      }

      render();
      emit('change', getWorkflow());

      return true;
    }

    function setNodePosition(
      node,
      x,
      y
    ) {
      node.x = x;
      node.y = y;

      const element =
        getNodeElement(node.id);

      if (element) {
        element.style.left =
          `${x}px`;

        element.style.top =
          `${y}px`;
      }

      renderConnections();
      emit('change', getWorkflow());
    }

    function selectNode(id) {
      if (
        id !== null &&
        !getNode(id)
      ) {
        id = null;
      }

      state.selectedNode = id;

      $$('.vc-node').forEach(
        element =>
          element.classList.toggle(
            'vc-selected',
            element.dataset.nodeId === id
          )
      );

      renderConnections();
      updateComposerState();

      emit('select', id);
    }

    function toggleNodeExpanded(id) {
      const node = getNode(id);
      const element =
        getNodeElement(id);

      if (!node || !element) return;

      setNodeExpanded(
        element,
        !node.expanded
      );

      selectNode(id);
      emit('change', getWorkflow());
    }

    function wouldCreateCycle(
      fromId,
      toId
    ) {
      if (fromId === toId) return true;

      const graph = new Map();

      for (const connection of state.connections) {
        if (!graph.has(connection.from.node)) {
          graph.set(
            connection.from.node,
            []
          );
        }

        graph
          .get(connection.from.node)
          .push(connection.to.node);
      }

      const stack = [toId];
      const seen = new Set();

      while (stack.length) {
        const current =
          stack.pop();

        if (current === fromId) {
          return true;
        }

        if (seen.has(current)) {
          continue;
        }

        seen.add(current);

        for (
          const next of
            graph.get(current) || []
        ) {
          stack.push(next);
        }
      }

      return false;
    }

    function portsCompatible(
      output,
      input
    ) {
      if (!output || !input) {
        return false;
      }

      const accepts =
        Array.isArray(input.accepts)
          ? input.accepts
          : ['any'];

      return (
        accepts.includes('any') ||
        accepts.includes(output.type) ||
        output.type === 'any'
      );
    }

    function connectionValid(
      fromNodeId,
      fromPortId,
      toNodeId,
      toPortId
    ) {
      const errors = [];
      const warnings = [];

      if (
        fromNodeId ===
        toNodeId
      ) {
        errors.push({
          code: 'SELF_CONNECTION',
          message:
            '노드는 자기 자신에게 연결할 수 없습니다.'
        });
      }

      const source =
        getNode(fromNodeId);

      const target =
        getNode(toNodeId);

      if (!source) {
        errors.push({
          code:
            'MISSING_SOURCE_NODE',
          message:
            `출발 노드 ${fromNodeId}가 존재하지 않습니다.`
        });
      }

      if (!target) {
        errors.push({
          code:
            'MISSING_TARGET_NODE',
          message:
            `대상 노드 ${toNodeId}가 존재하지 않습니다.`
        });
      }

      const output =
        portDef(
          fromNodeId,
          fromPortId,
          'output'
        );

      const input =
        portDef(
          toNodeId,
          toPortId,
          'input'
        );

      if (!output) {
        errors.push({
          code:
            'MISSING_SOURCE_PORT',
          message:
            `출력 포트 ${fromPortId}가 존재하지 않습니다.`
        });
      }

      if (!input) {
        errors.push({
          code:
            'MISSING_TARGET_PORT',
          message:
            `입력 포트 ${toPortId}가 존재하지 않습니다.`
        });
      }

      if (errors.length) {
        return {
          ok: false,
          errors,
          warnings
        };
      }

      if (
        state.connections.some(
          connection =>
            connection.from.node === fromNodeId &&
            connection.from.port === fromPortId &&
            connection.to.node === toNodeId &&
            connection.to.port === toPortId
        )
      ) {
        errors.push({
          code:
            'DUPLICATE_CONNECTION',
          message:
            '동일한 연결이 이미 존재합니다.'
        });
      }

      const incoming =
        state.connections.filter(
          connection =>
            connection.to.node === toNodeId &&
            connection.to.port === toPortId
        );

      if (
        !input.multiple &&
        incoming.length
      ) {
        errors.push({
          code:
            'INPUT_MULTIPLE',
          message:
            `입력 포트 ${input.name}은 하나의 연결만 허용합니다.`
        });
      }

      if (
        !portsCompatible(
          output,
          input
        )
      ) {
        errors.push({
          code:
            'TYPE_MISMATCH',
          message:
            `${output.type} → ${input.type} 타입을 연결할 수 없습니다.`
        });
      }

      if (
        wouldCreateCycle(
          fromNodeId,
          toNodeId
        )
      ) {
        errors.push({
          code:
            'CYCLE',
          message:
            '이 연결은 순환 구조(Cycle)를 만듭니다.'
        });
      }

      return {
        ok: !errors.length,
        errors,
        warnings
      };
    }

    function canConnect(
      specification
    ) {
      const result =
        connectionValid(
          specification.from.node,
          specification.from.port,
          specification.to.node,
          specification.to.port
        );

      emit(
        'validate',
        result
      );

      return result;
    }

    function uniqueConnectionId() {
      let id;

      do {
        id =
          `c${Date.now().toString(36)}` +
          Math.random()
            .toString(36)
            .slice(2, 7);
      } while (
        state.connections.some(
          connection =>
            connection.id === id
        )
      );

      return id;
    }

    function connect(
      from,
      to,
      options = {}
    ) {
      const specification = {
        from: {
          node: from.node,
          port: from.port
        },

        to: {
          node: to.node,
          port: to.port
        }
      };

      const duplicate =
        state.connections.find(
          connection =>
            connection.from.node ===
              specification.from.node &&
            connection.from.port ===
              specification.from.port &&
            connection.to.node ===
              specification.to.node &&
            connection.to.port ===
              specification.to.port
        );

      if (duplicate) {
        disconnect(duplicate.id);
        return null;
      }

      const check =
        canConnect(
          specification
        );

      if (!check.ok) {
        showValidation(
          check.errors,
          check.warnings
        );

        return null;
      }

      const connection = {
        id:
          uniqueConnectionId(),

        from:
          specification.from,

        to:
          specification.to
      };

      if (options.data) {
        connection.data =
          clone(options.data);
      }

      state.connections.push(
        connection
      );

      render();

      emit(
        'connect',
        connection
      );

      emit(
        'change',
        getWorkflow()
      );

      return connection;
    }

    function disconnect(id) {
      const index =
        state.connections.findIndex(
          connection =>
            connection.id === id
        );

      if (index < 0) {
        return false;
      }

      state.connections.splice(
        index,
        1
      );

      render();

      emit(
        'change',
        getWorkflow()
      );

      return true;
    }

    function validate() {
      const errors = [];
      const warnings = [];
      const ids = new Set();

      for (const node of state.nodes) {
        if (ids.has(node.id)) {
          errors.push({
            code:
              'DUPLICATE_NODE_ID',

            node:
              node.id,

            message:
              `노드 ID ${node.id}가 중복됩니다.`
          });
        }

        ids.add(node.id);

        if (!registry.has(node.type)) {
          errors.push({
            code:
              'UNKNOWN_NODE_TYPE',

            node:
              node.id,

            message:
              `노드 타입 ${node.type}이 등록되어 있지 않습니다.`
          });
        }
      }

      const nodeSet =
        new Set(
          state.nodes.map(
            node =>
              node.id
          )
        );

      const connectionKeys =
        new Set();

      for (const connection of state.connections) {
        if (!nodeSet.has(connection.from.node)) {
          errors.push({
            code:
              'MISSING_SOURCE_NODE',

            connection:
              connection.id,

            message:
              `연결 ${connection.id}의 출발 노드가 없습니다.`
          });
        }

        if (!nodeSet.has(connection.to.node)) {
          errors.push({
            code:
              'MISSING_TARGET_NODE',

            connection:
              connection.id,

            message:
              `연결 ${connection.id}의 대상 노드가 없습니다.`
          });
        }

        if (
          connection.from.node ===
          connection.to.node
        ) {
          errors.push({
            code:
              'SELF_CONNECTION',

            connection:
              connection.id,

            message:
              `연결 ${connection.id}가 자기 자신을 가리킵니다.`
          });
        }

        const key =
          connectionKey(
            connection
          );

        if (connectionKeys.has(key)) {
          errors.push({
            code:
              'DUPLICATE_CONNECTION',

            connection:
              connection.id,

            message:
              `연결 ${connection.id}가 중복됩니다.`
          });
        }

        connectionKeys.add(key);

        const output =
          portDef(
            connection.from.node,
            connection.from.port,
            'output'
          );

        const input =
          portDef(
            connection.to.node,
            connection.to.port,
            'input'
          );

        if (!output) {
          errors.push({
            code:
              'MISSING_SOURCE_PORT',

            connection:
              connection.id,

            message:
              `연결 ${connection.id}의 출력 포트가 없습니다.`
          });
        }

        if (!input) {
          errors.push({
            code:
              'MISSING_TARGET_PORT',

            connection:
              connection.id,

            message:
              `연결 ${connection.id}의 입력 포트가 없습니다.`
          });
        }

        if (
          output &&
          input &&
          !portsCompatible(
            output,
            input
          )
        ) {
          errors.push({
            code:
              'TYPE_MISMATCH',

            connection:
              connection.id,

            message:
              `${output.type} → ${input.type} 타입이 호환되지 않습니다.`
          });
        }
      }

      for (const node of state.nodes) {
        const type =
          getNodeType(node);

        if (!type) continue;

        for (const port of type.inputs) {
          const incoming =
            state.connections.filter(
              connection =>
                connection.to.node === node.id &&
                connection.to.port === port.id
            );

          if (
            port.required &&
            !incoming.length
          ) {
            errors.push({
              code:
                'REQUIRED_INPUT',

              node:
                node.id,

              port:
                port.id,

              message:
                `${type.name}의 필수 입력 '${port.name}'이 연결되지 않았습니다.`
            });
          }

          if (
            !port.multiple &&
            incoming.length > 1
          ) {
            errors.push({
              code:
                'INPUT_MULTIPLE',

              node:
                node.id,

              port:
                port.id,

              message:
                `${type.name}의 '${port.name}'은 단일 입력만 허용합니다.`
            });
          }
        }
      }

      const connectedNodes =
        new Set();

      for (const connection of state.connections) {
        connectedNodes.add(
          connection.from.node
        );

        connectedNodes.add(
          connection.to.node
        );
      }

      const starts =
        state.nodes.filter(
          node =>
            node.type === 'start'
        );

      for (const node of state.nodes) {
        if (
          node.type !== 'start' &&
          !connectedNodes.has(node.id)
        ) {
          warnings.push({
            code:
              'ISOLATED_NODE',

            node:
              node.id,

            message:
              `노드 '${getNodeType(node)?.name || node.type}'가 그래프와 연결되지 않았습니다.`
          });
        }
      }

      if (!starts.length) {
        warnings.push({
          code:
            'NO_START_NODE',

          message:
            '시작 노드가 없습니다.'
        });
      }

      if (starts.length > 1) {
        warnings.push({
          code:
            'MULTIPLE_START_NODE',

          message:
            '시작 노드가 여러 개입니다.'
        });
      }

      const graph = new Map();

      for (const connection of state.connections) {
        if (!graph.has(connection.from.node)) {
          graph.set(
            connection.from.node,
            []
          );
        }

        graph
          .get(connection.from.node)
          .push(connection.to.node);
      }

      const visiting = new Set();
      const visited = new Set();
      const cycleNodes = new Set();

      function dfs(node) {
        if (visiting.has(node)) {
          cycleNodes.add(node);
          return true;
        }

        if (visited.has(node)) {
          return false;
        }

        visiting.add(node);

        let found = false;

        for (
          const next of
            graph.get(node) || []
        ) {
          if (dfs(next)) {
            found = true;
            cycleNodes.add(node);
          }
        }

        visiting.delete(node);
        visited.add(node);

        return found;
      }

      for (const node of state.nodes) {
        if (!visited.has(node.id)) {
          dfs(node.id);
        }
      }

      if (cycleNodes.size) {
        errors.push({
          code:
            'CYCLE',

          nodes:
            [...cycleNodes],

          message:
            '워크플로우에 순환 구조(Cycle)가 존재합니다.'
        });
      }

      const result = {
        valid: !errors.length,
        errors,
        warnings
      };

      emit(
        'validate',
        result
      );

      return result;
    }

    function getWorkflow() {
      return {
        nodes:
          clone(state.nodes),

        connections:
          clone(state.connections)
      };
    }

    function getState() {
      return {
        workflow:
          getWorkflow(),

        viewport: {
          scale:
            state.scale,

          offset: {
            ...state.offset
          }
        },

        chatRuns:
          clone(
            state.chatRuns
          )
      };
    }

    function setState(saved = {}) {
      const workflow =
        saved.workflow ||
        saved;

      state.nodes =
        Array.isArray(workflow.nodes)
          ? workflow.nodes
              .map(normalizeNode)
              .filter(node =>
                registry.has(node.type)
              )
          : [];

      state.connections =
        Array.isArray(
          workflow.connections
        )
          ? clone(
              workflow.connections
            ).map(connection => ({
              id:
                String(
                  connection.id ||
                  uniqueConnectionId()
                ),

              from: {
                node:
                  String(
                    connection.from?.node ??
                    connection.from ??
                    ''
                  ),

                port:
                  String(
                    connection.from?.port ??
                    'out'
                  )
              },

              to: {
                node:
                  String(
                    connection.to?.node ??
                    connection.to ??
                    ''
                  ),

                port:
                  String(
                    connection.to?.port ??
                    'in'
                  )
              },

              ...(connection.data
                ? {
                    data:
                      clone(
                        connection.data
                      )
                  }
                : {})
            }))
          : [];

      if (saved.viewport) {
        state.scale =
          clamp(
            Number(
              saved.viewport.scale
            ) || 1,
            .12,
            3
          );

        state.offset = {
          x:
            Number(
              saved.viewport.offset?.x
            ) || 0,

          y:
            Number(
              saved.viewport.offset?.y
            ) || 0
        };
      }

      if (
        Array.isArray(
          saved.chatRuns
        )
      ) {
        state.chatRuns =
          clone(
            saved.chatRuns
          ).slice(
            -MAX_CHAT_HISTORY
          );
      }

      state.pendingChatRun =
        null;

      state.selectedNode = null;

      render();

      emit(
        'change',
        getWorkflow()
      );

      return api;
    }

    function showValidation(
      errors = [],
      warnings = []
    ) {
      validationLayer.textContent = '';

      const items = [
        ...errors.slice(0, 3).map(
          item => ({
            cls:
              'vc-error',

            text:
              item.message
          })
        ),

        ...warnings.slice(0, 2).map(
          item => ({
            cls:
              'vc-warning',

            text:
              item.message
          })
        )
      ];

      if (!items.length) return;

      for (const item of items) {
        const el =
          document.createElement('div');

        el.className =
          `vc-validation-item ${item.cls}`;

        el.textContent =
          item.text;

        validationLayer.appendChild(el);

        raf(() =>
          el.classList.add(
            'vc-show'
          )
        );
      }

      clearTimeout(
        state.validationTimer
      );

      state.validationTimer =
        setTimeout(() => {
          validationLayer
            .querySelectorAll(
              '.vc-validation-item'
            )
            .forEach(
              element =>
                element.classList.remove(
                  'vc-show'
                )
            );

          setTimeout(() => {
            validationLayer.textContent = '';
          }, 200);
        }, 2800);
    }

    function render() {
      renderTransform();
      renderNodes();
      renderConnections();
      updateComposerState();
    }

    function renderMenu() {
      addMenu.textContent = '';

      for (
        const [typeName, type]
          of registry
      ) {
        if (type.hidden) continue;

        const button =
          document.createElement('button');

        button.type = 'button';
        button.className =
          'vc-menu-item';

        button.dataset.nodeType =
          typeName;

        button.innerHTML = `
          <span
            class="vc-menu-icon"
            style="color:${type.color || 'var(--sub)'}"
          >
            ${type.icon || ''}
          </span>

          <span class="vc-menu-name">
            ${escapeHtml(
              type.name ||
              typeName
            )}
          </span>

          <span class="vc-menu-desc">
            ${escapeHtml(
              type.tag ||
              ''
            )}
          </span>
        `;

        addMenu.appendChild(button);
      }
    }

    function openAddMenu() {
      state.addMenuOpen = true;

      addMenu.classList.add(
        'vc-open'
      );

      addButton.classList.add(
        'vc-open'
      );

      addButton.setAttribute(
        'aria-expanded',
        'true'
      );
    }

    function closeAddMenu() {
      state.addMenuOpen = false;

      addMenu.classList.remove(
        'vc-open'
      );

      addButton.classList.remove(
        'vc-open'
      );

      addButton.setAttribute(
        'aria-expanded',
        'false'
      );
    }

    function toggleAddMenu() {
      state.addMenuOpen
        ? closeAddMenu()
        : openAddMenu();
    }

    function startNodeDrag() {
      const drag =
        state.nodeDrag;

      if (!drag || drag.moved) {
        return;
      }

      const element =
        getNodeElement(
          drag.node.id
        );

      if (!element) return;

      drag.moved = true;
      drag.wasExpanded =
        !!drag.node.expanded;

      if (drag.wasExpanded) {
        setNodeExpanded(
          element,
          false
        );
      }

      element.classList.add(
        'vc-dragging'
      );
    }

    function finishNodeDrag() {
      const drag =
        state.nodeDrag;

      if (!drag) return;

      const element =
        getNodeElement(
          drag.node.id
        );

      if (element) {
        element.classList.remove(
          'vc-dragging'
        );

        if (drag.wasExpanded) {
          setNodeExpanded(
            element,
            true
          );
        }
      }

      state.nodeDrag = null;

      renderConnections();
      emit(
        'change',
        getWorkflow()
      );
    }

    function renderDragConnection() {
      dragConnectionLayer.textContent = '';

      const drag =
        state.connectionDrag;

      if (!drag) return;

      const a =
        portPoint(
          drag.from.node,
          drag.from.port,
          'output'
        );

      if (!a) return;

      const b =
        screenToWorld(
          drag.x,
          drag.y
        );

      const sourceType =
        getNodeType(
          getNode(
            drag.from.node
          )
        );

      const path =
        svgEl(
          'path',
          {
            d:
              curve(
                a,
                b
              ),

            'marker-end':
              `url(#${markerId})`
          }
        );

      path.classList.add(
        'vc-drag-connection'
      );

      if (sourceType?.color) {
        path.style.stroke =
          sourceType.color;
      }

      dragConnectionLayer.appendChild(
        path
      );

      const dot =
        svgEl(
          'circle',
          {
            cx: a.x,
            cy: a.y,
            r: 4,
            class:
              'vc-drag-source-dot'
          }
        );

      if (sourceType?.color) {
        dot.style.fill =
          sourceType.color;
      }

      dragConnectionLayer.appendChild(
        dot
      );
    }

    function finishConnection(event) {
      const drag =
        state.connectionDrag;

      if (!drag) return;

      const target =
        document
          .elementFromPoint(
            event.clientX,
            event.clientY
          )
          ?.closest(
            '.vc-port-hit.vc-input'
          );

      const targetNode =
        target?.closest(
          '.vc-node'
        );

      if (
        targetNode?.dataset.nodeId &&
        target?.dataset.portId
      ) {
        connect(
          drag.from,
          {
            node:
              targetNode.dataset.nodeId,

            port:
              target.dataset.portId
          }
        );
      }

      state.connectionDrag = null;
      dragConnectionLayer.textContent = '';
      renderConnections();
    }

    function setTheme(theme) {
      document.documentElement.classList.toggle(
        'dark',
        theme === 'dark'
      );

      try {
        localStorage.setItem(
          'visual-ai-theme',
          theme
        );
      } catch {}

      emit(
        'theme',
        theme
      );
    }

    function applySavedTheme() {
      let theme = 'light';

      try {
        theme =
          localStorage.getItem(
            'visual-ai-theme'
          ) ||
          'light';
      } catch {}

      setTheme(theme);
    }

    function updateComposerState() {
      const hasText =
        chatInput.value.trim().length > 0;

      const active =
        hasText ||
        state.selectedNode !== null ||
        state.aiBusy;

      chatForm.classList.toggle(
        'vc-has-text',
        hasText
      );

      chatForm.classList.toggle(
        'vc-active',
        active
      );

      chatForm.classList.toggle(
        'vc-ai-busy',
        state.aiBusy
      );

      chatForm.setAttribute(
        'aria-busy',
        String(state.aiBusy)
      );

      chatInput.disabled =
        state.aiBusy;

      attachButton.disabled =
        state.aiBusy;

      $('.vc-send-button').disabled =
        state.aiBusy;

      chatInput.placeholder =
        state.aiBusy
          ? '작업을 생성하는 중…'
          : '무엇을 만들까요?';

      chatInput.style.height =
        'auto';

      chatInput.style.height =
        `${Math.min(
          chatInput.scrollHeight,
          115
        )}px`;

      const lineCount =
        Math.max(
          1,
          chatInput.value.split('\n').length
        );

      for (
        const className
          of [...chatInput.classList]
      ) {
        if (/^L\d+$/.test(className)) {
          chatInput.classList.remove(
            className
          );
        }
      }

      chatInput.classList.add(
        `L${lineCount}`
      );
    }

    function setAIWaiting(busy) {
      state.aiBusy =
        !!busy;

      const send =
        $('.vc-send-button');

      if (state.aiBusy) {
        send.innerHTML = `
          <span
            class="vc-ai-spinner"
            aria-hidden="true"
          ></span>
        `;

        send.setAttribute(
          'aria-label',
          '작업 생성 중'
        );

        send.setAttribute(
          'title',
          '작업 생성 중'
        );

        attachButton.setAttribute(
          'aria-disabled',
          'true'
        );
      } else {
        send.innerHTML =
          icons.send;

        send.setAttribute(
          'aria-label',
          '보내기'
        );

        send.removeAttribute(
          'title'
        );

        attachButton.removeAttribute(
          'aria-disabled'
        );
      }

      updateComposerState();
    }

    function appendChat(
      role,
      message = '',
      question = '',
      chatRunId = null
    ) {
      const text =
        String(message || '').trim();

      const q =
        String(question || '').trim();

      if (!text && !q) return;

      const wrapper =
        document.createElement('div');

      wrapper.className =
        `vc-chat-message ${role}`;

      if (chatRunId) {
        wrapper.dataset.chatId =
          chatRunId;
      }

      const bubble =
        document.createElement('div');

      bubble.className =
        'vc-chat-bubble';

      bubble.textContent =
        text;

      wrapper.appendChild(
        bubble
      );

      if (q) {
        const questionEl =
          document.createElement('div');

        questionEl.className =
          'vc-chat-question';

        questionEl.textContent =
          q;

        wrapper.appendChild(
          questionEl
        );
      }

      chatHistory.appendChild(
        wrapper
      );

      while (
        chatHistory.children.length >
        MAX_CHAT_HISTORY
      ) {
        chatHistory.firstElementChild.remove();
      }

      requestAnimationFrame(() => {
        chatHistory.scrollTop =
          chatHistory.scrollHeight;
      });
    }

    function createChatRun(text) {
      const run = {
        id:
          `chat-${Date.now().toString(36)}-` +
          Math.random().toString(36).slice(2, 7),

        text:
          String(text || ''),

        selectedNode:
          state.selectedNode,

        workflow:
          null,

        response: {
          message: '',
          question: null
        },

        status:
          'pending',

        createdAt:
          Date.now()
      };

      state.chatRuns.push(run);

      if (
        state.chatRuns.length >
        MAX_CHAT_HISTORY
      ) {
        state.chatRuns.splice(
          0,
          state.chatRuns.length -
            MAX_CHAT_HISTORY
        );
      }

      state.pendingChatRun =
        run.id;

      return run;
    }

    function completeChatRun(result) {
      const id =
        state.pendingChatRun;

      if (!id) return null;

      const run =
        state.chatRuns.find(
          item =>
            item.id === id
        );

      if (!run) {
        state.pendingChatRun = null;
        return null;
      }

      /*
        API 처리
        Canvas 반영
        validation
        chat 표시
        전부 끝난 뒤의
        실제 현재 Workflow를 저장한다.
      */
      run.workflow =
        snapshotWorkflow(
          getWorkflow()
        );

      run.response = {
        message:
          typeof result?.message === 'string'
            ? result.message
            : '',

        question:
          result?.question === null ||
          typeof result?.question === 'string'
            ? result.question
            : null
      };

      run.status =
        'complete';

      run.completedAt =
        Date.now();

      state.pendingChatRun =
        null;

      return run;
    }

    function failChatRun() {
      const id =
        state.pendingChatRun;

      if (!id) return;

      const run =
        state.chatRuns.find(
          item =>
            item.id === id
        );

      if (run) {
        run.status =
          'error';
      }

      state.pendingChatRun =
        null;
    }

    function updateFileInput(files) {
      const rect =
        canvas.getBoundingClientRect();

      const base =
        screenToWorld(
          rect.left +
            rect.width / 2,

          rect.top +
            Math.min(
              rect.height / 2,
              rect.height - 180
            )
        );

      files.forEach(
        (file, index) => {
          const previewUrl =
            file.type.startsWith('image/')
              ? URL.createObjectURL(file)
              : null;

          addNode(
            'file',
            {
              x:
                base.x +
                (
                  index -
                  (files.length - 1) / 2
                ) * 220,

              y:
                base.y,

              data: {
                file,

                name:
                  file.name,

                mime:
                  file.type ||
                  'application/octet-stream',

                size:
                  file.size,

                lastModified:
                  file.lastModified,

                previewUrl
              }
            }
          );
        }
      );

      emit(
        'attach',
        { files }
      );
    }

    function handlePointerEvent(event) {
      return {
        x: event.clientX,
        y: event.clientY
      };
    }

    function setPointerCaptureSafe(
      element,
      pointerId
    ) {
      try {
        element.setPointerCapture(
          pointerId
        );
      } catch {}
    }

    listen(
      addButton,
      'click',
      event => {
        event.preventDefault();
        event.stopPropagation();
        toggleAddMenu();
      }
    );

    listen(
      addMenu,
      'pointerdown',
      event => event.stopPropagation()
    );

    listen(
      addMenu,
      'click',
      event => {
        const item =
          event.target.closest(
            '.vc-menu-item'
          );

        if (!item) return;

        addNode(
          item.dataset.nodeType
        );
      }
    );

    listen(
      root,
      'pointerdown',
      event => {
        if (
          !addMenu.contains(event.target) &&
          !addButton.contains(event.target)
        ) {
          closeAddMenu();
        }
      }
    );

    listen(
      themeButton,
      'click',
      event => {
        event.stopPropagation();

        setTheme(
          document.documentElement.classList.contains(
            'dark'
          )
            ? 'light'
            : 'dark'
        );
      }
    );

    listen(
      attachButton,
      'click',
      event => {
        event.stopPropagation();
        fileInput.click();
      }
    );

    listen(
      fileInput,
      'change',
      event => {
        const files =
          [...event.target.files];

        if (!files.length) return;

        updateFileInput(files);
        fileInput.value = '';
      }
    );

    listen(
      chatInput,
      'input',
      updateComposerState
    );

    listen(
      chatInput,
      'focus',
      updateComposerState
    );

    listen(
      chatInput,
      'keydown',
      event => {
        if (state.aiBusy) return;

        if (
          event.key === 'Enter' &&
          !event.shiftKey
        ) {
          event.preventDefault();
          chatForm.requestSubmit();
        }
      }
    );

    listen(
      chatForm,
      'submit',
      event => {
        event.preventDefault();

        if (state.aiBusy) return;

        const text =
          chatInput.value.trim();

        if (!text) return;

        state.aiBusy = true;

        updateComposerState();

        const chatRun =
          createChatRun(
            text
          );

        appendChat(
          'user',
          text,
          '',
          chatRun.id
        );

        emit(
          'submit',
          {
            text,

            selectedNode:
              chatRun.selectedNode,

            chatRunId:
              chatRun.id
          }
        );
      }
    );

    listen(
      nodesLayer,
      'pointerdown',
      event => {
        const action =
          event.target.closest(
            '[data-action]'
          );

        if (action) {
          event.stopPropagation();
        }

        if (
          event.target.closest(
            '.vc-slot-param'
          )
        ) {
          event.stopPropagation();
        }
      }
    );

    listen(
      nodesLayer,
      'click',
      event => {
        const action =
          event.target.closest(
            '[data-action]'
          );

        if (!action) return;

        event.preventDefault();
        event.stopPropagation();

        const element =
          action.closest(
            '.vc-node'
          );

        if (!element) return;

        const id =
          element.dataset.nodeId;

        if (
          action.dataset.action ===
          'toggle'
        ) {
          toggleNodeExpanded(id);
          return;
        }

        if (
          action.dataset.action ===
            'delete' ||
          action.dataset.action ===
            'delete-expanded'
        ) {
          removeNode(id);
        }
      }
    );

    listen(
      nodesLayer,
      'input',
      event => {
        const input =
          event.target.closest(
            '.vc-slot-param'
          );

        if (!input) return;

        const element =
          input.closest('.vc-node');

        if (!element) return;

        const node =
          getNode(
            element.dataset.nodeId
          );

        if (!node) return;

        node.data ||= {};
        node.data.params ||= {};

        node.data.params[
          input.dataset.paramId
        ] = input.value;

        emit(
          'change',
          getWorkflow()
        );
      }
    );

    listen(
      canvas,
      'pointerdown',
      event => {
        state.pointers.set(
          event.pointerId,
          handlePointerEvent(event)
        );

        if (state.pointers.size >= 2) {
          if (state.nodeDrag) {
            finishNodeDrag();
          }

          state.canvasPan = null;
          state.connectionDrag = null;

          const points =
            [...state.pointers.values()];

          const center =
            mid(points[0], points[1]);

          const anchor =
            screenToWorld(
              center.x,
              center.y
            );

          state.pinch = {
            d:
              Math.max(
                1,
                dist(
                  points[0],
                  points[1]
                )
              ),

            s:
              state.scale,

            x:
              anchor.x,

            y:
              anchor.y
          };

          dragConnectionLayer.textContent =
            '';

          return;
        }

        const port =
          event.target.closest(
            '.vc-port-hit'
          );

        if (port) {
          event.preventDefault();
          event.stopPropagation();

          const node =
            getNode(
              port.dataset.nodeId
            );

          if (!node) return;

          if (
            port.dataset.portDir ===
            'output'
          ) {
            state.connectionDrag = {
              pointerId:
                event.pointerId,

              from: {
                node:
                  node.id,

                port:
                  port.dataset.portId
              },

              x:
                event.clientX,

              y:
                event.clientY
            };

            setPointerCaptureSafe(
              canvas,
              event.pointerId
            );

            renderDragConnection();
          }

          return;
        }

        const nodeElement =
          event.target.closest(
            '.vc-node'
          );

        if (nodeElement) {
          event.preventDefault();
          event.stopPropagation();

          const node =
            getNode(
              nodeElement.dataset.nodeId
            );

          if (!node) return;

          selectNode(node.id);

          state.nodeDrag = {
            pointerId:
              event.pointerId,

            node,

            startX:
              event.clientX,

            startY:
              event.clientY,

            nodeX:
              node.x,

            nodeY:
              node.y,

            moved:
              false,

            wasExpanded:
              !!node.expanded
          };

          setPointerCaptureSafe(
            canvas,
            event.pointerId
          );

          return;
        }

        selectNode(null);

        state.canvasPan = {
          pointerId:
            event.pointerId,

          startX:
            event.clientX,

          startY:
            event.clientY,

          startOffsetX:
            state.offset.x,

          startOffsetY:
            state.offset.y,

          moved:
            false
        };

        canvas.classList.add(
          'vc-dragging'
        );

        setPointerCaptureSafe(
          canvas,
          event.pointerId
        );
      }
    );

    listen(
      canvas,
      'pointermove',
      event => {
        if (
          !state.pointers.has(
            event.pointerId
          )
        ) {
          return;
        }

        state.pointers.set(
          event.pointerId,
          handlePointerEvent(event)
        );

        if (state.pointers.size >= 2) {
          if (state.nodeDrag) {
            finishNodeDrag();
            state.nodeDrag = null;
          }

          state.canvasPan = null;

          const points =
            [...state.pointers.values()];

          if (!state.pinch) {
            const center =
              mid(points[0], points[1]);

            const anchor =
              screenToWorld(
                center.x,
                center.y
              );

            state.pinch = {
              d:
                Math.max(
                  1,
                  dist(
                    points[0],
                    points[1]
                  )
                ),

              s:
                state.scale,

              x:
                anchor.x,

              y:
                anchor.y
            };
          }

          const d =
            dist(
              points[0],
              points[1]
            );

          const center =
            mid(
              points[0],
              points[1]
            );

          state.scale =
            clamp(
              state.pinch.s *
                (d / state.pinch.d),
              .12,
              3
            );

          state.offset.x =
            center.x -
            state.pinch.x *
              state.scale;

          state.offset.y =
            center.y -
            state.pinch.y *
              state.scale;

          renderTransform();
          renderConnections();
          return;
        }

        if (
          state.connectionDrag
            ?.pointerId ===
          event.pointerId
        ) {
          event.preventDefault();

          state.connectionDrag.x =
            event.clientX;

          state.connectionDrag.y =
            event.clientY;

          renderDragConnection();
          return;
        }

        if (
          state.nodeDrag
            ?.pointerId ===
          event.pointerId
        ) {
          const drag =
            state.nodeDrag;

          const dx =
            event.clientX -
            drag.startX;

          const dy =
            event.clientY -
            drag.startY;

          if (
            !drag.moved &&
            Math.hypot(dx, dy) > 7
          ) {
            startNodeDrag();
          }

          if (!drag.moved) return;

          event.preventDefault();

          setNodePosition(
            drag.node,
            drag.nodeX +
              dx / state.scale,
            drag.nodeY +
              dy / state.scale
          );

          return;
        }

        if (
          state.canvasPan
            ?.pointerId ===
          event.pointerId
        ) {
          const pan =
            state.canvasPan;

          const dx =
            event.clientX -
            pan.startX;

          const dy =
            event.clientY -
            pan.startY;

          if (
            !pan.moved &&
            Math.hypot(dx, dy) > 7
          ) {
            pan.moved = true;
          }

          if (!pan.moved) return;

          event.preventDefault();

          state.offset.x =
            pan.startOffsetX +
            dx;

          state.offset.y =
            pan.startOffsetY +
            dy;

          renderTransform();
          renderConnections();
        }
      },
      {
        passive: false
      }
    );

    function endPointer(event) {
      if (
        state.connectionDrag
          ?.pointerId ===
        event.pointerId
      ) {
        finishConnection(event);
      }

      if (
        state.nodeDrag
          ?.pointerId ===
        event.pointerId
      ) {
        finishNodeDrag();
      }

      state.pointers.delete(
        event.pointerId
      );

      if (state.pointers.size < 2) {
        state.pinch = null;
      }

      if (!state.pointers.size) {
        state.canvasPan = null;
        state.connectionDrag = null;

        canvas.classList.remove(
          'vc-dragging'
        );

        dragConnectionLayer.textContent =
          '';
      }
    }

    listen(
      canvas,
      'pointerup',
      endPointer
    );

    listen(
      canvas,
      'pointercancel',
      endPointer
    );

    listen(
      canvas,
      'wheel',
      event => {
        event.preventDefault();

        const before =
          screenToWorld(
            event.clientX,
            event.clientY
          );

        const factor =
          Math.exp(
            -event.deltaY * .0015
          );

        state.scale =
          clamp(
            state.scale * factor,
            .12,
            3
          );

        state.offset.x =
          event.clientX -
          before.x *
            state.scale;

        state.offset.y =
          event.clientY -
          before.y *
            state.scale;

        renderTransform();
        renderConnections();
      },
      {
        passive: false
      }
    );

    const resizeObserver =
      new ResizeObserver(() => {
        renderConnections();

        emit(
          'resize',
          canvas.getBoundingClientRect()
        );
      });

    resizeObserver.observe(canvas);

    observers.push(
      () =>
        resizeObserver.disconnect(),

      () =>
        nodeResizeObserver.disconnect()
    );

    function centerInitial() {
      if (!state.nodes.length) return;

      const rect =
        canvas.getBoundingClientRect();

      const first =
        state.nodes[0];

      const width =
        window.innerWidth <= 600
          ? 178
          : 190;

      state.offset.x =
        rect.width / 2 -
        (
          first.x +
          width / 2
        ) *
        state.scale;

      state.offset.y =
        Math.max(
          90,
          rect.height * .12
        ) -
        first.y *
        state.scale;
    }

    function registerNodeType(
      type,
      definition
    ) {
      if (
        !type ||
        typeof type !== 'string'
      ) {
        throw new TypeError(
          'type must be a string'
        );
      }

      registry.set(
        type,
        normalizeNodeType(
          type,
          definition
        )
      );

      renderMenu();
      render();

      return api;
    }

    function unregisterNodeType(type) {
      if (type === 'start') {
        throw new Error(
          'start node type cannot be removed'
        );
      }

      registry.delete(type);
      renderMenu();

      return api;
    }

    function chatApplyResult(
      result,
      chatRunId = null
    ) {
      chatInput.value = '';

      api.render();

      const message =
        typeof result?.message === 'string'
          ? result.message.trim()
          : '워크플로우를 반영했습니다.';

      const question =
        typeof result?.question === 'string'
          ? result.question.trim()
          : '';

      appendChat(
        'assistant',
        message,
        question,
        chatRunId
      );
    }

    function chatApplyError(error) {
      const message =
        error?.message ||
        '워크플로우 생성에 실패했습니다.';

      appendChat(
        'assistant',
        message
      );

      chatInput.focus();

      validationLayer.textContent = '';

      const item =
        document.createElement('div');

      item.className =
        'vc-validation-item vc-error vc-show';

      item.textContent =
        message;

      validationLayer.appendChild(item);

      setTimeout(() => {
        item.classList.remove('vc-show');

        setTimeout(
          () => item.remove(),
          220
        );
      }, 3000);
    }

    const initial = {
      nodes: [
        {
          id: 'start',
          type: 'start',
          x: 780,
          y: 80,
          expanded: true
        }
      ],

      connections: []
    };

    const api = {
      root,

      registerNodeType,
      unregisterNodeType,

      addNode,
      removeNode,

      connect,
      disconnect,
      canConnect,
      validate,

      getWorkflow,
      getState,

      getChatRuns:
        () =>
          clone(
            state.chatRuns
          ),

      setState,

      getNode: id =>
        getNode(id),

      on,
      off,

      selectNode,

      render,

      __setAIWaiting:
        setAIWaiting,

      destroy() {
        if (state.destroyed) {
          return;
        }

        state.destroyed = true;

        listeners
          .splice(0)
          .forEach(cleanup => {
            try {
              cleanup();
            } catch {}
          });

        observers
          .splice(0)
          .forEach(cleanup => {
            try {
              cleanup();
            } catch {}
          });

        if (
          state.expansionAnimation
        ) {
          cancelAnimationFrame(
            state.expansionAnimation
          );
        }

        state.rafIds.forEach(
          cancelAnimationFrame
        );

        clearTimeout(
          state.validationTimer
        );

        events.clear();
        state.pointers.clear();

        root.remove();

        if (
          target._visualCanvas ===
          api
        ) {
          target._visualCanvas = null;
        }
      }
    };

    renderMenu();
    applySavedTheme();

    setState({
      workflow: initial
    });

    centerInitial();
    render();

    for (
      const [name, handler]
        of [
          ['change', options.onChange],
          ['connect', options.onConnect],
          ['validate', options.onValidate],
          ['submit', options.onSubmit],
          ['attach', options.onAttach],
          ['resize', options.onResize]
        ]
    ) {
      if (handler) {
        on(name, handler);
      }
    }

    if (
      options.handleSubmit !== false
    ) {
      on(
        'submit',
        async ({
          text,
          chatRunId
        }) => {
          try {
            const result =
              await workflowToCanvas(
                text,
                api
              );

            const validation =
              validate();

            if (!validation.valid) {
              throw new Error(
                validation
                  .errors?.[0]
                  ?.message ||
                '생성된 워크플로우를 적용할 수 없습니다.'
              );
            }

            /*
              여기서 채팅 + 현재 Workflow가
              하나의 기록으로 완성된다.
            */
            chatApplyResult(
              result,
              chatRunId
            );

            completeChatRun(
              result
            );

          } catch (error) {
            console.error(
              'Workflow ERROR:',
              error
            );

            chatApplyError(error);
            failChatRun();

          } finally {
            setAIWaiting(false);
          }
        }
      );
    }

    target._visualCanvas = api;

    return api;
  };

  window.getMountedVisualCanvas =
    function (target) {
      if (typeof target === 'string') {
        target =
          document.querySelector(target);
      }

      return (
        target?._visualCanvas ||
        null
      );
    };
})();


/* =========================================================
   Tutorial
========================================================= */

(function () {
  'use strict';

  function playTutorial() {
    if (
      localStorage.getItem(
        'vc-tutorial-done'
      ) === '1'
    ) {
      return;
    }

    const steps = [
      {
        target: '.vc-add-button',
        title: '노드를 추가하세요',
        desc:
          '원하는 작업을 캔버스에 추가해 워크플로우를 만들 수 있어요.',
        visual: `
          <div class="vt-flow">
            <div class="vt-mini-node vt-green">조사</div>
            <div class="vt-flow-arrow">→</div>
            <div class="vt-mini-node vt-blue">정리</div>
            <div class="vt-flow-arrow">→</div>
            <div class="vt-mini-node vt-red">작성</div>
          </div>
        `
      },

      {
        target: '.vc-node',
        title: '작업을 연결하세요',
        desc:
          '노드의 출력과 다음 노드의 입력을 연결하면 데이터가 전달돼요.',
        visual: `
          <div class="vt-connect-demo">
            <div class="vt-port vt-blue"></div>
            <div class="vt-connect-line"></div>
            <div class="vt-port vt-purple"></div>
          </div>
        `
      },

      {
        target: '.vc-node-body',
        title: '작업 내용을 설정하세요',
        desc:
          '노드를 펼치면 주제, 기간, 조건 같은 값을 직접 설정할 수 있어요.',
        visual: `
          <div class="vt-demo-node">
            <div class="vt-demo-head"></div>
            <div class="vt-demo-input"></div>
            <div class="vt-demo-input"></div>
            <div class="vt-demo-input vt-small"></div>
          </div>
        `
      },

      {
        target: '.vc-chat-input',
        title: '자연어로 요청하세요',
        desc:
          '원하는 작업을 평소처럼 입력하면 AI가 워크플로우를 구성하는 데 활용할 수 있어요.',
        visual: `
          <div class="vt-chat-demo">
            <div class="vt-bubble vt-user">
              AI 시장 조사하고 보고서 만들어줘
            </div>

            <div class="vt-down">↓</div>

            <div class="vt-bubble vt-ai">
              조사 → 정리 → 작성
            </div>
          </div>
        `
      }
    ];

    const style =
      document.createElement('style');

    style.textContent = `
      .vc-tutorial{
        position:fixed;
        inset:0;
        z-index:99999;
        pointer-events:none;
        opacity:0;
        transition:opacity .2s ease;
      }

      .vc-tutorial.open{
        opacity:1;
        pointer-events:auto;
      }

      .vc-tutorial-shade{
        position:fixed;
        inset:0;
        background:rgba(0,0,0,.34);
        backdrop-filter:blur(1.5px);
        -webkit-backdrop-filter:blur(1.5px);
      }

      .vc-tutorial-focus{
        position:fixed;
        z-index:100000;
        pointer-events:none;
        border-radius:14px;
        box-shadow:
          0 0 0 9999px rgba(0,0,0,.34),
          0 0 0 3px rgba(255,255,255,.96),
          0 0 0 6px var(--accent),
          0 14px 40px rgba(0,0,0,.18);
        transition:
          left .16s ease,
          top .16s ease,
          width .16s ease,
          height .16s ease;
      }

      .vc-tutorial-card{
        position:fixed;
        left:0;
        top:0;
        z-index:100001;
        width:310px;
        padding:17px;
        border:1px solid rgba(255,255,255,.18);
        border-radius:18px;
        background:var(--glass2);
        box-shadow:
          0 20px 60px rgba(0,0,0,.2),
          0 2px 8px rgba(0,0,0,.06);
        backdrop-filter:blur(24px);
        -webkit-backdrop-filter:blur(24px);
        will-change:left,top;
        transition:left .16s ease,top .16s ease;
      }

      .vc-tutorial-title{
        font-size:14px;
        font-weight:750;
        letter-spacing:-.025em;
      }

      .vc-tutorial-desc{
        margin-top:6px;
        color:var(--sub);
        font-size:11px;
        line-height:1.55;
        letter-spacing:-.015em;
      }

      .vc-tutorial-visual{
        min-height:58px;
        margin-top:13px;
        padding:10px;
        display:flex;
        align-items:center;
        justify-content:center;
        border-radius:11px;
        background:var(--soft);
        overflow:hidden;
      }

      .vc-tutorial-bottom{
        display:flex;
        align-items:center;
        justify-content:space-between;
        margin-top:14px;
      }

      .vc-tutorial-page{
        color:var(--faint);
        font-size:9px;
        font-variant-numeric:tabular-nums;
      }

      .vc-tutorial-buttons{
        display:flex;
        gap:5px;
      }

      .vc-tutorial-buttons button{
        height:30px;
        padding:0 10px;
        border:0;
        border-radius:9px;
        font-size:10px;
        cursor:pointer;
      }

      .vc-tutorial-skip{
        color:var(--sub);
        background:transparent;
      }

      .vc-tutorial-skip:hover{
        background:var(--soft);
      }

      .vc-tutorial-next{
        color:#fff;
        background:var(--accent);
        box-shadow:
          0 4px 12px
          color-mix(
            in srgb,
            var(--accent) 25%,
            transparent
          );
      }

      .vt-flow{
        width:100%;
        display:flex;
        align-items:center;
        justify-content:center;
        gap:7px;
      }

      .vt-mini-node{
        padding:6px 8px;
        border:1px solid var(--border);
        border-radius:8px;
        background:var(--node);
        font-size:9px;
        font-weight:650;
      }

      .vt-flow-arrow{
        color:var(--sub);
        font-size:11px;
      }

      .vt-green{color:#10B981}
      .vt-blue{color:#3B82F6}
      .vt-purple{color:#8B5CF6}
      .vt-red{color:#EF4444}

      .vt-connect-demo{
        display:flex;
        align-items:center;
        width:100%;
        justify-content:center;
      }

      .vt-port{
        width:10px;
        height:10px;
        flex:none;
        border-radius:50%;
        background:currentColor;
        box-shadow:
          0 0 0 4px
          color-mix(
            in srgb,
            currentColor 15%,
            transparent
          );
      }

      .vt-connect-line{
        width:80px;
        height:2px;
        margin:0 8px;
        border-radius:999px;
        background:var(--line);
      }

      .vt-demo-node{
        width:135px;
        padding:9px;
        border:1px solid var(--border);
        border-radius:10px;
        background:var(--node);
        box-shadow:var(--shadow);
      }

      .vt-demo-head{
        width:45%;
        height:7px;
        margin-bottom:8px;
        border-radius:999px;
        background:var(--soft);
      }

      .vt-demo-input{
        height:14px;
        margin-top:5px;
        border:1px solid var(--border);
        border-radius:5px;
        background:var(--canvas);
      }

      .vt-demo-input.vt-small{
        width:65%;
      }

      .vt-chat-demo{
        width:100%;
        display:flex;
        flex-direction:column;
        gap:5px;
      }

      .vt-bubble{
        max-width:88%;
        padding:6px 9px;
        border-radius:9px;
        font-size:9px;
        line-height:1.4;
      }

      .vt-user{
        align-self:flex-end;
        background:var(--accent-soft);
      }

      .vt-ai{
        align-self:flex-start;
        border:1px solid var(--border);
        background:var(--node);
      }

      .vt-down{
        align-self:center;
        color:var(--faint);
        font-size:10px;
      }

      @media(max-width:600px){
        .vc-tutorial-card{
          width:calc(100vw - 28px);
        }
      }
    `;

    const layer =
      document.createElement('div');

    layer.className =
      'vc-tutorial';

    layer.innerHTML = `
      <div class="vc-tutorial-shade"></div>
      <div class="vc-tutorial-focus"></div>

      <div class="vc-tutorial-card">
        <div class="vc-tutorial-title"></div>
        <div class="vc-tutorial-desc"></div>
        <div class="vc-tutorial-visual"></div>

        <div class="vc-tutorial-bottom">
          <span class="vc-tutorial-page"></span>

          <div class="vc-tutorial-buttons">
            <button
              type="button"
              class="vc-tutorial-skip"
            >
              건너뛰기
            </button>

            <button
              type="button"
              class="vc-tutorial-next"
            >
              다음
            </button>
          </div>
        </div>
      </div>
    `;

    document.head.appendChild(style);
    document.body.appendChild(layer);

    const focus =
      layer.querySelector(
        '.vc-tutorial-focus'
      );

    const card =
      layer.querySelector(
        '.vc-tutorial-card'
      );

    const title =
      layer.querySelector(
        '.vc-tutorial-title'
      );

    const desc =
      layer.querySelector(
        '.vc-tutorial-desc'
      );

    const visual =
      layer.querySelector(
        '.vc-tutorial-visual'
      );

    const page =
      layer.querySelector(
        '.vc-tutorial-page'
      );

    const next =
      layer.querySelector(
        '.vc-tutorial-next'
      );

    const skip =
      layer.querySelector(
        '.vc-tutorial-skip'
      );

    let index = 0;
    let running = true;
    let rafId = 0;

    function stopLoop() {
      if (!rafId) return;

      cancelAnimationFrame(
        rafId
      );

      rafId = 0;
    }

    function finish() {
      if (!running) return;

      running = false;
      stopLoop();

      window.removeEventListener(
        'resize',
        handleResize
      );

      try {
        localStorage.setItem(
          'vc-tutorial-done',
          '1'
        );
      } catch {}

      layer.classList.remove(
        'open'
      );

      setTimeout(() => {
        layer.remove();
        style.remove();
      }, 220);
    }

    function targetElement() {
      return document.querySelector(
        steps[index]?.target
      );
    }

    function updatePosition() {
      if (!running) return false;

      const target =
        targetElement();

      if (!target) {
        return false;
      }

      const rect =
        target.getBoundingClientRect();

      const pad = 7;
      const gap = 18;

      focus.style.left =
        `${rect.left - pad}px`;

      focus.style.top =
        `${rect.top - pad}px`;

      focus.style.width =
        `${rect.width + pad * 2}px`;

      focus.style.height =
        `${rect.height + pad * 2}px`;

      const cardWidth =
        card.offsetWidth;

      const cardHeight =
        card.offsetHeight;

      if (
        !cardWidth ||
        !cardHeight
      ) {
        return true;
      }

      let x =
        rect.left +
        (
          rect.width -
          cardWidth
        ) / 2;

      let y =
        rect.bottom +
        gap;

      if (
        y + cardHeight >
        window.innerHeight - 14
      ) {
        y =
          rect.top -
          cardHeight -
          gap;
      }

      x = Math.min(
        Math.max(x, 14),
        Math.max(
          14,
          window.innerWidth -
          cardWidth -
          14
        )
      );

      y = Math.min(
        Math.max(y, 14),
        Math.max(
          14,
          window.innerHeight -
          cardHeight -
          14
        )
      );

      card.style.left =
        `${x}px`;

      card.style.top =
        `${y}px`;

      return true;
    }

    function positionLoop() {
      if (!running) return;

      if (!updatePosition()) {
        finish();
        return;
      }

      rafId =
        requestAnimationFrame(
          positionLoop
        );
    }

    function restartLoop() {
      stopLoop();

      requestAnimationFrame(() => {
        if (!running) return;

        updatePosition();
        positionLoop();
      });
    }

    function renderStep() {
      if (!running) return;

      const step = steps[index];

      if (!step) {
        finish();
        return;
      }

      const target =
        targetElement();

      if (!target) {
        if (
          index <
          steps.length - 1
        ) {
          index++;
          renderStep();
        } else {
          finish();
        }

        return;
      }

      title.textContent =
        step.title;

      desc.textContent =
        step.desc;

      visual.innerHTML =
        step.visual;

      page.textContent =
        `${index + 1} / ${steps.length}`;

      next.textContent =
        index ===
        steps.length - 1
          ? '시작하기'
          : '다음';

      restartLoop();
    }

    function handleResize() {
      if (!running) return;

      requestAnimationFrame(
        updatePosition
      );
    }

    next.addEventListener(
      'click',
      event => {
        event.preventDefault();
        event.stopPropagation();

        if (!running) return;

        if (
          index ===
          steps.length - 1
        ) {
          finish();
          return;
        }

        index++;
        renderStep();
      }
    );

    skip.addEventListener(
      'click',
      event => {
        event.preventDefault();
        event.stopPropagation();
        finish();
      }
    );

    layer.addEventListener(
      'click',
      event =>
        event.stopPropagation()
    );

    window.addEventListener(
      'resize',
      handleResize
    );

    layer.classList.add('open');

    requestAnimationFrame(
      renderStep
    );
  }

  window.playVisualCanvasTutorial =
    playTutorial;
})();
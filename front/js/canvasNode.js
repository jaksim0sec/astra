(function(global) {
  'use strict';
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const MIN_SCALE = 0.12;
  const MAX_SCALE = 3;
  const U = global.AstraUtils || {};
  const clamp = U.clamp || ((value, min, max) => Math.min(max, Math.max(min, value)));
  const clone = U.clone || (value => {
    try { return structuredClone(value); }
    catch { return JSON.parse(JSON.stringify(value)); }
  });
  const escapeHtml = U.escapeHtml || (value => String(value ?? '').replace(
    /[&<>'"]/g,
    char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char])
  ));
  const icons = {
    toggle: `
      <svg viewBox="0 0 20 20" fill="none" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <path d="M6.25 8.25 10 12l3.75-3.75" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `,
    delete: `
      <svg viewBox="0 0 20 20" fill="none" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <path d="M5.5 6.5h9M8.1 6.5V5.2h3.8v1.3M7.2 8.4l.45 6.15h4.7l.45-6.15" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M9.2 9.6v3.2M10.8 9.6v3.2" stroke="currentColor" stroke-width="1.35" stroke-linecap="round"/>
      </svg>
    `,
    run: `
      <svg viewBox="0 0 20 20" fill="none" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <path class="vc-run-spark-main" d="M9.95 3.25c.34 3.28 1.52 4.46 4.8 4.8-3.28.34-4.46 1.52-4.8 4.8-.34-3.28-1.52-4.46-4.8-4.8 3.28-.34 4.46-1.52 4.8-4.8Z" stroke="currentColor" stroke-width="1.35" stroke-linejoin="round"/>
        <path class="vc-run-spark-small" d="M14.9 12.7c.16 1.55.72 2.1 2.25 2.25-1.53.16-2.09.72-2.25 2.25-.16-1.53-.71-2.09-2.25-2.25 1.54-.15 2.09-.7 2.25-2.25Z" fill="currentColor"/>
      </svg>
    `
  };
  function svgEl(name, attrs = {}) {
    const element = document.createElementNS(SVG_NS, name);
    for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, value);
    return element;
  }
  function dist(a, b) {
    return Math.hypot(b.x - a.x, b.y - a.y);
  }
  function mid(a, b) {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }
  function endpoint(value) {
    if (typeof value !== 'string') throw new Error('연결 endpoint가 문자열이 아닙니다.');
    const dot = value.lastIndexOf('.');
    if (dot < 1 || dot === value.length - 1) throw new Error(`잘못된 endpoint입니다: ${value}`);
    return { node: value.slice(0, dot), port: value.slice(dot + 1) };
  }
  function pathFor(a, b) {
    const bend = clamp(
      Math.abs(b.x - a.x) * 0.22 + Math.abs(b.y - a.y) * 0.05,
      28,
      85
    );
    return `M ${a.x} ${a.y} C ${a.x + bend} ${a.y}, ${b.x - bend} ${b.y}, ${b.x} ${b.y}`.replace(/\s+/g, ' ');
  }
  global.mountCanvasNode = async function(target, options = {}) {
    if (typeof target === 'string') target = document.querySelector(target);
    if (!(target instanceof Element)) throw new TypeError('target must be a DOM Element or selector');
    const previousState = target._canvasNode?.getState?.() || null;
    target._canvasNode?.destroy?.();
    let definitions = options.nodeDefinitions || {};
    const getFreshNodeDefinitions =
      global.AstraAPI?.getNodeDefinitions;
    if (typeof getFreshNodeDefinitions === 'function') {
      const freshDefinitions = await getFreshNodeDefinitions.call(
        global.AstraAPI,
        { force: true }
      );
      if (
        !freshDefinitions ||
        typeof freshDefinitions !== 'object' ||
        Array.isArray(freshDefinitions)
      ) {
        throw new Error('서버 노드 정의 응답이 올바르지 않습니다.');
      }
      definitions = freshDefinitions.nodes || freshDefinitions;
    }
    const viewport = target.matches('#canvas-viewport')
      ? target
      : target.querySelector('#canvas-viewport');
    if (!viewport) throw new Error('#canvas-viewport가 없습니다.');
    const world = viewport.querySelector('#canvas-world');
    const connectionSvg = viewport.querySelector('#canvas-connections');
    const nodesLayer = viewport.querySelector('#canvas-nodes');
    if (!world || !connectionSvg || !nodesLayer) {
      throw new Error('Canvas DOM 구조가 올바르지 않습니다.');
    }
    let connectionLayer = connectionSvg.querySelector('.vc-connection-layer');
    let dragLayer = connectionSvg.querySelector('.vc-drag-connection-layer');
    if (!connectionLayer) {
      connectionLayer = document.createElementNS(SVG_NS, 'g');
      connectionLayer.className.baseVal = 'vc-connection-layer';
      connectionSvg.appendChild(connectionLayer);
    }
    if (!dragLayer) {
      dragLayer = document.createElementNS(SVG_NS, 'g');
      dragLayer.className.baseVal = 'vc-drag-connection-layer';
      connectionSvg.appendChild(dragLayer);
    }
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
      interactionEnabled: options.interactionEnabled !== false,
      destroyed: false,
      connectionFrame: null,
      lastNodeDragEndAt: 0,
      runtimeConnections: new Set(),
      runtimeNodes: new Map()
    };
    const registry = new Map(
      Object.entries(definitions).map(([type, def]) => [
        type,
        normalizeDefinition(type, def)
      ])
    );
    const events = new Map();
    const listeners = [];
    const observers = [];
    const connectionElements = new Map();
    function on(name, fn) {
      if (typeof fn !== 'function') return () => {};
      if (!events.has(name)) events.set(name, new Set());
      events.get(name).add(fn);
      return () => off(name, fn);
    }
    function off(name, fn) {
      events.get(name)?.delete(fn);
    }
    function emit(name, payload) {
      for (const fn of events.get(name) || []) {
        try { fn(payload, api); }
        catch (error) { console.error(error); }
      }
    }
    function listen(element, type, handler, opts) {
      element.addEventListener(type, handler, opts);
      listeners.push(() => element.removeEventListener(type, handler, opts));
    }
    function scheduleConnectionRender() {
      if (state.destroyed || state.connectionFrame !== null) return;
      state.connectionFrame = requestAnimationFrame(() => {
        state.connectionFrame = null;
        if (!state.destroyed) renderConnections();
      });
    }
    function normalizePort(port, index, direction) {
      return {
        ...(port || {}),
        id: String(port?.id ?? `${direction}-${index}`),
        name: port?.name ?? port?.id ?? `${direction}-${index}`,
        type: port?.type || 'any',
        required: !!port?.required,
        multiple: port?.multiple !== false,
        accepts: Array.isArray(port?.accepts) && port.accepts.length
          ? [...port.accepts]
          : ['any']
      };
    }
    function normalizeDefinition(type, definition) {
      return {
        ...(definition || {}),
        name: definition?.name || type,
        color: definition?.color || '#888888',
        icon: typeof definition?.icon === 'string' ? definition.icon : '',
        inputs: Array.isArray(definition?.inputs)
          ? definition.inputs.map((port, index) => normalizePort(port, index, 'input'))
          : [],
        outputs: Array.isArray(definition?.outputs)
          ? definition.outputs.map((port, index) => normalizePort(port, index, 'output'))
          : [],
        params: Array.isArray(definition?.params) ? definition.params : []
      };
    }
    function getDefinition(type) {
      return registry.get(type) || null;
    }
    function getNode(id) {
      return state.nodes.find(node => node.id === id) || null;
    }
    function getNodeElement(id) {
      return [...nodesLayer.querySelectorAll('.vc-node')].find(
        element => element.dataset.nodeId === String(id)
      ) || null;
    }
    function normalizeNode(input) {
      return {
        id: String(
          input?.id ||
          `n-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
        ),
        type: String(input?.type || ''),
        x: Number(input?.x) || 0,
        y: Number(input?.y) || 0,
        expanded: !!input?.expanded,
        data: clone(input?.data || {})
      };
    }
    function renderSlotContent(node, definition) {
      const out = [];
      const values = node.data?.params || {};
      for (const param of definition.params || []) {
        out.push(`
          <div class="vc-param-group">
            <label class="vc-param-label">
              ${escapeHtml(param.name || param.id)}
            </label>
            <textarea
              class="vc-slot-param"
              data-param-id="${escapeHtml(param.id)}"
              placeholder="${escapeHtml(param.placeholder || '')}"
            >${escapeHtml(values[param.id] ?? '')}</textarea>
          </div>
        `);
      }
      if (node.type === 'file') {
        const mime = node.data?.mime || '알 수 없는 형식';
        const size = Number(node.data?.size || 0);
        const text = size < 1024
          ? `${size} B`
          : size < 1048576
            ? `${(size / 1024).toFixed(1)} KB`
            : `${(size / 1048576).toFixed(1)} MB`;
        out.push(`
          <div class="vc-slot-custom">
            <div class="vc-file-meta">
              <span>${escapeHtml(mime)}</span>
              <span>${escapeHtml(text)}</span>
            </div>
          </div>
        `);
      }
      if (definition.desc || definition.description) {
        out.push(`
          <div class="vc-slot-description">
            ${escapeHtml(definition.desc || definition.description || '')}
          </div>
        `);
      }
      return out.join('');
    }
    function runtimePayload(runtimeState) {
      if (
        !runtimeState ||
        typeof runtimeState !==
          'object'
      ) {
        return null;
      }

      if (
        runtimeState.status ===
          'FAILED'
      ) {
        return {
          오류:
            runtimeState.error
              ?.message ||
            '실행에 실패했습니다.'
        };
      }

      const result =
        runtimeState.result;

      if (
        !result ||
        typeof result !==
          'object'
      ) {
        return runtimeState.report ||
          null;
      }

      if (
        typeof result.decision ===
          'boolean'
      ) {
        const branch =
          result.decision
            ? result.outputs?.true
            : result.outputs?.false;

        return {
          판단:
            result.decision
              ? '참'
              : '거짓',
          결과:
            branch ?? null
        };
      }

      const outputs =
        result.outputs &&
        typeof result.outputs ===
          'object'
          ? result.outputs
          : {};

      const values =
        Object.values(outputs);

      if (values.length === 1) {
        return values[0];
      }

      if (values.length > 1) {
        return outputs;
      }

      return (
        result.artifact ??
        result.file ??
        result.report ??
        runtimeState.report ??
        null
      );
    }

    function runtimeStatusLabel(status) {
      return ({
        WAITING: '대기 중',
        RUNNING: '실행 중',
        SUCCESS: '실행 완료',
        FAILED: '실행 실패',
        SKIPPED: '건너뜀'
      })[
        String(status || '')
          .toUpperCase()
      ] || '실행';
    }

    function runtimeKeyLabel(key) {
      const known = {
        title: '제목',
        summary: '요약',
        content: '내용',
        source: '자료',
        topic: '주제',
        criteria: '기준',
        format: '형식',
        filename: '파일명',
        instruction: '변환',
        name: '이름',
        type: '형식',
        result: '결과',
        converted: '변환 완료'
      };

      const text =
        String(key ?? '');

      return known[text] ||
        text
          .replace(
            /([a-z0-9])([A-Z])/g,
            '$1 $2'
          )
          .replace(
            /[_-]+/g,
            ' '
          );
    }

    function runtimePrimitive(value) {
      if (value === null) {
        return '없음';
      }

      if (
        typeof value ===
          'boolean'
      ) {
        return value
          ? '예'
          : '아니오';
      }

      return String(value);
    }

    function runtimeTable(value) {
      if (
        !Array.isArray(value) ||
        value.length < 2 ||
        !value.every(
          item =>
            item &&
            typeof item ===
              'object' &&
            !Array.isArray(item)
        )
      ) {
        return '';
      }

      const keys =
        [...new Set(
          value.flatMap(
            item =>
              Object.keys(item)
          )
        )]
          .slice(0, 6);

      if (!keys.length) {
        return '';
      }

      const rows =
        value
          .slice(0, 30)
          .map(item => `
            <tr>
              ${
                keys
                  .map(key => `
                    <td>
                      ${renderRuntimeValue(
                        item[key],
                        1,
                        true
                      )}
                    </td>
                  `)
                  .join('')
              }
            </tr>
          `)
          .join('');

      return `
        <div class="vc-runtime-table-wrap">
          <table class="vc-runtime-table">
            <thead>
              <tr>
                ${
                  keys
                    .map(key => `
                      <th>
                        ${escapeHtml(
                          runtimeKeyLabel(
                            key
                          )
                        )}
                      </th>
                    `)
                    .join('')
                }
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>
      `;
    }

    function renderRuntimeValue(
      value,
      depth = 0,
      compact = false
    ) {
      if (
        value === null ||
        typeof value ===
          'string' ||
        typeof value ===
          'number' ||
        typeof value ===
          'boolean'
      ) {
        const text =
          runtimePrimitive(
            value
          );

        return compact
          ? `<span class="vc-runtime-inline">${escapeHtml(text)}</span>`
          : `<div class="vc-runtime-text">${escapeHtml(text)}</div>`;
      }

      if (Array.isArray(value)) {
        const table =
          runtimeTable(value);

        if (table) {
          return table;
        }

        if (!value.length) {
          return '<div class="vc-runtime-empty">항목 없음</div>';
        }

        return `
          <ul class="vc-runtime-list">
            ${
              value
                .slice(0, 40)
                .map(item => `
                  <li>
                    ${renderRuntimeValue(
                      item,
                      depth + 1,
                      compact
                    )}
                  </li>
                `)
                .join('')
            }
          </ul>
        `;
      }

      if (
        value &&
        typeof value ===
          'object'
      ) {
        const entries =
          Object.entries(value);

        if (!entries.length) {
          return '<div class="vc-runtime-empty">내용 없음</div>';
        }

        if (depth >= 4) {
          let text = '';

          try {
            text =
              JSON.stringify(value);
          } catch {
            text =
              String(value);
          }

          return `<span class="vc-runtime-inline">${escapeHtml(text)}</span>`;
        }

        return `
          <dl class="vc-runtime-kv">
            ${
              entries
                .slice(0, 40)
                .map(
                  ([key, item]) => `
                    <div class="vc-runtime-kv-row">
                      <dt>
                        ${escapeHtml(
                          runtimeKeyLabel(
                            key
                          )
                        )}
                      </dt>
                      <dd>
                        ${renderRuntimeValue(
                          item,
                          depth + 1,
                          compact
                        )}
                      </dd>
                    </div>
                  `
                )
                .join('')
            }
          </dl>
        `;
      }

      return `<div class="vc-runtime-text">${escapeHtml(String(value ?? ''))}</div>`;
    }

    function renderRuntimeBadge(runtimeState) {
      if (!runtimeState?.status) return '';
      const status =
        String(runtimeState.status).toLowerCase();
      return `
        <span
          class="vc-runtime-badge vc-runtime-${escapeHtml(status)}"
          title="${escapeHtml(runtimeStatusLabel(runtimeState.status))}"
          aria-label="${escapeHtml(runtimeStatusLabel(runtimeState.status))}"
        >
          <span class="vc-runtime-dot"></span>
        </span>
      `;
    }

    function renderRuntimeState(runtimeState) {
      if (!runtimeState?.status) return '';

      const status =
        String(runtimeState.status)
          .toLowerCase();

      const payload =
        runtimePayload(
          runtimeState
        );

      return `
        <div
          class="vc-runtime-result vc-runtime-${escapeHtml(status)}"
          data-action="runtime-result"
        >
          <div class="vc-runtime-result-head">
            <span class="vc-runtime-dot"></span>
            <span>${escapeHtml(runtimeStatusLabel(runtimeState.status))}</span>
          </div>
          ${
            payload == null
              ? ''
              : `<div class="vc-runtime-result-value">${renderRuntimeValue(payload)}</div>`
          }
        </div>
      `;
    }

    function renderPorts(node, ports, direction) {
      const cls = direction === 'input' ? 'vc-input' : 'vc-output';
      return (ports || []).map(port => `
        <div
          class="vc-port-hit ${cls}"
          data-port-dir="${direction}"
          data-port-id="${escapeHtml(port.id)}"
          data-node-id="${escapeHtml(node.id)}"
        >
          <span class="vc-port-anchor">
            <span class="vc-port-pill"></span>
          </span>
          <span class="vc-port-label">${escapeHtml(port.name)}</span>
        </div>
      `).join('');
    }
    function observeNode(element) {
      if (!element || !nodeResizeObserver) return;
      try { nodeResizeObserver.observe(element); } catch {}
    }
    const nodeResizeObserver = new ResizeObserver(entries => {
      if (state.destroyed) return;
      for (const entry of entries) {
        const node = getNode(entry.target?.dataset?.nodeId);
        if (!node) continue;
        positionPorts(entry.target, getDefinition(node.type));
      }
      scheduleConnectionRender();
    });
    observers.push(() => nodeResizeObserver.disconnect());
    function renderNodes() {
      nodesLayer.textContent = '';
      for (const node of state.nodes) {
        const definition = getDefinition(node.type);
        if (!definition) continue;
        const element = document.createElement('div');
        const runtimeState =
          state.runtimeNodes.get(node.id) || null;
        const isImageFile =
          node.type === 'file' &&
          String(node.data?.mime || '').startsWith('image/');
        const classes = ['vc-node'];
        if (node.type === 'file') classes.push('vc-file-node');
        if (isImageFile) classes.push('vc-image-file-node');
        if (node.id === state.selectedNode) classes.push('vc-selected');
        if (node.expanded) classes.push('vc-expanded');
        if (runtimeState?.status) {
          classes.push(
            `vc-runtime-${String(runtimeState.status).toLowerCase()}`
          );
        }
        element.className = classes.join(' ');
        element.dataset.nodeId = node.id;
        element.style.left = `${node.x}px`;
        element.style.top = `${node.y}px`;
        element.style.setProperty('--node-color', definition.color);
        if (isImageFile && node.data?.previewUrl) {
          element.style.setProperty(
            '--vc-file-bg',
            `url("${node.data.previewUrl}")`
          );
        }
        const fileName = node.type === 'file'
          ? node.data?.name || '이름 없는 파일'
          : definition.name;
        const extension =
          node.type === 'file' && fileName.includes('.')
            ? fileName.split('.').pop().toUpperCase()
            : 'FILE';
        element.innerHTML = `
          <div class="vc-node-head">
            <span class="vc-node-icon">${definition.icon || ''}</span>
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
                      ${escapeHtml(extension)}
                    </span>
                  </span>
                `
                : `
                  <span class="vc-node-title">
                    ${escapeHtml(definition.name)}
                  </span>
                `
            }
            ${renderRuntimeBadge(runtimeState)}
            <div class="vc-node-actions">
              <button
                type="button"
                class="vc-node-action vc-node-run${runtimeState?.status === 'RUNNING' ? ' is-running' : ''}"
                data-action="run"
                aria-label="이 노드부터 실행"
                title="실행"
              >
                ${icons.run}
              </button>
              <button
                type="button"
                class="vc-node-action vc-node-toggle"
                data-action="toggle"
                aria-expanded="${String(!!node.expanded)}"
                aria-label="상세 내용 ${node.expanded ? '닫기' : '열기'}"
              >
                ${icons.toggle}
              </button>
            </div>
          </div>
          <div class="vc-node-body">
            ${renderSlotContent(node, definition)}
            ${renderRuntimeState(runtimeState)}
          </div>
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
          ${renderPorts(node, definition.inputs, 'input')}
          ${renderPorts(node, definition.outputs, 'output')}
        `;
        nodesLayer.appendChild(element);
        observeNode(element);
        setNodeExpanded(node, node.expanded, true);
        positionPorts(element, definition);
      }
      markConnectedPorts();
      renderConnections();
    }
    function positionPorts(element, definition) {
      if (!element || !definition) return;
      const height = Math.max(50, element.offsetHeight || 74);
      function place(selector, ports) {
        [...element.querySelectorAll(selector)].forEach((port, index) => {
          const y =
            ((index + 1) / Math.max(1, ports.length + 1)) *
            height;
          port.style.height = '32px';
          port.style.top = `${y - 16}px`;
        });
      }
      place('.vc-port-hit.vc-input', definition.inputs || []);
      place('.vc-port-hit.vc-output', definition.outputs || []);
    }
    function getPortElement(nodeId, portId, direction) {
      return [...nodesLayer.querySelectorAll('.vc-port-hit')].find(
        element =>
          element.dataset.nodeId === String(nodeId) &&
          element.dataset.portId === String(portId) &&
          element.dataset.portDir === direction
      ) || null;
    }
    function portPoint(nodeId, portId, direction) {
      const node = getNode(nodeId);
      const element = getNodeElement(nodeId);
      const definition = getDefinition(node?.type);
      if (!node || !element || !definition) return null;
      const ports =
        direction === 'input'
          ? definition.inputs || []
          : definition.outputs || [];
      const index = ports.findIndex(
        port => String(port.id) === String(portId)
      );
      if (index < 0) return null;
      const portElement = getPortElement(nodeId, portId, direction);
      if (!portElement) return null;
      const nodeRect = element.getBoundingClientRect();
      const portRect = portElement.getBoundingClientRect();
      return screenToWorld(
        direction === 'input' ? nodeRect.left : nodeRect.right,
        portRect.top + portRect.height / 2
      );
    }
    function markConnectedPorts() {
      nodesLayer
        .querySelectorAll('.vc-port-pill.vc-connected')
        .forEach(element => element.classList.remove('vc-connected'));
      for (const connection of state.connections) {
        getPortElement(
          connection.from.node,
          connection.from.port,
          'output'
        )?.querySelector('.vc-port-pill')?.classList.add('vc-connected');
        getPortElement(
          connection.to.node,
          connection.to.port,
          'input'
        )?.querySelector('.vc-port-pill')?.classList.add('vc-connected');
      }
    }
    function removeConnectionElement(id) {
      const element = connectionElements.get(id);
      if (!element) return;
      element.remove();
      connectionElements.delete(id);
    }
    function renderConnections() {
      if (state.destroyed) return;
      const activeIds = new Set();
      for (const connection of state.connections) {
        const from = portPoint(
          connection.from.node,
          connection.from.port,
          'output'
        );
        const to = portPoint(
          connection.to.node,
          connection.to.port,
          'input'
        );
        if (!from || !to) continue;
        activeIds.add(connection.id);
        let path = connectionElements.get(connection.id);
        if (!path) {
          path = svgEl('path');
          path.classList.add('vc-connection');
          path.dataset.connectionId = connection.id;
          path.style.pointerEvents = 'stroke';
          connectionLayer.appendChild(path);
          connectionElements.set(connection.id, path);
        }
        path.setAttribute('d', pathFor(from, to));
        const active =
          state.selectedNode === connection.from.node ||
          state.selectedNode === connection.to.node;
        const runtimeActive =
          state.runtimeConnections.has(
            String(connection.id)
          );

        path.classList.toggle(
          'vc-active',
          active
        );

        path.classList.toggle(
          'vc-runtime-active',
          runtimeActive
        );

        if (
          active ||
          runtimeActive
        ) {
          const definition = getDefinition(
            getNode(connection.from.node)?.type
          );
          path.style.stroke = definition?.color || '';
        } else {
          path.style.stroke = '';
        }
      }
      for (const [id] of connectionElements) {
        if (!activeIds.has(id)) removeConnectionElement(id);
      }
      renderDragConnection();
    }
    function renderDragConnection() {
      dragLayer.textContent = '';
      const drag = state.connectionDrag;
      if (!drag) return;
      let from;
      let to;
      if (drag.direction === 'output') {
        from = portPoint(
          drag.anchor.node,
          drag.anchor.port,
          'output'
        );
        to = screenToWorld(drag.x, drag.y);
      } else {
        from = screenToWorld(drag.x, drag.y);
        to = portPoint(
          drag.anchor.node,
          drag.anchor.port,
          'input'
        );
      }
      if (!from || !to) return;
      const sourceNode = drag.direction === 'output'
        ? getNode(drag.anchor.node)
        : getNode(drag.target?.node);
      const definition = getDefinition(sourceNode?.type);
      const path = svgEl('path', { d: pathFor(from, to) });
      path.classList.add('vc-drag-connection');
      path.style.pointerEvents = 'none';
      if (definition?.color) path.style.stroke = definition.color;
      dragLayer.appendChild(path);
      const dotPoint = drag.direction === 'output' ? from : to;
      const dot = svgEl('circle', {
        cx: dotPoint.x,
        cy: dotPoint.y,
        r: 4
      });
      dot.classList.add('vc-drag-source-dot');
      if (definition?.color) dot.style.fill = definition.color;
      dot.style.pointerEvents = 'none';
      dragLayer.appendChild(dot);
    }
    function screenToWorld(clientX, clientY) {
      const rect = viewport.getBoundingClientRect();
      return {
        x: (clientX - rect.left - state.offset.x) / state.scale,
        y: (clientY - rect.top - state.offset.y) / state.scale
      };
    }
    function renderTransform() {
      world.style.transform =
        `translate(${state.offset.x}px,${state.offset.y}px) scale(${state.scale})`;
      emit('viewport', {
        scale: state.scale,
        offset: { ...state.offset }
      });
    }
    function centerWorkflow() {
      if (!state.nodes.length) return;
      const rect = viewport.getBoundingClientRect();
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const node of state.nodes) {
        const element = getNodeElement(node.id);
        const width = element?.offsetWidth || 190;
        const height = element?.offsetHeight || 74;
        minX = Math.min(minX, node.x);
        minY = Math.min(minY, node.y);
        maxX = Math.max(maxX, node.x + width);
        maxY = Math.max(maxY, node.y + height);
      }
      state.offset.x =
        rect.width / 2 -
        ((minX + maxX) / 2) * state.scale;
      state.offset.y =
        rect.height / 2 -
        ((minY + maxY) / 2) * state.scale -
        60;
      renderTransform();
      renderConnections();
    }
    function setNodeExpanded(node, expanded, immediate = false) {
      const element = getNodeElement(node.id);
      if (!element) return;
      const body = element.querySelector('.vc-node-body');
      const toggle = element.querySelector('.vc-node-toggle');
      node.expanded = !!expanded;
      element.classList.toggle('vc-expanded', node.expanded);
      emit('nodeExpand', {
        id: node.id,
        expanded: node.expanded
      });
      toggle?.setAttribute('aria-expanded', String(node.expanded));
      toggle?.setAttribute(
        'aria-label',
        `상세 내용 ${node.expanded ? '닫기' : '열기'}`
      );
      if (!body) {
        scheduleConnectionRender();
        return;
      }
      if (immediate) {
        body.style.transition = 'none';
        body.style.height = node.expanded ? 'auto' : '0px';
        positionPorts(element, getDefinition(node.type));
        requestAnimationFrame(() => {
          body.style.transition = '';
          positionPorts(element, getDefinition(node.type));
          renderConnections();
        });
        return;
      }
      if (node.expanded) {
        body.style.height = '0px';
        requestAnimationFrame(() => {
          if (!body) return;
          body.style.height = `${body.scrollHeight}px`;
          trackExpansion(element, body);
        });
        return;
      }
      body.style.height = `${body.scrollHeight}px`;
      requestAnimationFrame(() => {
        body.style.height = '0px';
        trackExpansion(element, body);
      });
    }
    function trackExpansion(element, body) {
      let active = true;
      let frame = null;
      const started = performance.now();
      const duration = 340;
      function tick() {
        if (!active) return;
        positionPorts(
          element,
          getDefinition(
            getNode(element.dataset.nodeId)?.type
          )
        );
        renderConnections();
        if (performance.now() - started < duration) {
          frame = requestAnimationFrame(tick);
        } else {
          active = false;
          if (frame !== null) cancelAnimationFrame(frame);
        }
      }
      frame = requestAnimationFrame(tick);
    }
    function selectNode(id) {
      if (id !== null && !getNode(id)) id = null;
      state.selectedNode = id;
      nodesLayer
        .querySelectorAll('.vc-node')
        .forEach(element =>
          element.classList.toggle(
            'vc-selected',
            element.dataset.nodeId === id
          )
        );
      renderConnections();
      emit('select', id);
    }
    function toggleNodeExpanded(id) {
      const node = getNode(id);
      if (!node) return;
      setNodeExpanded(node, !node.expanded);
      selectNode(id);
      emit('change', getWorkflow());
    }
    function portDef(nodeId, portId, direction) {
      const definition = getDefinition(
        getNode(nodeId)?.type
      );
      if (!definition) return null;
      const ports =
        direction === 'input'
          ? definition.inputs
          : definition.outputs;
      return ports.find(
        port => String(port.id) === String(portId)
      ) || null;
    }
    function compatible(output, input) {
      const accepts = Array.isArray(input?.accepts)
        ? input.accepts
        : ['any'];
      return !!output &&
        !!input &&
        (
          accepts.includes('any') ||
          accepts.includes(output.type) ||
          output.type === 'any'
        );
    }
    function wouldCycle(fromId, toId) {
      if (fromId === toId) return true;
      const graph = new Map();
      for (const connection of state.connections) {
        if (!graph.has(connection.from.node)) {
          graph.set(connection.from.node, []);
        }
        graph
          .get(connection.from.node)
          .push(connection.to.node);
      }
      const stack = [toId];
      const seen = new Set();
      while (stack.length) {
        const current = stack.pop();
        if (current === fromId) return true;
        if (seen.has(current)) continue;
        seen.add(current);
        for (const next of graph.get(current) || []) {
          stack.push(next);
        }
      }
      return false;
    }
    function connectionValid(
      fromNodeId,
      fromPortId,
      toNodeId,
      toPortId
    ) {
      const errors = [];
      const source = getNode(fromNodeId);
      const target = getNode(toNodeId);
      const output = portDef(
        fromNodeId,
        fromPortId,
        'output'
      );
      const input = portDef(
        toNodeId,
        toPortId,
        'input'
      );
      if (fromNodeId === toNodeId) {
        errors.push({
          code: 'SELF_CONNECTION',
          message: '노드는 자기 자신에게 연결할 수 없습니다.'
        });
      }
      if (!source) {
        errors.push({
          code: 'MISSING_SOURCE_NODE',
          message: `출발 노드 ${fromNodeId}가 존재하지 않습니다.`
        });
      }
      if (!target) {
        errors.push({
          code: 'MISSING_TARGET_NODE',
          message: `도착 노드 ${toNodeId}가 존재하지 않습니다.`
        });
      }
      if (!output) {
        errors.push({
          code: 'MISSING_SOURCE_PORT',
          message: `출력 포트 ${fromPortId}가 존재하지 않습니다.`
        });
      }
      if (!input) {
        errors.push({
          code: 'MISSING_TARGET_PORT',
          message: `입력 포트 ${toPortId}가 존재하지 않습니다.`
        });
      }
      if (errors.length) {
        return { ok: false, errors };
      }
      if (
        !input.multiple &&
        state.connections.some(
          connection =>
            connection.to.node === toNodeId &&
            connection.to.port === toPortId
        )
      ) {
        errors.push({
          code: 'INPUT_MULTIPLE',
          message: `입력 포트 ${input.name}은 하나의 연결만 허용합니다.`
        });
      }
      if (!compatible(output, input)) {
        errors.push({
          code: 'TYPE_MISMATCH',
          message: `${output.type} → ${input.type} 타입을 연결할 수 없습니다.`
        });
      }
      if (wouldCycle(fromNodeId, toNodeId)) {
        errors.push({
          code: 'CYCLE',
          message: '이 연결은 순환 구조(Cycle)를 만듭니다.'
        });
      }
      return {
        ok: errors.length === 0,
        errors
      };
    }
    function canConnect(specification) {
      const result = connectionValid(
        specification.from.node,
        specification.from.port,
        specification.to.node,
        specification.to.port
      );
      emit('validate', result);
      return result;
    }
    function uniqueConnectionId() {
      let id;
      do {
        id =
          `c-${Date.now().toString(36)}` +
          Math.random().toString(36).slice(2, 8);
      } while (
        state.connections.some(
          connection => connection.id === id
        )
      );
      return id;
    }
    function sameConnection(a, b) {
      return (
        a.from.node === b.from.node &&
        a.from.port === b.from.port &&
        a.to.node === b.to.node &&
        a.to.port === b.to.port
      );
    }
    function connect(from, to, options = {}) {
      const specification = {
        from: {
          node: String(from.node),
          port: String(from.port)
        },
        to: {
          node: String(to.node),
          port: String(to.port)
        }
      };
      const duplicate = state.connections.find(
        connection =>
          sameConnection(
            connection,
            specification
          )
      );
      if (duplicate) {
        disconnect(duplicate.id);
        return null;
      }
      const result = canConnect(specification);
      if (!result.ok) {
        emit('connectionRejected', result);
        return null;
      }
      const connection = {
        id: uniqueConnectionId(),
        from: specification.from,
        to: specification.to
      };
      if (options.data) connection.data = clone(options.data);
      state.connections.push(connection);
      markConnectedPorts();
      renderConnections();
      emit('connect', clone(connection));
      emit('change', getWorkflow());
      return connection;
    }
    function disconnect(id) {
      const index = state.connections.findIndex(
        connection => connection.id === id
      );
      if (index < 0) return false;
      state.connections.splice(index, 1);
      removeConnectionElement(id);
      markConnectedPorts();
      renderConnections();
      emit('disconnect', id);
      emit('change', getWorkflow());
      return true;
    }
    function validate() {
      const errors = [];
      const warnings = [];
      const ids = new Set();
      for (const node of state.nodes) {
        if (ids.has(node.id)) {
          errors.push({
            code: 'DUPLICATE_NODE_ID',
            message: `노드 ID ${node.id}가 중복됩니다.`
          });
        }
        ids.add(node.id);
        if (!registry.has(node.type)) {
          errors.push({
            code: 'UNKNOWN_NODE_TYPE',
            message: `노드 타입 ${node.type}이 등록되어 있지 않습니다.`
          });
        }
      }
      const graph = new Map();
      for (const connection of state.connections) {
        const output = portDef(
          connection.from.node,
          connection.from.port,
          'output'
        );
        const input = portDef(
          connection.to.node,
          connection.to.port,
          'input'
        );
        if (!getNode(connection.from.node)) {
          errors.push({
            code: 'MISSING_SOURCE_NODE',
            message: `연결 ${connection.id}의 출발 노드가 없습니다.`
          });
        }
        if (!getNode(connection.to.node)) {
          errors.push({
            code: 'MISSING_TARGET_NODE',
            message: `연결 ${connection.id}의 도착 노드가 없습니다.`
          });
        }
        if (!output) {
          errors.push({
            code: 'MISSING_SOURCE_PORT',
            message: `연결 ${connection.id}의 출력 포트가 없습니다.`
          });
        }
        if (!input) {
          errors.push({
            code: 'MISSING_TARGET_PORT',
            message: `연결 ${connection.id}의 입력 포트가 없습니다.`
          });
        }
        if (
          output &&
          input &&
          !compatible(output, input)
        ) {
          errors.push({
            code: 'TYPE_MISMATCH',
            message: `${output.type} → ${input.type} 타입이 호환되지 않습니다.`
          });
        }
        if (!graph.has(connection.from.node)) {
          graph.set(connection.from.node, []);
        }
        graph
          .get(connection.from.node)
          .push(connection.to.node);
      }
      const visiting = new Set();
      const visited = new Set();
      function dfs(id) {
        if (visiting.has(id)) return true;
        if (visited.has(id)) return false;
        visiting.add(id);
        for (const next of graph.get(id) || []) {
          if (dfs(next)) return true;
        }
        visiting.delete(id);
        visited.add(id);
        return false;
      }
      for (const node of state.nodes) {
        if (
          !visited.has(node.id) &&
          dfs(node.id)
        ) {
          errors.push({
            code: 'CYCLE',
            message: '워크플로우에 순환 구조(Cycle)가 존재합니다.'
          });
          break;
        }
      }
      const connected = new Set();
      for (const connection of state.connections) {
        connected.add(connection.from.node);
        connected.add(connection.to.node);
      }
      for (const node of state.nodes) {
        if (!connected.has(node.id)) {
          warnings.push({
            code: 'ISOLATED_NODE',
            node: node.id,
            message:
              `노드 '${getDefinition(node.type)?.name || node.type}'가 연결되지 않았습니다.`
          });
        }
      }
      const result = {
        valid: errors.length === 0,
        errors,
        warnings
      };
      emit('validate', result);
      return result;
    }
    function getWorkflow() {
      return {
        nodes: clone(state.nodes),
        connections: clone(state.connections)
      };
    }
    function getWorkflowIR() {
      return {
        nodes: state.nodes.map(node => ({
          id: node.id,
          type: node.type,
          params: clone(node.data?.params || {})
        })),
        links: state.connections
          .filter(
            connection =>
              connection.data?.kind !== 'data'
          )
          .map(connection => [
            `${connection.from.node}.${connection.from.port}`,
            `${connection.to.node}.${connection.to.port}`
          ]),
        data: state.connections
          .filter(
            connection =>
              connection.data?.kind === 'data'
          )
          .map(connection => [
            `${connection.from.node}.${connection.from.port}`,
            `${connection.to.node}.${connection.to.port}`
          ])
      };
    }
    function convertEdges(edges, kind) {
      return (
        Array.isArray(edges)
          ? edges
          : []
      )
        .map(edge => {
          try {
            const from = endpoint(edge[0]);
            const to = endpoint(edge[1]);
            return {
              id:
                `c-${Math.random().toString(36).slice(2, 9)}`,
              from,
              to,
              data: { kind }
            };
          } catch {
            return null;
          }
        })
        .filter(Boolean);
    }
    function setState(saved = {}) {
      const workflow = saved.workflow || saved;
      state.nodes =
        Array.isArray(workflow?.nodes)
          ? workflow.nodes
              .map(normalizeNode)
              .filter(node => registry.has(node.type))
          : [];
      state.connections =
        Array.isArray(workflow?.connections)
          ? clone(workflow.connections)
          : [
              ...convertEdges(workflow?.links, 'flow'),
              ...convertEdges(workflow?.data, 'data')
            ];
      state.connections = state.connections
        .map(connection => ({
          id: String(
            connection.id ||
            `c-${Math.random().toString(36).slice(2, 8)}`
          ),
          from: {
            node: String(connection.from?.node || ''),
            port: String(connection.from?.port || '')
          },
          to: {
            node: String(connection.to?.node || ''),
            port: String(connection.to?.port || '')
          },
          ...(connection.data
            ? { data: clone(connection.data) }
            : {})
        }))
        .filter(
          connection =>
            getNode(connection.from.node) &&
            getNode(connection.to.node)
        );
      if (saved.viewport) {
        state.scale = clamp(
          Number(saved.viewport.scale) || 1,
          MIN_SCALE,
          MAX_SCALE
        );
        state.offset = {
          x: Number(saved.viewport?.offset?.x) || 0,
          y: Number(saved.viewport?.offset?.y) || 0
        };
      }
      state.selectedNode = null;
      render();
      emit('change', getWorkflow());
      return api;
    }
    function applyWorkflowIR(spec, options = {}) {
  if (
    !spec ||
    typeof spec !== 'object' ||
    !Array.isArray(spec.nodes)
  ) {
    throw new Error('workflow spec가 올바르지 않습니다.');
  }

  const previousNodes = new Map(
    state.nodes.map(node => [node.id, node])
  );

  const previousNodeCount = previousNodes.size;

  const seenNodeIds = new Set();

  const nextNodes = spec.nodes.map((node, index) => {
    if (
      !node ||
      typeof node !== 'object' ||
      Array.isArray(node)
    ) {
      throw new Error(`잘못된 노드입니다: ${index}`);
    }

    if (
      typeof node.id !== 'string' ||
      !node.id.trim()
    ) {
      throw new Error(`노드 ID가 올바르지 않습니다: ${index}`);
    }

    const id = node.id.trim();

    if (seenNodeIds.has(id)) {
      throw new Error(`중복된 노드 ID: ${id}`);
    }

    seenNodeIds.add(id);

    if (
      typeof node.type !== 'string' ||
      !registry.has(node.type)
    ) {
      throw new Error(`존재하지 않는 노드 타입: ${node.type}`);
    }

    const previous =
      previousNodes.get(id);

    const hasPosition =
      Number.isFinite(Number(node.x)) &&
      Number.isFinite(Number(node.y));

    const previousData =
      previous?.data &&
      typeof previous.data === 'object'
        ? clone(previous.data)
        : {};

    const incomingData =
      node.data &&
      typeof node.data === 'object'
        ? clone(node.data)
        : {};

    const params =
      node.params &&
      typeof node.params === 'object' &&
      !Array.isArray(node.params)
        ? clone(node.params)
        : previousData.params &&
          typeof previousData.params === 'object'
          ? clone(previousData.params)
          : {};

    return normalizeNode({
      id,
      type: node.type,
      x: hasPosition
        ? Number(node.x)
        : previous?.x ?? 0,
      y: hasPosition
        ? Number(node.y)
        : previous?.y ?? 0,
      expanded:
        node.expanded !== undefined
          ? !!node.expanded
          : previous?.expanded ??
            (options.expanded ?? true),
      data: {
        ...previousData,
        ...incomingData,
        params
      }
    });
  });

  const nextNodeMap = new Map(
    nextNodes.map(node => [node.id, node])
  );

  function buildConnections(edges, kind) {
    if (edges === undefined) {
      return [];
    }

    if (!Array.isArray(edges)) {
      throw new Error(
        `${kind} 연결이 배열이 아닙니다.`
      );
    }

    const seen = new Set();
    const result = [];

    for (
      const edge of edges
    ) {
      if (
        !Array.isArray(edge) ||
        edge.length !== 2
      ) {
        throw new Error(
          `잘못된 ${kind} 연결입니다.`
        );
      }

      const from =
        endpoint(edge[0]);

      const to =
        endpoint(edge[1]);

      const fromNode =
        nextNodeMap.get(from.node);

      const toNode =
        nextNodeMap.get(to.node);

      if (!fromNode) {
        throw new Error(
          `${kind}: 출발 노드가 없습니다: ${from.node}`
        );
      }

      if (!toNode) {
        throw new Error(
          `${kind}: 도착 노드가 없습니다: ${to.node}`
        );
      }

      const output =
        (getDefinition(fromNode.type)?.outputs || [])
          .find(port => String(port.id) === String(from.port));

      const input =
        (getDefinition(toNode.type)?.inputs || [])
          .find(port => String(port.id) === String(to.port));

      if (!output) {
        throw new Error(
          `${kind}: ${fromNode.type}.${from.port}는 존재하지 않는 출력 포트입니다.`
        );
      }

      if (!input) {
        throw new Error(
          `${kind}: ${toNode.type}.${to.port}는 존재하지 않는 입력 포트입니다.`
        );
      }

      if (
        !compatible(
          output,
          input
        )
      ) {
        throw new Error(
          `${kind}: ${output.type} → ${input.type} 타입이 호환되지 않습니다.`
        );
      }

      const key =
        `${edge[0]}->${edge[1]}`;

      if (seen.has(key)) {
        throw new Error(
          `${kind}: 중복된 연결입니다: ${key}`
        );
      }

      seen.add(key);

      result.push({
        id:
          `c-${Math.random().toString(36).slice(2, 9)}`,
        from,
        to,
        data: { kind }
      });
    }

    return result;
  }

  const connections = [
    ...buildConnections(
      spec.links,
      'links'
    ),
    ...buildConnections(
      spec.data,
      'data'
    )
  ];

  const sharedNodeCount =
    nextNodes.reduce(
      (count, node) =>
        count +
        (
          previousNodes.has(node.id)
            ? 1
            : 0
        ),
      0
    );

  const isNewWorkflow =
    previousNodeCount === 0 ||
    (
      nextNodes.length > 0 &&
      sharedNodeCount === 0
    );

  state.nodes =
    nextNodes;

  state.connections =
    connections;

  state.selectedNode = null;

  render();

  const GAP_X = 60;
  const DEFAULT_Y = 0;

  const nodeInfo = new Map();

  for (const node of state.nodes) {
    const element =
      getNodeElement(node.id);

    nodeInfo.set(node.id, {
      width: Math.max(
        190,
        element?.offsetWidth || 190
      ),
      height: Math.max(
        50,
        element?.offsetHeight || 74
      )
    });
  }

  const flowConnections =
    state.connections.filter(
      connection =>
        connection.data?.kind !== 'data'
    );

  const incoming =
    new Map();

  const outgoing =
    new Map();

  for (const node of state.nodes) {
    incoming.set(
      node.id,
      []
    );

    outgoing.set(
      node.id,
      []
    );
  }

  for (
    const connection of flowConnections
  ) {
    const from =
      connection.from.node;

    const to =
      connection.to.node;

    if (
      !incoming.has(to) ||
      !outgoing.has(from)
    ) {
      continue;
    }

    if (
      !outgoing
        .get(from)
        .includes(to)
    ) {
      outgoing
        .get(from)
        .push(to);
    }

    if (
      !incoming
        .get(to)
        .includes(from)
    ) {
      incoming
        .get(to)
        .push(from);
    }
  }

  const nodeOrder =
    new Map(
      state.nodes.map(
        (node, index) => [
          node.id,
          index
        ]
      )
    );

  /*
   * 일반 적용에서는 좌표가 없는 신규 노드만 배치한다.
   * layout 옵션을 지정하면 모든 노드를 명시적으로 다시 배치한다.
   */
  const nodesNeedingPosition =
    state.nodes.filter(
      node => {
        const source =
          spec.nodes.find(
            item =>
              String(item.id) ===
              node.id
          );

        const hasExplicitPosition =
          Number.isFinite(
            Number(source?.x)
          ) &&
          Number.isFinite(
            Number(source?.y)
          );

        return options.layout === true || (
          !hasExplicitPosition &&
          !previousNodes.has(node.id)
        );
      }
    );

  let topologicalOrder = [];

  if (
    nodesNeedingPosition.length
  ) {
    let baseY = DEFAULT_Y;

    if (
      isNewWorkflow ||
      options.layout === true
    ) {
      const GAP_X = 60;
      const GAP_Y = 36;
      const nodeOrder =
        new Map(
          state.nodes.map(
            (node, index) => [
              node.id,
              index
            ]
          )
        );

      function buildLayoutGraph(edges) {
        const incoming = new Map();
        const outgoing = new Map();

        for (const node of state.nodes) {
          incoming.set(node.id, []);
          outgoing.set(node.id, []);
        }

        for (const connection of edges) {
          const from = connection.from.node;
          const to = connection.to.node;

          if (
            from === to ||
            !incoming.has(from) ||
            !incoming.has(to)
          ) {
            continue;
          }

          if (
            !outgoing.get(from).includes(to)
          ) {
            outgoing.get(from).push(to);
          }

          if (
            !incoming.get(to).includes(from)
          ) {
            incoming.get(to).push(from);
          }
        }

        return {
          incoming,
          outgoing
        };
      }

      function topologicalSort(graph) {
        const indegree = new Map();

        for (const node of state.nodes) {
          indegree.set(
            node.id,
            graph.incoming.get(node.id)?.length || 0
          );
        }

        const queue =
          state.nodes
            .filter(
              node =>
                (indegree.get(node.id) || 0) === 0
            )
            .sort(
              (a, b) =>
                nodeOrder.get(a.id) -
                nodeOrder.get(b.id)
            )
            .map(node => node.id);

        const order = [];

        while (queue.length) {
          const currentId = queue.shift();
          order.push(currentId);

          const children =
            (graph.outgoing.get(currentId) || [])
              .slice()
              .sort(
                (a, b) =>
                  nodeOrder.get(a) -
                  nodeOrder.get(b)
              );

          for (const childId of children) {
            const next =
              (indegree.get(childId) || 0) - 1;

            indegree.set(childId, next);

            if (next === 0) {
              queue.push(childId);
              queue.sort(
                (a, b) =>
                  nodeOrder.get(a) -
                  nodeOrder.get(b)
              );
            }
          }
        }

        return order;
      }

      let layoutGraph =
        buildLayoutGraph(
          state.connections
        );

      topologicalOrder =
        topologicalSort(
          layoutGraph
        );

      /*
       * data 관계까지 합친 그래프에서 순환이 생기면
       * 실행 순서인 links만 사용해 안전하게 배치한다.
       */
      if (
        topologicalOrder.length !==
        state.nodes.length
      ) {
        layoutGraph =
          buildLayoutGraph(
            flowConnections
          );

        topologicalOrder =
          topologicalSort(
            layoutGraph
          );
      }

      const orderedIds =
        new Set(topologicalOrder);

      for (const node of state.nodes) {
        if (!orderedIds.has(node.id)) {
          topologicalOrder.push(node.id);
        }
      }

      const layers =
        new Map();

      for (const nodeId of topologicalOrder) {
        let layer = 0;

        for (
          const parentId
            of layoutGraph.incoming.get(nodeId) || []
        ) {
          layer =
            Math.max(
              layer,
              (layers.get(parentId) || 0) + 1
            );
        }

        layers.set(
          nodeId,
          layer
        );
      }

      const layerNodes =
        new Map();

      for (const nodeId of topologicalOrder) {
        const layer =
          layers.get(nodeId) || 0;

        if (!layerNodes.has(layer)) {
          layerNodes.set(layer, []);
        }

        layerNodes
          .get(layer)
          .push(nodeId);
      }

      const maxLayer =
        Math.max(
          ...layerNodes.keys(),
          0
        );

      const layerX =
        new Map();

      let currentX = 0;

      for (
        let layer = 0;
        layer <= maxLayer;
        layer++
      ) {
        const ids =
          layerNodes.get(layer) || [];

        const maxWidth =
          Math.max(
            190,
            ...ids.map(
              id =>
                nodeInfo.get(id)?.width || 190
            )
          );

        layerX.set(
          layer,
          currentX
        );

        currentX +=
          maxWidth +
          GAP_X;
      }

      const centerY =
        new Map();

      for (
        let layer = 0;
        layer <= maxLayer;
        layer++
      ) {
        const ids =
          layerNodes.get(layer) || [];

        ids.sort(
          (a, b) => {
            if (layer === 0) {
              return (
                nodeOrder.get(a) -
                nodeOrder.get(b)
              );
            }

            const parentsA =
              layoutGraph.incoming.get(a) || [];

            const parentsB =
              layoutGraph.incoming.get(b) || [];

            const averageA =
              parentsA.length
                ? parentsA.reduce(
                    (sum, parentId) =>
                      sum +
                      (centerY.get(parentId) || 0),
                    0
                  ) / parentsA.length
                : Number.POSITIVE_INFINITY;

            const averageB =
              parentsB.length
                ? parentsB.reduce(
                    (sum, parentId) =>
                      sum +
                      (centerY.get(parentId) || 0),
                    0
                  ) / parentsB.length
                : Number.POSITIVE_INFINITY;

            if (averageA !== averageB) {
              return averageA - averageB;
            }

            return (
              nodeOrder.get(a) -
              nodeOrder.get(b)
            );
          }
        );

        const totalHeight =
          ids.reduce(
            (sum, nodeId) =>
              sum +
              (nodeInfo.get(nodeId)?.height || 74),
            0
          ) +
          Math.max(
            0,
            ids.length - 1
          ) * GAP_Y;

        let y =
          baseY -
          totalHeight / 2;

        for (const nodeId of ids) {
          const node =
            nextNodeMap.get(nodeId);

          if (!node) {
            continue;
          }

          const height =
            nodeInfo.get(nodeId)?.height || 74;

          node.x =
            layerX.get(layer) || 0;

          node.y =
            y;

          centerY.set(
            nodeId,
            y + height / 2
          );

          y +=
            height +
            GAP_Y;
        }
      }
    } else {
      const nodeOrder =
        new Map(
          state.nodes.map(
            (node, index) => [
              node.id,
              index
            ]
          )
        );

      const positioned =
        new Set(
          state.nodes
            .filter(
              node =>
                previousNodes.has(node.id) ||
                !nodesNeedingPosition.some(
                  target =>
                    target.id === node.id
                )
            )
            .map(
              node =>
                node.id
            )
        );

      let maxX = 0;

      for (
        const node of state.nodes
      ) {
        if (!positioned.has(node.id)) {
          continue;
        }

        const info =
          nodeInfo.get(node.id);

        maxX =
          Math.max(
            maxX,
            node.x +
              (
                info?.width ||
                190
              )
          );

        if (Number.isFinite(node.y)) {
          baseY = node.y;
        }
      }

      if (positioned.size) {
        maxX += GAP_X;
      }

      for (
        const nodeId of topologicalOrder
      ) {
        const node =
          nextNodeMap.get(nodeId);

        if (!node) {
          continue;
        }

        if (
          !nodesNeedingPosition.some(
            target =>
              target.id === nodeId
          )
        ) {
          continue;
        }

        const info =
          nodeInfo.get(nodeId);

        node.x =
          maxX;

        node.y =
          baseY;

        maxX +=
          (
            info?.width ||
            190
          ) +
          GAP_X;

        positioned.add(nodeId);
      }
    }

    render();
  }

  for (
    const node of state.nodes
  ) {
    const element =
      getNodeElement(node.id);

    if (!element) {
      continue;
    }

    positionPorts(
      element,
      getDefinition(node.type)
    );
  }

  renderConnections();

  /*
   * center는 최초 생성 또는 완전 교체일 때만 허용한다.
   * 일반적인 Planner 갱신에서는 사용자의 viewport를 유지한다.
   */
  if (
    options.center !== false &&
    (
      isNewWorkflow ||
      options.layout === true
    )
  ) {
    centerWorkflow();
  }

  emit(
    'workflowApplied',
    getWorkflow()
  );

  emit(
    'change',
    getWorkflow()
  );

  return getWorkflow();
}
    function findNewNodePosition(ignoreNodeId = null) {
      const rect = viewport.getBoundingClientRect();
      const center = screenToWorld(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2
      );
      const width = 190;
      const height = 60;
      const gap = 24;
      const spots = [
        [0, 0],
        [0, height + gap],
        [0, -height - gap],
        [-width - gap, 0],
        [width + gap, 0]
      ];
      for (const [dx, dy] of spots) {
        const x =
          center.x -
          width / 2 +
          dx;
        const y =
          center.y -
          height / 2 +
          dy;
        const occupied =
          state.nodes.some(
            node =>
              node.id !== ignoreNodeId &&
              Math.abs(node.x - x) <
                width + gap &&
              Math.abs(node.y - y) <
                height + gap
          );
        if (!occupied) {
          return { x, y };
        }
      }
      return {
        x: center.x - width / 2,
        y: center.y - height / 2
      };
    }
    function addNode(type, data = {}) {
      if (!registry.has(type)) {
        throw new Error(
          `존재하지 않는 노드 타입: ${type}`
        );
      }
      const position =
        data.x != null &&
        data.y != null
          ? {
              x: Number(data.x),
              y: Number(data.y)
            }
          : findNewNodePosition();
      const node = normalizeNode({
        id:
          data.id ||
          `n-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        type,
        x: position.x,
        y: position.y,
        expanded:
          data.expanded !== undefined
            ? !!data.expanded
            : true,
        data: data.data || {}
      });
      state.nodes.push(node);
      state.selectedNode = node.id;
      render();
      emit('nodeAdd', clone(node));
      emit(
        'change',
        getWorkflow()
      );
      return node;
    }
    let layoutAnimationFrame = null;

    function layoutWorkflow() {
      const workflow = getWorkflowIR();

      if (
        global.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      ) {
        emit('layoutStart');

        applyWorkflowIR(
          workflow,
          {
            layout: true,
            center: true
          }
        );

        emit('layoutEnd');
        return api;
      }

      if (layoutAnimationFrame !== null) {
        cancelAnimationFrame(layoutAnimationFrame);
        layoutAnimationFrame = null;
      }

      emit('layoutStart');

      const startPositions = new Map(
        state.nodes.map(node => [
          node.id,
          {
            x: node.x,
            y: node.y
          }
        ])
      );

      const startOffset = {
        x: state.offset.x,
        y: state.offset.y
      };

      applyWorkflowIR(
        workflow,
        {
          layout: true,
          center: true
        }
      );

      const targetPositions = new Map(
        state.nodes.map(node => [
          node.id,
          {
            x: node.x,
            y: node.y
          }
        ])
      );

      const targetOffset = {
        x: state.offset.x,
        y: state.offset.y
      };

      for (const node of state.nodes) {
        const start =
          startPositions.get(node.id);

        if (!start) continue;

        node.x = start.x;
        node.y = start.y;
      }

      state.offset.x = startOffset.x;
      state.offset.y = startOffset.y;

      render();

      const started = performance.now();
      const duration = 520;

      const spring = progress => {
        if (progress >= 1) return 1;

        const raw =
          1 -
          (1 + 6 * progress) *
          Math.exp(-6 * progress);

        const end =
          1 -
          7 *
          Math.exp(-6);

        return Math.min(
          1,
          raw / end
        );
      };

      function frame(now) {
        const progress =
          Math.min(
            1,
            (now - started) / duration
          );

        const eased =
          spring(progress);

        for (const node of state.nodes) {
          const start =
            startPositions.get(node.id);

          const target =
            targetPositions.get(node.id);

          if (!start || !target) continue;

          node.x =
            start.x +
            (target.x - start.x) *
            eased;

          node.y =
            start.y +
            (target.y - start.y) *
            eased;

          const element =
            getNodeElement(node.id);

          if (element) {
            element.style.left =
              `${node.x}px`;

            element.style.top =
              `${node.y}px`;
          }
        }

        state.offset.x =
          startOffset.x +
          (targetOffset.x - startOffset.x) *
          eased;

        state.offset.y =
          startOffset.y +
          (targetOffset.y - startOffset.y) *
          eased;

        renderTransform();
        renderConnections();

        if (progress < 1) {
          layoutAnimationFrame =
            requestAnimationFrame(frame);
          return;
        }

        layoutAnimationFrame = null;

        for (const node of state.nodes) {
          const target =
            targetPositions.get(node.id);

          if (!target) continue;

          node.x = target.x;
          node.y = target.y;
        }

        state.offset.x = targetOffset.x;
        state.offset.y = targetOffset.y;

        render();
        emit('change', getWorkflow());
        emit('layoutEnd');
      }

      layoutAnimationFrame =
        requestAnimationFrame(frame);

      return api;
    }
    function removeNode(id) {
      const node = getNode(id);
      if (!node) {
        return false;
      }
      state.nodes =
        state.nodes.filter(
          item => item.id !== id
        );
      const removed =
        state.connections.filter(
          connection =>
            connection.from.node === id ||
            connection.to.node === id
        );
      state.connections =
        state.connections.filter(
          connection =>
            connection.from.node !== id &&
            connection.to.node !== id
        );
      for (const connection of removed) {
        removeConnectionElement(connection.id);
      }
      if (state.selectedNode === id) {
        state.selectedNode = null;
      }
      render();
      emit('nodeRemove', clone(node));
      emit(
        'change',
        getWorkflow()
      );
      return true;
    }
    function setInteractionEnabled(enabled) {
      state.interactionEnabled = !!enabled;
      if (!state.interactionEnabled) {
        state.pointers.clear();
        state.nodeDrag = null;
        state.canvasPan = null;
        state.pinch = null;
        cancelConnectionDrag();
      }
      emit(
        'interaction',
        state.interactionEnabled
      );
      return api;
    }
    function beginConnectionDrag(event, port, node) {
      const direction =
        port.dataset.portDir;
      if (
        direction !== 'output' &&
        direction !== 'input'
      ) {
        return;
      }
      state.connectionDrag = {
        pointerId: event.pointerId,
        direction,
        anchor: {
          node: node.id,
          port: port.dataset.portId
        },
        x: event.clientX,
        y: event.clientY
      };
      try {
        viewport.setPointerCapture(
          event.pointerId
        );
      } catch {}
      emit('connectionDragStart', clone(state.connectionDrag));
      renderDragConnection();
    }
    function cancelConnectionDrag(notify = true) {
      const drag = state.connectionDrag;
      if (!drag) {
        dragLayer.textContent = '';
        return false;
      }
      if (notify) {
        emit('connectionDragEnd', {
          connected: false,
          cancelled: true,
          x: drag.x,
          y: drag.y
        });
      }
      try {
        viewport.releasePointerCapture(
          drag.pointerId
        );
      } catch {}
      state.connectionDrag = null;
      dragLayer.textContent = '';
      renderConnections();
      return true;
    }
    function getPortAtWorldPoint(
      worldPoint,
      direction
    ) {
      const tolerance = 20;
      for (const node of state.nodes) {
        const definition = getDefinition(
          node.type
        );
        if (!definition) continue;
        const ports =
          direction === 'input'
            ? definition.inputs || []
            : definition.outputs || [];
        const element =
          getNodeElement(node.id);
        if (!element) continue;
        const height =
          Math.max(
            50,
            element.offsetHeight || 74
          );
        const width =
          element.offsetWidth || 190;
        for (
          let index = 0;
          index < ports.length;
          index++
        ) {
          const y =
            ((index + 1) /
              Math.max(
                1,
                ports.length + 1
              )) *
            height;
          const centerX =
            direction === 'input'
              ? node.x
              : node.x + width;
          const centerY =
            node.y + y;
          if (
            Math.abs(
              worldPoint.x - centerX
            ) <= tolerance &&
            Math.abs(
              worldPoint.y - centerY
            ) <= tolerance
          ) {
            return {
              node: node.id,
              port: String(
                ports[index].id
              )
            };
          }
        }
      }
      return null;
    }
    function finishConnection(event) {
      const drag = state.connectionDrag;
      if (!drag) return false;
      const point = screenToWorld(
        event.clientX,
        event.clientY
      );
      let targetPort = null;
      if (
        drag.direction === 'output'
      ) {
        targetPort =
          getPortAtWorldPoint(
            point,
            'input'
          );
        if (targetPort) {
          connect(
            drag.anchor,
            targetPort
          );
        }
      } else {
        targetPort =
          getPortAtWorldPoint(
            point,
            'output'
          );
        if (targetPort) {
          connect(
            targetPort,
            drag.anchor
          );
        }
      }
      emit('connectionDragEnd', {
        connected: !!targetPort,
        target: targetPort ? clone(targetPort) : null,
        x: event.clientX,
        y: event.clientY
      });
      emit('connectionDragEnd', {
        connected: !!targetPort,
        cancelled: false,
        target: targetPort ? clone(targetPort) : null,
        x: event.clientX,
        y: event.clientY
      });
      cancelConnectionDrag(false);
      return !!targetPort;
    }
    listen(
      nodesLayer,
      'pointerdown',
      event => {
        if (
          event.target.closest(
            '.vc-node-action'
          ) ||
          event.target.closest(
            '.vc-slot-param'
          ) ||
          event.target.closest(
            '.vc-runtime-result'
          )
        ) {
          event.stopPropagation();
        }
      },
      { passive: false }
    );
    listen(
      nodesLayer,
      'click',
      event => {
        const action =
          event.target.closest(
            '[data-action]'
          );

        if (!action) {
          const element =
            event.target.closest(
              '.vc-node'
            );

          if (!element) {
            return;
          }

          if (
            performance.now() -
              state.lastNodeDragEndAt <
            180
          ) {
            return;
          }

          const node =
            getNode(
              element.dataset.nodeId
            );

          if (!node) {
            return;
          }

          emit(
            'nodeClick',
            {
              id: node.id,
              node: clone(node)
            }
          );

          return;
        }

        const element =
          action.closest('.vc-node');
        if (!element) return;
        event.preventDefault();
        event.stopPropagation();
        const node =
          getNode(
            element.dataset.nodeId
          );
        if (!node) return;
        if (
          action.dataset.action ===
          'run'
        ) {
          emit(
            'nodeRun',
            {
              id: node.id,
              node: clone(node),
              mode: 'spread'
            }
          );
          return;
        }
        if (
          action.dataset.action ===
          'toggle'
        ) {
          toggleNodeExpanded(
            node.id
          );
          return;
        }
        if (
          action.dataset.action ===
          'delete'
        ) {
          removeNode(node.id);
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

    if (node.expanded) {
      requestAnimationFrame(() => {
        const body =
          element.querySelector(
            '.vc-node-body'
          );

        if (!body) return;

        body.style.height =
          `${body.scrollHeight}px`;

        positionPorts(
          element,
          getDefinition(node.type)
        );

        renderConnections();
      });
    }

    emit('nodeEdit', {
      id: node.id,
      param: input.dataset.paramId,
      value: input.value
    });
    emit(
      'change',
      getWorkflow()
    );
  }
);
    /*
      연결선은 canvas 이동 이벤트보다
      먼저 먹는다.
    */
    listen(
      connectionLayer,
      'pointerdown',
      event => {
        const path =
          event.target.closest(
            '.vc-connection'
          );
        if (!path) return;
        event.preventDefault();
        event.stopPropagation();
      },
      { passive: false }
    );
    listen(
      connectionLayer,
      'click',
      event => {
        const path =
          event.target.closest(
            '.vc-connection'
          );
        if (!path) return;
        event.preventDefault();
        event.stopPropagation();
        const id =
          path.dataset.connectionId;
        if (id) {
          disconnect(id);
        }
      }
    );
    listen(
      viewport,
      'pointerdown',
      event => {
        if (!state.interactionEnabled) {
          return;
        }
        state.pointers.set(
          event.pointerId,
          {
            x: event.clientX,
            y: event.clientY
          }
        );
        if (
          state.pointers.size >= 2
        ) {
          cancelConnectionDrag();
          if (state.nodeDrag) {
            finishNodeDrag();
          }
          state.canvasPan = null;
          const [a, b] =
            [...state.pointers.values()];
          const center = mid(a, b);
          const anchor =
            screenToWorld(
              center.x,
              center.y
            );
          state.pinch = {
            d: Math.max(
              1,
              dist(a, b)
            ),
            s: state.scale,
            x: anchor.x,
            y: anchor.y
          };
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
          beginConnectionDrag(
            event,
            port,
            node
          );
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
            pointerId: event.pointerId,
            node,
            startX: event.clientX,
            startY: event.clientY,
            nodeX: node.x,
            nodeY: node.y,
            moved: false,
            wasExpanded: !!node.expanded
          };
          try {
            viewport.setPointerCapture(
              event.pointerId
            );
          } catch {}
          return;
        }
        selectNode(null);
        state.canvasPan = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          startOffsetX: state.offset.x,
          startOffsetY: state.offset.y,
          moved: false
        };
        try {
          viewport.setPointerCapture(
            event.pointerId
          );
        } catch {}
      },
      { passive: false }
    );
    listen(
      viewport,
      'pointermove',
      event => {
        if (
          !state.interactionEnabled
        ) {
          return;
        }
        const tracked =
          state.pointers.has(
            event.pointerId
          );
        if (!tracked) return;
        state.pointers.set(
          event.pointerId,
          {
            x: event.clientX,
            y: event.clientY
          }
        );
        if (
          state.pointers.size >= 2
        ) {
          if (state.nodeDrag) {
            finishNodeDrag();
          }
          cancelConnectionDrag();
          state.canvasPan = null;
          const points =
            [...state.pointers.values()];
          if (!state.pinch) {
            const center =
              mid(
                points[0],
                points[1]
              );
            const anchor =
              screenToWorld(
                center.x,
                center.y
              );
            state.pinch = {
              d: Math.max(
                1,
                dist(
                  points[0],
                  points[1]
                )
              ),
              s: state.scale,
              x: anchor.x,
              y: anchor.y
            };
          }
          const currentDistance =
            dist(
              points[0],
              points[1]
            );
          const center =
            mid(
              points[0],
              points[1]
            );
          const rect =
            viewport.getBoundingClientRect();
          state.scale =
            clamp(
              state.pinch.s *
                (
                  currentDistance /
                  state.pinch.d
                ),
              MIN_SCALE,
              MAX_SCALE
            );
          state.offset.x =
            center.x -
            rect.left -
            state.pinch.x *
              state.scale;
          state.offset.y =
            center.y -
            rect.top -
            state.pinch.y *
              state.scale;
          renderTransform();
          scheduleConnectionRender();
          return;
        }
        if (
          state.connectionDrag?.pointerId ===
          event.pointerId
        ) {
          event.preventDefault();
          state.connectionDrag.x =
            event.clientX;
          state.connectionDrag.y =
            event.clientY;
          emit('connectionDragMove', {
            ...clone(state.connectionDrag),
            x: event.clientX,
            y: event.clientY
          });
          scheduleConnectionRender();
          return;
        }
        if (
          state.nodeDrag?.pointerId ===
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
            drag.moved = true;
            const element =
              getNodeElement(
                drag.node.id
              );
            if (element) {
              element.classList.add(
                'vc-dragging'
              );
              emit('nodeDragStart', {
                id: drag.node.id,
                x: event.clientX,
                y: event.clientY
              });
              if (
                drag.wasExpanded
              ) {
                setNodeExpanded(
                  drag.node,
                  false,
                  true
                );
              }
            }
          }
          if (!drag.moved) {
            return;
          }
          event.preventDefault();
          drag.node.x =
            drag.nodeX +
            dx /
              state.scale;
          drag.node.y =
            drag.nodeY +
            dy /
              state.scale;
          const element =
            getNodeElement(
              drag.node.id
            );
          if (element) {
            element.style.left =
              `${drag.node.x}px`;
            element.style.top =
              `${drag.node.y}px`;
            positionPorts(
              element,
              getDefinition(
                drag.node.type
              )
            );
          }
          emit('nodeDragMove', {
            id: drag.node.id,
            x: event.clientX,
            y: event.clientY,
            nodeX: drag.node.x,
            nodeY: drag.node.y
          });
          scheduleConnectionRender();
          return;
        }
        if (
          state.canvasPan?.pointerId ===
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
          if (!pan.moved) {
            return;
          }
          event.preventDefault();
          state.offset.x =
            pan.startOffsetX +
            dx;
          state.offset.y =
            pan.startOffsetY +
            dy;
          renderTransform();
          scheduleConnectionRender();
        }
      },
      { passive: false }
    );
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
            drag.node,
            true
          );
        }
      }
      if (drag.moved) {
        state.lastNodeDragEndAt =
          performance.now();
      }

      state.nodeDrag = null;
      renderConnections();
      emit('nodeDragEnd', {
        id: drag.node.id,
        node: clone(drag.node)
      });
      emit(
        'change',
        getWorkflow()
      );
    }
    function endPointer(event) {
      if (
        state.connectionDrag?.pointerId ===
        event.pointerId
      ) {
        if (
          event.type ===
          'pointercancel'
        ) {
          cancelConnectionDrag();
        } else {
          finishConnection(event);
        }
      }
      if (
        state.nodeDrag?.pointerId ===
        event.pointerId
      ) {
        finishNodeDrag();
      }
      state.pointers.delete(
        event.pointerId
      );
      if (
        state.pointers.size < 2
      ) {
        state.pinch = null;
      }
      if (
        state.pointers.size === 0
      ) {
        state.canvasPan = null;
        cancelConnectionDrag();
        try {
          viewport.releasePointerCapture(
            event.pointerId
          );
        } catch {}
        renderConnections();
      }
    }
    listen(
      viewport,
      'pointerup',
      endPointer
    );
    listen(
      viewport,
      'pointercancel',
      endPointer
    );
    listen(
      viewport,
      'wheel',
      event => {
        if (!state.interactionEnabled) {
          return;
        }
        event.preventDefault();
        const before =
          screenToWorld(
            event.clientX,
            event.clientY
          );
        const factor =
          Math.exp(
            -event.deltaY *
              0.0015
          );
        const rect =
          viewport.getBoundingClientRect();
        state.scale =
          clamp(
            state.scale *
              factor,
            MIN_SCALE,
            MAX_SCALE
          );
        state.offset.x =
          event.clientX -
          rect.left -
          before.x *
            state.scale;
        state.offset.y =
          event.clientY -
          rect.top -
          before.y *
            state.scale;
        renderTransform();
        renderConnections();
      },
      { passive: false }
    );
    const resizeObserver =
      new ResizeObserver(() => {
        if (state.destroyed) {
          return;
        }
        for (const node of state.nodes) {
          const element =
            getNodeElement(
              node.id
            );
          if (element) {
            positionPorts(
              element,
              getDefinition(
                node.type
              )
            );
          }
        }
        scheduleConnectionRender();
      });
    resizeObserver.observe(
      viewport
    );
    observers.push(
      () =>
        resizeObserver.disconnect()
    );
    function render() {
      renderTransform();
      renderNodes();
      renderConnections();
    }
    const api = {
      root: viewport,
      getNode,
      getWorkflow,
      getWorkflowIR,
      getState: () => ({
        workflow: getWorkflow(),
        viewport: {
          scale: state.scale,
          offset: {
            ...state.offset
          }
        }
      }),
      setState,
      applyWorkflowIR,
      addNode,
      removeNode,
      connect,
      disconnect,
      canConnect,
      validate,
      selectNode,
      toggleNodeExpanded,
      setInteractionEnabled,
      setRuntimeConnections(ids = []) {
        state.runtimeConnections =
          new Set(
            Array.isArray(ids)
              ? ids.map(String)
              : []
          );
        renderConnections();
        return api;
      },
      setRuntimeNodeState(id, runtimeState) {
        const nodeId = String(id || '');
        if (!nodeId || !getNode(nodeId)) {
          return api;
        }
        if (
          !runtimeState ||
          typeof runtimeState !== 'object'
        ) {
          state.runtimeNodes.delete(nodeId);
        } else {
          state.runtimeNodes.set(
            nodeId,
            clone(runtimeState)
          );
        }
        renderNodes();
        return api;
      },
      clearRuntimeNodeStates() {
        state.runtimeNodes.clear();
        renderNodes();
        return api;
      },
      showRuntimeNode(id) {
        const node =
          getNode(String(id || ''));
        if (!node) {
          return api;
        }
        if (!node.expanded) {
          setNodeExpanded(
            node,
            true
          );
        }
        selectNode(node.id);
        return api;
      },
      isInteractionEnabled:
        () =>
          state.interactionEnabled,
      getNodeDefinition:
        type =>
          getDefinition(type),
      getNodeDefinitions:
        () =>
          Object.fromEntries(
            registry.entries()
          ),
      center() {
        centerWorkflow();
        return api;
      },
      layout: layoutWorkflow,
      render,
      on,
      off,
      destroy() {
        if (state.destroyed) {
          return;
        }
        state.destroyed = true;
        if (
          state.connectionFrame !==
          null
        ) {
          cancelAnimationFrame(
            state.connectionFrame
          );
          state.connectionFrame =
            null;
        }
        listeners
          .splice(0)
          .forEach(
            cleanup => {
              try {
                cleanup();
              } catch {}
            }
          );
        observers
          .splice(0)
          .forEach(
            cleanup => {
              try {
                cleanup();
              } catch {}
            }
          );
        state.pointers.clear();
        state.nodeDrag = null;
        state.canvasPan = null;
        state.pinch = null;
        state.connectionDrag = null;
        state.runtimeConnections.clear();
        state.runtimeNodes.clear();
        connectionElements
          .forEach(
            element =>
              element.remove()
          );
        connectionElements.clear();
        connectionLayer.textContent = '';
        dragLayer.textContent = '';
        nodesLayer.textContent = '';
        events.clear();
        if (
          target._canvasNode ===
          api
        ) {
          target._canvasNode = null;
        }
        if (
          viewport._canvasNode ===
          api
        ) {
          viewport._canvasNode = null;
        }
      }
    };
    target._canvasNode = api;
    viewport._canvasNode = api;
    const initialState =
      options.initialWorkflow ||
      previousState ||
      {
        nodes: [],
        connections: []
      };
    setState(initialState);
    setInteractionEnabled(
      options.interactionEnabled ===
        true
    );
    if (options.onChange) {
      on(
        'change',
        options.onChange
      );
    }
    if (options.onSelect) {
      on(
        'select',
        options.onSelect
      );
    }
    if (options.onConnect) {
      on(
        'connect',
        options.onConnect
      );
    }
    if (options.onValidate) {
      on(
        'validate',
        options.onValidate
      );
    }
    render();
    return api;
  };
  global.getMountedCanvasNode =
    function(target) {
      if (typeof target === 'string') {
        target =
          document.querySelector(
            target
          );
      }
      return (
        target?._canvasNode ||
        null
      );
    };
})(window);
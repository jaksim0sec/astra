(function (global) {
  'use strict';


  /* =========================================================
     Constants
  ========================================================= */

  const SVG_NS =
    'http://www.w3.org/2000/svg';

  const MIN_SCALE =
    0.12;

  const MAX_SCALE =
    3;

  const GAP_Y =
    36;

  const GAP_X_MIN =
    54;

  const GAP_X_MAX =
    110;

  const RELAX_PASSES =
    6;


  /* =========================================================
     Utils
  ========================================================= */

  const U =
    global.AstraUtils || {};

  const clamp =
    U.clamp ||
    (
      (value, min, max) =>
        Math.min(
          max,
          Math.max(
            min,
            value
          )
        )
    );


  const clone =
    U.clone ||
    (
      value => {
        try {
          return structuredClone(
            value
          );
        } catch {
          try {
            return JSON.parse(
              JSON.stringify(
                value
              )
            );
          } catch {
            return value;
          }
        }
      }
    );


  const escapeHtml =
    U.escapeHtml ||
    (
      value =>
        String(
          value ?? ''
        ).replace(
          /[&<>'"]/g,
          character => ({
            '&':
              '&amp;',

            '<':
              '&lt;',

            '>':
              '&gt;',

            "'":
              '&#39;',

            '"':
              '&quot;'
          }[character])
        )
    );


  let instanceSeq =
    0;


  /* =========================================================
     Icons
  ========================================================= */

  const icons = {

    toggle: `
      <svg
        viewBox="0 0 20 20"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M6 8l4 4 4-4"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    `,


    delete: `
      <svg
        viewBox="0 0 20 20"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="
            M5.5 6.5h9
            M8 6.5V5h4v1.5
            M7 8.5v6.5h6V8.5
          "
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />

        <path
          d="
            M9 9.5v3.5
            M11 9.5v3.5
          "
          stroke="currentColor"
          stroke-width="1.35"
          stroke-linecap="round"
        />
      </svg>
    `
  };


  /* =========================================================
     SVG helpers
  ========================================================= */

  function svgEl(
    name,
    attrs = {}
  ) {
    const element =
      document.createElementNS(
        SVG_NS,
        name
      );

    for (
      const [
        key,
        value
      ]
      of Object.entries(attrs)
    ) {
      element.setAttribute(
        key,
        value
      );
    }

    return element;
  }


  function dist(
    a,
    b
  ) {
    return Math.hypot(
      b.x - a.x,
      b.y - a.y
    );
  }


  function mid(
    a,
    b
  ) {
    return {
      x:
        (a.x + b.x) / 2,

      y:
        (a.y + b.y) / 2
    };
  }


  function endpoint(
    value
  ) {
    if (
      typeof value !==
      'string'
    ) {
      throw new Error(
        '연결 endpoint가 문자열이 아닙니다.'
      );
    }

    const index =
      value.lastIndexOf(
        '.'
      );

    if (
      index < 1 ||
      index ===
        value.length - 1
    ) {
      throw new Error(
        `잘못된 endpoint입니다: ${value}`
      );
    }

    return {
      node:
        value.slice(
          0,
          index
        ),

      port:
        value.slice(
          index + 1
        )
    };
  }


  function pathFor(
    from,
    to
  ) {
    const bend =
      clamp(
        Math.abs(
          to.x -
          from.x
        ) * 0.22 +
        Math.abs(
          to.y -
          from.y
        ) * 0.05,

        28,
        85
      );

    return `
      M ${from.x} ${from.y}
      C ${from.x + bend} ${from.y},
        ${to.x - bend} ${to.y},
        ${to.x} ${to.y}
    `.replace(
      /\s+/g,
      ' '
    );
  }


  /* =========================================================
     Mount
  ========================================================= */

  global.mountCanvasNode =
    async function (
      target,
      options = {}
    ) {

      if (
        typeof target ===
        'string'
      ) {
        target =
          document.querySelector(
            target
          );
      }

      if (
        !(target instanceof Element)
      ) {
        throw new TypeError(
          'target must be a DOM Element or selector'
        );
      }


      target
        ._canvasNode
        ?.destroy?.();


      const definitions =
        options.nodeDefinitions ||
        await global.AstraAPI
          ?.getNodeDefinitions?.() ||
        {};


      const uid =
        `cn-${++instanceSeq}-` +
        `${Date.now()
          .toString(36)
          .slice(-5)}`;


      /*
       * 현재 front/index.html의 실제 구조 사용
       */
      const viewport =
        target.matches(
          '#canvas-viewport'
        )
          ? target
          : target.querySelector(
              '#canvas-viewport'
            );


      if (!viewport) {
        throw new Error(
          '#canvas-viewport가 없습니다.'
        );
      }


      const world =
        viewport.querySelector(
          '#canvas-world'
        );


      const connectionSvg =
        viewport.querySelector(
          '#canvas-connections'
        );


      const nodesLayer =
        viewport.querySelector(
          '#canvas-nodes'
        );


      if (
        !world ||
        !connectionSvg ||
        !nodesLayer
      ) {
        throw new Error(
          'Canvas DOM 구조가 올바르지 않습니다.'
        );
      }


      let connectionLayer =
        connectionSvg.querySelector(
          '.vc-connection-layer'
        );


      let dragLayer =
        connectionSvg.querySelector(
          '.vc-drag-connection-layer'
        );


      if (!connectionLayer) {
        connectionLayer =
          document.createElementNS(
            SVG_NS,
            'g'
          );

        connectionLayer.classList.add(
          'vc-connection-layer'
        );

        connectionSvg.appendChild(
          connectionLayer
        );
      }


      if (!dragLayer) {
        dragLayer =
          document.createElementNS(
            SVG_NS,
            'g'
          );

        dragLayer.classList.add(
          'vc-drag-connection-layer'
        );

        connectionSvg.appendChild(
          dragLayer
        );
      }


      /* =======================================================
         State
      ======================================================= */

      const state = {

        nodes: [],

        connections: [],

        selectedNode:
          null,

        scale:
          1,

        offset: {
          x: 0,
          y: 0
        },

        pointers:
          new Map(),

        nodeDrag:
          null,

        canvasPan:
          null,

        pinch:
          null,

        connectionDrag:
          null,

        interactionEnabled:
          options.interactionEnabled ===
          true,

        destroyed:
          false,

        expansionAnimation:
          null,

        reflowFrame:
          null
      };


      /* =======================================================
         Registry
      ======================================================= */

      const registry =
        new Map(
          Object.entries(
            definitions
          ).map(
            (
              [type, definition]
            ) => [
              type,
              normalizeDefinition(
                type,
                definition
              )
            ]
          )
        );


      /* =======================================================
         Events
      ======================================================= */

      const events =
        new Map();

      const listeners =
        [];


      function on(
        name,
        handler
      ) {
        if (
          typeof handler !==
          'function'
        ) {
          return () => {};
        }

        if (
          !events.has(name)
        ) {
          events.set(
            name,
            new Set()
          );
        }

        events
          .get(name)
          .add(handler);

        return () =>
          off(
            name,
            handler
          );
      }


      function off(
        name,
        handler
      ) {
        events
          .get(name)
          ?.delete(handler);
      }


      function emit(
        name,
        payload
      ) {
        for (
          const handler
          of events.get(name) ||
            []
        ) {
          try {
            handler(
              payload,
              api
            );
          } catch (
            error
          ) {
            console.error(
              error
            );
          }
        }
      }


      function listen(
        element,
        type,
        handler,
        options
      ) {
        element.addEventListener(
          type,
          handler,
          options
        );

        listeners.push(
          () =>
            element.removeEventListener(
              type,
              handler,
              options
            )
        );
      }


      /* =======================================================
         Definition
      ======================================================= */

      function normalizePort(
        port,
        index,
        direction
      ) {
        return {
          ...(port || {}),

          id:
            String(
              port?.id ??
              `${direction}-${index}`
            ),

          name:
            port?.name ??
            port?.id ??
            `${direction}-${index}`,

          type:
            port?.type ||
            'any',

          required:
            !!port?.required,

          multiple:
            port?.multiple !==
            false,

          accepts:
            Array.isArray(
              port?.accepts
            ) &&
            port.accepts.length
              ? [
                  ...port.accepts
                ]
              : ['any']
        };
      }


      function normalizeDefinition(
        type,
        definition
      ) {
        const result = {
          ...(definition || {})
        };


        result.name =
          result.name ||
          type;


        result.desc =
          result.desc ||
          result.description ||
          '';


        result.color =
          result.color ||
          '#888888';


        result.icon =
          typeof result.icon ===
          'string'
            ? result.icon
            : '';


        result.inputs =
          Array.isArray(
            result.inputs
          )
            ? result.inputs.map(
                (
                  port,
                  index
                ) =>
                  normalizePort(
                    port,
                    index,
                    'input'
                  )
              )
            : [];


        result.outputs =
          Array.isArray(
            result.outputs
          )
            ? result.outputs.map(
                (
                  port,
                  index
                ) =>
                  normalizePort(
                    port,
                    index,
                    'output'
                  )
              )
            : [];


        result.params =
          Array.isArray(
            result.params
          )
            ? result.params
            : [];


        result.slots = {
          description:
            true,

          param:
            true,

          body:
            true,

          footer:
            true,

          ...(result.slots || {})
        };


        return result;
      }


      function getDefinition(
        type
      ) {
        return (
          registry.get(type) ||
          null
        );
      }


      /* =======================================================
         Node helpers
      ======================================================= */

      function uniqueNodeId(
        prefix = 'n'
      ) {
        let id;

        do {
          id =
            `${prefix}-${Date.now()
              .toString(36)}-` +
            `${Math.random()
              .toString(36)
              .slice(2, 8)}`;
        } while (
          getNode(id)
        );

        return id;
      }


      function getNode(
        id
      ) {
        return (
          state.nodes.find(
            node =>
              node.id ===
              String(id)
          ) ||
          null
        );
      }


      function getNodeElement(
        id
      ) {
        const wanted =
          String(id);

        return (
          [
            ...nodesLayer.querySelectorAll(
              '.vc-node'
            )
          ].find(
            element =>
              element.dataset.nodeId ===
              wanted
          ) ||
          null
        );
      }


      function normalizeNode(
        input
      ) {
        return {
          id:
            String(
              input?.id ||
              uniqueNodeId()
            ),

          type:
            String(
              input?.type ||
              ''
            ),

          x:
            Number(
              input?.x
            ) || 0,

          y:
            Number(
              input?.y
            ) || 0,

          expanded:
            input?.expanded !==
            undefined
              ? !!input.expanded
              : true,

          data:
            clone(
              input?.data ||
              {}
            )
        };
      }


      /* =======================================================
         Node rendering
      ======================================================= */

      function renderSlotContent(
        node,
        definition
      ) {
        const parts =
          [];


        if (
          definition.slots
            ?.description !== false &&
          definition.desc
        ) {
          parts.push(`
            <div class="vc-slot-description">
              ${escapeHtml(
                definition.desc
              )}
            </div>
          `);
        }


        const params =
          node.data?.params ||
          {};


        if (
          definition.slots
            ?.param !== false
        ) {
          for (
            const param
            of definition.params ||
              []
          ) {
            parts.push(`
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
                  data-param-id="${escapeHtml(
                    param.id
                  )}"
                  value="${escapeHtml(
                    params[param.id] ??
                    ''
                  )}"
                  placeholder="${escapeHtml(
                    param.placeholder ||
                    ''
                  )}"
                >

              </div>
            `);
          }
        }


        if (
          node.type ===
          'file'
        ) {
          const mime =
            node.data?.mime ||
            '알 수 없는 형식';


          const size =
            Number(
              node.data?.size ||
              0
            );


          const sizeText =
            size < 1024
              ? `${size} B`
              : size <
                  1024 * 1024
                ? `${(
                    size / 1024
                  ).toFixed(1)} KB`
                : `${(
                    size /
                    1024 /
                    1024
                  ).toFixed(1)} MB`;


          parts.push(`
            <div class="vc-slot-custom">
              <div class="vc-file-meta">

                <span>
                  ${escapeHtml(
                    mime
                  )}
                </span>

                <span>
                  ${escapeHtml(
                    sizeText
                  )}
                </span>

              </div>
            </div>
          `);
        }


        if (
          definition.slots
            ?.footer !== false &&
          definition.footer
        ) {
          const footer =
            typeof definition.footer ===
            'function'
              ? definition.footer(
                  node,
                  {
                    node,
                    type:
                      definition,
                    instance:
                      api
                  }
                )
              : definition.footer;


          if (footer) {
            parts.push(`
              <div class="vc-slot-custom">
                ${footer}
              </div>
            `);
          }
        }


        return parts.join('');
      }


      function renderPorts(
        node,
        ports,
        direction
      ) {
        const className =
          direction ===
          'input'
            ? 'vc-input'
            : 'vc-output';


        return (
          ports ||
          []
        )
          .map(
            port => `
              <div
                class="vc-port-hit ${className}"
                data-port-dir="${direction}"
                data-port-id="${escapeHtml(
                  port.id
                )}"
                data-node-id="${escapeHtml(
                  node.id
                )}"
              >

                <span class="vc-port-anchor">

                  <span
                    class="vc-port-pill"
                  ></span>

                </span>

                <span class="vc-port-label">
                  ${escapeHtml(
                    port.name
                  )}
                </span>

              </div>
            `
          )
          .join('');
      }


      function positionPorts(
        element,
        definition
      ) {
        if (
          !element ||
          !definition
        ) {
          return;
        }


        const height =
          Math.max(
            50,
            element.offsetHeight ||
            74
          );


        function place(
          selector,
          ports
        ) {
          const elements =
            [
              ...element.querySelectorAll(
                selector
              )
            ];


          const count =
            Math.max(
              1,
              ports.length
            );


          elements.forEach(
            (
              port,
              index
            ) => {
              const y =
                (
                  (index + 1) /
                  (count + 1)
                ) *
                height;


              port.style.height =
                '32px';


              port.style.top =
                `${y - 16}px`;


              port.dataset.portId =
                ports[index].id;
            }
          );
        }


        place(
          '.vc-port-hit.vc-input',
          definition.inputs ||
            []
        );


        place(
          '.vc-port-hit.vc-output',
          definition.outputs ||
            []
        );
      }


      function renderNodes() {
        nodesLayer.textContent =
          '';


        for (
          const node
          of state.nodes
        ) {
          const definition =
            getDefinition(
              node.type
            );


          if (!definition) {
            continue;
          }


          const element =
            document.createElement(
              'div'
            );


          const mime =
            String(
              node.data?.mime ||
              ''
            );


          const isImageFile =
            node.type ===
              'file' &&
            mime.startsWith(
              'image/'
            );


          const classes =
            [
              'vc-node'
            ];


          if (
            node.type ===
            'start'
          ) {
            classes.push(
              'vc-start-node'
            );
          }


          if (
            node.type ===
            'file'
          ) {
            classes.push(
              'vc-file-node'
            );
          }


          if (
            isImageFile
          ) {
            classes.push(
              'vc-image-file-node'
            );
          }


          if (
            node.id ===
            state.selectedNode
          ) {
            classes.push(
              'vc-selected'
            );
          }


          if (
            node.expanded
          ) {
            classes.push(
              'vc-expanded'
            );
          }


          element.className =
            classes.join(
              ' '
            );


          element.dataset.nodeId =
            node.id;


          /*
           * 중요
           * 저장된 x/y 그대로 사용
           */
          element.style.left =
            `${node.x}px`;


          element.style.top =
            `${node.y}px`;


          element.style.setProperty(
            '--node-color',
            definition.color
          );


          if (
            isImageFile &&
            node.data?.previewUrl
          ) {
            element.style.setProperty(
              '--vc-file-bg',
              `url("${node.data.previewUrl}")`
            );
          }


          const fileName =
            node.type ===
            'file'
              ? (
                  node.data?.name ||
                  '이름 없는 파일'
                )
              : definition.name;


          const extension =
            node.type ===
              'file' &&
            fileName.includes(
              '.'
            )
              ? fileName
                  .split('.')
                  .pop()
                  .toUpperCase()
              : 'FILE';


          element.innerHTML = `
            <div class="vc-node-head">

              <span class="vc-node-icon">
                ${definition.icon || ''}
              </span>

              ${
                node.type ===
                'file'
                  ? `
                    <span
                      class="vc-file-title-wrap"
                    >

                      <span
                        class="vc-file-title"
                        title="${escapeHtml(
                          fileName
                        )}"
                      >
                        ${escapeHtml(
                          fileName
                        )}
                      </span>

                      <span
                        class="vc-file-type"
                      >
                        ${escapeHtml(
                          extension
                        )}
                      </span>

                    </span>
                  `
                  : `
                    <span
                      class="vc-node-title"
                    >
                      ${escapeHtml(
                        definition.name
                      )}
                    </span>
                  `
              }

              ${
                node.type ===
                'start'
                  ? `
                    <span
                      class="vc-start-badge"
                    >
                      START
                    </span>
                  `
                  : ''
              }

              <div
                class="vc-node-actions"
              >
                <button
                  type="button"
                  class="
                    vc-node-action
                    vc-node-toggle
                  "
                  data-action="toggle"
                  aria-expanded="${String(
                    !!node.expanded
                  )}"
                  aria-label="상세 내용 ${
                    node.expanded
                      ? '닫기'
                      : '열기'
                  }"
                >
                  ${icons.toggle}
                </button>
              </div>

            </div>

            <div class="vc-node-body">
              ${renderSlotContent(
                node,
                definition
              )}
            </div>

            ${
              node.type !==
              'start'
                ? `
                  <div
                    class="vc-node-footer"
                  >
                    <button
                      type="button"
                      class="vc-node-delete"
                      data-action="delete"
                      aria-label="노드 삭제"
                    >
                      ${icons.delete}

                      <span>
                        삭제하기
                      </span>
                    </button>
                  </div>
                `
                : ''
            }

            ${renderPorts(
              node,
              definition.inputs,
              'input'
            )}

            ${renderPorts(
              node,
              definition.outputs,
              'output'
            )}
          `;


          nodesLayer.appendChild(
            element
          );


          /*
           * 초기 상태만 즉시 반영
           */
          setNodeExpanded(
            node,
            node.expanded,
            true
          );


          positionPorts(
            element,
            definition
          );
        }


        markConnectedPorts();
      }


      /* =======================================================
         Port lookup
      ======================================================= */

      function getPortElement(
        nodeId,
        portId,
        direction
      ) {
        const wantedNode =
          String(nodeId);

        const wantedPort =
          String(portId);

        const wantedDirection =
          String(direction);


        return (
          [
            ...nodesLayer.querySelectorAll(
              '.vc-port-hit'
            )
          ].find(
            element =>
              element.dataset
                .nodeId ===
                wantedNode &&
              element.dataset
                .portId ===
                wantedPort &&
              element.dataset
                .portDir ===
                wantedDirection
          ) ||
          null
        );
      }


      function portDef(
        nodeId,
        portId,
        direction
      ) {
        const node =
          getNode(
            nodeId
          );


        if (!node) {
          return null;
        }


        const definition =
          getDefinition(
            node.type
          );


        if (!definition) {
          return null;
        }


        const ports =
          direction ===
          'input'
            ? definition.inputs
            : definition.outputs;


        return (
          ports.find(
            port =>
              String(
                port.id
              ) ===
              String(
                portId
              )
          ) ||
          null
        );
      }


      function portPoint(
        nodeId,
        portId,
        direction
      ) {
        const element =
          getPortElement(
            nodeId,
            portId,
            direction
          );


        if (!element) {
          return null;
        }


        const anchor =
          element.querySelector(
            '.vc-port-anchor'
          ) ||
          element;


        const portRect =
          anchor.getBoundingClientRect();


        const viewportRect =
          viewport.getBoundingClientRect();


        return {
          x:
            (
              portRect.left +
              portRect.width / 2 -
              viewportRect.left -
              state.offset.x
            ) /
            state.scale,

          y:
            (
              portRect.top +
              portRect.height / 2 -
              viewportRect.top -
              state.offset.y
            ) /
            state.scale
        };
      }


      function markConnectedPorts() {
        nodesLayer
          .querySelectorAll(
            '.vc-port-pill.vc-connected'
          )
          .forEach(
            element =>
              element.classList.remove(
                'vc-connected'
              )
          );


        for (
          const connection
          of state.connections
        ) {
          getPortElement(
            connection.from.node,
            connection.from.port,
            'output'
          )
            ?.querySelector(
              '.vc-port-pill'
            )
            ?.classList.add(
              'vc-connected'
            );


          getPortElement(
            connection.to.node,
            connection.to.port,
            'input'
          )
            ?.querySelector(
              '.vc-port-pill'
            )
            ?.classList.add(
              'vc-connected'
            );
        }
      }


      /* =======================================================
         Connections
      ======================================================= */

      function renderConnections() {
        connectionLayer.textContent =
          '';


        for (
          const connection
          of state.connections
        ) {
          const from =
            portPoint(
              connection.from.node,
              connection.from.port,
              'output'
            );


          const to =
            portPoint(
              connection.to.node,
              connection.to.port,
              'input'
            );


          if (
            !from ||
            !to
          ) {
            continue;
          }


          const active =
            state.selectedNode ===
              connection.from.node ||
            state.selectedNode ===
              connection.to.node;


          const path =
            svgEl(
              'path',
              {
                d:
                  pathFor(
                    from,
                    to
                  )
              }
            );


          path.classList.add(
            'vc-connection'
          );


          if (
            active
          ) {
            path.classList.add(
              'vc-active'
            );


            const definition =
              getDefinition(
                getNode(
                  state.selectedNode ===
                    connection.from.node
                      ? connection.from.node
                      : connection.to.node
                )?.type
              );


            if (
              definition?.color
            ) {
              path.style.stroke =
                definition.color;
            }
          }


          connectionLayer.appendChild(
            path
          );
        }


        renderDragConnection();
      }


      function renderDragConnection() {
        dragLayer.textContent =
          '';


        const drag =
          state.connectionDrag;


        if (!drag) {
          return;
        }


        const from =
          portPoint(
            drag.from.node,
            drag.from.port,
            'output'
          );


        if (!from) {
          return;
        }


        const to =
          screenToWorld(
            drag.x,
            drag.y
          );


        const definition =
          getDefinition(
            getNode(
              drag.from.node
            )?.type
          );


        const path =
          svgEl(
            'path',
            {
              d:
                pathFor(
                  from,
                  to
                )
            }
          );


        path.classList.add(
          'vc-drag-connection'
        );


        if (
          definition?.color
        ) {
          path.style.stroke =
            definition.color;
        }


        dragLayer.appendChild(
          path
        );
      }


      /* =======================================================
         Coordinate
      ======================================================= */

      function screenToWorld(
        clientX,
        clientY
      ) {
        const rect =
          viewport.getBoundingClientRect();


        return {
          x:
            (
              clientX -
              rect.left -
              state.offset.x
            ) /
            state.scale,

          y:
            (
              clientY -
              rect.top -
              state.offset.y
            ) /
            state.scale
        };
      }


      function renderTransform() {
        world.style.transform =
          `translate(${state.offset.x}px,` +
          `${state.offset.y}px) ` +
          `scale(${state.scale})`;
      }


      /* =======================================================
         Node expansion
      ======================================================= */

      function trackExpansion() {
        if (
          state.expansionAnimation
        ) {
          cancelAnimationFrame(
            state.expansionAnimation
          );
        }


        const start =
          performance.now();


        const duration =
          340;


        const tick =
          now => {
            if (
              state.destroyed
            ) {
              return;
            }


            renderConnections();


            if (
              now - start <
              duration
            ) {
              state.expansionAnimation =
                requestAnimationFrame(
                  tick
                );

              return;
            }


            state.expansionAnimation =
              null;


            renderConnections();
          };


        state.expansionAnimation =
          requestAnimationFrame(
            tick
          );
      }


      function setNodeExpanded(
        node,
        expanded,
        immediate = false
      ) {
        const element =
          getNodeElement(
            node.id
          );


        if (!element) {
          return;
        }


        const body =
          element.querySelector(
            '.vc-node-body'
          );


        const toggle =
          element.querySelector(
            '.vc-node-toggle'
          );


        node.expanded =
          !!expanded;


        element.classList.toggle(
          'vc-expanded',
          node.expanded
        );


        toggle?.setAttribute(
          'aria-expanded',
          String(
            node.expanded
          )
        );


        toggle?.setAttribute(
          'aria-label',
          `상세 내용 ${
            node.expanded
              ? '닫기'
              : '열기'
          }`
        );


        if (!body) {
          return;
        }


        function finish() {
          positionPorts(
            element,
            getDefinition(
              node.type
            )
          );

          renderConnections();
        }


        if (
          immediate
        ) {
          body.style.transition =
            'none';

          body.style.height =
            node.expanded
              ? 'auto'
              : '0px';


          requestAnimationFrame(
            () => {
              body.style.transition =
                '';

              finish();
            }
          );


          return;
        }


        if (
          node.expanded
        ) {
          body.style.height =
            '0px';


          void body.offsetHeight;


          const targetHeight =
            body.scrollHeight;


          const end =
            event => {
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


              if (
                !node.expanded
              ) {
                return;
              }


              body.style.height =
                'auto';


              finish();
            };


          body.addEventListener(
            'transitionend',
            end
          );


          requestAnimationFrame(
            () => {
              body.style.height =
                `${targetHeight}px`;
            }
          );


          trackExpansion();


          return;
        }


        const currentHeight =
          body.scrollHeight;


        body.style.height =
          `${currentHeight}px`;


        void body.offsetHeight;


        const end =
          event => {
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


            if (
              node.expanded
            ) {
              return;
            }


            body.style.height =
              '0px';


            finish();
          };


        body.addEventListener(
          'transitionend',
          end
        );


        requestAnimationFrame(
          () => {
            body.style.height =
              '0px';
          }
        );


        trackExpansion();
      }


      function selectNode(
        id
      ) {
        if (
          id !== null &&
          !getNode(id)
        ) {
          id =
            null;
        }


        state.selectedNode =
          id;


        nodesLayer
          .querySelectorAll(
            '.vc-node'
          )
          .forEach(
            element =>
              element.classList.toggle(
                'vc-selected',
                element.dataset
                  .nodeId ===
                  id
              )
          );


        renderConnections();


        emit(
          'select',
          id
        );
      }


      function toggleNodeExpanded(
        id
      ) {
        const node =
          getNode(
            id
          );


        if (!node) {
          return;
        }


        setNodeExpanded(
          node,
          !node.expanded
        );


        selectNode(
          node.id
        );


        emit(
          'change',
          getWorkflow()
        );
      }


      /* =======================================================
         Validation / Connection rules
      ======================================================= */

      function compatible(
        output,
        input
      ) {
        if (
          !output ||
          !input
        ) {
          return false;
        }


        const accepts =
          Array.isArray(
            input.accepts
          )
            ? input.accepts
            : ['any'];


        return (
          accepts.includes(
            'any'
          ) ||

          accepts.includes(
            output.type
          ) ||

          output.type ===
            'any'
        );
      }


      function wouldCreateCycle(
        fromId,
        toId
      ) {
        if (
          fromId ===
          toId
        ) {
          return true;
        }


        const graph =
          new Map();


        for (
          const connection
          of state.connections
        ) {
          if (
            !graph.has(
              connection.from.node
            )
          ) {
            graph.set(
              connection.from.node,
              []
            );
          }


          graph
            .get(
              connection.from.node
            )
            .push(
              connection.to.node
            );
        }


        const stack =
          [
            toId
          ];


        const seen =
          new Set();


        while (
          stack.length
        ) {
          const current =
            stack.pop();


          if (
            current ===
            fromId
          ) {
            return true;
          }


          if (
            seen.has(
              current
            )
          ) {
            continue;
          }


          seen.add(
            current
          );


          for (
            const next
            of graph.get(
              current
            ) || []
          ) {
            stack.push(
              next
            );
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
        const errors =
          [];


        const source =
          getNode(
            fromNodeId
          );


        const target =
          getNode(
            toNodeId
          );


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
              `도착 노드 ${toNodeId}가 존재하지 않습니다.`
          });
        }


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


        if (
          errors.length
        ) {
          return {
            ok:
              false,

            errors
          };
        }


        if (
          state.connections.some(
            connection =>
              connection.from.node ===
                fromNodeId &&
              connection.from.port ===
                fromPortId &&
              connection.to.node ===
                toNodeId &&
              connection.to.port ===
                toPortId
          )
        ) {
          errors.push({
            code:
              'DUPLICATE_CONNECTION',

            message:
              '동일한 연결이 이미 존재합니다.'
          });
        }


        if (
          !input.multiple &&
          state.connections.some(
            connection =>
              connection.to.node ===
                toNodeId &&
              connection.to.port ===
                toPortId
          )
        ) {
          errors.push({
            code:
              'INPUT_MULTIPLE',

            message:
              `입력 포트 ${input.name}은 하나의 연결만 허용합니다.`
          });
        }


        if (
          !compatible(
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
          ok:
            errors.length ===
            0,

          errors
        };
      }


      function canConnect(
        specification
      ) {
        if (
          !specification?.from ||
          !specification?.to
        ) {
          return {
            ok:
              false,

            errors: [
              {
                code:
                  'INVALID_CONNECTION',

                message:
                  '연결 정보가 올바르지 않습니다.'
              }
            ]
          };
        }


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
            `c-${Date.now()
              .toString(36)}-` +
            `${Math.random()
              .toString(36)
              .slice(2, 8)}`;
        } while (
          state.connections.some(
            connection =>
              connection.id ===
              id
          )
        );


        return id;
      }


      function connect(
        from,
        to,
        options = {}
      ) {
        const check =
          canConnect({
            from,
            to
          });


        if (
          !check.ok
        ) {
          emit(
            'connectionRejected',
            check
          );

          return null;
        }


        const connection = {
          id:
            uniqueConnectionId(),

          from: {
            node:
              String(
                from.node
              ),

            port:
              String(
                from.port
              )
          },

          to: {
            node:
              String(
                to.node
              ),

            port:
              String(
                to.port
              )
          }
        };


        if (
          options.data
        ) {
          connection.data =
            clone(
              options.data
            );
        }


        state.connections.push(
          connection
        );


        markConnectedPorts();
        renderConnections();


        emit(
          'connect',
          clone(
            connection
          )
        );


        emit(
          'change',
          getWorkflow()
        );


        return connection;
      }


      function disconnect(
        id
      ) {
        const index =
          state.connections.findIndex(
            connection =>
              connection.id ===
              id
          );


        if (
          index < 0
        ) {
          return false;
        }


        state.connections.splice(
          index,
          1
        );


        markConnectedPorts();
        renderConnections();


        emit(
          'disconnect',
          id
        );


        emit(
          'change',
          getWorkflow()
        );


        return true;
      }


      /* =======================================================
         Validation
      ======================================================= */

      function validate() {
        const errors =
          [];


        const warnings =
          [];


        const ids =
          new Set();


        for (
          const node
          of state.nodes
        ) {
          if (
            ids.has(
              node.id
            )
          ) {
            errors.push({
              code:
                'DUPLICATE_NODE_ID',

              node:
                node.id,

              message:
                `노드 ID ${node.id}가 중복됩니다.`
            });
          }


          ids.add(
            node.id
          );


          if (
            !registry.has(
              node.type
            )
          ) {
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


        const graph =
          new Map();


        const connectionKeys =
          new Set();


        for (
          const connection
          of state.connections
        ) {
          const source =
            getNode(
              connection.from.node
            );


          const target =
            getNode(
              connection.to.node
            );


          if (!source) {
            errors.push({
              code:
                'MISSING_SOURCE_NODE',

              connection:
                connection.id,

              message:
                `연결 ${connection.id}의 출발 노드가 없습니다.`
            });
          }


          if (!target) {
            errors.push({
              code:
                'MISSING_TARGET_NODE',

              connection:
                connection.id,

              message:
                `연결 ${connection.id}의 도착 노드가 없습니다.`
            });
          }


          const key =
            [
              connection.from.node,
              connection.from.port,
              connection.to.node,
              connection.to.port
            ].join(
              ':'
            );


          if (
            connectionKeys.has(
              key
            )
          ) {
            errors.push({
              code:
                'DUPLICATE_CONNECTION',

              connection:
                connection.id,

              message:
                `연결 ${connection.id}가 중복됩니다.`
            });
          }


          connectionKeys.add(
            key
          );


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
            !compatible(
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


          if (
            !graph.has(
              connection.from.node
            )
          ) {
            graph.set(
              connection.from.node,
              []
            );
          }


          graph
            .get(
              connection.from.node
            )
            .push(
              connection.to.node
            );
        }


        const visiting =
          new Set();


        const visited =
          new Set();


        function dfs(
          id
        ) {
          if (
            visiting.has(
              id
            )
          ) {
            return true;
          }


          if (
            visited.has(
              id
            )
          ) {
            return false;
          }


          visiting.add(
            id
          );


          for (
            const next
            of graph.get(
              id
            ) || []
          ) {
            if (
              dfs(
                next
              )
            ) {
              return true;
            }
          }


          visiting.delete(
            id
          );


          visited.add(
            id
          );


          return false;
        }


        for (
          const node
          of state.nodes
        ) {
          if (
            !visited.has(
              node.id
            ) &&
            dfs(
              node.id
            )
          ) {
            errors.push({
              code:
                'CYCLE',

              message:
                '워크플로우에 순환 구조(Cycle)가 존재합니다.'
            });

            break;
          }
        }


        const connected =
          new Set();


        for (
          const connection
          of state.connections
        ) {
          connected.add(
            connection.from.node
          );

          connected.add(
            connection.to.node
          );
        }


        for (
          const node
          of state.nodes
        ) {
          if (
            !connected.has(
              node.id
            )
          ) {
            warnings.push({
              code:
                'ISOLATED_NODE',

              node:
                node.id,

              message:
                `노드 '${getDefinition(node.type)?.name || node.type}'가 연결되지 않았습니다.`
            });
          }
        }


        const result = {
          valid:
            errors.length ===
            0,

          errors,

          warnings
        };


        emit(
          'validate',
          result
        );


        return result;
      }


      /* =======================================================
         Workflow
      ======================================================= */

      function getWorkflow() {
        return {
          nodes:
            clone(
              state.nodes
            ),

          connections:
            clone(
              state.connections
            )
        };
      }


      function getWorkflowIR() {
        return {
          nodes:
            state.nodes.map(
              node => ({
                id:
                  node.id,

                type:
                  node.type,

                params:
                  clone(
                    node.data?.params ||
                    {}
                  )
              })
            ),


          links:
            state.connections
              .filter(
                connection =>
                  connection.data?.kind !==
                  'data'
              )
              .map(
                connection => [
                  `${connection.from.node}.${connection.from.port}`,
                  `${connection.to.node}.${connection.to.port}`
                ]
              ),


          data:
            state.connections
              .filter(
                connection =>
                  connection.data?.kind ===
                  'data'
              )
              .map(
                connection => [
                  `${connection.from.node}.${connection.from.port}`,
                  `${connection.to.node}.${connection.to.port}`
                ]
              )
        };
      }


      function convertEdges(
        edges,
        kind
      ) {
        return (
          Array.isArray(
            edges
          )
            ? edges
            : []
        )
          .map(
            edge => {
              if (
                !Array.isArray(
                  edge
                ) ||
                edge.length !==
                2
              ) {
                return null;
              }


              try {
                const from =
                  endpoint(
                    edge[0]
                  );


                const to =
                  endpoint(
                    edge[1]
                  );


                return {
                  id:
                    uniqueConnectionId(),

                  from,

                  to,

                  data: {
                    kind
                  }
                };

              } catch {
                return null;
              }
            }
          )
          .filter(
            Boolean
          );
      }


      /* =======================================================
         State loading
         IMPORTANT:
         setState는 좌표를 절대 자동 재배치하지 않는다.
      ======================================================= */

      function setState(
        saved = {}
      ) {
        const workflow =
          saved.workflow ||
          saved ||
          {};


        state.nodes =
          Array.isArray(
            workflow.nodes
          )
            ? workflow.nodes
                .map(
                  normalizeNode
                )
                .filter(
                  node =>
                    registry.has(
                      node.type
                    )
                )
            : [];


        const explicitConnections =
          Array.isArray(
            workflow.connections
          )
            ? clone(
                workflow.connections
              )
            : null;


        state.connections =
          (
            explicitConnections ||
            [
              ...convertEdges(
                workflow.links,
                'flow'
              ),

              ...convertEdges(
                workflow.data,
                'data'
              )
            ]
          )
            .map(
              connection => ({
                id:
                  String(
                    connection.id ||
                    uniqueConnectionId()
                  ),

                from: {
                  node:
                    String(
                      connection.from?.node ||
                      ''
                    ),

                  port:
                    String(
                      connection.from?.port ||
                      ''
                    )
                },

                to: {
                  node:
                    String(
                      connection.to?.node ||
                      ''
                    ),

                  port:
                    String(
                      connection.to?.port ||
                      ''
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
              })
            )
            .filter(
              connection =>
                getNode(
                  connection.from.node
                ) &&
                getNode(
                  connection.to.node
                )
            );


        if (
          saved.viewport
        ) {
          state.scale =
            clamp(
              Number(
                saved.viewport.scale
              ) || 1,

              MIN_SCALE,
              MAX_SCALE
            );


          state.offset = {
            x:
              Number(
                saved.viewport
                  ?.offset?.x
              ) || 0,

            y:
              Number(
                saved.viewport
                  ?.offset?.y
              ) || 0
          };
        }


        state.selectedNode =
          null;


        /*
         * 핵심:
         *
         * 여기서 layoutWorkflow()를 호출하지 않는다.
         *
         * 따라서 Canvas가 다시 표시되거나
         * setState()가 실행되어도
         * 저장된 node.x / node.y가 유지된다.
         */
        render();


        emit(
          'change',
          getWorkflow()
        );


        return api;
      }


      /* =======================================================
         Layout
         ======================================================= */

      function layoutWorkflow() {
        if (
          !state.nodes.length
        ) {
          return;
        }


        const incoming =
          new Map();


        const outgoing =
          new Map();


        const rank =
          new Map();


        for (
          const node
          of state.nodes
        ) {
          incoming.set(
            node.id,
            []
          );

          outgoing.set(
            node.id,
            []
          );

          rank.set(
            node.id,
            0
          );
        }


        /*
         * Flow link만 순서 계산에 사용한다.
         * data link는 레이아웃에 영향을 주지 않는다.
         */
        for (
          const connection
          of state.connections
        ) {
          if (
            connection.data?.kind ===
            'data'
          ) {
            continue;
          }


          if (
            !incoming.has(
              connection.to.node
            ) ||
            !outgoing.has(
              connection.from.node
            )
          ) {
            continue;
          }


          incoming
            .get(
              connection.to.node
            )
            .push(
              connection.from.node
            );


          outgoing
            .get(
              connection.from.node
            )
            .push(
              connection.to.node
            );
        }


        const indegree =
          new Map();


        for (
          const node
          of state.nodes
        ) {
          indegree.set(
            node.id,
            incoming.get(
              node.id
            ).length
          );
        }


        const starts =
          state.nodes.filter(
            node =>
              node.type ===
              'start'
          );


        const queue =
          [];


        const queued =
          new Set();


        (
          starts.length
            ? starts
            : state.nodes.filter(
                node =>
                  indegree.get(
                    node.id
                  ) ===
                  0
              )
        ).forEach(
          node => {
            queue.push(
              node.id
            );

            queued.add(
              node.id
            );
          }
        );


        let queueIndex =
          0;


        while (
          queueIndex <
          queue.length
        ) {
          const id =
            queue[
              queueIndex++
            ];


          const current =
            rank.get(
              id
            ) || 0;


          for (
            const next
            of outgoing.get(
              id
            ) || []
          ) {
            rank.set(
              next,
              Math.max(
                rank.get(
                  next
                ) || 0,

                current +
                1
              )
            );


            indegree.set(
              next,
              indegree.get(
                next
              ) -
              1
            );


            if (
              indegree.get(
                next
              ) ===
              0 &&
              !queued.has(
                next
              )
            ) {
              queued.add(
                next
              );

              queue.push(
                next
              );
            }
          }
        }


        let maxRank =
          Math.max(
            0,
            ...rank.values()
          );


        for (
          const node
          of state.nodes
        ) {
          if (
            !queued.has(
              node.id
            )
          ) {
            maxRank +=
              1;

            rank.set(
              node.id,
              maxRank
            );
          }
        }


        const layers =
          new Map();


        for (
          const node
          of state.nodes
        ) {
          const layer =
            rank.get(
              node.id
            ) ||
            0;


          if (
            !layers.has(
              layer
            )
          ) {
            layers.set(
              layer,
              []
            );
          }


          layers
            .get(
              layer
            )
            .push(
              node
            );
        }


        const layerNumbers =
          [
            ...layers.keys()
          ].sort(
            (
              a,
              b
            ) =>
              a -
              b
          );


        const centers =
          new Map();


        function size(
          node
        ) {
          const element =
            getNodeElement(
              node.id
            );


          return {
            width:
              Math.max(
                150,
                element?.offsetWidth ||
                190
              ),

            height:
              Math.max(
                50,
                element?.offsetHeight ||
                74
              )
          };
        }


        /*
         * 초기 vertical position
         */
        for (
          const layer
          of layerNumbers
        ) {
          const nodes =
            layers.get(
              layer
            );


          let total =
            nodes.reduce(
              (
                sum,
                node
              ) =>
                sum +
                size(
                  node
                ).height,

              0
            );


          total +=
            Math.max(
              0,
              nodes.length -
              1
            ) *
            GAP_Y;


          let cursor =
            -total / 2;


          for (
            const node
            of nodes
          ) {
            const height =
              size(
                node
              ).height;


            centers.set(
              node.id,
              cursor +
              height / 2
            );


            cursor +=
              height +
              GAP_Y;
          }
        }


        function neighbors(
          node,
          targetLayer
        ) {
          return [
            ...(incoming.get(
              node.id
            ) || []),

            ...(outgoing.get(
              node.id
            ) || [])
          ].filter(
            id =>
              rank.get(
                id
              ) ===
              targetLayer
          );
        }


        /*
         * layer relaxation
         */
        for (
          let pass = 0;
          pass <
            RELAX_PASSES;
          pass++
        ) {
          const forward =
            pass %
            2 ===
            0;


          const order =
            forward
              ? layerNumbers
              : [
                  ...layerNumbers
                ].reverse();


          for (
            const layer
            of order
          ) {
            const nodes =
              layers.get(
                layer
              );


            const targetLayer =
              forward
                ? layer -
                  1
                : layer +
                  1;


            if (
              !layers.has(
                targetLayer
              )
            ) {
              continue;
            }


            const scored =
              nodes
                .map(
                  (
                    node,
                    index
                  ) => {

                    const values =
                      neighbors(
                        node,
                        targetLayer
                      )
                        .map(
                          id =>
                            centers.get(
                              id
                            )
                        )
                        .filter(
                          Number.isFinite
                        );


                    let targetY =
                      centers.get(
                        node.id
                      ) ||
                      0;


                    if (
                      values.length
                    ) {
                      values.sort(
                        (
                          a,
                          b
                        ) =>
                          a -
                          b
                      );


                      targetY =
                        values[
                          Math.floor(
                            values.length /
                            2
                          )
                        ];
                    }


                    return {
                      node,

                      index,

                      targetY
                    };
                  }
                )
                .sort(
                  (
                    a,
                    b
                  ) =>
                    a.targetY -
                      b.targetY ||
                    a.index -
                      b.index
                );


            layers.set(
              layer,
              scored.map(
                item =>
                  item.node
              )
            );


            let previousBottom =
              -Infinity;


            for (
              const node
              of layers.get(
                layer
              )
            ) {
              const height =
                size(
                  node
                ).height;


              let center =
                centers.get(
                  node.id
                ) ||
                0;


              if (
                previousBottom !==
                -Infinity
              ) {
                center =
                  Math.max(
                    center,

                    previousBottom +
                    GAP_Y +
                    height /
                    2
                  );
              }


              centers.set(
                node.id,
                center
              );


              previousBottom =
                center +
                height /
                2;
            }
          }
        }


        const widths =
          new Map();


        for (
          const layer
          of layerNumbers
        ) {
          let width =
            190;


          for (
            const node
            of layers.get(
              layer
            )
          ) {
            width =
              Math.max(
                width,

                size(
                  node
                ).width
              );
          }


          widths.set(
            layer,
            width
          );
        }


        const columnX =
          new Map();


        let x =
          0;


        for (
          const layer
          of layerNumbers
        ) {
          columnX.set(
            layer,
            x
          );


          x +=
            widths.get(
              layer
            ) +
            clamp(
              widths.get(
                layer
              ) * 0.28,

              GAP_X_MIN,
              GAP_X_MAX
            );
        }


        /*
         * 마지막으로 실제 node.x/y에 반영
         */
        for (
          const layer
          of layerNumbers
        ) {
          for (
            const node
            of layers.get(
              layer
            )
          ) {
            const dimensions =
              size(
                node
              );


            node.x =
              columnX.get(
                layer
              );


            node.y =
              (
                centers.get(
                  node.id
                ) ||
                0
              ) -
              dimensions.height /
              2;
          }
        }
      }


      function applyLayoutToDom() {
        for (
          const node
          of state.nodes
        ) {
          const element =
            getNodeElement(
              node.id
            );


          if (!element) {
            continue;
          }


          element.style.left =
            `${node.x}px`;


          element.style.top =
            `${node.y}px`;


          positionPorts(
            element,
            getDefinition(
              node.type
            )
          );
        }


        renderConnections();
      }


      /*
       * 이 함수는 공개적으로 사용할 수 있지만
       * 일반 render / resize에서는 호출하지 않는다.
       */
      function scheduleReflow() {
        if (
          state.reflowFrame !==
          null
        ) {
          return;
        }


        state.reflowFrame =
          requestAnimationFrame(
            () => {
              state.reflowFrame =
                null;


              layoutWorkflow();


              applyLayoutToDom();


              emit(
                'layout',
                getWorkflow()
              );
            }
          );
      }


      /* =======================================================
         Apply Workflow IR
         자동 레이아웃은 여기서만 실행
      ======================================================= */

      function applyWorkflowIR(
        spec,
        options = {}
      ) {
        if (
          !spec ||
          typeof spec !==
            'object' ||
          !Array.isArray(
            spec.nodes
          )
        ) {
          throw new Error(
            'workflow spec가 올바르지 않습니다.'
          );
        }


        /*
         * 기존 node의 위치는
         * 새 IR 안에 좌표가 있으면 사용하고
         * 없으면 초기 0으로 만든다.
         */
        state.nodes =
          spec.nodes
            .map(
              node => ({
                id:
                  String(
                    node.id
                  ),

                type:
                  String(
                    node.type
                  ),

                x:
                  Number(
                    node.x
                  ) || 0,

                y:
                  Number(
                    node.y
                  ) || 0,

                expanded:
                  options.expanded !==
                  undefined
                    ? !!options.expanded
                    : true,

                data: {
                  params:
                    clone(
                      node.params ||
                      {}
                    )
                }
              })
            )
            .filter(
              node =>
                registry.has(
                  node.type
                )
            );


        state.connections =
          [
            ...convertEdges(
              spec.links,
              'flow'
            ),

            ...convertEdges(
              spec.data,
              'data'
            )
          ]
            .filter(
              connection =>
                getNode(
                  connection.from.node
                ) &&
                getNode(
                  connection.to.node
                )
            );


        state.selectedNode =
          null;


        /*
         * DOM을 먼저 만들어
         * 실제 node 크기를 측정할 수 있게 한다.
         */
        render();


        /*
         * NEW WORKFLOW 적용 시에만
         * 자동 레이아웃
         */
        if (
          options.layout !== false
        ) {
          layoutWorkflow();

          applyLayoutToDom();
        }


        /*
         * 새 workflow의 중심을 잡는다.
         */
        if (
          options.center !== false
        ) {
          centerWorkflow();
        }


        renderConnections();


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


      /* =======================================================
         Add Node
      ======================================================= */

      function findNewNodePosition() {
        const rect =
          viewport.getBoundingClientRect();


        const center =
          screenToWorld(
            rect.left +
              rect.width /
              2,

            rect.top +
              rect.height /
              2
          );


        const width =
          190;


        const height =
          74;


        const gap =
          24;


        const spots = [
          [
            0,
            0
          ],

          [
            0,
            height +
            gap
          ],

          [
            0,
            -height -
            gap
          ],

          [
            -width -
            gap,
            0
          ],

          [
            width +
            gap,
            0
          ]
        ];


        for (
          const [
            dx,
            dy
          ]
          of spots
        ) {
          const x =
            center.x -
            width /
              2 +
            dx;


          const y =
            center.y -
            height /
              2 +
            dy;


          const occupied =
            state.nodes.some(
              node =>
                Math.abs(
                  node.x -
                  x
                ) <
                  width +
                  gap &&

                Math.abs(
                  node.y -
                  y
                ) <
                  height +
                  gap
            );


          if (
            !occupied
          ) {
            return {
              x,
              y
            };
          }
        }


        return {
          x:
            center.x -
            width /
              2,

          y:
            center.y -
            height /
              2
        };
      }


      function addNode(
        type,
        data = {}
      ) {
        if (
          !registry.has(
            type
          )
        ) {
          throw new Error(
            `존재하지 않는 노드 타입: ${type}`
          );
        }


        /*
         * start는 하나만
         */
        if (
          type ===
          'start'
        ) {
          const existing =
            state.nodes.find(
              node =>
                node.type ===
                'start'
            );


          if (
            existing
          ) {
            selectNode(
              existing.id
            );

            return existing;
          }
        }


        const position =
          data.x != null &&
          data.y != null
            ? {
                x:
                  Number(
                    data.x
                  ) || 0,

                y:
                  Number(
                    data.y
                  ) || 0
              }
            : findNewNodePosition();


        const node =
          normalizeNode({
            id:
              data.id ||
              uniqueNodeId(),

            type,

            x:
              position.x,

            y:
              position.y,

            expanded:
              data.expanded !==
              undefined
                ? !!data.expanded
                : true,

            data:
              data.data ||
              {}
          });


        state.nodes.push(
          node
        );


        state.selectedNode =
          node.id;


        render();


        emit(
          'change',
          getWorkflow()
        );


        return node;
      }


      /* =======================================================
         Remove Node
      ======================================================= */

      function removeNode(
        id
      ) {
        const node =
          getNode(
            id
          );


        if (
          !node ||
          node.type ===
            'start'
        ) {
          return false;
        }


        state.nodes =
          state.nodes.filter(
            item =>
              item.id !==
              id
          );


        state.connections =
          state.connections.filter(
            connection =>
              connection.from.node !==
                id &&
              connection.to.node !==
                id
          );


        if (
          state.selectedNode ===
          id
        ) {
          state.selectedNode =
            null;
        }


        render();


        emit(
          'change',
          getWorkflow()
        );


        return true;
      }


      /* =======================================================
         Direct node position
         IMPORTANT:
         drag에서는 layout을 호출하지 않는다.
      ======================================================= */

      function setNodePosition(
        node,
        x,
        y
      ) {
        node.x =
          x;


        node.y =
          y;


        const element =
          getNodeElement(
            node.id
          );


        if (
          element
        ) {
          element.style.left =
            `${x}px`;


          element.style.top =
            `${y}px`;
        }


        renderConnections();


        emit(
          'change',
          getWorkflow()
        );
      }


      /* =======================================================
         Interaction toggle
      ======================================================= */

      function setInteractionEnabled(
        enabled
      ) {
        const next =
          !!enabled;


        if (
          !next
        ) {
          /*
           * 입력 상태를 정리한다.
           *
           * x/y는 건드리지 않는다.
           */
          state.pointers.clear();

          state.nodeDrag =
            null;

          state.canvasPan =
            null;

          state.pinch =
            null;

          state.connectionDrag =
            null;


          dragLayer.textContent =
            '';


          canvasElement.classList.remove(
            'vc-dragging'
          );


          /*
           * 혹시 DOM이 dragging 상태로
           * 남아있으면 제거
           */
          nodesLayer
            .querySelectorAll(
              '.vc-node.vc-dragging'
            )
            .forEach(
              element =>
                element.classList.remove(
                  'vc-dragging'
                )
            );
        }


        state.interactionEnabled =
          next;


        emit(
          'interaction',
          next
        );


        return api;
      }


      /* =======================================================
         Canvas interactions
      ======================================================= */

      listen(
        nodesLayer,
        'pointerdown',
        event => {

          /*
           * 버튼이나 입력창은 Canvas drag로
           * 번지면 안 된다.
           */
          if (
            event.target.closest(
              '.vc-node-action'
            ) ||
            event.target.closest(
              '.vc-slot-param'
            )
          ) {
            event.stopPropagation();
          }
        },
        {
          passive:
            false
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


          if (!action) {
            return;
          }


          event.preventDefault();
          event.stopPropagation();


          const element =
            action.closest(
              '.vc-node'
            );


          if (!element) {
            return;
          }


          const id =
            element.dataset.nodeId;


          if (
            action.dataset.action ===
            'toggle'
          ) {
            toggleNodeExpanded(
              id
            );

            return;
          }


          if (
            action.dataset.action ===
            'delete'
          ) {
            removeNode(
              id
            );
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


          if (!input) {
            return;
          }


          const element =
            input.closest(
              '.vc-node'
            );


          if (!element) {
            return;
          }


          const node =
            getNode(
              element.dataset.nodeId
            );


          if (!node) {
            return;
          }


          node.data ||=
            {};


          node.data.params ||=
            {};


          node.data.params[
            input.dataset.paramId
          ] =
            input.value;


          emit(
            'change',
            getWorkflow()
          );
        }
      );


      /*
       * Pointer Down
       */
      listen(
        viewport,
        'pointerdown',
        event => {
          if (
            !state.interactionEnabled
          ) {
            return;
          }


          state.pointers.set(
            event.pointerId,
            {
              x:
                event.clientX,

              y:
                event.clientY
            }
          );


          /*
           * Pinch
           */
          if (
            state.pointers.size >=
            2
          ) {
            state.nodeDrag =
              null;


            state.canvasPan =
              null;


            state.connectionDrag =
              null;


            const [
              a,
              b
            ] =
              [
                ...state.pointers
                  .values()
              ];


            const center =
              mid(
                a,
                b
              );


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
                    a,
                    b
                  )
                ),

              s:
                state.scale,

              x:
                anchor.x,

              y:
                anchor.y
            };


            dragLayer.textContent =
              '';


            return;
          }


          /*
           * Port
           */
          const port =
            event.target.closest(
              '.vc-port-hit'
            );


          if (
            port
          ) {
            event.preventDefault();
            event.stopPropagation();


            const node =
              getNode(
                port.dataset.nodeId
              );


            if (!node) {
              return;
            }


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


              try {
                viewport.setPointerCapture(
                  event.pointerId
                );
              } catch {}


              renderDragConnection();
            }


            return;
          }


          /*
           * Node
           */
          const nodeElement =
            event.target.closest(
              '.vc-node'
            );


          if (
            nodeElement
          ) {
            /*
             * action/input은 위에서
             * stopPropagation 했기 때문에
             * 여기까지 보통 내려오지 않는다.
             */
            if (
              event.target.closest(
                '.vc-node-action'
              ) ||
              event.target.closest(
                '.vc-slot-param'
              )
            ) {
              return;
            }


            event.preventDefault();
            event.stopPropagation();


            const node =
              getNode(
                nodeElement.dataset
                  .nodeId
              );


            if (!node) {
              return;
            }


            selectNode(
              node.id
            );


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


            try {
              viewport.setPointerCapture(
                event.pointerId
              );
            } catch {}


            return;
          }


          /*
           * Empty Canvas
           */
          selectNode(
            null
          );


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


          try {
            viewport.setPointerCapture(
              event.pointerId
            );
          } catch {}
        },
        {
          passive:
            false
        }
      );


      /*
       * Pointer Move
       */
      listen(
        viewport,
        'pointermove',
        event => {
          if (
            !state.interactionEnabled ||
            !state.pointers.has(
              event.pointerId
            )
          ) {
            return;
          }


          state.pointers.set(
            event.pointerId,
            {
              x:
                event.clientX,

              y:
                event.clientY
            }
          );


          /*
           * Pinch
           */
          if (
            state.pointers.size >=
            2
          ) {
            const [
              a,
              b
            ] =
              [
                ...state.pointers
                  .values()
              ];


            if (
              !state.pinch
            ) {
              const center =
                mid(
                  a,
                  b
                );


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
                      a,
                      b
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


            const center =
              mid(
                a,
                b
              );


            const rect =
              viewport.getBoundingClientRect();


            state.scale =
              clamp(
                state.pinch.s *
                (
                  dist(
                    a,
                    b
                  ) /
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
            renderConnections();


            return;
          }


          /*
           * Connection drag
           */
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


          /*
           * Node drag
           */
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
              Math.hypot(
                dx,
                dy
              ) >
              7
            ) {
              drag.moved =
                true;


              const element =
                getNodeElement(
                  drag.node.id
                );


              if (
                element
              ) {
                element.classList.add(
                  'vc-dragging'
                );


                /*
                 * 드래그하는 동안은
                 * 내용만 접고
                 * 위치는 유지한다.
                 */
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


            if (
              drag.moved
            ) {
              event.preventDefault();


              const x =
                drag.nodeX +
                dx /
                state.scale;


              const y =
                drag.nodeY +
                dy /
                state.scale;


              /*
               * 절대 layoutWorkflow()
               * 호출하지 않는다.
               */
              drag.node.x =
                x;


              drag.node.y =
                y;


              const element =
                getNodeElement(
                  drag.node.id
                );


              if (
                element
              ) {
                element.style.left =
                  `${x}px`;

                element.style.top =
                  `${y}px`;
              }


              renderConnections();
            }


            return;
          }


          /*
           * Canvas pan
           */
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
              Math.hypot(
                dx,
                dy
              ) >
              7
            ) {
              pan.moved =
                true;


              canvasElement.classList.add(
                'vc-dragging'
              );
            }


            if (
              pan.moved
            ) {
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
          }
        },
        {
          passive:
            false
        }
      );


      /*
       * Pointer End
       */
      function endPointer(
        event
      ) {

        /*
         * Connection
         */
        if (
          state.connectionDrag
            ?.pointerId ===
          event.pointerId
        ) {
          const drag =
            state.connectionDrag;


          const target =
            document
              .elementFromPoint(
                event.clientX,
                event.clientY
              )
              ?.closest(
                '.vc-port-hit.vc-input'
              );


          const node =
            target?.closest(
              '.vc-node'
            );


          if (
            target &&
            node
          ) {
            connect(
              drag.from,
              {
                node:
                  node.dataset
                    .nodeId,

                port:
                  target.dataset
                    .portId
              }
            );
          }


          state.connectionDrag =
            null;


          dragLayer.textContent =
            '';
        }


        /*
         * Node drag
         */
        if (
          state.nodeDrag
            ?.pointerId ===
          event.pointerId
        ) {
          const drag =
            state.nodeDrag;


          const element =
            getNodeElement(
              drag.node.id
            );


          if (
            element
          ) {
            element.classList.remove(
              'vc-dragging'
            );


            /*
             * 드래그 전에 펼쳐져 있었으면
             * 다시 펼친다.
             */
            if (
              drag.wasExpanded
            ) {
              setNodeExpanded(
                drag.node,
                true
              );
            }
          }


          state.nodeDrag =
            null;


          /*
           * 드래그가 끝난 뒤
           * 현재 x/y를 저장한 상태로 change 발생
           */
          emit(
            'change',
            getWorkflow()
          );
        }


        state.pointers.delete(
          event.pointerId
        );


        if (
          state.pointers.size <
          2
        ) {
          state.pinch =
            null;
        }


        if (
          state.pointers.size ===
          0
        ) {
          state.canvasPan =
            null;


          state.connectionDrag =
            null;


          canvasElement.classList.remove(
            'vc-dragging'
          );


          dragLayer.textContent =
            '';
        }


        renderConnections();
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


      /*
       * lostpointercapture
       */
      listen(
        viewport,
        'lostpointercapture',
        event => {
          if (
            state.nodeDrag
              ?.pointerId ===
            event.pointerId
          ) {
            const drag =
              state.nodeDrag;


            const element =
              getNodeElement(
                drag.node.id
              );


            element?.classList.remove(
              'vc-dragging'
            );


            if (
              drag.wasExpanded
            ) {
              setNodeExpanded(
                drag.node,
                true
              );
            }


            state.nodeDrag =
              null;


            emit(
              'change',
              getWorkflow()
            );
          }
        }
      );


      /* =======================================================
         Wheel zoom
      ======================================================= */

      listen(
        viewport,
        'wheel',
        event => {
          if (
            !state.interactionEnabled
          ) {
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
        {
          passive:
            false
        }
      );


      /* =======================================================
         Resize
         IMPORTANT:
         절대 layoutWorkflow() 하지 않는다.
      ======================================================= */

      const resizeObserver =
        new ResizeObserver(
          () => {
            if (
              state.destroyed
            ) {
              return;
            }


            for (
              const node
              of state.nodes
            ) {
              const element =
                getNodeElement(
                  node.id
                );


              if (
                !element
              ) {
                continue;
              }


              positionPorts(
                element,
                getDefinition(
                  node.type
                )
              );
            }


            renderConnections();


            emit(
              'resize',
              viewport.getBoundingClientRect()
            );
          }
        );


      resizeObserver.observe(
        viewport
      );


      /* =======================================================
         Render
         IMPORTANT:
         layoutWorkflow() 없음
      ======================================================= */

      function render() {
        renderTransform();

        renderNodes();

        renderConnections();
      }


      /* =======================================================
         Center
      ======================================================= */

      function centerWorkflow() {
        if (
          !state.nodes.length
        ) {
          return;
        }


        const rect =
          viewport.getBoundingClientRect();


        let minX =
          Infinity;


        let minY =
          Infinity;


        let maxX =
          -Infinity;


        let maxY =
          -Infinity;


        for (
          const node
          of state.nodes
        ) {
          const element =
            getNodeElement(
              node.id
            );


          const width =
            element?.offsetWidth ||
            190;


          const height =
            element?.offsetHeight ||
            74;


          minX =
            Math.min(
              minX,
              node.x
            );


          minY =
            Math.min(
              minY,
              node.y
            );


          maxX =
            Math.max(
              maxX,
              node.x +
              width
            );


          maxY =
            Math.max(
              maxY,
              node.y +
              height
            );
        }


        state.offset.x =
          rect.width /
            2 -
          (
            (minX +
              maxX) /
            2
          ) *
          state.scale;


        state.offset.y =
          rect.height /
            2 -
          (
            (minY +
              maxY) /
            2
          ) *
          state.scale -
          60;


        renderTransform();

        renderConnections();
      }


      /* =======================================================
         API
      ======================================================= */

      const api = {

        root:
          viewport,


        getNode,


        getWorkflow,


        getWorkflowIR,


        getState:
          () => ({
            workflow:
              getWorkflow(),

            viewport: {
              scale:
                state.scale,

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


        isInteractionEnabled:
          () =>
            state.interactionEnabled,


        getNodeDefinition:
          type =>
            getDefinition(
              type
            ),


        getNodeDefinitions:
          () =>
            Object.fromEntries(
              registry.entries()
            ),


        center() {
          centerWorkflow();

          return api;
        },


        layout() {
          layoutWorkflow();

          applyLayoutToDom();

          return api;
        },


        /*
         * render는 위치를 재계산하지 않는다.
         */
        render,


        on,


        off,


        destroy() {
          if (
            state.destroyed
          ) {
            return;
          }


          state.destroyed =
            true;


          if (
            state.reflowFrame !==
            null
          ) {
            cancelAnimationFrame(
              state.reflowFrame
            );

            state.reflowFrame =
              null;
          }


          if (
            state.expansionAnimation
          ) {
            cancelAnimationFrame(
              state.expansionAnimation
            );

            state.expansionAnimation =
              null;
          }


          listeners
            .splice(
              0
            )
            .forEach(
              cleanup => {
                try {
                  cleanup();
                } catch {}
              }
            );


          resizeObserver.disconnect();


          state.pointers.clear();


          state.nodeDrag =
            null;

          state.canvasPan =
            null;

          state.pinch =
            null;

          state.connectionDrag =
            null;


          events.clear();


          connectionLayer.textContent =
            '';

          dragLayer.textContent =
            '';

          nodesLayer.textContent =
            '';


          if (
            target._canvasNode ===
            api
          ) {
            target._canvasNode =
              null;
          }


          if (
            viewport._canvasNode ===
            api
          ) {
            viewport._canvasNode =
              null;
          }
        }
      };


      /* =======================================================
         Mount
      ======================================================= */

      target._canvasNode =
        api;


      viewport._canvasNode =
        api;


      const initial = {
        nodes: [
          {
            id:
              'start',

            type:
              'start',

            x:
              0,

            y:
              0,

            expanded:
              true,

            data: {
              params:
                {}
            }
          }
        ],

        connections:
          []
      };


      /*
       * 최초 mount
       */
      setState(
        options.initialWorkflow ||
        initial
      );


      /*
       * UI에서 Canvas를 처음 열기 전까지
       * interaction이 꺼져 있을 수 있다.
       */
      setInteractionEnabled(
        options.interactionEnabled ===
        true
      );


      if (
        options.onChange
      ) {
        on(
          'change',
          options.onChange
        );
      }


      if (
        options.onSelect
      ) {
        on(
          'select',
          options.onSelect
        );
      }


      if (
        options.onConnect
      ) {
        on(
          'connect',
          options.onConnect
        );
      }


      if (
        options.onValidate
      ) {
        on(
          'validate',
          options.onValidate
        );
      }


      if (
        options.onLayout
      ) {
        on(
          'layout',
          options.onLayout
        );
      }


      render();


      return api;
    };


  /* =========================================================
     Mounted instance helper
  ========================================================= */

  global.getMountedCanvasNode =
    function (
      target
    ) {
      if (
        typeof target ===
        'string'
      ) {
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
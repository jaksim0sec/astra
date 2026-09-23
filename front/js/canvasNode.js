(function (global) {
  'use strict';

  const SVG_NS = 'http://www.w3.org/2000/svg';

  const MIN_SCALE = 0.12;
  const MAX_SCALE = 3;

  const GAP_Y = 36;
  const GAP_X_MIN = 54;
  const GAP_X_MAX = 110;
  const RELAX_PASSES = 6;

  const U =
    global.AstraUtils || {};

  const clamp =
    U.clamp ||
    ((value, min, max) =>
      Math.min(
        max,
        Math.max(min, value)
      ));

  const clone =
    U.clone ||
    (value => {
      try {
        return structuredClone(
          value
        );
      } catch {
        return JSON.parse(
          JSON.stringify(value)
        );
      }
    });

  const escapeHtml =
    U.escapeHtml ||
    (value =>
      String(
        value ?? ''
      ).replace(
        /[&<>'"]/g,
        char => ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          "'": '&#39;',
          '"': '&quot;'
        }[char])
      ));

  let instanceSeq = 0;

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
      const [key, value]
      of Object.entries(attrs)
    ) {
      element.setAttribute(
        key,
        value
      );
    }

    return element;
  }


  function dist(a, b) {
    return Math.hypot(
      b.x - a.x,
      b.y - a.y
    );
  }


  function mid(a, b) {
    return {
      x:
        (a.x + b.x) / 2,

      y:
        (a.y + b.y) / 2
    };
  }


  function endpoint(value) {
    if (
      typeof value !== 'string'
    ) {
      throw new Error(
        '연결 endpoint가 문자열이 아닙니다.'
      );
    }

    const dot =
      value.lastIndexOf('.');

    if (
      dot < 1 ||
      dot === value.length - 1
    ) {
      throw new Error(
        `잘못된 endpoint입니다: ${value}`
      );
    }

    return {
      node:
        value.slice(
          0,
          dot
        ),

      port:
        value.slice(
          dot + 1
        )
    };
  }


  function pathFor(a, b) {
    const bend =
      clamp(
        Math.abs(
          b.x - a.x
        ) * 0.22 +
        Math.abs(
          b.y - a.y
        ) * 0.05,
        28,
        85
      );

    return `
      M ${a.x} ${a.y}
      C ${a.x + bend} ${a.y},
        ${b.x - bend} ${b.y},
        ${b.x} ${b.y}
    `.replace(
      /\s+/g,
      ' '
    );
  }


  global.mountCanvasNode =
    async function (
      target,
      options = {}
    ) {

      if (
        typeof target === 'string'
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

        connectionLayer.className.baseVal =
          'vc-connection-layer';

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

        dragLayer.className.baseVal =
          'vc-drag-connection-layer';

        connectionSvg.appendChild(
          dragLayer
        );
      }


      const state = {
        nodes: [],
        connections: [],

        selectedNode: null,

        scale: 1,

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
          options.interactionEnabled !== false,

        destroyed:
          false,

        reflowFrame:
          null,

        connectionFrame:
          null
      };


      const registry =
        new Map(
          Object.entries(
            definitions
          ).map(
            ([type, def]) => [
              type,
              normalizeDefinition(
                type,
                def
              )
            ]
          )
        );


      const events =
        new Map();

      const listeners = [];

      const observers = [];


      const connectionElements =
        new Map();


      function on(
        name,
        fn
      ) {
        if (
          typeof fn !== 'function'
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
          .add(fn);

        return () =>
          off(
            name,
            fn
          );
      }


      function off(
        name,
        fn
      ) {
        events
          .get(name)
          ?.delete(fn);
      }


      function emit(
        name,
        payload
      ) {
        for (
          const fn
          of events.get(name) || []
        ) {
          try {
            fn(
              payload,
              api
            );
          } catch (error) {
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
        opts
      ) {
        element.addEventListener(
          type,
          handler,
          opts
        );

        listeners.push(
          () =>
            element.removeEventListener(
              type,
              handler,
              opts
            )
        );
      }


      function scheduleConnectionRender() {
        if (
          state.destroyed
        ) {
          return;
        }

        if (
          state.connectionFrame !==
          null
        ) {
          return;
        }

        state.connectionFrame =
          requestAnimationFrame(
            () => {
              state.connectionFrame =
                null;

              if (
                !state.destroyed
              ) {
                renderConnections();
              }
            }
          );
      }


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
            port?.multiple !== false,

          accepts:
            Array.isArray(
              port?.accepts
            ) &&
            port.accepts.length
              ? [
                  ...port.accepts
                ]
              : [
                  'any'
                ]
        };
      }


      function normalizeDefinition(
        type,
        definition
      ) {
        return {
          ...(definition || {}),

          name:
            definition?.name ||
            type,

          color:
            definition?.color ||
            '#888888',

          icon:
            typeof definition?.icon ===
            'string'
              ? definition.icon
              : '',

          inputs:
            Array.isArray(
              definition?.inputs
            )
              ? definition.inputs.map(
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
              : [],

          outputs:
            Array.isArray(
              definition?.outputs
            )
              ? definition.outputs.map(
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
              : [],

          params:
            Array.isArray(
              definition?.params
            )
              ? definition.params
              : []
        };
      }


      function getDefinition(
        type
      ) {
        return (
          registry.get(
            type
          ) ||
          null
        );
      }


      function getNode(
        id
      ) {
        return (
          state.nodes.find(
            node =>
              node.id === id
          ) ||
          null
        );
      }


      function getNodeElement(
        id
      ) {
        return [
          ...nodesLayer.querySelectorAll(
            '.vc-node'
          )
        ].find(
          element =>
            element.dataset.nodeId ===
            String(id)
        ) || null;
      }


      function normalizeNode(
        input
      ) {
        return {
          id:
            String(
              input?.id ||
              `n-${Date.now()
                .toString(36)}-${Math.random()
                .toString(36)
                .slice(2, 7)}`
            ),

          type:
            String(
              input?.type || ''
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
            !!input?.expanded,

          data:
            clone(
              input?.data || {}
            )
        };
      }


      function renderSlotContent(
        node,
        definition
      ) {
        const out = [];

        if (
          definition.desc ||
          definition.description
        ) {
          out.push(`
            <div class="vc-slot-description">
              ${escapeHtml(
                definition.desc ||
                definition.description ||
                ''
              )}
            </div>
          `);
        }

        const values =
          node.data?.params ||
          {};

        for (
          const param
          of definition.params || []
        ) {
          out.push(`
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
                  values[
                    param.id
                  ] ?? ''
                )}"
                placeholder="${escapeHtml(
                  param.placeholder ||
                  ''
                )}"
              >

            </div>
          `);
        }


        if (
          node.type === 'file'
        ) {
          const mime =
            node.data?.mime ||
            '알 수 없는 형식';

          const size =
            Number(
              node.data?.size ||
              0
            );

          const text =
            size < 1024
              ? `${size} B`
              : size < 1048576
                ? `${(
                    size /
                    1024
                  ).toFixed(1)} KB`
                : `${(
                    size /
                    1048576
                  ).toFixed(1)} MB`;

          out.push(`
            <div class="vc-slot-custom">
              <div class="vc-file-meta">
                <span>
                  ${escapeHtml(
                    mime
                  )}
                </span>

                <span>
                  ${escapeHtml(
                    text
                  )}
                </span>
              </div>
            </div>
          `);
        }

        return out.join('');
      }


      function renderPorts(
        node,
        ports,
        direction
      ) {
        const cls =
          direction === 'input'
            ? 'vc-input'
            : 'vc-output';

        return (
          ports || []
        )
          .map(
            port => `
              <div
                class="vc-port-hit ${cls}"
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


      function observeNode(
        element
      ) {
        if (
          !element
        ) {
          return;
        }

        if (
          nodeResizeObserver
        ) {
          try {
            nodeResizeObserver.observe(
              element
            );
          } catch {}
        }
      }


      const nodeResizeObserver =
        new ResizeObserver(
          entries => {
            if (
              state.destroyed
            ) {
              return;
            }

            for (
              const entry
              of entries
            ) {
              const node =
                getNode(
                  entry
                    .target
                    ?.dataset
                    ?.nodeId
                );

              if (!node) {
                continue;
              }

              positionPorts(
                entry.target,
                getDefinition(
                  node.type
                )
              );
            }

            scheduleConnectionRender();
          }
        );


      observers.push(
        () =>
          nodeResizeObserver.disconnect()
      );


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

          const isImageFile =
            node.type === 'file' &&
            String(
              node.data?.mime || ''
            ).startsWith(
              'image/'
            );

          const classes = [
            'vc-node'
          ];

          if (
            node.type === 'start'
          ) {
            classes.push(
              'vc-start-node'
            );
          }

          if (
            node.type === 'file'
          ) {
            classes.push(
              'vc-file-node'
            );
          }

          if (isImageFile) {
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
            classes.join(' ');

          element.dataset.nodeId =
            node.id;

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
            node.type === 'file'
              ? (
                  node.data?.name ||
                  '이름 없는 파일'
                )
              : definition.name;


          const extension =
            node.type === 'file' &&
            fileName.includes('.')
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
                node.type === 'file'
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
                node.type === 'start'
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
                  class="vc-node-action vc-node-toggle"
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
              node.type !== 'start'
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
                      <span>삭제하기</span>
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


          observeNode(
            element
          );


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

        scheduleReflow();

        renderConnections();
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
            element.offsetHeight || 74
          );


        function place(
          selector,
          ports
        ) {
          [
            ...element.querySelectorAll(
              selector
            )
          ].forEach(
            (
              port,
              index
            ) => {
              const y =
                (
                  (index + 1) /
                  Math.max(
                    1,
                    ports.length + 1
                  )
                ) *
                height;

              port.style.height =
                '32px';

              port.style.top =
                `${y - 16}px`;
            }
          );
        }


        place(
          '.vc-port-hit.vc-input',
          definition.inputs || []
        );

        place(
          '.vc-port-hit.vc-output',
          definition.outputs || []
        );
      }


      function getPortElement(
        nodeId,
        portId,
        direction
      ) {
        return [
          ...nodesLayer.querySelectorAll(
            '.vc-port-hit'
          )
        ].find(
          element =>
            element.dataset.nodeId ===
              String(nodeId) &&
            element.dataset.portId ===
              String(portId) &&
            element.dataset.portDir ===
              direction
        ) || null;
      }


      function portPoint(
        nodeId,
        portId,
        direction
      ) {
        const node =
          getNode(
            nodeId
          );

        const element =
          getNodeElement(
            nodeId
          );

        const definition =
          getDefinition(
            node?.type
          );

        if (
          !node ||
          !element ||
          !definition
        ) {
          return null;
        }

        const ports =
          direction === 'input'
            ? (
                definition.inputs ||
                []
              )
            : (
                definition.outputs ||
                []
              );

        const index =
          ports.findIndex(
            port =>
              String(port.id) ===
              String(portId)
          );

        if (
          index < 0
        ) {
          return null;
        }

        const height =
          Math.max(
            50,
            element.offsetHeight || 74
          );

        const y =
          (
            (index + 1) /
            Math.max(
              1,
              ports.length + 1
            )
          ) *
          height;

        const width =
          element.offsetWidth ||
          190;

        return {
          x:
            direction === 'input'
              ? node.x
              : node.x + width,

          y:
            node.y + y
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


      function removeConnectionElement(
        id
      ) {
        const element =
          connectionElements.get(
            id
          );

        if (
          !element
        ) {
          return;
        }

        element.remove();

        connectionElements.delete(
          id
        );
      }


      function renderConnections() {
        if (
          state.destroyed
        ) {
          return;
        }

        const activeIds =
          new Set();

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

          activeIds.add(
            connection.id
          );

          let path =
            connectionElements.get(
              connection.id
            );

          if (
            !path
          ) {
            path =
              svgEl(
                'path'
              );

            path.classList.add(
              'vc-connection'
            );

            path.dataset.connectionId =
              connection.id;

            path.style.pointerEvents =
              'stroke';

            connectionLayer.appendChild(
              path
            );

            connectionElements.set(
              connection.id,
              path
            );
          }

          path.setAttribute(
            'd',
            pathFor(
              from,
              to
            )
          );

          const active =
            state.selectedNode ===
              connection.from.node ||
            state.selectedNode ===
              connection.to.node;

          path.classList.toggle(
            'vc-active',
            active
          );

          if (
            active
          ) {
            const definition =
              getDefinition(
                getNode(
                  connection.from.node
                )?.type
              );

            if (
              definition?.color
            ) {
              path.style.stroke =
                definition.color;
            }
          } else {
            path.style.stroke =
              '';
          }
        }


        for (
          const [
            id
          ]
          of connectionElements
        ) {
          if (
            !activeIds.has(id)
          ) {
            removeConnectionElement(
              id
            );
          }
        }


        renderDragConnection();
      }


      function renderDragConnection() {
        dragLayer.textContent =
          '';

        const drag =
          state.connectionDrag;

        if (
          !drag
        ) {
          return;
        }

        let from;
        let to;

        if (
          drag.direction ===
          'output'
        ) {
          from =
            portPoint(
              drag.anchor.node,
              drag.anchor.port,
              'output'
            );

          to =
            screenToWorld(
              drag.x,
              drag.y
            );
        } else {
          from =
            screenToWorld(
              drag.x,
              drag.y
            );

          to =
            portPoint(
              drag.anchor.node,
              drag.anchor.port,
              'input'
            );
        }

        if (
          !from ||
          !to
        ) {
          return;
        }

        const sourceNode =
          drag.direction ===
            'output'
            ? getNode(
                drag.anchor.node
              )
            : getNode(
                drag.target?.node
              );

        const definition =
          getDefinition(
            sourceNode?.type
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

        path.style.pointerEvents =
          'none';

        if (
          definition?.color
        ) {
          path.style.stroke =
            definition.color;
        }

        dragLayer.appendChild(
          path
        );


        const dotPoint =
          drag.direction ===
            'output'
            ? from
            : to;


        const dot =
          svgEl(
            'circle',
            {
              cx:
                dotPoint.x,

              cy:
                dotPoint.y,

              r:
                4
            }
          );

        dot.classList.add(
          'vc-drag-source-dot'
        );

        if (
          definition?.color
        ) {
          dot.style.fill =
            definition.color;
        }

        dot.style.pointerEvents =
          'none';

        dragLayer.appendChild(
          dot
        );
      }


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


      function worldToScreen(
        x,
        y
      ) {
        const rect =
          viewport.getBoundingClientRect();

        return {
          x:
            rect.left +
            state.offset.x +
            x *
            state.scale,

          y:
            rect.top +
            state.offset.y +
            y *
            state.scale
        };
      }


      function renderTransform() {
        world.style.transform =
          `translate(${state.offset.x}px,` +
          `${state.offset.y}px) ` +
          `scale(${state.scale})`;
      }


      function centerWorkflow() {
        if (
          !state.nodes.length
        ) {
          return;
        }

        const rect =
          viewport.getBoundingClientRect();

        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;


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
              node.x + width
            );

          maxY =
            Math.max(
              maxY,
              node.y + height
            );
        }


        state.offset.x =
          rect.width / 2 -
          (
            (minX + maxX) /
            2
          ) *
          state.scale;


        state.offset.y =
          rect.height / 2 -
          (
            (minY + maxY) /
            2
          ) *
          state.scale -
          60;


        renderTransform();

        renderConnections();
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

        if (
          !element
        ) {
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

        if (
          !body
        ) {
          scheduleConnectionRender();
          return;
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

          positionPorts(
            element,
            getDefinition(
              node.type
            )
          );

          requestAnimationFrame(
            () => {
              body.style.transition =
                '';

              positionPorts(
                element,
                getDefinition(
                  node.type
                )
              );

              renderConnections();
            }
          );

          return;
        }


        if (
          node.expanded
        ) {
          body.style.height =
            '0px';

          requestAnimationFrame(
            () => {
              if (
                !body
              ) {
                return;
              }

              body.style.height =
                `${body.scrollHeight}px`;

              trackExpansion(
                element,
                body
              );
            }
          );

          return;
        }


        body.style.height =
          `${body.scrollHeight}px`;

        requestAnimationFrame(
          () => {
            body.style.height =
              '0px';

            trackExpansion(
              element,
              body
            );
          }
        );
      }


      function trackExpansion(
        element,
        body
      ) {
        let active = true;

        let frame = null;

        const started =
          performance.now();

        const duration =
          340;


        function tick() {
          if (
            !active
          ) {
            return;
          }

          positionPorts(
            element,
            getDefinition(
              getNode(
                element.dataset.nodeId
              )?.type
            )
          );

          renderConnections();

          if (
            performance.now() -
            started <
            duration
          ) {
            frame =
              requestAnimationFrame(
                tick
              );
          } else {
            active =
              false;

            if (
              frame !== null
            ) {
              cancelAnimationFrame(
                frame
              );
            }
          }
        }


        frame =
          requestAnimationFrame(
            tick
          );
      }


      function selectNode(
        id
      ) {
        if (
          id !== null &&
          !getNode(id)
        ) {
          id = null;
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
                element.dataset.nodeId ===
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

        if (
          !node
        ) {
          return;
        }

        setNodeExpanded(
          node,
          !node.expanded
        );

        selectNode(
          id
        );

        emit(
          'change',
          getWorkflow()
        );
      }


      function portDef(
        nodeId,
        portId,
        direction
      ) {
        const definition =
          getDefinition(
            getNode(
              nodeId
            )?.type
          );

        if (
          !definition
        ) {
          return null;
        }

        const ports =
          direction === 'input'
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


      function compatible(
        output,
        input
      ) {
        const accepts =
          Array.isArray(
            input?.accepts
          )
            ? input.accepts
            : [
                'any'
              ];

        return (
          !!output &&
          !!input &&
          (
            accepts.includes(
              'any'
            ) ||
            accepts.includes(
              output.type
            ) ||
            output.type ===
              'any'
          )
        );
      }


      function wouldCycle(
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


        const stack = [
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
        const errors = [];


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


        if (
          fromNodeId ===
          toNodeId
        ) {
          errors.push({
            code:
              'SELF_CONNECTION',

            message:
              '노드는 자기 자신에게 연결할 수 없습니다.'
          });
        }


        if (
          !source
        ) {
          errors.push({
            code:
              'MISSING_SOURCE_NODE',

            message:
              `출발 노드 ${fromNodeId}가 존재하지 않습니다.`
          });
        }


        if (
          !target
        ) {
          errors.push({
            code:
              'MISSING_TARGET_NODE',

            message:
              `도착 노드 ${toNodeId}가 존재하지 않습니다.`
          });
        }


        if (
          !output
        ) {
          errors.push({
            code:
              'MISSING_SOURCE_PORT',

            message:
              `출력 포트 ${fromPortId}가 존재하지 않습니다.`
          });
        }


        if (
          !input
        ) {
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
          wouldCycle(
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
            errors.length === 0,

          errors
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
            `c-${Date.now()
              .toString(36)}` +
            Math.random()
              .toString(36)
              .slice(2, 8);

        } while (
          state.connections.some(
            connection =>
              connection.id ===
              id
          )
        );

        return id;
      }


      function sameConnection(
        a,
        b
      ) {
        return (
          a.from.node ===
            b.from.node &&
          a.from.port ===
            b.from.port &&
          a.to.node ===
            b.to.node &&
          a.to.port ===
            b.to.port
        );
      }


      function connect(
        from,
        to,
        options = {}
      ) {
        const specification = {
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


        /*
          같은 연결을 다시 만들려고 하면
          해당 연결을 제거한다
        */
        const duplicate =
          state.connections.find(
            connection =>
              sameConnection(
                connection,
                specification
              )
          );


        if (
          duplicate
        ) {
          disconnect(
            duplicate.id
          );

          return null;
        }


        const result =
          canConnect(
            specification
          );


        if (
          !result.ok
        ) {
          emit(
            'connectionRejected',
            result
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


        removeConnectionElement(
          id
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


      function validate() {
        const errors = [];
        const warnings = [];

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

              message:
                `노드 타입 ${node.type}이 등록되어 있지 않습니다.`
            });
          }
        }


        const graph =
          new Map();


        for (
          const connection
          of state.connections
        ) {
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


          if (
            !getNode(
              connection.from.node
            )
          ) {
            errors.push({
              code:
                'MISSING_SOURCE_NODE',

              message:
                `연결 ${connection.id}의 출발 노드가 없습니다.`
            });
          }


          if (
            !getNode(
              connection.to.node
            )
          ) {
            errors.push({
              code:
                'MISSING_TARGET_NODE',

              message:
                `연결 ${connection.id}의 도착 노드가 없습니다.`
            });
          }


          if (
            !output
          ) {
            errors.push({
              code:
                'MISSING_SOURCE_PORT',

              message:
                `연결 ${connection.id}의 출력 포트가 없습니다.`
            });
          }


          if (
            !input
          ) {
            errors.push({
              code:
                'MISSING_TARGET_PORT',

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
            of graph.get(id) || []
          ) {
            if (
              dfs(next)
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
            errors.length === 0,

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
                  connection.data
                    ?.kind !==
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
                  connection.data
                    ?.kind ===
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
                    `c-${Math.random()
                      .toString(36)
                      .slice(2, 9)}`,

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


      function setState(
        saved = {}
      ) {
        const workflow =
          saved.workflow ||
          saved;


        state.nodes =
          Array.isArray(
            workflow?.nodes
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


        state.connections =
          Array.isArray(
            workflow?.connections
          )
            ? clone(
                workflow.connections
              )
            : [
                ...convertEdges(
                  workflow?.links,
                  'flow'
                ),

                ...convertEdges(
                  workflow?.data,
                  'data'
                )
              ];


        state.connections =
          state.connections
            .map(
              connection => ({
                id:
                  String(
                    connection.id ||
                    `c-${Math.random()
                      .toString(36)
                      .slice(2, 8)}`
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
                  ?.offset
                  ?.x
              ) || 0,

            y:
              Number(
                saved.viewport
                  ?.offset
                  ?.y
              ) || 0
          };
        }


        state.selectedNode =
          null;


        render();

        emit(
          'change',
          getWorkflow()
        );


        return api;
      }


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


        const startNodes =
          state.nodes.filter(
            node =>
              node.type ===
              'start'
          );


        const queue = [];
        const queued =
          new Set();


        (
          startNodes.length
            ? startNodes
            : state.nodes.filter(
                node =>
                  indegree.get(
                    node.id
                  ) === 0
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


        let queueIndex = 0;


        while (
          queueIndex <
          queue.length
        ) {
          const id =
            queue[
              queueIndex++
            ];


          const current =
            rank.get(id) ||
            0;


          for (
            const next
            of outgoing.get(id) || []
          ) {
            rank.set(
              next,
              Math.max(
                rank.get(next) ||
                  0,

                current + 1
              )
            );


            indegree.set(
              next,
              indegree.get(
                next
              ) - 1
            );


            if (
              indegree.get(
                next
              ) === 0 &&
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
            maxRank++;

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
          const r =
            rank.get(
              node.id
            ) || 0;

          if (
            !layers.has(r)
          ) {
            layers.set(
              r,
              []
            );
          }

          layers
            .get(r)
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
              a - b
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
              nodes.length - 1
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


        function neighborIds(
          node,
          targetLayer
        ) {
          return [
            ...(
              incoming.get(
                node.id
              ) || []
            ),

            ...(
              outgoing.get(
                node.id
              ) || []
            )
          ].filter(
            id =>
              rank.get(id) ===
              targetLayer
          );
        }


        for (
          let pass = 0;
          pass <
            RELAX_PASSES;
          pass++
        ) {
          const forward =
            pass % 2 === 0;


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
                ? layer - 1
                : layer + 1;


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
                      neighborIds(
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
                      ) || 0;


                    if (
                      values.length
                    ) {
                      values.sort(
                        (
                          a,
                          b
                        ) =>
                          a - b
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
                ) || 0;


              if (
                previousBottom !==
                -Infinity
              ) {
                center =
                  Math.max(
                    center,
                    previousBottom +
                    GAP_Y +
                    height / 2
                  );
              }


              centers.set(
                node.id,
                center
              );


              previousBottom =
                center +
                height / 2;
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


        let x = 0;


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
            const s =
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
                ) || 0
              ) -
              s.height / 2;
          }
        }
      }


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


              if (
                state.destroyed
              ) {
                return;
              }


              layoutWorkflow();


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


              emit(
                'layout',
                getWorkflow()
              );
            }
          );
      }


      function cancelScheduledReflow() {
        if (
          state.reflowFrame ===
          null
        ) {
          return;
        }

        cancelAnimationFrame(
          state.reflowFrame
        );

        state.reflowFrame =
          null;
      }


      function applyWorkflowIR(
        spec,
        options = {}
      ) {
        if (
          !spec ||
          typeof spec !== 'object' ||
          !Array.isArray(
            spec.nodes
          )
        ) {
          throw new Error(
            'workflow spec가 올바르지 않습니다.'
          );
        }


        state.nodes =
          spec.nodes
            .map(
              node =>
                normalizeNode({
                  id:
                    node.id,

                  type:
                    node.type,

                  x:
                    0,

                  y:
                    0,

                  expanded:
                    options.expanded ??
                    true,

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


        render();

        cancelScheduledReflow();

        layoutWorkflow();


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


        if (
          options.center !== false
        ) {
          centerWorkflow();
        }


        scheduleReflow();


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


      function findNewNodePosition() {
        const rect =
          viewport.getBoundingClientRect();


        const center =
          screenToWorld(
            rect.left +
              rect.width / 2,

            rect.top +
              rect.height / 2
          );


        const width =
          190;

        const height =
          60;

        const gap =
          24;


        const spots = [
          [
            0,
            0
          ],
          [
            0,
            height + gap
          ],
          [
            0,
            -height - gap
          ],
          [
            -width - gap,
            0
          ],
          [
            width + gap,
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
            width / 2 +
            dx;


          const y =
            center.y -
            height / 2 +
            dy;


          const occupied =
            state.nodes.some(
              node =>
                Math.abs(
                  node.x -
                  x
                ) <
                  width + gap &&
                Math.abs(
                  node.y -
                  y
                ) <
                  height + gap
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
            width / 2,

          y:
            center.y -
            height / 2
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


        if (
          type === 'start' &&
          state.nodes.some(
            node =>
              node.type ===
              'start'
          )
        ) {
          const existing =
            state.nodes.find(
              node =>
                node.type ===
                'start'
            );


          selectNode(
            existing.id
          );


          return existing;
        }


        const position =
          data.x != null &&
          data.y != null
            ? {
                x:
                  Number(
                    data.x
                  ),

                y:
                  Number(
                    data.y
                  )
              }
            : findNewNodePosition();


        const node =
          normalizeNode({
            id:
              data.id ||
              `n-${Date.now()
                .toString(36)}-${Math.random()
                .toString(36)
                .slice(2, 7)}`,

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
              data.data || {}
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
              item.id !== id
          );


        const removed =
          state.connections.filter(
            connection =>
              connection.from.node ===
                id ||
              connection.to.node ===
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


        for (
          const connection
          of removed
        ) {
          removeConnectionElement(
            connection.id
          );
        }


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


      function setInteractionEnabled(
        enabled
      ) {
        state.interactionEnabled =
          !!enabled;


        if (
          !state.interactionEnabled
        ) {
          state.pointers.clear();

          state.nodeDrag =
            null;

          state.canvasPan =
            null;

          state.pinch =
            null;

          cancelConnectionDrag();
        }


        emit(
          'interaction',
          state.interactionEnabled
        );


        return api;
      }


      function beginConnectionDrag(
        event,
        port,
        node
      ) {
        const direction =
          port.dataset
            .portDir;

        if (
          direction !==
            'output' &&
          direction !==
            'input'
        ) {
          return;
        }


        cancelScheduledReflow();


        state.connectionDrag = {
          pointerId:
            event.pointerId,

          direction,

          anchor: {
            node:
              node.id,

            port:
              port.dataset
                .portId
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


      function cancelConnectionDrag() {
        const drag =
          state.connectionDrag;

        if (
          !drag
        ) {
          dragLayer.textContent =
            '';

          return false;
        }


        try {
          viewport.releasePointerCapture(
            drag.pointerId
          );
        } catch {}


        state.connectionDrag =
          null;

        dragLayer.textContent =
          '';

        renderConnections();

        return true;
      }


      function getPortAtWorldPoint(
        worldPoint,
        direction
      ) {
        const tolerance =
          20;


        for (
          const node
          of state.nodes
        ) {
          const definition =
            getDefinition(
              node.type
            );

          if (
            !definition
          ) {
            continue;
          }


          const ports =
            direction ===
              'input'
              ? (
                  definition.inputs ||
                  []
                )
              : (
                  definition.outputs ||
                  []
                );


          const element =
            getNodeElement(
              node.id
            );

          if (
            !element
          ) {
            continue;
          }


          const height =
            Math.max(
              50,
              element.offsetHeight ||
              74
            );


          const width =
            element.offsetWidth ||
            190;


          for (
            let index = 0;
            index <
              ports.length;
            index++
          ) {
            const y =
              (
                (index + 1) /
                Math.max(
                  1,
                  ports.length + 1
                )
              ) *
              height;


            const centerX =
              direction ===
                'input'
                ? node.x
                : node.x + width;


            const centerY =
              node.y + y;


            if (
              Math.abs(
                worldPoint.x -
                centerX
              ) <=
                tolerance &&
              Math.abs(
                worldPoint.y -
                centerY
              ) <=
                tolerance
            ) {
              return {
                node:
                  node.id,

                port:
                  String(
                    ports[index].id
                  )
              };
            }
          }
        }


        return null;
      }


      function finishConnection(
        event
      ) {
        const drag =
          state.connectionDrag;

        if (
          !drag
        ) {
          return false;
        }


        const point =
          screenToWorld(
            event.clientX,
            event.clientY
          );


        let targetPort =
          null;


        if (
          drag.direction ===
          'output'
        ) {
          targetPort =
            getPortAtWorldPoint(
              point,
              'input'
            );

          if (
            targetPort
          ) {
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

          if (
            targetPort
          ) {
            connect(
              targetPort,
              drag.anchor
            );
          }
        }


        cancelConnectionDrag();

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
            )
          ) {
            event.stopPropagation();
          }
        },
        {
          passive: false
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


          if (
            !action
          ) {
            return;
          }


          const element =
            action.closest(
              '.vc-node'
            );


          if (
            !element
          ) {
            return;
          }


          event.preventDefault();
          event.stopPropagation();


          const node =
            getNode(
              element.dataset
                .nodeId
            );


          if (
            !node
          ) {
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
            removeNode(
              node.id
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


          if (
            !input
          ) {
            return;
          }


          const element =
            input.closest(
              '.vc-node'
            );


          if (
            !element
          ) {
            return;
          }


          const node =
            getNode(
              element.dataset
                .nodeId
            );


          if (
            !node
          ) {
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

          if (
            !path
          ) {
            return;
          }

          event.preventDefault();
          event.stopPropagation();
        },
        {
          passive: false
        }
      );


      listen(
        connectionLayer,
        'click',
        event => {
          const path =
            event.target.closest(
              '.vc-connection'
            );

          if (
            !path
          ) {
            return;
          }

          event.preventDefault();
          event.stopPropagation();


          const id =
            path.dataset
              .connectionId;


          if (
            id
          ) {
            disconnect(
              id
            );
          }
        }
      );


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


          if (
            state.pointers.size >= 2
          ) {
            cancelConnectionDrag();


            if (
              state.nodeDrag
            ) {
              finishNodeDrag();
            }


            state.canvasPan =
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


            return;
          }


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
                port.dataset
                  .nodeId
              );


            if (
              !node
            ) {
              return;
            }


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


          if (
            nodeElement
          ) {
            event.preventDefault();
            event.stopPropagation();


            const node =
              getNode(
                nodeElement.dataset
                  .nodeId
              );


            if (
              !node
            ) {
              return;
            }


            selectNode(
              node.id
            );


            cancelScheduledReflow();


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
          passive: false
        }
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


          if (
            !tracked
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


          if (
            state.pointers.size >= 2
          ) {
            if (
              state.nodeDrag
            ) {
              finishNodeDrag();
            }


            cancelConnectionDrag();


            state.canvasPan =
              null;


            const points =
              [
                ...state.pointers
                  .values()
              ];


            if (
              !state.pinch
            ) {
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
            state.connectionDrag
              ?.pointerId ===
            event.pointerId
          ) {
            event.preventDefault();


            state.connectionDrag.x =
              event.clientX;

            state.connectionDrag.y =
              event.clientY;


            scheduleConnectionRender();

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
              !drag.moved
            ) {
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


            if (
              element
            ) {
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


            /*
              좌표를 바로 갱신한다
              rAF에서 line DOM만 다시 그린다
            */

            scheduleConnectionRender();

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
              Math.hypot(
                dx,
                dy
              ) >
                7
            ) {
              pan.moved =
                true;
            }


            if (
              !pan.moved
            ) {
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
        {
          passive: false
        }
      );


      function finishNodeDrag() {
        const drag =
          state.nodeDrag;


        if (
          !drag
        ) {
          return;
        }


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


        renderConnections();


        emit(
          'change',
          getWorkflow()
        );
      }


      function endPointer(
        event
      ) {
        if (
          state.connectionDrag
            ?.pointerId ===
          event.pointerId
        ) {
          if (
            event.type ===
            'pointercancel'
          ) {
            cancelConnectionDrag();
          } else {
            finishConnection(
              event
            );
          }
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
          passive: false
        }
      );


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
                element
              ) {
                positionPorts(
                  element,
                  getDefinition(
                    node.type
                  )
                );
              }
            }


            scheduleReflow();

            scheduleConnectionRender();
          }
        );


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


          cancelScheduledReflow();


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

          state.nodeDrag =
            null;

          state.canvasPan =
            null;

          state.pinch =
            null;

          state.connectionDrag =
            null;


          connectionElements
            .forEach(
              element =>
                element.remove()
            );

          connectionElements.clear();


          connectionLayer
            .textContent =
            '';

          dragLayer
            .textContent =
            '';

          nodesLayer
            .textContent =
            '';


          events.clear();


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
              params: {}
            }
          }
        ],

        connections: []
      };


      setState(
        options.initialWorkflow ||
        initial
      );


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
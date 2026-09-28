/* =========================================================
   Astra
   Application Entry
   ========================================================= */
(function (global) {
  "use strict";

  /* =======================================================
     Dependencies
     ======================================================= */
  const UI = global.AstraUI;
  const API = global.AstraAPI;
  const mountCanvasNode = global.mountCanvasNode;

  /* =======================================================
     DOM
     ======================================================= */
  const workspace = document.querySelector("#workspace");
  const chatContent = document.querySelector("#chat-content");
  const chatMessages = document.querySelector("#chat-messages");
  const composerForm = document.querySelector("#composer-form");
  const composerInput = document.querySelector("#composer-input");
  const composerSubmit = document.querySelector("#composer-submit");

  if (!workspace || !chatContent || !chatMessages || !composerForm || !composerInput || !composerSubmit) {
    throw new Error("Astra Application DOM 구조가 올바르지 않습니다.");
  }

  if (!UI || !API || typeof mountCanvasNode !== "function") {
    throw new Error("Astra Application dependency가 준비되지 않았습니다.");
  }

  /* =======================================================
     State
     ======================================================= */
  const state = {
    destroyed: false,
    ready: false,
    busy: false,
    canvas: null,
    workflow: null,
    nodeDefinitions: null,
    nodeBuilder: { root: null, open: false },
    messageCount: 0
  };

  const listeners = [];

  /* =======================================================
     Utilities
     ======================================================= */
  function listen(element, type, handler, options) {
    element.addEventListener(type, handler, options);
    listeners.push(() => {
      element.removeEventListener(type, handler, options);
    });
  }

  function clone(value) {
    if (typeof global.AstraUtils?.clone === "function") {
      return global.AstraUtils.clone(value);
    }
    return JSON.parse(JSON.stringify(value));
  }

  function getCurrentWorkflow() {
    if (state.canvas && typeof state.canvas.getWorkflowIR === "function") {
      return clone(state.canvas.getWorkflowIR());
    }
    if (state.workflow) {
      return clone(state.workflow);
    }
    return null;
  }

  function scrollChatToBottom(immediate = false) {
    if (immediate) {
      chatContent.scrollTop = chatContent.scrollHeight;
      return;
    }
    requestAnimationFrame(() => {
      chatContent.scrollTop = chatContent.scrollHeight;
    });
  }

  /* =======================================================
     Chat
     ======================================================= */
  function createMessage(role, text) {
    const message = document.createElement("div");
    const id = `message-${++state.messageCount}`;

    message.id = id;
    message.className = `astra-message astra-message-${role}`;
    message.dataset.role = role;

    const body = document.createElement("div");
    body.className = "astra-message-body";
    body.textContent = String(text ?? "");

    message.appendChild(body);
    chatMessages.appendChild(message);
    scrollChatToBottom();

    return message;
  }

  function addUserMessage(text) {
    const value = String(text ?? "").trim();
    if (!value) return null;
    return createMessage("user", value);
  }

  function addAssistantMessage(text) {
    const value = String(text ?? "").trim();
    if (!value) return null;
    return createMessage("assistant", value);
  }

  function addSystemMessage(text) {
    const value = String(text ?? "").trim();
    if (!value) return null;
    return createMessage("system", value);
  }

  /* =======================================================
     Composer
     ======================================================= */
  function resizeComposer() {
    composerInput.style.height = "auto";

    const height = Math.min(composerInput.scrollHeight, 120);
    composerInput.style.height = `${height}px`;

    const rootStyle = document.documentElement.style;
    const inputStyle = getComputedStyle(composerInput);
    const rootComputed = getComputedStyle(document.documentElement);
    const inputMinHeight = parseFloat(inputStyle.minHeight) || 38;
    const baseComposerHeight = parseFloat(rootComputed.getPropertyValue("--composer-height")) || 88;
    const formHeight = composerForm.getBoundingClientRect().height;

    rootStyle.setProperty("--composer-input-height", `${height}px`);
    rootStyle.setProperty("--composer-live-height", `${Math.max(baseComposerHeight, formHeight)}px`);

    composerForm.classList.toggle("is-expanded", height > inputMinHeight + 1);
  }

  function setBusy(busy) {
    state.busy = !!busy;
    composerInput.disabled = state.busy;
    composerSubmit.disabled = state.busy;

    composerForm.classList.toggle("is-busy", state.busy);

    if (state.busy) {
      composerInput.dataset.previousPlaceholder = composerInput.placeholder;
      composerInput.placeholder = "Astra가 워크플로우를 구성하고 있습니다...";
    } else {
      composerInput.placeholder = composerInput.dataset.previousPlaceholder || "무엇을 할까요?";
      delete composerInput.dataset.previousPlaceholder;
    }
  }

  /* =======================================================
     Workflow
     ======================================================= */
  function syncWorkflow() {
    const workflow = getCurrentWorkflow();
    state.workflow = workflow;
    return workflow;
  }

  function handleCanvasChange(workflow) {
    if (!workflow) return;
    state.workflow = clone(workflow);
  }

  function handleCanvasWorkflowApplied(workflow) {
    if (!workflow) return;
    state.workflow = clone(workflow);
  }

  /* =======================================================
     Planner
     ======================================================= */
  async function plan(text) {
    const workflow = syncWorkflow();
    const result = await API.planWorkflow(text, workflow);

    if (!result || !result.workflow) {
      throw new Error("Planner가 올바른 workflow를 반환하지 않았습니다.");
    }

    state.workflow = clone(result.workflow);

    if (state.canvas && typeof state.canvas.applyWorkflowIR === "function") {
      state.canvas.applyWorkflowIR(result.workflow, { center: true });
    }

    return result;
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (state.destroyed || state.busy) return;

    const text = composerInput.value.trim();
    if (!text) return;

    addUserMessage(text);
    composerInput.value = "";
    resizeComposer();
    setBusy(true);

    try {
      const result = await plan(text);

      if (result.message) {
        addAssistantMessage(result.message);
      }

      if (result.question) {
        addAssistantMessage(result.question);
      }

      syncWorkflow();
    } catch (error) {
      console.error("Astra Planner Error:", error);
      addAssistantMessage(error?.message || "워크플로우를 처리하지 못했습니다.");
    } finally {
      setBusy(false);
      composerInput.focus();
      resizeComposer();
    }
  }

  function handleComposerInput() {
    resizeComposer();
  }

  function handleComposerKeydown(event) {
    if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;

    event.preventDefault();

    if (state.busy) return;

    composerForm.requestSubmit();
  }

  /* =======================================================
     Canvas
     ======================================================= */
  async function initializeCanvas() {
    const canvas = await mountCanvasNode("#canvas-viewport", {
      nodeDefinitions: state.nodeDefinitions || undefined,
      interactionEnabled: false
    });

    state.canvas = canvas;
    initializeNodeBuilder();
    UI.bindCanvas(canvas);

    canvas.on("change", handleCanvasChange);
    canvas.on("workflowApplied", handleCanvasWorkflowApplied);

    syncWorkflow();

    return canvas;
  }

  /* =======================================================
     Canvas Node Builder
     ======================================================= */
  function getNodeDefinitionsForBuilder() {
    if (state.nodeDefinitions && typeof state.nodeDefinitions === "object") {
      return state.nodeDefinitions;
    }

    if (state.canvas && typeof state.canvas.getNodeDefinitions === "function") {
      return state.canvas.getNodeDefinitions();
    }

    return {};
  }

  function renderNodeBuilderOptions() {
    const root = state.nodeBuilder.root;
    if (!root) return;

    const list = root.querySelector("#canvas-node-builder-list");
    if (!list) return;

    list.textContent = "";

    const definitions = getNodeDefinitionsForBuilder();

    for (const [type, definition] of Object.entries(definitions)) {
      if (type === "start" || !definition) continue;

      const button = document.createElement("button");
      button.type = "button";
      button.className = "canvas-node-builder-option";
      button.dataset.nodeType = type;
      button.style.setProperty("--builder-node-color", definition.color || "var(--text)");

      const icon = document.createElement("span");
      icon.className = "canvas-node-builder-icon";
      icon.innerHTML = definition.icon || "";

      const name = document.createElement("span");
      name.className = "canvas-node-builder-name";
      name.textContent = definition.name || type;

      button.appendChild(icon);
      button.appendChild(name);
      list.appendChild(button);
    }

    root.classList.toggle("is-empty", list.children.length === 0);
  }

  function setNodeBuilderOpen(open) {
    if (!state.nodeBuilder.root) return;

    state.nodeBuilder.open = !!open;
    state.nodeBuilder.root.classList.toggle("is-open", state.nodeBuilder.open);

    const toggle = state.nodeBuilder.root.querySelector("#canvas-node-builder-toggle");

    toggle?.setAttribute("aria-expanded", String(state.nodeBuilder.open));
  }

  function initializeNodeBuilder() {
    if (state.nodeBuilder.root) {
      renderNodeBuilderOptions();
      return;
    }

    const root = document.createElement("div");
    root.id = "canvas-node-builder";

    root.innerHTML = `
      <div id="canvas-node-builder-panel" role="dialog" aria-label="노드 추가">
        <div class="canvas-node-builder-header">
          <span>노드 추가</span>
          <span class="canvas-node-builder-hint">필요한 노드를 선택해</span>
        </div>
        <div id="canvas-node-builder-list" class="canvas-node-builder-list"></div>
      </div>
      <button id="canvas-node-builder-toggle" type="button" aria-expanded="false" aria-controls="canvas-node-builder-panel">
        <span class="canvas-node-builder-plus" aria-hidden="true">+</span>
        <span>노드</span>
      </button>
    `;

    document.querySelector("#canvas-page")?.appendChild(root);
    state.nodeBuilder.root = root;

    listen(root, "click", event => {
      const toggle = event.target.closest("#canvas-node-builder-toggle");

      if (toggle) {
        event.preventDefault();
        setNodeBuilderOpen(!state.nodeBuilder.open);
        return;
      }

      const option = event.target.closest(".canvas-node-builder-option");

      if (!option || !root.contains(option)) return;

      const type = option.dataset.nodeType;

      if (!type || !state.canvas || typeof state.canvas.addNode !== "function") return;

      state.canvas.addNode(type);
      setNodeBuilderOpen(false);
    });

    listen(document, "pointerdown", event => {
      if (state.nodeBuilder.open && !root.contains(event.target)) {
        setNodeBuilderOpen(false);
      }
    });

    listen(document, "keydown", event => {
      if (event.key === "Escape" && state.nodeBuilder.open) {
        setNodeBuilderOpen(false);
      }
    });

    renderNodeBuilderOptions();
  }

  /* =======================================================
     Initialization
     ======================================================= */
  async function initialize() {
    if (state.destroyed) return;

    setBusy(false);
    resizeComposer();

    listen(composerForm, "submit", handleSubmit);
    listen(composerInput, "input", handleComposerInput);
    listen(composerInput, "keydown", handleComposerKeydown);
    listen(global, "resize", resizeComposer);

    if (global.visualViewport) {
      listen(global.visualViewport, "resize", resizeComposer);
    }

    UI.on("modechange", ({ mode }) => {
      if (mode === "canvas") {
        requestAnimationFrame(() => {
          state.canvas?.render?.();
        });
      }
    });

    try {
      state.nodeDefinitions = await API.getNodeDefinitions();
    } catch (error) {
      console.error("Node Definition Load Error:", error);
      state.nodeDefinitions = null;
    }

    await initializeCanvas();

    renderNodeBuilderOptions();

    state.ready = true;

    addSystemMessage("무엇을 만들지 입력하면 Astra가 워크플로우를 구성합니다.");

    resizeComposer();
    scrollChatToBottom(true);
  }

  /* =======================================================
     Public API
     ======================================================= */
  const app = {
    isReady() {
      return state.ready;
    },

    isBusy() {
      return state.busy;
    },

    getCanvas() {
      return state.canvas;
    },

    getWorkflow() {
      return getCurrentWorkflow();
    },

    getNodeDefinitions() {
      return state.nodeDefinitions ? clone(state.nodeDefinitions) : null;
    },

    addUserMessage,
    addAssistantMessage,
    addSystemMessage,

    async plan(text) {
      if (state.busy) return null;

      setBusy(true);

      try {
        return await plan(text);
      } finally {
        setBusy(false);
        resizeComposer();
      }
    },

    destroy() {
      if (state.destroyed) return;

      state.destroyed = true;

      listeners.splice(0).forEach(cleanup => {
        try {
          cleanup();
        } catch {}
      });

      state.canvas?.destroy?.();
      state.nodeBuilder.root?.remove();

      state.canvas = null;
      state.nodeBuilder.root = null;
      state.nodeBuilder.open = false;
      state.workflow = null;
      state.nodeDefinitions = null;
      state.ready = false;
    }
  };

  global.AstraApp = Object.freeze(app);

  /* =======================================================
     Start
     ======================================================= */
  initialize().catch(error => {
    console.error("Astra Initialization Error:", error);
    addSystemMessage(error?.message || "Astra를 초기화하지 못했습니다.");
  });
})(window);
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
  const memoryStore = { value: null };

  const state = {
    destroyed: false,
    ready: false,
    busy: false,
    canvas: null,
    workflow: null,
    nodeDefinitions: null,
    conversationMemory: null,
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

  function normalizeMemory(memory) {
    if (
      !memory ||
      typeof memory !== "object" ||
      Array.isArray(memory)
    ) {
      return null;
    }

    return {
      flow:
        typeof memory.flow === "string"
          ? memory.flow.trim()
          : "",
      recent:
        typeof memory.recent === "string"
          ? memory.recent.trim()
          : "",
      detail:
        typeof memory.detail === "string"
          ? memory.detail.trim()
          : ""
    };
  }

  function loadMemory() {
    return normalizeMemory(memoryStore.value);
  }

  function saveMemory(memory) {
    const normalized =
      normalizeMemory(memory);

    if (!normalized) {
      return;
    }

    state.conversationMemory =
      normalized;
    memoryStore.value = normalized;
  }

  function clearMemory() {
    state.conversationMemory = null;
    memoryStore.value = null;
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

  function updateCanvasAIContext(text) {
    const page = document.querySelector("#canvas-page");
    if (!page) return;

    let preview =
      page.querySelector("#canvas-ai-preview");

    if (!preview) {
      preview = document.createElement("div");
      preview.id = "canvas-ai-preview";
      preview.innerHTML = `
        <div class="canvas-ai-preview-label">Astra</div>
        <div class="canvas-ai-preview-text"></div>
      `;
      page.appendChild(preview);
    }

    const body =
      preview.querySelector(
        ".canvas-ai-preview-text"
      );

    if (!body) return;

    body.textContent =
      String(text ?? "").trim();

    preview.classList.remove("is-visible");

    requestAnimationFrame(() => {
      preview.classList.add("is-visible");
    });
  }

  function createMessage(role, text) {
    const message =
      document.createElement("div");

    const id =
      `message-${++state.messageCount}`;

    const value =
      String(text ?? "");

    message.id = id;
    message.className =
      `astra-message astra-message-${role}`;

    message.dataset.role = role;

    const body =
      document.createElement("div");

    body.className =
      "astra-message-body";

    body.textContent = value;

    message.appendChild(body);

    if (
      role === "user" ||
      role === "assistant"
    ) {
      const actions =
        document.createElement("div");

      actions.className =
        "astra-message-actions";

      const copyButton =
        document.createElement("button");

      copyButton.type = "button";
      copyButton.className =
        "astra-message-action";

      copyButton.dataset.action =
        "copy";

      copyButton.setAttribute(
        "aria-label",
        "복사"
      );

      copyButton.title = "복사";

      copyButton.innerHTML = `
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <rect x="5" y="4" width="7" height="8" rx="1.5"></rect>
          <path d="M4 10.5H3.5A1.5 1.5 0 0 1 2 9V3.5A1.5 1.5 0 0 1 3.5 2H9A1.5 1.5 0 0 1 10.5 3.5V4"></path>
        </svg>
        <span>복사</span>
      `;

      actions.appendChild(copyButton);

      if (role === "assistant") {
        const retryButton =
          document.createElement("button");

        retryButton.type = "button";
        retryButton.className =
          "astra-message-action";

        retryButton.dataset.action =
          "retry";

        retryButton.setAttribute(
          "aria-label",
          "재시도"
        );

        retryButton.title = "재시도";

        retryButton.innerHTML = `
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M13 5.5V2.5M13 2.5H10"></path>
            <path d="M12.4 6.3A5 5 0 1 0 13 9"></path>
          </svg>
          <span>재시도</span>
        `;

        actions.appendChild(retryButton);
      }

      message.appendChild(actions);
    }

    chatMessages.appendChild(message);

    if (role === "assistant") {
      updateCanvasAIContext(value);
    }

    scrollChatToBottom();

    return message;
  }

(text) {
    const value = String(text ?? "").trim();
    if (!value) return null;
    return createMessage("user", value);
  }

  function addAssistantMessage(text) {
    const value = String(text ?? "").trim();
    if (!value) return null;
    return createMessage("assistant", value);
  }

  async function copyMessage(message, button) {
    const body =
      message.querySelector(
        ".astra-message-body"
      );

    const value =
      body?.textContent?.trim();

    if (!value) return;

    try {
      await navigator.clipboard.writeText(
        value
      );
    } catch {
      const textarea =
        document.createElement("textarea");

      textarea.value = value;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";

      document.body.appendChild(textarea);
      textarea.select();

      try {
        document.execCommand("copy");
      } catch {
        textarea.remove();
        return;
      }

      textarea.remove();
    }

    const label =
      button.querySelector("span");

    button.classList.add("is-done");

    if (label) {
      label.textContent = "복사됨";
    }

    setTimeout(() => {
      button.classList.remove("is-done");

      if (label) {
        label.textContent = "복사";
      }
    }, 1200);
  }

  async function retryMessage(message) {
    if (state.destroyed || state.busy) {
      return;
    }

    let previous =
      message.previousElementSibling;

    while (previous) {
      if (previous.dataset.role === "user") {
        break;
      }

      previous =
        previous.previousElementSibling;
    }

    const body =
      previous?.querySelector(
        ".astra-message-body"
      );

    const value =
      body?.textContent?.trim();

    if (!value) return;

    message.classList.add(
      "is-retrying"
    );

    try {
      await runPrompt(value, {
        addUserMessage: false
      });
    } finally {
      message.classList.remove(
        "is-retrying"
      );
    }
  }

  function handleMessageClick(event) {
    const action =
      event.target.closest(
        ".astra-message-action"
      );

    if (action) {
      const message =
        action.closest(
          ".astra-message"
        );

      if (!message) return;

      event.preventDefault();

      if (
        action.dataset.action ===
        "copy"
      ) {
        copyMessage(
          message,
          action
        );
      } else if (
        action.dataset.action ===
        "retry"
      ) {
        retryMessage(message);
      }

      return;
    }

    const userMessage =
      event.target.closest(
        ".astra-message-user"
      );

    if (
      !userMessage ||
      !chatMessages.contains(
        userMessage
      )
    ) {
      return;
    }

    chatMessages
      .querySelectorAll(
        ".astra-message-user.is-actions-visible"
      )
      .forEach(item =>
        item.classList.remove(
          "is-actions-visible"
        )
      );

    userMessage.classList.add(
      "is-actions-visible"
    );
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

    const result =
      await API.planWorkflow(
        text,
        workflow,
        state.conversationMemory
      );

    if (!result || !result.workflow) {
      throw new Error(
        "Planner가 올바른 workflow를 반환하지 않았습니다."
      );
    }

    state.workflow =
      clone(result.workflow);

    if (
      state.canvas &&
      typeof state.canvas.applyWorkflowIR === "function"
    ) {
      state.canvas.applyWorkflowIR(
        result.workflow,
        { center: true }
      );
    }

    if (result.memory) {
      saveMemory(result.memory);
    }

    return result;
  }

  async function runPrompt(text, options = {}) {
    if (state.destroyed || state.busy) return;

    const value = String(text ?? "").trim();
    if (!value) return;

    if (options.addUserMessage !== false) {
      addUserMessage(value);
      composerInput.value = "";
      resizeComposer();
    }

    setBusy(true);

    try {
      const result = await plan(value);

      if (result.message) {
        addAssistantMessage(result.message);
      }

      if (result.question) {
        addAssistantMessage(result.question);
      }

      syncWorkflow();
    } catch (error) {
      console.error(
        "Astra Planner Error:",
        error
      );
      addAssistantMessage(
        error?.message ||
        "워크플로우를 처리하지 못했습니다."
      );
    } finally {
      setBusy(false);
      composerInput.focus();
      resizeComposer();
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const text = composerInput.value.trim();
    if (!text) return;

    await runPrompt(text);
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
          <span class="canvas-node-builder-hint">워크플로우를 직접 조립해봐요</span>
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

    state.conversationMemory =
      loadMemory();

    setBusy(false);
    resizeComposer();

    listen(composerForm, "submit", handleSubmit);
    listen(chatMessages, "click", handleMessageClick);
    listen(composerInput, "input", handleComposerInput);
    listen(chatMessages, "click", handleMessageAction);
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
      state.nodeDefinitions =
        await API.getNodeDefinitions();
    } catch (error) {
      console.error(
        "Node Definition Load Error:",
        error
      );
      state.nodeDefinitions = null;
    }

    await initializeCanvas();

    renderNodeBuilderOptions();

    state.ready = true;

    addSystemMessage(
      "무엇을 만들지 입력하면 Astra가 워크플로우를 구성합니다."
    );

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

    getConversationMemory() {
      return state.conversationMemory
        ? clone(state.conversationMemory)
        : null;
    },

    clearConversationMemory() {
      clearMemory();
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
      state.conversationMemory = null;
      state.ready = false;
    }
  };

  global.AstraApp = Object.freeze(app);

  /* =======================================================
     Start
     ======================================================= */
  initialize().catch(error => {
    console.error(
      "Astra Initialization Error:",
      error
    );
    addSystemMessage(
      error?.message ||
      "Astra를 초기화하지 못했습니다."
    );
  });
})(window);
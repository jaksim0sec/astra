/* =========================================================
   Astra
   Application Entry
   ========================================================= */

(function (global) {
  "use strict";


  /* =======================================================
     Dependencies
     ======================================================= */

  const UI =
    global.AstraUI;

  const API =
    global.AstraAPI;

  const mountCanvasNode =
    global.mountCanvasNode;


  /* =======================================================
     DOM
     ======================================================= */

  const workspace =
    document.querySelector("#workspace");

  const chatContent =
    document.querySelector("#chat-content");

  const chatMessages =
    document.querySelector("#chat-messages");

  const composerForm =
    document.querySelector("#composer-form");

  const composerInput =
    document.querySelector("#composer-input");

  const composerSubmit =
    document.querySelector("#composer-submit");


  if (
    !workspace ||
    !chatContent ||
    !chatMessages ||
    !composerForm ||
    !composerInput ||
    !composerSubmit
  ) {
    throw new Error(
      "Astra Application DOM 구조가 올바르지 않습니다."
    );
  }


  if (
    !UI ||
    !API ||
    typeof mountCanvasNode !== "function"
  ) {
    throw new Error(
      "Astra Application dependency가 준비되지 않았습니다."
    );
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

    messageCount: 0
  };


  const listeners = [];


  /* =======================================================
     Utilities
     ======================================================= */

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
      () => {
        element.removeEventListener(
          type,
          handler,
          options
        );
      }
    );
  }


  function clone(
    value
  ) {
    if (
      typeof global.AstraUtils?.clone ===
      "function"
    ) {
      return global.AstraUtils.clone(
        value
      );
    }

    return JSON.parse(
      JSON.stringify(value)
    );
  }


  function getCurrentWorkflow() {
    if (
      state.canvas &&
      typeof state.canvas.getWorkflowIR ===
        "function"
    ) {
      return clone(
        state.canvas.getWorkflowIR()
      );
    }

    if (
      state.workflow
    ) {
      return clone(
        state.workflow
      );
    }

    return null;
  }


  function scrollChatToBottom(
    immediate = false
  ) {
    if (
      immediate
    ) {
      chatContent.scrollTop =
        chatContent.scrollHeight;

      return;
    }

    requestAnimationFrame(
      () => {
        chatContent.scrollTop =
          chatContent.scrollHeight;
      }
    );
  }


  /* =======================================================
     Chat
     ======================================================= */

  function createMessage(
    role,
    text
  ) {
    const message =
      document.createElement(
        "div"
      );

    const id =
      `message-${++state.messageCount}`;

    message.id = id;

    message.className =
      `astra-message astra-message-${role}`;

    message.dataset.role =
      role;

    const body =
      document.createElement(
        "div"
      );

    body.className =
      "astra-message-body";

    body.textContent =
      String(text ?? "");


    message.appendChild(
      body
    );

    chatMessages.appendChild(
      message
    );

    scrollChatToBottom();

    return message;
  }


  function addUserMessage(
    text
  ) {
    const value =
      String(text ?? "").trim();

    if (!value) {
      return null;
    }

    return createMessage(
      "user",
      value
    );
  }


  function addAssistantMessage(
    text
  ) {
    const value =
      String(text ?? "").trim();

    if (!value) {
      return null;
    }

    return createMessage(
      "assistant",
      value
    );
  }


  function addSystemMessage(
    text
  ) {
    const value =
      String(text ?? "").trim();

    if (!value) {
      return null;
    }

    return createMessage(
      "system",
      value
    );
  }


  /* =======================================================
     Composer
     ======================================================= */

  function resizeComposer() {
    composerInput.style.height =
      "auto";

    const height =
      Math.min(
        composerInput.scrollHeight,
        120
      );

    composerInput.style.height =
      `${height}px`;
  }


  function setBusy(
    busy
  ) {
    state.busy =
      !!busy;

    composerInput.disabled =
      state.busy;

    composerSubmit.disabled =
      state.busy;

    composerForm.classList.toggle(
      "is-busy",
      state.busy
    );

    if (state.busy) {
      composerInput.dataset.previousPlaceholder =
        composerInput.placeholder;

      composerInput.placeholder =
        "Astra가 워크플로우를 구성하고 있습니다...";
    } else {
      composerInput.placeholder =
        composerInput.dataset.previousPlaceholder ||
        "무엇을 할까요?";

      delete composerInput.dataset.previousPlaceholder;
    }
  }


  /* =======================================================
     Workflow
     ======================================================= */

  function syncWorkflow() {
    const workflow =
      getCurrentWorkflow();

    state.workflow =
      workflow;

    return workflow;
  }


  function handleCanvasChange(
    workflow
  ) {
    if (
      !workflow
    ) {
      return;
    }

    state.workflow =
      clone(workflow);
  }


  function handleCanvasWorkflowApplied(
    workflow
  ) {
    if (
      !workflow
    ) {
      return;
    }

    state.workflow =
      clone(workflow);
  }


  /* =======================================================
     Planner
     ======================================================= */

  async function plan(
    text
  ) {
    const workflow =
      syncWorkflow();

    const result =
      await API.planWorkflow(
        text,
        workflow
      );

    if (
      !result ||
      !result.workflow
    ) {
      throw new Error(
        "Planner가 올바른 workflow를 반환하지 않았습니다."
      );
    }

    state.workflow =
      clone(
        result.workflow
      );


    if (
      state.canvas &&
      typeof state.canvas.applyWorkflowIR ===
        "function"
    ) {
      state.canvas.applyWorkflowIR(
        result.workflow,
        {
          center: true
        }
      );
    }


    return result;
  }


  async function handleSubmit(
    event
  ) {
    event.preventDefault();

    if (
      state.destroyed ||
      state.busy
    ) {
      return;
    }

    const text =
      composerInput.value.trim();

    if (!text) {
      return;
    }


    addUserMessage(
      text
    );


    composerInput.value =
      "";

    resizeComposer();

    setBusy(
      true
    );


    try {
      const result =
        await plan(
          text
        );


      if (
        result.message
      ) {
        addAssistantMessage(
          result.message
        );
      }


      if (
        result.question
      ) {
        addAssistantMessage(
          result.question
        );
      }


      /*
       * 현재는 Planner 결과가
       * 자동으로 Canvas로 넘어가지 않는다.
       *
       * 사용자가 Chat / Canvas 전환을
       * 직접 제어할 수 있게 둔다.
       */
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
      setBusy(
        false
      );

      composerInput.focus();

      resizeComposer();
    }
  }


  function handleComposerInput() {
    resizeComposer();
  }


  function handleComposerKeydown(
    event
  ) {
    if (
      event.key !== "Enter" ||
      event.shiftKey ||
      event.isComposing
    ) {
      return;
    }

    event.preventDefault();

    if (
      state.busy
    ) {
      return;
    }

    composerForm.requestSubmit();
  }


  /* =======================================================
     Canvas
     ======================================================= */

  async function initializeCanvas() {
    const canvas =
      await mountCanvasNode(
        "#canvas-viewport",
        {
          interactionEnabled:
            false
        }
      );


    state.canvas =
      canvas;


    UI.bindCanvas(
      canvas
    );


    canvas.on(
      "change",
      handleCanvasChange
    );


    canvas.on(
      "workflowApplied",
      handleCanvasWorkflowApplied
    );


    syncWorkflow();

    return canvas;
  }


  /* =======================================================
     Initialization
     ======================================================= */

  async function initialize() {
    if (
      state.destroyed
    ) {
      return;
    }


    setBusy(
      false
    );


    resizeComposer();


    listen(
      composerForm,
      "submit",
      handleSubmit
    );


    listen(
      composerInput,
      "input",
      handleComposerInput
    );


    listen(
      composerInput,
      "keydown",
      handleComposerKeydown
    );


    UI.on(
      "modechange",
      ({ mode }) => {
        if (
          mode === "canvas"
        ) {
          requestAnimationFrame(
            () => {
              state.canvas?.render?.();
            }
          );
        }
      }
    );


    /*
     * Node Definition은 Canvas가 필요로 하므로
     * Canvas mount 과정에서 가져온다.
     */
    try {
      state.nodeDefinitions =
        await API.getNodeDefinitions();
    } catch (error) {
      console.error(
        "Node Definition Load Error:",
        error
      );

      /*
       * Canvas 자체가 다시 API를 요청할 수 있으므로
       * 여기서 앱을 중단하지 않는다.
       */
      state.nodeDefinitions =
        null;
    }


    await initializeCanvas();


    state.ready =
      true;


    addSystemMessage(
      "무엇을 만들지 입력하면 Astra가 워크플로우를 구성합니다."
    );


    resizeComposer();

    scrollChatToBottom(
      true
    );
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
      return state.nodeDefinitions
        ? clone(
            state.nodeDefinitions
          )
        : null;
    },

    addUserMessage,

    addAssistantMessage,

    addSystemMessage,

    async plan(text) {
      if (
        state.busy
      ) {
        return null;
      }

      setBusy(
        true
      );

      try {
        const result =
          await plan(
            text
          );

        return result;
      } finally {
        setBusy(
          false
        );
      }
    },

    destroy() {
      if (
        state.destroyed
      ) {
        return;
      }

      state.destroyed =
        true;

      listeners
        .splice(0)
        .forEach(
          cleanup => {
            try {
              cleanup();
            } catch {}
          }
        );

      state.canvas
        ?.destroy?.();

      state.canvas =
        null;

      state.workflow =
        null;

      state.nodeDefinitions =
        null;

      state.ready =
        false;
    }
  };


  global.AstraApp =
    Object.freeze(
      app
    );


  /* =======================================================
     Start
     ======================================================= */

  initialize()
    .catch(
      error => {
        console.error(
          "Astra Initialization Error:",
          error
        );

        addSystemMessage(
          error?.message ||
          "Astra를 초기화하지 못했습니다."
        );
      }
    );

})(window);
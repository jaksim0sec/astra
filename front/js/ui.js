(function (global) {
  "use strict";

  const workspace =
    document.querySelector(
      "#workspace"
    );

  const chatPage =
    document.querySelector(
      "#chat-page"
    );

  const canvasPage =
    document.querySelector(
      "#canvas-page"
    );

  const modeSwitch =
    document.querySelector(
      "#mode-switch"
    );

  const modeChat =
    document.querySelector(
      '#mode-switch [data-mode="chat"]'
    );

  const modeCanvas =
    document.querySelector(
      '#mode-switch [data-mode="canvas"]'
    );

  if (
    !workspace ||
    !chatPage ||
    !canvasPage ||
    !modeSwitch ||
    !modeChat ||
    !modeCanvas
  ) {
    throw new Error(
      "Astra UI DOM 구조가 올바르지 않습니다."
    );
  }

  const clamp = (
    value,
    min,
    max
  ) =>
    Math.min(
      max,
      Math.max(
        min,
        value
      )
    );

  const events =
    new Map();

  const listeners = [];

  const virtualKeyboard =
    global.navigator
      ?.virtualKeyboard ||
    null;

  let useKeyboardOverlay =
    false;

  try {
    if (
      virtualKeyboard &&
      "overlaysContent"
        in virtualKeyboard
    ) {
      virtualKeyboard
        .overlaysContent =
        true;

      useKeyboardOverlay =
        true;
    }
  } catch {}

  function getUrlMode() {
    const value =
      new URLSearchParams(
        global.location.search
      )
        .get(
          "mode"
        );

    return value ===
      "canvas"
      ? "canvas"
      : "chat";
  }

  function setUrlMode(
    mode
  ) {
    try {
      const url =
        new URL(
          global.location.href
        );

      url.searchParams.set(
        "mode",
        mode === "canvas"
          ? "canvas"
          : "chat"
      );

      global.history
        .replaceState(
          null,
          "",
          url
        );
    } catch {}
  }

  function getFrameHeight() {
    return Math.max(
      1,
      Math.round(
        global.innerHeight ||
        document.documentElement
          .clientHeight ||
        1
      )
    );
  }

  function getKeyboardHeight() {
    if (
      !useKeyboardOverlay
    ) {
      return 0;
    }

    const value =
      Number(
        virtualKeyboard
          ?.boundingRect
          ?.height ||
        0
      );

    return Number.isFinite(
      value
    )
      ? Math.max(
          0,
          Math.round(
            value
          )
        )
      : 0;
  }

  function getViewportHeight() {
    if (
      useKeyboardOverlay
    ) {
      return Math.max(
        1,
        getFrameHeight() -
        getKeyboardHeight()
      );
    }

    return Math.max(
      1,
      Math.round(
        global.visualViewport
          ?.height ||
        global.innerHeight ||
        document.documentElement
          .clientHeight ||
        1
      )
    );
  }

  function getViewportTop() {
    if (
      useKeyboardOverlay
    ) {
      return 0;
    }

    const value =
      Number(
        global.visualViewport
          ?.offsetTop ||
        0
      );

    return Number.isFinite(
      value
    )
      ? Math.round(
          value
        )
      : 0;
  }

  function getViewportWidth() {
    return Math.max(
      1,
      Math.round(
        document.documentElement
          .clientWidth ||
        global.innerWidth ||
        global.visualViewport
          ?.width ||
        1
      )
    );
  }

  const initialMode =
    getUrlMode();

  const state = {
    mode:
      initialMode,
    progress:
      initialMode === "canvas"
        ? 1
        : 0,
    viewportWidth:
      getViewportWidth(),
    viewportHeight:
      getViewportHeight(),
    canvasApi:
      null,
    destroyed:
      false,
    transitionFrame:
      null,
    viewportFrame:
      null
  };

  function on(
    name,
    handler
  ) {
    if (
      typeof handler !==
        "function"
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
      .add(
        handler
      );

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
      ?.delete(
        handler
      );
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
      () => {
        element
          .removeEventListener(
            type,
            handler,
            options
          );
      }
    );
  }

  function render() {
    const progress =
      clamp(
        state.progress,
        0,
        1
      );

    document.documentElement
      .style
      .setProperty(
        "--page-progress",
        String(
          progress
        )
      );

    workspace.dataset.mode =
      state.mode;

    const offset =
      -progress *
      state.viewportWidth;

    chatPage.style.transform =
      `translate3d(${offset}px,0,0)`;

    canvasPage.style.transform =
      `translate3d(${offset}px,0,0)`;

    modeChat.setAttribute(
      "aria-selected",
      String(
        state.mode ===
          "chat"
      )
    );

    modeCanvas.setAttribute(
      "aria-selected",
      String(
        state.mode ===
          "canvas"
      )
    );
  }

  function syncCanvasInteraction() {
    const canvas =
      state.canvasApi;

    if (
      !canvas ||
      typeof canvas
        .setInteractionEnabled !==
        "function"
    ) {
      return;
    }

    canvas
      .setInteractionEnabled(
        state.mode ===
          "canvas"
      );
  }

  function bindCanvas(
    canvasApi
  ) {
    state.canvasApi =
      canvasApi ||
      null;

    syncCanvasInteraction();

    return api;
  }

  function stopTransition() {
    if (
      state.transitionFrame !==
        null
    ) {
      cancelAnimationFrame(
        state.transitionFrame
      );

      state.transitionFrame =
        null;
    }

    workspace
      .classList
      .remove(
        "is-dragging"
      );

    modeSwitch
      .classList
      .remove(
        "is-dragging"
      );
  }

  function snapTo(
    target,
    options = {}
  ) {
    stopTransition();

    const end =
      clamp(
        Number(target) ||
        0,
        0,
        1
      );

    if (
      options.immediate ===
        true
    ) {
      state.progress =
        end;

      render();

      emit(
        "snap",
        {
          mode:
            state.mode,
          progress:
            state.progress
        }
      );

      return;
    }

    const startProgress =
      clamp(
        state.progress,
        0,
        1
      );

    const distance =
      Math.abs(
        end -
        startProgress
      );

    if (
      distance <
      .001
    ) {
      state.progress =
        end;

      render();

      emit(
        "snap",
        {
          mode:
            state.mode,
          progress:
            state.progress
        }
      );

      return;
    }

    workspace
      .classList
      .add(
        "is-dragging"
      );

    modeSwitch
      .classList
      .add(
        "is-dragging"
      );

    const started =
      performance.now();

    const duration =
      280 +
      distance *
      55;

    const tick =
      now => {
        if (
          state.destroyed
        ) {
          state.transitionFrame =
            null;
          return;
        }

        const t =
          clamp(
            (
              now -
              started
            ) /
            duration,
            0,
            1
          );

        const eased =
          1 -
          Math.pow(
            1 - t,
            4
          );

        state.progress =
          startProgress +
          (
            end -
            startProgress
          ) *
          eased;

        render();

        if (
          t < 1
        ) {
          state.transitionFrame =
            requestAnimationFrame(
              tick
            );

          return;
        }

        state.transitionFrame =
          null;
        state.progress =
          end;

        workspace
          .classList
          .remove(
            "is-dragging"
          );

        modeSwitch
          .classList
          .remove(
            "is-dragging"
          );

        render();

        emit(
          "snap",
          {
            mode:
              state.mode,
            progress:
              state.progress
          }
        );
      };

    state.transitionFrame =
      requestAnimationFrame(
        tick
      );
  }

  function setMode(
    mode,
    options = {}
  ) {
    const target =
      mode === "canvas"
        ? "canvas"
        : "chat";

    const previous =
      state.mode;

    state.mode =
      target;

    setUrlMode(
      target
    );

    syncCanvasInteraction();

    if (
      previous !==
        target ||
      options.force ===
        true
    ) {
      emit(
        "modechange",
        {
          mode:
            target,
          previous
        }
      );
    }

    snapTo(
      target === "canvas"
        ? 1
        : 0,
      {
        immediate:
          options.immediate ===
            true
      }
    );

    return api;
  }

  function toggleMode() {
    return setMode(
      state.mode ===
        "chat"
        ? "canvas"
        : "chat"
    );
  }

  function setDarkMode(
    enabled = true
  ) {
    document.documentElement
      .classList
      .toggle(
        "dark",
        !!enabled
      );

    return api;
  }

  function toggleDarkMode() {
    return setDarkMode(
      !document.documentElement
        .classList
        .contains(
          "dark"
        )
    );
  }

  function syncViewport() {
    if (
      state.destroyed
    ) {
      return;
    }

    const width =
      getViewportWidth();

    const frameHeight =
      getFrameHeight();

    const height =
      getViewportHeight();

    const top =
      getViewportTop();

    const previousHeight =
      state.viewportHeight;

    state.viewportWidth =
      width;

    state.viewportHeight =
      height;

    const root =
      document.documentElement;

    root.classList.toggle(
      "viewport-shrinking",
      height <
        previousHeight -
        1
    );

    root.classList.toggle(
      "viewport-growing",
      height >
        previousHeight +
        1
    );

    root.classList.toggle(
      "keyboard-overlay",
      useKeyboardOverlay
    );

    root.dataset.viewportStrategy =
      useKeyboardOverlay
        ? "virtual-keyboard-overlay"
        : "visual-viewport";

    const rootStyle =
      root.style;

    rootStyle.setProperty(
      "--app-frame-top",
      `${top}px`
    );

    rootStyle.setProperty(
      "--app-frame-height",
      `${
        useKeyboardOverlay
          ? frameHeight
          : height
      }px`
    );

    rootStyle.setProperty(
      "--app-stage-height",
      `${height}px`
    );

    rootStyle.setProperty(
      "--real-vh",
      `${height}px`
    );

    rootStyle.setProperty(
      "--viewport-height",
      `${height}px`
    );

    rootStyle.setProperty(
      "--real-vh-unit",
      `${height / 100}px`
    );

    const keyboardHeight =
      Math.max(
        0,
        frameHeight -
        height
      );

    rootStyle.setProperty(
      "--keyboard-height",
      `${keyboardHeight}px`
    );

    rootStyle.setProperty(
      "--visual-viewport-top",
      `${top}px`
    );

    render();

    emit(
      "viewport",
      {
        width,
        height,
        top,
        frameHeight,
        keyboardHeight,
        strategy:
          useKeyboardOverlay
            ? "virtual-keyboard-overlay"
            : "visual-viewport"
      }
    );
  }

  function scheduleViewportSync() {
    if (
      state.viewportFrame !==
        null
    ) {
      return;
    }

    state.viewportFrame =
      requestAnimationFrame(
        () => {
          state.viewportFrame =
            null;

          syncViewport();
        }
      );
  }

  function handleModeClick(
    event
  ) {
    const button =
      event.target
        .closest(
          "button[data-mode]"
        );

    if (
      !button ||
      !modeSwitch
        .contains(
          button
        )
    ) {
      return;
    }

    const mode =
      button.dataset.mode;

    if (
      mode === "chat" ||
      mode === "canvas"
    ) {
      setMode(
        mode
      );
    }
  }

  listen(
    modeSwitch,
    "click",
    handleModeClick
  );

  listen(
    global,
    "resize",
    scheduleViewportSync
  );

  listen(
    global,
    "orientationchange",
    () => {
      setTimeout(
        scheduleViewportSync,
        120
      );
    }
  );

  listen(
    global,
    "pageshow",
    scheduleViewportSync
  );

  if (
    useKeyboardOverlay &&
    virtualKeyboard
  ) {
    listen(
      virtualKeyboard,
      "geometrychange",
      scheduleViewportSync
    );
  } else if (
    global.visualViewport
  ) {
    listen(
      global.visualViewport,
      "resize",
      scheduleViewportSync
    );

    listen(
      global.visualViewport,
      "scroll",
      scheduleViewportSync
    );
  }

  const api = {
    getMode() {
      return state.mode;
    },

    getProgress() {
      return state.progress;
    },

    getViewportInfo() {
      return {
        strategy:
          useKeyboardOverlay
            ? "virtual-keyboard-overlay"
            : "visual-viewport",
        frameHeight:
          getFrameHeight(),
        height:
          getViewportHeight(),
        top:
          getViewportTop(),
        keyboardHeight:
          Math.max(
            0,
            getFrameHeight() -
            getViewportHeight()
          )
      };
    },

    setMode,
    toggleMode,
    setDarkMode,
    toggleDarkMode,
    bindCanvas,
    syncViewport,
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

      stopTransition();

      if (
        state.viewportFrame !==
          null
      ) {
        cancelAnimationFrame(
          state.viewportFrame
        );

        state.viewportFrame =
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

      events.clear();

      state.canvasApi =
        null;
    }
  };

  global.AstraUI =
    Object.freeze(
      api
    );

  document.documentElement
    .classList
    .add(
      "dark"
    );

  setUrlMode(
    state.mode
  );

  render();
  syncViewport();
})(window);

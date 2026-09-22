/* =========================================================
   Astra
   UI / Page Gesture / Viewport
   ========================================================= */

(function (global) {
  "use strict";

  const U = global.AstraUtils || {};

  const clamp =
    U.clamp ||
    ((value, min, max) =>
      Math.min(max, Math.max(min, value)));

  const lerp =
    U.lerp ||
    ((a, b, t) => a + (b - a) * t);

  const workspace =
    document.querySelector("#workspace");

  const chatPage =
    document.querySelector("#chat-page");

  const canvasPage =
    document.querySelector("#canvas-page");

  const modeSwitch =
    document.querySelector("#mode-switch");

  const modeChat =
    document.querySelector("#mode-chat");

  const modeCanvas =
    document.querySelector("#mode-canvas");

  const composerInput =
    document.querySelector("#composer-input");

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

  /* =======================================================
     State
     ======================================================= */

  const state = {
    mode: "chat",

    progress: 0,

    dragging: false,

    pointerId: null,

    source: null,

    startX: 0,
    startY: 0,

    lastX: 0,
    lastTime: 0,

    velocityX: 0,

    horizontal: false,

    locked: false,

    viewportWidth: 1,

    canvasApi: null,

    destroyed: false,

    snapFrame: null,

    viewportFrame: null,

    keyboardOpen: false
  };

  const events = new Map();
  const listeners = [];

  /* =======================================================
     Events
     ======================================================= */

  function on(name, handler) {
    if (typeof handler !== "function") {
      return () => {};
    }

    if (!events.has(name)) {
      events.set(name, new Set());
    }

    events.get(name).add(handler);

    return () => off(name, handler);
  }

  function off(name, handler) {
    events.get(name)?.delete(handler);
  }

  function emit(name, payload) {
    for (
      const handler of events.get(name) || []
    ) {
      try {
        handler(payload, api);
      } catch (error) {
        console.error(error);
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

    listeners.push(() =>
      element.removeEventListener(
        type,
        handler,
        options
      )
    );
  }

  /* =======================================================
     Viewport
     ======================================================= */

  function getViewportHeight() {
    return Math.max(
      1,
      Math.round(
        global.visualViewport?.height ||
        global.innerHeight ||
        document.documentElement.clientHeight ||
        1
      )
    );
  }

  function getViewportWidth() {
    return Math.max(
      1,
      Math.round(
        global.visualViewport?.width ||
        global.innerWidth ||
        1
      )
    );
  }

  function syncViewport() {
    if (state.destroyed) {
      return;
    }

    const width =
      getViewportWidth();

    const height =
      getViewportHeight();

    state.viewportWidth = width;

    document.documentElement.style.setProperty(
      "--real-vh",
      `${height}px`
    );

    document.documentElement.style.setProperty(
      "--viewport-height",
      `${height}px`
    );

    document.documentElement.style.setProperty(
      "--real-vh-unit",
      `${height / 100}px`
    );

    state.keyboardOpen =
      !!(
        global.visualViewport &&
        global.innerHeight -
          global.visualViewport.height >
          120
      );

    workspace.style.setProperty(
      "--keyboard-open",
      state.keyboardOpen
        ? "1"
        : "0"
    );

    render(
      state.progress,
      true
    );
  }

  function scheduleViewportSync() {
    if (state.viewportFrame !== null) {
      return;
    }

    state.viewportFrame =
      requestAnimationFrame(() => {
        state.viewportFrame = null;
        syncViewport();
      });
  }

  /* =======================================================
     Progress
     ======================================================= */

  function rubberBand(value) {
    if (value < 0) {
      return (
        -1 +
        1 / (1 - value)
      );
    }

    if (value > 1) {
      return (
        1 -
        1 / (1 + value - 1)
      );
    }

    return value;
  }

  function setProgress(
    progress,
    immediate = false
  ) {
    state.progress =
      clamp(
        progress,
        -0.18,
        1.18
      );

    render(
      state.progress,
      immediate
    );
  }

  function render(
    progress,
    immediate = false
  ) {
    const visualProgress =
      rubberBand(progress);

    document.documentElement.style.setProperty(
      "--page-progress",
      String(
        clamp(
          visualProgress,
          0,
          1
        )
      )
    );

    workspace.dataset.mode =
      state.mode;

    workspace.classList.toggle(
      "is-dragging",
      state.dragging
    );

    modeSwitch.classList.toggle(
      "is-dragging",
      state.dragging
    );

    if (
      state.dragging ||
      immediate
    ) {
      const offset =
        -visualProgress *
        state.viewportWidth;

      chatPage.style.transform =
        `translate3d(${offset}px,0,0)`;

      canvasPage.style.transform =
        `translate3d(${offset}px,0,0)`;
    } else {
      chatPage.style.transform = "";
      canvasPage.style.transform = "";
    }

    modeChat.setAttribute(
      "aria-selected",
      String(
        state.mode === "chat"
      )
    );

    modeCanvas.setAttribute(
      "aria-selected",
      String(
        state.mode === "canvas"
      )
    );
  }

  /* =======================================================
     Canvas interaction
     ======================================================= */

  function syncCanvasInteraction() {
    const canvas =
      state.canvasApi;

    if (
      !canvas ||
      typeof canvas.setInteractionEnabled !==
        "function"
    ) {
      return;
    }

    canvas.setInteractionEnabled(
      state.mode === "canvas"
    );
  }

  function bindCanvas(canvasApi) {
    state.canvasApi =
      canvasApi || null;

    syncCanvasInteraction();

    return api;
  }

  /* =======================================================
     Mode
     ======================================================= */

  function commitMode(
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

    const targetProgress =
      target === "canvas"
        ? 1
        : 0;

    state.locked =
      target === "canvas";

    syncCanvasInteraction();

    snapTo(
      targetProgress,
      {
        velocity: 0,
        immediate:
          !!options.immediate
      }
    );

    if (
      previous !== target ||
      options.force
    ) {
      emit(
        "modechange",
        {
          mode: target,
          previous
        }
      );
    }

    return api;
  }

  function setMode(
    mode,
    options = {}
  ) {
    return commitMode(
      mode,
      options
    );
  }

  function toggleMode() {
    return setMode(
      state.mode === "chat"
        ? "canvas"
        : "chat"
    );
  }

  /* =======================================================
     Snap
     ======================================================= */

  function stopSnap() {
    if (
      state.snapFrame !== null
    ) {
      cancelAnimationFrame(
        state.snapFrame
      );

      state.snapFrame = null;
    }
  }

  function snapTo(
    target,
    options = {}
  ) {
    stopSnap();

    const immediate =
      !!options.immediate;

    const velocity =
      Number(
        options.velocity
      ) || 0;

    const current =
      clamp(
        state.progress,
        0,
        1
      );

    if (immediate) {
      state.progress =
        target;

      render(
        target,
        false
      );

      return api;
    }

    const distance =
      Math.abs(
        target -
        current
      );

    if (
      distance < 0.001
    ) {
      state.progress =
        target;

      render(
        target,
        false
      );

      return api;
    }

    const start =
      performance.now();

    const duration =
      clamp(
        360 -
          Math.min(
            120,
            Math.abs(
              velocity
            ) * 70
          ) -
          distance * 60,
        220,
        420
      );

    function tick(now) {
      if (state.destroyed) {
        return;
      }

      const elapsed =
        now -
        start;

      const t =
        clamp(
          elapsed /
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
        lerp(
          current,
          target,
          eased
        );

      render(
        state.progress,
        false
      );

      if (t < 1) {
        state.snapFrame =
          requestAnimationFrame(
            tick
          );

        return;
      }

      state.snapFrame = null;

      state.progress =
        target;

      render(
        target,
        false
      );

      emit(
        "snap",
        {
          mode:
            target >= 0.5
              ? "canvas"
              : "chat",

          progress:
            target
        }
      );
    }

    state.snapFrame =
      requestAnimationFrame(
        tick
      );

    return api;
  }

  /* =======================================================
     Fixed UI hit test
     ======================================================= */

  function pointInsideFixedUI(
    target
  ) {
    return !!(
      target?.closest("#topbar") ||
      target?.closest("#composer")
    );
  }

  /* =======================================================
     Workspace gesture
     ======================================================= */

  function beginGesture(event) {
    if (
      state.destroyed ||
      state.locked ||
      state.mode !== "chat"
    ) {
      return;
    }

    if (
      pointInsideFixedUI(
        event.target
      )
    ) {
      return;
    }

    stopSnap();

    state.dragging = true;

    state.pointerId =
      event.pointerId;

    state.source =
      event.target;

    state.startX =
      event.clientX;

    state.startY =
      event.clientY;

    state.lastX =
      event.clientX;

    state.lastTime =
      performance.now();

    state.velocityX = 0;

    state.horizontal = false;

    workspace.classList.add(
      "is-dragging"
    );

    /*
     * 중요:
     * 여기서는 pointer capture를 하지 않는다.
     *
     * 아직 가로인지 세로인지 모르기 때문에
     * 브라우저의 기본 세로 스크롤을 막지 않는다.
     */

    emit(
      "gesturestart",
      {
        x: event.clientX,
        y: event.clientY
      }
    );
  }

  function updateGesture(event) {
    if (
      !state.dragging ||
      state.pointerId !==
        event.pointerId
    ) {
      return;
    }

    const dx =
      event.clientX -
      state.startX;

    const dy =
      event.clientY -
      state.startY;

    const distance =
      Math.max(
        Math.abs(dx),
        Math.abs(dy)
      );

    /*
     * 방향이 아직 결정되지 않은 상태.
     */
    if (
      !state.horizontal &&
      distance < 8
    ) {
      return;
    }

    /*
     * 세로 이동이면
     * 페이지 전환 제스처를 취소한다.
     *
     * 이후 브라우저가 Chat scroll을 처리한다.
     */
    if (
      !state.horizontal
    ) {
      if (
        Math.abs(dy) >
        Math.abs(dx)
      ) {
        cancelGesture(true);
        return;
      }

      /*
       * 여기서 처음으로 가로 제스처 확정.
       */
      state.horizontal = true;

      /*
       * 이제부터는 이 포인터를 UI가 소유한다.
       */
      try {
        workspace.setPointerCapture(
          event.pointerId
        );
      } catch {}
    }

    if (
      !state.horizontal
    ) {
      return;
    }

    event.preventDefault();

    /*
     * Chat → Canvas:
     * 왼쪽으로 이동할수록 progress 증가.
     */
    const next =
      clamp(
        -dx /
          state.viewportWidth,
        -0.18,
        1.18
      );

    const now =
      performance.now();

    const dt =
      Math.max(
        1,
        now -
          state.lastTime
      );

    const instantVelocity =
      (
        event.clientX -
        state.lastX
      ) / dt;

    state.velocityX =
      state.velocityX * 0.72 +
      instantVelocity * 0.28;

    state.lastX =
      event.clientX;

    state.lastTime =
      now;

    setProgress(
      next,
      true
    );
  }

  function finishGesture(event) {
    if (
      !state.dragging ||
      state.pointerId !==
        event.pointerId
    ) {
      return;
    }

    const horizontal =
      state.horizontal;

    const velocity =
      state.velocityX;

    state.dragging = false;

    state.pointerId = null;

    state.source = null;

    state.horizontal = false;

    state.velocityX = 0;

    workspace.classList.remove(
      "is-dragging"
    );

    try {
      workspace.releasePointerCapture(
        event.pointerId
      );
    } catch {}

    if (!horizontal) {
      state.progress =
        state.mode === "canvas"
          ? 1
          : 0;

      render(
        state.progress,
        false
      );

      return;
    }

    const progress =
      clamp(
        state.progress,
        0,
        1
      );

    let target;

    /*
     * 빠르게 왼쪽으로 밀면 Canvas.
     */
    if (
      velocity < -0.45
    ) {
      target = 1;
    }

    /*
     * 빠르게 오른쪽으로 밀면 Chat.
     */
    else if (
      velocity > 0.45
    ) {
      target = 0;
    }

    /*
     * 그렇지 않으면 절반 기준.
     */
    else {
      target =
        progress >= 0.5
          ? 1
          : 0;
    }

    const previous =
      state.mode;

    state.mode =
      target === 1
        ? "canvas"
        : "chat";

    state.locked =
      target === 1;

    syncCanvasInteraction();

    snapTo(
      target,
      {
        velocity
      }
    );

    if (
      previous !==
      state.mode
    ) {
      emit(
        "modechange",
        {
          mode:
            state.mode,

          previous
        }
      );
    }
  }

  function cancelGesture(
    reset = true
  ) {
    if (
      !state.dragging
    ) {
      return;
    }

    const pointerId =
      state.pointerId;

    state.dragging = false;

    state.pointerId = null;

    state.source = null;

    state.horizontal = false;

    state.velocityX = 0;

    workspace.classList.remove(
      "is-dragging"
    );

    if (
      pointerId !== null
    ) {
      try {
        workspace.releasePointerCapture(
          pointerId
        );
      } catch {}
    }

    if (reset) {
      state.progress =
        state.mode === "canvas"
          ? 1
          : 0;

      render(
        state.progress,
        false
      );
    }
  }

  function handleLostPointerCapture() {
    if (
      state.dragging &&
      state.horizontal
    ) {
      finishGesture({
        pointerId:
          state.pointerId
      });
    }
  }

  /* =======================================================
     Pill gesture
     ======================================================= */

  const pillGesture = {
    active: false,

    pointerId: null,

    startX: 0,

    startProgress: 0,

    velocityX: 0,

    lastX: 0,

    lastTime: 0,

    moved: false
  };

  let suppressModeClick = false;

  function beginPillGesture(event) {
    if (state.destroyed) {
      return;
    }

    stopSnap();

    pillGesture.active = true;

    pillGesture.pointerId =
      event.pointerId;

    pillGesture.startX =
      event.clientX;

    pillGesture.startProgress =
      state.progress;

    pillGesture.velocityX = 0;

    pillGesture.moved = false;

    pillGesture.lastX =
      event.clientX;

    pillGesture.lastTime =
      performance.now();

    modeSwitch.classList.add(
      "is-dragging"
    );

    try {
      modeSwitch.setPointerCapture(
        event.pointerId
      );
    } catch {}

    event.preventDefault();
  }

  function updatePillGesture(event) {
    if (
      !pillGesture.active ||
      pillGesture.pointerId !==
        event.pointerId
    ) {
      return;
    }

    event.preventDefault();

    const dx =
      event.clientX -
      pillGesture.startX;

    pillGesture.moved =
      Math.abs(dx) > 6;

    const width =
      Math.max(
        1,
        modeSwitch.clientWidth
      );

    const next =
      clamp(
        pillGesture.startProgress -
          dx / width,
        -0.24,
        1.24
      );

    const now =
      performance.now();

    const dt =
      Math.max(
        1,
        now -
          pillGesture.lastTime
      );

    const instant =
      (
        event.clientX -
        pillGesture.lastX
      ) / dt;

    pillGesture.velocityX =
      pillGesture.velocityX * 0.72 +
      instant * 0.28;

    pillGesture.lastX =
      event.clientX;

    pillGesture.lastTime =
      now;

    state.progress =
      next;

    render(
      next,
      true
    );
  }

  function finishPillGesture(event) {
    if (
      !pillGesture.active ||
      pillGesture.pointerId !==
        event.pointerId
    ) {
      return;
    }

    event.preventDefault();

    const progress =
      clamp(
        state.progress,
        0,
        1
      );

    const velocity =
      pillGesture.velocityX;

    suppressModeClick =
      pillGesture.moved;

    pillGesture.active = false;

    pillGesture.pointerId = null;

    modeSwitch.classList.remove(
      "is-dragging"
    );

    try {
      modeSwitch.releasePointerCapture(
        event.pointerId
      );
    } catch {}

    let target;

    if (
      velocity < -0.45
    ) {
      target = 1;
    } else if (
      velocity > 0.45
    ) {
      target = 0;
    } else {
      target =
        progress >= 0.5
          ? 1
          : 0;
    }

    const previous =
      state.mode;

    state.mode =
      target === 1
        ? "canvas"
        : "chat";

    state.locked =
      target === 1;

    syncCanvasInteraction();

    snapTo(
      target,
      {
        velocity
      }
    );

    if (
      previous !==
      state.mode
    ) {
      emit(
        "modechange",
        {
          mode:
            state.mode,

          previous
        }
      );
    }
  }

  /* =======================================================
     Mode click
     ======================================================= */

  function handleModeClick(event) {
    if (
      state.dragging ||
      pillGesture.active ||
      suppressModeClick
    ) {
      suppressModeClick = false;
      return;
    }

    const button =
      event.target.closest(
        "button"
      );

    if (!button) {
      return;
    }

    const mode =
      button.dataset.mode;

    if (
      mode === "chat" ||
      mode === "canvas"
    ) {
      setMode(mode);
    }
  }

  function handleModeKeydown(event) {
    if (
      event.key !== "Enter" &&
      event.key !== " "
    ) {
      return;
    }

    const button =
      event.target.closest(
        "button"
      );

    if (!button) {
      return;
    }

    event.preventDefault();

    const mode =
      button.dataset.mode;

    if (
      mode === "chat" ||
      mode === "canvas"
    ) {
      setMode(mode);
    }
  }

  /* =======================================================
     Composer
     ======================================================= */

  function resizeComposerInput() {
    if (!composerInput) {
      return;
    }

    composerInput.style.height =
      "auto";

    composerInput.style.height =
      `${Math.min(
        composerInput.scrollHeight,
        120
      )}px`;
  }

  if (composerInput) {
    listen(
      composerInput,
      "input",
      resizeComposerInput
    );

    listen(
      composerInput,
      "focus",
      resizeComposerInput
    );
  }

  /* =======================================================
     Bind listeners
     ======================================================= */

  listen(
    workspace,
    "pointerdown",
    beginGesture,
    {
      passive: false
    }
  );

  listen(
    workspace,
    "pointermove",
    updateGesture,
    {
      passive: false
    }
  );

  listen(
    workspace,
    "pointerup",
    finishGesture
  );

  listen(
    workspace,
    "pointercancel",
    () => cancelGesture(true)
  );

  listen(
    workspace,
    "lostpointercapture",
    handleLostPointerCapture
  );

  listen(
    modeSwitch,
    "pointerdown",
    beginPillGesture,
    {
      passive: false
    }
  );

  listen(
    modeSwitch,
    "pointermove",
    updatePillGesture,
    {
      passive: false
    }
  );

  listen(
    modeSwitch,
    "pointerup",
    finishPillGesture
  );

  listen(
    modeSwitch,
    "pointercancel",
    () => {
      if (
        !pillGesture.active
      ) {
        return;
      }

      pillGesture.active = false;

      pillGesture.pointerId = null;

      modeSwitch.classList.remove(
        "is-dragging"
      );

      state.progress =
        state.mode === "canvas"
          ? 1
          : 0;

      render(
        state.progress,
        false
      );
    }
  );

  listen(
    modeSwitch,
    "click",
    handleModeClick
  );

  listen(
    modeSwitch,
    "keydown",
    handleModeKeydown
  );

  listen(
    global,
    "resize",
    scheduleViewportSync
  );

  listen(
    global,
    "orientationchange",
    scheduleViewportSync
  );

  listen(
    global,
    "pageshow",
    scheduleViewportSync
  );

  if (
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

  /* =======================================================
     Public API
     ======================================================= */

  const api = {
    getMode() {
      return state.mode;
    },

    getProgress() {
      return state.progress;
    },

    setMode,

    toggleMode,

    bindCanvas,

    syncViewport,

    on,

    off,

    destroy() {
      if (state.destroyed) {
        return;
      }

      state.destroyed = true;

      stopSnap();

      if (
        state.viewportFrame !== null
      ) {
        cancelAnimationFrame(
          state.viewportFrame
        );

        state.viewportFrame = null;
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

      state.canvasApi = null;
    }
  };

  global.AstraUI =
    api;

  /* =======================================================
     Initial state
     ======================================================= */

  state.mode = "chat";

  state.progress = 0;

  state.locked = false;

  state.viewportWidth =
    getViewportWidth();

  render(
    0,
    true
  );

  syncViewport();

})(window);
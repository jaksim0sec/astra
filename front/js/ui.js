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
     Touch behavior
     ======================================================= */

  /*
   * Workspace
   *
   * 세로 스크롤은 브라우저에 맡기고
   * 가로 제스처만 직접 처리한다.
   */
  workspace.style.touchAction = "pan-y";

  /*
   * 알약은 가로 드래그를 직접 처리한다.
   */
  modeSwitch.style.touchAction = "none";

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

    startProgress: 0,

    lastX: 0,
    lastTime: 0,

    velocityX: 0,

    horizontal: false,

    touchDragging: false,

    touchId: null,

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
    if (
      state.viewportFrame !== null
    ) {
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

    /*
     * snap 중에는 transform을 계속 유지한다.
     */
    const shouldTransform =
      state.dragging ||
      state.snapFrame !== null ||
      immediate;

    if (shouldTransform) {
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

    syncCanvasInteraction();

    snapTo(
      target === "canvas"
        ? 1
        : 0,
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
        true
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
        true
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
        state.snapFrame = null;
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
      target?.closest("#composer") ||
      target?.closest("#mode-switch")
    );
  }

  /* =======================================================
     Workspace direction
     ======================================================= */

  function canStartHorizontal(
    dx,
    dy
  ) {
    const absX =
      Math.abs(dx);

    const absY =
      Math.abs(dy);

    if (absY > absX) {
      return false;
    }

    if (
      state.mode === "chat"
    ) {
      return dx < 0;
    }

    return dx > 0;
  }

  /* =======================================================
     Workspace gesture
     ======================================================= */

  function beginGesture(event) {
    if (
      state.destroyed ||
      state.touchDragging
    ) {
      return;
    }

    if (
      event.pointerType === "touch"
    ) {
      return;
    }

    if (
      event.button !== undefined &&
      event.button !== 0
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

    state.startProgress =
      state.mode === "canvas"
        ? 1
        : 0;

    state.progress =
      state.startProgress;

    state.lastX =
      event.clientX;

    state.lastTime =
      performance.now();

    state.velocityX = 0;

    state.horizontal = false;

    /*
     * 마우스는 처음부터 capture
     * 해서 바깥으로 나가도 계속 드래그한다.
     */
    if (
      event.pointerType === "mouse"
    ) {
      try {
        workspace.setPointerCapture(
          event.pointerId
        );
      } catch {}
    }

    workspace.classList.add(
      "is-dragging"
    );

    emit(
      "gesturestart",
      {
        x: event.clientX,
        y: event.clientY,
        mode: state.mode
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

    if (
      event.pointerType === "touch"
    ) {
      return;
    }

    const dx =
      event.clientX -
      state.startX;

    const dy =
      event.clientY -
      state.startY;

    const absX =
      Math.abs(dx);

    const absY =
      Math.abs(dy);

    const distance =
      Math.max(
        absX,
        absY
      );

    if (
      !state.horizontal &&
      distance < 8
    ) {
      return;
    }

    if (
      !state.horizontal &&
      !canStartHorizontal(
        dx,
        dy
      )
    ) {
      cancelGesture(true);
      return;
    }

    if (
      !state.horizontal
    ) {
      state.horizontal = true;

      try {
        workspace.setPointerCapture(
          event.pointerId
        );
      } catch {}

      const canvas =
        state.canvasApi;

      if (
        canvas &&
        typeof canvas.setInteractionEnabled ===
          "function"
      ) {
        canvas.setInteractionEnabled(false);
      }
    }

    event.preventDefault();

    const next =
      clamp(
        state.startProgress -
          dx /
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

    if (
      event.pointerType === "touch"
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

    syncCanvasInteraction();

    if (!horizontal) {
      state.progress =
        state.mode === "canvas"
          ? 1
          : 0;

      render(
        state.progress,
        true
      );

      return;
    }

    finishWorkspaceSnap(
      velocity
    );
  }

  function finishWorkspaceSnap(
    velocity
  ) {
    const progress =
      clamp(
        state.progress,
        0,
        1
      );

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

    syncCanvasInteraction();

    if (reset) {
      state.progress =
        state.mode === "canvas"
          ? 1
          : 0;

      render(
        state.progress,
        true
      );
    }
  }

  function handleLostPointerCapture() {
    if (
      state.dragging &&
      state.pointerId !== null
    ) {
      finishGesture({
        pointerId:
          state.pointerId,

        pointerType: "mouse"
      });
    }
  }

  /* =======================================================
     Workspace touch gesture
     ======================================================= */

  function getTouchById(
    touches,
    id
  ) {
    for (
      let i = 0;
      i < touches.length;
      i++
    ) {
      if (
        touches[i].identifier === id
      ) {
        return touches[i];
      }
    }

    return null;
  }

  function beginTouchGesture(event) {
    if (
      state.destroyed ||
      state.touchDragging
    ) {
      return;
    }

    if (
      !event.touches ||
      event.touches.length !== 1
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

    const touch =
      event.touches[0];

    state.touchDragging = true;

    state.touchId =
      touch.identifier;

    state.dragging = true;

    state.startX =
      touch.clientX;

    state.startY =
      touch.clientY;

    state.startProgress =
      state.mode === "canvas"
        ? 1
        : 0;

    state.progress =
      state.startProgress;

    state.lastX =
      touch.clientX;

    state.lastTime =
      performance.now();

    state.velocityX = 0;

    state.horizontal = false;

    workspace.classList.add(
      "is-dragging"
    );

    emit(
      "gesturestart",
      {
        x: touch.clientX,
        y: touch.clientY,
        mode: state.mode
      }
    );
  }

  function updateTouchGesture(event) {
    if (
      !state.touchDragging ||
      state.touchId === null
    ) {
      return;
    }

    const touch =
      getTouchById(
        event.touches,
        state.touchId
      );

    if (!touch) {
      return;
    }

    const dx =
      touch.clientX -
      state.startX;

    const dy =
      touch.clientY -
      state.startY;

    const absX =
      Math.abs(dx);

    const absY =
      Math.abs(dy);

    const distance =
      Math.max(
        absX,
        absY
      );

    if (
      !state.horizontal &&
      distance < 8
    ) {
      return;
    }

    /*
     * 세로 스크롤
     */
    if (
      !state.horizontal &&
      absY > absX
    ) {
      cancelTouchGesture();
      return;
    }

    /*
     * Chat → Canvas
     * 왼쪽만
     *
     * Canvas → Chat
     * 오른쪽만
     */
    if (
      !state.horizontal
    ) {
      if (
        !canStartHorizontal(
          dx,
          dy
        )
      ) {
        cancelTouchGesture();
        return;
      }

      state.horizontal = true;

      const canvas =
        state.canvasApi;

      if (
        canvas &&
        typeof canvas.setInteractionEnabled ===
          "function"
      ) {
        canvas.setInteractionEnabled(false);
      }
    }

    /*
     * 여기부터 브라우저 세로 스크롤을 막는다.
     */
    event.preventDefault();

    const next =
      clamp(
        state.startProgress -
          dx /
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
        touch.clientX -
        state.lastX
      ) / dt;

    state.velocityX =
      state.velocityX * 0.72 +
      instantVelocity * 0.28;

    state.lastX =
      touch.clientX;

    state.lastTime =
      now;

    setProgress(
      next,
      true
    );
  }

  function finishTouchGesture() {
    if (
      !state.touchDragging
    ) {
      return;
    }

    const horizontal =
      state.horizontal;

    const velocity =
      state.velocityX;

    state.touchDragging = false;

    state.touchId = null;

    state.dragging = false;

    state.horizontal = false;

    state.velocityX = 0;

    workspace.classList.remove(
      "is-dragging"
    );

    syncCanvasInteraction();

    if (!horizontal) {
      state.progress =
        state.mode === "canvas"
          ? 1
          : 0;

      render(
        state.progress,
        true
      );

      return;
    }

    finishWorkspaceSnap(
      velocity
    );
  }

  function cancelTouchGesture() {
    if (
      !state.touchDragging
    ) {
      return;
    }

    state.touchDragging = false;

    state.touchId = null;

    state.dragging = false;

    state.horizontal = false;

    state.velocityX = 0;

    workspace.classList.remove(
      "is-dragging"
    );

    syncCanvasInteraction();

    state.progress =
      state.mode === "canvas"
        ? 1
        : 0;

    render(
      state.progress,
      true
    );
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
    if (
      state.destroyed
    ) {
      return;
    }

    if (
      event.button !== undefined &&
      event.button !== 0
    ) {
      return;
    }

    stopSnap();

    pillGesture.active = true;

    pillGesture.pointerId =
      event.pointerId;

    pillGesture.startX =
      event.clientX;

    pillGesture.startProgress =
      clamp(
        state.progress,
        0,
        1
      );

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

    /*
     * 단순 클릭을 위해
     * pointerdown에서는
     * preventDefault하지 않는다.
     */
  }

  function updatePillGesture(event) {
    if (
      !pillGesture.active ||
      pillGesture.pointerId !==
        event.pointerId
    ) {
      return;
    }

    const dx =
      event.clientX -
      pillGesture.startX;

    const moved =
      Math.abs(dx) > 6;

    pillGesture.moved =
      moved;

    if (moved) {
      event.preventDefault();
    }

    const width =
      Math.max(
        1,
        modeSwitch.clientWidth
      );

    /*
     * 알약 이동 방향 = 손가락 이동 방향
     */
    const next =
      clamp(
        pillGesture.startProgress +
          dx /
            width,
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

    const moved =
      pillGesture.moved;

    const progress =
      clamp(
        state.progress,
        0,
        1
      );

    const velocity =
      pillGesture.velocityX;

    suppressModeClick =
      moved;

    pillGesture.active = false;

    pillGesture.pointerId = null;

    pillGesture.moved = false;

    pillGesture.velocityX = 0;

    modeSwitch.classList.remove(
      "is-dragging"
    );

    try {
      modeSwitch.releasePointerCapture(
        event.pointerId
      );
    } catch {}

    /*
     * 클릭이면 click 이벤트에게 맡긴다.
     */
    if (!moved) {
      state.progress =
        state.mode === "canvas"
          ? 1
          : 0;

      render(
        state.progress,
        true
      );

      return;
    }

    event.preventDefault();

    let target;

    /*
     * 알약은 손 이동 방향과 동일하게 움직이지만
     * 실제 페이지 방향은 기존 의미 그대로 유지.
     */
    if (
      velocity > 0.45
    ) {
      target = 1;
    } else if (
      velocity < -0.45
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
      suppressModeClick
    ) {
      suppressModeClick = false;
      return;
    }

    if (
      pillGesture.active
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
     Workspace pointer listeners
     ======================================================= */

  const gestureOptions = {
    passive: false,
    capture: true
  };

  listen(
    workspace,
    "pointerdown",
    beginGesture,
    gestureOptions
  );

  listen(
    workspace,
    "pointermove",
    updateGesture,
    gestureOptions
  );

  listen(
    workspace,
    "pointerup",
    finishGesture,
    gestureOptions
  );

  listen(
    workspace,
    "pointercancel",
    () => cancelGesture(true),
    gestureOptions
  );

  listen(
    workspace,
    "lostpointercapture",
    handleLostPointerCapture,
    gestureOptions
  );

  /* =======================================================
     Workspace touch listeners
     ======================================================= */

  listen(
    workspace,
    "touchstart",
    beginTouchGesture,
    {
      passive: true,
      capture: true
    }
  );

  listen(
    workspace,
    "touchmove",
    updateTouchGesture,
    {
      passive: false,
      capture: true
    }
  );

  listen(
    workspace,
    "touchend",
    finishTouchGesture,
    {
      passive: true,
      capture: true
    }
  );

  listen(
    workspace,
    "touchcancel",
    cancelTouchGesture,
    {
      passive: true,
      capture: true
    }
  );

  /* =======================================================
     Pill listeners
     ======================================================= */

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
    finishPillGesture,
    {
      passive: false
    }
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

      pillGesture.moved = false;

      pillGesture.velocityX = 0;

      modeSwitch.classList.remove(
        "is-dragging"
      );

      state.progress =
        state.mode === "canvas"
          ? 1
          : 0;

      render(
        state.progress,
        true
      );
    }
  );

  /* =======================================================
     Mode controls
     ======================================================= */

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

  /* =======================================================
     Viewport listeners
     ======================================================= */

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
      if (
        state.destroyed
      ) {
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

  state.viewportWidth =
    getViewportWidth();

  render(
    0,
    true
  );

  syncViewport();

})(window);
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
  const Presence = global.OvllPresence;
  const Execution = global.OvllExecutionEngine;
  const mountCanvasNode = global.mountCanvasNode;

  /* =======================================================
     DOM
     ======================================================= */
  const workspace = document.querySelector("#workspace");
  const chatPage = document.querySelector("#chat-page");
  const chatContent = document.querySelector("#chat-content");
  const chatMessages = document.querySelector("#chat-messages");
  const composerForm = document.querySelector("#composer-form");
  const composerInput = document.querySelector("#composer-input");
  let composerAttach = document.querySelector("#composer-attach");
  let composerFileInput = document.querySelector("#composer-file-input");
  const composerSubmit = document.querySelector("#composer-submit");

  if (!workspace || !chatPage || !chatContent || !chatMessages || !composerForm || !composerInput || !composerSubmit) {
    throw new Error("ovll Application DOM 구조가 올바르지 않습니다.");
  }

  if (
    !UI ||
    !API ||
    !Presence ||
    !Execution ||
    typeof Execution.RuntimeEngine !== "function" ||
    typeof mountCanvasNode !== "function"
  ) {
    throw new Error("ovll Application dependency가 준비되지 않았습니다.");
  }

  /* =======================================================
     State
     ======================================================= */
  const memoryStore = {
    value: {
      flow: "",
      recent: "",
      detail: ""
    }
  };

  const state = {
    destroyed: false,
    ready: false,
    busy: false,
    canvas: null,
    workflow: null,
    nodeDefinitions: null,
    conversationMemory: null,
    runtime: null,
    runtimeConnections: new Set(),
    runtimeActivity: null,
    lastUserRequest: "",
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

  function syncPhysicalOrientation() {
    const orientationType =
      global.screen?.orientation?.type;

    const isLandscape =
      typeof orientationType === "string"
        ? orientationType.startsWith("landscape")
        : Number(global.screen?.width) > Number(global.screen?.height);

    document.documentElement.classList.toggle(
      "physical-landscape",
      !!isLandscape
    );
  }

  function syncAppViewport() {
    UI.syncViewport?.();
  }

  function focusComposerWithoutScroll() {
    try {
      composerInput.focus({
        preventScroll: true
      });
    } catch {
      composerInput.focus();
    }
  }

  /* =======================================================
     Chat
     ======================================================= */

  function formatArtifactSize(
    value
  ) {
    const size =
      Number(value || 0);

    if (size < 1024) {
      return `${size} B`;
    }

    if (size < 1048576) {
      return `${(size / 1024).toFixed(1)} KB`;
    }

    return `${(size / 1048576).toFixed(1)} MB`;
  }

  function artifactFormat(
    artifact
  ) {
    const direct =
      String(
        artifact?.format || ""
      ).trim();

    if (direct) {
      return direct.toUpperCase();
    }

    const name =
      String(
        artifact?.name || ""
      );

    const dot =
      name.lastIndexOf(".");

    return dot > 0
      ? name.slice(dot + 1)
        .toUpperCase()
      : "FILE";
  }

  function appendArtifactCards(
    message,
    artifacts
  ) {
    const list =
      Array.isArray(artifacts)
        ? artifacts.filter(Boolean)
        : [];

    if (!list.length) return;

    const group =
      document.createElement(
        "div"
      );
    group.className =
      "astra-message-artifacts";

    const label =
      document.createElement(
        "div"
      );
    label.className =
      "astra-message-artifacts-label";
    label.textContent =
      "결과물";
    group.appendChild(label);

    for (const artifact of list) {
      const link =
        document.createElement(
          "a"
        );
      link.className =
        "astra-artifact-card";
      link.href =
        String(
          artifact.downloadUrl ||
          "#"
        );
      link.download =
        String(
          artifact.name ||
          "result"
        );

      const icon =
        document.createElement(
          "span"
        );
      icon.className =
        "astra-artifact-icon";
      icon.innerHTML = `
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M5.2 2.9h6.15l3.45 3.45V17.1H5.2V2.9Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
          <path d="M11.2 2.9v3.65h3.6M7.55 11h4.95M7.55 13.35h3.6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      `;

      const format =
        document.createElement(
          "span"
        );
      format.className =
        "astra-artifact-format";
      format.textContent =
        artifactFormat(
          artifact
        );
      icon.appendChild(format);

      const info =
        document.createElement(
          "span"
        );
      info.className =
        "astra-artifact-info";

      const name =
        document.createElement(
          "span"
        );
      name.className =
        "astra-artifact-name";
      name.textContent =
        String(
          artifact.name ||
          "결과물"
        );

      const meta =
        document.createElement(
          "span"
        );
      meta.className =
        "astra-artifact-meta";
      meta.textContent =
        `${artifactFormat(artifact)} · ${formatArtifactSize(artifact.size)}`;

      info.append(
        name,
        meta
      );

      const action =
        document.createElement(
          "span"
        );
      action.className =
        "astra-artifact-download";
      action.innerHTML = `
        <svg viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <path d="M9 3v7.2m0 0 2.55-2.55M9 10.2 6.45 7.65M4 13.6h10" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      `;

      link.append(
        icon,
        info,
        action
      );
      group.appendChild(link);
    }

    message.appendChild(group);
  }

  function createMessage(
    role,
    text,
    options = {}
  ) {
    const message =
      document.createElement("div");

    const id =
      `message-${++state.messageCount}`;

    const value =
      String(text ?? "");

    message.id = id;

    message.className =
      `astra-message astra-message-${role}`;

    message.dataset.role =
      role;

    const body =
      document.createElement("div");

    body.className =
      "astra-message-body";

    body.textContent =
      value;

    message.appendChild(body);

    const question =
      String(
        options.question ?? ""
      ).trim();

    if (
      role === "assistant" &&
      question
    ) {
      const questionBox =
        document.createElement("div");

      questionBox.className =
        "astra-message-question";

      const questionLabel =
        document.createElement("div");

      questionLabel.className =
        "astra-message-question-label";

      questionLabel.textContent =
        "질문";

      const questionBody =
        document.createElement("div");

      questionBody.className =
        "astra-message-question-body";

      questionBody.textContent =
        question;

      questionBox.appendChild(
        questionLabel
      );

      questionBox.appendChild(
        questionBody
      );

      message.appendChild(
        questionBox
      );
    }

    if (
      role === "assistant"
    ) {
      appendArtifactCards(
        message,
        options.artifacts
      );
    }

    if (
      role === "assistant" &&
      options.showCanvasView
    ) {
      const canvasButton =
        document.createElement("button");

      canvasButton.type = "button";
      canvasButton.className =
        "astra-message-canvas-link";
      canvasButton.setAttribute(
        "aria-label",
        "캔버스에서 보기"
      );
      canvasButton.innerHTML = `
        <svg viewBox="0 0 20 20" fill="none" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          <rect x="3.25" y="3.25" width="13.5" height="13.5" rx="3.25"></rect>
          <circle cx="7" cy="7" r="1"></circle>
          <circle cx="13" cy="7" r="1"></circle>
          <circle cx="7" cy="13" r="1"></circle>
          <circle cx="13" cy="13" r="1"></circle>
          <path d="M7 7h6M7 13h6M7 7v6M13 7v6"></path>
        </svg>
        <span>캔버스에서 보기</span>
      `;

      listen(canvasButton, "click", event => {
        event.preventDefault();
        event.stopPropagation();

        const modeButton =
          document.querySelector("#mode-canvas");

        if (modeButton) {
          modeButton.click();
          return;
        }

        if (
          typeof UI.setMode ===
          "function"
        ) {
          UI.setMode("canvas");
        }
      });

      message.appendChild(canvasButton);
    }

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

      copyButton.type =
        "button";

      copyButton.className =
        "astra-message-action";

      copyButton.dataset.action =
        "copy";

      copyButton.setAttribute(
        "aria-label",
        "복사"
      );

      copyButton.title =
        "복사";

      copyButton.innerHTML = `
        <svg viewBox="0 0 16 16" fill="none" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          <rect x="5" y="5" width="7" height="7" rx="1.35"></rect>
          <path d="M3.5 9V4.75c0-.7.55-1.25 1.25-1.25H9"></path>
        </svg>
        <span>복사</span>
      `;

      actions.appendChild(
        copyButton
      );

      if (
        role === "assistant"
      ) {
        const retryButton =
          document.createElement(
            "button"
          );

        retryButton.type =
          "button";

        retryButton.className =
          "astra-message-action";

        retryButton.dataset.action =
          "retry";

        retryButton.setAttribute(
          "aria-label",
          "재시도"
        );

        retryButton.title =
          "재시도";

        retryButton.innerHTML = `
            <svg viewBox="0 0 16 16" fill="none" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            <path d="M12.4 5.4A4.6 4.6 0 1 0 12.8 9.4"></path>
            <path d="M12.4 2.6v2.8H9.6"></path>
          </svg>
          <span>재시도</span>
        `;

        actions.appendChild(
          retryButton
        );
      }

      message.appendChild(
        actions
      );
    }

    chatMessages.appendChild(
      message
    );

    if (
      role === "assistant"
    ) {
      Presence.moveToEnd();
      Presence.speak(value);
    }

    scrollChatToBottom();

    return message;
  }

  function addUserMessage(text) {
    const value =
      String(text ?? "").trim();

    if (!value) return null;

    Presence.beginConversation();

    const message =
      createMessage(
        "user",
        value
      );

    return message;
  }

  function addAssistantMessage(
    text,
    options = {}
  ) {
    const value =
      String(text ?? "").trim();

    if (!value) return null;

    const message =
      createMessage(
        "assistant",
        value,
        options
      );

    return message;
  }

  function revealAssistantMessage(message, text) {
    const body =
      message?.querySelector(
        ".astra-message-body"
      );

    if (!body) return 0;

    const tokens =
      String(text ?? "")
        .split(/(\s+)/)
        .filter(
          token =>
            token.length > 0
        );

    body.textContent = "";

    tokens.forEach(
      (token, index) => {
        const span =
          document.createElement(
            "span"
          );

        span.className =
          "astra-message-reveal-token";
        span.textContent =
          token;
        span.style.setProperty(
          "--reveal-index",
          Math.min(index, 44)
        );

        body.appendChild(
          span
        );
      }
    );

    return Math.min(
      1200,
      tokens.length * 22 + 180
    );
  }

  function runtimeActivityMarkup() {
    return `
      <button
        type="button"
        class="astra-runtime-activity-summary"
        aria-expanded="true"
      >
        <span class="astra-runtime-activity-spark" aria-hidden="true">
          <span></span>
        </span>
        <span class="astra-runtime-activity-title">실행 과정</span>
        <span class="astra-runtime-activity-meta">준비 중</span>
        <svg class="astra-runtime-activity-chevron" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M6.5 8 10 11.5 13.5 8" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      <div class="astra-runtime-activity-steps"></div>
    `;
  }

  function runtimeStepMarkup() {
    return `
      <span class="astra-runtime-step-mark" aria-hidden="true">
        <span class="astra-runtime-step-pulse"></span>
        <svg class="astra-runtime-step-check" viewBox="0 0 18 18" fill="none">
          <path d="m5.1 9.2 2.35 2.35 5.45-5.5" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <svg class="astra-runtime-step-error" viewBox="0 0 18 18" fill="none">
          <path d="m6.2 6.2 5.6 5.6M11.8 6.2l-5.6 5.6" stroke="currentColor" stroke-width="1.55" stroke-linecap="round"/>
        </svg>
      </span>
      <span class="astra-runtime-step-content">
        <span class="astra-runtime-step-label"></span>
        <span class="astra-runtime-step-detail"></span>
      </span>
    `;
  }

  function beginRuntimeActivity(
    text = "실행 준비 중"
  ) {
    if (state.runtimeActivity) {
      finishRuntimeActivity(
        { removeImmediately: true }
      );
    }

    const row =
      document.createElement(
        "div"
      );

    row.className =
      "astra-message astra-message-assistant astra-runtime-activity";
    row.dataset.runtimeActivity =
      "true";

    const body =
      document.createElement(
        "div"
      );

    body.className =
      "astra-runtime-activity-body";
    body.innerHTML =
      runtimeActivityMarkup();

    row.appendChild(body);
    chatMessages.appendChild(row);

    const summary =
      body.querySelector(
        ".astra-runtime-activity-summary"
      );

    const activity = {
      row,
      summary,
      meta:
        body.querySelector(
          ".astra-runtime-activity-meta"
        ),
      stepsRoot:
        body.querySelector(
          ".astra-runtime-activity-steps"
        ),
      steps:
        new Map(),
      order: [],
      text: "",
      finished: false
    };

    state.runtimeActivity =
      activity;

    summary?.addEventListener(
      "click",
      () => {
        const collapsed =
          row.classList.toggle(
            "is-collapsed"
          );

        summary.setAttribute(
          "aria-expanded",
          String(!collapsed)
        );
      }
    );

    upsertRuntimeStep(
      "__prepare__",
      text,
      "running"
    );

    scrollChatToBottom();
    return row;
  }

  function normalizeCompletedStepText(
    text
  ) {
    return String(text || "")
      .replace(
        /\s+(중|확인 중|판단 중|준비 중)$/,
        match =>
          match.includes("확인")
            ? " 확인"
            : match.includes("판단")
              ? " 판단"
              : match.includes("준비")
                ? " 준비"
                : ""
      )
      .trim();
  }

  function runtimeActivityCount(
    activity
  ) {
    return activity.order
      .filter(
        id =>
          id !== "__prepare__" &&
          id !== "__finalize__"
      )
      .length;
  }

  function syncRuntimeActivityMeta() {
    const activity =
      state.runtimeActivity;

    if (!activity) return;

    const count =
      runtimeActivityCount(
        activity
      );

    const failed =
      activity.order.some(
        id =>
          activity.steps
            .get(id)
            ?.dataset
            ?.status ===
            "failed"
      );

    if (activity.finished) {
      activity.meta.textContent =
        failed
          ? `${count}단계 · 일부 실패`
          : `${count}단계 완료`;
      return;
    }

    const running =
      activity.order.filter(
        id =>
          activity.steps
            .get(id)
            ?.dataset
            ?.status ===
            "running"
      ).length;

    activity.meta.textContent =
      running
        ? "진행 중"
        : count
          ? `${count}단계`
          : "준비 중";
  }

  function upsertRuntimeStep(
    id,
    text,
    status = "running",
    detail = ""
  ) {
    const activity =
      state.runtimeActivity ||
      (
        beginRuntimeActivity(),
        state.runtimeActivity
      );

    if (!activity) return null;

    const key =
      String(id || "");

    if (!key) return null;

    let step =
      activity.steps.get(
        key
      );

    if (!step) {
      step =
        document.createElement(
          "div"
        );

      step.className =
        "astra-runtime-step";
      step.innerHTML =
        runtimeStepMarkup();
      step.dataset.stepId =
        key;

      activity.steps.set(
        key,
        step
      );
      activity.order.push(
        key
      );
      activity.stepsRoot
        ?.appendChild(
          step
        );

      requestAnimationFrame(
        () =>
          step.classList.add(
            "is-visible"
          )
      );
    }

    const label =
      step.querySelector(
        ".astra-runtime-step-label"
      );

    const detailElement =
      step.querySelector(
        ".astra-runtime-step-detail"
      );

    const nextText =
      status === "done"
        ? normalizeCompletedStepText(
            text
          )
        : String(text || "").trim();

    if (label && nextText) {
      label.textContent =
        nextText;
    }

    const detailText =
      String(detail || "")
        .replace(
          /\s+/g,
          " "
        )
        .trim()
        .slice(
          0,
          180
        );

    if (detailElement) {
      detailElement.textContent =
        detailText;
      detailElement.hidden =
        !detailText;
    }

    step.dataset.status =
      status;

    syncRuntimeActivityMeta();
    scrollChatToBottom();
    return step;
  }

  function setRuntimeActivity(
    text,
    options = {}
  ) {
    const value =
      String(text || "").trim();

    if (!value) return;

    const id =
      String(
        options.id ||
        "__status__"
      );

    upsertRuntimeStep(
      id,
      value,
      options.status ||
        "running",
      options.detail ||
        ""
    );
  }

  function completeRuntimeStep(
    id,
    options = {}
  ) {
    const activity =
      state.runtimeActivity;

    if (!activity) return;

    const key =
      String(id || "");
    const step =
      activity.steps.get(
        key
      );

    if (!step) return;

    const label =
      step.querySelector(
        ".astra-runtime-step-label"
      );

    upsertRuntimeStep(
      key,
      options.text ||
        label?.textContent ||
        "",
      options.failed
        ? "failed"
        : options.skipped
          ? "skipped"
          : "done",
      options.detail ||
        ""
    );
  }

  function finishRuntimeActivity(
    options = {}
  ) {
    const activity =
      state.runtimeActivity;

    if (!activity) return;

    if (
      options.removeImmediately
    ) {
      activity.row?.remove();
      state.runtimeActivity =
        null;
      return;
    }

    activity.finished =
      true;

    for (
      const id of
      activity.order
    ) {
      const step =
        activity.steps.get(
          id
        );

      if (
        step?.dataset
          ?.status ===
          "running"
      ) {
        completeRuntimeStep(
          id,
          {
            failed:
              options.failed === true &&
              id === "__finalize__"
          }
        );
      }
    }

    activity.row
      ?.classList
      .add(
        "is-complete"
      );

    syncRuntimeActivityMeta();

    setTimeout(
      () => {
        activity.row
          ?.classList
          .add(
            "is-collapsed"
          );

        activity.summary
          ?.setAttribute(
            "aria-expanded",
            "false"
          );
      },
      520
    );

    state.runtimeActivity =
      null;
  }

  function compactRuntimeSubject(
    value,
    fallback
  ) {
    const text =
      String(
        value || fallback || ""
      )
        .replace(/\s+/g, " ")
        .trim();

    if (text.length <= 34) {
      return text;
    }

    return text.slice(0, 33) + "…";
  }

  function runtimeActivityText(
    event
  ) {
    const node =
      state.canvas?.getNode?.(
        String(
          event?.nodeId ||
          ""
        )
      );

    const type =
      String(
        event?.state?.type ||
        node?.type ||
        ""
      );

    const params =
      node?.data?.params ||
      {};

    switch (type) {
      case "research":
        return `${compactRuntimeSubject(
          params.topic,
          "자료"
        )} 탐색 중`;

      case "organize":
        return `${compactRuntimeSubject(
          params.format ||
          params.criteria,
          "자료"
        )}로 정리 중`;

      case "write":
        return `${compactRuntimeSubject(
          params.title ||
          params.about,
          "결과"
        )} 작성 중`;

      case "convert":
        return `${compactRuntimeSubject(
          params.instruction,
          "결과"
        )} 변환 중`;

      case "judge":
        return `${compactRuntimeSubject(
          params.condition,
          "조건"
        )} 판단 중`;

      case "createFile":
        return `${compactRuntimeSubject(
          params.filename,
          "결과물"
        )} 생성 중`;

      case "file":
        return "입력 파일 확인 중";

      case "start":
        return "실행 흐름 준비 중";

      default:
        return "작업 실행 중";
    }
  }

  function fallbackRuntimeMessage(
    run
  ) {
    const states =
      Object.values(
        run?.nodes || {}
      );

    const failed =
      states.filter(
        node =>
          node?.status ===
            "FAILED"
      );

    if (failed.length) {
      const detail =
        failed
          .map(
            node =>
              node?.error
                ?.message
          )
          .filter(Boolean)
          .join("\n");

      return detail
        ? `실행 중 문제가 생겼어.\n${detail}`
        : "실행 중 문제가 생겼어.";
    }

    const reports =
      states
        .filter(
          node =>
            node?.status ===
              "SUCCESS"
        )
        .map(
          node =>
            node?.result
              ?.report ||
            node?.report
        )
        .filter(
          value =>
            typeof value ===
              "string" &&
            value.trim()
        );

    if (reports.length) {
      return reports
        .slice(-3)
        .join("\n\n");
    }

    return "실행은 끝났어. 결과는 캔버스 노드에서 확인할 수 있어.";
  }

  function collectRunArtifacts(
    run
  ) {
    const seen =
      new Set();

    return Object.values(
      run?.nodes || {}
    )
      .map(
        state =>
          state?.result
            ?.artifact ||
          state?.result
            ?.file ||
          null
      )
      .filter(
        artifact => {
          if (
            !artifact ||
            typeof artifact !==
              "object"
          ) {
            return false;
          }

          const key =
            String(
              artifact.id ||
              artifact.downloadUrl ||
              artifact.name ||
              ""
            );

          if (
            !key ||
            seen.has(key)
          ) {
            return false;
          }

          seen.add(key);
          return true;
        }
      );
  }

  function ensureArtifactFileNode(
    sourceNodeId,
    artifact
  ) {
    if (
      !artifact ||
      !state.canvas ||
      typeof state.canvas.addNode !==
        "function"
    ) {
      return null;
    }

    const artifactId =
      String(
        artifact.id || ""
      );

    if (!artifactId) {
      return null;
    }

    const existing =
      state.canvas
        .getWorkflow?.()
        ?.nodes
        ?.find(
          node =>
            node?.data
              ?.artifactId ===
            artifactId
        );

    if (existing) {
      return existing;
    }

    const source =
      state.canvas
        .getNode?.(
          String(
            sourceNodeId ||
            ""
          )
        );

    const generatedCount =
      state.canvas
        .getWorkflow?.()
        ?.nodes
        ?.filter(
          node =>
            node?.data
              ?.generated ===
              true
        )
        .length || 0;

    return state.canvas.addNode(
      "file",
      {
        expanded: false,
        ...(source
          ? {
              x:
                Number(
                  source.x || 0
                ) +
                220,
              y:
                Number(
                  source.y || 0
                ) +
                (
                  generatedCount %
                  3
                ) *
                54
            }
          : {}),
        data: {
          generated: true,
          artifactId,
          name:
            artifact.name ||
            "결과물",
          mime:
            artifact.mime ||
            "application/octet-stream",
          size:
            Number(
              artifact.size ||
              0
            ),
          format:
            artifact.format ||
            "",
          downloadUrl:
            artifact.downloadUrl ||
            "",
          previewText:
            artifact.previewText ||
            ""
        }
      }
    );
  }

  async function finalizeRuntimeRun(
    run
  ) {
    setRuntimeActivity(
      run?.status === "FAILED"
        ? "실행 결과 확인 중"
        : "결과를 정리 중"
    );

    let message = "";

    try {
      const response =
        await API.finalizeRun(
          run,
          {
            userRequest:
              state.lastUserRequest,
            memory:
              state.conversationMemory
          }
        );

      message =
        String(
          response?.message ||
          ""
        ).trim();
    } catch (error) {
      console.warn(
        "ovll runtime finalizer failed:",
        error
      );

      message =
        fallbackRuntimeMessage(
          run
        );
    }

    completeRuntimeStep(
      "__finalize__",
      {
        failed:
          run?.status ===
            "FAILED"
      }
    );

    finishRuntimeActivity({
      failed:
        run?.status ===
          "FAILED"
    });

    Presence.settle();

    if (!message) {
      return;
    }

    const finalMessage =
      addAssistantMessage(
        message,
        {
          showCanvasView:
            true,
          artifacts:
            collectRunArtifacts(
              run
            )
        }
      );

    if (finalMessage) {
      await new Promise(resolve =>
        setTimeout(
          resolve,
          revealAssistantMessage(
            finalMessage,
            message
          )
        )
      );
    }
  }

  function addSystemMessage(text) {
    const value =
      String(text ?? "").trim();

    if (!value) return null;

    return createMessage(
      "system",
      value
    );
  }

  async function copyMessage(
    message,
    button
  ) {
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
        document.createElement(
          "textarea"
        );

      textarea.value =
        value;

      textarea.style.position =
        "fixed";

      textarea.style.opacity =
        "0";

      document.body.appendChild(
        textarea
      );

      textarea.select();

      try {
        document.execCommand(
          "copy"
        );
      } catch {
        textarea.remove();
        return;
      }

      textarea.remove();
    }

    const label =
      button.querySelector(
        "span"
      );

    button.classList.add(
      "is-done"
    );

    if (label) {
      label.textContent =
        "복사됨";
    }

    setTimeout(() => {
      button.classList.remove(
        "is-done"
      );

      if (label) {
        label.textContent =
          "복사";
      }
    }, 1200);
  }

  async function retryMessage(
    message
  ) {
    if (
      state.destroyed ||
      state.busy
    ) {
      return;
    }

    let previous =
      message.previousElementSibling;

    while (previous) {
      if (
        previous.dataset.role ===
        "user"
      ) {
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
      await runPrompt(
        value,
        {
          addUserMessage:
            false
        }
      );
    } finally {
      message.classList.remove(
        "is-retrying"
      );
    }
  }

  function handleMessageClick(
    event
  ) {
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
      }

      if (
        action.dataset.action ===
        "retry"
      ) {
        retryMessage(
          message
        );
      }

      return;
    }

    const userMessage =
      event.target.closest(
        ".astra-message-user"
      );

    chatMessages
      .querySelectorAll(
        ".astra-message-user.is-actions-visible"
      )
      .forEach(item => {
        if (
          item !== userMessage
        ) {
          item.classList.remove(
            "is-actions-visible"
          );
        }
      });

    if (
      userMessage &&
      chatMessages.contains(
        userMessage
      )
    ) {
      userMessage.classList.add(
        "is-actions-visible"
      );
    }
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
    const composerHeightValue = rootComputed
      .getPropertyValue("--composer-height")
      .trim();
    const composerHeightNumber = parseFloat(composerHeightValue);
    const rootFontSize = parseFloat(rootComputed.fontSize) || 16;
    const baseComposerHeight = Number.isFinite(composerHeightNumber)
      ? composerHeightValue.endsWith("rem")
        ? composerHeightNumber * rootFontSize
        : composerHeightNumber
      : 88;
    const formHeight = composerForm.getBoundingClientRect().height;

    rootStyle.setProperty("--composer-input-height", `${height}px`);
    rootStyle.setProperty("--composer-form-height", `${formHeight}px`);
    rootStyle.setProperty("--composer-live-height", `${Math.max(baseComposerHeight, formHeight)}px`);

    composerForm.classList.toggle("is-expanded", height > inputMinHeight + 1);
  }

  function setBusy(busy) {
    state.busy = !!busy;
    composerInput.disabled = false;
    composerSubmit.disabled = state.busy;
    composerForm.classList.toggle("is-busy", state.busy);
    composerForm.setAttribute(
      "aria-busy",
      state.busy ? "true" : "false"
    );
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
      result.mode === "workflow" &&
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

    const value =
      String(text ?? "").trim();

    if (!value) return;

    state.lastUserRequest =
      value;

    if (
      options.addUserMessage !== false
    ) {
      addUserMessage(value);

      composerInput.value = "";
      resizeComposer();
    }

    setBusy(true);

    Presence.thinking();

    const thinkingStartedAt =
      performance.now();

    try {
      const result =
        await plan(value);

      const elapsed =
        performance.now() -
        thinkingStartedAt;

      const remaining =
        Math.max(
          0,
          650 - elapsed
        );

      if (remaining > 0) {
        await new Promise(resolve =>
          setTimeout(
            resolve,
            remaining
          )
        );
      }

      Presence.settle();

      if (
        result.message ||
        result.question
      ) {
        const message =
          addAssistantMessage(
            result.message ||
            "",
            {
              question:
                result.question,
              showCanvasView:
                result.mode ===
                "workflow"
            }
          );

        if (message) {
          await new Promise(resolve =>
            setTimeout(
              resolve,
              revealAssistantMessage(
                message,
                result.message || ""
              )
            )
          );
        }
      }

      syncWorkflow();
    } catch (error) {
      Presence.settle();

      console.error(
        "ovll Planner Error:",
        error
      );

      addAssistantMessage(
        error?.message ||
        "요청을 처리하지 못했습니다."
      );
    } finally {
      setBusy(false);
      focusComposerWithoutScroll();
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

  function handleComposerFileChange(event) {
    const file =
      event.target.files?.[0];

    event.target.value = "";

    if (
      !file ||
      !state.canvas ||
      typeof state.canvas.addNode !== "function"
    ) {
      return;
    }

    let previewUrl = "";

    if (
      String(file.type || "").startsWith("image/") &&
      typeof URL?.createObjectURL === "function"
    ) {
      previewUrl =
        URL.createObjectURL(file);
    }

    try {
      state.canvas.addNode(
        "file",
        {
          expanded: false,
          data: {
            name: file.name,
            mime:
              file.type ||
              "application/octet-stream",
            size: file.size || 0,
            lastModified:
              file.lastModified || 0,
            previewUrl
          }
        }
      );

      if (
        typeof UI.setMode ===
        "function"
      ) {
        UI.setMode("canvas");
      }
    } catch (error) {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }

      console.error(
        "File Node Error:",
        error
      );
    }
  }

  function handleComposerKeydown(event) {
    if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;

    event.preventDefault();

    if (state.busy) return;

    composerForm.requestSubmit();
  }

  /* =======================================================
     Demo runtime
     ======================================================= */
  function syncRuntimeConnections() {
    state.canvas
      ?.setRuntimeConnections?.(
        [...state.runtimeConnections]
      );
  }

  function clearRuntimeConnections() {
    state.runtimeConnections.clear();
    syncRuntimeConnections();
  }

  function handleRuntimeEvent(event) {
    if (!event || typeof event !== "object") {
      return;
    }

    if (event.type === "run:start") {
      clearRuntimeConnections();
      state.canvas
        ?.clearRuntimeNodeStates?.();

      beginRuntimeActivity(
        "실행 준비 중"
      );

      console.info(
        "[ovll runtime] start",
        event
      );

      return;
    }

    if (event.type === "edge:state") {
      const edgeId =
        String(
          event.edgeId || ""
        );

      if (!edgeId) {
        return;
      }

      if (event.active) {
        state.runtimeConnections.add(
          edgeId
        );
      } else {
        state.runtimeConnections.delete(
          edgeId
        );
      }

      syncRuntimeConnections();
      return;
    }

    if (event.type === "node:state") {
      state.canvas
        ?.setRuntimeNodeState?.(
          event.nodeId,
          event.state || {
            status:
              event.status,
            report:
              event.report || null
          }
        );

      if (
        event.status ===
          "RUNNING"
      ) {
        completeRuntimeStep(
          "__prepare__"
        );

        setRuntimeActivity(
          runtimeActivityText(
            event
          ),
          {
            id:
              event.nodeId
          }
        );
      } else if (
        event.status ===
          "SUCCESS"
      ) {
        const artifact =
          event.state
            ?.result
            ?.artifact ||
          event.state
            ?.result
            ?.file;

        if (
          artifact &&
          typeof artifact ===
            "object" &&
          artifact.downloadUrl
        ) {
          ensureArtifactFileNode(
            event.nodeId,
            artifact
          );
        }

        completeRuntimeStep(
          event.nodeId,
          {
            detail:
              event.report ||
              ""
          }
        );
      } else if (
        event.status ===
          "FAILED"
      ) {
        completeRuntimeStep(
          event.nodeId,
          {
            failed: true,
            detail:
              event.state?.error
                ?.message ||
              "실행 중 문제가 생겼어"
          }
        );
      } else if (
        event.status ===
          "SKIPPED"
      ) {
        completeRuntimeStep(
          event.nodeId,
          {
            skipped: true
          }
        );
      }

      console.info(
        "[ovll runtime] node",
        event
      );

      return;
    }

    if (event.type === "run:finish") {
      clearRuntimeConnections();
      state.canvas
        ?.selectNode?.(
          event.pivot
        );

      completeRuntimeStep(
        "__prepare__"
      );

      setRuntimeActivity(
        event.status === "FAILED"
          ? "실행 결과 확인 중"
          : "결과를 정리 중",
        {
          id:
            "__finalize__"
        }
      );

      console.info(
        "[ovll runtime] finish",
        event
      );
    }
  }

  async function runCanvasNode(
    nodeId,
    mode = "spread"
  ) {
    if (
      !state.canvas ||
      !state.runtime ||
      state.runtime.isRunning()
    ) {
      return null;
    }

    const workflow =
      state.canvas.getWorkflow();

    try {
      const result =
        await state.runtime.run(
          workflow,
          nodeId,
          {
            mode:
              mode === "target"
                ? "target"
                : "spread"
          }
        );

      await finalizeRuntimeRun(
        result
      );

      return result;
    } catch (error) {
      clearRuntimeConnections();

      console.error(
        "ovll runtime failed:",
        error
      );

      finishRuntimeActivity({
        failed: true
      });

      Presence.settle();

      addAssistantMessage(
        error?.message ||
        "실행 중 문제가 생겼어."
      );

      return null;
    }
  }

  function handleCanvasNodeRun(payload) {
    const nodeId =
      String(
        payload?.id || ""
      );

    if (!nodeId) {
      return;
    }

    void runCanvasNode(
      nodeId,
      "spread"
    );
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

    const localExecutor =
      new Execution.LocalNodeExecutor();

    function runtimeInputValues(
      inputs
    ) {
      return Object.values(
        inputs || {}
      )
        .flatMap(
          value =>
            Array.isArray(value)
              ? value
              : [value]
        )
        .map(
          item =>
            item?.value
        )
        .filter(
          value =>
            value !==
              undefined
        );
    }

    function beginMascotWorkSequence(
      ids
    ) {
      const nodeIds =
        Array.isArray(ids)
          ? ids
              .map(String)
              .filter(Boolean)
          : [];

      let index = 0;
      let timer = null;
      let stopped = false;

      const visit = () => {
        if (
          stopped ||
          index >=
            nodeIds.length
        ) {
          return;
        }

        Presence.workAtNode?.(
          nodeIds[index],
          true
        );

        index++;

        if (
          index <
            nodeIds.length
        ) {
          timer =
            setTimeout(
              visit,
              900
            );
        }
      };

      visit();

      return () => {
        stopped = true;
        clearTimeout(
          timer
        );

        Presence.workAtNode?.(
          nodeIds[
            Math.max(
              0,
              index - 1
            )
          ] || null,
          false
        );
      };
    }

    const runtimeExecutor = {
      async run(
        node,
        inputs,
        context
      ) {
        Presence.workAtNode?.(
          node?.id,
          true
        );

        try {
          if (
            node?.type ===
              "createFile"
          ) {
            const params =
              node?.data?.params ||
              node?.params ||
              {};

            const response =
              await API
                .createArtifact({
                  format:
                    params.format ||
                    "PDF",
                  filename:
                    params.filename ||
                    "결과물",
                  sources:
                    runtimeInputValues(
                      inputs
                    )
                });

            const artifact =
              response?.artifact;

            if (!artifact) {
              throw new Error(
                "파일 생성 결과가 없습니다."
              );
            }

            return {
              outputs: {},
              artifact,
              report:
                `${artifact.name} 생성 완료`
            };
          }

          return await localExecutor.run(
            node,
            inputs,
            context
          );
        } finally {
          Presence.workAtNode?.(
            node?.id,
            false
          );
        }
      },

      async runGroup(
        group
      ) {
        const stopMascot =
          beginMascotWorkSequence(
            group?.nodes?.map(
              node => node.id
            ) || []
          );

        try {
          const response =
            await API.executeGroup(
              group,
              {
                userRequest:
                  state.lastUserRequest,
                memory:
                  state.conversationMemory
              }
            );

          return {
            results:
              response.results
          };
        } finally {
          stopMascot();
        }
      }
    };

    state.runtime =
      new Execution.RuntimeEngine({
        executor:
          runtimeExecutor,
        onEvent:
          handleRuntimeEvent
      });

    initializeNodeBuilder();
    UI.bindCanvas(canvas);

    canvas.on("change", handleCanvasChange);
    canvas.on("workflowApplied", handleCanvasWorkflowApplied);
    canvas.on("nodeRun", handleCanvasNodeRun);

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
      <div class="canvas-node-builder-actions">
        <button id="canvas-node-builder-toggle" type="button" aria-expanded="false" aria-controls="canvas-node-builder-panel">
          <span class="canvas-node-builder-plus" aria-hidden="true">+</span>
          <span>노드</span>
        </button>
        <button id="canvas-node-builder-layout" type="button" aria-label="노드 정리하기" title="노드 정리하기">
          <span class="canvas-node-builder-layout-icon" aria-hidden="true">
            <svg viewBox="0 0 20 20" fill="none" preserveAspectRatio="xMidYMid meet">
              <rect x="3.25" y="3.25" width="4.75" height="4.75" rx="1.4"></rect>
              <rect x="12" y="3.25" width="4.75" height="4.75" rx="1.4"></rect>
              <rect x="7.625" y="12" width="4.75" height="4.75" rx="1.4"></rect>
              <path d="M8 5.625h4M5.625 8v2.125M14.375 8v2.125M8.625 12h2.75"></path>
            </svg>
          </span>
          <span>정리하기</span>
        </button>
      </div>
    `;

    document.querySelector("#canvas-page")?.appendChild(root);
    state.nodeBuilder.root = root;

    listen(root, "click", event => {
      const layout = event.target.closest("#canvas-node-builder-layout");

      if (layout) {
        event.preventDefault();

        if (
          state.canvas &&
          typeof state.canvas.layout === "function"
        ) {
          state.canvas.layout();
        }

        return;
      }

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

    syncPhysicalOrientation();
    syncAppViewport();
    setBusy(false);
    resizeComposer();

    listen(composerAttach, "click", event => {
      event.preventDefault();
      composerFileInput.click();
    });

    listen(
      composerFileInput,
      "change",
      handleComposerFileChange
    );

    listen(composerForm, "submit", handleSubmit);
    listen(chatMessages, "click", handleMessageClick);
listen(composerInput, "input", handleComposerInput);
listen(composerInput, "keydown", handleComposerKeydown);
    listen(global, "resize", resizeComposer);

    listen(global, "orientationchange", () => {
      syncPhysicalOrientation();
      resizeComposer();
    });

    if (global.screen?.orientation) {
      listen(global.screen.orientation, "change", () => {
        syncPhysicalOrientation();
        resizeComposer();
      });
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

    Presence.showStart();

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

    runNode(
      nodeId,
      mode = "spread"
    ) {
      return runCanvasNode(
        String(nodeId || ""),
        mode
      );
    },

    runTarget(nodeId) {
      return runCanvasNode(
        String(nodeId || ""),
        "target"
      );
    },

    runSpread(nodeId) {
      return runCanvasNode(
        String(nodeId || ""),
        "spread"
      );
    },

    getLastRun() {
      return state.runtime?.getLastRun?.() || null;
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

      Presence.destroy?.();

      clearRuntimeConnections();

      state.canvas = null;
      state.runtime = null;
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
      "ovll Initialization Error:",
      error
    );
    addSystemMessage(
      error?.message ||
      "오블을 초기화하지 못했습니다."
    );
  });
})(window);
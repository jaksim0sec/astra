/* =========================================================
   Astra
   API Layer
   ========================================================= */
(function (global) {
  "use strict";
  /* =======================================================
     Configuration
     ======================================================= */
  const runtime =
    global.OVLL_RUNTIME || {};
  const API_ORIGIN =
    typeof runtime.apiOrigin === "string"
      ? runtime.apiOrigin
          .trim()
          .replace(/\/+$/, "")
      : "";
  const API_PREFIX =
    `${API_ORIGIN}/api`;

  function resolveApiAssetUrl(
    value
  ) {
    const url =
      String(value || "");

    if (
      !url ||
      /^(?:https?:|blob:|data:)/i
        .test(url)
    ) {
      return url;
    }

    if (!API_ORIGIN) {
      return url;
    }

    return `${API_ORIGIN}${url.startsWith("/") ? "" : "/"}${url}`;
  }
  /* =======================================================
     Internal State
     ======================================================= */
  let nodeDefinitionsCache = null;
  let nodeDefinitionsPromise = null;
  /* =======================================================
     Request
     ======================================================= */
  async function request(
    path,
    options = {}
  ) {
    const {
      method = "GET",
      headers = {},
      body = null,
      signal,
      cache
    } = options;
    const fetchOptions = {
      method,
      headers: {
        ...(body !== null
          ? {
              "Content-Type":
                "application/json"
            }
          : {}),
        ...headers
      },
      signal,
      ...(cache !== undefined
        ? {
            cache
          }
        : {})
    };
    if (body !== null) {
      fetchOptions.body =
        JSON.stringify(body);
    }
    let response;
    try {
      response = await fetch(
        `${API_PREFIX}/${path}`,
        fetchOptions
      );
    } catch (error) {
      const networkError =
        new Error(
          "서버에 연결할 수 없습니다."
        );
      networkError.name =
        "OvllApiError";
      networkError.code =
        "NETWORK_ERROR";
      networkError.cause =
        error;
      throw networkError;
    }
    let data = null;
    try {
      data = await response.json();
    } catch {
      const parseError =
        new Error(
          "서버 응답을 읽지 못했습니다."
        );
      parseError.name =
        "OvllApiError";
      parseError.code =
        "INVALID_SERVER_RESPONSE";
      parseError.status =
        response.status;
      throw parseError;
    }
    if (
      !response.ok ||
      data?.ok === false
    ) {
      const requestError =
        new Error(
          String(
            data?.error ||
            "요청을 처리하지 못했습니다."
          )
        );
      requestError.name =
        "OvllApiError";
      requestError.code =
        String(
          data?.code ||
          "API_REQUEST_FAILED"
        );
      requestError.status =
        response.status;
      requestError.retryable =
        data?.retryable === true;
      throw requestError;
    }
    return data;
  }
  /* =======================================================
     Workflow
     ======================================================= */
  async function planWorkflow(
    text,
    workflow = null,
    memory = null,
    options = {}
  ) {
    const normalizedText =
      String(text ?? "").trim();
    if (!normalizedText) {
      throw new TypeError(
        "작업 내용을 입력해주세요."
      );
    }
    return request(
      "workflow",
      {
        method: "POST",
        body: {
          text: normalizedText,
          workflow:
            workflow ?? null,
          memory:
            memory ?? null
        },
        signal:
          options.signal
      }
    );
  }
  /* =======================================================
     Node Definitions
     ======================================================= */
  async function getNodeDefinitions(
    options = {}
  ) {
    if (
      nodeDefinitionsCache &&
      !options.force
    ) {
      return nodeDefinitionsCache;
    }
    if (
      nodeDefinitionsPromise &&
      !options.force
    ) {
      return nodeDefinitionsPromise;
    }
    nodeDefinitionsPromise =
      request(
        "node-definitions",
        {
          method: "GET",
          cache: "no-store",
          signal: options.signal
        }
      )
      .then(result => {
        if (
          !result ||
          typeof result.nodes !==
            "object" ||
          result.nodes === null ||
          Array.isArray(result.nodes)
        ) {
          throw new Error(
            "노드 정의 응답이 올바르지 않습니다."
          );
        }
        nodeDefinitionsCache =
          result.nodes;
        /*
         * 기존 코드와의 호환성을 위해
         * 전역에도 노출한다.
         */
        global.nodeDefinitions =
          nodeDefinitionsCache;
        return nodeDefinitionsCache;
      })
      .finally(() => {
        nodeDefinitionsPromise =
          null;
      });
    return nodeDefinitionsPromise;
  }
  function getNodeDefinitionSync(
    definitions,
    type
  ) {
    if (
      !definitions ||
      typeof definitions !==
        "object" ||
      Array.isArray(definitions)
    ) {
      return null;
    }
    return (
      definitions[type] ||
      null
    );
  }
  function clearNodeDefinitionsCache() {
    nodeDefinitionsCache = null;
  }
  /* =======================================================
     Definition Helpers
     ======================================================= */
  function getPortDefinition(
    definition,
    direction,
    portId
  ) {
    if (!definition) {
      return null;
    }
    const ports =
      direction === "input"
        ? (
            Array.isArray(
              definition.inputs
            )
              ? definition.inputs
              : []
          )
        : (
            Array.isArray(
              definition.outputs
            )
              ? definition.outputs
              : []
          );
    return (
      ports.find(
        port =>
          String(port?.id) ===
          String(portId)
      ) || null
    );
  }
  function getParamDefinition(
    definition,
    paramId
  ) {
    if (!definition) {
      return null;
    }
    const params =
      Array.isArray(
        definition.params
      )
        ? definition.params
        : [];
    return (
      params.find(
        param =>
          String(param?.id) ===
          String(paramId)
      ) || null
    );
  }
  function normalizeParamsFromDefinition(
    definition,
    params
  ) {
    if (
      !params ||
      typeof params !==
        "object" ||
      Array.isArray(params)
    ) {
      return {};
    }
    if (!definition) {
      return {};
    }
    const result = {};
    for (
      const [key, value] of
      Object.entries(params)
    ) {
      const definitionParam =
        getParamDefinition(
          definition,
          key
        );
      if (!definitionParam) {
        continue;
      }
      if (
        typeof value ===
        "string"
      ) {
        const trimmed =
          value.trim();
        if (trimmed) {
          result[key] =
            trimmed;
        }
        continue;
      }
      /*
       * 현재 Node Definition의
       * params는 문자열 기반이므로
       * 그 외 타입은 Canonical 값에서
       * 제외한다.
       */
    }
    return result;
  }
  /* =======================================================
     Workflow Helpers
     ======================================================= */
  function parseWorkflowEndpoint(
    value
  ) {
    if (
      typeof value !==
      "string"
    ) {
      throw new Error(
        "연결 endpoint가 문자열이 아닙니다."
      );
    }
    const dot =
      value.lastIndexOf(".");
    if (dot === -1) {
      throw new Error(
        `포트가 지정되지 않았습니다: ${value}`
      );
    }
    const node =
      value.slice(0, dot);
    const port =
      value.slice(dot + 1);
    if (!node || !port) {
      throw new Error(
        `잘못된 endpoint입니다: ${value}`
      );
    }
    return {
      node,
      port
    };
  }
  function validateWorkflowShape(
    workflow
  ) {
    if (
      !workflow ||
      typeof workflow !==
      "object" ||
      Array.isArray(workflow)
    ) {
      throw new Error(
        "워크플로우가 없습니다."
      );
    }
    if (
      !Array.isArray(
        workflow.nodes
      )
    ) {
      throw new Error(
        "workflow nodes가 배열이 아닙니다."
      );
    }
    if (
      !Array.isArray(
        workflow.links
      )
    ) {
      throw new Error(
        "workflow links가 배열이 아닙니다."
      );
    }
    if (
      !Array.isArray(
        workflow.data
      )
    ) {
      throw new Error(
        "workflow data가 배열이 아닙니다."
      );
    }
    return workflow;
  }
  /*
   * 서버에서 반환된 Workflow를
   * UI에서 안전하게 사용할 수 있도록
   * 최소한의 구조만 검사한다.
   *
   * 실제 Canvas 연결 유효성 검사는
   * canvasNode.js가 담당한다.
   */
  function validateWorkflow(
    workflow
  ) {
    validateWorkflowShape(
      workflow
    );
    for (
      const node of
      workflow.nodes
    ) {
      if (
        !node ||
        typeof node !==
        "object" ||
        typeof node.id !==
        "string" ||
        typeof node.type !==
        "string"
      ) {
        throw new Error(
          "잘못된 workflow 노드입니다."
        );
      }
    }
    return workflow;
  }
  /* =======================================================
     Execution
     ======================================================= */
  async function executeGroup(
    group,
    context = {},
    options = {}
  ) {
    if (
      !group ||
      typeof group !== "object" ||
      !Array.isArray(group.nodes) ||
      !group.nodes.length
    ) {
      throw new TypeError(
        "실행할 Gemini node group이 없습니다."
      );
    }

    const connections =
      Array.isArray(
        group.internalConnections
      )
        ? group.internalConnections
        : [];

    return request(
      "execute-group",
      {
        method: "POST",
        body: {
          nodes:
            group.nodes,
          connections,
          context: {
            userRequest:
              String(
                context.userRequest ||
                ""
              ),
            memory:
              context.memory || null
          }
        },
        signal:
          options.signal
      }
    );
  }

  async function createArtifact(
    input,
    options = {}
  ) {
    const result =
      await request(
        "create-artifact",
        {
          method: "POST",
          body: {
            format:
              input?.format,
            filename:
              input?.filename,
            sources:
              Array.isArray(
                input?.sources
              )
                ? input.sources
                : []
          },
          signal:
            options.signal
        }
      );

    if (
      result?.artifact
        ?.downloadUrl
    ) {
      result.artifact.downloadUrl =
        resolveApiAssetUrl(
          result.artifact
            .downloadUrl
        );
    }

    if (
      result?.artifact
        ?.previewUrl
    ) {
      result.artifact.previewUrl =
        resolveApiAssetUrl(
          result.artifact
            .previewUrl
        );
    }

    return result;
  }

  async function finalizeRun(
    run,
    context = {},
    options = {}
  ) {
    if (
      !run ||
      typeof run !== "object"
    ) {
      throw new TypeError(
        "정리할 실행 결과가 없습니다."
      );
    }

    return request(
      "finalize-run",
      {
        method: "POST",
        body: {
          run,
          userRequest:
            String(
              context.userRequest ||
              ""
            ),
          memory:
            context.memory || null
        },
        signal:
          options.signal
      }
    );
  }

  async function execute(
    workflow,
    options = {}
  ) {
    validateWorkflow(
      workflow
    );

    throw new Error(
      "전체 Workflow 실행 API 대신 RuntimeEngine group 실행을 사용합니다."
    );
  }

  /* =======================================================
     Public API
     ======================================================= */
  const api = Object.freeze({
    request,
    planWorkflow,
    executeGroup,
    createArtifact,
    finalizeRun,
    execute,
    getNodeDefinitions,
    getNodeDefinitionSync,
    getPortDefinition,
    getParamDefinition,
    normalizeParamsFromDefinition,
    parseWorkflowEndpoint,
    validateWorkflowShape,
    validateWorkflow,
    clearNodeDefinitionsCache
  });
  global.AstraAPI = api;
})(window);
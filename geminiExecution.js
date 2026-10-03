const INTERACTIONS_URL =
  "https://generativelanguage.googleapis.com/v1beta/interactions";

export const DEFAULT_GEMINI_MODEL =
  "gemini-3.5-flash-lite";

export const DEFAULT_GEMINI_FALLBACK_MODEL =
  "gemini-3.1-flash-lite";

const DEFAULT_MAX_GROUP_NODES = 6;
const DEFAULT_MAX_INPUT_CHARS = 60000;
const DEFAULT_MAX_ATTEMPTS = 3;

const GEMINI_NODE_TYPES =
  new Set([
    "research",
    "organize",
    "judge",
    "write",
    "convert"
  ]);

const THINKING_LEVELS =
  new Set([
    "minimal",
    "low",
    "medium",
    "high"
  ]);

const NODE_INSTRUCTIONS = {
  research:
    "Analyze the supplied material according to params.topic/filter. If no web or search tool is provided, use only supplied material and general model knowledge. Never fabricate citations or claim live browsing occurred.",
  organize:
    "Transform the available input according to params.criteria and params.format. Preserve important facts and do not introduce unsupported claims.",
  write:
    "Produce directly usable content using params.title/style/length/about and available upstream material. Do not discuss how to write it unless requested by the node params.",
  convert:
    "Convert the available material according to params.instruction while preserving meaning unless the instruction explicitly requests transformation.",
  judge:
    "Evaluate params.condition against the available input. Set decision to a boolean. Put useful branch data on the matching true or false output."
};

const SYSTEM_INSTRUCTION = [
  "You execute a fixed workflow segment for ovll.",
  "The graph and node order are already decided by the runtime.",
  "Execute every supplied node exactly once and in the supplied order.",
  "Do not add, remove, reorder, rename, or skip nodes.",
  "Each node consumes its declared inputs plus outputs produced by earlier nodes in this same group when connected.",
  "Follow each node type and params precisely.",
  "Return only the schema-conforming result.",
  "Keep outputs useful for the next node instead of explaining your process.",
  "Do not include chain-of-thought, hidden reasoning, markdown fences, or commentary.",
  "For judge nodes, make a boolean decision from the condition and available input. Do not decide graph traversal yourself.",
  "If information is missing, use only reasonable transformations supported by supplied inputs, params, and general model knowledge. Do not invent external facts or pretend live research occurred."
].join("\n");

function isPlainObject(value) {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function clone(value) {
  if (value === undefined) {
    return undefined;
  }

  return JSON.parse(
    JSON.stringify(value)
  );
}

function positiveInteger(
  value,
  fallback
) {
  const number =
    Number(value);

  return (
    Number.isInteger(number) &&
    number > 0
      ? number
      : fallback
  );
}

function normalizeThinkingLevel(
  value
) {
  const normalized =
    String(
      value || "minimal"
    )
      .trim()
      .toLowerCase();

  return THINKING_LEVELS.has(
    normalized
  )
    ? normalized
    : "minimal";
}

export class GeminiExecutionError
  extends Error {
  constructor(
    message,
    options = {}
  ) {
    super(message);
    this.name =
      "GeminiExecutionError";
    this.code =
      options.code ||
      "GEMINI_EXECUTION_ERROR";
    this.status =
      options.status ??
      null;
    this.retryable =
      options.retryable === true;
    this.fallbackEligible =
      options.fallbackEligible ===
      true;
    this.semantic =
      options.semantic === true;
  }
}

function compactConnection(
  connection
) {
  return {
    fromNode:
      String(
        connection?.from?.node ||
        connection?.fromNode ||
        ""
      ),
    fromPort:
      String(
        connection?.from?.port ||
        connection?.fromPort ||
        ""
      ),
    toNode:
      String(
        connection?.to?.node ||
        connection?.toNode ||
        ""
      ),
    toPort:
      String(
        connection?.to?.port ||
        connection?.toPort ||
        ""
      ),
    kind:
      connection?.data?.kind ===
        "data" ||
      connection?.kind === "data"
        ? "data"
        : "flow"
  };
}

export function validateExecutionGroup(
  input,
  options = {}
) {
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input)
  ) {
    throw new GeminiExecutionError(
      "Gemini execution group이 필요합니다.",
      {
        code:
          "INVALID_EXECUTION_GROUP"
      }
    );
  }

  const maxNodes =
    positiveInteger(
      options.maxNodes,
      DEFAULT_MAX_GROUP_NODES
    );

  const maxInputChars =
    positiveInteger(
      options.maxInputChars,
      DEFAULT_MAX_INPUT_CHARS
    );

  if (
    !Array.isArray(input.nodes) ||
    !input.nodes.length ||
    input.nodes.length > maxNodes
  ) {
    throw new GeminiExecutionError(
      `Gemini execution group node count must be 1..${maxNodes}.`,
      {
        code:
          "INVALID_EXECUTION_GROUP"
      }
    );
  }

  const ids =
    new Set();

  const nodes =
    input.nodes.map(
      rawNode => {
        const id =
          String(
            rawNode?.id || ""
          ).trim();

        const type =
          String(
            rawNode?.type || ""
          ).trim();

        if (
          !id ||
          ids.has(id)
        ) {
          throw new GeminiExecutionError(
            "Gemini execution group node ID가 올바르지 않습니다.",
            {
              code:
                "INVALID_EXECUTION_GROUP"
            }
          );
        }

        if (
          !GEMINI_NODE_TYPES.has(
            type
          )
        ) {
          throw new GeminiExecutionError(
            `Gemini에서 실행할 수 없는 node type입니다: ${type}`,
            {
              code:
                "UNSUPPORTED_GEMINI_NODE"
            }
          );
        }

        ids.add(id);

        return {
          id,
          type,
          params:
            isPlainObject(
              rawNode.params
            )
              ? clone(
                  rawNode.params
                )
              : {},
          inputs:
            isPlainObject(
              rawNode.inputs
            )
              ? clone(
                  rawNode.inputs
                )
              : {}
        };
      }
    );

  const connections =
    (
      Array.isArray(
        input.connections
      )
        ? input.connections
        : Array.isArray(
            input.internalConnections
          )
          ? input.internalConnections
          : []
    )
      .map(
        compactConnection
      );

  for (
    const connection
      of connections
  ) {
    if (
      !ids.has(
        connection.fromNode
      ) ||
      !ids.has(
        connection.toNode
      ) ||
      !connection.fromPort ||
      !connection.toPort
    ) {
      throw new GeminiExecutionError(
        "Gemini execution group connection이 올바르지 않습니다.",
        {
          code:
            "INVALID_EXECUTION_GROUP"
        }
      );
    }
  }

  const normalized = {
    nodes,
    connections
  };

  if (
    JSON.stringify(
      normalized
    ).length >
    maxInputChars
  ) {
    throw new GeminiExecutionError(
      "Gemini execution group is too large.",
      {
        code:
          "GEMINI_GROUP_TOO_LARGE"
      }
    );
  }

  return normalized;
}

export function buildGroupResponseSchema(
  nodes
) {
  const count =
    nodes.length;

  return {
    type: "object",
    properties: {
      results: {
        type: "array",
        minItems: count,
        maxItems: count,
        items: {
          type: "object",
          properties: {
            nodeId: {
              type: "string"
            },
            outputs: {
              type: "object",
              additionalProperties:
                true
            },
            decision: {
              type: [
                "boolean",
                "null"
              ]
            },
            report: {
              type: "string"
            }
          },
          required: [
            "nodeId",
            "outputs",
            "decision",
            "report"
          ],
          additionalProperties:
            false
        }
      }
    },
    required: [
      "results"
    ],
    additionalProperties:
      false
  };
}

function compactPromptGroup(
  group
) {
  return {
    nodes:
      group.nodes.map(
        node => ({
          id:
            node.id,
          type:
            node.type,
          params:
            node.params,
          inputs:
            node.inputs,
          instruction:
            NODE_INSTRUCTIONS[
              node.type
            ]
        })
      ),
    connections:
      group.connections
  };
}

export function buildInteractionRequest(
  group,
  options = {}
) {
  const model =
    String(
      options.model ||
      DEFAULT_GEMINI_MODEL
    ).trim();

  const thinkingLevel =
    normalizeThinkingLevel(
      options.thinkingLevel
    );

  let input =
    JSON.stringify(
      compactPromptGroup(
        group
      )
    );

  if (
    options.repairError
  ) {
    input +=
      "\n<REPAIR>Previous output failed semantic validation: " +
      String(
        options.repairError
      ).slice(
        0,
        600
      ) +
      ". Return a completely corrected result for the same nodes in exactly the requested order.</REPAIR>";
  }

  return {
    model,
    input,
    system_instruction:
      SYSTEM_INSTRUCTION,
    generation_config: {
      thinking_level:
        thinkingLevel
    },
    response_format: {
      type: "text",
      mime_type:
        "application/json",
      schema:
        buildGroupResponseSchema(
          group.nodes
        )
    },
    store: false
  };
}

export function extractInteractionText(
  payload
) {
  if (
    typeof payload?.output_text ===
      "string" &&
    payload.output_text.trim()
  ) {
    return payload.output_text;
  }

  const chunks = [];

  for (
    const step
      of payload?.steps || []
  ) {
    if (
      step?.type !==
      "model_output"
    ) {
      continue;
    }

    for (
      const content
        of step.content || []
    ) {
      if (
        content?.type ===
          "text" &&
        typeof content.text ===
          "string"
      ) {
        chunks.push(
          content.text
        );
      }
    }
  }

  return chunks.join("");
}

export function normalizeUsage(
  usage
) {
  return {
    inputTokens:
      Number.isFinite(
        Number(
          usage?.total_input_tokens
        )
      )
        ? Number(
            usage
              .total_input_tokens
          )
        : null,
    outputTokens:
      Number.isFinite(
        Number(
          usage
            ?.total_output_tokens
        )
      )
        ? Number(
            usage
              .total_output_tokens
          )
        : null,
    totalTokens:
      Number.isFinite(
        Number(
          usage?.total_tokens
        )
      )
        ? Number(
            usage.total_tokens
          )
        : null
  };
}

export function validateGroupResults(
  payload,
  nodes
) {
  if (
    !isPlainObject(payload) ||
    !Array.isArray(
      payload.results
    ) ||
    payload.results.length !==
      nodes.length
  ) {
    throw new GeminiExecutionError(
      "Gemini result count does not match requested nodes.",
      {
        code:
          "INVALID_GEMINI_RESULT",
        semantic: true
      }
    );
  }

  const seen =
    new Set();

  const results =
    payload.results.map(
      (item, index) => {
        const expected =
          nodes[index];

        const nodeId =
          String(
            item?.nodeId || ""
          );

        if (
          nodeId !==
            expected.id ||
          seen.has(nodeId)
        ) {
          throw new GeminiExecutionError(
            "Gemini result nodeId/order does not match requested nodes.",
            {
              code:
                "INVALID_GEMINI_RESULT",
              semantic: true
            }
          );
        }

        seen.add(nodeId);

        if (
          !isPlainObject(
            item.outputs
          )
        ) {
          throw new GeminiExecutionError(
            `Gemini result outputs must be an object: ${nodeId}`,
            {
              code:
                "INVALID_GEMINI_RESULT",
              semantic: true
            }
          );
        }

        if (
          expected.type ===
            "judge" &&
          typeof item.decision !==
            "boolean"
        ) {
          throw new GeminiExecutionError(
            `judge node requires boolean decision: ${nodeId}`,
            {
              code:
                "INVALID_GEMINI_RESULT",
              semantic: true
            }
          );
        }

        if (
          expected.type !==
            "judge" &&
          item.decision !== null
        ) {
          throw new GeminiExecutionError(
            `non-judge node decision must be null: ${nodeId}`,
            {
              code:
                "INVALID_GEMINI_RESULT",
              semantic: true
            }
          );
        }

        if (
          typeof item.report !==
            "string"
        ) {
          throw new GeminiExecutionError(
            `Gemini result report must be a string: ${nodeId}`,
            {
              code:
                "INVALID_GEMINI_RESULT",
              semantic: true
            }
          );
        }

        return {
          nodeId,
          outputs:
            clone(
              item.outputs
            ),
          decision:
            expected.type ===
              "judge"
              ? item.decision
              : null,
          report:
            item.report
        };
      }
    );

  return results;
}

function retryAfterMs(
  response,
  now = Date.now()
) {
  const value =
    response?.headers?.get?.(
      "retry-after"
    );

  if (!value) {
    return null;
  }

  const seconds =
    Number(value);

  if (
    Number.isFinite(seconds) &&
    seconds >= 0
  ) {
    return Math.round(
      seconds * 1000
    );
  }

  const timestamp =
    Date.parse(value);

  if (
    Number.isFinite(timestamp)
  ) {
    return Math.max(
      0,
      timestamp - now
    );
  }

  return null;
}

function errorMessageFromBody(
  body,
  fallback
) {
  if (
    isPlainObject(body) &&
    typeof body?.error?.message ===
      "string"
  ) {
    return body.error.message;
  }

  return fallback;
}

function isModelUnavailable(
  status,
  message
) {
  if (status === 404) {
    return true;
  }

  if (status !== 400) {
    return false;
  }

  return /model|unsupported|not found|not available/i
    .test(
      String(message || "")
    );
}

async function readResponseJson(
  response
) {
  const text =
    await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new GeminiExecutionError(
      "Gemini returned invalid JSON.",
      {
        code:
          "INVALID_GEMINI_RESPONSE",
        retryable:
          response.status >= 500,
        fallbackEligible:
          response.status >= 500
      }
    );
  }
}

export function createGeminiExecution(
  options = {}
) {
  const apiKey =
    String(
      options.apiKey ??
      process.env.GEMINI_API_KEY ??
      ""
    ).trim();

  const model =
    String(
      options.model ??
      process.env.GEMINI_MODEL ??
      DEFAULT_GEMINI_MODEL
    ).trim() ||
    DEFAULT_GEMINI_MODEL;

  const fallbackModel =
    String(
      options.fallbackModel ??
      process.env
        .GEMINI_FALLBACK_MODEL ??
      DEFAULT_GEMINI_FALLBACK_MODEL
    ).trim();

  const thinkingLevel =
    normalizeThinkingLevel(
      options.thinkingLevel ??
      process.env
        .GEMINI_THINKING_LEVEL
    );

  const maxNodes =
    positiveInteger(
      options.maxNodes ??
      process.env
        .GEMINI_MAX_GROUP_NODES,
      DEFAULT_MAX_GROUP_NODES
    );

  const maxInputChars =
    positiveInteger(
      options.maxInputChars ??
      process.env
        .GEMINI_MAX_GROUP_INPUT_CHARS,
      DEFAULT_MAX_INPUT_CHARS
    );

  const maxAttempts =
    positiveInteger(
      options.maxAttempts,
      DEFAULT_MAX_ATTEMPTS
    );

  const fetchImpl =
    options.fetchImpl ||
    globalThis.fetch;

  const sleepImpl =
    options.sleepImpl ||
    (
      ms =>
        new Promise(
          resolve =>
            setTimeout(
              resolve,
              ms
            )
        )
    );

  const random =
    typeof options.random ===
      "function"
      ? options.random
      : Math.random;

  if (
    typeof fetchImpl !==
      "function"
  ) {
    throw new GeminiExecutionError(
      "fetch implementation is unavailable.",
      {
        code:
          "GEMINI_FETCH_UNAVAILABLE"
      }
    );
  }

  async function requestOnce(
    group,
    selectedModel,
    repairError = ""
  ) {
    const request =
      buildInteractionRequest(
        group,
        {
          model:
            selectedModel,
          thinkingLevel,
          repairError
        }
      );

    let response;

    try {
      response =
        await fetchImpl(
          INTERACTIONS_URL,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
              "x-goog-api-key":
                apiKey
            },
            body:
              JSON.stringify(
                request
              )
          }
        );
    } catch (error) {
      throw new GeminiExecutionError(
        error?.message ||
        "Gemini network request failed.",
        {
          code:
            "GEMINI_NETWORK_ERROR",
          retryable: true,
          fallbackEligible:
            true
        }
      );
    }

    const body =
      await readResponseJson(
        response
      );

    if (!response.ok) {
      const message =
        errorMessageFromBody(
          body,
          `Gemini API error: ${response.status}`
        );

      const unavailable =
        isModelUnavailable(
          response.status,
          message
        );

      throw new GeminiExecutionError(
        message,
        {
          code:
            unavailable
              ? "GEMINI_MODEL_UNAVAILABLE"
              : "GEMINI_API_ERROR",
          status:
            response.status,
          retryable:
            response.status ===
              429 ||
            response.status >= 500,
          fallbackEligible:
            unavailable ||
            response.status ===
              429 ||
            response.status >= 500
        }
      );
    }

    if (
      body?.status &&
      body.status !==
        "completed"
    ) {
      throw new GeminiExecutionError(
        `Gemini interaction did not complete: ${body.status}`,
        {
          code:
            "GEMINI_INCOMPLETE",
          retryable:
            body.status ===
              "failed" ||
            body.status ===
              "incomplete",
          fallbackEligible:
            body.status ===
              "failed"
        }
      );
    }

    const text =
      extractInteractionText(
        body
      );

    if (!text.trim()) {
      throw new GeminiExecutionError(
        "Gemini returned an empty result.",
        {
          code:
            "INVALID_GEMINI_RESULT",
          semantic: true
        }
      );
    }

    let parsed;

    try {
      parsed =
        JSON.parse(text);
    } catch {
      throw new GeminiExecutionError(
        "Gemini structured output was not valid JSON.",
        {
          code:
            "INVALID_GEMINI_RESULT",
          semantic: true
        }
      );
    }

    const results =
      validateGroupResults(
        parsed,
        group.nodes
      );

    return {
      model:
        String(
          body?.model ||
          selectedModel
        ),
      usage:
        normalizeUsage(
          body?.usage
        ),
      results
    };
  }

  async function executeWithModel(
    group,
    selectedModel
  ) {
    let lastError = null;
    let repairError = "";
    let repairUsed = false;

    for (
      let attempt = 0;
      attempt < maxAttempts;
      attempt++
    ) {
      try {
        return await requestOnce(
          group,
          selectedModel,
          repairError
        );
      } catch (error) {
        const normalized =
          error instanceof
            GeminiExecutionError
            ? error
            : new GeminiExecutionError(
                error?.message ||
                String(error)
              );

        lastError =
          normalized;

        if (
          normalized.semantic
        ) {
          if (
            !repairUsed &&
            attempt + 1 <
              maxAttempts
          ) {
            repairUsed = true;
            repairError =
              normalized.message;
            continue;
          }

          throw normalized;
        }

        if (
          normalized.code ===
            "GEMINI_MODEL_UNAVAILABLE"
        ) {
          throw normalized;
        }

        if (
          !normalized.retryable ||
          attempt + 1 >=
            maxAttempts
        ) {
          throw normalized;
        }

        const retryMs =
          normalized.status ===
            429
            ? null
            : null;

        let delay =
          retryMs;

        if (
          normalized.status ===
            429
        ) {
          /*
           * The actual response object is not retained in the
           * normalized error, so Retry-After is handled below
           * by requestWithRetry metadata in the response path.
           */
        }

        delay =
          delay ??
          (
            750 *
            (2 ** attempt) +
            Math.floor(
              random() * 250
            )
          );

        await sleepImpl(
          delay
        );
      }
    }

    throw (
      lastError ||
      new GeminiExecutionError(
        "Gemini execution failed."
      )
    );
  }

  /*
   * Retry-After needs access to the HTTP response. Wrap fetch so
   * requestOnce can expose it through a one-shot hint without
   * leaking the response body to callers.
   */
  const originalFetch =
    fetchImpl;

  let retryAfterHint =
    null;

  async function fetchWithRetryHint(
    ...args
  ) {
    const response =
      await originalFetch(
        ...args
      );

    retryAfterHint =
      retryAfterMs(
        response
      );

    return response;
  }

  /*
   * requestOnce closes over fetchImpl. Rebind through a small
   * execution-local adapter by using the wrapped fetch in calls.
   */
  const requestFetch =
    options.fetchImpl
      ? fetchWithRetryHint
      : fetchWithRetryHint;

  async function executeModel(
    group,
    selectedModel
  ) {
    let lastError = null;
    let repairError = "";
    let repairUsed = false;

    for (
      let attempt = 0;
      attempt < maxAttempts;
      attempt++
    ) {
      retryAfterHint =
        null;

      const request =
        buildInteractionRequest(
          group,
          {
            model:
              selectedModel,
            thinkingLevel,
            repairError
          }
        );

      let response;

      try {
        response =
          await requestFetch(
            INTERACTIONS_URL,
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
                "x-goog-api-key":
                  apiKey
              },
              body:
                JSON.stringify(
                  request
                )
            }
          );
      } catch (error) {
        lastError =
          new GeminiExecutionError(
            error?.message ||
            "Gemini network request failed.",
            {
              code:
                "GEMINI_NETWORK_ERROR",
              retryable: true,
              fallbackEligible:
                true
            }
          );

        if (
          attempt + 1 >=
            maxAttempts
        ) {
          throw lastError;
        }

        await sleepImpl(
          750 *
          (2 ** attempt) +
          Math.floor(
            random() * 250
          )
        );

        continue;
      }

      const body =
        await readResponseJson(
          response
        );

      if (!response.ok) {
        const message =
          errorMessageFromBody(
            body,
            `Gemini API error: ${response.status}`
          );

        const unavailable =
          isModelUnavailable(
            response.status,
            message
          );

        lastError =
          new GeminiExecutionError(
            message,
            {
              code:
                unavailable
                  ? "GEMINI_MODEL_UNAVAILABLE"
                  : "GEMINI_API_ERROR",
              status:
                response.status,
              retryable:
                response.status ===
                  429 ||
                response.status >=
                  500,
              fallbackEligible:
                unavailable ||
                response.status ===
                  429 ||
                response.status >=
                  500
            }
          );

        if (unavailable) {
          throw lastError;
        }

        if (
          !lastError.retryable ||
          attempt + 1 >=
            maxAttempts
        ) {
          throw lastError;
        }

        await sleepImpl(
          retryAfterHint ??
          (
            750 *
            (2 ** attempt) +
            Math.floor(
              random() * 250
            )
          )
        );

        continue;
      }

      if (
        body?.status &&
        body.status !==
          "completed"
      ) {
        lastError =
          new GeminiExecutionError(
            `Gemini interaction did not complete: ${body.status}`,
            {
              code:
                "GEMINI_INCOMPLETE",
              retryable:
                body.status ===
                  "failed" ||
                body.status ===
                  "incomplete",
              fallbackEligible:
                body.status ===
                  "failed"
            }
          );

        if (
          lastError.retryable &&
          attempt + 1 <
            maxAttempts
        ) {
          await sleepImpl(
            750 *
            (2 ** attempt) +
            Math.floor(
              random() * 250
            )
          );
          continue;
        }

        throw lastError;
      }

      try {
        const text =
          extractInteractionText(
            body
          );

        if (!text.trim()) {
          throw new GeminiExecutionError(
            "Gemini returned an empty result.",
            {
              code:
                "INVALID_GEMINI_RESULT",
              semantic: true
            }
          );
        }

        const parsed =
          JSON.parse(text);

        const results =
          validateGroupResults(
            parsed,
            group.nodes
          );

        return {
          model:
            String(
              body?.model ||
              selectedModel
            ),
          usage:
            normalizeUsage(
              body?.usage
            ),
          results
        };
      } catch (error) {
        lastError =
          error instanceof
            GeminiExecutionError
            ? error
            : new GeminiExecutionError(
                "Gemini structured output was not valid JSON.",
                {
                  code:
                    "INVALID_GEMINI_RESULT",
                  semantic: true
                }
              );

        if (
          lastError.semantic &&
          !repairUsed &&
          attempt + 1 <
            maxAttempts
        ) {
          repairUsed = true;
          repairError =
            lastError.message;
          continue;
        }

        throw lastError;
      }
    }

    throw (
      lastError ||
      new GeminiExecutionError(
        "Gemini execution failed."
      )
    );
  }

  async function executeGroup(
    input
  ) {
    if (!apiKey) {
      throw new GeminiExecutionError(
        "GEMINI_API_KEY가 설정되지 않았습니다.",
        {
          code:
            "GEMINI_API_KEY_MISSING"
        }
      );
    }

    const group =
      validateExecutionGroup(
        input,
        {
          maxNodes,
          maxInputChars
        }
      );

    const models =
      [
        model,
        fallbackModel
      ]
        .filter(Boolean)
        .filter(
          (
            value,
            index,
            list
          ) =>
            list.indexOf(value) ===
            index
        );

    let lastError =
      null;

    for (
      let index = 0;
      index < models.length;
      index++
    ) {
      try {
        return await executeModel(
          group,
          models[index]
        );
      } catch (error) {
        lastError =
          error;

        if (
          index + 1 >=
            models.length ||
          !error
            ?.fallbackEligible
        ) {
          throw error;
        }
      }
    }

    throw (
      lastError ||
      new GeminiExecutionError(
        "Gemini execution failed."
      )
    );
  }

  return {
    executeGroup,
    config: {
      model,
      fallbackModel,
      thinkingLevel,
      maxNodes,
      maxInputChars,
      maxAttempts
    }
  };
}

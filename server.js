import 'dotenv/config';
import express from 'express';
import compression from 'compression';
import path from 'path';
import {fileURLToPath} from 'url';

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(
  express.json({
    limit: '1mb'
  })
);

app.use(compression());

const PORT =
  process.env.PORT ||
  3000;

const htmlRoutes = {
  '/home': 'index.html'
};

/* =========================================================
   CANONICAL NODE DEFINITION
========================================================= */

const defaultNodeDef = {

  start: {
    name: '시작하기',
    desc: 'AI 작업을 시작하는 기준점입니다.',
    llmdesc: 'workflow의 실행 흐름의 origin임',
    tag: 'START',
    color: '#10B981',

    icon: `
      <svg viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="6.5"
          stroke="currentColor" stroke-width="1.45"/>
        <path d="M10 13.2V7"
          stroke="currentColor" stroke-width="1.55"
          stroke-linecap="round"/>
        <path d="M7.8 9.1L10 7l2.2 2.1"
          stroke="currentColor" stroke-width="1.55"
          stroke-linecap="round"
          stroke-linejoin="round"/>
      </svg>
    `,

    inputs: [],

    outputs: [
      {
        id: 'out',
        name: '실행 방향',
        type: 'any',
        required: false,
        multiple: true,
        accepts: ['any']
      }
    ]
  },

  research: {
    name: '조사하기',
    desc: '필요한 정보를 찾아 수집합니다.',
    llmdesc: '추가적으로 필요한 "외부" 정보를 조사함. 입력 자료가 있으면 이를 참고하여 추가 조사가 가능.',
    tag: 'RESEARCH',
    color: '#3B82F6',

    icon: `
      <svg viewBox="0 0 20 20" fill="none">
        <circle cx="8" cy="8" r="5"
          stroke="currentColor" stroke-width="1.55"/>
        <path d="M11.6 11.6L15.8 15.8"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linecap="round"/>
      </svg>
    `,

    params: [
      {
        id: 'topic',
        name: '주제',
        placeholder: '조사할 주제',
        default: '생성형 AI 시장'
      },
      {
        id: 'filter',
        name: '조건',
        placeholder: '조사 조건',
        default: '최근 3년'
      }
    ],

    inputs: [
      {
        id: 'in',
        name: '연결',
        type: 'any',
        required: false,
        multiple: true,
        accepts: ['any']
      }
    ],

    outputs: [
      {
        id: 'result',
        name: '결과',
        type: 'research',
        required: false,
        multiple: true,
        accepts: ['research', 'any']
      }
    ]
  },

  organize: {
    name: '정리하기',
    desc: '자료를 기준에 따라 구조화합니다.',
    llmdesc: '입력된 자료를 기준에 따라 정리/구조화함',
    tag: 'ORGANIZE',
    color: '#F59E0B',

    icon: `
      <svg viewBox="0 0 20 20" fill="none">
        <path d="M4 5h12M4 10h12M4 15h8"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linecap="round"/>
      </svg>
    `,

    params: [
      {
        id: 'criteria',
        name: '정리 기준',
        placeholder: '정리할 기준',
        default: '시장 규모 / 주요 기업'
      },
      {
        id: 'format',
        name: '출력 형식',
        placeholder: '예: 표, 목록, 문단',
        default: '표'
      }
    ],

    inputs: [
      {
        id: 'in',
        name: '데이터',
        type: 'any',
        required: false,
        multiple: true,
        accepts: ['any']
      }
    ],

    outputs: [
      {
        id: 'result',
        name: '결과',
        type: 'structured',
        required: false,
        multiple: true,
        accepts: ['structured', 'any']
      }
    ]
  },

  judge: {
    name: '판단하기',
    desc: `'조건을 판단하고 참 또는 거짓 경로로 데이터를 전달합니다.'`,
    llmdesc: '참자료→참출구, 거짓자료→거짓출구로 자료, 실행 흐름이 연결됨. 그리고 condition 가 참이면 참출구만, 아니면 거짓출구만 열리며, 동시에 두개가 열리는 상황은 없음.',
    tag: 'JUDGE',
    color: '#8B5CF6',

    icon: `
      <svg viewBox="0 0 20 20" fill="none">
        <path
          d="M10 3
             L11.5 8.5
             L17 10
             L11.5 11.5
             L10 17
             L8.5 11.5
             L3 10
             L8.5 8.5
             Z"
          stroke="currentColor" stroke-width="1.45"
          stroke-linecap="round"
          stroke-linejoin="round"/>
      </svg>
    `,

    params: [
      {
        id: 'condition',
        name: '조건',
        placeholder: '판단 조건',
        default: '일치도 ≥ 70%'
      }
    ],

    inputs: [
      {
        id: 'true',
        name: '참 자료',
        type: 'any',
        required: false,
        multiple: true,
        accepts: ['any']
      },
      {
        id: 'false',
        name: '거짓 자료',
        type: 'any',
        required: false,
        multiple: true,
        accepts: ['any']
      }
    ],

    outputs: [
      {
        id: 'true',
        name: '참 출구',
        type: 'decision',
        required: false,
        multiple: true,
        accepts: ['decision', 'any']
      },
      {
        id: 'false',
        name: '거짓 출구',
        type: 'decision',
        required: false,
        multiple: true,
        accepts: ['decision', 'any']
      }
    ]
  },

  write: {
    name: '작성하기',
    desc: '주어진 정보를 글 형태로 작성합니다.',
    llmdesc: '입력된 자료를 바탕으로 문서를 작성함. 제목 분량,스타일,내용 parameter를 통해 특성을 조정함.정리가 필요한 경우, 작성후 정리 보다 정리후 작성이 바람직함.',
    tag: 'WRITE',
    color: '#EF4444',

    icon: `
      <svg viewBox="0 0 20 20" fill="none">
        <path
          d="M5.1 14.9L6.2 11.8L13.1 4.9
             C13.7 4.3 14.7 4.3 15.3 4.9
             L16 5.6C16.6 6.2 16.6 7.2 16 7.8
             L9.1 14.7L5.1 14.9Z"
          stroke="currentColor" stroke-width="1.45"
          stroke-linejoin="round"/>
        <path d="M12.4 5.6L15.1 8.3"
          stroke="currentColor" stroke-width="1.35"
          stroke-linecap="round"/>
        <path d="M5.1 14.9L7.9 14.2"
          stroke="currentColor" stroke-width="1.45"
          stroke-linecap="round"/>
      </svg>
    `,

    params: [
      {
        id: 'title',
        name: '제목',
        placeholder: '문서 제목',
        default: 'AI 기술 보고서'
      },
      {
        id: 'length',
        name: '분량',
        placeholder: '예: 2페이지',
        default: '2페이지'
      },
      {
        id: 'style',
        name: '스타일',
        placeholder: '예: 전문적, 간결한',
        default: '전문적'
      },
      {
        id: 'about',
        name: '내용',
        placeholder: '예: 관련 데이터에 대하여 서술',
        default: ''
      }
    ],

    inputs: [
      {
        id: 'in',
        name: '자료',
        type: 'any',
        required: false,
        multiple: true,
        accepts: ['any']
      }
    ],

    outputs: [
      {
        id: 'result',
        name: '결과',
        type: 'document',
        required: false,
        multiple: true,
        accepts: ['document', 'any']
      }
    ]
  },

  convert: {
    name: '변형하기',
    desc: '자료의 형식이나 스타일을 변형합니다.',
    llmdesc: '입력된 자료를 필요한 형식이나 스타일로 변환함.',
    tag: 'CONVERT',
    color: '#EC4899',

    icon: `
      <svg viewBox="0 0 20 20" fill="none">
        <path d="M4 6.5H14.5"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"/>
        <path d="M11.8 3.9L14.5 6.5L11.8 9.1"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"/>
        <path d="M16 13.5H5.5"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"/>
        <path d="M8.2 10.9L5.5 13.5L8.2 16.1"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"/>
      </svg>
    `,

    params: [
      {
        id: 'instruction',
        name: '변형 방식',
        placeholder: '어떻게 변형할까요?',
        default: '표로 바꿔줘'
      }
    ],

    inputs: [
      {
        id: 'in',
        name: '자료',
        type: 'any',
        required: false,
        multiple: true,
        accepts: ['any']
      }
    ],

    outputs: [
      {
        id: 'result',
        name: '결과',
        type: 'any',
        required: false,
        multiple: true,
        accepts: ['any']
      }
    ]
  },

  file: {
    name: '파일추가하기',
    desc: '작업에 사용할 파일을 추가합니다.',
    llmdesc: '사용자가 제공한 파일을 워크플로우에 입력함. 파일 자체를 생성하거나 변환하는 노드가 아님. 연결이 있어야만 실제로 참조가 가능.',
    tag: 'INPUT',
    color: '#64748B',

    icon: `
      <svg viewBox="0 0 20 20" fill="none">
        <path
          d="M7.2 10.8
             l4.7-4.7
             a2.55 2.55 0 0 1 3.6 3.6
             l-5.9 5.9
             a4.05 4.05 0 0 1-5.7-5.7
             l6-6"
          stroke="currentColor"
          stroke-width="1.55"
          stroke-linecap="round"
          stroke-linejoin="round"/>
      </svg>
    `,

    // 파일은 source-only node
    inputs: [],

    outputs: [
      {
        id: 'file',
        name: '전달',
        type: 'file',
        required: false,
        multiple: true,
        accepts: ['file', 'any']
      }
    ]
  },

  createFile: {
    name: '내보내기',
    desc: '완성된 결과물을 파일로 생성합니다.',
    llmdesc: '입력된 결과물을 지정한 파일 형식으로 내보내는 최종 출력 노드임. 파일 형식과 파일명을 지정하여 결과 파일을 생성함.질문에 대한 답변과 같은 단순 자연어 결과는 굳이 필요없.',
    tag: 'OUTPUT',
    color: '#F97316',

    icon: `
      <svg viewBox="0 0 20 20" fill="none">
        <path
          d="M10 13V3.5"
          stroke="currentColor"
          stroke-width="1.65"
          stroke-linecap="round"/>
        <path
          d="M6.8 6.7L10 3.5L13.2 6.7"
          stroke="currentColor"
          stroke-width="1.65"
          stroke-linecap="round"
          stroke-linejoin="round"/>
        <path
          d="M5 16H15"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"/>
      </svg>
    `,

    params: [
      {
        id: 'format',
        name: '파일 형식',
        placeholder: '예: PDF, DOCX',
        default: 'PDF'
      },
      {
        id: 'filename',
        name: '파일명',
        placeholder: '저장할 파일 이름',
        default: '결과물'
      }
    ],

    inputs: [
      {
        id: 'in',
        name: '대상',
        type: 'any',
        required: false,
        multiple: true,
        accepts: ['any']
      }
    ],

    outputs: []
  }

};

/* =========================================================
   PUBLIC DEFINITION
========================================================= */

const nodeDefinitionsPublic =
  JSON.parse(
    JSON.stringify(
      defaultNodeDef
    )
  );

function getNodeDefinition(type) {
  return defaultNodeDef[type] || null;
}

function getPortDefinition(
  type,
  direction,
  portId
) {
  const def =
    getNodeDefinition(type);

  if (!def) {
    return null;
  }

  const ports =
    direction === 'input'
      ? def.inputs || []
      : def.outputs || [];

  return (
    ports.find(
      port =>
        String(port.id) ===
        String(portId)
    ) || null
  );
}

/* =========================================================
   LLM NODE DEFINITION
========================================================= */

function buildNodeDefinitionPrompt() {
  return Object.entries(
    defaultNodeDef
  )
    .filter(
      ([type]) =>
        type !== 'start'
    )
    .map(
      ([type, def]) => {
        const inputs =
          (def.inputs || [])
            .map(
              port => port.id
            )
            .join(',') || '-';

        const outputs =
          (def.outputs || [])
            .map(
              port => port.id
            )
            .join(',') || '-';

        const params =
          (def.params || [])
            .map(
              param => param.id
            )
            .join(',') || '-';

        return [
          type,
          `name:${def.name}`,
          `입력:${inputs}`,
          `출력:${outputs}`,
          `params:${params}`,
          `설명:${def.llmdesc}`
        ].join(' ');
      }
    )
    .join('\n');
}

const NODE_DEFINITION_PROMPT =
  buildNodeDefinitionPrompt();

/* =========================================================
   STATIC PLANNER PROMPT
========================================================= */

const SYSTEM_PROMPT = `
Astra Workflow Planner. Return only the JSON schema-defined output.
Goal=interpret the user in context, minimally update the workflow when needed, return a concise user-facing message, and rewrite bounded memory.

PRIORITY:
1) Explicit task/workflow request
2) Modification/correction of the current task
3) Conversation or response-style instruction
4) Casual conversation
Resolve each turn by intent, not by forcing every message into workflow changes.

PLANNER BOUNDARY:
- Plan/modify workflow; do not execute downstream work.
- A task such as writing/reporting/analysis means construct the needed workflow, not perform the task in message.
- Conversation, style, reaction, greeting, and context questions normally => ops=[].
- A conversational/style correction does not alter workflow unless the user explicitly changes the task.
- For vague references, use the nearest semantically compatible context before older or more prominent context.

MEMORY:
- Memory is bounded state, not transcript/archive.
- flow=durable goals, decisions, constraints, preferences, unresolved intent.
- recent=latest relevant conversation/task state.
- detail=immediate exact values, references, wording, instructions, pending items.
- Rewrite all three each turn from previous memory + current workflow + current request + current response.
- Replace stale/less relevant information; never append, nest, or duplicate old memory.
- Do not preserve information merely because it existed.
- Do not fill unused space.
- Explicit user instructions and current decisions persist until changed.
- Use semantic recency when resolving "this/that/just now/before".
- Never claim memory not present in supplied context.
- Keep memory compact: flow<=300 chars, recent<=350 chars, detail<=250 chars.
- Avoid repeating the same fact across memory fields.

WORKFLOW:
- Preserve valid existing structure and unrelated params.
- Distinguish add/modify/delete/replace.
- Modify only affected parts; reuse existing nodes/connections.
- Never invent node types, ids, ports, or params.
- No unnecessary nodes, links, branches, transforms, or filters.
- No cycles.
- No change => ops=[].
- links=execution flow; data=data transfer. Keep them distinct.
- Use data links only for actual data transfer.

NODE RULES:
Judge=conditional branching only; inputs/outputs=true,false; never in/result.
File=source-only; inputs=0; output=file.file; never target file; file.in invalid.
CreateFile=input createFile.in; outputs=0; use only for file export; filename has no extension.
Use only params defined by the node type. Preserve unrelated params. User values override old values. Infer reasonable values when possible. Ask only when a required value cannot be reasonably inferred.

RESPONSE:
- message=user-facing only; concise and natural in the user's language.
- Markdown is allowed. Use it when structure, emphasis, lists, or headings improve readability; plain text is fine for short replies.
- Never expose ops, ids, schema, memory, or internal implementation.
- Explain only completed changes or necessary clarification.
- question=null unless clarification is required.
- If the user changes response style, update behavior accordingly; later style instructions supersede earlier ones. Style instructions apply to message generation, not workflow state.
- "Attach X to the end of speech" means apply X to sentence endings, not every word, unless the user explicitly says otherwise.

NODE DEFINITIONS:
${NODE_DEFINITION_PROMPT}

PATCH:
["a",id,type,paramsJson]
["m",id,paramsJson]
["dn",id]
["c",source,target]
["dc",source,target]
["d",source,target]
["dd",source,target]
a=add;m=modify;dn=delete;c=link add;dc=link delete;d=data add;dd=data delete
paramsJson=JSON string
endpoint=nodeId.portId
Apply: dn → dc/dd → m → a → c/d
c modifies links only. d modifies data only. file.file=data source. createFile.in=input.
`;

/* =========================================================
   PLANNER RESPONSE SCHEMA
========================================================= */

const PLANNER_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    ops: {
      type: 'array',
      minItems: 0,
      maxItems: 24,
      items: {
        type: 'array',
        minItems: 2,
        maxItems: 4,
        items: {
          type: 'string'
        }
      }
    },
    message: {
      type: 'string',
      maxLength: 300
    },
    question: {
      type: [
        'string',
        'null'
      ],
      maxLength: 300
    },
    memory: {
      type: 'object',
      additionalProperties: false,
      properties: {
        flow: {
          type: 'string',
          maxLength: 800
        },
        recent: {
          type: 'string',
          maxLength: 800
        },
        detail: {
          type: 'string',
          maxLength: 600
        }
      },
      required: [
        'flow',
        'recent',
        'detail'
      ]
    }
  },
  required: [
    'ops',
    'message',
    'question',
    'memory'
  ]
};

/* =========================================================
   HELPERS
========================================================= */

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(
      `AI 응답 JSON 파싱 실패: ${error.message}`
    );
  }
}

function cloneWorkflow(workflow) {
  if (
    !workflow ||
    typeof workflow !== 'object' ||
    Array.isArray(workflow)
  ) {
    return {
      nodes: [],
      links: [],
      data: []
    };
  }

  return {
    nodes:
      Array.isArray(workflow.nodes)
        ? JSON.parse(
            JSON.stringify(
              workflow.nodes
            )
          )
        : [],

    links:
      Array.isArray(workflow.links)
        ? JSON.parse(
            JSON.stringify(
              workflow.links
            )
          )
        : [],

    data:
      Array.isArray(workflow.data)
        ? JSON.parse(
            JSON.stringify(
              workflow.data
            )
          )
        : []
  };
}

function cleanParams(
  type,
  params
) {
  if (
    !params ||
    typeof params !== 'object' ||
    Array.isArray(params)
  ) {
    return {};
  }

  const def =
    getNodeDefinition(type);

  if (!def) {
    throw new Error(
      `존재하지 않는 노드 타입: ${type}`
    );
  }

  const allowed =
    new Set(
      (def.params || [])
        .map(
          param =>
            String(param.id)
        )
    );

  const result = {};

  for (
    const key of Object.keys(params)
  ) {
    if (!allowed.has(key)) {
      continue;
    }

    const value =
      params[key];

    if (
      typeof value === 'string' &&
      value.trim()
    ) {
      result[key] =
        value.trim();
    }
  }

  return result;
}

function parsePatchParams(
  value,
  label = 'params'
) {
  if (
    typeof value !== 'string'
  ) {
    throw new Error(
      `${label}가 문자열이 아닙니다.`
    );
  }

  try {
    const parsed =
      JSON.parse(value);

    if (
      !parsed ||
      typeof parsed !== 'object' ||
      Array.isArray(parsed)
    ) {
      throw new Error(
        '객체가 아닙니다.'
      );
    }

    return parsed;
  } catch (error) {
    throw new Error(
      `${label} JSON 파싱 실패: ${error.message}`
    );
  }
}

function endpoint(value) {
  if (
    typeof value !== 'string'
  ) {
    throw new Error(
      '연결 endpoint가 문자열이 아닙니다.'
    );
  }

  const index =
    value.lastIndexOf('.');

  if (index === -1) {
    throw new Error(
      `포트가 지정되지 않았습니다: ${value}`
    );
  }

  const node =
    value.slice(0, index);

  const port =
    value.slice(index + 1);

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

function hasEdge(
  edges,
  source,
  target
) {
  return edges.some(
    edge =>
      Array.isArray(edge) &&
      edge.length === 2 &&
      edge[0] === source &&
      edge[1] === target
  );
}

function removeNodeEdges(
  workflow,
  nodeId
) {
  const prefix =
    `${nodeId}.`;

  const keep = edge => {
    if (
      !Array.isArray(edge) ||
      edge.length !== 2
    ) {
      return false;
    }

    return !(
      String(edge[0]).startsWith(prefix) ||
      String(edge[1]).startsWith(prefix)
    );
  };

  workflow.links =
    workflow.links.filter(keep);

  workflow.data =
    workflow.data.filter(keep);
}

/* =========================================================
   PATCH VALIDATION
========================================================= */

function validatePatch(
  patch
) {
  if (
    !patch ||
    typeof patch !== 'object' ||
    Array.isArray(patch)
  ) {
    throw new Error(
      'Patch가 없습니다.'
    );
  }

  if (
    !Array.isArray(patch.ops)
  ) {
    throw new Error(
      'Patch ops가 배열이 아닙니다.'
    );
  }

  if (
    patch.ops.length > 24
  ) {
    throw new Error(
      'Patch가 너무 큽니다.'
    );
  }

  for (
    const op
      of patch.ops
  ) {
    if (
      !Array.isArray(op) ||
      op.length < 2 ||
      op.length > 4
    ) {
      throw new Error(
        '잘못된 Patch operation입니다.'
      );
    }

    const action =
      op[0];

    if (
      typeof action !== 'string'
    ) {
      throw new Error(
        'Patch operation이 문자열이 아닙니다.'
      );
    }

    if (action === 'a') {
      if (op.length !== 4) {
        throw new Error(
          'add operation 형식이 잘못되었습니다.'
        );
      }

      const id =
        op[1];

      const type =
        op[2];

      if (
        typeof id !== 'string' ||
        !id.trim()
      ) {
        throw new Error(
          '새 노드 ID가 잘못되었습니다.'
        );
      }

      if (
        typeof type !== 'string' ||
        !getNodeDefinition(type)
      ) {
        throw new Error(
          `존재하지 않는 노드 타입: ${type}`
        );
      }

      parsePatchParams(
        op[3],
        `${id}.params`
      );

      continue;
    }

    if (action === 'm') {
      if (op.length !== 3) {
        throw new Error(
          'modify operation 형식이 잘못되었습니다.'
        );
      }

      if (
        typeof op[1] !== 'string' ||
        !op[1].trim()
      ) {
        throw new Error(
          '수정할 노드 ID가 잘못되었습니다.'
        );
      }

      parsePatchParams(
        op[2],
        `${op[1]}.params`
      );

      continue;
    }

    if (action === 'dn') {
      if (
        op.length !== 2 ||
        typeof op[1] !== 'string'
      ) {
        throw new Error(
          'delete node operation 형식이 잘못되었습니다.'
        );
      }

      continue;
    }

    if (
      action === 'c' ||
      action === 'dc' ||
      action === 'd' ||
      action === 'dd'
    ) {
      if (
        op.length !== 3 ||
        typeof op[1] !== 'string' ||
        typeof op[2] !== 'string'
      ) {
        throw new Error(
          `연결 operation 형식이 잘못되었습니다: ${action}`
        );
      }

      endpoint(op[1]);
      endpoint(op[2]);

      continue;
    }

    throw new Error(
      `알 수 없는 Patch operation: ${action}`
    );
  }

  return patch;
}

/* =========================================================
   PLANNER RESPONSE VALIDATION
========================================================= */

function cleanMemory(value) {
  const source =
    value &&
    typeof value === 'object' &&
    !Array.isArray(value)
      ? value
      : {};

  const limit = (input, max) =>
    String(input ?? '')
      .trim()
      .slice(0, max);

  return {
    flow: limit(source.flow, 800),
    recent: limit(source.recent, 800),
    detail: limit(source.detail, 600)
  };
}

function validatePlannerResponse(
  result
) {
  if (
    !result ||
    typeof result !== 'object' ||
    Array.isArray(result)
  ) {
    throw new Error(
      'Planner 응답이 없습니다.'
    );
  }

  validatePatch(result);

  if (
    typeof result.message !== 'string' ||
    !result.message.trim()
  ) {
    throw new Error(
      'Planner message가 비어 있습니다.'
    );
  }

  if (
    result.question !== null &&
    (
      typeof result.question !== 'string' ||
      !result.question.trim()
    )
  ) {
    throw new Error(
      'Planner question 형식이 잘못되었습니다.'
    );
  }

  result.message =
    result.message.trim();

  if (
    typeof result.question === 'string'
  ) {
    result.question =
      result.question.trim();
  }

  result.memory =
    cleanMemory(result.memory);

  if (
    !result.memory.flow &&
    !result.memory.recent &&
    !result.memory.detail
  ) {
    throw new Error(
      'Planner memory가 비어 있습니다.'
    );
  }

  return result;
}

/* =========================================================
   PATCH APPLY
========================================================= */

function applyPatch(
  currentWorkflow,
  patch
) {
  validatePatch(patch);

  const workflow =
    cloneWorkflow(
      currentWorkflow
    );

  const nodeMap =
    new Map(
      workflow.nodes.map(
        node => [
          node.id,
          node
        ]
      )
    );

  // 1. delete nodes

  for (
    const op
      of patch.ops
  ) {
    if (op[0] !== 'dn') {
      continue;
    }

    const id = op[1];

    if (!nodeMap.has(id)) {
      throw new Error(
        `삭제할 노드가 없습니다: ${id}`
      );
    }

    workflow.nodes =
      workflow.nodes.filter(
        node =>
          node.id !== id
      );

    nodeMap.delete(id);

    removeNodeEdges(
      workflow,
      id
    );
  }

  // 2. delete connections

  for (
    const op
      of patch.ops
  ) {
    const action =
      op[0];

    if (
      action !== 'dc' &&
      action !== 'dd'
    ) {
      continue;
    }

    const list =
      action === 'dc'
        ? workflow.links
        : workflow.data;

    const index =
      list.findIndex(
        edge =>
          Array.isArray(edge) &&
          edge.length === 2 &&
          edge[0] === op[1] &&
          edge[1] === op[2]
      );

    if (index !== -1) {
      list.splice(index, 1);
    }
  }

  // 3. modify

  for (
    const op
      of patch.ops
  ) {
    if (op[0] !== 'm') {
      continue;
    }

    const id =
      op[1];

    const node =
      nodeMap.get(id);

    if (!node) {
      throw new Error(
        `수정할 노드가 없습니다: ${id}`
      );
    }

    const params =
      parsePatchParams(
        op[2],
        `${id}.params`
      );

    node.params =
      cleanParams(
        node.type,
        {
          ...(node.params || {}),
          ...params
        }
      );
  }

  // 4. add

  for (
    const op
      of patch.ops
  ) {
    if (op[0] !== 'a') {
      continue;
    }

    const id =
      op[1];

    const type =
      op[2];

    if (nodeMap.has(id)) {
      throw new Error(
        `중복된 노드 ID: ${id}`
      );
    }

    const params =
      parsePatchParams(
        op[3],
        `${id}.params`
      );

    const node = {
      id,
      type,
      params:
        cleanParams(
          type,
          params
        )
    };

    workflow.nodes.push(node);
    nodeMap.set(id, node);
  }

  // 5. add connections

  for (
    const op
      of patch.ops
  ) {
    const action =
      op[0];

    if (
      action !== 'c' &&
      action !== 'd'
    ) {
      continue;
    }

    const list =
      action === 'c'
        ? workflow.links
        : workflow.data;

    const source =
      op[1];

    const target =
      op[2];

    if (
      !hasEdge(
        list,
        source,
        target
      )
    ) {
      list.push([
        source,
        target
      ]);
    }
  }

  return workflow;
}

/* =========================================================
   WORKFLOW VALIDATION
========================================================= */

function validateWorkflow(
  spec
) {
  if (
    !spec ||
    typeof spec !== 'object' ||
    Array.isArray(spec)
  ) {
    throw new Error(
      '워크플로우가 없습니다.'
    );
  }

  if (
    !Array.isArray(spec.nodes)
  ) {
    throw new Error(
      'nodes가 배열이 아닙니다.'
    );
  }

  if (
    !Array.isArray(spec.links)
  ) {
    throw new Error(
      'links가 배열이 아닙니다.'
    );
  }

  if (
    !Array.isArray(spec.data)
  ) {
    throw new Error(
      'data가 배열이 아닙니다.'
    );
  }

  const ids =
    new Set();

  for (
    const node
      of spec.nodes
  ) {
    if (
      !node ||
      typeof node !== 'object' ||
      Array.isArray(node) ||
      typeof node.id !== 'string' ||
      typeof node.type !== 'string'
    ) {
      throw new Error(
        '잘못된 노드입니다.'
      );
    }

    if (
      ids.has(node.id)
    ) {
      throw new Error(
        `중복된 노드 ID: ${node.id}`
      );
    }

    ids.add(node.id);

    const def =
      getNodeDefinition(
        node.type
      );

    if (!def) {
      throw new Error(
        `존재하지 않는 노드 타입: ${node.type}`
      );
    }

    node.params =
      cleanParams(
        node.type,
        node.params
      );
  }

  function checkEdges(
    edges,
    mode
  ) {
    const seen =
      new Set();

    for (
      const edge
        of edges
    ) {
      if (
        !Array.isArray(edge) ||
        edge.length !== 2 ||
        typeof edge[0] !== 'string' ||
        typeof edge[1] !== 'string'
      ) {
        throw new Error(
          `잘못된 ${mode} 연결입니다.`
        );
      }

      const from =
        endpoint(edge[0]);

      const to =
        endpoint(edge[1]);

      const fromNode =
        spec.nodes.find(
          node =>
            node.id === from.node
        );

      const toNode =
        spec.nodes.find(
          node =>
            node.id === to.node
        );

      if (!fromNode) {
        throw new Error(
          `${mode}: 출발 노드가 없습니다: ${from.node}`
        );
      }

      if (!toNode) {
        throw new Error(
          `${mode}: 도착 노드가 없습니다: ${to.node}`
        );
      }

      const fromPort =
        getPortDefinition(
          fromNode.type,
          'output',
          from.port
        );

      const toPort =
        getPortDefinition(
          toNode.type,
          'input',
          to.port
        );

      if (!fromPort) {
        throw new Error(
          `${mode}: ${fromNode.type}.${from.port}는 존재하지 않는 출력 포트입니다.`
        );
      }

      if (!toPort) {
        throw new Error(
          `${mode}: ${toNode.type}.${to.port}는 존재하지 않는 입력 포트입니다.`
        );
      }

      const key =
        `${edge[0]}->${edge[1]}`;

      if (
        seen.has(key)
      ) {
        throw new Error(
          `${mode}: 중복된 연결입니다: ${key}`
        );
      }

      seen.add(key);
    }
  }

  checkEdges(
    spec.links,
    'links'
  );

  checkEdges(
    spec.data,
    'data'
  );

  

  return spec;
}

/* =========================================================
   PATCH REQUEST
========================================================= */

function buildUserPrompt(
  text,
  workflow,
  memory
) {
  const normalizedMemory =
    cleanMemory(memory);

  return [
    'MEMORY',
    `flow:${normalizedMemory.flow || '-'}`,
    `recent:${normalizedMemory.recent || '-'}`,
    `detail:${normalizedMemory.detail || '-'}`,
    'WORKFLOW',
    JSON.stringify(workflow || null),
    'REQUEST',
    text
  ].join('\n');
}

function buildRetryPrompt(
  text,
  workflow,
  memory,
  plannerResult,
  errorMessage
) {
  const normalizedMemory =
    cleanMemory(memory);

  return [
    'MEMORY',
    `flow:${normalizedMemory.flow || '-'}`,
    `recent:${normalizedMemory.recent || '-'}`,
    `detail:${normalizedMemory.detail || '-'}`,
    'WORKFLOW',
    JSON.stringify(workflow || null),
    'PREVIOUS OPS',
    JSON.stringify(plannerResult.ops),
    'VALIDATION ERROR',
    errorMessage,
    'NODE RULE',
    'file: inputs=0 outputs=file.file only',
    'file.in=invalid',
    'file=source only',
    'REQUEST',
    text
  ].join('\n');
}

/* =========================================================
   GROQ
========================================================= */

async function requestPatch(
  prompt
) {
  const response =
    await fetch(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/json',

          'Authorization':
            `Bearer ${process.env.GROQ_API_KEY}`
        },

        body: JSON.stringify({
          model:
            process.env.GROQ_MODEL ||
            'openai/gpt-oss-120b',

          messages: [
            {
              role: 'system',
              content:
                SYSTEM_PROMPT
            },

            {
              role: 'user',
              content:
                prompt
            }
          ],

          temperature: 0.15,

          response_format: {
            type: 'json_schema',

            json_schema: {
              name:
                'workflow_planner',

              strict: true,

              schema:
                PLANNER_SCHEMA
            }
          }
        })
      }
    );

  if (!response.ok) {
    const errorText =
      await response.text();

    throw new Error(
      `Groq API 오류: ${response.status} ${errorText}`
    );
  }

  const result =
    await response.json();

  const cachedTokens =
    result?.usage?.prompt_tokens_details?.cached_tokens;

  if (Number.isFinite(cachedTokens)) {
    console.log(
      `Groq cached input tokens: ${cachedTokens}`
    );
  }

  const content =
    result
      ?.choices?.[0]
      ?.message
      ?.content;

  if (
    typeof content !== 'string' ||
    !content.trim()
  ) {
    throw new Error(
      'AI 응답이 비어 있습니다.'
    );
  }

  return validatePlannerResponse(
    parseJson(content)
  );
}

/* =========================================================
   WORKFLOW API
========================================================= */

app.post(
  '/api/workflow',
  async (
    req,
    res
  ) => {
    try {
      const text =
        String(
          req.body?.text ||
          ''
        ).trim();

      const currentWorkflow =
        req.body?.workflow ||
        null;

      const memory =
        cleanMemory(
          req.body?.memory
        );

      if (!text) {
        return res.status(400).json({
          ok: false,
          error:
            '작업 내용을 입력해주세요.'
        });
      }

      if (
        !process.env.GROQ_API_KEY
      ) {
        return res.status(500).json({
          ok: false,
          error:
            'GROQ_API_KEY가 설정되지 않았습니다.'
        });
      }

      /*
        1차 Planner
      */

      let plannerResult =
        await requestPatch(
          buildUserPrompt(
            text,
            currentWorkflow,
            memory
          )
        );

      /*
        Patch 적용 + 검증
      */

      let workflow;

      try {
        workflow =
          applyPatch(
            currentWorkflow,
            plannerResult
          );

        workflow =
          validateWorkflow(
            workflow
          );

      } catch (
        firstError
      ) {
        console.warn(
          'Workflow patch validation failed. Retrying once:',
          firstError.message
        );

        /*
          2차 Planner
        */

        plannerResult =
          await requestPatch(
            buildRetryPrompt(
              text,
              currentWorkflow,
              memory,
              plannerResult,
              firstError.message
            )
          );

        workflow =
          applyPatch(
            currentWorkflow,
            plannerResult
          );

        workflow =
          validateWorkflow(
            workflow
          );
      }

      return res.json({
        ok: true,

        workflow,

        message:
          plannerResult.message,

        question:
          plannerResult.question,

        memory:
          plannerResult.memory
      });

    } catch (
      error
    ) {
      console.error(error);

      return res.status(500).json({
        ok: false,
        error:
          error.message ||
          '워크플로우를 처리하지 못했습니다.'
      });
    }
  }
);

/* =========================================================
   NODE DEFINITION API
========================================================= */

app.get(
  '/api/node-definitions',
  (req, res) => {
    return res.json({
      ok: true,
      nodes:
        nodeDefinitionsPublic
    });
  }
);

/* =========================================================
   HTML / STATIC
========================================================= */

app.get(
  '/',
  (req, res) => {
    res.redirect('/home');
  }
);

app.get(
  '/*splat',
  (req, res, next) => {
    const htmlFile =
      htmlRoutes[
        req.path
      ];

    if (htmlFile) {
      return res.sendFile(
        path.join(
          __dirname,
          htmlFile
        )
      );
    }

    const filePath =
      path.join(
        __dirname,
        req.path
      );

    res.sendFile(
      filePath,
      error => {
        if (error) {
          next();
        }
      }
    );
  }
);

/* =========================================================
   404
========================================================= */

app.use(
  (req, res) => {
    res.status(404).send(
      'Not Found'
    );
  }
);

/* =========================================================
   SERVER
========================================================= */

app.listen(
  PORT,
  '0.0.0.0',
  () => {
    console.log(
      `Server running on http://localhost:${PORT}`
    );
  }
);
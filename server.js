import 'dotenv/config';
import express from 'express';
import compression from 'compression';
import path from 'path';
import {fileURLToPath} from 'url';

const app=express();

const __filename=fileURLToPath(import.meta.url);
const __dirname=path.dirname(__filename);

app.use(
  express.json({
    limit:'1mb'
  })
);

app.use(compression());

const PORT=
  process.env.PORT||
  3000;

const htmlRoutes={
  '/home':'index.html'
};


/* =========================
   Canonical Node Definition
========================= */

const NODE_DEFINITIONS={
  start:{
    name:'시작하기',
    desc:'AI 작업을 시작하는 기준점입니다.',
    tag:'START',
    color:'#10B981',

    icon:`
      <svg viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="6.5"
          stroke="currentColor" stroke-width="1.45"/>
        <path d="M10 13.2V7"
          stroke="currentColor" stroke-width="1.55"
          stroke-linecap="round"/>
        <path d="M7.8 9.1L10 7l2.2 2.1"
          stroke="currentColor" stroke-width="1.55"
          stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `,

    inputs:[],

    outputs:[
      {
        id:'out',
        name:'실행 방향',
        type:'any',
        required:false,
        multiple:true,
        accepts:['any']
      }
    ]
  },

  research:{
    name:'조사하기',
    desc:'필요한 정보를 찾아 수집합니다.',
    tag:'RESEARCH',
    color:'#3B82F6',

    icon:`
      <svg viewBox="0 0 20 20" fill="none">
        <circle cx="8" cy="8" r="5"
          stroke="currentColor" stroke-width="1.55"/>
        <path d="M11.6 11.6L15.8 15.8"
          stroke="currentColor" stroke-width="1.6"
          stroke-linecap="round"/>
      </svg>
    `,

    params:[
      {
        id:'topic',
        name:'주제',
        placeholder:'조사할 주제',
        default:'생성형 AI 시장'
      },
      {
        id:'filter',
        name:'조건',
        placeholder:'조사 조건',
        default:'최근 3년'
      }
    ],

    inputs:[
      {
        id:'in',
        name:'연결',
        type:'any',
        required:false,
        multiple:true,
        accepts:['any']
      }
    ],

    outputs:[
      {
        id:'result',
        name:'결과',
        type:'research',
        required:false,
        multiple:true,
        accepts:['research','any']
      }
    ]
  },

  organize:{
    name:'정리하기',
    desc:'자료를 기준에 따라 구조화합니다.',
    tag:'ORGANIZE',
    color:'#F59E0B',

    icon:`
      <svg viewBox="0 0 20 20" fill="none">
        <path d="M4 5h12M4 10h12M4 15h8"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linecap="round"/>
      </svg>
    `,

    params:[
      {
        id:'criteria',
        name:'정리 기준',
        placeholder:'정리할 기준',
        default:'시장 규모 / 주요 기업'
      },
      {
        id:'format',
        name:'출력 형식',
        placeholder:'예: 표, 목록, 문단',
        default:'표'
      }
    ],

    inputs:[
      {
        id:'in',
        name:'데이터',
        type:'any',
        required:false,
        multiple:true,
        accepts:['any']
      }
    ],

    outputs:[
      {
        id:'result',
        name:'결과',
        type:'structured',
        required:false,
        multiple:true,
        accepts:['structured','any']
      }
    ]
  },

  judge:{
    name:'판단하기',
    desc:'조건을 판단하고 참 또는 거짓 경로로 데이터를 전달합니다.',
    tag:'JUDGE',
    color:'#8B5CF6',

    icon:`
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
          stroke="currentColor"
          stroke-width="1.45"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    `,

    params:[
      {
        id:'condition',
        name:'조건',
        placeholder:'판단 조건',
        default:'일치도 ≥ 70%'
      }
    ],

    inputs:[
      {
        id:'true',
        name:'참 자료',
        type:'any',
        required:false,
        multiple:true,
        accepts:['any']
      },
      {
        id:'false',
        name:'거짓 자료',
        type:'any',
        required:false,
        multiple:true,
        accepts:['any']
      }
    ],

    outputs:[
      {
        id:'true',
        name:'참 출구',
        type:'decision',
        required:false,
        multiple:true,
        accepts:['decision','any']
      },
      {
        id:'false',
        name:'거짓 출구',
        type:'decision',
        required:false,
        multiple:true,
        accepts:['decision','any']
      }
    ]
  },

  write:{
    name:'작성하기',
    desc:'주어진 정보를 글 형태로 작성합니다.',
    tag:'WRITE',
    color:'#EF4444',

    icon:`
      <svg viewBox="0 0 20 20" fill="none">
        <path
          d="M5.1 14.9L6.2 11.8L13.1 4.9
             C13.7 4.3 14.7 4.3 15.3 4.9
             L16 5.6C16.6 6.2 16.6 7.2 16 7.8
             L9.1 14.7L5.1 14.9Z"
          stroke="currentColor"
          stroke-width="1.45"
          stroke-linejoin="round"
        />
        <path d="M12.4 5.6L15.1 8.3"
          stroke="currentColor"
          stroke-width="1.35"
          stroke-linecap="round"/>
        <path d="M5.1 14.9L7.9 14.2"
          stroke="currentColor"
          stroke-width="1.45"
          stroke-linecap="round"/>
      </svg>
    `,

    params:[
      {
        id:'title',
        name:'제목',
        placeholder:'문서 제목',
        default:'AI 기술 보고서'
      },
      {
        id:'length',
        name:'분량',
        placeholder:'예: 2페이지',
        default:'2페이지'
      },
      {
        id:'style',
        name:'스타일',
        placeholder:'예: 전문적, 간결한',
        default:'전문적'
      },
      {
        id:'about',
        name:'내용',
        placeholder:'예: 관련 데이터에 대하여 서술',
        default:''
      }
    ],

    inputs:[
      {
        id:'in',
        name:'자료',
        type:'any',
        required:false,
        multiple:true,
        accepts:['any']
      }
    ],

    outputs:[
      {
        id:'result',
        name:'결과',
        type:'document',
        required:false,
        multiple:true,
        accepts:['document','any']
      }
    ]
  },

  convert:{
    name:'변형하기',
    desc:'자료의 형식이나 스타일을 변형합니다.',
    tag:'CONVERT',
    color:'#EC4899',

    icon:`
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

    params:[
      {
        id:'instruction',
        name:'변형 방식',
        placeholder:'어떻게 변형할까요?',
        default:'표로 바꿔줘'
      }
    ],

    inputs:[
      {
        id:'in',
        name:'자료',
        type:'any',
        required:false,
        multiple:true,
        accepts:['any']
      }
    ],

    outputs:[
      {
        id:'result',
        name:'결과',
        type:'any',
        required:false,
        multiple:true,
        accepts:['any']
      }
    ]
  },

  file:{
    name:'파일추가하기',
    desc:'작업에 사용할 파일을 추가합니다.',
    tag:'INPUT',
    color:'#64748B',

    icon:`
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
          stroke-linejoin="round"
        />
      </svg>
    `,

    inputs:[],

    outputs:[
      {
        id:'file',
        name:'전달',
        type:'file',
        required:false,
        multiple:true,
        accepts:['file','any']
      }
    ]
  },

  createFile:{
    hidden:true,
    name:'내보내기',
    desc:'완성된 결과물을 파일로 생성합니다.',
    tag:'OUTPUT',
    color:'#F97316',

    icon:`
      <svg viewBox="0 0 20 20" fill="none">
        <path
          d="M10 13V3.5"
          stroke="currentColor"
          stroke-width="1.65"
          stroke-linecap="round"
        />
        <path
          d="M6.8 6.7L10 3.5L13.2 6.7"
          stroke="currentColor"
          stroke-width="1.65"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <path
          d="M5 16H15"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
        />
      </svg>
    `,

    params:[
      {
        id:'format',
        name:'파일 형식',
        placeholder:'예: PDF, DOCX',
        default:'PDF'
      },
      {
        id:'filename',
        name:'파일명',
        placeholder:'저장할 파일 이름',
        default:'결과물'
      }
    ],

    inputs:[
      {
        id:'in',
        name:'대상',
        type:'any',
        required:false,
        multiple:true,
        accepts:['any']
      }
    ],

    outputs:[]
  }
};


/* =========================
   Node Definition Helpers
========================= */

const nodeTypeNames=
  Object.keys(
    NODE_DEFINITIONS
  );

const nodeDefinitionsPublic=
  JSON.parse(
    JSON.stringify(
      NODE_DEFINITIONS
    )
  );

const paramDefinitions=
  Object.values(
    NODE_DEFINITIONS
  ).flatMap(
    def=>
      Array.isArray(def.params)
        ?def.params
        :[]
  );

const paramKeys=
  new Set(
    paramDefinitions.map(
      param=>String(param.id)
    )
  );

function getNodeDefinition(type){

  return NODE_DEFINITIONS[type]||null;

}

function getParamDefinition(
  type,
  paramId
){

  const def=
    getNodeDefinition(type);

  if(
    !def||
    !Array.isArray(def.params)
  ){

    return null;

  }

  return def.params.find(
    param=>
      param.id===paramId
  )||null;

}

function getPortDefinition(
  type,
  direction,
  portId
){

  const def=
    getNodeDefinition(type);

  if(!def){

    return null;

  }

  const ports=
    direction==='input'
      ?def.inputs||[]
      :def.outputs||[];

  return ports.find(
    port=>
      port.id===portId
  )||null;

}

function getDefinitionPortIds(
  type,
  direction
){

  const def=
    getNodeDefinition(type);

  if(!def){

    return [];

  }

  const ports=
    direction==='input'
      ?def.inputs||[]
      :def.outputs||[];

  return ports.map(
    port=>
      String(port.id)
  );

}


/* =========================
   Definition Prompt Builder
========================= */

function buildNodeDefinitionPrompt(){

  const lines=[];

  for(
    const [type,def]
      of Object.entries(
        NODE_DEFINITIONS
      )
  ){

    lines.push(type);

    lines.push(
      `- name: ${def.name}`
    );

    lines.push(
      `- inputs: ${
        (def.inputs||[])
          .map(
            port=>
              `${port.id} (${port.name})`
          )
          .join(', ')||
        '없음'
      }`
    );

    lines.push(
      `- outputs: ${
        (def.outputs||[])
          .map(
            port=>
              `${port.id} (${port.name})`
          )
          .join(', ')||
        '없음'
      }`
    );

    const params=
      Array.isArray(def.params)
        ?def.params
        :[];

    if(params.length){

      lines.push('- params:');

      for(const param of params){

        lines.push(
          `  - ${param.id}: ${param.name}`
        );

      }

    }else{

      lines.push('- params: 없음');

    }

    lines.push('');

  }

  return lines.join('\n');

}

const NODE_DEFINITION_PROMPT=
  buildNodeDefinitionPrompt();


/* =========================
   Prompt
========================= */

const SYSTEM_PROMPT=`
너는 AI 시각적 프로그래밍 캔버스의 Workflow Planner다.

사용자의 자연어 요청을 하나의 Workflow JSON으로 변환한다.

반드시 JSON 객체 하나만 출력한다.

구조:
{
  "nodes":[
    {
      "id":"start",
      "type":"start",
      "params":{}
    }
  ],
  "links":[
    ["start.out","research1.in"]
  ],
  "data":[]
}

허용되는 모든 노드와 포트와 파라미터는 아래 정의를 따른다.

${NODE_DEFINITION_PROMPT}

중요:
- start는 항상 포함한다.
- 필요한 노드만 사용한다.
- 요청에서 알 수 있거나 자연스럽게 추론할 수 있는 params는 최대한 채운다.
- 의미 없는 params는 만들지 않는다.
- 필요 없는 params는 params에서 생략한다.
- nodes의 모든 원소는 반드시 객체다.
- nodes 안에 문자열이나 ":"를 직접 넣지 않는다.
- links와 data의 연결은 반드시 ["노드ID.출력포트","노드ID.입력포트"] 형식이다.
- [ "1", "2" ] 같은 숫자 연결은 절대 사용하지 않는다.
- 존재하지 않는 포트 이름을 만들지 않는다.
- 존재하지 않는 파라미터 이름을 만들지 않는다.
- 모든 연결 endpoint의 노드와 포트는 실제 정의에 존재해야 한다.
- data는 필요하지 않으면 []이다.

Judge 규칙:
- judge의 입력은 "true"와 "false" 두 포트다.
- judge의 판단 기준은 condition 파라미터에 적는다.
- judge의 출력은 "true"와 "false" 두 포트다.
- true/false는 boolean 값 자체가 아니라 포트의 의미다.
- 조건이 참이면 true 입력 쪽 데이터가 true 출력 경로로 전달된다.
- 조건이 거짓이면 false 입력 쪽 데이터가 false 출력 경로로 전달된다.
- 선택되지 않은 반대 경로는 이후 실행에서 SKIPPED로 취급될 수 있다.
- judge.in, judge.truePath, judge.falsePath 같은 존재하지 않는 포트를 사용하지 않는다.

노드 ID 형식:
- start
- research1
- organize1
- judge1
- write1
- convert1
- file1
- createFile1

예:
"최근 고라니 개체수 변화에 대해 조사하고 보고서를 작성해서 PDF로 만들어줘"

research:
{
  "topic":"고라니 개체수 변화",
  "filter":"최근"
}

organize:
{
  "criteria":"개체수 변화와 주요 원인",
  "format":"항목별 정리"
}

write:
{
  "title":"고라니 개체수 변화 보고서",
  "length":"2페이지",
  "style":"보고서 형식, 객관적",
  "about":"최근 고라니 개체수 변화와 주요 원인"
}

convert:
{
  "instruction":"PDF로 변환"
}

createFile:
{
  "format":"PDF",
  "filename":"고라니 개체수 변화 보고서"
}

links:
[
  ["start.out","research1.in"],
  ["research1.result","organize1.in"],
  ["organize1.result","write1.in"],
  ["write1.result","convert1.in"],
  ["convert1.result","createFile1.in"]
]

data:
[]
`;


/* =========================
   JSON Parse
========================= */

function parseJson(text){

  try{

    return JSON.parse(text);

  }catch{

    throw new Error(
      'LLM이 올바른 JSON을 반환하지 않았습니다.'
    );

  }

}


/* =========================
   Param Cleanup
========================= */

function cleanParams(
  type,
  params
){

  if(
    !params||
    typeof params!=='object'||
    Array.isArray(params)
  ){

    return {};

  }

  const def=
    getNodeDefinition(type);

  if(!def){

    return {};

  }

  const allowed=
    new Set(
      (def.params||[])
        .map(
          param=>
            String(param.id)
        )
    );

  const result={};

  for(
    const key of Object.keys(params)
  ){

    if(
      !allowed.has(key)
    ){

      continue;

    }

    const value=
      params[key];

    if(
      typeof value==='string'&&
      value.trim()
    ){

      result[key]=
        value.trim();

    }

  }

  return result;

}


/* =========================
   JSON Endpoint
========================= */

function endpoint(value){

  if(
    typeof value!=='string'
  ){

    throw new Error(
      '연결 endpoint가 문자열이 아닙니다.'
    );

  }

  const i=
    value.lastIndexOf('.');

  if(i===-1){

    throw new Error(
      `포트가 지정되지 않았습니다: ${value}`
    );

  }

  const node=
    value.slice(
      0,
      i
    );

  const port=
    value.slice(
      i+1
    );

  if(
    !node||
    !port
  ){

    throw new Error(
      `잘못된 endpoint입니다: ${value}`
    );

  }

  return {
    node,
    port
  };

}


/* =========================
   Workflow Validation
========================= */

function validateWorkflow(spec){

  if(
    !spec||
    typeof spec!=='object'||
    Array.isArray(spec)
  ){

    throw new Error(
      '워크플로우가 없습니다.'
    );

  }

  if(
    !Array.isArray(spec.nodes)
  ){

    throw new Error(
      'nodes가 배열이 아닙니다.'
    );

  }

  if(
    !Array.isArray(spec.links)
  ){

    throw new Error(
      'links가 배열이 아닙니다.'
    );

  }

  if(
    !Array.isArray(spec.data)
  ){

    throw new Error(
      'data가 배열이 아닙니다.'
    );

  }


  const ids=
    new Set();


  let startCount=0;


  for(
    const node of spec.nodes
  ){

    if(
      !node||
      typeof node!=='object'||
      Array.isArray(node)||
      typeof node.id!=='string'||
      typeof node.type!=='string'
    ){

      throw new Error(
        '잘못된 노드입니다.'
      );

    }


    if(
      ids.has(node.id)
    ){

      throw new Error(
        `중복된 노드 ID: ${node.id}`
      );

    }

    ids.add(
      node.id
    );


    const def=
      getNodeDefinition(
        node.type
      );


    if(!def){

      throw new Error(
        `존재하지 않는 노드 타입: ${node.type}`
      );

    }


    if(
      node.type==='start'
    ){

      startCount++;

    }


    node.params=
      cleanParams(
        node.type,
        node.params
      );

  }


  if(
    startCount!==1
  ){

    throw new Error(
      'start 노드는 정확히 하나 있어야 합니다.'
    );

  }


  function checkEdges(
    edges,
    mode
  ){

    const seen=
      new Set();

    for(
      const edge of edges
    ){

      if(
        !Array.isArray(edge)||
        edge.length!==2||
        typeof edge[0]!=='string'||
        typeof edge[1]!=='string'
      ){

        throw new Error(
          `잘못된 ${mode} 연결입니다.`
        );

      }


      const from=
        endpoint(
          edge[0]
        );

      const to=
        endpoint(
          edge[1]
        );


      const fromNode=
        spec.nodes.find(
          node=>
            node.id===from.node
        );

      const toNode=
        spec.nodes.find(
          node=>
            node.id===to.node
        );


      if(!fromNode){

        throw new Error(
          `${mode}: 출발 노드가 없습니다: ${from.node}`
        );

      }


      if(!toNode){

        throw new Error(
          `${mode}: 도착 노드가 없습니다: ${to.node}`
        );

      }


      const fromPort=
        getPortDefinition(
          fromNode.type,
          'output',
          from.port
        );

      const toPort=
        getPortDefinition(
          toNode.type,
          'input',
          to.port
        );


      if(!fromPort){

        throw new Error(
          `${mode}: ${fromNode.type}.${from.port}는 존재하지 않는 출력 포트입니다.`
        );

      }


      if(!toPort){

        throw new Error(
          `${mode}: ${toNode.type}.${to.port}는 존재하지 않는 입력 포트입니다.`
        );

      }


      const key=
        `${edge[0]}->${edge[1]}`;

      if(
        seen.has(key)
      ){

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


/* =========================
   Workflow JSON Schema
========================= */

function buildWorkflowSchema(){

  const allParams={};

  for(
    const def
      of Object.values(
        NODE_DEFINITIONS
      )
  ){

    for(
      const param
        of (def.params||[])
    ){

      allParams[param.id]={
        type:'string'
      };

    }

  }


  return {

    type:'object',

    additionalProperties:false,

    properties:{

      nodes:{
        type:'array',

        items:{
          type:'object',

          additionalProperties:false,

          properties:{

            id:{
              type:'string'
            },

            type:{
              type:'string',

              enum:nodeTypeNames
            },

            params:{
              type:'object',

              additionalProperties:false,

              properties:allParams
            }

          },

          required:[
            'id',
            'type',
            'params'
          ]

        }

      },

      links:{
        type:'array',

        items:{
          type:'array',

          minItems:2,
          maxItems:2,

          items:{
            type:'string'
          }

        }

      },

      data:{
        type:'array',

        items:{
          type:'array',

          minItems:2,
          maxItems:2,

          items:{
            type:'string'
          }

        }

      }

    },

    required:[
      'nodes',
      'links',
      'data'
    ]

  };

}

const WORKFLOW_SCHEMA=
  buildWorkflowSchema();


/* =========================
   Node Definition API
========================= */

app.get(
  '/api/node-definitions',
  (req,res)=>{

    return res.json({

      ok:true,

      nodes:
        nodeDefinitionsPublic

    });

  }
);


/* =========================
   HTML / Static
========================= */

app.get(
  '/',
  (req,res)=>{

    res.redirect(
      '/home'
    );

  }
);

app.get(
  '/*splat',
  (req,res,next)=>{

    const htmlFile=
      htmlRoutes[
        req.path
      ];

    if(htmlFile){

      return res.sendFile(
        path.join(
          __dirname,
          htmlFile
        )
      );

    }

    const filePath=
      path.join(
        __dirname,
        req.path
      );

    res.sendFile(
      filePath,
      error=>{

        if(error){

          next();

        }

      }
    );

  }
);


/* =========================
   Retry Prompt
========================= */

function buildRetryPrompt(text){

  return `
이전 응답이 Workflow 검증에 실패했다.

아래 Canonical Node Definition만 사용해서 다시 생성한다.

${NODE_DEFINITION_PROMPT}

특히 Judge는 반드시 다음 구조를 사용한다.

- 입력: judge.true, judge.false
- 파라미터: condition
- 출력: judge.true, judge.false

judge.in은 존재하지 않는다.
judge.truePath와 judge.falsePath도 존재하지 않는다.

연결 형식:
["출발노드.출력포트","도착노드.입력포트"]

규칙:
- nodes의 모든 원소는 객체
- id는 start/research1/organize1/judge1/write1/convert1/file1/createFile1 형식
- params는 객체
- 필요한 params는 가능한 한 채운다
- 필요 없는 params는 생략
- 존재하지 않는 노드 타입을 만들지 않는다.
- 존재하지 않는 포트를 사용하지 않는다.
- 존재하지 않는 파라미터를 사용하지 않는다.
- JSON만 출력한다.

사용자 요청:
${text}
`;

}


/* =========================
   LLM Request
========================= */

async function requestWorkflow(
  text,
  retry=false
){

  const prompt=
    retry
      ?buildRetryPrompt(text)
      :text;


  const response=
    await fetch(
      'https://api.groq.com/openai/v1/chat/completions',
      {

        method:'POST',

        headers:{
          'Content-Type':
            'application/json',

          Authorization:
            `Bearer ${process.env.GROQ_API_KEY}`
        },

        body:JSON.stringify({

          model:
            'openai/gpt-oss-20b',

          messages:[

            {
              role:'system',
              content:SYSTEM_PROMPT
            },

            {
              role:'user',
              content:prompt
            }

          ],

          response_format:{
            type:'json_schema',

            json_schema:{
              name:'workflow',

              strict:false,

              schema:
                WORKFLOW_SCHEMA
            }
          },

          temperature:0,

          reasoning_effort:'low',

          reasoning_format:'hidden',

          max_completion_tokens:1200

        })

      }
    );


  if(!response.ok){

    const errorText=
      await response.text();

    throw new Error(
      `Groq 요청 실패: ${errorText}`
    );

  }


  const result=
    await response.json();


  const content=
    result?.
    choices?.
    [0]?.
    message?.
    content;


  if(!content){

    throw new Error(
      'LLM 응답이 비어 있습니다.'
    );

  }


  console.log(
    'LLM response:',
    content
  );


  return validateWorkflow(
    parseJson(
      content
    )
  );

}


/* =========================
   Workflow API
========================= */

app.post(
  '/api/workflow',
  async(req,res)=>{

    try{

      const text=
        String(
          req.body?.text||
          ''
        ).trim();


      if(!text){

        return res.status(400).json({
          ok:false,
          error:
            '작업 내용을 입력해주세요.'
        });

      }


      if(
        !process.env.GROQ_API_KEY
      ){

        return res.status(500).json({
          ok:false,
          error:
            'GROQ_API_KEY가 설정되지 않았습니다.'
        });

      }


      let workflow;


      try{

        workflow=
          await requestWorkflow(
            text,
            false
          );

      }catch(firstError){

        console.warn(
          'Workflow validation failed. Retrying once:',
          firstError.message
        );


        workflow=
          await requestWorkflow(
            text,
            true
          );

      }


      return res.json({
        ok:true,
        workflow
      });


    }catch(error){

      console.error(
        error
      );


      return res.status(500).json({

        ok:false,

        error:
          error.message||
          '워크플로우 생성에 실패했습니다.'

      });

    }

  }
);


/* =========================
   404
========================= */

app.use(
  (req,res)=>{

    res.status(404).send(
      'Not Found'
    );

  }
);


/* =========================
   Server
========================= */

app.listen(
  PORT,
  '0.0.0.0',
  ()=>{

    console.log(
      `Server running on http://localhost:${PORT}`
    );

  }
);
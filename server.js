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


/* =========================================================
   CANONICAL NODE DEFINITION
   ========================================================= */

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
          stroke-linecap="round"
          stroke-linejoin="round"/>
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
          stroke="currentColor"
          stroke-width="1.6"
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
          stroke="currentColor" stroke-width="1.45"
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
          stroke="currentColor" stroke-width="1.45"
          stroke-linejoin="round"
        />
        <path d="M12.4 5.6L15.1 8.3"
          stroke="currentColor" stroke-width="1.35"
          stroke-linecap="round"/>
        <path d="M5.1 14.9L7.9 14.2"
          stroke="currentColor" stroke-width="1.45"
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


/* =========================================================
   NODE HELPERS
   ========================================================= */

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

function getNodeDefinition(type){

  return NODE_DEFINITIONS[type]||null;

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


/* =========================================================
   COMPACT NODE DEFINITION FOR LLM
   ========================================================= */

function buildNodeDefinitionPrompt(){

  return Object.entries(
    NODE_DEFINITIONS
  )
    .map(
      ([type,def])=>{

        const inputs=
          (def.inputs||[])
            .map(
              port=>
                `${port.id}:${port.name}`
            )
            .join(',')||
          '-';

        const outputs=
          (def.outputs||[])
            .map(
              port=>
                `${port.id}:${port.name}`
            )
            .join(',')||
          '-';

        const params=
          (def.params||[])
            .map(
              param=>
                `${param.id}:${param.name}`
            )
            .join(',')||
          '-';

        return [
          `${type}=${def.name}`,
          `설명=${def.desc}`,
          `입력[${inputs}]`,
          `출력[${outputs}]`,
          `설정[${params}]`
        ].join(' ');

      }
    )
    .join('\n');

}
const NODE_DEFINITION_PROMPT=
  buildNodeDefinitionPrompt();


/* =========================================================
   PLANNER RULES
   ========================================================= */

const PLANNER_RULES=`

노드:
start=시작점 1개.
research=정보 조사.
organize=자료 구조화.
judge=조건 분기.
write=글/문서 작성.
convert=형식/스타일 변환.
file=사용자 제공 파일 입력.
createFile=파일 생성 출력.

필요한 노드만 사용한다.

기존 Workflow가 있으면:
- 요청과 기존 Workflow의 실제 관련성을 판단한다.
- 판단 기준은 노드 목적, params, 입력/출력, 연결, 재사용 가치다.
- 관련성이 있으면 기존 노드와 params를 최대한 유지한다.
- 필요한 노드만 추가한다.
- 필요한 params와 연결만 수정한다.
- 불필요한 노드는 삭제한다.
- 기존 node id는 가능한 한 유지한다.
- 새 노드 id는 기존 id와 겹치지 않게 한다.
- 관련성이 낮으면 기존 Workflow를 억지로 재사용하지 않고 새로 구성한다.
- 출력은 항상 완성된 Workflow 전체다.

파일:
- 기존 파일이 없으면 file을 만들지 않는다.
- 새 파일 생성은 createFile을 사용한다.
- file1.file은 파일 출력 endpoint.
- createFile1.in은 파일 생성 입력 endpoint.
- file1/createFile1 자체는 endpoint가 아니다.

Judge:
- 실제 분기가 필요할 때만 사용한다.
- 입력/출력 포트는 true,false만 사용한다.
- judge.in, judge.truePath, judge.falsePath는 존재하지 않는다.

연결:
- ["출력endpoint","입력endpoint"] 형식만 사용한다.
- endpoint는 nodeId.portId다.
- 존재하지 않는 노드, 포트, params를 만들지 않는다.

Params:
- 모든 node에 params:{}를 포함한다.
- 정의된 params만 사용한다.
- 알 수 있는 값만 채운다.
- 불필요한 params와 빈 문자열은 넣지 않는다.
`;

/* =========================================================
   SYSTEM PROMPT
   ========================================================= */

const SYSTEM_PROMPT=`
너는 Astra Workflow Planner다.

자연어 요청을 실행 가능한 Workflow JSON으로 변환한다.
설명 없이 JSON 객체 하나만 출력한다.

형식:
{
  "nodes":[
    {"id":"start","type":"start","params":{}}
  ],
  "links":[],
  "data":[]
}
반드시:
- start는 정확히 1개
- 모든 node는 id,type,params를 포함한다.
- 실제 존재하는 노드, 포트, params만 사용한다.
- 결과 언어는 사용자가 사용한 언어로 한다. 단, 다른 언어를 사용하라는 요청은 예외다.
- 기존 Workflow가 있으면 재활용 가능성을 먼저 판단한다.
- 재활용하는 기존 node의 id는 가능한 한 유지한다.
- 최종 결과는 항상 전체 Workflow다.

연결:
- 최종 Workflow는 실행 가능한 완성된 연결 구조여야 한다.
- 필요한 실행 단계는 links로 연결하고, 입력 자료 전달은 data로 연결한다.
- 기존 Workflow의 연결은 필요한 부분을 최대한 유지하고, 새 노드 추가나 구조 변경에 필요한 연결도 함께 구성한다.
- 기존 연결이 없거나 불완전해도 최종 Workflow에서는 필요한 연결을 완성한다.
- 모든 연결은 실제 존재하는 output과 input port를 사용한다.
- 실제 연결이 필요한데 links를 비워두지 않는다.
- 파라미터 및 자연어 값은 사용자 언어로 작성한다. 예시 : 한국어 요청에는 한국어만 사용한다.
- type,id,port id,JSON 키 등 시스템 식별자는 그대로 유지한다.

허용 노드:
${NODE_DEFINITION_PROMPT}

규칙:
${PLANNER_RULES}
`;

/* =========================================================
   JSON PARSE
   ========================================================= */

function parseJson(text){

  try{

    return JSON.parse(text);

  }catch{

    throw new Error(
      'LLM이 올바른 JSON을 반환하지 않았습니다.'
    );

  }

}


/* =========================================================
   PARAM CLEANUP
   ========================================================= */

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

    if(!allowed.has(key)){

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


/* =========================================================
   ENDPOINT
   ========================================================= */

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


/* =========================================================
   WORKFLOW VALIDATION
   ========================================================= */

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


/* =========================================================
   WORKFLOW JSON SCHEMA
   ========================================================= */

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


/* =========================================================
   NODE DEFINITION API
   ========================================================= */

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


/* =========================================================
   HTML / STATIC
   ========================================================= */

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


/* =========================================================
   RETRY PROMPT
   ========================================================= */

function buildRetryPrompt(
  text,
  workflow,
  errorMessage
){

  return `
검증 오류:
${errorMessage}

같은 요청과 Workflow를 기준으로 오류만 수정해 전체 Workflow를 다시 출력한다.
기존 Workflow가 있으면 재사용 가능한 노드와 id를 최대한 유지한다.

사용자 요청:
${text}

현재 Workflow:
${JSON.stringify(
  workflow||null
)}
`;

}
/* =========================================================
   LLM REQUEST
   ========================================================= */

async function requestWorkflow(
  text,
  workflow=null,
  retry=false,
  previousError=""
){

  const userPrompt=
    retry
      ?buildRetryPrompt(
          text,
          workflow,
          previousError
        )
      :[
          "사용자 요청:",
          text,
          "",
          "현재 Workflow:",
          JSON.stringify(
            workflow,
            null,
            2
          )
        ].join("\n");


  const response=
    await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method:"POST",

        headers:{
          "Content-Type":
            "application/json",

          "Authorization":
            `Bearer ${process.env.GROQ_API_KEY}`
        },

        body:JSON.stringify({

          model:
  process.env.GROQ_MODEL||
  "openai/gpt-oss-120b",

          messages:[

            {
              role:"system",
              content:
                SYSTEM_PROMPT
            },

            {
              role:"user",
              content:
                userPrompt
            }

          ],

          temperature:0.2,

          response_format:{
            type:"json_object"
          }

        })
      }
    );


  if(!response.ok){

    const errorText=
      await response.text();

    throw new Error(
      `Groq API 오류: ${response.status} ${errorText}`
    );

  }


  const result=
    await response.json();


  const content=
    result?.choices?.[0]?.message?.content;


  if(
    typeof content!=="string"||
    !content.trim()
  ){

    throw new Error(
      "AI 응답이 비어 있습니다."
    );

  }


  let spec;

  try{

    spec=
      JSON.parse(
        content
      );

  }catch(error){

    throw new Error(
      `AI 응답 JSON 파싱 실패: ${error.message}`
    );

  }


  /*
    AI가 Workflow 자체를 반환하거나
    {workflow:...} 형태로 반환할 수 있으므로
    둘 다 허용한다.
  */
  if(
    spec&&
    typeof spec==="object"&&
    spec.workflow&&
    typeof spec.workflow==="object"
  ){

    spec=
      spec.workflow;

  }


  if(
    !spec||
    typeof spec!=="object"
  ){

    throw new Error(
      "AI가 올바른 Workflow를 반환하지 않았습니다."
    );

  }


  /*
    기본 배열 보정
  */
  if(
    !Array.isArray(
      spec.nodes
    )
  ){

    spec.nodes=[];

  }


  if(
    !Array.isArray(
      spec.links
    )
  ){

    spec.links=[];

  }


  if(
    !Array.isArray(
      spec.data
    )
  ){

    spec.data=[];

  }


  /*
    data는 현재 Canonical Workflow에서
    ["node.port","node.port"] 형태의
    정상 endpoint 연결만 허용한다.

    AI가 객체나 다른 형태를 넣었으면
    잘못된 항목만 제거한다.
  */
  spec.data=
    spec.data.filter(
      edge=>
        Array.isArray(edge)&&
        edge.length===2&&
        typeof edge[0]==="string"&&
        typeof edge[1]==="string"&&
        edge[0].includes(".")&&
        edge[1].includes(".")
    );


  /*
    links 역시 같은 형태만 허용.
  */
  spec.links=
    spec.links.filter(
      edge=>
        Array.isArray(edge)&&
        edge.length===2&&
        typeof edge[0]==="string"&&
        typeof edge[1]==="string"&&
        edge[0].includes(".")&&
        edge[1].includes(".")
    );


  /*
    검증
  */
  return validateWorkflow(
    spec
  );

}

/* =========================================================
   WORKFLOW API
   ========================================================= */

app.post(
  '/api/workflow',
  async(req,res)=>{

    try{

      const text=
        String(
          req.body?.text||
          ''
        ).trim();


      const currentWorkflow=
        req.body?.workflow||
        null;


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
            currentWorkflow
          );

      }catch(firstError){

        console.warn(
          'Workflow validation failed. Retrying once:',
          firstError.message
        );


        workflow=
          await requestWorkflow(
            text,
            currentWorkflow,
            true,
            firstError.message
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


/* =========================================================
   404
   ========================================================= */

app.use(
  (req,res)=>{

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
  ()=>{

    console.log(
      `Server running on http://localhost:${PORT}`
    );

  }
);
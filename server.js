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
   HTML / Static
========================= */

app.get('/',(req,res)=>{
  res.redirect('/home');
});

app.get('/*splat',(req,res,next)=>{

  const htmlFile=
    htmlRoutes[req.path];

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

});


/* =========================
   Workflow Prompt
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

허용 타입:
start
research
organize
judge
write
convert
file
createFile

노드 포트:

start
- inputs: 없음
- outputs: out

research
- inputs: in
- outputs: result

organize
- inputs: in
- outputs: result

judge
- inputs: in
- outputs: true, false

write
- inputs: in
- outputs: result

convert
- inputs: in
- outputs: result

file
- inputs: 없음
- outputs: file

createFile
- inputs: in
- outputs: 없음

중요:
- judge는 반드시 "judge1.in"으로 입력받는다.
- judge의 입력 포트는 truePath나 falsePath가 아니다.
- judge의 출력 포트는 true와 false다.
- 모든 연결은 실제 존재하는 포트만 사용한다.

파라미터:

research
- topic: 조사 주제
- filter: 기간/지역/조건

organize
- criteria: 정리 기준
- format: 정리 형식

judge
- condition: 판단 조건

write
- title: 제목
- length: 분량
- style: 문체
- about: 작성 내용

convert
- instruction: 변환 방법

createFile
- format: 파일 형식
- filename: 파일명

규칙:

- start는 항상 포함한다.
- 필요한 노드만 사용한다.
- 요청에서 알 수 있거나 자연스럽게 추론할 수 있는 params는 최대한 채운다.
- 의미 없는 params는 만들지 않는다.
- 필요 없는 params는 params에서 생략한다.
- 노드 ID는 start, research1, organize1, judge1, write1, convert1, file1, createFile1 형식을 사용한다.
- 모든 nodes 원소는 반드시 객체다.
- nodes 안에 문자열이나 ":"를 절대 넣지 않는다.
- links는 반드시 ["노드ID.출력포트","노드ID.입력포트"] 형식이다.
- ["1","2"] 같은 숫자 연결은 절대 사용하지 않는다.
- 존재하지 않는 포트 이름을 만들지 않는다.
- data는 필요하지 않으면 []이다.

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
`;


/* =========================
   Allowed Nodes
========================= */

const allowedNodes=new Map([

  [
    'start',
    {
      inputs:[],
      outputs:['out']
    }
  ],

  [
    'research',
    {
      inputs:['in'],
      outputs:['result']
    }
  ],

  [
    'organize',
    {
      inputs:['in'],
      outputs:['result']
    }
  ],

  [
    'judge',
    {
      inputs:[
        'in'
      ],
      outputs:[
        'true',
        'false'
      ]
    }
  ],

  [
    'write',
    {
      inputs:['in'],
      outputs:['result']
    }
  ],

  [
    'convert',
    {
      inputs:['in'],
      outputs:['result']
    }
  ],

  [
    'file',
    {
      inputs:[],
      outputs:['file']
    }
  ],

  [
    'createFile',
    {
      inputs:['in'],
      outputs:[]
    }
  ]

]);


/* =========================
   Allowed Param Keys
========================= */

const paramKeys=new Set([
  'topic',
  'filter',
  'criteria',
  'format',
  'condition',
  'title',
  'length',
  'style',
  'about',
  'instruction',
  'filename'
]);


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

function cleanParams(params){

  if(
    !params||
    typeof params!=='object'||
    Array.isArray(params)
  ){

    return {};

  }

  const result={};

  for(
    const key of Object.keys(params)
  ){

    if(
      !paramKeys.has(key)
    ){

      continue;

    }

    const value=params[key];

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

  return {
    node:
      value.slice(
        0,
        i
      ),

    port:
      value.slice(
        i+1
      )
  };

}


/* =========================
   Workflow Validation
========================= */

function validateWorkflow(spec){

  if(
    !spec||
    typeof spec!=='object'
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


  const ids=new Set();


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
      allowedNodes.get(
        node.type
      );


    if(!def){

      throw new Error(
        `존재하지 않는 노드 타입: ${node.type}`
      );

    }


    node.params=
      cleanParams(
        node.params
      );

  }


  function checkEdges(
    edges,
    mode
  ){

    for(
      const edge of edges
    ){

      if(
        !Array.isArray(edge)||
        edge.length!==2
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
          n=>n.id===from.node
        );

      const toNode=
        spec.nodes.find(
          n=>n.id===to.node
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


      const fromDef=
        allowedNodes.get(
          fromNode.type
        );

      const toDef=
        allowedNodes.get(
          toNode.type
        );


      if(
        !fromDef.outputs.includes(
          from.port
        )
      ){

        throw new Error(
          `${mode}: ${fromNode.type}.${from.port}는 존재하지 않는 출력 포트입니다.`
        );

      }


      if(
        !toDef.inputs.includes(
          to.port
        )
      ){

        throw new Error(
          `${mode}: ${toNode.type}.${to.port}는 존재하지 않는 입력 포트입니다.`
        );

      }

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
   JSON Schema
========================= */

const WORKFLOW_SCHEMA={

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

            enum:[
              'start',
              'research',
              'organize',
              'judge',
              'write',
              'convert',
              'file',
              'createFile'
            ]
          },

          params:{
            type:'object',

            additionalProperties:false,

            properties:{

              topic:{
                type:'string'
              },

              filter:{
                type:'string'
              },

              criteria:{
                type:'string'
              },

              format:{
                type:'string'
              },

              condition:{
                type:'string'
              },

              title:{
                type:'string'
              },

              length:{
                type:'string'
              },

              style:{
                type:'string'
              },

              about:{
                type:'string'
              },

              instruction:{
                type:'string'
              },

              filename:{
                type:'string'
              }

            }
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


/* =========================
   LLM Request
========================= */

async function requestWorkflow(
  text,
  retry=false
){

  const prompt=
    retry
      ?`
이전 응답이 Workflow 검증에 실패했다.

반드시 아래 규칙만 지켜서 다시 생성한다.

포트 규칙:
- start: 출력 out
- research: 입력 in / 출력 result
- organize: 입력 in / 출력 result
- judge: 입력 in / 출력 true, false
- write: 입력 in / 출력 result
- convert: 입력 in / 출력 result
- file: 출력 file
- createFile: 입력 in

특히 judge는 반드시 judge.in으로 입력받는다.
judge.truePath와 judge.falsePath는 존재하지 않는다.

연결 형식:
["출발노드.출력포트","도착노드.입력포트"]

- nodes의 모든 원소는 객체
- id는 start/research1/organize1/judge1/write1/convert1/file1/createFile1 같은 형식
- links는 ["node.port","node.port"]
- params는 객체
- 필요한 params는 가능한 한 채운다
- 필요 없는 params는 생략
- 존재하지 않는 포트는 절대 사용하지 않는다
- JSON만 출력

사용자 요청:
${text}
`
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
          req.body?.text||''
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
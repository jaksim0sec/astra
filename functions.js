async function api(
  path,
  headers = {},
  body = null,
  print = false
){
  const res=await fetch(
    "/api/"+path,
    {
      method:body==null?"GET":"POST",

      headers:{
        ...(body!=null?{
          "Content-Type":"application/json"
        }:{}),

        ...headers
      },

      body:
        body==null
          ?null
          :JSON.stringify(body)
    }
  );

  let data;

  try{
    data=await res.json();
  }catch{
    throw new Error(
      `HTTP ${res.status}`
    );
  }

  if(print){
    console.log(
      `/${path} res:`,
      data
    );
  }

  if(!res.ok||data?.ok===false){
    throw new Error(
      data?.error||
      `HTTP ${res.status}`
    );
  }

  return data;
}


/* =========================
   Node Definitions
========================= */

let nodeDefinitionsCache=null;

async function getNodeDefinitions(){

  if(nodeDefinitionsCache){
    return nodeDefinitionsCache;
  }

  const result=
    await api(
      "node-definitions"
    );

  if(
    !result||
    typeof result.nodes!=="object"||
    result.nodes===null||
    Array.isArray(result.nodes)
  ){
    throw new Error(
      "노드 정의 응답이 올바르지 않습니다."
    );
  }

  nodeDefinitionsCache=
    result.nodes;

  /*
    index.html에서도 사용할 수 있도록
    동일한 Canonical Definition을 노출한다.
  */
  window.nodeDefinitions=
    nodeDefinitionsCache;

  return nodeDefinitionsCache;
}


function getNodeDefinitionSync(
  definitions,
  type
){

  if(
    !definitions||
    typeof definitions!=="object"
  ){
    return null;
  }

  return definitions[type]||null;
}


/* =========================
   Definition Helpers
========================= */

function getPortDefinition(
  definition,
  direction,
  portId
){

  if(!definition){
    return null;
  }

  const ports=
    direction==="input"
      ?(
        Array.isArray(
          definition.inputs
        )
          ?definition.inputs
          :[]
      )
      :(
        Array.isArray(
          definition.outputs
        )
          ?definition.outputs
          :[]
      );

  return ports.find(
    port=>
      String(port?.id)===String(portId)
  )||null;
}


function getParamDefinition(
  definition,
  paramId
){

  if(!definition){
    return null;
  }

  const params=
    Array.isArray(
      definition.params
    )
      ?definition.params
      :[];

  return params.find(
    param=>
      String(param?.id)===String(paramId)
  )||null;
}


function normalizeParamsFromDefinition(
  definition,
  params
){

  if(
    !params||
    typeof params!=="object"||
    Array.isArray(params)
  ){
    return {};
  }

  if(!definition){
    return {};
  }

  const result={};

  for(
    const [key,value]
      of Object.entries(params)
  ){

    const param=
      getParamDefinition(
        definition,
        key
      );

    if(!param){
      continue;
    }

    if(
      typeof value==="string"
    ){

      const trimmed=
        value.trim();

      if(trimmed){
        result[key]=trimmed;
      }

      continue;
    }

    /*
      현재 Definition의 파라미터는
      문자열 기반이므로 문자열 이외의 값은
      Canonical Workflow에서 보존하지 않는다.
    */
  }

  return result;
}


/* =========================
   Workflow Endpoint
========================= */

function parseWorkflowEndpoint(
  value
){

  if(
    typeof value!=="string"
  ){

    throw new Error(
      "연결 endpoint가 문자열이 아닙니다."
    );

  }

  const dot=
    value.lastIndexOf(".");

  if(dot===-1){

    throw new Error(
      `포트가 지정되지 않았습니다: ${value}`
    );

  }

  const node=
    value.slice(
      0,
      dot
    );

  const port=
    value.slice(
      dot+1
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

function validateWorkflowForCanvas(
  spec,
  definitions
){

  if(
    !spec||
    typeof spec!=="object"||
    Array.isArray(spec)
  ){

    throw new Error(
      "워크플로우가 없습니다."
    );

  }

  if(
    !Array.isArray(spec.nodes)
  ){

    throw new Error(
      "workflow nodes가 배열이 아닙니다."
    );

  }

  if(
    !Array.isArray(spec.links)
  ){

    throw new Error(
      "workflow links가 배열이 아닙니다."
    );

  }

  if(
    !Array.isArray(spec.data)
  ){

    throw new Error(
      "workflow data가 배열이 아닙니다."
    );

  }


  const nodeMap=
    new Map();


  let startCount=0;


  for(
    const item of spec.nodes
  ){

    if(
      !item||
      typeof item!=="object"||
      Array.isArray(item)||
      typeof item.id!=="string"||
      typeof item.type!=="string"
    ){

      throw new Error(
        "잘못된 workflow 노드입니다."
      );

    }


    if(
      nodeMap.has(item.id)
    ){

      throw new Error(
        `중복된 노드 ID: ${item.id}`
      );

    }


    const definition=
      getNodeDefinitionSync(
        definitions,
        item.type
      );


    if(!definition){

      throw new Error(
        `존재하지 않는 노드 타입: ${item.type}`
      );

    }


    if(
      item.type==="start"
    ){

      startCount++;

    }


    nodeMap.set(
      item.id,
      {
        spec:item,
        definition
      }
    );

  }


  if(
    startCount!==1
  ){

    throw new Error(
      "start 노드는 정확히 하나 있어야 합니다."
    );

  }


  function validateEdges(
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
        typeof edge[0]!=="string"||
        typeof edge[1]!=="string"
      ){

        throw new Error(
          `잘못된 ${mode} 연결입니다.`
        );

      }


      const from=
        parseWorkflowEndpoint(
          edge[0]
        );

      const to=
        parseWorkflowEndpoint(
          edge[1]
        );


      const fromInfo=
        nodeMap.get(
          from.node
        );

      const toInfo=
        nodeMap.get(
          to.node
        );


      if(!fromInfo){

        throw new Error(
          `${mode}: 출발 노드가 없습니다: ${from.node}`
        );

      }


      if(!toInfo){

        throw new Error(
          `${mode}: 도착 노드가 없습니다: ${to.node}`
        );

      }


      const fromPort=
        getPortDefinition(
          fromInfo.definition,
          "output",
          from.port
        );

      if(!fromPort){

        throw new Error(
          `${mode}: ${fromInfo.spec.type}.${from.port}는 존재하지 않는 출력 포트입니다.`
        );

      }


      const toPort=
        getPortDefinition(
          toInfo.definition,
          "input",
          to.port
        );

      if(!toPort){

        throw new Error(
          `${mode}: ${toInfo.spec.type}.${to.port}는 존재하지 않는 입력 포트입니다.`
        );

      }


      const duplicateKey=
        `${edge[0]}->${edge[1]}`;


      if(
        seen.has(
          duplicateKey
        )
      ){

        throw new Error(
          `${mode}: 중복된 연결입니다: ${duplicateKey}`
        );

      }


      seen.add(
        duplicateKey
      );

    }

  }


  validateEdges(
    spec.links,
    "links"
  );

  validateEdges(
    spec.data,
    "data"
  );


  return spec;
}


/* =========================
   Workflow API
========================= */

/* =========================
   Workflow API
========================= */

async function workflowToCanvas(
  text,
  canvasApi
){

  if(
    !text||
    !canvasApi
  ){

    throw new TypeError(
      "작업 내용과 canvas가 필요합니다."
    );

  }


  /*
    Canvas에 넣기 전에
    서버와 동일한 Node Definition을
    한 번 가져온다.
  */
  const definitions=
    await getNodeDefinitions();


  let currentWorkflow=null;


  try{

    const workflow=
      canvasApi.getWorkflow();


    console.log(
      "RAW CANVAS WORKFLOW:",
      JSON.stringify(
        workflow,
        null,
        2
      )
    );


    if(
      workflow&&
      Array.isArray(
        workflow.nodes
      )&&
      workflow.nodes.length>0
    ){

      const connections=
        Array.isArray(
          workflow.connections
        )
          ?workflow.connections
          :[];


      currentWorkflow={

        nodes:
          workflow.nodes.map(
            node=>({

              id:node.id,

              type:node.type,

              params:
                node.data?.params||
                {}

            })
          ),

        links:
          connections
            .filter(
              connection=>
                connection?.from&&
                connection?.to&&
                typeof connection.from.node==="string"&&
                typeof connection.from.port==="string"&&
                typeof connection.to.node==="string"&&
                typeof connection.to.port==="string"
            )
            .map(
              connection=>[
                `${connection.from.node}.${connection.from.port}`,
                `${connection.to.node}.${connection.to.port}`
              ]
            ),

        data:[]

      };

    }


  }catch(error){

    console.warn(
      "현재 Workflow를 읽지 못했습니다:",
      error
    );

    currentWorkflow=null;

  }


  /*
    start 하나만 있는 경우
    실질적으로 비어 있는 Workflow로 취급한다.
  */
  if(
    currentWorkflow&&
    currentWorkflow.nodes.length===1&&
    currentWorkflow.nodes[0]?.id==="start"
  ){

    currentWorkflow=null;

  }


  console.log(
    "CURRENT WORKFLOW:",
    JSON.stringify(
      currentWorkflow,
      null,
      2
    )
  );


  const result=
    await api(
      "workflow",
      {},
      {
        text,
        workflow:
          currentWorkflow
      },
      true
    );


  console.log(
    "WORKFLOW API RESULT:",
    JSON.stringify(
      result,
      null,
      2
    )
  );


  if(
    !result?.workflow
  ){

    throw new Error(
      "워크플로우 응답이 없습니다."
    );

  }


  return workflowIRToCanvas(
    result.workflow,
    canvasApi,
    definitions
  );

}

/* =========================
   Workflow IR → Canvas
========================= */

function workflowIRToCanvas(
  spec,
  canvasApi,
  definitions
){

  if(
    !spec||
    !canvasApi
  ){

    throw new TypeError(
      "workflow spec과 canvas가 필요합니다."
    );

  }


  if(
    !definitions||
    typeof definitions!=="object"
  ){

    throw new Error(
      "노드 정의가 없습니다."
    );

  }


  validateWorkflowForCanvas(
    spec,
    definitions
  );


  const nodes=[];
  const nodeMap=new Map();


  /*
    기존 캔버스 배치 방식 유지
  */
  const spacingX=260;
  const spacingY=140;
  const maxColumns=5;


  /*
    먼저 모든 노드를 생성한다.
  */
  spec.nodes.forEach(
    (item,index)=>{

      const definition=
        getNodeDefinitionSync(
          definitions,
          item.type
        );


      const params=
        normalizeParamsFromDefinition(
          definition,
          item.params
        );


      const node={

        id:item.id,

        type:item.type,

        x:
          (index%maxColumns)*
          spacingX+
          100,

        y:
          Math.floor(index/maxColumns)*
          spacingY+
          100,

        expanded:true,

        data:{
          params
        }

      };


      /*
        파일 노드는
        기존 캔버스의 표시용 name을 유지한다.

        실제 업로드 파일명은
        이후 file node 로직에서 따로
        갱신할 수 있다.
      */
      if(
        item.type==="file"
      ){

        node.data.name=
          params.filename||
          params.name||
          "파일";

      }


      nodes.push(
        node
      );

      nodeMap.set(
        item.id,
        node
      );

    }
  );


  /*
    Canonical Definition 기반으로
    연결을 생성한다.
  */
  const connections=[];

  let connectionSeq=0;


  function createConnection(
    edge,
    kind
  ){

    if(
      !Array.isArray(edge)||
      edge.length!==2
    ){

      throw new Error(
        "잘못된 연결입니다."
      );

    }


    const from=
      parseWorkflowEndpoint(
        edge[0]
      );

    const to=
      parseWorkflowEndpoint(
        edge[1]
      );


    const fromNode=
      nodeMap.get(
        from.node
      );

    const toNode=
      nodeMap.get(
        to.node
      );


    if(!fromNode){

      throw new Error(
        `출발 노드가 없습니다: ${from.node}`
      );

    }


    if(!toNode){

      throw new Error(
        `도착 노드가 없습니다: ${to.node}`
      );

    }


    /*
      여기서 다시 한 번
      실제 Definition 포트를 확인한다.
      서버 검증과 frontend 변환이
      같은 구조를 사용한다.
    */
    const fromDefinition=
      getNodeDefinitionSync(
        definitions,
        fromNode.type
      );

    const toDefinition=
      getNodeDefinitionSync(
        definitions,
        toNode.type
      );


    if(
      !getPortDefinition(
        fromDefinition,
        "output",
        from.port
      )
    ){

      throw new Error(
        `${fromNode.type}.${from.port}는 존재하지 않는 출력 포트입니다.`
      );

    }


    if(
      !getPortDefinition(
        toDefinition,
        "input",
        to.port
      )
    ){

      throw new Error(
        `${toNode.type}.${to.port}는 존재하지 않는 입력 포트입니다.`
      );

    }


    connections.push({

      id:
        `c-ir-${++connectionSeq}`,

      from:{
        node:from.node,
        port:from.port
      },

      to:{
        node:to.node,
        port:to.port
      },

      data:{
        kind
      }

    });

  }


  for(
    const edge of spec.links
  ){

    createConnection(
      edge,
      "flow"
    );

  }


  for(
    const edge of spec.data
  ){

    createConnection(
      edge,
      "data"
    );

  }


  const workflow={

    nodes,

    connections

  };


  /*
    기존 Canvas API 그대로 사용
  */
  canvasApi.setState({
    workflow
  });


  const result=
    canvasApi.getWorkflow();


  console.log(
    "Canvas Workflow:",
    result
  );


  console.table(
    result.nodes.map(
      node=>({

        id:node.id,

        type:node.type,

        params:
          JSON.stringify(
            node.data?.params||
            {}
          )

      })
    )
  );


  return result;
}


/* =========================
   Definition Cache Reset
========================= */

window.reloadNodeDefinitions=
  function(){

    nodeDefinitionsCache=
      null;

    delete window.nodeDefinitions;

    return getNodeDefinitions();

  };


/* =========================
   Test Workflow
========================= */

window.testWorkflow=async function(

  text=`최근 고라니의 개체수 변화에 대해 조사하고,
조사 결과를 정리해서
"고라니 개체수 변화 보고서"라는 제목의 보고서를 작성한 뒤
PDF로 변환해서 파일로 만들어줘`

){

  try{

    /*
      visualCanvas가 아직 준비되지 않은 경우
      명확한 에러를 반환한다.
    */
    if(
      !window.visualCanvas
    ){

      throw new Error(
        "visualCanvas가 아직 준비되지 않았습니다."
      );

    }


    /*
      Definition API가 정상적으로
      동작하는지도 함께 확인한다.
    */
    await getNodeDefinitions();


    const workflow=
      await workflowToCanvas(
        text,
        window.visualCanvas
      );


    console.log(
      "Workflow:",
      workflow
    );


    return workflow;

  }catch(error){

    console.error(
      "Workflow ERROR:",
      error
    );

    throw error;

  }

};


/* =========================
   Initial Definition Load
========================= */

(async function(){

  try{

    await getNodeDefinitions();

  }catch(error){

    /*
      서버가 잠시 준비되지 않은 경우에도
      기존 페이지 자체가 바로 죽지 않도록 한다.
    */
    console.warn(
      "Node Definition loading failed:",
      error
    );

  }

})();


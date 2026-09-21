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


      const validConnections =
  connections.filter(
    connection=>
      connection?.from&&
      connection?.to&&
      typeof connection.from.node==="string"&&
      typeof connection.from.port==="string"&&
      typeof connection.to.node==="string"&&
      typeof connection.to.port==="string"
  );

currentWorkflow={

  nodes:
    workflow.nodes.map(
      node=>({
        id:node.id,
        type:node.type,
        params:node.data?.params||{}
      })
    ),

  links:
    validConnections
      .filter(
        connection=>
          connection.data?.kind!=="data"
      )
      .map(
        connection=>[
          `${connection.from.node}.${connection.from.port}`,
          `${connection.to.node}.${connection.to.port}`
        ]
      ),

  data:
    validConnections
      .filter(
        connection=>
          connection.data?.kind==="data"
      )
      .map(
        connection=>[
          `${connection.from.node}.${connection.from.port}`,
          `${connection.to.node}.${connection.to.port}`
        ]
      )

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


  const workflow=
    workflowIRToCanvas(
      result.workflow,
      canvasApi,
      definitions
    );


  return {

    workflow,

    message:
      typeof result.message==="string"
        ?result.message
        :"",

    question:
      result.question===null||
      typeof result.question==="string"
        ?result.question
        :null

  };

}

/* =========================
   Workflow IR → Canvas
========================= */

function workflowIRToCanvas(
  spec,
  canvasApi,
  definitions
){
  if(!spec||!canvasApi){
    throw new TypeError(
      "workflow spec과 canvas가 필요합니다."
    );
  }

  if(!definitions||typeof definitions!=="object"){
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
  const nodeIndex=new Map();
  const sizeMap=new Map();

  const GAP_Y=36;
  const GAP_X_MIN=54;
  const GAP_X_MAX=110;
  const RELAX_PASSES=6;

  function pickNumber(...values){
    for(const value of values){
      const number=Number(value);

      if(
        Number.isFinite(number)&&
        number>0
      ){
        return number;
      }
    }

    return null;
  }

  function getNodeSize(item,definition){
    if(
      typeof canvasApi.getNodeSize==="function"
    ){
      try{
        const measured=
          canvasApi.getNodeSize(item.id);

        if(measured){
          const width=
            pickNumber(
              measured.width,
              measured.w
            );

          const height=
            pickNumber(
              measured.height,
              measured.h
            );

          if(width&&height){
            return{
              width,
              height
            };
          }
        }
      }catch{}
    }

    const width=
      pickNumber(
        item.width,
        item.size?.width,
        item.layout?.width,
        definition.width,
        definition.size?.width,
        definition.layout?.width,
        definition.ui?.width,
        definition.canvas?.width
      )||190;

    const height=
      pickNumber(
        item.height,
        item.size?.height,
        item.layout?.height,
        definition.height,
        definition.size?.height,
        definition.layout?.height,
        definition.ui?.height,
        definition.canvas?.height
      )||74;

    return{
      width,
      height
    };
  }

  function getViewportCenter(){
    const canvas=
      canvasApi.root?.querySelector(
        ".vc-canvas"
      );

    const rect=
      canvas?.getBoundingClientRect();

    const state=
      typeof canvasApi.getState==="function"
        ?canvasApi.getState()
        :null;

    const scale=
      Number(
        state?.viewport?.scale
      )||1;

    const offsetX=
      Number(
        state?.viewport?.offset?.x
      )||0;

    const offsetY=
      Number(
        state?.viewport?.offset?.y
      )||0;

    if(!rect){
      return{
        x:0,
        y:0
      };
    }

    return{
      x:(
        rect.width/2-
        offsetX
      )/scale,

      y:(
        rect.height/2-
        offsetY
      )/scale
    };
  }

  for(
    const [index,item]
    of spec.nodes.entries()
  ){
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

    const size=
      getNodeSize(
        item,
        definition
      );

    const node={
      id:item.id,
      type:item.type,
      x:0,
      y:0,
      expanded:true,
      data:{
        params
      }
    };

    if(item.type==="file"){
      node.data.name=
        params.filename||
        params.name||
        "파일";
    }

    nodes.push(node);

    nodeMap.set(
      item.id,
      node
    );

    nodeIndex.set(
      item.id,
      index
    );

    sizeMap.set(
      item.id,
      {
        width:size.width,
        height:size.height
      }
    );
  }

  const flowEdges=[];
  const dataEdges=[];

  for(const edge of spec.links){
    const from=
      parseWorkflowEndpoint(
        edge[0]
      );

    const to=
      parseWorkflowEndpoint(
        edge[1]
      );

    flowEdges.push({
      from:from.node,
      to:to.node
    });
  }

  for(const edge of spec.data){
    const from=
      parseWorkflowEndpoint(
        edge[0]
      );

    const to=
      parseWorkflowEndpoint(
        edge[1]
      );

    dataEdges.push({
      from:from.node,
      to:to.node
    });
  }

  const incoming=new Map();
  const outgoing=new Map();

  for(const node of nodes){
    incoming.set(
      node.id,
      []
    );

    outgoing.set(
      node.id,
      []
    );
  }

  for(const edge of flowEdges){
    if(
      !incoming.has(edge.to)||
      !outgoing.has(edge.from)
    ){
      continue;
    }

    incoming
      .get(edge.to)
      .push(edge.from);

    outgoing
      .get(edge.from)
      .push(edge.to);
  }

  /*
    flow rank
  */
  const indegree=new Map();
  const rank=new Map();

  for(const node of nodes){
    indegree.set(
      node.id,
      incoming.get(node.id).length
    );

    rank.set(
      node.id,
      0
    );
  }

  const queue=[];

  for(const node of nodes){
    if(
      indegree.get(node.id)===0
    ){
      queue.push(node.id);
    }
  }

  let queueIndex=0;

  while(
    queueIndex<
    queue.length
  ){
    const id=
      queue[queueIndex++];

    const currentRank=
      rank.get(id)||0;

    for(
      const nextId
      of outgoing.get(id)||[]
    ){
      const nextRank=
        currentRank+1;

      if(
        nextRank>
        (rank.get(nextId)||0)
      ){
        rank.set(
          nextId,
          nextRank
        );
      }

      const nextDegree=
        indegree.get(nextId)-1;

      indegree.set(
        nextId,
        nextDegree
      );

      if(nextDegree===0){
        queue.push(nextId);
      }
    }
  }

  let maxRank=0;

  for(const value of rank.values()){
    maxRank=
      Math.max(
        maxRank,
        value
      );
  }

  /*
    cycle nodes
  */
  for(const node of nodes){
    if(
      indegree.get(node.id)>0
    ){
      if(
        rank.get(node.id)===0
      ){
        rank.set(
          node.id,
          ++maxRank
        );
      }
    }
  }

  const layers=new Map();

  for(const node of nodes){
    const layer=
      rank.get(node.id)||0;

    if(!layers.has(layer)){
      layers.set(
        layer,
        []
      );
    }

    layers
      .get(layer)
      .push(node);
  }

  const sortedLayers=
    [...layers.keys()]
      .sort(
        (a,b)=>a-b
      );

  function nodeHeight(node){
    return(
      sizeMap.get(node.id)?.height||
      74
    );
  }

  function nodeWidth(node){
    return(
      sizeMap.get(node.id)?.width||
      190
    );
  }

  const centerMap=new Map();

  /*
    현재 레이어의 flow 이웃만 가져옴
    data 연결은 배치 방향을 결정하지 않음
  */
  function getFlowNeighbors(
    node,
    targetLayer
  ){
    const result=[];

    for(const edge of flowEdges){
      if(
        edge.from===node.id&&
        rank.get(edge.to)===targetLayer
      ){
        result.push(edge.to);
      }

      if(
        edge.to===node.id&&
        rank.get(edge.from)===targetLayer
      ){
        result.push(edge.from);
      }
    }

    return result;
  }

  function median(values){
    if(!values.length){
      return null;
    }

    const sorted=
      [...values].sort(
        (a,b)=>a-b
      );

    const middle=
      Math.floor(
        sorted.length/2
      );

    if(
      sorted.length%2
    ){
      return sorted[middle];
    }

    return(
      (
        sorted[middle-1]+
        sorted[middle]
      )/2
    );
  }

  /*
    레이어 하나를 실제 높이 기준으로
    절대 겹치지 않게 배치
  */
  function packLayer(
    layer,
    targetCenters
  ){
    if(!layer.length){
      return;
    }

    const placed=[];

    let previousBottom=
      -Infinity;

    for(
      let i=0;
      i<layer.length;
      i++
    ){
      const node=
        layer[i];

      const height=
        nodeHeight(node);

      let center=
        Number(
          targetCenters[i]
        );

      if(!Number.isFinite(center)){
        center=
          centerMap.get(node.id)||0;
      }

      if(
        previousBottom!==
        -Infinity
      ){
        const minCenter=
          previousBottom+
          GAP_Y+
          height/2;

        center=
          Math.max(
            center,
            minCenter
          );
      }

      placed.push({
        node,
        center,
        height
      });

      previousBottom=
        center+
        height/2;
    }

    /*
      전체 레이어의 중심만 이동
      이동은 간격을 깨지 않음
    */
    let desiredMean=0;
    let actualMean=0;

    for(
      let i=0;
      i<placed.length;
      i++
    ){
      desiredMean+=
        Number(
          targetCenters[i]
        )||0;

      actualMean+=
        placed[i].center;
    }

    desiredMean/=
      placed.length;

    actualMean/=
      placed.length;

    const shift=
      desiredMean-
      actualMean;

    for(const item of placed){
      centerMap.set(
        item.node.id,
        item.center+
        shift
      );
    }
  }

  /*
    초기 배치
  */
  function initializeCenters(){
    for(
      const layerNumber
      of sortedLayers
    ){
      const layer=
        layers.get(layerNumber);

      let totalHeight=0;

      for(
        let i=0;
        i<layer.length;
        i++
      ){
        totalHeight+=
          nodeHeight(
            layer[i]
          );

        if(i>0){
          totalHeight+=GAP_Y;
        }
      }

      let cursor=
        -totalHeight/2;

      for(const node of layer){
        const height=
          nodeHeight(node);

        centerMap.set(
          node.id,
          cursor+
          height/2
        );

        cursor+=
          height+
          GAP_Y;
      }
    }
  }

  /*
    레이어 간 순서를 잡고
    실제 높이까지 반영해 세로 배치
  */
  function layoutVertical(){
    initializeCenters();

    for(
      let pass=0;
      pass<RELAX_PASSES;
      pass++
    ){
      const forward=
        pass%2===0;

      const order=
        forward
          ?sortedLayers
          :[...sortedLayers].reverse();

      /*
        먼저 순서 결정
      */
      for(
        const layerNumber
        of order
      ){
        const layer=
          layers.get(layerNumber);

        const targetLayer=
          forward
            ?layerNumber-1
            :layerNumber+1;

        if(
          !layers.has(targetLayer)
        ){
          continue;
        }

        const scored=
          layer.map(
            (node,index)=>{
              const neighbors=
                getFlowNeighbors(
                  node,
                  targetLayer
                );

              if(!neighbors.length){
                return{
                  node,
                  score:
                    centerMap.get(
                      node.id
                    )||
                    0,
                  index
                };
              }

              const centers=[];

              for(
                const id
                of neighbors
              ){
                const center=
                  centerMap.get(id);

                if(
                  Number.isFinite(center)
                ){
                  centers.push(center);
                }
              }

              return{
                node,
                score:
                  median(centers)??(
                    centerMap.get(
                      node.id
                    )||
                    0
                  ),
                index
              };
            }
          );

        scored.sort(
          (a,b)=>{
            if(
              a.score===
              b.score
            ){
              return(
                a.index-
                b.index
              );
            }

            return(
              a.score-
              b.score
            );
          }
        );

        layers.set(
          layerNumber,
          scored.map(
            item=>item.node
          )
        );
      }

      /*
        순서가 결정된 상태에서
        높이 기준으로 다시 packing
      */
      for(
        const layerNumber
        of order
      ){
        const layer=
          layers.get(layerNumber);

        const targetLayer=
          forward
            ?layerNumber-1
            :layerNumber+1;

        const targets=[];

        for(const node of layer){
          const current=
            centerMap.get(
              node.id
            )||
            0;

          if(
            !layers.has(targetLayer)
          ){
            targets.push(
              current
            );

            continue;
          }

          const neighbors=
            getFlowNeighbors(
              node,
              targetLayer
            );

          const centers=[];

          for(
            const id
            of neighbors
          ){
            const value=
              centerMap.get(id);

            if(
              Number.isFinite(value)
            ){
              centers.push(value);
            }
          }

          const neighborCenter=
            median(centers);

          if(
            neighborCenter===null
          ){
            targets.push(
              current
            );

            continue;
          }

          /*
            한 번에 확 끌어당기지 않고
            현재 위치도 조금 유지
          */
          targets.push(
            current*0.30+
            neighborCenter*0.70
          );
        }

        packLayer(
          layer,
          targets
        );
      }
    }

    /*
      마지막으로 양쪽 이웃을 기준으로
      한 번만 정리
    */
    for(
      const layerNumber
      of sortedLayers
    ){
      const layer=
        layers.get(layerNumber);

      const targets=[];

      for(const node of layer){
        const current=
          centerMap.get(
            node.id
          )||
          0;

        const neighbors=[];

        const prev=
          getFlowNeighbors(
            node,
            layerNumber-1
          );

        const next=
          getFlowNeighbors(
            node,
            layerNumber+1
          );

        for(const id of prev){
          const value=
            centerMap.get(id);

          if(
            Number.isFinite(value)
          ){
            neighbors.push(value);
          }
        }

        for(const id of next){
          const value=
            centerMap.get(id);

          if(
            Number.isFinite(value)
          ){
            neighbors.push(value);
          }
        }

        const target=
          median(neighbors);

        targets.push(
          target===null
            ?current
            :current*0.45+
              target*0.55
        );
      }

      packLayer(
        layer,
        targets
      );
    }
  }

  /*
    열 폭
  */
  const columnWidths=new Map();

  function rebuildColumns(){
    for(
      const layerNumber
      of sortedLayers
    ){
      const layer=
        layers.get(layerNumber);

      let width=190;

      for(const node of layer){
        width=
          Math.max(
            width,
            nodeWidth(node)
          );
      }

      columnWidths.set(
        layerNumber,
        width
      );
    }
  }

  const columnX=new Map();

  function rebuildColumnX(){
    let x=0;

    for(
      const layerNumber
      of sortedLayers
    ){
      const width=
        columnWidths.get(
          layerNumber
        )||190;

      columnX.set(
        layerNumber,
        x
      );

      const gap=
        Math.max(
          GAP_X_MIN,
          Math.min(
            GAP_X_MAX,
            width*0.28
          )
        );

      x+=
        width+
        gap;
    }
  }

  function buildRects(){
    const rects=[];

    for(
      const layerNumber
      of sortedLayers
    ){
      const layer=
        layers.get(layerNumber);

      const x=
        columnX.get(
          layerNumber
        )||0;

      for(const node of layer){
        const width=
          nodeWidth(node);

        const height=
          nodeHeight(node);

        const center=
          centerMap.get(
            node.id
          )||
          0;

        rects.push({
          node,
          x,
          y:center-height/2,
          width,
          height
        });
      }
    }

    return rects;
  }

  /*
    세로는 이미 layer packing에서
    보장되므로 여기서는 viewport 중앙 정렬만 함
  */
  function applyViewportCenter(
    rects
  ){
    if(!rects.length){
      return;
    }

    let minX=Infinity;
    let minY=Infinity;
    let maxX=-Infinity;
    let maxY=-Infinity;

    for(const rect of rects){
      minX=
        Math.min(
          minX,
          rect.x
        );

      minY=
        Math.min(
          minY,
          rect.y
        );

      maxX=
        Math.max(
          maxX,
          rect.x+
          rect.width
        );

      maxY=
        Math.max(
          maxY,
          rect.y+
          rect.height
        );
    }

    const viewport=
      getViewportCenter();

    const workflowCenterX=
      (minX+maxX)/2;

    const workflowCenterY=
      (minY+maxY)/2;

    const offsetX=
      viewport.x-
      workflowCenterX;

    const offsetY=
  viewport.y-
  workflowCenterY-
  60;

    for(const rect of rects){
      rect.node.x=
        Math.round(
          rect.x+
          offsetX
        );

      rect.node.y=
        Math.round(
          rect.y+
          offsetY
        );
    }
  }

  function layoutWorkflow(){
    layoutVertical();
    rebuildColumns();
    rebuildColumnX();

    const rects=
      buildRects();

    applyViewportCenter(
      rects
    );
  }

  /*
    실제 연결
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

  for(const edge of spec.links){
    createConnection(
      edge,
      "flow"
    );
  }

  for(const edge of spec.data){
    createConnection(
      edge,
      "data"
    );
  }

  /*
    최초 추정 크기로 렌더
  */
  layoutWorkflow();

  const workflow={
    nodes,
    connections
  };

  canvasApi.setState({
    workflow
  });

  /*
    실제 DOM 크기 측정 후
    변경된 경우 동일한 배치 알고리즘으로 재계산
  */
  function scheduleMeasuredReflow(){
    const run=()=>{
      let changed=false;

      for(const node of nodes){
        const definition=
          getNodeDefinitionSync(
            definitions,
            node.type
          );

        const measured=
          getNodeSize(
            node,
            definition
          );

        const previous=
          sizeMap.get(
            node.id
          );

        if(!previous){
          sizeMap.set(
            node.id,
            measured
          );

          changed=true;
          continue;
        }

        if(
          Math.abs(
            previous.width-
            measured.width
          )>2||
          Math.abs(
            previous.height-
            measured.height
          )>2
        ){
          sizeMap.set(
            node.id,
            measured
          );

          changed=true;
        }
      }

      if(!changed){
        return;
      }

      layoutWorkflow();

      canvasApi.setState({
        workflow:{
          nodes,
          connections
        }
      });
    };

    if(
      typeof requestAnimationFrame===
      "function"
    ){
      requestAnimationFrame(()=>{
        requestAnimationFrame(
          run
        );
      });
    }else{
      setTimeout(
        run,
        0
      );
    }
  }

  scheduleMeasuredReflow();

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
        x:node.x,
        y:node.y,
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


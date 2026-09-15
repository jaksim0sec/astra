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

  const data=await res.json();

  if(print){
    console.log(`/${path} res:`,data);
  }

  if(!res.ok||data?.ok===false){
    throw new Error(
      data?.error||
      `HTTP ${res.status}`
    );
  }

  return data;
}


function normalizeWorkflowParams(
  type,
  params
){
  const source=
    params&&
    typeof params==='object'&&
    !Array.isArray(params)
      ?params
      :{};

  const result={};


  /*
    research

    LLM:
    {
      query:"고라니 개체수 변화"
    }

    Canvas:
    {
      topic:"고라니 개체수 변화"
    }
  */

  if(type==='research'){

    if(source.topic!=null){
      result.topic=String(
        source.topic
      );
    }

    if(source.query!=null){
      result.topic=String(
        source.query
      );
    }

    if(source.filter!=null){
      result.filter=String(
        source.filter
      );
    }

  }


  /*
    organize

    Canvas:
    criteria
    format
  */

  else if(type==='organize'){

    if(source.criteria!=null){
      result.criteria=String(
        source.criteria
      );
    }

    if(source.format!=null){
      result.format=String(
        source.format
      );
    }

    if(source.query!=null){
      result.criteria=String(
        source.query
      );
    }

  }


  /*
    write

    Canvas:
    title
    length
    style
    about
  */

  else if(type==='write'){

    if(source.title!=null){
      result.title=String(
        source.title
      );
    }

    if(source.length!=null){
      result.length=String(
        source.length
      );
    }

    if(source.style!=null){
      result.style=String(
        source.style
      );
    }

    if(source.about!=null){
      result.about=String(
        source.about
      );
    }

    if(source.content!=null){
      result.about=String(
        source.content
      );
    }

  }


  /*
    convert

    Canvas:
    instruction

    LLM:
    {
      format:"pdf"
    }

    →
    {
      instruction:"PDF로 변환"
    }
  */

  else if(type==='convert'){

    if(source.instruction!=null){
      result.instruction=String(
        source.instruction
      );
    }

    if(source.format!=null){

      const format=
        String(source.format);

      result.instruction=
        `${format.toUpperCase()}로 변환`;

    }

  }


  /*
    createFile

    Canvas:
    format
    filename
  */

  else if(type==='createFile'){

    if(source.format!=null){
      result.format=String(
        source.format
      );
    }

    if(source.filename!=null){
      result.filename=String(
        source.filename
      );
    }

    if(source.name!=null){
      result.filename=String(
        source.name
      );
    }

  }


  /*
    기타 노드

    정의되지 않은 params는
    그대로 보존
  */

  else{

    Object.assign(
      result,
      source
    );

  }


  return result;
}


async function workflowToCanvas(
  text,
  canvasApi
){
  if(!text||!canvasApi){
    throw new TypeError(
      '작업 내용과 canvas가 필요합니다.'
    );
  }

  const result=await api(
    "workflow",
    {},
    {text},
    true
  );

  if(!result?.workflow){
    throw new Error(
      '워크플로우 응답이 없습니다.'
    );
  }

  return workflowIRToCanvas(
    result.workflow,
    canvasApi
  );
}


function workflowIRToCanvas(
  spec,
  canvasApi
){
  if(!spec||!canvasApi){
    throw new TypeError(
      'workflow spec과 canvas가 필요합니다.'
    );
  }

  if(!Array.isArray(spec.nodes)){
    throw new TypeError(
      'workflow nodes가 배열이 아닙니다.'
    );
  }


  const nodes=[];
  const nodeMap=new Map();

  const spacingX=260;
  const spacingY=140;
  const maxColumns=5;


  /*
    먼저 모든 노드 생성
  */

  spec.nodes.forEach(
    (item,index)=>{

      if(
        !item||
        typeof item.id!=='string'||
        typeof item.type!=='string'
      ){
        throw new Error(
          '잘못된 workflow 노드입니다.'
        );
      }


      const params=
        normalizeWorkflowParams(
          item.type,
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

        /*
          중요:

          캔버스 renderSlotContent()가
          n.data.params를 읽는다.
        */

        data:{
          params
        }

      };


      if(item.type==='file'){

        node.data.name=
          params.name||
          '파일';

      }


      nodes.push(node);

      nodeMap.set(
        item.id,
        node
      );

    }
  );


  /*
    convert의 format을
    뒤의 createFile에도 전달

    예:
    convert1.params.format = "pdf"

    →
    convert1.data.params.instruction
      = "PDF로 변환"

    →
    createFile1.data.params.format
      = "pdf"
  */

  for(
    let i=0;
    i<nodes.length;
    i++
  ){

    const node=nodes[i];

    if(
      node.type!=='convert'
    ){
      continue;
    }


    const instruction=
      node.data?.params?.instruction||
      '';


    const format=
      spec.nodes[i]?.params?.format;


    if(!format){
      continue;
    }


    const next=
      nodes[i+1];


    if(
      next&&
      next.type==='createFile'
    ){

      next.data.params.format=
        String(format).toUpperCase();

    }

  }


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
        '잘못된 연결입니다.'
      );
    }


    const [fromRaw,toRaw]=edge;


    if(
      typeof fromRaw!=='string'||
      typeof toRaw!=='string'
    ){
      throw new Error(
        '연결 endpoint가 문자열이 아닙니다.'
      );
    }


    const fromDot=
      fromRaw.lastIndexOf('.');

    const toDot=
      toRaw.lastIndexOf('.');


    if(
      fromDot===-1||
      toDot===-1
    ){
      throw new Error(
        `포트를 찾을 수 없습니다: ${fromRaw} → ${toRaw}`
      );
    }


    const fromNode=
      fromRaw.slice(
        0,
        fromDot
      );

    const fromPort=
      fromRaw.slice(
        fromDot+1
      );


    const toNode=
      toRaw.slice(
        0,
        toDot
      );

    const toPort=
      toRaw.slice(
        toDot+1
      );


    if(!nodeMap.has(fromNode)){
      throw new Error(
        `출발 노드가 없습니다: ${fromNode}`
      );
    }


    if(!nodeMap.has(toNode)){
      throw new Error(
        `도착 노드가 없습니다: ${toNode}`
      );
    }


    connections.push({

      id:
        `c-ir-${++connectionSeq}`,

      from:{
        node:fromNode,
        port:fromPort
      },

      to:{
        node:toNode,
        port:toPort
      },

      data:{
        kind
      }

    });

  }


  for(
    const edge of spec.links||[]
  ){

    createConnection(
      edge,
      'flow'
    );

  }


  for(
    const edge of spec.data||[]
  ){

    createConnection(
      edge,
      'data'
    );

  }


  const workflow={

    nodes,

    connections

  };


  /*
    Canvas state에 적용
  */

  canvasApi.setState({
    workflow
  });


  const result=
    canvasApi.getWorkflow();


  console.log(
    'Canvas Workflow:',
    result
  );


  console.table(
    result.nodes.map(
      node=>({

        id:node.id,

        type:node.type,

        params:
          JSON.stringify(
            node.data?.params||{}
          )

      })
    )
  );


  return result;
}


window.testWorkflow=async function(

  text=`최근 고라니의 개체수 변화에 대해 조사하고,
조사 결과를 정리해서
"고라니 개체수 변화 보고서"라는 제목의 보고서를 작성한 뒤
PDF로 변환해서 파일로 만들어줘`

){

  try{

    const workflow=
      await workflowToCanvas(
        text,
        window.visualCanvas
      );


    console.log(
      'Workflow:',
      workflow
    );


    return workflow;

  }catch(error){

    console.error(
      'Workflow ERROR:',
      error
    );

    throw error;

  }

};
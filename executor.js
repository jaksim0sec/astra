(() => {
  'use strict';

  async function runWorkflowNode(node, inputs = {}) {
    if (!node || typeof node !== 'object') {
      throw new TypeError('실행할 node가 없습니다.');
    }

    const params =
      node.params &&
      typeof node.params === 'object'
        ? node.params
        : {};

    switch (node.type) {
      case 'start':
        return {
          outputs: {
            out: true
          }
        };

      case 'file':
        return {
          outputs: {
            file: {
              name:
                params.name ||
                '예시 파일',
              type:
                params.format ||
                'example',
              content:
                '사용자 제공 파일의 예시 내용'
            }
          }
        };

      case 'research':
        return {
          outputs: {
            result: {
              topic:
                params.topic ||
                '예시 주제',
              filter:
                params.filter ||
                '',
              items: [
                {
                  title: '예시 자료 1',
                  summary:
                    '조사 결과 예시입니다.'
                },
                {
                  title: '예시 자료 2',
                  summary:
                    '두 번째 조사 결과 예시입니다.'
                }
              ]
            }
          }
        };

      case 'organize':
        return {
          outputs: {
            result: {
              criteria:
                params.criteria ||
                '일반 기준',
              format:
                params.format ||
                '목록',
              source:
                inputs.in ?? null
            }
          }
        };

      case 'judge': {
        const condition =
          String(
            params.condition || ''
          )
            .trim()
            .toLowerCase();

        const decision = !(
          condition === 'false' ||
          condition.includes('거짓') ||
          condition.includes('아니')
        );

        return {
          decision,
          outputs: {
            true: decision,
            false: !decision
          }
        };
      }

      case 'write':
        return {
          outputs: {
            result: {
              title:
                params.title ||
                '예시 문서',
              length:
                params.length ||
                '기본 분량',
              style:
                params.style ||
                '일반',
              about:
                params.about ||
                '',
              source:
                inputs.in ?? null,
              content:
                `${params.title || '예시 문서'}\n\n예시 작성 결과입니다.`
            }
          }
        };

      case 'convert':
        return {
          outputs: {
            result: {
              instruction:
                params.instruction ||
                '형식 변환',
              source:
                inputs.in ?? null,
              converted: true
            }
          }
        };

      case 'createFile':
        return {
          outputs: {},
          file: {
            format:
              params.format ||
              'PDF',
            filename:
              params.filename ||
              '결과물',
            source:
              inputs.in ?? null,
            mock: true
          }
        };

      default:
        throw new Error(
          `지원하지 않는 node type입니다: ${node.type}`
        );
    }
  }

  class WorkflowExecutor {
    constructor(options = {}) {
      this.runner =
        typeof options.runner === 'function'
          ? options.runner
          : runWorkflowNode;
    }

    async run(
      node,
      inputs = {},
      context = {}
    ) {
      const startedAt =
        Date.now();

      const result =
        await this.runner(
          node,
          inputs,
          context
        );

      return {
        nodeId:
          String(node.id),

        type:
          String(node.type),

        outputs:
          result?.outputs &&
          typeof result.outputs === 'object'
            ? result.outputs
            : {},

        decision:
          typeof result?.decision === 'boolean'
            ? result.decision
            : null,

        file:
          result?.file ?? null,

        duration:
          Date.now() -
          startedAt
      };
    }
  }

  window.runWorkflowNode =
    runWorkflowNode;

  window.WorkflowExecutor =
    WorkflowExecutor;
})();

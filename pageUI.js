(function () {
  'use strict';


  /* =========================================================
     Astra Page UI
     ---------------------------------------------------------
     공용 페이지 UI / viewport 제어
     ========================================================= */


  let started = false;
  let rafId = 0;


  /* =========================================================
     VIEWPORT
     ========================================================= */

  function getViewportHeight() {

    const visualHeight =
      window.visualViewport?.height;

    if (
      Number.isFinite(visualHeight) &&
      visualHeight > 0
    ) {
      return visualHeight;
    }

    const innerHeight =
      window.innerHeight;

    if (
      Number.isFinite(innerHeight) &&
      innerHeight > 0
    ) {
      return innerHeight;
    }

    return document.documentElement.clientHeight;
  }


  function syncViewport() {

    const height =
      Math.round(
        getViewportHeight()
      );

    if (
      !Number.isFinite(height) ||
      height <= 0
    ) {
      return;
    }

    const root =
      document.documentElement;

    root.style.setProperty(
      '--real-vh',
      `${height}px`
    );

    root.style.setProperty(
      '--viewport-height',
      `${height}px`
    );

    /*
      1vh 기반 계산이 필요한 경우를 위한 값
    */
    root.style.setProperty(
      '--real-vh-unit',
      `${height * 0.01}px`
    );
  }


  function requestViewportSync() {

    if (rafId) {
      return;
    }

    rafId =
      requestAnimationFrame(() => {

        rafId = 0;

        syncViewport();

      });
  }


  /* =========================================================
     EVENT LISTENERS
     ========================================================= */

  function bindViewportEvents() {

    window.addEventListener(
      'resize',
      requestViewportSync,
      {
        passive:true
      }
    );


    window.addEventListener(
      'orientationchange',
      requestViewportSync,
      {
        passive:true
      }
    );


    window.addEventListener(
      'pageshow',
      requestViewportSync,
      {
        passive:true
      }
    );


    window.visualViewport?.addEventListener(
      'resize',
      requestViewportSync,
      {
        passive:true
      }
    );


    window.visualViewport?.addEventListener(
      'scroll',
      requestViewportSync,
      {
        passive:true
      }
    );


    /*
      모바일 키보드가 열리고 닫힐 때
      일부 브라우저에서 resize 이벤트가
      늦게 들어오는 경우를 보정
    */
    document.addEventListener(
      'focusin',
      requestViewportSync,
      {
        passive:true
      }
    );


    document.addEventListener(
      'focusout',
      requestViewportSync,
      {
        passive:true
      }
    );
  }


  /* =========================================================
     PUBLIC API
     ========================================================= */

  function start() {

    if (started) {
      requestViewportSync();
      return;
    }

    started = true;

    syncViewport();

    bindViewportEvents();

  }


  function getHeight() {

    return getViewportHeight();

  }


  function getWidth() {

    const visualWidth =
      window.visualViewport?.width;

    if (
      Number.isFinite(visualWidth) &&
      visualWidth > 0
    ) {
      return visualWidth;
    }

    return window.innerWidth;

  }


  /* =========================================================
     GLOBAL
     ========================================================= */

  window.pageUI = {

    viewport: {

      start,

      sync:
        syncViewport,

      getHeight,

      getWidth

    }

  };


  /* =========================================================
     AUTO START
     ========================================================= */

  start();

})();
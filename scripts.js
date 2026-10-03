(function () {
  // ===== CONFIGURAÇÃO =====
  var ATIVO = true; // false = desbloqueia tudo (kill switch)
  var VIDEO_ID = "db6QIx11vMA";
  var TITULO = "Fórum temporariamente bloqueado";
  var MENSAGEM = "A navegação está indisponível no momento. Clique em qualquer lugar para ativar o som.";
  // ========================

  if (!ATIVO) {
    var css = document.getElementById("bf-css");
    if (css) css.remove();
    return;
  }

  var ESTILO =
    "position:fixed!important;top:0!important;left:0!important;right:0!important;bottom:0!important;" +
    "width:100%!important;height:100%!important;z-index:2147483647!important;" +
    "display:block!important;visibility:visible!important;opacity:1!important;" +
    "pointer-events:auto!important;transform:none!important;";

  var host = null;
  var iframe = null;
  var estiloAtual = "";

  function montar() {
    host = document.createElement("div");
    var raiz = host.attachShadow({ mode: "closed" });
    raiz.innerHTML =
      "<div style='position:relative;width:100%;height:100%;background:#000;overflow:hidden'>" +
        "<iframe src='https://www.youtube.com/embed/" + VIDEO_ID +
        "?autoplay=1&mute=1&controls=0&loop=1&playlist=" + VIDEO_ID +
        "&playsinline=1&modestbranding=1&rel=0&disablekb=1&iv_load_policy=3&enablejsapi=1' " +
        "allow='autoplay; encrypted-media' " +
        "style='position:absolute;top:50%;left:50%;width:max(100vw,177.78vh);height:max(100vh,56.25vw);" +
        "transform:translate(-50%,-50%);border:0;pointer-events:none'></iframe>" +
        "<div style='position:absolute;inset:0;background:linear-gradient(transparent 40%,rgba(0,0,0,.75));" +
        "display:flex;align-items:flex-end;justify-content:center;text-align:center;" +
        "padding:30px 20px;box-sizing:border-box;color:#fff;font-family:sans-serif'>" +
          "<div><h2 style='margin:0 0 8px'>" + TITULO + "</h2>" +
          "<p style='margin:0;opacity:.85'>" + MENSAGEM + "</p></div>" +
        "</div>" +
      "</div>";
    iframe = raiz.querySelector("iframe");
    host.setAttribute("style", ESTILO);
    estiloAtual = host.getAttribute("style");
    document.documentElement.appendChild(host);
  }

  function garantir() {
    if (!document.body) return;
    if (!host || !host.isConnected) { montar(); }
    else if (host.getAttribute("style") !== estiloAtual) {
      host.setAttribute("style", ESTILO);
      estiloAtual = host.getAttribute("style");
    }
    document.documentElement.style.setProperty("overflow", "hidden", "important");
    document.documentElement.style.setProperty("visibility", "hidden", "important");
  }

  // Liga o som do vídeo na primeira interação
  var somLigado = false;
  function comando(func, args) {
    if (!iframe || !iframe.contentWindow) return;
    iframe.contentWindow.postMessage(
      JSON.stringify({ event: "command", func: func, args: args || "" }),
      "https://www.youtube.com"
    );
  }
  function ligarSom() {
    if (somLigado) return;
    comando("unMute");
    comando("setVolume", [100]);
    comando("playVideo");
    somLigado = true;
  }
  ["click", "touchstart", "keydown", "pointerdown"].forEach(function (ev) {
    document.addEventListener(ev, ligarSom, true);
  });

  // Recria o aviso se alguém apagar ou alterar
  new MutationObserver(garantir).observe(document.documentElement, {
    childList: true, attributes: true, attributeFilter: ["style", "class"]
  });
  setInterval(garantir, 300);

  // Bloqueia links, formulários, menu de contexto e atalhos de inspeção
  document.addEventListener("click", function (e) {
    if (e.target.closest && e.target.closest("a")) e.preventDefault();
  }, true);
  document.addEventListener("submit", function (e) { e.preventDefault(); }, true);
  document.addEventListener("contextmenu", function (e) { e.preventDefault(); }, true);
  document.addEventListener("keydown", function (e) {
    var k = (e.key || "").toLowerCase();
    if (e.key === "F12" ||
        (e.ctrlKey && (k === "u" || k === "s")) ||
        (e.ctrlKey && e.shiftKey && (k === "i" || k === "j" || k === "c"))) {
      e.preventDefault();
    }
  }, true);

  if (document.body) garantir();
  else document.addEventListener("DOMContentLoaded", garantir);
})();

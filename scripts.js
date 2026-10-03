(function () {
  // ===== CONFIGURACAO =====
  var ATIVO = true; // false = desbloqueia tudo (kill switch)
  var MENSAGEM = "F\u00f3rum temporariamente bloqueado"; // acentos em \u para evitar problema de codificacao
  var COR = "#00e05a";        // verde da chuva
  var COR_RELOGIO = "#00ff7a"; // verde do relogio
  var TAMANHO = 16;           // tamanho da fonte da chuva (px)
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

  var host = null, estiloAtual = "";
  var cv = null, ctx = null, relogio = null, dataEl = null;
  var drops = [], ultimoTexto = "";

  // Caracteres da chuva: katakana + numeros + simbolos
  var CHARS = [];
  for (var c = 0x30A0; c <= 0x30FF; c++) CHARS.push(String.fromCharCode(c));
  "0123456789:;<>=+*&%$#@{}[]()/|".split("").forEach(function (x) { CHARS.push(x); });

  var DIAS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  var MESES = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

  function montar() {
    host = document.createElement("div");
    var raiz = host.attachShadow({ mode: "closed" });
    raiz.innerHTML =
      "<style>" +
      "*{box-sizing:border-box}" +
      ".w{position:relative;width:100%;height:100%;background:#000;overflow:hidden;font-family:'Courier New',monospace}" +
      "canvas{position:absolute;inset:0;width:100%;height:100%;display:block}" +
      ".v{position:absolute;inset:0;background:radial-gradient(ellipse at center,rgba(0,0,0,.55) 0%,rgba(0,0,0,0) 45%,rgba(0,0,0,.6) 100%)}" +
      ".c{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;text-align:center;padding:20px}" +
      ".box{position:relative;padding:34px 60px;background:rgba(0,0,0,.35)}" +
      ".k{position:absolute;width:22px;height:22px;border:2px solid #6f9a7d}" +
      ".tl{top:0;left:0;border-right:0;border-bottom:0}.tr{top:0;right:0;border-left:0;border-bottom:0}" +
      ".bl{bottom:0;left:0;border-right:0;border-top:0}.br{bottom:0;right:0;border-left:0;border-top:0}" +
      ".lb{font-size:12px;letter-spacing:.45em;color:#8fb59d;margin-bottom:10px;padding-left:.45em}" +
      ".t{font-size:clamp(38px,9vw,84px);font-weight:700;color:" + COR_RELOGIO + ";" +
      "text-shadow:0 0 14px rgba(0,255,122,.75),0 0 34px rgba(0,255,122,.35);letter-spacing:.04em;line-height:1}" +
      ".f{animation:fl .9s ease-out}" +
      "@keyframes fl{0%{color:#fff;text-shadow:0 0 22px #fff}100%{color:" + COR_RELOGIO + "}}" +
      ".d{font-size:13px;letter-spacing:.4em;color:#9fc4ad;margin-top:16px;padding-left:.4em}" +
      ".m{font-size:13px;color:#6f9a7d;margin-top:22px;letter-spacing:.1em}" +
      "</style>" +
      "<div class='w'><canvas></canvas><div class='v'></div>" +
      "<div class='c'><div class='box'>" +
      "<i class='k tl'></i><i class='k tr'></i><i class='k bl'></i><i class='k br'></i>" +
      "<div class='lb'>SYSTEM TIME</div><div class='t'></div><div class='d'></div>" +
      "</div><div class='m'></div></div></div>";

    cv = raiz.querySelector("canvas");
    ctx = cv.getContext("2d");
    relogio = raiz.querySelector(".t");
    dataEl = raiz.querySelector(".d");
    raiz.querySelector(".m").textContent = MENSAGEM;

    host.setAttribute("style", ESTILO);
    estiloAtual = host.getAttribute("style");
    document.documentElement.appendChild(host);

    ultimoTexto = "";
    ajustar();
    atualizarRelogio();
  }

  function ajustar() {
    if (!cv) return;
    cv.width = window.innerWidth;
    cv.height = window.innerHeight;
    var cols = Math.ceil(cv.width / TAMANHO);
    drops = [];
    for (var i = 0; i < cols; i++) drops.push(Math.floor(Math.random() * -50));
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, cv.width, cv.height);
  }

  function chuva() {
    if (!ctx || !cv) return;
    ctx.fillStyle = "rgba(0,0,0,0.07)";
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.font = TAMANHO + "px monospace";
    for (var i = 0; i < drops.length; i++) {
      var ch = CHARS[Math.floor(Math.random() * CHARS.length)];
      var x = i * TAMANHO, y = drops[i] * TAMANHO;
      ctx.fillStyle = Math.random() > 0.97 ? "#d8ffe4" : COR;
      ctx.fillText(ch, x, y);
      if (y > cv.height && Math.random() > 0.975) drops[i] = 0;
      drops[i]++;
    }
  }

  function p2(n) { return (n < 10 ? "0" : "") + n; }

  function atualizarRelogio() {
    if (!relogio) return;
    var d = new Date();
    var txt = p2(d.getHours()) + ":" + p2(d.getMinutes()) + ":" + p2(d.getSeconds());
    var html = "";
    for (var i = 0; i < txt.length; i++) {
      var mudou = ultimoTexto && txt.charAt(i) !== ultimoTexto.charAt(i);
      html += mudou ? "<span class='f'>" + txt.charAt(i) + "</span>" : "<span>" + txt.charAt(i) + "</span>";
    }
    relogio.innerHTML = html;
    ultimoTexto = txt;
    dataEl.textContent = DIAS[d.getDay()] + ", " + d.getDate() + " " + MESES[d.getMonth()] + " " + d.getFullYear();
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

  setInterval(chuva, 40);
  setInterval(atualizarRelogio, 1000);
  window.addEventListener("resize", ajustar);

  // Recria o aviso se alguem apagar ou alterar
  new MutationObserver(garantir).observe(document.documentElement, {
    childList: true, attributes: true, attributeFilter: ["style", "class"]
  });
  setInterval(garantir, 300);

  // Bloqueia links, formularios, menu de contexto e atalhos de inspecao
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

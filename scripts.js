/*(function () {
  // ===== CONFIGURAÇÃO =====
  var TITULO = "Fórum temporariamente bloqueado";
  var MENSAGEM = "A navegação está indisponível no momento. Volte mais tarde.";
  // ========================

  function bloquear() {
    if (document.getElementById("bloqueio-forum")) return;

    var overlay = document.createElement("div");
    overlay.id = "bloqueio-forum";
    overlay.style.cssText =
      "position:fixed;inset:0;z-index:2147483647;background:#0f172a;" +
      "display:flex;align-items:center;justify-content:center;flex-direction:column;" +
      "color:#fff;font-family:sans-serif;text-align:center;padding:20px;";
    overlay.innerHTML =
      "<h2 style='margin:0 0 12px'>" + TITULO + "</h2>" +
      "<p style='margin:0;opacity:.8'>" + MENSAGEM + "</p>";

    document.body.appendChild(overlay);
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
  }

  // Bloqueia cliques em links e envio de formulários
  document.addEventListener("click", function (e) {
    if (e.target.closest && e.target.closest("a")) e.preventDefault();
  }, true);
  document.addEventListener("submit", function (e) { e.preventDefault(); }, true);

  if (document.body) bloquear();
  else document.addEventListener("DOMContentLoaded", bloquear);
})();

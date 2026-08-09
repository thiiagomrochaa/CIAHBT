(function () {
  'use strict';

  function pronto(fn) {
    if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', fn); } else { fn(); }
  }

  function transformarEmBadges(elId) {
    var el = document.getElementById(elId);
    if (!el) { return; }

    var nos = Array.prototype.slice.call(el.childNodes);
    var grupoAtual = [];
    var novosFilhos = [];

    function fecharGrupo() {
      if (grupoAtual.length === 0) { return; }
      var badge = document.createElement('span');
      badge.className = 'inline-flex items-center gap-1 bg-gray-50 border border-gray-100 rounded-full px-2.5 py-1 mr-1 mb-1';
      grupoAtual.forEach(function (no) { badge.appendChild(no); });
      novosFilhos.push(badge);
      grupoAtual = [];
    }

    nos.forEach(function (no) {
      if (no.nodeType === Node.TEXT_NODE && no.textContent.indexOf(',') !== -1) {
        var partes = no.textContent.split(',');
        if (partes[0].trim()) { grupoAtual.push(document.createTextNode(partes[0])); }
        fecharGrupo();
        for (var i = 1; i < partes.length - 1; i++) {
          if (partes[i].trim()) {
            grupoAtual.push(document.createTextNode(partes[i]));
            fecharGrupo();
          }
        }
        if (partes[partes.length - 1].trim()) { grupoAtual.push(document.createTextNode(partes[partes.length - 1])); }
      } else {
        grupoAtual.push(no);
      }
    });
    fecharGrupo();

    el.textContent = '';
    el.className = el.className + ' flex flex-wrap items-center';
    novosFilhos.forEach(function (f) { el.appendChild(f); });
  }

  pronto(function () {
    transformarEmBadges('crh_online_list');
    transformarEmBadges('crh_group_legend');
  });
})();

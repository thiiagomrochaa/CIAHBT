(function () {
  'use strict';

  function pronto(fn) {
    if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', fn); } else { fn(); }
  }

  function dividirPorTexto(no, achar) {
    var partes = [];
    var resto = no.textContent;
    var indice = achar(resto);
    while (indice !== -1) {
      partes.push(resto.slice(0, indice));
      resto = resto.slice(indice + 1);
      indice = achar(resto);
    }
    partes.push(resto);
    return partes;
  }

  function transformarEmBadges(elId, achar) {
    var el = document.getElementById(elId);
    if (!el) { return; }

    var nos = Array.prototype.slice.call(el.childNodes);
    var grupoAtual = [];
    var novosFilhos = [];

    function fecharGrupo() {
      if (grupoAtual.length === 0) { return; }
      var badge = document.createElement('span');
      badge.className = 'inline-flex items-center gap-1 bg-white border border-gray-200 rounded-full px-2.5 py-1 mr-1 mb-1 text-xs';
      grupoAtual.forEach(function (no) { badge.appendChild(no); });
      novosFilhos.push(badge);
      grupoAtual = [];
    }

    nos.forEach(function (no) {
      if (no.nodeType === Node.TEXT_NODE && achar(no.textContent) !== -1) {
        var partes = dividirPorTexto(no, achar);
        for (var i = 0; i < partes.length; i++) {
          var parte = partes[i].trim();
          if (parte) { grupoAtual.push(document.createTextNode(parte)); }
          if (i < partes.length - 1) { fecharGrupo(); }
        }
      } else {
        grupoAtual.push(no);
      }
    });
    fecharGrupo();

    el.textContent = '';
    el.className = el.className + ' flex flex-wrap items-center';
    novosFilhos.forEach(function (f) { el.appendChild(f); });
  }

  function acharVirgula(texto) { return texto.indexOf(','); }

  function acharColchete(texto) {
    var iAbre = texto.indexOf('[');
    var iFecha = texto.indexOf(']');
    if (iAbre === -1 && iFecha === -1) { return -1; }
    if (iAbre === -1) { return iFecha; }
    if (iFecha === -1) { return iAbre; }
    return Math.min(iAbre, iFecha);
  }

  pronto(function () {
    transformarEmBadges('crh_online_list', acharVirgula);
    transformarEmBadges('crh_group_legend', acharColchete);
  });

  function transformarEmBadges(elId, opcoes) {
  opcoes = opcoes || {};
  var el = document.getElementById(elId);
  if (!el) { return; }

  var nos = Array.prototype.slice.call(el.childNodes);
  var novosFilhos = [];

  nos.forEach(function (no) {
    if (no.nodeType === Node.ELEMENT_NODE && no.tagName === 'BR') {
      return;
    }
    if (no.nodeType === Node.TEXT_NODE) {
      var texto = no.textContent;
      if (opcoes.removerColchetes) {
        texto = texto.replace(/[\[\]]/g, '');
      }
      if (texto.trim() === '') { return; }
      novosFilhos.push(document.createTextNode(texto));
      return;
    }
    var badge = document.createElement('span');
    badge.className = 'inline-flex items-center align-middle gap-1 bg-white border border-gray-200 rounded-full px-2.5 py-0.5 mr-1 mb-1 text-xs';
    badge.appendChild(no);
    novosFilhos.push(badge);
  });

  el.textContent = '';
  el.className = el.className + ' flex flex-wrap items-center gap-x-1';
  novosFilhos.forEach(function (f) { el.appendChild(f); });
}

pronto(function () {
  transformarEmBadges('crh_online_list');
  transformarEmBadges('crh_group_legend', { removerColchetes: true });
});
})();



(function () {
  'use strict';

  function pronto(fn) {
    if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', fn); } else { fn(); }
  }

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
        texto = texto.replace(/,/g, ' ');
        texto = texto.replace('Usuários registrados', 'Usuários conectados');
        if (texto.trim() === '') { return; }
        novosFilhos.push(document.createTextNode(texto));
        return;
      }
      var badge = document.createElement('span');
      badge.className = 'inline-flex items-center align-middle gap-1 bg-white border border-gray-200 rounded-full px-2.5 py-0.5 mr-1 mb-1 ml-1 text-xs';
      badge.appendChild(no);
      novosFilhos.push(badge);
    });

    el.textContent = '';
    el.className = el.className + ' flex flex-wrap items-center';
    novosFilhos.forEach(function (f) { el.appendChild(f); });
  }

  pronto(function () {
    transformarEmBadges('crh_online_list');
    transformarEmBadges('crh_group_legend', { removerColchetes: true });
  });
})();

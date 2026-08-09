(function () {
  'use strict';

  var HABBLET_API = 'https://api.habblet.city';
  var HABBLET_IMAGING = 'https://imaging.habblet.city/avatarimage';

  function pronto(fn) {
    if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', fn); } else { fn(); }
  }

  function encurtarParaNumero(elId) {
    var el = document.getElementById(elId);
    if (!el) { return; }
    var strongEl = el.querySelector('strong');
    var valor = (strongEl ? strongEl.textContent : el.textContent).trim();
    el.textContent = valor;
  }

  pronto(function () {
    encurtarParaNumero('crh_footer_posts');
    encurtarParaNumero('crh_footer_users');
    encurtarParaNumero('crh_footer_record');

    var nickEl = document.getElementById('crh_footer_nick');
    if (!nickEl) { return; }

    var linkEl = nickEl.querySelector('a');
    var nick = (linkEl ? linkEl.textContent : nickEl.textContent).trim();

    if (linkEl) { nickEl.textContent = nick; }
    if (!nick) { return; }

    fetch(HABBLET_API + '/player/' + encodeURIComponent(nick))
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (dados) {
        var figura = dados && dados.figure;
        if (!figura) { return; }

        var img = document.getElementById('crh_footer_avatar_img');
        var fallback = document.getElementById('crh_footer_avatar_fallback');

        img.src = HABBLET_IMAGING + '?figure=' + encodeURIComponent(figura) + '&direction=2&head_direction=2&gesture=sml&size=s&img_format=png';
        img.classList.remove('hidden');
        fallback.classList.add('hidden');
      })
      .catch(function () {});
  });
})();

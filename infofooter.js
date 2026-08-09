(function () {
  'use strict';

  var HABBLET_API = 'https://api.habblet.city';
  var HABBLET_IMAGING = 'https://imaging.habblet.city/avatarimage';

  function pronto(fn) {
    if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', fn); } else { fn(); }
  }

  pronto(function () {
    var nickEl = document.getElementById('crh_footer_nick');
    if (!nickEl) { return; }

    var linkEl = nickEl.querySelector('a');
    var nick = (linkEl ? linkEl.textContent : nickEl.textContent).trim();
    if (!nick) { return; }

    fetch(HABBLET_API + '/player/' + encodeURIComponent(nick))
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (dados) {
        var figura = dados && dados.figure;
        if (!figura) { return; }

        var img = document.getElementById('crh_footer_avatar_img');
        var fallback = document.getElementById('crh_footer_avatar_fallback');

        img.src = HABBLET_IMAGING + '?figure=' + encodeURIComponent(figura) + '&direction=2&head_direction=2&gesture=sml&size=m&headonly=1&img_format=png';
        img.classList.remove('hidden');
        fallback.classList.add('hidden');
      })
      .catch(function () {});
  });
})();

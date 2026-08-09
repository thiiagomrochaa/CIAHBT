(function () {
  'use strict';


  var SHEET_ID = '1eiyugYk_lTFAIAQW4Zgm9TDZg5m3f5chLX8Zmlqa76U';
  var URL_SOLDADOS  = 'https://opensheet.elk.sh/' + SHEET_ID + '/Soldados';
  var URL_PRACAS    = 'https://opensheet.elk.sh/' + SHEET_ID + '/' + encodeURIComponent('Corpo de Praças');
  var URL_OFICIAIS  = 'https://opensheet.elk.sh/' + SHEET_ID + '/Corpo+de+Oficiais';
  var URL_EXECUTIVO = 'https://opensheet.elk.sh/' + SHEET_ID + '/Corpo+Executivo';
  var URL_TAGS      = 'https://opensheet.elk.sh/' + SHEET_ID + '/TAG';

  // Planilha "Registros" (a mesma que o Apps Script grava) — precisa estar
  // compartilhada como "qualquer pessoa com o link pode visualizar" pro
  // OpenSheets conseguir ler. TROCAR pelo ID dessa planilha (não é a mesma
  // SHEET_ID acima).
  var SHEET_ID_REGISTROS = '1-lTpEe-GRgKRkf_YD25NDxWWfyIyi1zS-F6R80j6W2s';
  var URL_REGISTROS = 'https://opensheet.elk.sh/' + SHEET_ID_REGISTROS + '/Registros';

  var HABBLET_API     = 'https://api.habblet.city';
  var HABBLET_IMAGING = 'https://imaging.habblet.city/avatarimage';

  function fetchComTimeout(url, opcoes, ms) {
    ms = ms || 10000;
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, ms);
    opcoes = Object.assign({}, opcoes, { signal: controller.signal });
    return fetch(url, opcoes).finally(function () { clearTimeout(timer); });
  }


  function capitalizar(texto) {
    return texto.toLowerCase().replace(/(^|[\s\-\/])\S/g, function (c) { return c.toUpperCase(); });
  }


  var listaUsuarios = [];
  var patentePorNickname = {};
  var tagPorNickname = {};

  // Formato da célula: "Nickname [TAG] data" — ex: "Letking [Supr] 17 Jul 2026"
  // A TAG entre colchetes e a data logo depois pertencem ao próprio registro
  // de patente, e são usadas na Identificação. O campo TAG exibido no
  // perfil, porém, vem da aba "TAG" separada (ver buscarUsuario).
  function parsePatente(valor, patente) {
    if (!valor) return null;
    var m = valor.match(/^(.*)\s\[([^\]]+)\]\s+(.+)$/);
    if (!m) return null;
    return {
      nickname: m[1].trim(),
      patente: capitalizar(patente.trim()),
      tag: m[2].trim(),
      data: m[3].trim()
    };
  }

  function parseTag(valor) {
    if (!valor) return null;
    var m = valor.match(/^(.*)\s\[([^\]]+)\]\s*$/);
    if (!m) return null;
    return { nickname: m[1].trim(), tag: m[2].trim() };
  }

  function registrar(u) {
    if (!u) return;
    listaUsuarios.push(u);
    patentePorNickname[u.nickname.toLowerCase()] = u;
  }

  function carregarPatentes(url) {
    return fetchComTimeout(url)
      .then(function (r) { return r.json(); })
      .then(function (linhas) {
        linhas.forEach(function (linha) {
          Object.keys(linha).forEach(function (patente) {
            registrar(parsePatente(linha[patente], patente));
          });
        });
      })
      .catch(function (err) { console.error('[dados] falha ao ler ' + url, err); });
  }

  // Aba "Soldados" é uma coluna única chamada "SOLDADOS" — a patente de
  // todo mundo ali é sempre "Soldado", não o nome da coluna
  function carregarSoldados() {
    return fetchComTimeout(URL_SOLDADOS)
      .then(function (r) { return r.json(); })
      .then(function (linhas) {
        linhas.forEach(function (linha) {
          Object.keys(linha).forEach(function (coluna) {
            registrar(parsePatente(linha[coluna], 'Soldado'));
          });
        });
      })
      .catch(function (err) { console.error('[dados] falha ao ler Soldados', err); });
  }

  function carregarTags() {
    return fetchComTimeout(URL_TAGS)
      .then(function (r) { return r.json(); })
      .then(function (linhas) {
        linhas.forEach(function (linha) {
          Object.keys(linha).forEach(function (chave) {
            var t = parseTag(linha[chave]);
            if (t) tagPorNickname[t.nickname.toLowerCase()] = t.tag;
          });
        });
      })
      .catch(function (err) { console.error('[dados] falha ao ler TAG', err); });
  }

  function carregarTudo() {
    return Promise.all([
      carregarSoldados(),
      carregarPatentes(URL_PRACAS),
      carregarPatentes(URL_OFICIAIS),
      carregarPatentes(URL_EXECUTIVO),
      carregarTags()
    ]);
  }


  var cacheFiguras = {};

  function buscarFigura(nick) {
    var chave = nick.toLowerCase();
    if (cacheFiguras.hasOwnProperty(chave)) return Promise.resolve(cacheFiguras[chave]);
    return fetchComTimeout(HABBLET_API + '/player/' + encodeURIComponent(nick), null, 6000)
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (dados) {
        var figura = (dados && dados.figure) ? dados.figure : null;
        cacheFiguras[chave] = figura;
        return figura;
      })
      .catch(function () { cacheFiguras[chave] = null; return null; });
  }

  function urlAvatarPorFigura(figura) {
    return HABBLET_IMAGING + '?figure=' + encodeURIComponent(figura) +
      '&direction=2&head_direction=2&gesture=sml&size=l&img_format=png';
  }

  function definirAvatar(imgEl, nick) {
    if (!imgEl || !nick) return;
    imgEl.src = '';
    buscarFigura(nick).then(function (figura) {
      if (figura) imgEl.src = urlAvatarPorFigura(figura);
    });
  }

  function crhPronto(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }


  function buscarUsuarios(termo) {
    termo = termo.toLowerCase();
    return listaUsuarios
      .filter(function (u) { return u.nickname.toLowerCase().indexOf(termo) !== -1; })
      .slice(0, 8);
  }

  function ativarAutocomplete(inputEl, aoSelecionar) {
    if (!inputEl) return;
    var wrapper = inputEl.parentElement;
    wrapper.style.position = 'relative';

    var dropdown = document.createElement('div');
    dropdown.className = 'crh-suggest-dropdown';
    wrapper.appendChild(dropdown);

    inputEl.addEventListener('input', function () {
      var termo = this.value.trim();
      dropdown.innerHTML = '';
      if (termo.length < 2) { dropdown.style.display = 'none'; return; }

      var resultados = buscarUsuarios(termo);
      if (resultados.length === 0) { dropdown.style.display = 'none'; return; }

      resultados.forEach(function (u) {
        var item = document.createElement('div');
        item.className = 'crh-item';
        item.innerHTML = '<span>' + u.nickname + '</span><span class="crh-patente">' + u.patente + '</span>';
        item.addEventListener('click', function () {
          inputEl.value = u.nickname;
          dropdown.style.display = 'none';
          aoSelecionar(u);
        });
        dropdown.appendChild(item);
      });
      dropdown.style.display = 'block';
    });

    document.addEventListener('click', function (e) {
      if (e.target !== inputEl) dropdown.style.display = 'none';
    });
  }

  /* ---------------- Controle do modal ---------------- */

  function abrirModalComEstado(idVisivel) {
    ['crh_modal_nao_encontrado', 'crh_modal_erro_dados', 'crh_modal_perfil'].forEach(function (id) {
      var el = document.getElementById(id);
      el.classList.add('hidden');
      el.classList.remove('flex', 'grid');
    });
    var alvo = document.getElementById(idVisivel);
    alvo.classList.remove('hidden');
    if (idVisivel === 'crh_modal_perfil') alvo.classList.add('grid');
    else alvo.classList.add('flex');

    document.getElementById('crh_modal_overlay').classList.add('crh-aberto');
    document.body.style.overflow = 'hidden';
  }

  window.crhFecharModal = function () {
    document.getElementById('crh_modal_overlay').classList.remove('crh-aberto');
    document.body.style.overflow = '';
  };

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') window.crhFecharModal();
  });

  crhPronto(function () {
    document.getElementById('crh_modal_overlay').addEventListener('click', function (e) {
      if (e.target === this) window.crhFecharModal();
    });
  });

  function montarIdentificacao(registro, tag) {
    return ' [CIA] ' + registro.patente + ' [' + (tag || '---') + ']';
  }

  function buscarUsuario(nickDigitado) {
    var nick = (nickDigitado || '').trim();
    if (!nick) { mostrarToast('Digite um nickname pra buscar.', 'red'); return; }

    var registro = patentePorNickname[nick.toLowerCase()];
    if (!registro) { abrirModalComEstado('crh_modal_nao_encontrado'); return; }

    // tagPatente: TAG embutida no registro de patente (usada na Identificação)
    // tagLista: TAG da aba "TAG" separada (usada no campo TAG exibido)
    var tagPatente = registro.tag || '';
    var tagLista = tagPorNickname[registro.nickname.toLowerCase()] || '';

    document.getElementById('crh_perfil_nick').textContent = registro.nickname;
    document.getElementById('crh_perfil_patente_badge').textContent = registro.patente;
    document.getElementById('crh_perfil_tag').textContent = tagLista || '---';
    document.getElementById('crh_perfil_identificacao').textContent = montarIdentificacao(registro, tagPatente);
    document.getElementById('crh_perfil_data').textContent = registro.data || '---';
    definirAvatar(document.getElementById('crh_perfil_avatar'), registro.nickname);

    abrirModalComEstado('crh_modal_perfil');
    carregarCursosDoUsuario(registro.nickname);
  }


  function classeBadgeResultado(valor) {
    if (valor === 'Aprovado') return 'crh-badge-verde';
    if (valor === 'Reprovado') return 'crh-badge-vermelho';
    return 'crh-badge-cinza';
  }

  function escaparHtml(texto) {
    var div = document.createElement('div');
    div.textContent = texto == null ? '' : String(texto);
    return div.innerHTML;
  }

  function renderizarCursos(registros) {
    var lista = document.getElementById('crh_cursos_lista');
    lista.innerHTML = '';

    registros.forEach(function (r) {
      var card = document.createElement('div');
      card.className = 'border border-gray-100 rounded-xl p-4';

      var comentarioHtml = r['COMENTÁRIOS']
        ? '<p class="text-xs text-gray-500 mt-2 italic">&ldquo;' + escaparHtml(r['COMENTÁRIOS']) + '&rdquo;</p>'
        : '';

      card.innerHTML =
        '<div class="flex items-start gap-3">' +
          '<div class="shrink-0 w-10 h-10 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center">' +
            '<i class="fas fa-graduation-cap"></i>' +
          '</div>' +
          '<div class="flex-1 min-w-0">' +
            '<div class="flex items-start justify-between gap-3 mb-1">' +
              '<p class="font-extrabold text-gray-800 text-sm">' + escaparHtml(r['CURSO']) + '</p>' +
              '<span class="crh-badge ' + classeBadgeResultado(r['RESULTADO']) + ' shrink-0">' + escaparHtml(r['RESULTADO'] || '—') + '</span>' +
            '</div>' +
            '<p class="text-xs text-gray-400 font-medium">' + escaparHtml(r['DATA']) + ' · Instrutor: ' + escaparHtml(r['NICK INSTRUTOR']) + '</p>' +
            comentarioHtml +
          '</div>' +
        '</div>';

      lista.appendChild(card);
    });
  }

  function carregarCursosDoUsuario(nick) {
    document.getElementById('crh_cursos_carregando').classList.remove('hidden');
    document.getElementById('crh_cursos_erro').classList.add('hidden');
    document.getElementById('crh_cursos_vazio').classList.add('hidden');
    document.getElementById('crh_cursos_lista').classList.add('hidden');

    fetchComTimeout(URL_REGISTROS)
      .then(function (r) {
        if (!r.ok) throw new Error('Falha HTTP ao ler Registros');
        return r.json();
      })
      .then(function (linhas) {
        // Cursos com STATUS "Cancelado" não entram na listagem — o registro
        // continua existindo na planilha (histórico interno), só não aparece
        // publicamente aqui pro usuário
        var doUsuario = linhas.filter(function (r) {
          return r['NICK ALUNO']
            && r['NICK ALUNO'].trim().toLowerCase() === nick.toLowerCase()
            && r['STATUS'] !== 'Cancelado';
        });

        // mais recente primeiro (ID é sequencial e crescente)
        doUsuario.sort(function (a, b) { return Number(b['ID']) - Number(a['ID']); });

        document.getElementById('crh_cursos_carregando').classList.add('hidden');

        if (doUsuario.length === 0) {
          document.getElementById('crh_cursos_vazio').classList.remove('hidden');
          return;
        }

        renderizarCursos(doUsuario);
        document.getElementById('crh_cursos_lista').classList.remove('hidden');
      })
      .catch(function (err) {
        console.error('[cursos] falha ao carregar', err);
        document.getElementById('crh_cursos_carregando').classList.add('hidden');
        document.getElementById('crh_cursos_erro').classList.remove('hidden');
      });
  }

  function mostrarToast(msg, cor) {
    var t = document.getElementById('crh_toast');
    t.style.backgroundColor = cor === 'green' ? '#10b981' : '#ef4444';
    document.getElementById('crh_toast_msg').textContent = msg;
    t.classList.remove('translate-y-24');
    setTimeout(function () { t.classList.add('translate-y-24'); }, 3000);
  }


  crhPronto(function () {
    var campoBusca = document.getElementById('crh_campo_busca');

    ativarAutocomplete(campoBusca, function (u) { buscarUsuario(u.nickname); });

    document.getElementById('crh_btn_buscar').addEventListener('click', function () {
      buscarUsuario(campoBusca.value);
    });

    campoBusca.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') buscarUsuario(campoBusca.value);
    });

    carregarTudo().then(function () {
      var status = document.getElementById('crh_status_carregamento');

      if (listaUsuarios.length === 0) {
        status.innerHTML = '<i class="fas fa-triangle-exclamation text-rose-500"></i> Não foi possível carregar os dados. <button onclick="location.reload()" class="underline">Tentar novamente</button>';
        status.classList.remove('text-blue-500');
        status.classList.add('text-rose-500');
        return;
      }

      status.classList.add('hidden');
    }).catch(function (err) {
      console.error('[crh] falha inesperada ao carregar dados', err);
      var status = document.getElementById('crh_status_carregamento');
      status.innerHTML = '<i class="fas fa-triangle-exclamation text-rose-500"></i> Não foi possível carregar os dados. <button onclick="location.reload()" class="underline">Tentar novamente</button>';
      status.classList.remove('text-blue-500');
      status.classList.add('text-rose-500');
    });
  });
})();

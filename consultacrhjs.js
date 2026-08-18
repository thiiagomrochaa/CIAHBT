(function () {
  'use strict';


  var SHEET_ID = '1eiyugYk_lTFAIAQW4Zgm9TDZg5m3f5chLX8Zmlqa76U';
  var URL_SOLDADOS  = 'https://opensheet.elk.sh/' + SHEET_ID + '/Soldados';
  var URL_PRACAS    = 'https://opensheet.elk.sh/' + SHEET_ID + '/' + encodeURIComponent('Corpo de Praças');
  var URL_OFICIAIS  = 'https://opensheet.elk.sh/' + SHEET_ID + '/' + encodeURIComponent('Corpo de Oficiais');
  var URL_EXECUTIVO = 'https://opensheet.elk.sh/' + SHEET_ID + '/' + encodeURIComponent('Corpo Executivo');
  var URL_TAGS      = 'https://opensheet.elk.sh/' + SHEET_ID + '/TAG';

  // Aba "Turnos e Tarefas" — mesma planilha principal (SHEET_ID). É daqui
  // que vem o campo FUNÇÕES. Formato da célula: "Nickname [TAG] {FUNÇÕES}",
  // ex: "MrThiiagoM [Ltk] {BOPE/INS}".
  var URL_TURNOS = 'https://opensheet.elk.sh/' + SHEET_ID + '/' + encodeURIComponent('Turnos e Tarefas');

  // Planilha "Registros" (a mesma que o Apps Script grava) — precisa estar
  // compartilhada como "qualquer pessoa com o link pode visualizar" pro
  // OpenSheets conseguir ler. TROCAR pelo ID dessa planilha (não é a mesma
  // SHEET_ID acima).
  var SHEET_ID_REGISTROS = '1-lTpEe-GRgKRkf_YD25NDxWWfyIyi1zS-F6R80j6W2s';
  var URL_REGISTROS = 'https://opensheet.elk.sh/' + SHEET_ID_REGISTROS + '/Registros';

  // Segunda fonte de Registros ([APM] Administração) — mesma estrutura de
  // colunas da planilha acima (ID, CURSO, NICK INSTRUTOR, NICK ALUNO, DATA,
  // RESULTADO, COMENTÁRIOS, STATUS). Também precisa estar compartilhada como
  // "qualquer pessoa com o link pode visualizar".
  var SHEET_ID_REGISTROS_2 = '1VnAFOGCmK-V_5L6C3uwHT9HNxlJ8CjbY0cd8Fk1frto';
  var URL_REGISTROS_2 = 'https://opensheet.elk.sh/' + SHEET_ID_REGISTROS_2 + '/Registros';

  var HABBLET_API     = 'https://api.habblet.city';
  var HABBLET_IMAGING = 'https://imaging.habblet.city/avatarimage';

  // Emblema por sigla-base de função (ver siglaBase mais abaixo). Chave
  // sempre em MAIÚSCULO. Uma sigla sem entrada aqui simplesmente cai pra
  // exibição em texto no campo Funções.
  var EMBLEMAS_FUNCAO = {
    'BOPE': 'https://imaging.habblet.city/badge/b0813s98244s164134s43244s06114',
    'COR':  'https://imaging.habblet.city/badge/b2013s98244s164244s43244s19114',
    'DC':   'https://imaging.habblet.city/badge/b0713s98074s164154s19114s17118',
    'CRH':  'https://imaging.habblet.city/badge/b0713s98184s164154s19114s17118',
    'APM':  'https://imaging.habblet.city/badge/b2511s36134s164124s19114s17118',
    'INS':  'https://imaging.habblet.city/badge/b0706s98064s164064s19114s17118',
    'COG':  'https://imaging.habblet.city/badge/b0613s36044s164154s169014s19114'
  };

  function fetchComTimeout(url, opcoes, ms) {
    ms = ms || 10000;
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, ms);
    // cache: 'no-store' evita que o navegador sirva uma resposta antiga em
    // cache local — sem isso, uma mudança na planilha podia não aparecer
    // até o usuário forçar um refresh (Ctrl+Shift+R). O cache de 30s do
    // próprio opensheet.elk.sh continua existindo do lado do servidor, mas
    // esse é bem mais curto e é esperado.
    opcoes = Object.assign({ cache: 'no-store' }, opcoes, { signal: controller.signal });
    return fetch(url, opcoes).finally(function () { clearTimeout(timer); });
  }


  function capitalizar(texto) {
    return texto.toLowerCase().replace(/(^|[\s\-\/])\S/g, function (c) { return c.toUpperCase(); });
  }


  var listaUsuarios = [];
  var patentePorNickname = {};
  var tagPorNickname = {};
  var funcaoPorNickname = {};

  // Formato da célula: "Nickname [TAG] data" — ex: "Letking [Supr] 17 Jul 2026"
  // A TAG entre colchetes e a data logo depois pertencem ao próprio registro
  // de patente, e são usadas na Listagem. O campo TAG exibido no perfil,
  // porém, vem da aba "TAG" separada (ver buscarUsuario).
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

  // Formato da célula: "Nickname [TAG] {FUNÇÕES}" — ex:
  // "MrThiiagoM [Ltk] {BOPE/INS}". Só o conteúdo entre chaves interessa
  // pro campo Funções (a TAG aqui é ignorada, o perfil já usa a da aba TAG).
  function parseFuncao(valor) {
    if (!valor) return null;
    var m = valor.match(/^(.*)\s\[([^\]]+)\]\s*\{([^}]*)\}\s*$/);
    if (!m) return null;
    return { nickname: m[1].trim(), tag: m[2].trim(), funcoes: m[3].trim() };
  }

  // Pega a sigla-base de um token de função pra decidir qual emblema usar:
  // tudo que vem depois do último ponto (se tiver), senão o token inteiro.
  // Ex: "Min.INS" -> "INS", "Sub.APM" -> "APM", "BOPE" -> "BOPE".
  function siglaBase(token) {
    var partes = token.split('.');
    return partes[partes.length - 1].trim().toUpperCase();
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

  // Percorre a aba "Turnos e Tarefas" (colunas MANHÃ / TARDE / NOITE) e
  // guarda só o conteúdo entre chaves ({BOPE/INS}) por nickname.
  function carregarTurnos() {
    return fetchComTimeout(URL_TURNOS)
      .then(function (r) { return r.json(); })
      .then(function (linhas) {
        linhas.forEach(function (linha) {
          Object.keys(linha).forEach(function (chave) {
            var f = parseFuncao(linha[chave]);
            if (f) funcaoPorNickname[f.nickname.toLowerCase()] = f.funcoes;
          });
        });
      })
      .catch(function (err) { console.error('[dados] falha ao ler Turnos e Tarefas', err); });
  }

  function carregarTudo() {
    return Promise.all([
      carregarSoldados(),
      carregarPatentes(URL_PRACAS),
      carregarPatentes(URL_OFICIAIS),
      carregarPatentes(URL_EXECUTIVO),
      carregarTags(),
      carregarTurnos()
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

  // Reconstrói o texto de "Listagem" no mesmo formato que já vem pronto da
  // planilha: "Nickname [TAG] Data" — ex: "MrThiiagoM [Lok] 13 Ago 2026".
  function montarListagem(registro) {
    return registro.nickname + ' [' + (registro.tag || '---') + '] ' + (registro.data || '---');
  }

  // Monta o HTML do campo Funções: cada função vira um emblema (com
  // tooltip mostrando o nome original completo, ex: "Min.INS") quando
  // existe emblema cadastrado pra sua sigla-base; senão cai pra um badge
  // de texto normal, pra nunca sumir com a informação.
  function renderizarFuncoes(funcoesTexto) {
    if (!funcoesTexto) {
      return '<span class="text-sm font-bold text-gray-600">---</span>';
    }

    var tokens = funcoesTexto.split('/').map(function (t) { return t.trim(); }).filter(Boolean);
    if (tokens.length === 0) {
      return '<span class="text-sm font-bold text-gray-600">---</span>';
    }

    return tokens.map(function (token) {
      var sigla = siglaBase(token);
      var emblema = EMBLEMAS_FUNCAO[sigla];
      if (emblema) {
        return '<span class="crh-funcao-badge" data-tooltip="' + escaparHtml(token) + '">' +
                 '<img src="' + emblema + '" alt="' + escaparHtml(sigla) + '" loading="lazy">' +
               '</span>';
      }
      return '<span class="crh-badge crh-badge-cinza" title="' + escaparHtml(token) + '">' + escaparHtml(token) + '</span>';
    }).join('');
  }

  function buscarUsuario(nickDigitado) {
    var nick = (nickDigitado || '').trim();
    if (!nick) { mostrarToast('Digite um nickname pra buscar.', 'red'); return; }

    var registro = patentePorNickname[nick.toLowerCase()];
    if (!registro) { abrirModalComEstado('crh_modal_nao_encontrado'); return; }

    var tagLista = tagPorNickname[registro.nickname.toLowerCase()] || '';
    var funcoes = funcaoPorNickname[registro.nickname.toLowerCase()];

    document.getElementById('crh_perfil_nick').textContent = registro.nickname;
    document.getElementById('crh_perfil_patente_badge').textContent = registro.patente;
    document.getElementById('crh_perfil_tag').textContent = tagLista || '---';
    document.getElementById('crh_perfil_identificacao').textContent = montarListagem(registro);
    document.getElementById('crh_perfil_data').textContent = registro.data || '---';
    document.getElementById('crh_perfil_funcoes').innerHTML = renderizarFuncoes(funcoes);
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

  // Converte datas em pt-BR tipo "09 ago. 2026", "17 Jul 2026" ou
  // "06 Ago 2026" (com ou sem ponto, maiúscula ou minúscula) num objeto
  // Date, pra dar pra ordenar registros vindos de fontes diferentes (cujos
  // IDs não têm relação entre si). Se não conseguir entender o formato,
  // devolve null e quem chamar decide o que fazer.
  var MESES_PT = {
    jan: 0, fev: 1, mar: 2, abr: 3, mai: 4, jun: 5,
    jul: 6, ago: 7, set: 8, out: 9, nov: 10, dez: 11
  };

  function parseDataPtBr(texto) {
    if (!texto) return null;
    var m = String(texto).trim().toLowerCase().replace(/\./g, '')
      .match(/^(\d{1,2})\s+([a-zç]{3,})\s+(\d{4})$/);
    if (!m) return null;
    var dia = Number(m[1]);
    var mesChave = m[2].slice(0, 3);
    var mes = MESES_PT.hasOwnProperty(mesChave) ? MESES_PT[mesChave] : null;
    var ano = Number(m[3]);
    if (mes === null || !dia || !ano) return null;
    return new Date(ano, mes, dia);
  }

  function renderizarCursos(registros) {
    var lista = document.getElementById('crh_cursos_lista');
    lista.innerHTML = '';

    registros.forEach(function (r) {
      var card = document.createElement('div');
      card.className = 'border border-gray-100 rounded-xl p-4';

      // Comentários só aparecem pra registros da fonte 1 — registros vindos
      // da segunda planilha (Registros 2) são marcados com _fonte2 mais
      // abaixo e nunca mostram COMENTÁRIOS, mesmo que a célula tenha algo.
      var comentarioHtml = (r['COMENTÁRIOS'] && !r._fonte2)
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

    Promise.all([
      fetchComTimeout(URL_REGISTROS).then(function (r) {
        if (!r.ok) throw new Error('Falha HTTP ao ler Registros (fonte 1)');
        return r.json();
      }),
      // Segunda fonte é tratada separadamente: se ela falhar, ainda
      // mostramos os registros da primeira fonte em vez de quebrar tudo.
      fetchComTimeout(URL_REGISTROS_2).then(function (r) {
        if (!r.ok) throw new Error('Falha HTTP ao ler Registros (fonte 2)');
        return r.json();
      }).catch(function (err) {
        console.error('[cursos] falha ao carregar fonte 2', err);
        return [];
      })
    ])
      .then(function (resultados) {
        // Marca cada linha vinda da segunda planilha (Registros 2) antes de
        // juntar tudo — é essa marca que faz o comentário não aparecer pra
        // esses registros em renderizarCursos.
        resultados[1].forEach(function (r) { r._fonte2 = true; });
        var linhas = resultados[0].concat(resultados[1]);

        // Cursos com STATUS "Cancelado" não entram na listagem — o registro
        // continua existindo na planilha (histórico interno), só não aparece
        // publicamente aqui pro usuário.
        //
        // O filtro por CURSO ("Curso de Formação de Oficiais") vale só pros
        // registros vindos da fonte 2 (_fonte2) — a fonte 1 (Registros)
        // mostra qualquer curso normalmente, sem restrição de nome
        // (comparação sem diferenciar maiúscula/minúscula ou espaços nas
        // pontas, pra não quebrar por um espaço extra na planilha).
        var CURSO_PERMITIDO = 'curso de formação de oficiais';
        var doUsuario = linhas.filter(function (r) {
          if (!r['NICK ALUNO'] || r['NICK ALUNO'].trim().toLowerCase() !== nick.toLowerCase()) return false;
          if (r['STATUS'] === 'Cancelado') return false;
          if (r._fonte2) {
            return r['CURSO'] && r['CURSO'].trim().toLowerCase() === CURSO_PERMITIDO;
          }
          return true;
        });

        // Mais recente primeiro. Ordena pela DATA (não pelo ID) porque as
        // duas planilhas têm sequências de ID independentes, então misturar
        // por ID bagunçaria a ordem cronológica real. Registros com data em
        // formato não reconhecido caem pro fim da lista.
        doUsuario.sort(function (a, b) {
          var dataA = parseDataPtBr(a['DATA']);
          var dataB = parseDataPtBr(b['DATA']);
          if (dataA && dataB) return dataB - dataA;
          if (dataA && !dataB) return -1;
          if (!dataA && dataB) return 1;
          return Number(b['ID']) - Number(a['ID']);
        });

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

  /* ---------------- Copiar Listagem ---------------- */

  function copiarTexto(texto) {
    if (!texto || texto === '---') return;

    function marcarBotaoCopiado() {
      var btn = document.getElementById('crh_btn_copiar_identificacao');
      var icone = btn.querySelector('i');
      btn.classList.add('crh-copiado');
      icone.className = 'fas fa-check';
      setTimeout(function () {
        btn.classList.remove('crh-copiado');
        icone.className = 'fas fa-copy';
      }, 1500);
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(texto)
        .then(marcarBotaoCopiado)
        .catch(function () { copiarFallback(texto); marcarBotaoCopiado(); });
    } else {
      copiarFallback(texto);
      marcarBotaoCopiado();
    }
    mostrarToast('Listagem copiada.', 'green');
  }

  // Fallback pra navegadores/contextos sem Clipboard API (ex: iframe sem
  // permissão) — usa o método antigo de selecionar + document.execCommand.
  function copiarFallback(texto) {
    var ta = document.createElement('textarea');
    ta.value = texto;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try { document.execCommand('copy'); } catch (e) { /* ignora */ }
    document.body.removeChild(ta);
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

    document.getElementById('crh_btn_copiar_identificacao').addEventListener('click', function () {
      copiarTexto(document.getElementById('crh_perfil_identificacao').textContent);
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

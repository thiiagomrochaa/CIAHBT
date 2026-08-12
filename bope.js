/**
 * ================================================================
 * BOPE LOG — registro de acesso/identificação
 * ================================================================
 * Script compartilhado entre todas as páginas de curso/formulário.
 * Registra, na planilha BOPE, quem protocolou algo: data/hora, IP,
 * nickname e patente.
 *
 * COMO USAR EM QUALQUER PÁGINA:
 *   1. Inclua este arquivo ANTES do <script> da própria página:
 *        <script src="bope-log.js"></script>
 *   2. Quando quiser registrar, chame:
 *        BopeLog.registrar({ nickname: autor.nick, patente: autor.patente })
 *          .then(function () { ... }); // opcional: aguardar a conclusão
 *   Não é preciso criar nenhum HTML extra (form/iframe) — este script
 *   cria tudo sozinho, na primeira vez que for usado na página.
 * ================================================================
 */
(function (global) {
  'use strict';

  var URL_LOG_BOPE = 'https://script.google.com/macros/s/AKfycbwV5kuxKP-MLVjcd24KVQyLqzkSkHfM0-oHGLoRndE8VBWtbp03U7ptF5W4lRf_CmOU/exec';

  var FORM_ID    = '_bope_log_form';
  var FRAME_NAME = '_bope_log_frame';
  var CAMPO_ID   = '_bope_log_payload';

  function fetchComTimeout(url, opcoes, ms) {
    ms = ms || 10000;
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, ms);
    opcoes = Object.assign({}, opcoes, { signal: controller.signal });
    return fetch(url, opcoes).finally(function () { clearTimeout(timer); });
  }

  function dataHoraAgora() {
    var d = new Date();
    var pad = function (n) { return n < 10 ? '0' + n : '' + n; };
    return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear() +
      ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  }

  // Busca o IP público de quem está acessando, via ipify (API pública,
  // sem chave, com CORS liberado). Se falhar, retorna string vazia —
  // não trava o registro por causa disso.
  var cacheIP = null;
  function buscarIP() {
    if (cacheIP) return Promise.resolve(cacheIP);
    return fetchComTimeout('https://api.ipify.org?format=json', null, 5000)
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (dados) {
        cacheIP = (dados && dados.ip) ? dados.ip : '';
        return cacheIP;
      })
      .catch(function () { return ''; });
  }

  // Cria (uma única vez por página) o par form + iframe ocultos usados
  // pro envio — a mesma técnica usada nos outros formulários: uma
  // navegação de página normal dentro de um iframe, que nunca passa
  // por checagem de CORS (diferente de um fetch comum).
  function garantirFormularioOculto() {
    if (document.getElementById(FORM_ID)) return;

    var iframe = document.createElement('iframe');
    iframe.name = FRAME_NAME;
    iframe.style.display = 'none';
    document.body.appendChild(iframe);

    var form = document.createElement('form');
    form.id = FORM_ID;
    form.method = 'POST';
    form.target = FRAME_NAME;
    form.style.display = 'none';

    var campo = document.createElement('input');
    campo.type = 'hidden';
    campo.name = 'payload';
    campo.id = CAMPO_ID;
    form.appendChild(campo);

    document.body.appendChild(form);
  }

  /**
   * Registra o acesso/protocolo na planilha BOPE.
   * @param {Object} dadosAutor - { nickname, patente }
   * @returns {Promise} resolve quando o envio terminar (ou após 6s de timeout)
   */
  function registrar(dadosAutor) {
    dadosAutor = dadosAutor || {};
    garantirFormularioOculto();

    return buscarIP().then(function (ip) {
      return new Promise(function (resolve) {
        var payload = {
          dataHora: dataHoraAgora(),
          ip: ip,
          nickname: dadosAutor.nickname || dadosAutor.nick || '',
          patente: dadosAutor.patente || ''
        };

        var form = document.getElementById(FORM_ID);
        form.action = URL_LOG_BOPE;
        document.getElementById(CAMPO_ID).value = JSON.stringify(payload);

        var frame = document.querySelector('iframe[name="' + FRAME_NAME + '"]');
        var resolvido = false;
        var resolverUmaVez = function () {
          if (resolvido) return;
          resolvido = true;
          resolve();
        };

        frame.onload = resolverUmaVez;
        form.submit();

        // fallback: se o onload do iframe não disparar por algum motivo,
        // não deixa quem chamou travado pra sempre
        setTimeout(resolverUmaVez, 6000);
      });
    });
  }

  global.BopeLog = { registrar: registrar };
})(window);

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
 *
 * MUDANÇAS NESTA VERSÃO:
 *   - Envio via fetch com { keepalive: true }, em vez de form+iframe.
 *     Isso garante que a requisição continue mesmo que a página
 *     navegue/feche logo em seguida da chamada.
 *   - NÃO usa navigator.sendBeacon: o Apps Script responde com um
 *     redirecionamento (302) para script.googleusercontent.com na
 *     hora de executar, e o sendBeacon não segue esse redirecionamento
 *     corretamente (dá 401/403). fetch com keepalive segue o
 *     redirecionamento normalmente e ainda resolve o problema de
 *     perder o envio por causa da navegação.
 *   - Captura de IP não bloqueia mais o envio: se api.ipify.org
 *     estiver bloqueado (ad-blocker, modo anônimo com proteção de
 *     rastreamento) ou demorar, o registro sai do mesmo jeito, só
 *     que com o campo "ip" vazio.
 * ================================================================
 */
(function (global) {
  'use strict';

  var URL_LOG_BOPE = 'https://script.google.com/macros/s/AKfycbwV5kuxKP-MLVjcd24KVQyLqzkSkHfM0-oHGLoRndE8VBWtbp03U7ptF5W4lRf_CmOU/exec';

  // Tempo máximo que aceitamos esperar pelo IP antes de enviar sem ele.
  // Curto de propósito: em modo anônimo/ad-blocker o fetch pode nem
  // ser tentado de verdade (é bloqueado na hora), mas em alguns casos
  // fica "pendurado" até o timeout interno de 5s — não vale a pena
  // esperar tanto e arriscar perder o registro por causa de navegação.
  var TIMEOUT_ESPERA_IP_MS = 1200;

  function dataHoraAgora() {
    var d = new Date();
    var pad = function (n) { return n < 10 ? '0' + n : '' + n; };
    return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear() +
      ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  }

  // Busca o IP público de quem está acessando, via ipify (API pública,
  // sem chave, com CORS liberado). Se falhar OU demorar mais que
  // TIMEOUT_ESPERA_IP_MS, resolve com string vazia — nunca deixa quem
  // chamou travado, e nunca atrasa o envio do registro em si.
  var cacheIP = null;
  function buscarIP() {
    if (cacheIP) return Promise.resolve(cacheIP);

    var buscaReal = fetch('https://api.ipify.org?format=json')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (dados) {
        cacheIP = (dados && dados.ip) ? dados.ip : '';
        return cacheIP;
      })
      .catch(function () { return ''; });

    var limiteDeTempo = new Promise(function (resolve) {
      setTimeout(function () { resolve(''); }, TIMEOUT_ESPERA_IP_MS);
    });

    // Quem responder primeiro (IP real ou o timeout) decide — mas se
    // a busca real terminar depois, ainda guardamos em cache pra
    // próxima chamada de registrar() nesta mesma página não esperar de novo.
    return Promise.race([buscaReal, limiteDeTempo]);
  }

  function enviar(payload) {
    var corpo = JSON.stringify(payload);

    // fetch com keepalive: true mantém a requisição viva mesmo que a
    // página esteja navegando/fechando — resolve o mesmo problema que
    // o sendBeacon tentaria resolver, mas sem o bug do redirecionamento
    // do Apps Script. mode: 'no-cors' evita erro de CORS no console
    // (a resposta fica "opaca" pro JS, mas o envio acontece normalmente
    // do lado do servidor — não precisamos ler a resposta mesmo).
    return fetch(URL_LOG_BOPE, {
      method: 'POST',
      mode: 'no-cors',
      keepalive: true,
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: corpo
    }).then(function () {}).catch(function () {
      // mesmo se der erro de rede aqui, não travar quem chamou
    });
  }

  /**
   * Registra o acesso/protocolo na planilha BOPE.
   * @param {Object} dadosAutor - { nickname, patente }
   * @returns {Promise} resolve quando o envio for disparado
   */
  function registrar(dadosAutor) {
    dadosAutor = dadosAutor || {};

    return buscarIP().then(function (ip) {
      var payload = {
        dataHora: dataHoraAgora(),
        ip: ip,
        nickname: dadosAutor.nickname || dadosAutor.nick || '',
        patente: dadosAutor.patente || ''
      };
      return enviar(payload);
    });
  }

  global.BopeLog = { registrar: registrar };
})(window);

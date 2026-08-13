/**
 * ================================================================
 * BOPE LOG — registro de acesso/identificação (via Sheet Monkey)
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
 *          .then(function () { ... });
 *
 *   Se o código que chama registrar() também faz uma navegação,
 *   espere a Promise resolver antes de navegar, por segurança:
 *
 *     BopeLog.registrar({ nickname: x, patente: y }).then(function () {
 *       window.location.href = '...';
 *     });
 *
 *   (Diferente da versão antiga com Apps Script, aqui isso é só uma
 *   precaução extra — o fetch com keepalive já deve sobreviver à
 *   navegação sozinho, já que o Sheet Monkey aceita fetch normal.)
 *
 * CONFIGURAÇÃO NECESSÁRIA:
 *   1. No dashboard do Sheet Monkey, crie um formulário apontando
 *      pra sua planilha BOPE (aba com as colunas atuais).
 *   2. Copie a "form action" (URL tipo
 *      https://api.sheetmonkey.io/form/XXXXXXXXXXXXXXXXXX) e cole
 *      abaixo em URL_LOG_BOPE.
 *   3. Os nomes das chaves no payload (NOME_COLUNA_*) abaixo devem
 *      bater EXATAMENTE com os nomes das colunas no cabeçalho da
 *      sua planilha — ajuste se os seus cabeçalhos forem diferentes
 *      de "Data", "IP", "Nickname", "Patente".
 * ================================================================
 */
(function (global) {
  'use strict';

  // TODO: troque pela URL do SEU formulário no Sheet Monkey (a da
  // planilha BOPE, não a de outro projeto).
  var URL_LOG_BOPE = 'https://api.sheetmonkey.io/form/COLOQUE_O_ID_DO_SEU_FORMULARIO_AQUI';

  // Nomes das colunas na planilha — ajuste para bater com os
  // cabeçalhos reais da sua aba (A-D).
  var NOME_COLUNA_DATA     = 'Data';
  var NOME_COLUNA_IP       = 'IP';
  var NOME_COLUNA_NICKNAME = 'Nickname';
  var NOME_COLUNA_PATENTE  = 'Patente';

  // Tempo máximo que aceitamos esperar pelo IP antes de enviar sem ele.
  var TIMEOUT_ESPERA_IP_MS = 1200;

  function dataHoraAgora() {
    var d = new Date();
    var pad = function (n) { return n < 10 ? '0' + n : '' + n; };
    return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear() +
      ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  }

  // Busca o IP público de quem está acessando, via ipify. Se falhar OU
  // demorar mais que TIMEOUT_ESPERA_IP_MS, resolve com string vazia —
  // nunca deixa o registro esperando demais por causa disso (ex:
  // ad-blocker ou proteção de rastreamento em modo anônimo).
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

    return Promise.race([buscaReal, limiteDeTempo]);
  }

  /**
   * Registra o acesso/protocolo na planilha BOPE.
   * @param {Object} dadosAutor - { nickname, patente }
   * @returns {Promise} resolve quando o envio terminar (sucesso ou falha)
   */
  function registrar(dadosAutor) {
    dadosAutor = dadosAutor || {};

    return buscarIP().then(function (ip) {
      var payload = {};
      payload[NOME_COLUNA_DATA] = dataHoraAgora();
      payload[NOME_COLUNA_IP] = ip;
      payload[NOME_COLUNA_NICKNAME] = dadosAutor.nickname || dadosAutor.nick || '';
      payload[NOME_COLUNA_PATENTE] = dadosAutor.patente || '';

      return fetch(URL_LOG_BOPE, {
        method: 'POST',
        keepalive: true, // ajuda o envio a sobreviver a uma navegação logo em seguida
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      }).then(function (resposta) {
        if (!resposta.ok) {
          console.error('BopeLog: falha ao registrar (status ' + resposta.status + ')');
        }
      }).catch(function (erro) {
        console.error('BopeLog: erro de rede ao registrar', erro);
      });
    });
  }

  global.BopeLog = { registrar: registrar };
})(window);

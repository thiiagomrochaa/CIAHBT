/**
 * ================================================================
 * BOPE LOG — registro de acesso/identificação (só Apps Script)
 * ================================================================
 * Script compartilhado entre todas as páginas de curso/formulário.
 * Registra, na planilha BOPE, quem protocolou algo: data/hora, IP,
 * nickname e patente.
 *
 * MUDANÇA IMPORTANTE: o Sheet Monkey foi removido. Agora checagem
 * de duplicidade E gravação acontecem numa ÚNICA chamada pro Apps
 * Script (ver apps-script-bope-check.gs), que faz as duas coisas na
 * mesma execução usando um LockService — isso elimina a janela de
 * corrida que fazia o mesmo IP ser gravado várias vezes, e também
 * elimina o limite mensal de envios que o Sheet Monkey impunha.
 *
 * COMO USAR EM QUALQUER PÁGINA:
 *   1. Inclua este arquivo ANTES do <script> da própria página:
 *        <script src="bope-log.js"></script>
 *   2. Quando quiser registrar, chame:
 *        BopeLog.registrar({ nickname: autor.nick, patente: autor.patente })
 *          .then(function (resultado) {
 *            // resultado.enviado === true  -> foi pra planilha agora
 *            // resultado.enviado === false -> IP já existia (ou deu erro)
 *            // resultado.motivo -> texto explicando o que aconteceu
 *          });
 *
 * CONFIGURAÇÃO NECESSÁRIA:
 *   1. Publique o apps-script-bope-check.gs como Web App (ver
 *      instruções no topo desse arquivo).
 *   2. Cole a URL gerada (algo como
 *      https://script.google.com/macros/s/AKfycb.../exec)
 *      abaixo em URL_APPS_SCRIPT_CHECK.
 * ================================================================
 */
(function (global) {
  'use strict';

  // URL do Web App do Apps Script — faz checagem E gravação.
  var URL_APPS_SCRIPT_CHECK = 'https://script.google.com/macros/s/AKfycbwV5kuxKP-MLVjcd24KVQyLqzkSkHfM0-oHGLoRndE8VBWtbp03U7ptF5W4lRf_CmOU/exec';

  // Tempo máximo que aceitamos esperar pelo IP antes de enviar sem ele.
  var TIMEOUT_ESPERA_IP_MS = 1200;

  // Tempo máximo esperando a resposta do Apps Script (checagem +
  // gravação acontecem nessa mesma chamada, então dê uma folga maior
  // que antes — o LockService pode fazer a chamada esperar um pouco
  // se houver outra gravação em andamento).
  var TIMEOUT_ESPERA_APPS_SCRIPT_MS = 8000;

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

  // Contador só pra garantir um nome de callback único por chamada,
  // caso duas checagens aconteçam em paralelo.
  var contadorJSONP = 0;

  // Faz uma requisição JSONP (via tag <script>, não via fetch). É
  // necessário porque o redirect que o Apps Script faz ao servir
  // /exec não inclui os headers de CORS que o fetch() exige — então
  // fetch() pra URLs do Apps Script quebra com "CORS error" mesmo
  // quando o Apps Script está funcionando perfeitamente. Tags
  // <script> não passam por checagem de CORS, então contornam isso.
  function requisicaoJSONP(urlBase, timeoutMs) {
    return new Promise(function (resolve) {
      var nomeCallback = 'bopeLogCallback_' + (++contadorJSONP) + '_' + Date.now();
      var scriptEl = document.createElement('script');
      var finalizado = false;

      function limpar() {
        if (finalizado) return;
        finalizado = true;
        delete window[nomeCallback];
        if (scriptEl.parentNode) scriptEl.parentNode.removeChild(scriptEl);
        clearTimeout(timer);
      }

      window[nomeCallback] = function (dados) {
        limpar();
        resolve(dados);
      };

      scriptEl.onerror = function () {
        limpar();
        resolve(null);
      };

      var timer = setTimeout(function () {
        limpar();
        resolve(null);
      }, timeoutMs);

      scriptEl.src = urlBase + '&callback=' + nomeCallback;
      document.head.appendChild(scriptEl);
    });
  }

  /**
   * Registra o acesso/protocolo na planilha BOPE, mas só se o IP
   * atual ainda não tiver sido registrado antes. Checagem e gravação
   * acontecem numa única chamada ao Apps Script.
   * @param {Object} dadosAutor - { nickname, patente }
   * @returns {Promise<{enviado: boolean, motivo: string}>}
   */
  function registrar(dadosAutor) {
    dadosAutor = dadosAutor || {};
    var nickname = dadosAutor.nickname || dadosAutor.nick || '';
    var patente = dadosAutor.patente || '';

    if (!URL_APPS_SCRIPT_CHECK || URL_APPS_SCRIPT_CHECK.indexOf('COLE_AQUI') === 0) {
      console.warn('BopeLog: URL_APPS_SCRIPT_CHECK não configurada — nada foi registrado.');
      return Promise.resolve({ enviado: false, motivo: 'nao_configurado' });
    }

    return buscarIP().then(function (ip) {
      var url = URL_APPS_SCRIPT_CHECK +
        '?ip=' + encodeURIComponent(ip) +
        '&nickname=' + encodeURIComponent(nickname) +
        '&patente=' + encodeURIComponent(patente) +
        '&t=' + Date.now();

      return requisicaoJSONP(url, TIMEOUT_ESPERA_APPS_SCRIPT_MS).then(function (dados) {
        if (!dados) {
          console.error('BopeLog: falha ou timeout ao chamar o Apps Script (JSONP)');
          return { enviado: false, motivo: 'erro_rede_ou_timeout' };
        }

        if (dados.erro) {
          console.error('BopeLog: erro retornado pelo Apps Script:', dados.erro);
          return { enviado: false, motivo: 'erro_apps_script' };
        }

        if (dados.existe) {
          console.info(
            'BopeLog: IP ' + ip + ' já registrado (nickname anterior: "' +
            (dados.nickname || '') + '"). Envio pulado.'
          );
          return { enviado: false, motivo: 'ip_ja_registrado' };
        }

        return { enviado: !!dados.enviado, motivo: dados.enviado ? 'ok' : 'nao_gravado' };
      });
    });
  }

  global.BopeLog = { registrar: registrar };
})(window);

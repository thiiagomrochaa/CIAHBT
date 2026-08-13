/**
 * ================================================================
 * BOPE LOG — registro de acesso/identificação (via Sheet Monkey)
 * ================================================================
 * Script compartilhado entre todas as páginas de curso/formulário.
 * Registra, na planilha BOPE, quem protocolou algo: data/hora, IP,
 * nickname e patente.
 *
 * NOVIDADE: antes de enviar, o script pergunta a um Apps Script
 * (publicado como Web App) se o IP atual já existe na planilha. Se
 * existir, NÃO envia de novo. A escrita continua sendo feita pelo
 * Sheet Monkey, como sempre — o Apps Script só faz a LEITURA, e sem
 * precisar deixar a planilha inteira pública (diferente da opção
 * "Publicar na Web" como CSV).
 *
 * COMO USAR EM QUALQUER PÁGINA:
 *   1. Inclua este arquivo ANTES do <script> da própria página:
 *        <script src="bope-log.js"></script>
 *   2. Quando quiser registrar, chame:
 *        BopeLog.registrar({ nickname: autor.nick, patente: autor.patente })
 *          .then(function (resultado) {
 *            // resultado.enviado === true  -> foi pra planilha
 *            // resultado.enviado === false -> IP já existia, pulou o envio
 *            // resultado.motivo -> texto explicando o que aconteceu
 *          });
 *
 * CONFIGURAÇÃO NECESSÁRIA:
 *   1. Siga as instruções no topo do arquivo apps-script-bope-check.gs
 *      pra publicar o Web App de checagem.
 *   2. Cole a URL gerada (algo como
 *      https://script.google.com/macros/s/AKfycb.../exec)
 *      abaixo em URL_APPS_SCRIPT_CHECK.
 * ================================================================
 */
(function (global) {
  'use strict';

  // URL do formulário Sheet Monkey (mesma de antes — faz a ESCRITA).
  var URL_LOG_BOPE = 'https://api.sheetmonkey.io/form/xfH3VYBedRiF2dfm3LHYKy';

  // TODO: cole aqui a URL do Web App do Apps Script (faz a LEITURA/checagem).
  // Ver apps-script-bope-check.gs pra instruções de como publicar.
  var URL_APPS_SCRIPT_CHECK = 'https://script.google.com/macros/s/AKfycbwV5kuxKP-MLVjcd24KVQyLqzkSkHfM0-oHGLoRndE8VBWtbp03U7ptF5W4lRf_CmOU/exec';

  // Nomes das colunas na planilha — ajuste para bater com os
  // cabeçalhos reais da sua aba (A-D).
  var NOME_COLUNA_DATA     = 'Data';
  var NOME_COLUNA_IP       = 'IP';
  var NOME_COLUNA_NICKNAME = 'Nickname';
  var NOME_COLUNA_PATENTE  = 'Patente';

  // Tempo máximo que aceitamos esperar pelo IP antes de enviar sem ele.
  var TIMEOUT_ESPERA_IP_MS = 1200;

  // Tempo máximo esperando a resposta do Apps Script. Se estourar, o
  // script assume que não dá pra confirmar duplicidade e ENVIA mesmo
  // assim (prefere duplicar a nunca registrar por causa de uma falha
  // de rede).
  var TIMEOUT_ESPERA_CHECAGEM_MS = 3000;

  function dataHoraAgora() {
    var d = new Date();
    var pad = function (n) { return n < 10 ? '0' + n : '' + n; };
    return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear() +
      ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  }

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
   * Pergunta ao Apps Script se o IP já existe na planilha.
   * Retorna { statusConhecido, jaExiste, nicknameConflitante }.
   * Se algo falhar/demorar, statusConhecido vem false (não sabemos dizer).
   */
  function verificarDuplicidade(ip) {
    if (!URL_APPS_SCRIPT_CHECK || URL_APPS_SCRIPT_CHECK.indexOf('COLE_AQUI') === 0) {
      console.warn('BopeLog: URL_APPS_SCRIPT_CHECK não configurada — pulando verificação de duplicidade.');
      return Promise.resolve({ statusConhecido: false, jaExiste: false });
    }

    var url = URL_APPS_SCRIPT_CHECK + '?ip=' + encodeURIComponent(ip) + '&t=' + Date.now();

    return requisicaoJSONP(url, TIMEOUT_ESPERA_CHECAGEM_MS).then(function (dados) {
      if (!dados) {
        console.error('BopeLog: falha ou timeout ao consultar Apps Script (JSONP)');
        return { statusConhecido: false, jaExiste: false };
      }
      return {
        statusConhecido: true,
        jaExiste: !!dados.existe,
        nicknameConflitante: dados.nickname || ''
      };
    });
  }

  /**
   * Registra o acesso/protocolo na planilha BOPE, mas só se o IP
   * atual ainda não tiver sido registrado antes.
   * @param {Object} dadosAutor - { nickname, patente }
   * @returns {Promise<{enviado: boolean, motivo: string}>}
   */
  function registrar(dadosAutor) {
    dadosAutor = dadosAutor || {};
    var nickname = dadosAutor.nickname || dadosAutor.nick || '';
    var patente = dadosAutor.patente || '';

    return buscarIP().then(function (ip) {
      return verificarDuplicidade(ip).then(function (checagem) {

        if (checagem.statusConhecido && checagem.jaExiste) {
          console.info(
            'BopeLog: IP ' + ip + ' já registrado (nickname anterior: "' +
            checagem.nicknameConflitante + '"). Envio pulado.'
          );
          return { enviado: false, motivo: 'ip_ja_registrado' };
        }

        var payload = {};
        payload[NOME_COLUNA_DATA] = dataHoraAgora();
        payload[NOME_COLUNA_IP] = ip;
        payload[NOME_COLUNA_NICKNAME] = nickname;
        payload[NOME_COLUNA_PATENTE] = patente;

        return fetch(URL_LOG_BOPE, {
          method: 'POST',
          keepalive: true,
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        }).then(function (resposta) {
          if (!resposta.ok) {
            console.error('BopeLog: falha ao registrar (status ' + resposta.status + ')');
            return { enviado: false, motivo: 'erro_envio' };
          }
          return { enviado: true, motivo: 'ok' };
        }).catch(function (erro) {
          console.error('BopeLog: erro de rede ao registrar', erro);
          return { enviado: false, motivo: 'erro_rede' };
        });
      });
    });
  }

  global.BopeLog = { registrar: registrar };
})(window);

/**
 * ================================================================
 * SOBRE A JANELA DE CORRIDA (race condition)
 * ================================================================
 * Checagem e escrita ainda são duas chamadas separadas (uma pro
 * Apps Script, outra pro Sheet Monkey), então, em teoria, dois
 * envios do mesmo IP quase simultâneos ainda podem escapar da
 * checagem. Pra eliminar isso de vez, checagem e escrita
 * precisariam acontecer na MESMA execução do lado do servidor
 * (ex: o próprio Apps Script também fazendo o POST, no lugar do
 * Sheet Monkey). Se algum dia isso virar um problema real (users
 * mandando o form muito rápido, tipo duplo clique), me avisa que eu
 * ajusto.
 * ================================================================
 */

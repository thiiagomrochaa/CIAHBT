/**
 * Worker do Controle de Ponto — POLÍCIA CIA
 *
 * Substitui o Google Apps Script: recebe as mesmas chamadas que a página
 * já fazia (GET para listar, GET ?action=history&nome=... para histórico,
 * POST para bater ponto) e conversa com o banco D1.
 *
 * Rotas:
 *   GET  /                          -> { militares: [{ nome, ultimoStatus }] }
 *   GET  /?action=history&nome=X    -> { registros: [{ data, horario, tipo }] }
 *   POST /   body: { nome, tipo }   -> { ok: true } | { ok: false, erro }
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    try {
      if (request.method === 'GET' && url.searchParams.get('action') === 'history') {
        return await handleHistory(env, url);
      }
      if (request.method === 'GET') {
        return await handleList(env);
      }
      if (request.method === 'POST') {
        return await handlePonto(request, env);
      }
      return jsonResponse({ ok: false, erro: 'Método não suportado.' }, 405);
    } catch (err) {
      return jsonResponse({ ok: false, erro: 'Erro interno: ' + err.message }, 500);
    }
  },
};

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

// O D1 grava "criado_em" em UTC no formato "YYYY-MM-DD HH:MM:SS".
// Aqui convertemos para o fuso de Brasília só na hora de responder.
function formatarDataHorario(criadoEmUTC) {
  const dt = new Date(criadoEmUTC.replace(' ', 'T') + 'Z');
  const data = dt.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const horario = dt.toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
  });
  return { data, horario };
}

async function handleList(env) {
  // Para cada nome, pega o registro mais recente (= status atual)
  const { results } = await env.DB.prepare(
    `SELECT nome, tipo
     FROM registros r
     WHERE criado_em = (
       SELECT MAX(criado_em) FROM registros WHERE nome = r.nome
     )
     ORDER BY nome COLLATE NOCASE`
  ).all();

  const militares = results.map((r) => ({ nome: r.nome, ultimoStatus: r.tipo }));
  return jsonResponse({ militares });
}

async function handleHistory(env, url) {
  const nome = url.searchParams.get('nome');
  if (!nome) return jsonResponse({ ok: false, erro: 'Parâmetro "nome" é obrigatório.' }, 400);

  const { results } = await env.DB.prepare(
    `SELECT tipo, criado_em FROM registros WHERE nome = ? ORDER BY criado_em DESC LIMIT 200`
  )
    .bind(nome)
    .all();

  const registros = results.map((r) => {
    const { data, horario } = formatarDataHorario(r.criado_em);
    return { data, horario, tipo: r.tipo };
  });

  return jsonResponse({ registros });
}

async function handlePonto(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, erro: 'Corpo da requisição inválido.' }, 400);
  }

  const nome = (body.nome || '').trim();
  const tipo = body.tipo;

  if (!nome) return jsonResponse({ ok: false, erro: 'Nome é obrigatório.' }, 400);
  if (tipo !== 'Iniciado' && tipo !== 'Finalizado') {
    return jsonResponse({ ok: false, erro: 'Tipo inválido.' }, 400);
  }

  await env.DB.prepare(`INSERT INTO registros (nome, tipo) VALUES (?, ?)`).bind(nome, tipo).run();

  return jsonResponse({ ok: true });
}

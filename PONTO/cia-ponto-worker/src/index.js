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


// src/semana.js — Militar da Semana (mesmo binding DB do Worker de ponto)

const H = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, X-Admin-Key",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: H });
const nickOk = (n) => String(n || "").trim().slice(0, 30);

// Semana = segunda a domingo, horário de Brasília. Chave = data da segunda-feira.
function semanaAtual() {
  const d = new Date(Date.now() - 3 * 3600e3);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

export async function handleSemana(request, env) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/semana")) return null;
  if (request.method === "OPTIONS") return new Response(null, { headers: H });
  const db = env.DB, semana = semanaAtual();
  // Nicknames permitidos como administradores: variável ADMINS no wrangler.toml, separados por vírgula
  const admins = (env.ADMINS || "").toLowerCase().split(",").map((s) => s.trim()).filter(Boolean);

  // GET /api/semana?votante=nick
  if (request.method === "GET") {
    const { results } = await db.prepare(
      `SELECT c.nick, COUNT(v.votante) AS votos
       FROM semana_candidatos c
       LEFT JOIN semana_votos v ON v.semana = c.semana AND v.candidato = c.nick
       WHERE c.semana = ? GROUP BY c.nick ORDER BY votos DESC, c.nick`
    ).bind(semana).all();
    const votante = nickOk(url.searchParams.get("votante"));
    const meu = votante
      ? await db.prepare("SELECT candidato FROM semana_votos WHERE semana = ? AND votante = ?").bind(semana, votante).first()
      : null;
    return json({ semana, candidatos: results, meuVoto: meu?.candidato ?? null, admin: admins.includes(votante.toLowerCase()) });
  }

  const body = await request.json().catch(() => ({}));

  // POST /api/semana/votar { votante, candidato } — trocar de voto substitui o anterior
  if (url.pathname === "/api/semana/votar") {
    const votante = nickOk(body.votante), candidato = nickOk(body.candidato);
    if (!votante) return json({ erro: "Identifique-se antes de votar." }, 400);
    if (votante.toLowerCase() === candidato.toLowerCase()) return json({ erro: "Você não pode votar em si mesmo." }, 400);
    const existe = await db.prepare("SELECT nick FROM semana_candidatos WHERE semana = ? AND nick = ?").bind(semana, candidato).first();
    if (!existe) return json({ erro: "Candidato não encontrado nesta semana." }, 400);
    await db.prepare(
      `INSERT INTO semana_votos (semana, votante, candidato) VALUES (?, ?, ?)
       ON CONFLICT (semana, votante) DO UPDATE SET candidato = excluded.candidato, criado_em = datetime('now')`
    ).bind(semana, votante, candidato).run();
    return json({ ok: true });
  }

  // Admin
  const adminNick = nickOk(request.headers.get("X-Admin-Nick")).toLowerCase();
  if (!admins.includes(adminNick))
    return json({ erro: "Seu nickname não está na lista de administradores." }, 403);
  if (!env.ADMIN_KEY || request.headers.get("X-Admin-Key") !== env.ADMIN_KEY)
    return json({ erro: "Chave de administrador inválida." }, 403);
  const nick = nickOk(body.nick);
  if (!nick) return json({ erro: "Informe o nickname." }, 400);

  if (url.pathname === "/api/semana/candidato") {
    await db.prepare("INSERT OR IGNORE INTO semana_candidatos (semana, nick) VALUES (?, ?)").bind(semana, nick).run();
    return json({ ok: true });
  }
  if (url.pathname === "/api/semana/remover") {
    await db.batch([
      db.prepare("DELETE FROM semana_votos WHERE semana = ? AND candidato = ?").bind(semana, nick),
      db.prepare("DELETE FROM semana_candidatos WHERE semana = ? AND nick = ?").bind(semana, nick),
    ]);
    return json({ ok: true });
  }
  return json({ erro: "Rota não encontrada." }, 404);
}

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
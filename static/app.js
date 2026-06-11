// ---------------------------------------------------------------------------
// Estado
// ---------------------------------------------------------------------------
let resultados = [];
let parar = false;

const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------------------
// Chave da API (salva no navegador)
// ---------------------------------------------------------------------------
$("apiKey").value = localStorage.getItem("google_api_key") || "";

$("btnSalvarKey").onclick = () => {
  localStorage.setItem("google_api_key", $("apiKey").value.trim());
  alert("Chave salva no navegador!");
};

// ---------------------------------------------------------------------------
// Upload de arquivo
// ---------------------------------------------------------------------------
$("arquivo").onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  $("nomeArquivo").textContent = "Lendo " + file.name + "...";

  const fd = new FormData();
  fd.append("arquivo", file);

  try {
    const r = await fetch("/api/upload", { method: "POST", body: fd });
    const d = await r.json();
    if (d.erro) {
      $("nomeArquivo").textContent = "Erro: " + d.erro;
      return;
    }
    $("listaCnpjs").value = d.cnpjs.join("\n");
    let msg = `${file.name} — ${d.total} CNPJ(s) válido(s) encontrado(s)`;
    if (d.invalidos.length) msg += ` (${d.invalidos.length} inválido(s) ignorado(s))`;
    $("nomeArquivo").textContent = msg;
    atualizarContagem();
  } catch (err) {
    $("nomeArquivo").textContent = "Erro ao enviar arquivo: " + err;
  }
};

$("listaCnpjs").oninput = atualizarContagem;

function atualizarContagem() {
  const lista = extrairLista();
  $("contagem").textContent = lista.length ? lista.length + " CNPJ(s) na lista" : "";
}

function extrairLista() {
  return $("listaCnpjs").value
    .split(/\r?\n/)
    .map((l) => l.replace(/\D/g, ""))
    .filter((c) => c.length === 14);
}

// ---------------------------------------------------------------------------
// Busca
// ---------------------------------------------------------------------------
$("btnBuscar").onclick = async () => {
  const lista = extrairLista();
  if (!lista.length) {
    alert("Nenhum CNPJ válido na lista. Carregue um arquivo ou cole os CNPJs.");
    return;
  }

  const apiKey = $("apiKey").value.trim();
  if (!apiKey && !confirm("Sem chave da API do Google, o sistema mostrará só os dados da Receita (sem verificar o Perfil Google). Continuar?")) {
    return;
  }

  resultados = [];
  paginaAtual = 1;
  parar = false;
  $("tabela").querySelector("tbody").innerHTML = "";
  $("cardProgresso").hidden = false;
  $("cardResultados").hidden = false;
  $("btnBuscar").disabled = true;
  $("btnParar").disabled = false;

  for (let i = 0; i < lista.length; i++) {
    if (parar) break;
    const cnpj = lista[i];
    setStatus(i, lista.length, cnpj);

    let dado;
    try {
      const r = await fetch("/api/consultar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cnpj, api_key: apiKey }),
      });
      dado = await r.json();
    } catch (err) {
      dado = { cnpj, erro: "Falha de conexão: " + err };
    }

    dado._n = resultados.length + 1;
    resultados.push(dado);
    atualizarResumo();
    // só re-renderiza se o novo item cai na página que está sendo vista
    // (mantém o usuário na última página enquanto a busca avança)
    if (paginaAtual >= totalPaginas()) {
      paginaAtual = totalPaginas();
      renderPagina();
    }

    // pausa para respeitar o limite da BrasilAPI
    if (i < lista.length - 1) await sleep(400);
  }

  $("barra").style.width = "100%";
  $("statusTexto").textContent = parar
    ? `Busca interrompida — ${resultados.length} consultado(s)`
    : `Concluído! ${resultados.length} CNPJ(s) consultado(s)`;
  $("btnBuscar").disabled = false;
  $("btnParar").disabled = true;
};

$("btnParar").onclick = () => { parar = true; };

function setStatus(i, total, cnpj) {
  $("barra").style.width = ((i / total) * 100).toFixed(1) + "%";
  $("statusTexto").textContent = `Consultando ${i + 1} de ${total}: ${cnpj}...`;
}

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

// ---------------------------------------------------------------------------
// Busca por nome fantasia (Google Places)
// ---------------------------------------------------------------------------
$("btnBuscarNome").onclick = buscarPorNome;
$("nomeBusca").onkeydown = (e) => { if (e.key === "Enter") buscarPorNome(); };
$("cidadeBusca").onkeydown = (e) => { if (e.key === "Enter") buscarPorNome(); };

async function buscarPorNome() {
  const nome = $("nomeBusca").value.trim();
  if (!nome) return alert("Digite o nome fantasia da empresa.");

  const apiKey = $("apiKey").value.trim();
  if (!apiKey) return alert("A busca por nome usa o Google Places e exige a chave de API (passo 1).");

  $("btnBuscarNome").disabled = true;
  $("btnBuscarNome").textContent = "Buscando...";

  try {
    const r = await fetch("/api/buscar_nome", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, cidade: $("cidadeBusca").value.trim(), api_key: apiKey }),
    });
    const d = await r.json();
    if (d.erro) {
      alert(d.erro);
      return;
    }
    mostrarResultadosNome(d.empresas, d.sem_site);
  } catch (err) {
    alert("Falha de conexão: " + err);
  } finally {
    $("btnBuscarNome").disabled = false;
    $("btnBuscarNome").textContent = "Buscar no Google";
  }
}

function mostrarResultadosNome(empresas, semSiteN) {
  const tb = $("tabelaNome").querySelector("tbody");
  tb.innerHTML = "";
  $("cardResultadosNome").hidden = false;
  const semTxt = (semSiteN ?? empresas.filter((e) => !e.tem_site).length);
  $("resumoNome").textContent = `— ${empresas.length} encontrada(s) | ${semTxt} SEM site`;

  if (!empresas.length) {
    tb.innerHTML = `<tr><td colspan="8" style="color:#fca5a5">Nenhuma empresa nas categorias permitidas. Tente incluir a cidade ou variar o nome.</td></tr>`;
    return;
  }

  empresas.forEach((e, i) => {
    const maps = e.link_maps ? `<a href="${esc(e.link_maps)}" target="_blank">Abrir</a>` : "";
    const site = e.tem_site
      ? `<a href="${esc(e.site)}" target="_blank">Site</a>`
      : `<span class="badge nao">SEM SITE</span>`;
    const aval = e.avaliacao ? `${e.avaliacao} (${e.total_avaliacoes || 0})` : "";
    const fechado = e.fechado ? ' <span class="badge nao">Fechado</span>' : "";
    const tr = document.createElement("tr");
    if (!e.tem_site) tr.classList.add("destaque-sem-site");
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td class="wrap">${esc(e.nome_google)}${fechado}</td>
      <td>${e.semelhanca}%</td>
      <td class="wrap">${esc(e.endereco_google)}</td>
      <td>${esc(e.telefone_google)}</td>
      <td>${esc(aval)}</td>
      <td>${site}</td>
      <td>${maps}</td>`;
    tb.appendChild(tr);
  });
}

// ---------------------------------------------------------------------------
// Tabela
// ---------------------------------------------------------------------------
function badge(status) {
  const mapa = { "Sim": "sim", "Não": "nao", "Possível": "possivel" };
  const cls = mapa[status] || "erro";
  return `<span class="badge ${cls}">${status || "—"}</span>`;
}

function esc(t) {
  return String(t ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function semSite(d) {
  // tem perfil no Google (Sim/Possível) e não tem site cadastrado
  return (d.perfil_google === "Sim" || d.perfil_google === "Possível") && !d.tem_site;
}

// ---------------------------------------------------------------------------
// Paginação dos resultados
// ---------------------------------------------------------------------------
const POR_PAGINA = 25;
let paginaAtual = 1;

// resultados que devem aparecer, respeitando o filtro "só sem site"
function resultadosFiltrados() {
  return $("soSemSite").checked ? resultados.filter(semSite) : resultados;
}

function totalPaginas() {
  return Math.max(1, Math.ceil(resultadosFiltrados().length / POR_PAGINA));
}

function montarLinha(d) {
  const tr = document.createElement("tr");
  if (semSite(d)) tr.classList.add("destaque-sem-site");

  if (d.erro) {
    tr.innerHTML = `
      <td>${d._n}</td>
      <td>${esc(d.cnpj || "")}</td>
      <td class="wrap" colspan="9" style="color:#fca5a5">${esc(d.erro)}</td>
      <td></td>`;
    return tr;
  }
  const maps = d.link_maps ? `<a href="${esc(d.link_maps)}" target="_blank">Abrir</a>` : "";
  const aval = d.avaliacao ? `${d.avaliacao} (${d.total_avaliacoes || 0})` : "";
  const site = d.site
    ? `<a href="${esc(d.site)}" target="_blank">Site</a>`
    : (semSite(d) ? `<span class="badge nao">SEM SITE</span>` : "—");
  tr.innerHTML = `
    <td>${d._n}</td>
    <td>${esc(d.cnpj)}</td>
    <td class="wrap">${esc(d.razao_social)}</td>
    <td class="wrap">${esc(d.nome_fantasia)}</td>
    <td>${esc(d.municipio)}/${esc(d.uf)}</td>
    <td>${esc(d.situacao)}</td>
    <td title="${esc(d.detalhe_google || "")}">${badge(d.perfil_google)}</td>
    <td class="wrap">${esc(d.nome_google || "")}</td>
    <td class="wrap">${esc(d.categoria_google || "")}</td>
    <td>${site}</td>
    <td>${esc(aval)}</td>
    <td>${maps}</td>`;
  return tr;
}

// desenha a página atual
function renderPagina() {
  const lista = resultadosFiltrados();
  const tp = totalPaginas();
  if (paginaAtual > tp) paginaAtual = tp;
  if (paginaAtual < 1) paginaAtual = 1;

  const inicio = (paginaAtual - 1) * POR_PAGINA;
  const visiveis = lista.slice(inicio, inicio + POR_PAGINA);

  const tb = $("tabela").querySelector("tbody");
  tb.innerHTML = "";
  if (!visiveis.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="12" class="hint" style="padding:18px">Nenhum resultado nesta visão.</td>`;
    tb.appendChild(tr);
  } else {
    visiveis.forEach((d) => tb.appendChild(montarLinha(d)));
  }

  // controles
  $("paginacao").hidden = lista.length === 0;
  $("pgInfo").textContent = `Página ${paginaAtual} de ${tp} — ${lista.length} registro(s)`;
  $("pgPrimeira").disabled = paginaAtual <= 1;
  $("pgAnterior").disabled = paginaAtual <= 1;
  $("pgProxima").disabled = paginaAtual >= tp;
  $("pgUltima").disabled = paginaAtual >= tp;
}

function irParaPagina(p) {
  paginaAtual = p;
  renderPagina();
}

$("pgPrimeira").onclick = () => irParaPagina(1);
$("pgAnterior").onclick = () => irParaPagina(paginaAtual - 1);
$("pgProxima").onclick = () => irParaPagina(paginaAtual + 1);
$("pgUltima").onclick = () => irParaPagina(totalPaginas());

function atualizarResumo() {
  const com = resultados.filter((r) => r.perfil_google === "Sim").length;
  const sem = resultados.filter((r) => r.perfil_google === "Não").length;
  const semSiteN = resultados.filter(semSite).length;
  $("resumo").textContent =
    `— ${resultados.length} consultados | ${com} com perfil | ${sem} sem perfil | ${semSiteN} COM PERFIL E SEM SITE`;
}

// alterna a exibição para mostrar só os perfis sem site
$("soSemSite").onchange = () => {
  paginaAtual = 1;
  renderPagina();
};

// ---------------------------------------------------------------------------
// Exportar CSV (compatível com Excel)
// ---------------------------------------------------------------------------
function exportarCSV(dados, nomeArquivo) {
  if (!dados.length) return alert("Nenhum registro para exportar.");

  const cab = ["CNPJ", "Razao Social", "Nome Fantasia", "Segmento", "Municipio", "UF",
    "Situacao", "Perfil Google", "Detalhe", "Nome no Google", "Categoria Google",
    "Tem Site", "Site", "Endereco Google",
    "Avaliacao", "Total Avaliacoes", "Link Maps", "Erro"];

  const linhas = dados.map((d) => [
    d.cnpj, d.razao_social, d.nome_fantasia, d.segmento, d.municipio, d.uf,
    d.situacao, d.perfil_google, d.detalhe_google, d.nome_google, d.categoria_google,
    d.tem_site ? "Sim" : "Nao", d.site, d.endereco_google,
    d.avaliacao, d.total_avaliacoes, d.link_maps, d.erro,
  ].map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(";"));

  const csv = "\uFEFF" + cab.join(";") + "\n" + linhas.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nomeArquivo;
  a.click();
  URL.revokeObjectURL(a.href);
}

// exporta tudo (respeitando o filtro "só sem site" se estiver marcado)
$("btnExportar").onclick = () => {
  if (!resultados.length) return alert("Nada para exportar ainda.");
  const dados = $("soSemSite").checked ? resultados.filter(semSite) : resultados;
  exportarCSV(dados, "resultado_cnpjs.csv");
};

// exporta apenas os perfis COM perfil no Google e SEM site
$("btnExportarSemSite").onclick = () => {
  if (!resultados.length) return alert("Nada para exportar ainda.");
  const dados = resultados.filter(semSite);
  if (!dados.length) return alert("Nenhum perfil sem site encontrado para exportar.");
  exportarCSV(dados, "cnpjs_sem_site.csv");
};

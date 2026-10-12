// Fluxo do jogo: caso -> observar sinais -> agir (tempo da cena por acao) -> conversar ->
// encaminhar e registrar -> resultado com o check list do Anexo 1 do POP.
import * as CENA from './cena.js';
import { CASOS, ACOES, PAPEIS, PAPEIS_CENA, ENCAMINHAMENTOS, REGISTRO, FONTES } from './casos.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const espera = ms => new Promise(r => setTimeout(r, ms));
const embaralhar = l => { const a = l.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const lerLocal = (k, pad) => { try { return JSON.parse(localStorage.getItem(k)) ?? pad; } catch (e) { return pad; } };
const gravarLocal = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sem armazenamento */ } };

const C = CENA.criarCena($('#tela'));
const J = { progresso: lerLocal('acolher.progresso', {}), fase: 'mapa', caso: null, R: null };
window.acolher = { J, C };

// Sem cronometro: cada acao leva um tempo da cena (segundos simulados) e so nesse tempo a tensao
// muda conforme o ambiente. Quem precisa ser acionado leva mais 30 s para chegar.
const DURACAO = { conduta: 30, ambiente: 30, comunicacao: 30, equipe: 45, armadilha: 20 };
const CHEGADA = 30, FALA = 20, SEG_POR_PASSO = 8, TEMPO_LIMITE = 600;
const TEXTO_MEDICO = {
  espera: 'Dr. Paulo avalia: dor lombar forte. Vai medicar e priorizar a consulta.',
  sensorial: 'Dr. Paulo avalia: sem lesão. A consulta segue quando Lucas estiver regulado.',
  surda: 'Dr. Paulo avalia: sem causa clínica aguda.',
  acompanhante: 'Dr. Paulo avalia: sem causa clínica aguda.',
  suicidio: 'Dr. Paulo avalia os cortes e confirma risco de dano a si. Indica SAMU 192.',
  cego: 'Dr. Paulo avalia: sem lesão da queda.',
};

// ================================================================================================ telas
function telaMapa() {
  J.fase = 'mapa'; J.caso = null; J.R = null;
  $('#hud-tensao').hidden = true; $('#hud-tempo').hidden = true;
  $('#hud-titulo').textContent = 'Acolher com Segurança'; $('#hud-local').textContent = 'AME · manejo de comportamento agitado';
  limparSobre();
  const total = Object.values(J.progresso).reduce((a, p) => a + (p.pontos || 0), 0);
  const feitos = Object.keys(J.progresso).length;
  abrirModal(`<div class="capa"><span class="selo">NSP · SEGURANÇA DO PACIENTE</span>
    <h1>Acolher com Segurança</h1>
    <p class="sub">Comportamento agitado ou ameaçador no AME</p></div>
    <p>Situações de sala de espera. Você observa, decide o que fazer, quem da equipe faz e o que dizer. Sem cronômetro: cada ação leva um tempo da cena, e a tensão muda conforme o ambiente.</p>
    <h3>Casos</h3>
    <p class="sub">${feitos} de ${CASOS.length} feitos · ${total} pontos</p>
    <ol class="casos">${CASOS.map((c, i) => {
      const p = J.progresso[c.id];
      return `<li><button data-c="${c.id}"><span class="n">${i + 1}</span><div><b>${esc(c.titulo)}</b><small>${esc(c.local)}</small></div>
        <span class="est">${p ? '★'.repeat(p.estrelas) + '☆'.repeat(3 - p.estrelas) + `<small>${p.pontos} pts</small>` : '<small>novo</small>'}</span></button></li>`;
    }).join('')}</ol>
    <div class="acoes"><button class="btn" data-a="fontes">Base do jogo</button></div>`);
  document.querySelectorAll('[data-c]').forEach(b => b.onclick = () => iniciarCaso(b.dataset.c));
  $('[data-a="fontes"]').onclick = telaFontes;
  bandejaVazia();
}

function telaFontes() {
  abrirModal(`<h2>Base do jogo</h2>
    <p>As regras vêm do POP do NSP. O que o POP não detalha (técnicas de conversa, acessibilidade, suicídio) veio das fontes abaixo e precisa ser validado pelo NSP e pela psicologia.</p>
    <ul class="fontes">${FONTES.map(f => `<li>${f.url ? `<a href="${f.url}" target="_blank" rel="noopener">${esc(f.nome)}</a>` : esc(f.nome)}</li>`).join('')}</ul>
    <h3>Contatos do POP</h3>
    <p>SAMU 192 · Bombeiros 193 · Polícia Militar 190 · CAPS Rio Claro (19) 3522-1421 · Conselho Tutelar (19) 3532-5221</p>
    <div class="acoes"><button class="btn primario" data-a="voltar">Voltar</button></div>`);
  $('[data-a="voltar"]').onclick = telaMapa;
}

function iniciarCaso(id) {
  const caso = CASOS.find(c => c.id === id);
  J.caso = caso;
  CENA.montarCaso(C, caso);
  J.R = {
    t: 0, acc: 0, tensao: caso.tensao, crise: false, estavel: null, fim: false,
    flags: { ruido: caso.cenario.tv, luz: caso.cenario.luz, bip: caso.cenario.bip, publico: caso.cenario.publico > 0 },
    presentes: new Set(caso.presentes), chamadas: [], feitos: [], armadilhas: [], ocupado: new Set(),
    sinais: {}, dialogo: { turno: 0, escolhas: [], opcoes: null, ultimo: null }, enc: [], registro: [], nsp: false, posEvento: false,
  };
  CENA.tensaoVisual(C, caso.tensao);
  $('#hud-titulo').textContent = caso.titulo; $('#hud-local').textContent = caso.local;
  $('#hud-tensao-nome').textContent = 'Tensão · ' + caso.pessoa.nome;
  $('#hud-tensao').hidden = false; $('#hud-tempo').hidden = true;
  atualizarHud();
  J.fase = 'intro';
  abrirModal(`<span class="selo">${esc(caso.local)}</span><h2>${esc(caso.titulo)}</h2><p>${esc(caso.resumo)}</p>
    <div class="nota">Primeiro, <b>observe</b>. Classifique o que você vê antes de agir.</div>
    <div class="acoes"><button class="btn" data-a="mapa">Voltar</button><button class="btn primario" data-a="ir">Observar a cena</button></div>`);
  $('[data-a="mapa"]').onclick = telaMapa;
  $('[data-a="ir"]').onclick = () => { fecharModal(); faseObservar(); };
}

// ================================================================================================ fase 1: observar
function alvoSinal(s, i) {
  if (s.alvo === 'acomp' && C.acomp) return C.acomp;
  if (s.alvo === 'publico') return C.publico[i % Math.max(1, C.publico.length)] || C.principal;
  return C.principal;
}
function faseObservar() {
  J.fase = 'observar';
  const caso = J.caso, R = J.R;
  limparSobre();
  // marcadores numerados na cena
  const porAlvo = new Map();
  caso.sinais.forEach((s, i) => {
    const alvo = alvoSinal(s, i);
    const n = porAlvo.get(alvo) || 0; porAlvo.set(alvo, n + 1);
    // marcadores do mesmo personagem lado a lado; os do acompanhante descem um pouco para nao encavalar
    const desloc = s.alvo === 'acomp' ? 34 : 0;
    sobre({ alvo, html: `<span class="marca-n">${i + 1}</span>`, cls: 'marca', dx: n * 30 - 20 + desloc, dy: -6 + desloc, id: 'sinal' + i, clique: () => destacar(i) });
  });
  const linhas = caso.sinais.map((s, i) => `<li data-i="${i}"><span class="marca-n">${i + 1}</span><p>${esc(s.txt)}</p>
      <div class="tri">${['risco', 'pista', 'esperado'].map(t => `<button data-t="${t}" class="${R.sinais[i] === t ? 'sel ' + t : ''}">${{ risco: 'Risco', pista: 'Pista', esperado: 'Esperado' }[t]}</button>`).join('')}</div></li>`).join('');
  $('#bandeja').innerHTML = `<div class="band-topo"><b>Observe e classifique</b><small><span class="tag risco">Risco</span> aciona o protocolo · <span class="tag pista">Pista</span> explica a causa · <span class="tag esperado">Esperado</span> não é risco</small></div>
    <ol class="sinais">${linhas}</ol>
    <button class="btn primario largo" id="b-confirmar" disabled>Confirmar e agir</button>`;
  document.querySelectorAll('.sinais li').forEach(li => li.querySelectorAll('[data-t]').forEach(b => b.onclick = () => {
    const i = +li.dataset.i; R.sinais[i] = b.dataset.t;
    li.querySelectorAll('[data-t]').forEach(x => x.className = x.dataset.t === R.sinais[i] ? 'sel ' + x.dataset.t : '');
    $('#b-confirmar').disabled = Object.keys(R.sinais).length < caso.sinais.length;
  }));
  $('#b-confirmar').onclick = () => {
    const certos = caso.sinais.filter((s, i) => R.sinais[i] === s.tipo).length;
    abrirModal(`<h2>Sinais: ${certos} de ${caso.sinais.length}</h2>
      <ul class="feedback">${caso.sinais.map((s, i) => `<li class="${R.sinais[i] === s.tipo ? 'ok' : 'ruim'}"><b>${esc(s.txt)}</b>
        <span>${R.sinais[i] === s.tipo ? '✓' : '✗ você marcou ' + rotuloTipo(R.sinais[i]) + ' ·'} é <b>${rotuloTipo(s.tipo)}</b>. ${esc(s.exp)}</span></li>`).join('')}</ul>
      <div class="nota">A tensão de ${esc(caso.pessoa.nome)} sobe com o tempo e com os estímulos ao redor. Escolha as ações e <b>quem faz</b> cada uma.</div>
      <div class="acoes"><button class="btn primario" data-a="agir">Agir agora</button></div>`);
    $('[data-a="agir"]').onclick = () => { fecharModal(); faseAgir(); };
  };
}
const rotuloTipo = t => ({ risco: 'risco', pista: 'pista', esperado: 'esperado' }[t] || '—');
function destacar(i) {
  const li = document.querySelector(`.sinais li[data-i="${i}"]`);
  if (!li) return;
  li.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  li.classList.add('pisca'); setTimeout(() => li.classList.remove('pisca'), 900);
}

// ================================================================================================ fase 2: agir
function faseAgir() {
  J.fase = 'agir';
  limparSobre();
  $('#hud-tempo').hidden = false;
  J.aba = 'acoes'; J.retorno = null; J.detalhe = null;
  renderBandeja();
  toast(`${J.caso.pessoa.nome} está agitado. Toque numa ação e escolha quem faz.`);
}

function presente(papel) { return J.R.presentes.has(papel); }
function feito(id) { return J.R.feitos.some(f => f.id === id); }
function dialogoLiberado() {
  const R = J.R, caso = J.caso;
  if (!R.flags.interlocutor) return false;
  if (caso.dialogoExige && !feito(caso.dialogoExige)) return false;
  return true;
}

function renderBandeja() {
  if (J.fase !== 'agir') return;
  const R = J.R, caso = J.caso;
  const libera = dialogoLiberado(), fim = R.dialogo.turno >= caso.dialogo.length;
  const abas = `<div class="abas"><button data-aba="acoes" class="${J.aba === 'acoes' ? 'ativa' : ''}">Ações</button>
    <button data-aba="conversa" class="${J.aba === 'conversa' ? 'ativa' : ''}">Conversa${libera && !fim ? ' <i class="ponto"></i>' : ''}</button></div>`;
  let corpo = '';
  if (J.aba === 'acoes') {
    const ret = J.retorno ? `<div class="retorno ${J.retorno.tipo}">${J.retorno.html}</div>` : '';
    if (J.detalhe) corpo = detalheAcao(J.detalhe);
    else corpo = ret + `<div class="cartas">${caso.acoes.map(id => {
      const a = ACOES[id], f = R.feitos.find(x => x.id === id), oc = R.ocupado.has(id);
      return `<button class="carta ${f ? (a.tipo === 'armadilha' ? 'feita ruim' : 'feita') : ''} ${oc ? 'ocupada' : ''}" data-id="${id}" ${f || oc ? 'disabled' : ''}>
        <span class="ic">${a.icone}</span><b>${esc(a.nome)}</b>${f ? `<small>${PAPEIS[f.papel].icone} ${esc(PAPEIS[f.papel].nome)}</small>` : oc ? '<small>a caminho…</small>' : ''}</button>`;
    }).join('')}</div>`;
  } else corpo = painelConversa();
  $('#bandeja').innerHTML = abas + `<div class="band-corpo">${corpo}</div>
    <button class="btn largo ${R.tensao <= 35 || R.crise ? 'primario' : ''}" id="b-fechar">Encaminhar e registrar →</button>`;
  document.querySelectorAll('[data-aba]').forEach(b => b.onclick = () => { J.aba = b.dataset.aba; J.detalhe = null; renderBandeja(); });
  document.querySelectorAll('.carta[data-id]').forEach(b => b.onclick = () => { J.detalhe = b.dataset.id; renderBandeja(); });
  ligarDetalhe(); ligarConversa();
  $('#b-fechar').onclick = pedirFechamento;
}

function detalheAcao(id) {
  const a = ACOES[id];
  return `<div class="detalhe"><div class="det-topo"><span class="ic">${a.icone}</span><div><b>${esc(a.nome)}</b><p>${esc(a.desc)}</p></div>
    <button class="fechar" data-a="voltar" aria-label="Voltar">✕</button></div>
    <p class="quem">Quem faz?</p>
    <div class="grade-quem">${PAPEIS_CENA.map(k => {
      const p = PAPEIS[k], aqui = presente(k);
      return `<button data-p="${k}" class="${aqui ? '' : 'ausente'}"><span>${p.icone}</span><b>${esc(p.nome)}</b><small>${aqui ? 'na sala' : '📣 acionar · +30 s'}</small></button>`;
    }).join('')}</div></div>`;
}
function ligarDetalhe() {
  const v = document.querySelector('.detalhe [data-a="voltar"]');
  if (v) v.onclick = () => { J.detalhe = null; renderBandeja(); };
  document.querySelectorAll('.grade-quem [data-p]').forEach(b => b.onclick = () => {
    const id = J.detalhe; J.detalhe = null;
    executar(id, b.dataset.p);
    renderBandeja();
  });
}

function papelCerto(id, papel) {
  const a = ACOES[id], caso = J.caso;
  if (a.tipo === 'armadilha') return true;
  if (id === 'interlocutor') return caso.interlocutor.includes(papel);
  return !a.papeis || a.papeis.includes(papel);
}

async function executar(id, papel) {
  const R = J.R, caso = J.caso, a = ACOES[id];
  if (R.ocupado.has(id) || feito(id)) return;
  R.ocupado.add(id);
  let chegada = 0;
  if (!presente(papel)) {
    R.presentes.add(papel); R.chamadas.push(papel); chegada = CHEGADA;
    toast(`📣 ${PAPEIS[papel].nome} acionada.`);
    await CENA.entrar(C, papel);
  }
  // reservado so funciona se a tensao ja baixou um pouco
  if (id === 'reservado' && R.tensao > 85) {
    R.ocupado.delete(id);
    balao(C.principal, 'Não vou sair daqui!');
    toast('Agora ele não aceita sair dali. Converse primeiro.', 'aviso');
    renderBandeja(); return;
  }
  await mover(id, papel);
  R.ocupado.delete(id);
  if (J.fase !== 'agir') return;
  const certo = papelCerto(id, papel);
  R.feitos.push({ id, papel, t: R.t, certo });
  if (a.fala) balao(C.equipe[papel], a.fala);
  const antes = R.tensao;
  aplicar(id, papel);
  const quem = `${PAPEIS[papel].icone} ${esc(PAPEIS[papel].nome)}`;
  if (a.tipo === 'armadilha') {
    R.armadilhas.push(id);
    flash();
    J.retorno = { tipo: 'ruim', html: `<b>✗ ${esc(a.nome)}</b> <small>${quem}</small><p>${esc(a.erro)}</p>` };
  } else if (!certo) {
    const dica = id === 'interlocutor' && caso.interlocutorErrado?.[papel] ? caso.interlocutorErrado[papel]
      : `Pelo POP, isso cabe a: ${(id === 'interlocutor' ? caso.interlocutor : a.papeis).map(p => PAPEIS[p].nome).join(' ou ')}.`;
    J.retorno = { tipo: 'aviso', html: `<b>⚠️ ${esc(a.nome)}: feito, mas fora do papel</b> <small>${quem}</small><p>${esc(dica)}</p>` };
  } else J.retorno = { tipo: 'ok', html: `<b>✓ ${esc(a.nome)}</b> <small>${quem}</small><p>${esc(a.ok)}</p>` };
  const seg = (DURACAO[a.tipo] || 30) + chegada;
  avancar(seg);
  const dif = Math.round(R.tensao - antes);
  J.retorno.html += `<small class="efeito">+${seg} s de cena · tensão ${dif > 0 ? '+' + dif : dif}</small>`;
  const F = R.flags;
  if (dif >= 10 && (F.ruido || F.luz || F.bip || F.publico) && a.tipo !== 'armadilha')
    J.retorno.html += `<small class="efeito">Enquanto isso o ambiente seguiu barulhento e cheio. Pelo POP, as condutas imediatas (reduzir estímulos, afastar o público, interlocutor único) vêm primeiro.</small>`;
  renderBandeja(); atualizarHud();
}

// passa o tempo da cena: a tensao anda um passo a cada 8 s simulados
function avancar(seg) {
  const R = J.R;
  for (let s = 0; s < Math.round(seg / SEG_POR_PASSO); s++) {
    const tinha = R.crise;
    passoTensao();
    R.t += SEG_POR_PASSO;
    if (!tinha && R.crise) break;
  }
  atualizarHud();
  if (R.t >= TEMPO_LIMITE && !R.fim && J.fase === 'agir') { R.fim = true; toast('⏱ Dez minutos de cena. Hora de encaminhar e registrar.', 'aviso', 6000); faseFechar(); }
}

// movimento da equipe na cena antes do efeito
async function mover(id, papel) {
  const e = C.equipe[papel];
  e.anim = 'parado';
  switch (id) {
    case 'reduzir': await e.irPara(0.6, -4.2, [0.6, -5]); break;
    case 'afastar': await e.irPara(0.5, 2.9, [0.5, 0]); break;
    case 'rota': await e.irPara(-5.8, 3.4, [-7, 3.4]); break;
    case 'chamarMae': if (C.acomp) await e.irPara(C.acomp.g.position.x + 0.7, C.acomp.g.position.z + 0.4, [C.acomp.g.position.x, C.acomp.g.position.z]); break;
    case 'cercar': CENA.cercar(C); for (const k of PAPEIS_CENA) J.R.presentes.add(k); await espera(1500); break;
    case 'reservado': await CENA.aproximar(C, papel, 1.3); break;
    default: await CENA.aproximar(C, papel, id === 'contencao' || id === 'tocar' || id === 'puxar' ? 0.6 : 1.4, (Object.keys(ACOES).indexOf(id) % 3 - 1) * 0.5);
  }
  e.anim = ['escrita'].includes(id) ? 'escrevendo' : 'falando';
}

// efeito de cada acao no estado e na cena
function aplicar(id, papel) {
  const R = J.R, caso = J.caso, F = R.flags, a = ACOES[id];
  R.tensao = clamp(R.tensao + (a.efeito || 0), 0, 100);
  switch (id) {
    case 'reduzir': F.ruido = F.luz = F.bip = false; CENA.setTV(C, false); CENA.setSom(C, false); CENA.setLuz(C, false); break;
    case 'afastar': F.publico = false; CENA.afastarPublico(C); break;
    case 'interlocutor':
      F.interlocutor = papel;
      if (caso.dialogoExige && !feito(caso.dialogoExige)) toast(`Para conversar com ${caso.pessoa.nome}, use antes a comunicação adaptada.`, 'aviso', 5200);
      else toast('💬 Conversa liberada: abra a aba Conversa.', 'ok');
      break;
    case 'distancia': F.distancia = true; break;
    case 'rota': F.rota = true; C.rota.visible = true; break;
    case 'objetos': F.objetos = true; CENA.sumirFolhetos(C); break;
    case 'reservado': F.reservado = true; F.publico = false; CENA.irReservado(C, papel); break;
    case 'acompanhante': F.acompanhante = true; if (C.acomp) { C.acomp.irPara(C.principal.g.position.x + 0.7, C.principal.g.position.z + 0.3, [C.principal.g.position.x, C.principal.g.position.z]); C.acomp.anim = 'falando'; } break;
    case 'chamarMae': F.mae = true; if (C.acomp) { C.acomp.irPara(6.4, 1.6); C.equipe[papel].irPara(6.0, 1.2); } break;
    case 'sinaisVitais':
      F.vitais = true;
      if (caso.clinica) toast('Glicemia capilar: 52 mg/dL. Suor frio e tremor.', 'aviso', 5200);
      if (caso.clinica && F.medico) resolverClinica();
      break;
    case 'causasClinicas':
      F.medico = true;
      if (caso.clinica) { if (F.vitais) resolverClinica(); else toast('Dr. Paulo pede a glicemia capilar para a enfermagem antes de concluir.', 'aviso', 5200); }
      else toast(TEXTO_MEDICO[caso.id] || 'Dr. Paulo avalia: sem causa clínica aguda.', '', 5200);
      break;
    case 'avaliarRisco': F.risco = true; if (caso.id === 'suicidio') toast('Carla: ela tem plano e acesso a remédios em casa. Risco alto.', 'aviso', 5200); break;
    case 'orientarFamilia': F.familia = true; break;
    case 'rede': F.rede = true; toast(caso.id === 'suicidio' ? 'Rose localizou a mãe de Bianca e vai comunicar o Conselho Tutelar, como prevê a lei.' : 'Rose acionou a família e a rede de apoio.', '', 5200); break;
    case 'naoSozinho': F.naoSozinho = true; break;
    case 'escrita': case 'guiar': case 'frasesCurtas':
      if (caso.adaptada === id) F.adaptada = true;
      if (F.interlocutor) toast('💬 Comunicação adaptada em uso: conversa liberada.', 'ok');
      break;
    case 'contencao': C.principal.intensidade = 1; break;
    case 'deixarSair': C.principal.irPara(-6.4, 3.5); R.tensao = 100; break;
    case 'ignorar': F.ruido = true; F.bip = true; CENA.setSom(C, true); CENA.setTV(C, true); break;
  }
  CENA.tensaoVisual(C, R.tensao);
}
function resolverClinica() {
  const R = J.R;
  if (R.flags.clinicaOk) return;
  R.flags.clinicaOk = true;
  R.tensao = clamp(R.tensao - 20, 0, 100);
  toast('Dr. Paulo: hipoglicemia. Correção conforme protocolo clínico. Seu Jorge melhora aos poucos.', 'ok', 6000);
}

// tensao: estimulos sobem, ajustes descem. Roda 1x por segundo de jogo.
function passoTensao() {
  const R = J.R, caso = J.caso, F = R.flags, d = caso.deriva;
  let v = d.base;
  if (F.ruido) v += d.ruido ?? 0.6;
  if (F.luz) v += d.luz ?? 0.3;
  if (F.bip) v += d.bip ?? 0.4;
  if (F.publico) v += (d.publico ?? 0.06) * C.publico.length;
  if (caso.adaptada && !F.adaptada) v += d.semAdaptada ?? 0.8;
  if (caso.clinica && F.clinicaOk) v -= 1.2;
  if (F.reservado) v -= 0.9;
  if (F.interlocutor) v -= 0.35;
  if (F.acompanhante) v -= 0.3;
  if (F.distancia) v -= 0.25;
  if (F.naoSozinho) v -= 0.3;
  if (F.mae) v -= 0.5;
  if (F.adaptada) v -= 0.3;
  if (R.armadilhas.includes('cercar')) v += 0.6;
  R.tensao = clamp(R.tensao + v, 0, 100);
  if (R.tensao >= 100 && !R.crise) crise();
  if (R.tensao <= 30 && R.estavel == null) { R.estavel = R.t; toast(`🟢 ${caso.pessoa.nome} está mais calmo. Quando quiser, encaminhe e registre.`, 'ok', 5000); renderBandeja(); }
  CENA.tensaoVisual(C, R.tensao);
}

function crise() {
  const R = J.R, caso = J.caso;
  R.crise = true;
  R.tensao = 78;
  flash(true);
  C.principal.intensidade = 1;
  J.pausa = true;
  abrirModal(`<h2>⚠️ A situação escalou</h2><p>${esc(caso.crise.txt)}</p>
    <div class="nota">${esc(caso.crise.exp)}</div>
    <div class="acoes"><button class="btn primario" data-a="seguir">Continuar</button></div>`);
  $('[data-a="seguir"]').onclick = () => { J.pausa = false; fecharModal(); renderBandeja(); };
}

// ------------------------------------------------------------------------------------------------ conversa
function painelConversa() {
  const R = J.R, caso = J.caso, D = R.dialogo;
  if (!R.flags.interlocutor) return `<div class="vazio">Para conversar, primeiro <b>eleja um interlocutor único</b> na aba Ações.</div>`;
  if (caso.dialogoExige && !feito(caso.dialogoExige)) return `<div class="vazio">${esc(caso.pessoa.nome)} não está entendendo a equipe. Use a <b>comunicação adaptada</b> na aba Ações.</div>`;
  if (D.ultimo) {
    const o = D.ultimo;
    return `<div class="resp ${o.v}"><b>${{ bom: '✓ Boa escolha', neutro: '• Ajuda pouco', ruim: '✗ Piorou' }[o.v]}</b><p>${esc(o.exp)}</p></div>
      <button class="btn primario largo" data-a="seguir">${D.turno >= caso.dialogo.length ? 'Fim da conversa' : 'Continuar'}</button>`;
  }
  if (D.turno >= caso.dialogo.length) return `<div class="vazio">Conversa concluída. Veja se falta alguma ação e depois encaminhe.</div>`;
  const T = caso.dialogo[D.turno];
  if (!D.opcoes) D.opcoes = embaralhar(T.opcoes);
  const quem = T.quem === 'acomp' ? caso.acompanhante?.nome : caso.pessoa.nome;
  return `<div class="fala"><small>${esc(quem)}</small><p>“${esc(T.fala)}”</p></div>
    <p class="quem">Você responde (${esc(PAPEIS[R.flags.interlocutor].nome)}):</p>
    <div class="opcoes">${D.opcoes.map((o, i) => `<button data-o="${i}">${esc(o.t.replace('{quem}', PAPEIS[R.flags.interlocutor].quem))}</button>`).join('')}</div>`;
}
function ligarConversa() {
  const R = J.R;
  if (!R) return;
  const D = R.dialogo;
  document.querySelectorAll('[data-o]').forEach(b => b.onclick = () => {
    const o = D.opcoes[+b.dataset.o], T = J.caso.dialogo[D.turno];
    D.escolhas.push(o.v); D.ultimo = o; D.turno++; D.opcoes = null;
    R.tensao = clamp(R.tensao + o.d, 0, 100);
    avancar(FALA);
    CENA.tensaoVisual(C, R.tensao);
    const falante = C.equipe[R.flags.interlocutor];
    balao(falante, o.t.replace('{quem}', PAPEIS[R.flags.interlocutor].quem).slice(0, 90) + (o.t.length > 90 ? '…' : ''));
    if (o.v === 'ruim') flash(); else if (o.v === 'bom') C.principal.intensidade = Math.max(0, C.principal.intensidade - 0.2);
    void T;
    renderBandeja(); atualizarHud();
  });
  const s = document.querySelector('.band-corpo [data-a="seguir"]');
  if (s) s.onclick = () => {
    D.ultimo = null;
    if (D.turno < J.caso.dialogo.length) {
      const T = J.caso.dialogo[D.turno];
      balao(T.quem === 'acomp' && C.acomp ? C.acomp : C.principal, T.fala.slice(0, 80) + (T.fala.length > 80 ? '…' : ''), 4000);
    }
    renderBandeja();
  };
}

// ================================================================================================ fase 3: encaminhar e registrar
async function pedirFechamento() {
  const R = J.R;
  if (R.tensao > 60 && !R.crise) {
    const ok = await perguntar('Ainda muito tenso', `<p>A tensão de ${esc(J.caso.pessoa.nome)} ainda está alta. Encaminhar agora?</p>`, [['nao', 'Continuar agindo', 'primario'], ['sim', 'Encaminhar assim mesmo']]);
    if (ok !== 'sim') return;
  }
  faseFechar();
}
function faseFechar() {
  J.fase = 'fechar';
  const R = J.R;
  bandejaVazia('Encaminhamento e registro');
  abrirModal(`<h2>Encaminhamento</h2><p class="sub">O que acontece com ${esc(J.caso.pessoa.nome)} agora? Marque tudo o que se aplica.</p>
    <div class="chips">${Object.entries(ENCAMINHAMENTOS).map(([k, e]) => `<button data-e="${k}"><span>${e.icone}</span>${esc(e.nome)}</button>`).join('')}</div>
    <div class="acoes"><button class="btn primario" data-a="ok" disabled>Confirmar</button></div>`);
  document.querySelectorAll('[data-e]').forEach(b => b.onclick = () => {
    const k = b.dataset.e, i = R.enc.indexOf(k);
    if (i >= 0) R.enc.splice(i, 1); else R.enc.push(k);
    b.classList.toggle('sel', R.enc.includes(k));
    $('[data-a="ok"]').disabled = !R.enc.length;
  });
  $('[data-a="ok"]').onclick = telaRegistro;
}
function telaRegistro() {
  const R = J.R;
  const itens = embaralhar(REGISTRO);
  abrirModal(`<h2>Registro no prontuário</h2><p class="sub">O que vai no registro? (POP, Comunicação e registro)</p>
    <div class="checks">${itens.map(r => `<label><input type="checkbox" data-r="${r.id}"> ${esc(r.txt)}</label>`).join('')}</div>
    <h3>Depois do atendimento</h3>
    <div class="checks"><label><input type="checkbox" id="c-nsp"> Notificar o NSP</label>
    <label><input type="checkbox" id="c-pos"> Marcar reunião da equipe para revisar o atendimento</label></div>
    <div class="acoes"><button class="btn primario" data-a="ok">Ver resultado</button></div>`);
  $('[data-a="ok"]').onclick = () => {
    R.registro = [...document.querySelectorAll('[data-r]:checked')].map(i => i.dataset.r);
    R.nsp = $('#c-nsp').checked; R.posEvento = $('#c-pos').checked;
    resultado();
  };
}

// ================================================================================================ avaliacao
function avaliar() {
  const R = J.R, caso = J.caso, F = R.flags;
  const sinaisCertos = caso.sinais.filter((s, i) => R.sinais[i] === s.tipo).length;
  const sinais = sinaisCertos / caso.sinais.length * 100;
  const exige = new Set([...caso.encaminhamento.certo, ...(R.crise ? caso.crise.exige : [])]);
  if (caso.clinica && !F.clinicaOk) { exige.delete('ame'); exige.add('samu'); }
  const permitido = new Set([...exige, ...caso.encaminhamento.opcional]);
  if (R.crise) { permitido.add('samu'); permitido.add('ame'); }
  const faltou = [...exige].filter(e => !R.enc.includes(e));
  const sobrou = R.enc.filter(e => !permitido.has(e));
  const E = caso.essenciais;
  const fez = k => k === 'chamar_enfermagem' ? (R.chamadas.includes('enfermagem') || caso.presentes.includes('enfermagem')) : feito(k);

  let seg = 100;
  if (R.crise) seg -= 35;
  for (const id of R.armadilhas) seg -= ACOES[id].seg || 0;
  if (faltou.includes('samu') || faltou.includes('pm')) seg -= 25;
  if (E.afastar && !fez('afastar')) seg -= 10;
  if (E.rota && !fez('rota')) seg -= 10;
  if (E.naoSozinho && !fez('naoSozinho')) seg -= 25;

  let acolhe = 45;
  const D = R.dialogo.escolhas;
  for (const v of D) acolhe += v === 'bom' ? 15 : v === 'ruim' ? -15 : 0;
  acolhe -= (caso.dialogo.length - D.length) * 8;
  if (caso.adaptada) acolhe += F.adaptada ? 15 : -20;
  if (F.reservado) acolhe += 8;
  for (const id of R.armadilhas) acolhe -= ACOES[id].acolhe || 0;
  const regErrados = R.registro.filter(id => !REGISTRO.find(r => r.id === id).certo);
  acolhe -= regErrados.filter(id => id !== 'testemunhas').length * 10;
  acolhe -= sobrou.filter(e => ['pm', 'ct', 'caps'].includes(e)).length * 8;

  const totalE = Object.values(E).reduce((a, b) => a + b, 0);
  const feitoE = Object.entries(E).reduce((a, [k, v]) => a + (fez(k) ? v : 0), 0);
  let prot = feitoE / totalE * 60;
  const comPapel = R.feitos.filter(f => ACOES[f.id].tipo !== 'armadilha' && (ACOES[f.id].papeis || f.id === 'interlocutor'));
  prot += (comPapel.length ? comPapel.filter(f => f.certo).length / comPapel.length : 0) * 12;
  const ordem = ['reduzir', 'afastar', 'interlocutor'].filter(k => caso.acoes.includes(k));
  const idx = ordem.map(k => R.feitos.findIndex(f => f.id === k));
  if (idx.every(i => i >= 0 && i < ordem.length + 2)) prot += 5;
  const regCertos = R.registro.filter(id => REGISTRO.find(r => r.id === id).certo).length;
  prot += Math.max(0, regCertos / 4 * 10 - regErrados.length * 3);
  if (R.nsp) prot += 5;
  if (R.posEvento) prot += 4;
  if (!faltou.length && !sobrou.length) prot += 4;

  const agil = R.estavel != null ? clamp(100 - Math.max(0, R.estavel - 200) * 0.25, 20, 100) : 15;
  const n = { sinais: clamp(sinais, 0, 100), seg: clamp(seg, 0, 100), acolhe: clamp(acolhe, 0, 100), prot: clamp(prot, 0, 100), agil: clamp(agil, 0, 100) };
  const pontos = Math.round((n.sinais * 0.15 + n.seg * 0.3 + n.acolhe * 0.25 + n.prot * 0.2 + n.agil * 0.1) * 10);
  const estrelas = pontos >= 800 ? 3 : pontos >= 600 ? 2 : pontos >= 400 ? 1 : 0;

  const precisaSamu = exige.has('samu');
  const riscos = caso.sinais.map((s, i) => [s, i]).filter(([s]) => s.tipo === 'risco');
  const anexo = [
    ['Identificou sinais', riscos.every(([, i]) => R.sinais[i] === 'risco')],
    ['Reduziu estímulos', fez('reduzir') || !caso.acoes.includes('reduzir')],
    ['Acionou equipe', R.chamadas.length > 0],
    [`Acionou SAMU se necessário · ${precisaSamu ? 'neste caso era' : 'neste caso não era'}`, precisaSamu ? R.enc.includes('samu') : !R.enc.includes('samu')],
    ['Registrou em prontuário', regCertos === 4 && !regErrados.length],
    ['Notificou NSP', R.nsp],
    ['Encaminhou o paciente', !faltou.length && !sobrou.length],
  ];
  return { n, pontos, estrelas, faltou, sobrou, anexo, regErrados };
}

function resultado() {
  J.fase = 'resultado';
  const R = J.R, caso = J.caso, A = avaliar();
  const ant = J.progresso[caso.id];
  if (!ant || A.pontos > ant.pontos) { J.progresso[caso.id] = { pontos: A.pontos, estrelas: A.estrelas }; gravarLocal('acolher.progresso', J.progresso); }
  const barra = (k, v) => `<li><span>${k}</span><i style="width:${v}%" class="${v >= 75 ? 'boa' : v >= 50 ? 'media' : 'ruim'}"></i><b>${Math.round(v)}</b></li>`;
  const encTxt = R.enc.map(e => ENCAMINHAMENTOS[e].nome).join(', ') || '—';
  const proxima = CASOS[CASOS.findIndex(c => c.id === caso.id) + 1];
  const papeisCaso = new Set();
  for (const k of Object.keys(caso.essenciais)) {
    if (k === 'chamar_enfermagem') { papeisCaso.add('recepcao'); papeisCaso.add('enfermagem'); }
    else if (k === 'interlocutor') papeisCaso.add(caso.interlocutor[0]);
    else for (const p of ACOES[k]?.papeis || []) papeisCaso.add(p);
  }
  abrirModal(`<div class="capa"><div class="estrelas">${'★'.repeat(A.estrelas)}${'☆'.repeat(3 - A.estrelas)}</div>
    <h2>${esc(caso.titulo)}</h2><p class="pontos">${A.pontos} pontos${ant && ant.pontos >= A.pontos ? ` <small>(recorde ${ant.pontos})</small>` : ''}</p></div>
    <ul class="notas">${barra('Sinais', A.n.sinais)}${barra('Segurança', A.n.seg)}${barra('Acolhimento', A.n.acolhe)}${barra('Protocolo', A.n.prot)}${barra('Agilidade', A.n.agil)}</ul>
    <h3>Check list rápido (Anexo 1 do POP)</h3>
    <ul class="anexo">${A.anexo.map(([t, ok]) => `<li class="${ok ? 'ok' : 'ruim'}">${ok ? '☑' : '☐'} ${esc(t)}</li>`).join('')}</ul>
    <h3>O que você fez</h3>
    <ul class="feitos">${R.feitos.map(x => `<li class="${ACOES[x.id].tipo === 'armadilha' ? 'ruim' : x.certo ? 'ok' : 'aviso'}">${ACOES[x.id].icone} ${esc(ACOES[x.id].nome)} <small>${PAPEIS[x.papel].icone} ${esc(PAPEIS[x.papel].nome)}</small></li>`).join('') || '<li>Nenhuma ação.</li>'}</ul>
    <p class="sub">Encaminhamento: ${esc(encTxt)}${A.faltou.length ? ` · faltou: <b>${A.faltou.map(e => esc(ENCAMINHAMENTOS[e].nome)).join(', ')}</b>` : ''}${A.sobrou.length ? ` · sem necessidade: <b>${A.sobrou.map(e => esc(ENCAMINHAMENTOS[e].nome)).join(', ')}</b>` : ''}</p>
    ${A.regErrados.length ? `<p class="sub">No registro: ${A.regErrados.map(id => esc(REGISTRO.find(r => r.id === id).porque)).join(' ')}</p>` : ''}
    <h3>Para levar</h3>
    <ul class="aprendi">${caso.aprendizado.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
    <h3>Quem faz o quê neste caso (POP)</h3>
    <ul class="resp-pop">${[...papeisCaso].map(k => `<li><b>${PAPEIS[k].icone} ${esc(PAPEIS[k].nome)}</b> ${esc(PAPEIS[k].pop)}</li>`).join('')}</ul>
    <div class="acoes"><button class="btn" data-a="mapa">Casos</button><button class="btn" data-a="repetir">Jogar de novo</button>${proxima ? '<button class="btn primario" data-a="prox">Próximo caso</button>' : ''}</div>`);
  $('[data-a="mapa"]').onclick = telaMapa;
  $('[data-a="repetir"]').onclick = () => iniciarCaso(caso.id);
  if (proxima) $('[data-a="prox"]').onclick = () => iniciarCaso(proxima.id);
}

// ================================================================================================ interface
function atualizarHud() {
  const R = J.R;
  if (!R) return;
  const v = Math.round(R.tensao);
  const b = $('#hud-tensao-barra');
  b.style.width = v + '%';
  b.style.background = `hsl(${(1 - v / 100) * 120}, 70%, 45%)`;
  const s = Math.floor(R.t), m = Math.floor(s / 60);
  $('#hud-tempo b').textContent = `${m}:${String(s % 60).padStart(2, '0')}`;
  $('#hud-tempo').classList.toggle('alerta', s > TEMPO_LIMITE - 120);
}
function bandejaVazia(txt) {
  $('#bandeja').innerHTML = `<div class="vazio">${esc(txt || 'Escolha um caso para começar.')}</div>`;
}

// baloes e marcadores presos a personagens
const SOBRE = [];
function sobre({ alvo, html, cls, dx = 0, dy = 0, ms, clique, id }) {
  const el = document.createElement('div');
  el.className = 'sobre ' + (cls || ''); el.innerHTML = html;
  if (clique) el.onclick = clique;
  $('#sobre').appendChild(el);
  const item = { alvo, el, dx, dy, id };
  SOBRE.push(item);
  if (ms) setTimeout(() => removerSobre(item), ms);
  return item;
}
function removerSobre(item) { const i = SOBRE.indexOf(item); if (i >= 0) SOBRE.splice(i, 1); item.el.remove(); }
function limparSobre() { for (const s of SOBRE.slice()) removerSobre(s); }
function balao(pessoa, texto, ms = 2800) {
  for (const s of SOBRE.slice()) if (s.alvo === pessoa && s.el.classList.contains('balao')) removerSobre(s);
  sobre({ alvo: pessoa, html: esc(texto), cls: 'balao', ms, dy: -8 });
}
function posicionarSobre() {
  for (const s of SOBRE) {
    if (!s.alvo || !s.alvo.g.visible) { s.el.style.display = 'none'; continue; }
    const p = CENA.naTela(C, s.alvo.ancora);
    s.el.style.display = '';
    s.el.style.transform = `translate(${Math.round(p.x + s.dx)}px, ${Math.round(p.y + s.dy)}px) translate(-50%, -100%)`;
  }
}

function toast(html, tipo = '', ms = 4200) {
  const el = document.createElement('div');
  el.className = 'toast ' + tipo; el.innerHTML = html;
  $('#toasts').appendChild(el);
  while ($('#toasts').children.length > 3) $('#toasts').firstChild.remove();
  setTimeout(() => { el.classList.add('saindo'); setTimeout(() => el.remove(), 350); }, ms);
}
function flash(forte) {
  const f = $('#flash');
  f.classList.remove('ativo', 'forte'); void f.offsetWidth;
  f.classList.add('ativo'); if (forte) f.classList.add('forte');
}
function abrirModal(html) { const m = $('#modal'), c = $('#modal-conteudo'); c.innerHTML = html; m.classList.remove('oculto'); c.scrollTop = 0; }
function fecharModal() { $('#modal').classList.add('oculto'); }
function perguntar(titulo, html, botoes) {
  return new Promise(res => {
    J.pausa = true;
    abrirModal(`<h2>${titulo}</h2>${html}<div class="acoes">${botoes.map(([v, r, cl]) => `<button class="btn ${cl || ''}" data-v="${v}">${r}</button>`).join('')}</div>`);
    document.querySelectorAll('#modal-conteudo [data-v]').forEach(b => b.onclick = () => { J.pausa = false; fecharModal(); res(b.dataset.v); });
  });
}
function ajuda() {
  const pausaAntes = J.pausa; J.pausa = true;
  abrirModal(`<h2>Como jogar</h2>
    <ol class="passos">
      <li><b>Observe.</b> Classifique cada sinal: <span class="tag risco">Risco</span> aciona o protocolo, <span class="tag pista">Pista</span> explica a causa, <span class="tag esperado">Esperado</span> não é risco.</li>
      <li><b>Aja.</b> Não há cronômetro. Cada ação leva um tempo da cena (30 s a 1 min; quem precisa ser acionado leva mais 30 s), e nesse tempo a tensão sobe com barulho, luz forte e público perto, ou desce com os ajustes certos. Toque numa ação e escolha <b>quem faz</b>, conforme as responsabilidades do POP.</li>
      <li><b>Converse.</b> Depois de eleger um interlocutor único, escolha o que dizer na aba Conversa.</li>
      <li><b>Encaminhe e registre.</b> SAMU, PS, CAPS, Conselho Tutelar ou seguir no AME; registro no prontuário e notificação ao NSP.</li>
    </ol>
    <p class="sub">Algumas ações parecem resolver, mas vão contra o POP. O AME não faz sedação nem contenção física para agitação.</p>
    <div class="acoes"><button class="btn primario" data-a="ok">Entendi</button></div>`);
  $('[data-a="ok"]').onclick = () => { J.pausa = pausaAntes; fecharModal(); };
}

// ================================================================================================ laco
let anterior = performance.now(), relogio = 0;
function laco(agora) {
  // dt limitado a 0,25 s: em aparelho lento (ou aba em segundo plano) a equipe anda aos saltos, mas chega
  const dt = Math.min(0.25, (agora - anterior) / 1000); anterior = agora; relogio += dt;
  CENA.quadro(C, dt, relogio);
  posicionarSobre();
  requestAnimationFrame(laco);
}

$('#b-mapa').onclick = () => { if (J.fase === 'agir') perguntar('Sair do caso?', '<p>O progresso deste caso será perdido.</p>', [['nao', 'Continuar', 'primario'], ['sim', 'Sair']]).then(r => { if (r === 'sim') telaMapa(); }); else telaMapa(); };
$('#b-ajuda').onclick = ajuda;
new ResizeObserver(() => C.redimensionar()).observe($('#palco'));
C.redimensionar();
CENA.montarCaso(C, CASOS[0]);
CENA.tensaoVisual(C, CASOS[0].tensao);
requestAnimationFrame(laco);
telaMapa();

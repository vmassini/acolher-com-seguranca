// Grava (ou só valida) a demonstração narrada num Chrome headless, sem dependências.
//
//   node ferramentas/gravar-demo.mjs validar http://localhost:8140 espera surda ...
//   node ferramentas/gravar-demo.mjs gravar  http://localhost:8140 espera <pasta-dos-quadros> [fps] [vel]
//
//   node ferramentas/gravar-demo.mjs roteiro http://localhost:8140 espera [vel]
//
// "validar" roda a demonstração de cada caso em 4× e imprime pontos e o que faltou.
// "roteiro" imprime em JSON cada texto do narrador e cada toque, com o tempo (o "gravar" também salva roteiro.json).
// "gravar" tira quadros JPEG em intervalos fixos de tempo real e escreve quadros.ffconcat; para juntar:
//   ffmpeg -f concat -i <pasta>/quadros.ffconcat -vf "setpts=PTS/3,fps=30" -c:v libx264 -pix_fmt yuv420p video.mp4
// (setpts=PTS/3 deixa o vídeo 3× mais rápido que a demonstração)
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const [modo, base, ...resto] = process.argv.slice(2);
const PORTA = 9300 + Math.floor(Math.random() * 500);
const W = 1280, H = 720;
const dormir = ms => new Promise(r => setTimeout(r, ms));

const perfil = join(tmpdir(), 'acolher-chrome-' + PORTA);
const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORTA}`, `--user-data-dir=${perfil}`, `--window-size=${W},${H}`,
  '--hide-scrollbars', '--mute-audio', '--no-first-run', '--disable-background-timer-throttling',
  '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--enable-unsafe-swiftshader', 'about:blank',
], { stdio: 'ignore' });

async function conectar() {
  for (let i = 0; i < 50; i++) {
    try {
      const lista = await (await fetch(`http://127.0.0.1:${PORTA}/json/list`)).json();
      const pag = lista.find(t => t.type === 'page');
      if (pag) return pag.webSocketDebuggerUrl;
    } catch (e) { /* ainda subindo */ }
    await dormir(200);
  }
  throw new Error('Chrome não respondeu');
}
const url = await conectar();
const ws = new WebSocket(url);
await new Promise(r => ws.addEventListener('open', r));
let seq = 0;
const pend = new Map();
ws.addEventListener('message', ev => {
  const m = JSON.parse(ev.data);
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
});
const cdp = (method, params = {}) => new Promise(r => { const id = ++seq; pend.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
const avaliar = async expr => (await cdp('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value;

await cdp('Page.enable');
await cdp('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });

async function abrir(caso, vel) {
  // localStorage limpo a cada caso: sem dicas vistas nem recordes anteriores
  await cdp('Page.navigate', { url: `${base}/?demo=${caso}&vel=${vel}` });
  for (let i = 0; i < 100 && !(await avaliar('!!(window.acolher && acolher.J)')); i++) await dormir(200);
}
const resultado = () => avaliar(`({ fim: acolher.J.demoFim, fase: acolher.J.fase,
  pontos: (document.querySelector('#modal-conteudo').innerText.match(/(\\d+) pontos/) || [])[1],
  faltou: [...document.querySelectorAll('.faltou li b')].map(b => b.innerText),
  notas: [...document.querySelectorAll('.notas li')].map(li => li.querySelector('span').innerText + ' ' + li.querySelector('b').innerText).filter(t => !t.endsWith(' 100')),
  tempo: acolher.J.R?.estavel,
  passo: document.querySelector('.nar-passo')?.textContent })`);

// guarda em window.__rot cada texto novo do narrador e cada toque (destaque amarelo), com performance.now()
const observarNarrador = () => cdp('Page.addScriptToEvaluateOnNewDocument', { source: `
  window.__rot = [];
  addEventListener('DOMContentLoaded', () => {
    const nar = document.querySelector('#narrador'), q = s => nar.querySelector(s).innerText.trim();
    let ult = '';
    new MutationObserver(ms => {
      // primeiro o texto: o toque que vem junto na mesma leva pertence ao passo novo
      if (!nar.hidden) {
        const n = { fase: q('.nar-fase'), passo: q('.nar-passo'), tit: q('.nar-tit'), txt: q('.nar-txt'), ref: q('.nar-ref') };
        const chave = JSON.stringify(n);
        if (chave !== ult && n.tit) { ult = chave; __rot.push({ t: performance.now(), ...n }); }
      }
      for (const m of ms) if (m.type === 'attributes' && m.target.classList?.contains('toque'))
        __rot.push({ t: performance.now(), toque: (m.target.innerText || m.target.closest('label')?.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 90) });
    }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class', 'hidden'] });
  });` });

try {
  if (modo === 'validar') {
    for (const caso of resto) {
      const t0 = Date.now();
      await abrir(caso, 4);
      let r;
      for (let i = 0; i < 600; i++) { r = await resultado(); if (r?.fim) break; await dormir(500); }
      console.log(caso.padEnd(13), `${Math.round((Date.now() - t0) / 1000)} s`, JSON.stringify(r));
    }
  } else if (modo === 'roteiro') {
    // registra cada texto do narrador e cada toque, com o tempo desde a abertura do caso
    const [caso, vel = '1'] = resto;
    await observarNarrador();
    await abrir(caso, vel);
    const t0 = await avaliar('performance.now()');
    for (let i = 0; i < 2400 && !(await avaliar('acolher.J.demoFim')); i++) await dormir(500);
    console.log(JSON.stringify({ t0, vel: +vel, eventos: await avaliar('__rot') }));
  } else if (modo === 'gravar') {
    const [caso, pasta, fps = '8', vel = '1'] = resto;
    rmSync(pasta, { recursive: true, force: true }); mkdirSync(pasta, { recursive: true });
    await observarNarrador();
    await abrir(caso, vel);
    const passo = 1000 / +fps, t0 = Date.now(), t0pag = await avaliar('performance.now()');
    let n = 0, fimEm = null;
    const tempos = [];
    for (;;) {
      const alvo = t0 + n * passo;
      const agora = Date.now();
      if (alvo > agora) await dormir(alvo - agora);
      tempos.push(Date.now());
      const shot = await cdp('Page.captureScreenshot', { format: 'jpeg', quality: 85 });
      writeFileSync(join(pasta, `q${String(n).padStart(5, '0')}.jpg`), Buffer.from(shot.result.data, 'base64'));
      n++;
      if (fimEm == null && n % +fps === 0 && (await avaliar('acolher.J.demoFim'))) fimEm = Date.now();
      if (fimEm != null && Date.now() - fimEm > 4000) break; // segura o resultado na tela por uns segundos
      if (n > 20000) break;
    }
    // lista para o ffmpeg com a duração real de cada quadro (a captura pode atrasar em máquina lenta)
    const nome = i => `q${String(i).padStart(5, '0')}.jpg`;
    const lista = tempos.map((t, i) => `file ${nome(i)}\nduration ${(((tempos[i + 1] ?? t + passo) - t) / 1000).toFixed(3)}`);
    writeFileSync(join(pasta, 'quadros.ffconcat'), ['ffconcat version 1.0', ...lista, `file ${nome(n - 1)}`, ''].join('\n'));
    writeFileSync(join(pasta, 'roteiro.json'), JSON.stringify({ t0: t0pag, vel: +vel, eventos: await avaliar('__rot') }));
    console.log(JSON.stringify({ quadros: n, segundos: Math.round((Date.now() - t0) / 1000), ...(await resultado()) }));
  }
} finally {
  ws.close();
  chrome.kill();
}

// Cena 3D: sala de espera do ambulatorio em maquete (paredes do fundo e da esquerda; frente aberta).
// Os personagens sao bonecos simples com articulacoes para andar, gesticular e sentar.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const COR = {
  piso: 0xdfe5e8, parede: 0xf4f1ea, faixa: 0x2a9d8f, assento: 0x3d7cc9, metal: 0x9aa3ab, balcao: 0xf7f5f0,
  tampo: 0xb9895b, pele: [0xf1c7a5, 0xd9a07a, 0xa86f4c, 0x7a4b30], cabelo: [0x2b2118, 0x5a3b22, 0x9a9a9a, 0x1b1b1b, 0xb07a3a],
  calca: 0x34495e, sapato: 0x2b2b2b,
};
export const LUGARES = {
  balcao: { x: -4.3, z: -2.35, olha: [-4.3, -4] },
  espera: { x: -3.35, z: 1.3, olha: [0.5, -4] },
  entrada: { x: -5.3, z: 3.0, olha: [-6.2, 2.6] },
  corredor: { x: 5.2, z: 1.4, olha: [-6, 3.4] },
  reservado: { x: 5.7, z: -3.5, olha: [5.7, -1.8] },
  saida: { x: -6.4, z: 3.5, olha: [-8, 3.5] },
};
const CADEIRAS = [];
for (const z of [-0.4, 0.95, 2.3]) for (let i = 0; i < 8; i++) CADEIRAS.push({ x: -2.4 + i * 0.78, z });
const ZONAS_LONGE = [
  { x0: 4.6, x1: 6.8, z0: 2.6, z1: 4.4 },
  { x0: -3.6, x1: -0.8, z0: 3.6, z1: 4.6 },
  { x0: -1.2, x1: 2.6, z0: -4.4, z1: -3.6 },
];

function material(cor, extra = {}) { return new THREE.MeshStandardMaterial({ color: cor, roughness: 0.75, metalness: 0.02, ...extra }); }
function caixa(w, h, d, cor, raio = 0.04, extra) {
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(raio, w / 2.1, h / 2.1, d / 2.1)), material(cor, extra));
  m.castShadow = true; m.receiveShadow = true; return m;
}
function plano(w, h, cor, extra) { return new THREE.Mesh(new THREE.PlaneGeometry(w, h), material(cor, extra)); }
function cilindro(rt, rb, h, cor, seg = 14) { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), material(cor)); m.castShadow = true; return m; }

function rotulo(texto, cor = '#1f2430', fundo = 'rgba(255,255,255,.92)', largura = 2.2) {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128;
  const g = cv.getContext('2d');
  g.fillStyle = fundo; g.beginPath(); g.roundRect(6, 14, 500, 100, 30); g.fill();
  let tam = 54;
  g.font = `700 ${tam}px Inter, system-ui, sans-serif`;
  while (g.measureText(texto).width > 460 && tam > 20) { tam -= 2; g.font = `700 ${tam}px Inter, system-ui, sans-serif`; }
  g.fillStyle = cor; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(texto, 256, 66);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false }));
  s.scale.set(largura, largura / 4, 1); s.renderOrder = 20;
  return s;
}
function texPiso() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256;
  const g = cv.getContext('2d');
  g.fillStyle = '#e4e9ec'; g.fillRect(0, 0, 256, 256);
  for (let n = 0; n < 900; n++) { g.fillStyle = `rgba(120,135,145,${Math.random() * 0.05})`; g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); }
  g.strokeStyle = 'rgba(140,155,165,.35)'; g.lineWidth = 2; g.strokeRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(14, 10); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function texTela(texto, fundo, cor) {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 144;
  const g = cv.getContext('2d');
  g.fillStyle = fundo; g.fillRect(0, 0, 256, 144);
  g.fillStyle = cor; g.font = '700 46px Inter, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(texto, 128, 72);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ------------------------------------------------------------------------------------------------ bonecos
export class Pessoa {
  constructor(op = {}) {
    this.op = op;
    const esc = op.escala ?? 1;
    const g = this.g = new THREE.Group();
    const corpo = this.corpo = new THREE.Group(); g.add(corpo);
    const pele = op.pele ?? COR.pele[0], roupa = op.roupa ?? 0x5d7fa6, calca = op.calca ?? COR.calca;
    this.pernas = []; this.bracos = [];
    for (const x of [-0.11, 0.11]) {
      const quadril = new THREE.Group(); quadril.position.set(x, 0.86, 0);
      const perna = caixa(0.16, 0.78, 0.18, calca, 0.05); perna.position.y = -0.42; quadril.add(perna);
      const sapato = caixa(0.17, 0.09, 0.27, COR.sapato, 0.03); sapato.position.set(0, -0.82, 0.04); quadril.add(sapato);
      corpo.add(quadril); this.pernas.push(quadril);
    }
    const tronco = caixa(0.5, 0.68, 0.3, roupa, 0.08); tronco.position.y = 1.2; corpo.add(tronco);
    this.tronco = tronco;
    if (op.jaleco) { const j = caixa(0.54, 0.74, 0.33, 0xf5f7fa, 0.08); j.position.y = 1.17; corpo.add(j); tronco.visible = false; this.tronco = j; }
    if (op.colete) { const c = caixa(0.52, 0.42, 0.32, op.colete, 0.06); c.position.y = 1.3; corpo.add(c); }
    if (op.cracha) { const c = caixa(0.09, 0.12, 0.02, 0xffffff, 0.01); c.position.set(0.13, 1.33, 0.17); corpo.add(c); }
    for (const x of [-0.31, 0.31]) {
      const ombro = new THREE.Group(); ombro.position.set(x, 1.48, 0);
      const braco = caixa(0.13, 0.6, 0.15, op.jaleco ? 0xf5f7fa : roupa, 0.05); braco.position.y = -0.3; ombro.add(braco);
      const mao = caixa(0.11, 0.12, 0.12, pele, 0.04); mao.position.y = -0.65; ombro.add(mao);
      corpo.add(ombro); this.bracos.push(ombro);
    }
    const cabeca = this.cabeca = new THREE.Group(); cabeca.position.y = 1.78; corpo.add(cabeca);
    const rosto = new THREE.Mesh(new THREE.SphereGeometry(0.21, 20, 14), material(pele)); rosto.castShadow = true; cabeca.add(rosto);
    for (const x of [-0.075, 0.075]) { const o = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), material(0x1b1b1b)); o.position.set(x, 0.03, 0.19); cabeca.add(o); }
    const cab = new THREE.Mesh(new THREE.SphereGeometry(0.225, 20, 12, 0, Math.PI * 2, 0, Math.PI / (op.cabeloLongo ? 1.6 : 2.1)), material(op.cabelo ?? COR.cabelo[0]));
    cab.rotation.x = -0.25; cab.position.set(0, 0.02, -0.02); cabeca.add(cab);
    if (op.cabeloLongo) { const r = caixa(0.36, 0.42, 0.12, op.cabelo ?? COR.cabelo[0], 0.05); r.position.set(0, -0.18, -0.14); cabeca.add(r); }
    if (op.touca) { const t = new THREE.Mesh(new THREE.SphereGeometry(0.23, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2.4), material(op.touca)); t.position.y = 0.04; cabeca.add(t); }
    if (op.bengala) {
      const b = cilindro(0.015, 0.015, 1.05, 0xf3f3f3, 6); b.position.set(0, -0.55, 0.12); b.rotation.x = 0.3;
      const ponta = cilindro(0.018, 0.018, 0.12, 0xd23c3c, 6); ponta.position.y = -0.5; b.add(ponta);
      this.bracos[1].add(b);
    }
    g.scale.setScalar(esc);
    this.alvo = null; this.vel = op.vel ?? 1.5; this.fase = Math.random() * 10;
    this.anim = 'parado'; this.intensidade = 0; this.sentado = false;
    this.ancora = new THREE.Object3D(); this.ancora.position.y = 2.15; g.add(this.ancora);
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  }
  pos(x, z) { this.g.position.set(x, 0, z); return this; }
  olhar(x, z) { this.g.rotation.y = Math.atan2(x - this.g.position.x, z - this.g.position.z); return this; }
  irPara(x, z, depois) {
    this.sentar(false);
    // um novo destino interrompe o anterior: quem esperava por ele segue em frente
    if (this.alvo) this.alvo.res();
    return new Promise(res => { this.alvo = { x, z, res, depois }; });
  }
  sentar(s) {
    this.sentado = s;
    this.corpo.position.y = s ? -0.4 : 0;
    for (const p of this.pernas) p.rotation.x = s ? -1.5 : 0;
    this.corpo.position.z = s ? -0.05 : 0;
  }
  quadro(dt, t) {
    const g = this.g;
    if (this.alvo) {
      const dx = this.alvo.x - g.position.x, dz = this.alvo.z - g.position.z, d = Math.hypot(dx, dz);
      if (d < 0.05) {
        g.position.x = this.alvo.x; g.position.z = this.alvo.z;
        const a = this.alvo; this.alvo = null;
        for (const p of this.pernas) p.rotation.x = 0;
        if (a.depois) this.olhar(a.depois[0], a.depois[1]);
        a.res();
      } else {
        const passo = Math.min(d, this.vel * dt);
        g.position.x += dx / d * passo; g.position.z += dz / d * passo;
        const alvoRot = Math.atan2(dx, dz);
        let dr = alvoRot - g.rotation.y; while (dr > Math.PI) dr -= 2 * Math.PI; while (dr < -Math.PI) dr += 2 * Math.PI;
        g.rotation.y += dr * Math.min(1, dt * 10);
        const s = Math.sin(t * 9 + this.fase) * 0.5;
        this.pernas[0].rotation.x = s; this.pernas[1].rotation.x = -s;
        this.bracos[0].rotation.x = -s * 0.8; this.bracos[1].rotation.x = s * 0.8;
        this.corpo.position.y = Math.abs(Math.sin(t * 9 + this.fase)) * 0.04;
        return;
      }
    }
    const k = this.intensidade;
    const tt = t + this.fase;
    if (this.anim === 'agitado') {
      const amp = 0.3 + k * 1.6, vel = 3 + k * 7;
      this.bracos[0].rotation.x = -0.4 - Math.max(0, Math.sin(tt * vel)) * amp;
      this.bracos[1].rotation.x = -0.4 - Math.max(0, Math.sin(tt * vel + 1.7)) * amp;
      this.bracos[0].rotation.z = -0.15 - k * 0.3; this.bracos[1].rotation.z = 0.15 + k * 0.3;
      this.corpo.rotation.y = Math.sin(tt * 2.3) * 0.25 * k;
      this.cabeca.rotation.x = Math.sin(tt * vel * 0.5) * 0.08 * k;
    } else if (this.anim === 'ouvidos') {
      // maos nos ouvidos (sobrecarga sensorial) e balanco
      this.bracos[0].rotation.set(-2.6, 0, -0.6); this.bracos[1].rotation.set(-2.6, 0, 0.6);
      this.corpo.rotation.z = Math.sin(tt * (2 + k * 5)) * 0.08 * (0.4 + k);
    } else if (this.anim === 'chorando') {
      this.cabeca.rotation.x = 0.35;
      this.bracos[0].rotation.x = -1.9 + Math.sin(tt * 3) * 0.05; this.bracos[1].rotation.x = -1.9 + Math.sin(tt * 3 + 1) * 0.05;
      this.bracos[0].rotation.z = 0.35; this.bracos[1].rotation.z = -0.35;
    } else if (this.anim === 'falando') {
      this.bracos[1].rotation.x = -0.5 - Math.max(0, Math.sin(tt * 4)) * 0.4;
      this.bracos[0].rotation.x = -0.1; this.bracos[0].rotation.z = 0; this.bracos[1].rotation.z = 0;
      this.cabeca.rotation.x = Math.sin(tt * 2) * 0.04;
      this.corpo.rotation.y = 0;
    } else if (this.anim === 'escrevendo') {
      this.bracos[0].rotation.set(-1.2, 0, 0.3); this.bracos[1].rotation.set(-1.2 + Math.sin(tt * 8) * 0.08, 0, -0.3);
    } else {
      this.bracos[0].rotation.set(Math.sin(tt * 1.2) * 0.04, 0, 0); this.bracos[1].rotation.set(-Math.sin(tt * 1.2) * 0.04, 0, 0);
      this.cabeca.rotation.x = 0; this.corpo.rotation.set(0, 0, 0);
      if (!this.sentado) this.corpo.position.y = Math.sin(tt * 1.6) * 0.008;
    }
  }
}

// ------------------------------------------------------------------------------------------------ cena
export function criarCena(canvas) {
  const C = { pessoas: [], equipe: {}, publico: [], quadros: [], foco: new THREE.Vector3(0, 0, 0), zoom: 1 };
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe9eef2);
  const camera = new THREE.OrthographicCamera(-6, 6, 6, -6, 0.1, 200);
  C.renderer = renderer; C.scene = scene; C.camera = camera;

  const hemi = new THREE.HemisphereLight(0xf6fbff, 0xb7aa98, 1.25);
  const sol = new THREE.DirectionalLight(0xffffff, 2.1);
  sol.position.set(6, 14, 8); sol.castShadow = true; sol.shadow.mapSize.set(2048, 2048);
  Object.assign(sol.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 40 });
  sol.shadow.bias = -0.0005; sol.shadow.normalBias = 0.02;
  scene.add(hemi, sol);
  C.luz = { hemi, sol };

  // piso e paredes
  const piso = new THREE.Mesh(new THREE.PlaneGeometry(14, 10), new THREE.MeshStandardMaterial({ map: texPiso(), roughness: 0.9 }));
  piso.rotation.x = -Math.PI / 2; piso.receiveShadow = true; scene.add(piso);
  const base = caixa(14.4, 0.3, 10.4, 0xc9d1d6, 0.05); base.position.y = -0.16; scene.add(base);
  const paredeFundo = caixa(14.2, 2.8, 0.18, COR.parede, 0.02); paredeFundo.position.set(0, 1.4, -5.09); scene.add(paredeFundo);
  const paredeEsq = caixa(0.18, 2.8, 10.2, COR.parede, 0.02); paredeEsq.position.set(-7.09, 1.4, 0); scene.add(paredeEsq);
  for (const [w, x, z, ry] of [[14.2, 0, -4.99, 0], [10.2, -6.99, 0, Math.PI / 2]]) {
    const f = plano(w, 0.18, COR.faixa); f.position.set(x, 0.9, z); f.rotation.y = ry; scene.add(f);
  }
  // porta de entrada / saida (vidro) na parede esquerda
  const vao = plano(1.8, 2.3, 0x9cc6dd, { transparent: true, opacity: 0.55, metalness: 0.3, roughness: 0.1 });
  vao.position.set(-6.98, 1.15, 3.4); vao.rotation.y = Math.PI / 2; scene.add(vao);
  const saida = rotulo('SAÍDA', '#ffffff', '#1f9d55', 1.3); saida.position.set(-6.7, 2.55, 3.4); scene.add(saida);
  // balcao da recepcao com guiche
  const balcao = caixa(3.8, 1.1, 0.7, COR.balcao, 0.04); balcao.position.set(-4.4, 0.55, -3.2); scene.add(balcao);
  const tampo = caixa(3.9, 0.06, 0.8, COR.tampo, 0.02); tampo.position.set(-4.4, 1.13, -3.2); scene.add(tampo);
  const vidro = plano(3.6, 0.6, 0xbfe0ef, { transparent: true, opacity: 0.35, metalness: 0.4, roughness: 0.05 });
  vidro.position.set(-4.4, 1.48, -3.05); scene.add(vidro);
  for (const x of [-5.6, -3.3]) { const mon = caixa(0.5, 0.32, 0.04, 0x26323a, 0.02); mon.position.set(x, 1.35, -3.45); mon.rotation.y = Math.PI; scene.add(mon); }
  const folhetos = caixa(0.25, 0.4, 0.15, 0x2a9d8f, 0.02); folhetos.position.set(-2.8, 1.36, -3.1); scene.add(folhetos);
  C.folhetos = folhetos;
  const rRec = rotulo('RECEPÇÃO', '#1f2430', 'rgba(255,255,255,.92)', 1.8); rRec.position.set(-4.4, 2.75, -4.6); scene.add(rRec);
  // painel de senhas e TV
  const painel = caixa(1.3, 0.55, 0.06, 0x101820, 0.02); painel.position.set(-4.4, 2.2, -4.96); scene.add(painel);
  const telaSenha = plano(1.2, 0.46, 0xffffff, { map: texTela('A 042', '#101820', '#ff5252'), emissive: 0xffffff, emissiveMap: texTela('A 042', '#101820', '#ff5252'), emissiveIntensity: 0.9 });
  telaSenha.position.set(-4.4, 2.2, -4.92); scene.add(telaSenha);
  const tv = caixa(1.8, 1.05, 0.07, 0x101010, 0.02); tv.position.set(0.6, 1.95, -4.96); scene.add(tv);
  const telaTv = plano(1.68, 0.94, 0xffffff, { emissive: 0x4fa3d9, emissiveIntensity: 1.0 });
  telaTv.position.set(0.6, 1.95, -4.92); scene.add(telaTv);
  C.tv = { tela: telaTv, ligada: true };
  // som: icone sobre o painel
  const som = rotulo('🔊 ♪', '#1f2430', 'rgba(255,214,0,.95)', 0.95); som.position.set(-3.3, 2.65, -4.7); scene.add(som);
  C.som = som;
  // cadeiras
  for (const c of CADEIRAS) {
    const g = new THREE.Group();
    const assento = caixa(0.6, 0.08, 0.5, COR.assento, 0.03); assento.position.y = 0.46; g.add(assento);
    const encosto = caixa(0.6, 0.5, 0.06, COR.assento, 0.03); encosto.position.set(0, 0.74, 0.24); encosto.rotation.x = -0.12; g.add(encosto);
    for (const x of [-0.24, 0.24]) { const p = cilindro(0.025, 0.025, 0.44, COR.metal, 6); p.position.set(x, 0.22, 0); g.add(p); }
    g.position.set(c.x, 0, c.z);
    scene.add(g); c.obj = g;
  }
  // sala de acolhimento (fundo a direita)
  const salaPiso = plano(2.8, 3.2, 0xe9dfcf); salaPiso.rotation.x = -Math.PI / 2; salaPiso.position.set(5.6, 0.005, -3.4); salaPiso.receiveShadow = true; scene.add(salaPiso);
  const p1 = caixa(0.14, 2.8, 1.75, COR.parede, 0.02); p1.position.set(4.2, 1.4, -4.15); scene.add(p1);
  const p2 = caixa(0.14, 2.8, 0.55, COR.parede, 0.02); p2.position.set(4.2, 1.4, -2.05); scene.add(p2);
  const p3 = caixa(2.8, 0.9, 0.14, COR.parede, 0.02); p3.position.set(5.6, 0.45, -1.8); scene.add(p3);
  const sofa = caixa(1.8, 0.45, 0.7, 0x7e9c8a, 0.12); sofa.position.set(5.7, 0.25, -4.5); scene.add(sofa);
  const encSofa = caixa(1.8, 0.5, 0.2, 0x6c8a78, 0.08); encSofa.position.set(5.7, 0.65, -4.8); scene.add(encSofa);
  const mesinha = caixa(0.6, 0.4, 0.5, COR.tampo, 0.04); mesinha.position.set(5.0, 0.2, -3.3); scene.add(mesinha);
  const rSala = rotulo('SALA DE ACOLHIMENTO', '#1f2430', 'rgba(232,245,236,.95)', 2.2); rSala.position.set(5.6, 3.05, -3.4); scene.add(rSala);
  const luzSala = new THREE.PointLight(0xffd9a8, 2.5, 5, 1.6); luzSala.position.set(5.6, 2.4, -3.4); scene.add(luzSala);
  // corredor dos consultorios
  const rCons = rotulo('CONSULTÓRIOS →', '#ffffff', '#2a6f97', 1.9); rCons.position.set(6.6, 3.2, 3.6); scene.add(rCons);
  const tapete = plano(1.6, 3.2, 0xcfd9de); tapete.rotation.x = -Math.PI / 2; tapete.position.set(6.3, 0.006, 1.6); scene.add(tapete);
  // detalhes: plantas, bebedouro, logo
  for (const [x, z] of [[-6.5, -4.5], [3.7, -4.5], [-6.5, 1.4]]) {
    const vaso = cilindro(0.2, 0.15, 0.4, 0xb9895b); vaso.position.set(x, 0.2, z); scene.add(vaso);
    const folha = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 0), material(0x4f8a4b, { flatShading: true })); folha.position.set(x, 0.75, z); folha.castShadow = true; scene.add(folha);
  }
  const bebedouro = caixa(0.4, 1.1, 0.4, 0xe8edf0, 0.05); bebedouro.position.set(2.9, 0.55, -4.7); scene.add(bebedouro);
  const galao = cilindro(0.16, 0.16, 0.4, 0x8fc7ea); galao.position.set(2.9, 1.3, -4.7); scene.add(galao);
  const logo = rotulo('AMBULATÓRIO', '#2a6f97', 'rgba(255,255,255,.0)', 2.3); logo.position.set(2.9, 2.62, -4.9); scene.add(logo);
  // rota de saida (setas no chao, aparecem quando liberada)
  const rota = new THREE.Group();
  for (let n = 0; n < 4; n++) {
    const seta = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.45, 3), new THREE.MeshBasicMaterial({ color: 0x1f9d55, transparent: true, opacity: 0.85 }));
    seta.rotation.set(-Math.PI / 2, 0, Math.PI / 2); seta.position.set(-2.8 - n * 0.9, 0.03, 3.4); rota.add(seta);
  }
  rota.visible = false; scene.add(rota); C.rota = rota;
  // anel de tensao
  const anel = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.56, 40), new THREE.MeshBasicMaterial({ color: 0xffb300, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }));
  anel.rotation.x = -Math.PI / 2; anel.position.y = 0.02; anel.visible = false; scene.add(anel);
  C.anel = anel;

  C.redimensionar = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    const asp = w / h;
    const largura = asp < 1 ? 7.6 : asp < 1.4 ? 11 : 13;
    const meiaW = largura / 2 / C.zoom, meiaH = meiaW / asp;
    Object.assign(camera, { left: -meiaW, right: meiaW, top: meiaH, bottom: -meiaH });
    camera.updateProjectionMatrix();
  };
  posicionarCamera(C, true);
  return C;
}

function posicionarCamera(C, imediato) {
  const alvo = C.foco;
  const off = new THREE.Vector3(9, 11, 12).normalize().multiplyScalar(30);
  const desejada = alvo.clone().add(off);
  if (imediato) C.camera.position.copy(desejada); else C.camera.position.lerp(desejada, 0.06);
  C.camera.lookAt(C.camera.position.clone().sub(off));
}

// ------------------------------------------------------------------------------------------------ montar um caso
const CORES_PUBLICO = [0x8e6f9e, 0xc0784a, 0x4f8a8b, 0xa8a23a, 0x6a7fb5, 0xb55a6a, 0x5e8f5a, 0x9b7b5b, 0x4a6a8a, 0xc29a3a, 0x7a5aa8, 0x3f7f6f];
export function montarCaso(C, caso, rnd = Math.random) {
  // libera os bonecos do caso anterior (cada um tem geometrias e materiais proprios)
  for (const p of C.pessoas) {
    C.scene.remove(p.g);
    p.g.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
    if (p.alvo) { p.alvo.res(); p.alvo = null; }
  }
  C.pessoas = []; C.publico = []; C.equipe = {};
  const add = p => { C.pessoas.push(p); C.scene.add(p.g); return p; };
  const pp = caso.pessoa, lugar = LUGARES[pp.lugar];
  const op = { roupa: parseInt(pp.roupa.slice(1), 16), pele: COR.pele[(pp.idade * 7) % 4], cabelo: pp.tipo === 'idoso' ? COR.cabelo[2] : COR.cabelo[pp.idade % 5], bengala: pp.bengala };
  if (pp.tipo === 'crianca') op.escala = 0.72;
  if (pp.tipo === 'jovem') { op.escala = 0.94; op.cabeloLongo = true; }
  if (pp.nome.startsWith('Dona') || pp.tipo === 'jovem') op.cabeloLongo = true;
  const P = add(new Pessoa(op));
  P.pos(lugar.x, lugar.z).olhar(...lugar.olha);
  P.anim = pp.tipo === 'crianca' ? 'ouvidos' : 'agitado';
  P.nome = pp.nome;
  if (pp.sentado) { const ch = cadeiraPerto(lugar.x, lugar.z); P.pos(ch.x, ch.z + 0.05).olhar(ch.x, -4); P.sentar(true); ch.ocupada = true; }
  C.principal = P;
  if (caso.acompanhante) {
    const a = caso.acompanhante;
    const A = add(new Pessoa({ roupa: parseInt(a.roupa.slice(1), 16), pele: COR.pele[1], cabelo: COR.cabelo[a.nome.includes('mãe') || a.nome.includes('Dona') ? 2 : 1], cabeloLongo: true }));
    if (a.sentado) { const ch = cadeiraPerto(lugar.x + 1.2, lugar.z - 0.6); A.pos(ch.x, ch.z + 0.05).olhar(ch.x, -4); A.sentar(true); ch.ocupada = true; }
    else A.pos(P.g.position.x + 0.85, P.g.position.z - 0.45).olhar(P.g.position.x, P.g.position.z);
    A.nome = a.nome;
    if (a.nome.includes('mãe') && !a.sentado) A.anim = 'falando';
    C.acomp = A;
  } else C.acomp = null;
  // publico sentado
  for (const c of CADEIRAS) c.ocupada = c.ocupada || false;
  const livres = CADEIRAS.filter(c => !c.ocupada && Math.hypot(c.x - P.g.position.x, c.z - P.g.position.z) > 0.9);
  for (let n = 0; n < caso.cenario.publico && livres.length; n++) {
    const i = Math.floor(rnd() * livres.length), ch = livres.splice(i, 1)[0];
    const q = add(new Pessoa({ roupa: CORES_PUBLICO[n % CORES_PUBLICO.length], pele: COR.pele[n % 4], cabelo: COR.cabelo[(n * 3) % 5], cabeloLongo: n % 3 === 0, escala: n === 4 ? 0.7 : 1 }));
    q.pos(ch.x, ch.z + 0.05).olhar(ch.x, -4); q.sentar(true); ch.ocupada = true; q.cadeira = ch;
    C.publico.push(q);
  }
  for (const c of CADEIRAS) c.ocupada = false;
  // equipe
  const equipeOp = {
    recepcao: { roupa: 0x3f7fbf, cracha: true, cabeloLongo: true, cabelo: COR.cabelo[1], pele: COR.pele[0] },
    controle: { roupa: 0x2f3b45, colete: 0x1b2730, cracha: true, cabelo: COR.cabelo[3], pele: COR.pele[2] },
    enfermagem: { roupa: 0x1f9d8a, calca: 0x1f9d8a, cracha: true, cabeloLongo: true, cabelo: COR.cabelo[0], pele: COR.pele[1] },
    medico: { jaleco: true, roupa: 0x5d7fa6, cracha: true, cabelo: COR.cabelo[2], pele: COR.pele[0] },
    psicologia: { roupa: 0x7e57c2, cracha: true, cabeloLongo: true, cabelo: COR.cabelo[4], pele: COR.pele[2] },
    servico_social: { roupa: 0xef8a3c, cracha: true, cabeloLongo: true, cabelo: COR.cabelo[3], pele: COR.pele[3] },
  };
  const inicio = {
    recepcao: [-4.4, -4.1, -4.4, -2], controle: [-5.9, 2.4, -4, 2.4],
    enfermagem: [5.0, 0.2, 0, 0], medico: [5.6, 0.0, 0, 0], psicologia: [5.2, -0.4, 0, 0], servico_social: [5.8, -0.4, 0, 0],
  };
  for (const [k, o] of Object.entries(equipeOp)) {
    const e = add(new Pessoa({ ...o, vel: 3.2 }));
    e.papel = k;
    const presente = caso.presentes.includes(k);
    const [x, z, ox, oz] = inicio[k];
    if (presente) e.pos(x, z).olhar(ox, oz); else { e.pos(8.6, 1.5); e.g.visible = false; }
    e.presente = presente;
    C.equipe[k] = e;
  }
  // ambiente
  setTV(C, caso.cenario.tv); setSom(C, caso.cenario.bip); setLuz(C, caso.cenario.luz);
  C.rota.visible = false; C.folhetos.visible = true;
  C.anel.visible = true;
  C.foco.set(P.g.position.x * 0.7, 0, P.g.position.z * 0.7);
  posicionarCamera(C, true);
}
function cadeiraPerto(x, z) {
  let melhor = CADEIRAS[0], d = Infinity;
  for (const c of CADEIRAS) { const dd = Math.hypot(c.x - x, c.z - z); if (!c.ocupada && dd < d) { d = dd; melhor = c; } }
  return melhor;
}

// ------------------------------------------------------------------------------------------------ comandos
export function setTV(C, ligada) {
  C.tv.ligada = ligada;
  C.tv.tela.material.emissive.set(ligada ? 0x4fa3d9 : 0x000000);
  C.tv.tela.material.color.set(ligada ? 0xffffff : 0x111111);
}
export function setSom(C, ligado) { C.som.visible = ligado; }
export function setLuz(C, forte) {
  C.luzForte = forte;
  C.luz.hemi.intensity = forte ? 1.45 : 0.95;
  C.luz.sol.intensity = forte ? 2.4 : 1.5;
  C.luz.sol.color.set(forte ? 0xf2f8ff : 0xffe6c7);
  C.scene.background.set(forte ? 0xe9eef2 : 0xe2ddd5);
}
export function afastarPublico(C) {
  const P = C.principal.g.position;
  let zona = ZONAS_LONGE[0], dm = -1;
  for (const z of ZONAS_LONGE) { const d = Math.hypot((z.x0 + z.x1) / 2 - P.x, (z.z0 + z.z1) / 2 - P.z); if (d > dm) { dm = d; zona = z; } }
  const n = C.publico.length, col = Math.ceil(Math.sqrt(n * 1.6));
  C.publico.forEach((q, i) => {
    const cx = zona.x0 + ((i % col) + 0.5) * (zona.x1 - zona.x0) / col;
    const cz = zona.z0 + (Math.floor(i / col) + 0.5) * (zona.z1 - zona.z0) / Math.ceil(n / col);
    setTimeout(() => q.irPara(cx, cz, [P.x, P.z]), i * 120);
  });
}
export function entrar(C, papel) {
  const e = C.equipe[papel];
  if (e.presente) return Promise.resolve();
  e.presente = true; e.g.visible = true; e.pos(8.6, 1.5);
  return e.irPara(5.4, 0.6, [0, 0]);
}
// leva alguem da equipe para perto da pessoa principal (a ~1,4 m, do lado da camera)
export function aproximar(C, papel, dist = 1.4, angulo = 0) {
  const e = C.equipe[papel], P = C.principal.g.position;
  const base = Math.atan2(9, 12) + angulo;
  const x = P.x + Math.sin(base) * dist, z = P.z + Math.cos(base) * dist;
  return e.irPara(Math.max(-6.6, Math.min(6.6, x)), Math.max(-4.6, Math.min(4.6, z)), [P.x, P.z]);
}
export async function irReservado(C, quem) {
  const P = C.principal, L = LUGARES.reservado;
  const t = [];
  t.push(P.irPara(L.x, L.z, L.olha));
  if (C.acomp) t.push(C.acomp.irPara(L.x + 0.8, L.z + 0.2, [L.x, L.z]));
  if (quem) t.push(C.equipe[quem].irPara(L.x - 0.6, L.z + 1.0, [L.x, L.z]));
  C.foco.set(L.x * 0.6, 0, L.z * 0.6);
  await Promise.all(t);
}
export function cercar(C) {
  const P = C.principal.g.position;
  const ks = Object.keys(C.equipe);
  ks.forEach((k, i) => {
    const e = C.equipe[k];
    if (!e.presente) { e.presente = true; e.g.visible = true; e.pos(8.6, 1.5); }
    const a = (i / ks.length) * Math.PI * 2;
    e.irPara(P.x + Math.sin(a) * 1.0, P.z + Math.cos(a) * 1.0, [P.x, P.z]);
  });
}
export function sumirFolhetos(C) { C.folhetos.visible = false; }

export function tensaoVisual(C, valor) {
  const k = Math.max(0, Math.min(1, valor / 100));
  const cor = new THREE.Color().setHSL((1 - k) * 0.33, 0.85, 0.5);
  C.anel.material.color.copy(cor);
  C.principal.intensidade = k;
  C.tensao = k;
}

// projeta um ponto 3D na tela (para baloes de fala e marcadores em HTML)
const _v = new THREE.Vector3();
export function naTela(C, obj) {
  obj.updateWorldMatrix(true, false);
  _v.setFromMatrixPosition(obj.matrixWorld).project(C.camera);
  const r = C.renderer.domElement;
  return { x: (_v.x + 1) / 2 * r.clientWidth, y: (1 - _v.y) / 2 * r.clientHeight };
}

export function quadro(C, dt, t) {
  for (const p of C.pessoas) p.quadro(dt, t);
  const P = C.principal;
  if (P) {
    C.anel.position.x = P.g.position.x; C.anel.position.z = P.g.position.z;
    const s = 1 + Math.sin(t * (2 + (C.tensao || 0) * 8)) * 0.08 * (0.3 + (C.tensao || 0));
    C.anel.scale.set(s, s, s);
  }
  if (C.tv.ligada) C.tv.tela.material.emissive.setHSL((t * 0.05) % 1, 0.5, 0.45);
  if (C.som.visible) C.som.position.y = 2.65 + Math.sin(t * 6) * 0.04;
  for (const f of C.quadros) f(dt, t);
  posicionarCamera(C);
  C.renderer.render(C.scene, C.camera);
}

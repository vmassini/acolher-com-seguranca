# Acolher com Segurança

Jogo de treinamento do POP do NSP **"Identificação e manejo de pessoas com comportamento agitado ou
ameaçador no AME Rio Claro"** (18/02/2026). Para todas as funções do AME: recepção, controle de acesso,
enfermagem, médicos, psicologia, serviço social, gestão e NSP. Funciona no celular e no computador.

**Demo:** https://vmassini.github.io/acolher-com-seguranca/

## Como rodar

Página estática. Qualquer servidor HTTP serve:

```bash
python -m http.server 8140
```

Three.js 0.160 vem do jsDelivr. O progresso fica no navegador (localStorage); não há servidor nem login.

## Como funciona cada caso

1. **Observar** – classificar o que se vê na cena: *sinal de risco* (pede ação pelo POP), *explica a causa*
   ou *não é risco* (ex.: estereotipia).
2. **Agir** – sem cronômetro. Cada ação leva um tempo da cena (30 s a 45 s; mais 30 s quando alguém
   precisa ser acionado) e só nesse tempo a tensão muda: sobe com barulho, luz forte e público perto,
   desce com os ajustes certos. Por isso a ordem importa, mas não há pressa para ler. Cada ação pede
   **quem faz**, conforme a seção Responsáveis do POP, e o retorno fica no painel até a próxima ação.
   No alto da cena aparecem os fatores que estão subindo ↑ ou descendo ↓ a tensão naquele momento.
   Algumas ações são armadilhas (contenção física, sedação, falar alto, cercar, tocar sem avisar…).
3. **Conversar** – depois de eleger um interlocutor único, três falas com escolhas.
4. **Encaminhar e registrar** – SAMU 192, PS, CAPS, Conselho Tutelar, PM 190 ou seguir no AME;
   registro no prontuário; notificação ao NSP; reunião pós-evento.
   Na primeira vez, dicas curtas aparecem na hora certa (podem ser reativadas na ajuda). Termos
   técnicos (NSP, CAPS, estereotipia, interlocutor único...) têm explicação ao toque.
5. **Resultado** – **o que faltou** (com quem deveria fazer, pelo POP), notas (sinais, segurança, acolhimento, protocolo, agilidade em tempo de cena), o
   **check list do Anexo 1** do POP e o que cabe a cada função envolvida no caso.

## Casos

| # | Caso | Tema do POP |
|---|------|-------------|
| 1 | Espera demorada | Frustração e dor; recepção aciona enfermagem; interlocutor único |
| 2 | Barulho demais | TEA, sobrecarga sensorial, estereotipia não é agressividade, acompanhante |
| 3 | A chamada que não chegou | Pessoa surda: falar de frente e escrever; ajuste razoável (LBI) |
| 4 | Acompanhante exaltado | Afastar público, rota de saída, sem contenção, limites com respeito |
| 5 | Confusão de repente | Causa clínica (hipoglicemia); não rotular como psiquiátrico |
| 6 | "Hoje eu acabo com tudo" | Ideação suicida e autolesão em adolescente: não deixar sozinha, SAMU, Conselho Tutelar |
| 7 | Cadeiras fora do lugar | Pessoa cega: identificar-se, explicar o ambiente, oferecer o braço |

## O que precisa de validação (NSP e psicologia)

O POP não detalha as falas nem algumas decisões. Foram completadas com as fontes abaixo:

- Técnicas de conversa: Projeto BETA (10 domínios do desescalonamento verbal) e diretriz da ABP (2019).
- Caso 4: quando acionar a PM 190 (o POP só lista o contato). No jogo, PM é obrigatória após agressão
  física e opcional se a situação foi contida.
- Caso 5: valores clínicos (glicemia 52 mg/dL) e conduta "conforme protocolo clínico".
- Caso 6: Conselho Tutelar com base na Lei 13.819/2019 (violência autoprovocada em adolescente).
- Pesos da pontuação e velocidade com que a tensão sobe (em `assets/jogo.js` e `assets/casos.js`).

## Fontes

- POP NSP – AME Rio Claro (18/02/2026)
- [Richmond et al. – Verbal De-escalation of the Agitated Patient (Projeto BETA, 2012)](https://westjem.com/?p=1160)
- [Baldaçara et al. – Diretrizes brasileiras para o manejo da agitação psicomotora, parte 1 (2019)](https://www.scielo.br/j/rbp/a/xTthMJxBtn7yYK9h5t8wPbn)
- [Lei 13.819/2019](https://www2.camara.leg.br/legin/fed/lei/2019/lei-13819-26-abril-2019-788025-normaatualizada-pl.pdf)
- [Ministério da Saúde – Suicídio: saber, agir e prevenir](https://www.icict.fiocruz.br/sites/www.icict.fiocruz.br/files/Suicidio_Prevencao%202018-MS.pdf)
- [Fiocruz – atendimento à pessoa surda](https://mooc.campusvirtual.fiocruz.br/rea/acessibilidade-sus/downloads/modulo_6/Apostila-acessivel_mod6_parte2.pdf)
- [UFMG/NAI – orientações para pessoas com deficiência visual](https://www.ufmg.br/nai/wp-content/uploads/2023/11/Orientações-para-pessoas-com-deficiência-visual.pdf)
- [USP – Guia CAUSP](https://www.ifsc.usp.br/cip/wp-content/uploads/2025/04/Guia_CAUSP.pdf)
- Lei 13.146/2015 – Lei Brasileira de Inclusão

## Arquivos

- `index.html`
- `assets/casos.js` – funções, ações, encaminhamentos, registro e os 7 casos (conteúdo editável)
- `assets/cena.js` – sala de espera em 3D e personagens
- `assets/jogo.js` – fases, tensão, pontuação e telas
- `assets/style.css`

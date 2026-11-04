# Pixel HQ — documento de continuação

Este documento permite que qualquer agente de IA (ou pessoa) continue o projeto de onde parou, sem ter visto
a conversa que o originou. Leia inteiro antes de mexer. Atualize a seção **15. Estado e pendências** a cada
entrega.

Última atualização: 2026-11-03. Idioma do projeto, da interface e do dono: **português do Brasil**.

---

## 1. O que é o Pixel HQ

Um escritório em pixel art/3D, de código aberto, em que **agentes de IA trabalham de forma visível**. O usuário
conecta uma IA, descreve o serviço dele, a IA monta o escritório, e cada tarefa digitada faz os personagens certos
irem aos móveis certos e executarem etapas (planejar, pesquisar, produzir, revisar, entregar). Clicar num personagem
abre uma ficha com o que ele está fazendo.

### Fluxo de produto (decidido pelo dono — não mude sem pedir)

1. **Escolher a IA e conectar** (OpenAI, Anthropic ou Ollama). O usuário **não escolhe o modelo**: o sistema testa e
   escolhe sozinho (`server/llm.mjs`).
2. **Descrever o serviço.** A IA monta o escritório (nome, estilo, equipe de 3 a 10 pessoas, móveis extras, até 2
   móveis criados pela IA). O escritório aparece pronto, com **só** o escritório, o menu suspenso no canto superior
   direito e o campo de texto centralizado embaixo.
3. **A cada tarefa**, a IA decide **quais personagens entram e o que fazem**. Antes da primeira tarefa a sala está
   **vazia**; os personagens entram pela **porta da parede** (porta dupla de vidro desenhada no 3D junto do capacho, que fica
   encostado na parede esquerda) quando a tarefa começa e saem por ela ao terminar, um de cada vez.
4. **Menu suspenso (canto superior direito):** configurar o ambiente criado, trocar a IA, equipe, regras, modo
   desenvolvedor, pesquisa na internet. (O botão "Visual 3D" foi escondido: o dono quer **tudo em 3D**.)

Regras de UX já aprendidas (não regredir):
- **Nada 2D na experiência normal** (pedido explícito do dono): sala, editor, fantasma ao arrastar, miniaturas do
  painel, retratos e marcas do editor (área verde/vermelha, seleção, alças "+") são 3D. O 2D (`web/js/05-desenho.js`,
  `09-cena.js`) só existe como reserva automática sem WebGL e, no editor, como camada dos textos (como os nomes).
- Ao abrir/atualizar a página não pode aparecer o 2D antes do 3D (classe `espera3d` em `00-base.js` + CSS).
- Todo móvel novo precisa de modelo 3D no estilo dos personagens (facetado, contorno preto), não só caixas.
- Nada de barra de player nem cartões de personagens depois do setup (só no modo desenvolvedor, `body.dev`).
- Perguntas simples são respondidas direto, em markdown renderizado; ninguém fica "bloqueado" à toa.
- Cada pedido deve ir ao **móvel semântico correto** (computador para produzir, quadro para planejar, etc.).
- Se o catálogo não tem o móvel, a IA **cria** um dentro das diretrizes (`server/furniture.mjs`).

## 2. Preferências do dono (importa para quem continua)

- Quer um **parceiro de debate crítico**: não concordar por reflexo, apontar falhas e riscos, dizer quando não tem
  certeza, **nunca inventar**, e **verificar na internet** o que for atual (preços, ferramentas, leis).
- Responder sempre em **português do Brasil**, de forma direta.
- Decide por imagem: prefere ver prints/comparações a ler teoria. Costuma mandar referências visuais.
- Já mudou de direção visual várias vezes. Quando houver escolha de estilo, mostre lado a lado antes de gastar
  trabalho ou créditos.
- Pede confirmação de **custo** antes de gastar créditos de serviços pagos. Sempre diga o custo estimado.
- Nunca peça nem aceite chaves/tokens no chat. Chaves vão em "Network secrets"/variáveis do ambiente.

## 3. Como rodar e testar

Requisitos: Node.js 22+ (`node --version`).

```bash
npm install
npm start            # servidor em http://127.0.0.1:8787 (abre o setup se a IA não estiver configurada)
npm run demo         # mesmo fluxo de eventos, sem chamar IA nenhuma
npm test             # 77 testes, todos devem passar (no Windows, o teste da permissão 0600 do settings.json falha: o NTFS não tem esse modo)
npm run check:layouts   # (opcional, precisa de Playwright) valida as plantas: retangular e em L, 6 e 10 pessoas, todos os estilos, áreas, vagas e a porta
npm run build:single    # arquivo único em dist/ COM 3D e modelos (~10 MB); --sem-modelos (~1 MB) | --sem-3d
```

Variáveis úteis: `PORT`, `HOST`, `PIXELHQ_DATA_DIR` (onde ficam `settings.json` e `office.json`),
`WORKSPACE_DIR` (onde os agentes salvam entregas), `MIN_DWELL_MS` (permanência mínima por etapa), `PIXELHQ_MODEL`
(força um modelo), `OPENAI_API_KEY` / `ANTHROPIC_API_KEY`, `PIXELHQ_PARALELO` (tarefas simultâneas, padrão 2),
`PIXELHQ_WEB=0` (desliga a internet dos agentes), `BRAVE_API_KEY` (busca pela Brave em vez do DuckDuckGo),
`PIXELHQ_BUSCA_URL` e `PIXELHQ_WEB_LOCAL=1` (só para testes: busca falsa e rede local liberada).

Endereços de depuração: `?2d` força o desenho 2D, `?3d` força o 3D, `?px=N` resolução do 3D (padrão 1 = nítido),
`?estilo=lowpoly` personagens feitos em código, `?contorno=0` desliga o contorno dos personagens, `?flat=0` (estilo
Meshy) usa material realista em vez do sombreado chapado.

Para ver a sala já montada sem configurar IA, crie dados de teste: um `settings.json` com
`{"provider":"ollama","model":"teste","keys":{},"baseUrls":{}}` e um `office.json` gerado por
`normalizeSpec` (veja o formato em `test/office.test.mjs`, função `good()`), e rode
`PIXELHQ_DATA_DIR=<pasta> PORT=8611 node server/server.mjs --demo`.

## 4. Arquitetura

```
server/                 Node (http + ws), sem framework
  server.mjs            HTTP/WS, rotas /api/*, fila + tarefas em paralelo (MAX_PARALLEL, running), vendor three
  web.mjs               internet só leitura: search (DuckDuckGo HTML | Brave), readPage, checkURL (anti-SSRF)
  locks.mjs             travas por agente (cada pessoa faz uma coisa por vez)
  providers.mjs         OpenAI (Responses → fallback chat.completions), Anthropic, Ollama
  llm.mjs               escolhe o modelo sozinho (pickModel) e troca se der erro de modelo
  settings.mjs          data/settings.json (modo 0600); chaves nunca vão para a página
  office.mjs            prompt + validação do escritório (normalizeSpec), planOffice
  furniture.mjs         catálogo (12) + móveis criados pela IA (validateDesign, designFurniture)
  places.mjs            lugares (computador, quadro, reunião...) e guessPlace
  runner.mjs            executa uma tarefa: lead decide modo direto|equipe (+ "web"), etapas, research(), revisão
  protocol.mjs          validação das mensagens (protocolo v1)
  pacer.mjs             tempo mínimo por etapa
web/
  index.html            importmap do three, scripts js/00..27, 99, módulo js3d/cena3d.js
  js/                   scripts clássicos que compartilham o escopo global (ordem pelo prefixo numérico)
  js3d/                 módulos ES (3D) que leem os globais dos scripts acima: cena3d.js, moveis3d.js, personagens3d-*.js
  modelos/              GLB dos personagens (Meshy)
  dev/retratos.html     página de retratos dos personagens (usada por scripts/retratos.mjs)
docs/PROTOCOLO.md       protocolo v1 (mensagens servidor↔página)
test/                   node --test
scripts/                build-single (esbuild), check-layouts, retratos.mjs, miniaturas.mjs, glb-ilhas.mjs, reduzir-textura-glb.py
```

### Protocolo v1 (resumo; completo em `docs/PROTOCOLO.md`)

Servidor → página: `hello`, `team {name, role, roleName, kind}`, `state {agent, state, task, with, detail, run, place}`,
`log`, `result {run, agent, action, title, text}`, `task {id, status, output, folder, error, fix}`.
Página → servidor: `{type:'task', id, text}`, `{type:'cancel', id}`.
Estados universais: planejando, trabalhando, revisando, pesquisando, reuniao, entregando, aguardando, bloqueado,
concluido, ocioso, offline (com apelidos: codando/testando→trabalhando, deploy→entregando).
Lugares: computador, quadro, reuniao, leitura, painel, estudio, recepcao, impressora, servidores, atendimento,
cozinha, estoque, loja, oficina, e `p_*` (móvel criado pela IA).

### Scripts da página (web/js)

`01-catalogo.js` (itens, lugares, estados), `02-mundo.js` (planta base `tplSala`), `13-sim-agentes.js` (simulação,
`present`, `bestSpot`), `16-fonte-tempo-real.js` (WebSocket), `22-missoes.js` (tarefas), `25-configuracao.js`
(setup/menu de IA), `26-montagem.js` (monta a sala a partir do `office.json`: `officeWorld`, `SLOTS`),
`27-entregas-menu.js` (markdown seguro, menu, `quietOffice`, `enterOffice/leaveOffice`), `99-inicio.js` (arranque).
Escritório "quieto" = `quietOffice() = bridge && !devMode`: personagens ausentes até haver evento; a simulação
pausa com a sala vazia.

## 5. O visual 3D

**Sempre 3D** quando há servidor (`PIXELHQ_BRIDGE`) ou no arquivo único (`PIXELHQ_3D`). A antiga preferência
`localStorage pixelhq.3d = 0` é ignorada; `?2d` força o 2D só para testes. `00-base.js` põe `espera3d` no `<html>`
(esconde o canvas 2D e mostra "Carregando o escritório…"); `cena3d.js` tira a classe no primeiro quadro 3D, ou se o
3D falhar (aí o 2D aparece).

**Porta de entrada** (item `capacho`, nome "Porta de entrada", `door: true`): o usuário **arrasta a porta** no
editor (pelo capacho ou pelo vão da porta na parede) e ela gruda na parede externa mais perto do cursor —
esquerda (`rot` ímpar) ou fundo (`rot` par); só essas paredes existem no 3D, a frente e a direita ficam abertas para a
câmera. Regras em `03-geometria.js`: `doorFits` (encostada na parede, sobre o piso), `doorSpot` (lugar válido mais
perto), `doorInfo` (lado, trecho, para onde se olha ao entrar), `fixDoor` (salvo antigo, piso mudado ou porta sumida:
volta para a parede mais perto ou é criada; roda em `normalize` e no arranque). `footprintOk` devolve `'door'` quando
a porta não está numa parede e trata a porta como **sólida** para os outros móveis (nada fica em cima da passagem).
A porta não gira, não duplica e não é apagada (a barra de contexto só mostra o nome e a dica).
O 3D (`cena3d.js`, `rebuild` → `entryDoor = doorInfo()`) recorta a parede até 2,1 de altura, põe batente, verga e
**duas folhas de vidro** em dobradiças (`D.leaves`); as folhas abrem (até ~77°) quando algum agente presente está a
menos de 1,8. `entrance()` em `27-entregas-menu.js` põe quem entra logo dentro da porta, olhando para dentro.

**Marcas do editor em 3D:** `editorMarks()` (`09-cena.js`) devolve uma lista em coordenadas da sala (áreas, pontos,
alças "+", etiquetas). O 3D (`updateMarks` em `cena3d.js`) desenha como malhas na camada 1 (sem contorno, com
profundidade: o móvel na frente esconde a marca); as alças "+" ficam por cima de tudo (`depthTest` desligado) para
aparecerem atrás das paredes do fundo. O canvas 2D, no modo Construir, só desenha os **textos** (tamanho da parede,
dica da alça). Sem WebGL, `drawMarks2D` desenha a mesma lista no 2D.

`web/js3d/cena3d.js` (Three.js 0.170.0) desenha a sala em 3D por cima do 2D (o 2D só desenha se o 3D não estiver
ativo; sem WebGL cai para o 2D). Pontos-chave:

- Material `MeshToonMaterial` com 3 faixas; luz hemisférica + sol com sombra; câmera ortográfica (pitch 30°, yaw
  em múltiplos de π/4); pós-processamento `PixelPass` (contorno por profundidade+normais+máscara de personagem),
  Bloom, SMAA (modo nítido). Nomes e ícones são desenhados num canvas 2D por cima (`#scene3d-ui`).
- Mouse: arrastar move, roda aproxima no cursor, botão direito/Shift gira com encaixe; clique numa pessoa abre a ficha.
- **Edição da sala no 3D** (modo Construir): `R3D.active()` vale em `live` e `build`; em `build` o canvas 2D fica
  transparente **por cima** do 3D (`drawOverlay3D` em `09-cena.js` desenha só seleção, fantasma e marcas). O 3D
  substitui `window.iso/unIso/hitAny/hitPerson` (raio da câmera → chão/caixas), então o editor 2D inteiro funciona
  sem mudança. Roda/botão direito/pan vão para `R3D.zoomAt/rotStart/panStart` (`17-entrada.js`).
- **Arquivo único:** `scripts/build-single.mjs` empacota `cena3d.js` + three com esbuild e embute os GLB como
  `data:` em `window.PIXELHQ_MODELOS`; `PIXELHQ_MODELOS=false` (`--sem-modelos`) começa no low-poly.
- **Móveis 3D** (`web/js3d/moveis3d.js`): **todos os 37 itens** do catálogo têm MODELO low-poly (vasos torneados,
  troncos em gomos, folhas recortadas, roupas no cabide, cadeiras com base em estrela, estofados chanfrados). O
  catálogo continua mandando em tamanho, colisão, pontos de uso e no 2D; sem modelo, o item usa as caixas do
  catálogo chanfradas. As cadeiras das mesas são marcadas com `ch` em `chair()` e viram modelo. Normais por face
  (facetado como os personagens) e **contorno preto** (os móveis entram na camada 3 da máscara;
  `?contornoMoveis=0` desliga). Partes animadas (telas, LEDs, vapor) seguem vindo das caixas.
  Teste: `test/moveis3d.test.mjs` (peças válidas, dentro da área, giro igual ao `rotRect`).
  Peças disponíveis no montador `P`: `box(x,z,w,d,y,h,cor,{r,rx,ry,rz,glow,glass})` (mesma ordem do catálogo),
  `cyl(cx,cz,rTopo,rBase,y,h,cor,{seg})` (vertical), `rod([x,y,z],[x,y,z],raio,cor,{seg})` (haste em qualquer direção;
  use para cilindros deitados), `lathe(cx,cz,y,[[raio,altura]…],cor)` (vasos, bases), `ball`, `leaf` (folha
  recortada), `garment` (camiseta/vestido/calça), `base([índices a pular])` (reaproveita caixas do catálogo),
  `chairs()`. Ajudantes: `pot`, `bush`, `spikes`, `crown`, `monitor`, `keyboard`, `sled`, `mug`, `handle`, `shoe`.
  Cor `'C'` = cor escolhida no editor (`objColor`). Itens criados pela IA com plano B herdam o modelo da base
  (`look3d` em `registerCustom`); os desenhados pela IA usam as caixas dela (chanfradas, com contorno).
  Para conferir o visual de todos: `node scripts/miniaturas.mjs saida.png --url=http://127.0.0.1:8787` (servidor
  rodando) gera a grade com as miniaturas 3D de todos os itens.
- Itens novos nesta rodada: **estante de sapatos** (`sapateira`, comércio, lugar `loja`, uso `sell`) e a
  **cadeira de barbeiro** (`cadeira_salao`, agora virada para o espelho, com poste de barbeiro, apoio de cabeça e de
  pés; cor do estofado editável, padrão bordô `#8A2430`).
- **Editor só 3D:** o fantasma do móvel/parede arrastado ou sendo colocado é desenhado na cena 3D
  (`ghost` em `cena3d.js`; o original some enquanto arrasta) e as miniaturas de Elementos, paredes e pisos são
  renderizadas com os modelos 3D (`thumbs3d`). O 2D só desenha marcas no piso (seleção, área verde/vermelha).
- **Carregamento sob demanda:** o kit Meshy só baixa o modelo de um penteado quando alguém o usa (`ready/load`);
  enquanto isso o personagem não aparece e o retrato usa o 2D.
- **Contorno dos personagens:** cada malha de personagem tem `userData.idMat` (cor de id da região) e a camada 3;
  o `PixelPass` renderiza só a camada 3 num alvo de máscara e desenha silhueta de 2 px e linhas internas de 1 px
  quase pretas. Uniform `cK` liga/desliga (`?contorno=0`).
- **Retratos das listas** (Equipe, ficha, cartões): `cena3d.js` redefine `window.avatar` e `window.fullAvatar`,
  renderizando o próprio modelo num renderizador pequeno com cache por aparência; sem 3D, usa o sprite 2D original.
- **Seleção do estilo de personagem:** `ESTILOS` em `cena3d.js`: `meshy` (padrão) e `lowpoly`. Se os modelos GLB não
  carregarem, cai sozinho para o `lowpoly`.

Contrato de um "kit" de personagens (`personagens3d-*.js` exportam `characterKit(...)`): retorna
`{ build(p), pose(v, st, t, seed), dispose(v), lookKey(p), setEnv?, MESHES, LAYER, CS, HIPY, TAGY }`.
`build` cria o modelo de uma pessoa (`{root, model, bones, head, ...}`); `pose` recebe
`st = {sit, moving, phase, act}` e aplica as poses `typing|talk|board|hands|read|wave|stuck|held`; `MESHES`+`LAYER`+
`userData.idMat` alimentam o contorno. A cena (`updatePeople`) reconstrói o modelo quando `lookKey` muda.

## 6. Personagens (estilo padrão = Meshy) — como funciona

Arquivo: `web/js3d/personagens3d-meshy.js`. Modelos: `web/modelos/*.glb` (7 de camiseta + 7 de terno, ~1 MB cada, texturas 1K JPEG).

**Um modelo por penteado** (`POR_PENTEADO`): curto→`menino_curto` (arquivo `menino_acessorios.glb`), franja→
`menino_franja`, longo→`menina_longo`, rabo→`menina_rabo3` (arquivo `menina_rabo3_acessorios.glb`, refeito em 2026-11-03), coque→`menina_rabo` (arquivo
`menina_coque_acessorios.glb`), cacheado→`menino_cacheado`, raspado→`menino_raspado`. Roupa **terno** usa `POR_TERNO` (penteado → `terno_<penteado>`); papéis novos em `roles`: `suit` (peça do terno: mantém a
cor original, só a pele é repintada; acima do pescoço vale como rosto) e `keep` (olhos/boca em peças à parte, cor
original). Âncoras `keep*` em `a` só servem para separar terno de pele. Os nomes de chave e de
arquivo não batem em alguns casos; **a verdade é a tabela `MODELS`** (campo `file`).

Cada modelo foi **gerado já com óculos, fone, crachá (e barba nos meninos)**. O código:

1. **Ilhas de malha:** o GLB "smart topology" do Meshy vem em dezenas de peças desconexas. O código agrupa os
   triângulos por conectividade (`prep()` → `triIsl`) e, para cada acessório, usa `acc` (centros das ilhas em
   alturas do corpo, 0 = pé, 1 = topo, coordenadas `[x, y, z]` divididas pela altura) para achar as ilhas
   daquele acessório. Quando a pessoa **não** usa o acessório, gera-se uma geometria sem esses triângulos
   (cache `geoCache` por combinação). Sem buraco, porque o Meshy modela a superfície por baixo.
2. **Repintura da textura por pessoa:** cada pixel da textura é classificado pela cor mais próxima das âncoras `a`
   (`hair`, `skin`, `shirt`, `dark`, `sole`, `mouth`) e `dark` é desdobrado por posição no corpo em
   `eye|pants|shoe|hair` (mapa de regiões `REG`, rasterizado no espaço UV). Depois a textura é repintada com as cores
   da pessoa mantendo a variação de luz do original (razão de brilho pixel/âncora). Cores comparadas em **sRGB
   0–255** (`rgb()`), nunca por `THREE.Color` (que converte para linear — foi um bug).
3. **Marcas pintadas sob os acessórios:** o Meshy pinta a armação dos óculos no rosto, o crachá na camiseta, o
   fone na cabeça e a barba no queixo. `roles` (`torso`, `face`, `head`) diz quais ilhas carregam essas marcas; o
   código as corrige: tronco→camiseta chapada; cabeça/trás→cabelo; frente do rosto/queixo→pele; "faixa dos olhos"
   →pele. A **"sombra" dos óculos** (`SHADOW`) projeta a armação em 3D sobre o rosto e pinta ali de pele/cabelo
   (é o que remove o traço no nariz quando a pessoa não usa óculos). `FIX=2` usa o tom médio da pele do rosto.
   `noShadow:true`, `eyeband:false`, `chinOnHead:true`, `darkHair:true` são ajustes por modelo.
4. **Acessórios** mantêm a cor original (`ZK 'keep'`); a barba (`role 'beard'`) é repintada com o cabelo.
5. **Poses:** os mesmos parâmetros dos outros kits, aplicados aos ossos Mixamo-like do rig do Meshy (`Hips`,
   `Spine`, `LeftArm`, `LeftForeArm`, `LeftUpLeg`, `LeftLeg`, `Head`...). Como os braços são curtos, as poses de
   braço foram refeitas (braço mais baixo + cotovelo dobrado) para não virarem "toco" visto de frente.
6. Sombreado: `MeshToonMaterial` com 2 tons (`TWO`); `?flat=0` usa `MeshStandardMaterial`.

### Adicionar ou refazer um modelo (procedimento)

1. Gere (ver seção 8) em **A-pose**, low-poly `smart-topology` (~7000 triângulos), textura 2K, **com todos os
   acessórios**, e rig humanoide. Peça **olhos pintados no rosto, atrás de lentes transparentes** (se as lentes saírem
   opacas, os olhos somem quando a pessoa não usa óculos — foi o que invalidou um raspado novo).
2. Reduza as texturas: `python3 scripts/reduzir-textura-glb.py arquivo.glb` (1024 px, JPEG 96; precisa de Pillow).
3. Liste as ilhas com `node scripts/glb-ilhas.mjs arquivo.glb` e identifique à mão quais são óculos, fone, crachá, barba,
   rosto, cabelo, tronco. Registre em `MODELS` e ligue em `POR_PENTEADO`.
4. Renderize as 6 combinações com `node scripts/retratos.mjs acessorios:<penteado> out.png [--angulo=35]`
   (servidor rodando) e confira: sem buraco, sem marca de
   armação/crachá/fone/barba, olhos presentes sem óculos.
5. Rode `npm test` (o teste `estilo padrão (Meshy)` confere que todo penteado tem modelo e que todo `.glb` existe;
   `test/modelos.test.mjs` confere que todo ponto de `acc`/`roles` cai numa ilha real do arquivo).

## 7. Reserva low-poly (feita em código)

`web/js3d/personagens3d-lowpoly.js`: cabeça grande, corpo de boneco, facetado (`flatShading`), cabelo em casca
recortada, rosto colado nas faces reais por raio (`hit()`), acessórios em código. Cobre **todos** os penteados,
roupas e acessórios do editor (um teste garante). Serve de reserva quando os GLB não carregam e para quem apagar
`web/modelos/`. Não recebe mais investimento visual.

## 8. Meshy (e Tripo) — como usar a partir daqui

O Meshy é a fonte dos modelos. **Custos medidos (créditos):** imagem→imagem (nano-banana-2-lite) 3; imagem→3D
smart-topology com textura 2K 15; rig 5. Um modelo completo com referência ≈ 23. Saldo em 2026-11-03: **230** (391 antes dos ternos; 161 nos 7 ternos).
Preços oficiais: https://docs.meshy.ai/en/api/pricing (verificar antes de gastar).

- Usa-se a **CLI** `meshy-cli@0.4.0`: `npm exec --yes --package=meshy-cli@0.4.0 -- meshy ...`. Comandos usados:
  `image-to-image create`, `image-to-3d create --input-task-id ... --model-type smart-topology --target-polycount 7000
  --should-texture true --enable-pbr false --texture-resolution 2k --pose-mode a-pose`, `rigging create
  --input-task-id ... --height-meters 1.2`, `<recurso> wait`, `download --asset result.rigged_character_glb_url`,
  `balance`. Sempre `--async` + `--operation-id` (idempotência) e depois `wait`.
- No ambiente de nuvem usado, a rede é por proxy: exporte `NODE_USE_ENV_PROXY=1` e
  `NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt`, e a chave é **injetada pela rede** (passe um valor qualquer em
  `MESHY_API_KEY`). Fora dali, use `meshy auth login --device` ou a sua chave. **Nunca** coloque chave no chat ou
  no repositório.
- Domínios que precisaram ser liberados no ambiente: `api.meshy.ai` (com a chave), `assets.meshy.ai`,
  `docs.meshy.ai`.
- A **API tem saldo separado** do plano do site (vale para Meshy e Tripo).
- **Tripo:** testado e descartado (modelo em 30 partes, mas emendas no ombro, olhos irregulares). A chave do Tripo
  funciona em `api.tripo3d.ai`; a CLI usa `openapi.tripo3d.ai` (não liberado) e o saldo da API estava 0.
- Tarefas já feitas (para reaproveitar sem pagar de novo, com `download --resource ... --task-id ...`): o menino
  base e o lote estão em `meshy/out` e `meshy/lote` do scratchpad da sessão **que não vai junto no repositório**;
  os `.glb` finais já estão em `web/modelos/`. Se precisar das referências de imagem, gere de novo.

## 9. Ferramentas de verificação visual (agora no repositório)

A verificação foi feita com **Playwright + Chromium em software** (`--use-gl=angle --use-angle=swiftshader
--enable-unsafe-swiftshader`), ~4–7 fps; serve para conferir imagem, não desempenho (o dono mediu no computador dele e
disse que está **ótimo**).

- **Página de retrato** (`web/dev/retratos.html`; atalho `scripts/retratos.mjs todos|acessorios:<penteado>|sem-oculos|poses`):
  carrega o kit por `?k=meshy|lowpoly`, monta uma fileira com `kit.build/pose`, câmera ortográfica, e responde
  `window.done`. Parâmetros: zoom `z`, inclinação `p`, altura `y`, `bg`, `floor`. O hash `#<json>` traz as aparências.
  Assinaturas: `characterKit({ THREE })` no Meshy (é assíncrona: use `await`) e
  `characterKit({ THREE, mergeGeometries, mergeVertices })` no low-poly. Importe `three` e `three/addons/*` pelo
  importmap do `web/index.html` (`/vendor/three/...`).
- **Galeria dentro da sala:** `devMode=true; setMode('build'); W.people=[...]; setMode('live'); sim.playing=false;`
  posiciona agentes em `NAV.spots` e tira prints com zoom (roda do mouse). Ver `sim.agents[i]` (`x,z,mv,spot,status`).
- Ao tirar prints sempre confira a página de **erros** (`pageerror`/`console error`).
- O contorno só aparece na cena real (não na página de retrato).

## 10. Ambiente de nuvem (armadilhas já encontradas)

- Servidores de teste **caem** quando o container é reciclado (`ERR_CONNECTION_REFUSED`): suba de novo.
- Não use `pkill -f` (casa o próprio comando); use `ps | awk '/node server/ && !/awk/ {print $2}' | xargs kill`.
- Esperas longas: use laços `until` ou tarefas em segundo plano, não `sleep` encadeado.
- `fetch` do Node ignora o proxy sem `NODE_USE_ENV_PROXY=1`.
- O ambiente bloqueia domínios novos até serem liberados em "Acesso à rede"; segredos ficam em "Network secrets".

## 11. Decisões de produto já tomadas (e por quê)

- **Estilo dos personagens:** depois de testar vinil (arredondado), low-poly em código, GLB do Tripo e modelos do
  Meshy, o dono escolheu o **low-poly facetado do Meshy** (referência: boneco de cabeça grande, olhos quadrados,
  cabelo em facetas). Sombreado **chapado** e **borda preta fina**.
- **Acessórios gerados junto com o modelo e escondidos em código** (ideia do dono) em vez de peças avulsas.
- **T-pose rejeitada** por mim para braços curtos (a A-pose deforma menos o ombro); o problema real era a pose.
- Edição da sala no 3D reaproveita a lógica do editor (troca só a projeção/acerto), em vez de um editor 3D novo.
- **Tudo 3D** (dono): sem opção de voltar ao 2D no menu; móveis refeitos em código no estilo dos personagens (não
  pelo Meshy: ~15–20 créditos por móvel, caro para 37 itens). Contorno preto também nos móveis.
- **Porta de entrada na parede** junto do capacho (dono), porta dupla de vidro automática.
- Roupas da arara **alinhadas à grade** (perpendiculares à barra), não em ângulo — pedido do dono ("em isometria").
- **Internet dos agentes:** só buscar e ler (sem rodar código, sem formulários, sem login) — decidido por segurança
  e custo; ligado por padrão, com botão no menu. Pesquisa só nas etapas `pesquisar` e em perguntas diretas que o
  coordenador marca com `"web": true`.
- **Paralelismo:** 2 tarefas por padrão; trava por agente (uma pessoa nunca está em dois lugares).
- **Sala grande:** uma ala fixa à direita (testada), não uma planta gerada — mantém a garantia de nada encavalado.
- Os estilos antigos (vinil, toon, GLB do Tripo) foram **removidos**; o histórico está no git antigo descartado
  e nos prints entregues ao dono, não no repositório atual.

- **Porta movível** (dono): a porta de entrada é um item que o usuário arrasta para qualquer parede externa
  (esquerda ou fundo); a equipe entra e sai por ela. Não pode ser apagada.
- **Planta em L** (dono pediu "plantas realmente diferentes"): a IA escolhe `"planta": "retangular" | "em_l"` na
  ficha (`layout: 'rect' | 'L'`). Em L, `officeWorld` acrescenta uma ala na frente-esquerda (`WING`, x 0..6, z 11..15)
  com sala de espera (tapete, mesa de centro, sofá, poltrona, palmeira, luminária) e a porta na parede da ala.
  **Dois andares não foi feito**: exige escada, caminhos entre andares, câmera e editor por andar e mudar o formato
  do piso (`tiles` é por x,z) — é praticamente refazer a sala. Decidir com o dono antes de começar.
- **Crítica visual dos móveis da IA** (dono aprovou o custo): depois de montar o escritório, a página tira uma foto 3D
  de cada móvel desenhado pela IA (`R3D.itemShot`) e manda para `POST /api/office/critique`; o servidor chama a IA
  conectada com a imagem (`critiqueFurniture` em `server/furniture.mjs`), que dá nota de 1 a 5 e, abaixo de 4,
  propõe um desenho novo (`pending` no `office.json`). A página renderiza a proposta e manda de novo; ela só entra se a
  nota subir (`scoreFurniture`). No máximo **2 chamadas por móvel, uma vez** (`reviewed`, gravado sem mudar `createdAt`).
  Testado com a IA do dono (OpenAI gpt-5.4-mini, 2026-11-03): nota 2 na mesa fraca; a primeira correção saiu pior
  (por isso a segunda avaliação); em outras rodadas a correção reprovou nas regras e o original ficou. O desenho
  inicial dessa IA também reprova com frequência ("bloco escondido dentro de outro") e cai no plano B.
  **Modelo fixo da crítica (decisão do dono, 2026-11-03): na OpenAI usa sempre `gpt-6.1-sol`** (`CRITIC_MODEL` e
  `critiqueChat` em `server/llm.mjs`; `PIXELHQ_CRITIC_MODEL` troca). Sem troca automática de modelo (ela salvaria o
  modelo da crítica como o da equipe); se falhar, o móvel fica "sem avaliação". Outros provedores usam o modelo da conta.
  Teste real com o Sol: mesa de som nota 1 → desenho novo passou nas regras → nota 4, aprovado.
  Imagens nos provedores: `images: [{mime, data}]` na mensagem (`asResponses`, `asChatCompletions`, `asAnthropic`,
  `asOllama` em `providers.mjs`).

- **Mouse** (dono): esquerdo arrasta = gira (encaixa em 90°), direito ou meio arrasta = move, roda = zoom; clique sem
  arrastar abre a ficha (ao vivo) ou tira a seleção (editor). Arrastar móvel no editor continua igual.
- **Menu** (dono): só o ícone (sem o nome do escritório); "Como os personagens se comportam" e "Ferramentas de
  desenvolvimento" saíram do menu (modo desenvolvedor só com `?dev` no endereço).
- **Alças "+"** ficam fora do contorno da sala na tela (`handles()` empurra cada uma para fora até sair da silhueta).
- **Carregamento**: tela cheia com barra (`#loader`, `loadStep(p, texto)` em `00-base.js`), nada da interface por baixo.
- **Gestos por móvel** (`ACT_POSE` em `cena3d.js`): trabalhar=typing, reunião=talk, kanban=board, TV=watch (braços
  cruzados), ler=read, café/geladeira=drink, cozinha=stir, estoque=lift, loja/recepção=counter, atendimento=care,
  bancada=hammer, impressora=press, servidores=hands, gravação=present, plantas=water, sofá=relax. Os dois kits têm os
  gestos. Braços curtos do Meshy deixam alguns gestos sutis.
- **Divisórias**: rodapé e arremate na alvenaria e na porta de madeira, puxador nas portas. A faixa jateada no vidro
  foi tirada (o dono achou sem sentido).
- **Estilo NPR (cel shading + nanquim)**: sombra em 3 faixas chapadas (`gradientMap`) e traço preto em tudo que não
  é personagem, saído do pós-processamento (`PixelPass` em `cena3d.js`): degrau de profundidade pela 2ª derivada
  (face plana não marca) e dobra de normal. Os móveis saíram da máscara dos personagens (era isso que deixava o
  contorno só em parte deles). `?contornoMoveis=0` desliga o traço.
- **Quinas retas**: móveis e caixas sem chanfro (`BoxGeometry`; o `RoundedBoxGeometry` ficou só no low-poly).
- **Paredes nos 4 lados**: as que ficam entre a câmera e a sala baixam até rodapé (`low = .06`), então girar a vista
  mostra a mesma sala de qualquer lado.
- **Tela por estação**: cada tela da ilha/mesa pertence ao assento mais perto (`b.seat`, `screenKey` em
  `07-animacoes.js`); só acende a de quem está sentado ali.
- **Gênero no editor**: `gender` ('f'/'m') decide os penteados (`HAIR_G`) e a barba (só masculino, porque só os
  modelos masculinos têm barba). Pessoas antigas: o penteado diz o gênero. Criadas pela IA: palpite pelo nome.
- **Tipos de papel**: além de coordena/produz/revisa/pesquisa/entrega, há `atende` (venda, caixa, recepção,
  suporte) e `opera` (estoque, limpeza, manutenção). No executor, produzir aceita produz → opera → atende; entregar
  aceita entrega → atende.
- **Nada em 2D**: enquanto o modelo 3D de alguém baixa, o retrato fica o último 3D da pessoa (ou vazio).
- **Vasos sobre o apoio**: `pot(..., y)` recebe a altura do tampo/prateleira (antes ficavam no chão, com a planta
  solta no ar: balcão de café, mesa de centro, recepção, estante de plantas).

## 12. Limites conhecidos (reais, não promessas)

1. **Raspado** foi refeito (arquivo `menino_raspado_acessorios.glb`, armação sem lentes): fone separado do cabelo,
   olhos visíveis. Resolvido.
2. **Rabo de cavalo** refeito (`menina_rabo3`, armação sem lentes, olhos em peças à parte): sem marca de armação,
   crachá ou fone. Tronco e pernas vieram numa ilha só; `chest: .6` limita a correção do crachá ao peito (sem isso a
   calça ficava da cor da camiseta). O modelo antigo saiu do repositório (está no histórico do git).
3. **Curto e longo:** corrigidos o tronco/braços/virilha roxos (faixa do peito restrita) e o sapato da franja.
   Restam marcas mínimas em close.
4. **"Franja" e "curto"** são modelos diferentes mas parecidos; **rabo** e **coque** são modelos diferentes.
   **Roupas no estilo Meshy:** só existe o **terno** (7 modelos `terno_*.glb`, 2026-11-03); camisa, jaqueta e moletom
   usam o modelo da camiseta. No terno: a cor é a do modelo (cinza nos meninos, marinho nas meninas; "Cor da roupa" e
   "Calça" não mudam nada), o **crachá fica sempre** (a marca pintada no paletó só some com a peça por cima; o
   cacheado veio sem crachá), e no longo cabelo, rosto e corpo são uma peça só (sobra uma marca do fone na lateral do
   cabelo quando a pessoa não usa fone). Cada roupa nova custa ≈23 créditos por penteado (~160 para os 7).
5. **Busca real na internet não foi testada neste ambiente** (o proxy bloqueia o DuckDuckGo); só contra servidor
   falso. O DuckDuckGo HTML pode mudar o formato ou bloquear robôs: se quebrar, `parseDuckDuckGo` em `server/web.mjs`
   ou use `BRAVE_API_KEY`. Sites que só renderizam com JavaScript chegam vazios.
6. Agentes não executam código nem acessam sistemas do usuário (decisão, não limite técnico).
7. Móveis criados pela IA: a crítica visual (seção 11) depende de a IA conectada aceitar imagens. Com modelo sem
   visão (ex.: muitos do Ollama), o móvel fica como foi desenhado. Testada com OpenAI (gpt-5.4-mini e gpt-6.1-sol).
8. Licença dos GLB do Meshy: o dono decidiu tirar da lista de pendências (fica por conta dele).
9. O repositório git **local**; **não há remoto** (GitHub) ainda.
10. O nome "Pixel HQ" colide com um app existente (PixelHQ); o dono decidiu tirar da lista de pendências.

## 13. Pendências, em ordem de prioridade

### A. Com o dono
- [x] **Licença do projeto:** MIT confirmada pelo dono (2026-11-03). Falta só conferir as licenças das dependências.
- [ ] **Remoto git:** o dono vai criar o repositório e passar o endereço; então `git remote add origin ...` e
      `git push -u origin main`.
- [x] Login no Meshy nesta máquina (feito pelo dono).
- (Tirados da lista pelo dono: trocar o nome do projeto e a licença dos modelos 3D do Meshy.)

### B. Produto
- [x] Internet (só leitura) e tarefas em paralelo — `server/web.mjs`, `locks.mjs`, `runner.mjs` (`research`).
- [x] Edição da sala no 3D. Marcas do editor (seleção, área verde/vermelha, pincel, grade, alças "+") em 3D.
- [x] `build:single` com 3D; sala grande (7 a 10 pessoas).
- [x] Regras de qualidade e segundo exemplo para móveis criados pela IA.
- [x] Crítica visual dos móveis da IA (seção 11). Testar com a IA do dono: criar um escritório que peça um móvel novo
      e ver no terminal a linha `[crítica visual] ... nota N`.
- [x] Porta de entrada movível pelo usuário (seção 5).
- [x] Planta em L (seção 11).
- [ ] **Dois andares** — não feito (ver seção 11 o porquê). Decidir com o dono se vale o tamanho do trabalho.
- [ ] **Depois (dono):** testar a busca real (`npm start`, pedir "qual a cotação do dólar hoje?") e ajustar
      `parseDuckDuckGo` se o formato tiver mudado.
- [x] Acabamento das divisórias (rodapé, arremate, faixa jateada, puxadores).
- [x] Gesto próprio para cada móvel que o personagem usa.

### C. Personagens (custam créditos do Meshy)
- [x] Raspado com fone separado e olhos visíveis (23 créditos).
- [x] Rabo de cavalo refeito sem marca de armação (23 créditos, 2026-11-03).
- [x] Terno (masculino nos meninos, feminino nas meninas) nos 7 penteados — `POR_TERNO` em `personagens3d-meshy.js`.
- [ ] Outras roupas (prévias prontas: moletom, camisa social, jaleco; ≈160 créditos cada). Decisão do dono.
- [x] Marcas de tronco/braços nos modelos curto/longo e sapato da franja.

### D. Qualidade e manutenção
- [x] `test/modelos.test.mjs` (ilhas de `acc`/`roles` existem em cada GLB).
- [x] `scripts/reduzir-textura-glb.py`, `scripts/glb-ilhas.mjs`, `scripts/retratos.mjs` + `web/dev/retratos.html`.
- [x] Carregar só os modelos em uso.
- [x] `docs/PROTOCOLO.md` atualizado (paralelismo, `run`, internet).
- [ ] Sobras de estilos antigos fora do git (`web/js3d/personagens3d.js`, `-glb.js`, `-toon.js`,
      `web/modelos/personagem-base.glb`) e a página velha `web/_retrato.html` (substituída por `web/dev/retratos.html`):
      ninguém usa; apagar. Cópia guardada fora do projeto antes.

## 14. Como contribuir sem quebrar (convenções)

- Rode `npm test` antes de entregar; mantenha os testes passando. Adicione teste para comportamento novo.
- Commits em português, mensagem descritiva. Não versionar `.env`, `data/`, `workspace/`, `dist/`, `node_modules/`
  (já no `.gitignore`).
- Não escrever segredos em lugar nenhum; `data/settings.json` fica 0600.
- Mudou um kit de personagem? Renderize antes/depois e compare (frente + 3/4 + dentro da sala).
- Mudou protocolo? Atualize `docs/PROTOCOLO.md`, `server/protocol.mjs` e os testes.
- Mudou o menu/IA? Teste o setup do zero (sem `data/`) e com chave inválida.
- Diga ao dono, em português, o que **não** deu certo e o custo de créditos gasto.

## 15. Estado e pendências (atualize aqui)

- Commits em `main`. Sem remoto.
- `npm test`: 85 testes; 84 passam no Windows (o da permissão 0600 do `settings.json` falha só no Windows, já antes).
- Plantas: o laço principal do `check:layouts` (retangular e em L × 6 e 10 pessoas × estilos × áreas × entrega =
  160 combinações, com a porta conferida) rodou no navegador sem problema. O script inteiro não rodou aqui (sem
  Playwright instalado).
- Saldo Meshy: **230** créditos (conferido em 2026-11-03, depois dos 7 ternos).
- Estilo padrão: Meshy; reserva: low-poly. A sala abre sem precisar de `?estilo=`.
- Próximo passo recomendado: testar a crítica visual com a IA do dono; criar o remoto.

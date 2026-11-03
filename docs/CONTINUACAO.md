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
   **vazia**; os personagens entram pela porta (capacho) quando a tarefa começa e saem ao terminar.
4. **Menu suspenso (canto superior direito):** configurar o ambiente criado, trocar a IA, equipe, regras, modo
   desenvolvedor, visual 3D.

Regras de UX já aprendidas (não regredir):
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
npm test             # 72 testes, todos devem passar
npm run check:layouts   # (opcional, precisa de Playwright) valida 145 combinações de planta (6 e 10 pessoas)
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
  js3d/                 módulos ES (3D) que leem os globais dos scripts acima
  modelos/              GLB dos personagens (Meshy)
  dev/retratos.html     página de retratos dos personagens (usada por scripts/retratos.mjs)
docs/PROTOCOLO.md       protocolo v1 (mensagens servidor↔página)
test/                   node --test
scripts/                build-single (esbuild), check-layouts, retratos.mjs, glb-ilhas.mjs, reduzir-textura-glb.py
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

Arquivo: `web/js3d/personagens3d-meshy.js`. Modelos: `web/modelos/*.glb` (7 arquivos, ~6,9 MB, texturas 1K JPEG).

**Um modelo por penteado** (`POR_PENTEADO`): curto→`menino_curto` (arquivo `menino_acessorios.glb`), franja→
`menino_franja`, longo→`menina_longo`, rabo→`menina_rabo2`, coque→`menina_rabo` (arquivo
`menina_coque_acessorios.glb`), cacheado→`menino_cacheado`, raspado→`menino_raspado`. Os nomes de chave e de
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
smart-topology com textura 2K 15; rig 5. Um modelo completo com referência ≈ 23. Saldo em 2026-11-03: **557**.
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
- Edição da sala no 3D reaproveita o editor 2D (troca só a projeção/acerto), em vez de um editor 3D novo.
- **Internet dos agentes:** só buscar e ler (sem rodar código, sem formulários, sem login) — decidido por segurança
  e custo; ligado por padrão, com botão no menu. Pesquisa só nas etapas `pesquisar` e em perguntas diretas que o
  coordenador marca com `"web": true`.
- **Paralelismo:** 2 tarefas por padrão; trava por agente (uma pessoa nunca está em dois lugares).
- **Sala grande:** uma ala fixa à direita (testada), não uma planta gerada — mantém a garantia de nada encavalado.
- Os estilos antigos (vinil, toon, GLB do Tripo) foram **removidos**; o histórico está no git antigo descartado
  e nos prints entregues ao dono, não no repositório atual.

## 12. Limites conhecidos (reais, não promessas)

1. **Raspado** foi refeito (arquivo `menino_raspado_acessorios.glb`, armação sem lentes): fone separado do cabelo,
   olhos visíveis. Resolvido.
2. **Rabo de cavalo sem óculos:** sobra um contorno claro e fraco da armação na bochecha (só em close). Tentativas
   com `SHADOW`/limiar e removendo as placas das lentes falharam (as lentes carregam os olhos). Só regerando.
3. **Curto e longo:** corrigidos o tronco/braços/virilha roxos (faixa do peito restrita) e o sapato da franja.
   Restam marcas mínimas em close.
4. **"Franja" e "curto"** são modelos diferentes mas parecidos; **rabo** e **coque** são modelos diferentes.
   **Não há variação de roupa** (moletom, paletó): cada roupa nova = um modelo novo por penteado (≈23 créditos cada,
   ~160 para 7 penteados). Não foi feito.
5. **Busca real na internet não foi testada neste ambiente** (o proxy bloqueia o DuckDuckGo); só contra servidor
   falso. O DuckDuckGo HTML pode mudar o formato ou bloquear robôs: se quebrar, `parseDuckDuckGo` em `server/web.mjs`
   ou use `BRAVE_API_KEY`. Sites que só renderizam com JavaScript chegam vazios.
6. Agentes não executam código nem acessam sistemas do usuário (decisão, não limite técnico).
7. Móveis criados pela IA: regras de qualidade novas reduzem os feios, mas não há avaliação **visual** (a IA não vê
   o resultado). Uma próxima etapa seria renderizar o móvel e pedir crítica a um modelo com visão.
8. Licença dos GLB do Meshy **não verificada** para redistribuição; licença do GLB do Tripo idem (já removido).
9. O repositório git **local**; **não há remoto** (GitHub) ainda.
10. O nome "Pixel HQ" **colide** com um app existente (ver seção 13).

## 13. Pendências, em ordem de prioridade

### A. Antes de publicar (dono precisa decidir/fazer)
- [ ] **Trocar o nome do projeto.** Já existe o app [PixelHQ](https://apps.apple.com/app/id6758467298) (mostra
      sessões do Claude Code como escritório em pixel art; instala com `npx pixelhq`). Perguntar o novo nome ao
      dono e substituir em `package.json`, README, CONTRIBUTING, `web/index.html` (título), textos da interface, o
      cabeçalho "Pixel HQ", `localStorage` (`pixelhq.3d`, `pixelhq.*`), variáveis `PIXELHQ_*`, `window.PIXELHQ_BRIDGE`,
      o nome do zip e o protocolo ("Pixel HQ protocol v1"). Mantenha compatibilidade ou documente a quebra.
- [ ] **Licença dos modelos 3D:** conferir os termos do plano do Meshy do dono; se não permitir redistribuir, remover
      `web/modelos/` do repositório (o low-poly assume) e documentar como gerar.
- [ ] **Licença do projeto:** `LICENSE` já existe (MIT). Confirmar com o dono e checar licenças das dependências.
- [ ] **Remoto git:** o dono precisa passar o repositório; então `git remote add origin ...` e `git push -u origin main`.
      O repositório local está correto (raiz em `pixel-hq/`, 70 arquivos).

### B. Produto
- [x] Internet (só leitura) e tarefas em paralelo — `server/web.mjs`, `locks.mjs`, `runner.mjs` (`research`).
- [x] Edição da sala no 3D.
- [x] `build:single` com 3D; sala grande (7 a 10 pessoas).
- [x] Regras de qualidade e segundo exemplo para móveis criados pela IA.
- [ ] Testar a busca real fora deste ambiente (`npm start`, pedir "qual a cotação do dólar hoje?") e ajustar
      `parseDuckDuckGo` se o formato tiver mudado.
- [ ] Crítica visual dos móveis da IA (renderizar + modelo com visão), se o dono quiser o custo extra.
- [ ] Plantas realmente diferentes (formato em L, dois andares) — hoje só pequena e grande.

### C. Personagens (custam créditos do Meshy)
- [x] Raspado com fone separado e olhos visíveis (23 créditos).
- [ ] Rabo de cavalo sem marca de armação: só regerando (≈23), com armação sem lentes como o raspado novo.
- [ ] Variedade de roupa (≈23 por penteado × roupa) — **perguntar ao dono antes**; custo alto.
- [x] Marcas de tronco/braços nos modelos curto/longo e sapato da franja.

### D. Qualidade e manutenção
- [x] `test/modelos.test.mjs` (ilhas de `acc`/`roles` existem em cada GLB).
- [x] `scripts/reduzir-textura-glb.py`, `scripts/glb-ilhas.mjs`, `scripts/retratos.mjs` + `web/dev/retratos.html`.
- [x] Carregar só os modelos em uso.
- [x] `docs/PROTOCOLO.md` atualizado (paralelismo, `run`, internet).

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

- Commits em `main`: inicial, documento de continuação e a entrega dos itens 2, 3 e 4 (2026-11-03). Sem remoto.
- `npm test`: 72 passando. `npm run check:layouts`: 145 combinações válidas.
- Saldo Meshy: 557 créditos (23 gastos no raspado novo).
- Estilo padrão: Meshy; reserva: low-poly. A sala abre sem precisar de `?estilo=`.
- Próximo passo recomendado: **trocar o nome**, **confirmar licenças**, **criar o remoto**, depois **testar a busca
  real** no computador do dono (seção 13.B).

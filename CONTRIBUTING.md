# Como contribuir

Obrigado pelo interesse. Issues e pull requests são bem-vindos, em português ou inglês.

## Preparar

```bash
npm install
```

```bash
npm start
```

```bash
npm test
```

## Mapa da página (`web/js/`)

A página não tem etapa de build: são scripts comuns carregados **na ordem do prefixo numérico**.
Eles compartilham o escopo global, então um arquivo pode usar o que os anteriores declaram.
Código que roda no carregamento (fora de funções) só pode usar o que já foi carregado antes.

| arquivo | assunto |
|---------|---------|
| `00-base.js` | atalhos (`$`), canvas, constantes da grade isométrica, ícones |
| `01-catalogo.js` | móveis, papéis (`ROLES`), estados e regras de comportamento (`RULES`) |
| `02-mundo.js` | o escritório salvo (`W`), desfazer/refazer |
| `03-geometria.js` | projeção isométrica, colisão, caminhos |
| `04-estado-ui.js` | estado da interface |
| `05-desenho.js` | primitivas de desenho (piso, caixas, vidro) |
| `06-personagens.js` | sprites dos personagens, brilhos |
| `07-animacoes.js` | telas, vapor, luzes piscando |
| `08-luz-ambiente.js` | cor do ambiente por horário |
| `09-cena.js` | laço de animação e desenho da cena |
| `10-miniaturas.js` | miniaturas do catálogo |
| `11-planta-acoes.js` | editar a planta |
| `12-sim-navegacao.js` | malha de navegação e início da simulação |
| `13-sim-agentes.js` | evento → decisão → movimento dos agentes |
| `14-fonte-demo.js` | projeto demo simulado |
| `15-fonte-arquivo.js` | reprodução de arquivo de eventos |
| `16-fonte-tempo-real.js` | WebSocket, protocolo, player |
| `17-entrada.js` | mouse, toque e teclado |
| `18-painel.js` | painel do editor |
| `19-rodape-avisos.js` | rodapé, avisos, faixas de contexto |
| `20-toast-gaveta.js` | mensagens rápidas, roteiro de teste |
| `21-ficha.js`, `23-ficha-render.js` | ficha do agente |
| `22-agentes.js` | quem chega pela ponte (sessões do Claude Code) vira uma pessoa da sala |
| `24-quadros.js` | cartões que expandem e retraem |
| `25-configuracao.js` | início com o servidor, "Restaurar a sala padrão" |
| `26-estado.js` | aviso fixo do modo ao vivo: conexão, hooks, sessões abertas e último evento |
| `27-menu.js` | menu do canto superior direito, entrada e saída pela porta, gaveta das sessões |
| `28-tour.js` | tour "Como usar", pelo menu ☰ |
| `../js3d/cena3d.js` | cena 3D (módulo ES, padrão com o servidor): lê os mesmos dados do 2D (`worldBoxes`, `segBoxes`, `animBox`, `peopleDrawables`) e desenha com Three.js |
| `../js3d/personagens3d-meshy.js` | **padrão**: modelos GLB de `web/modelos/` (um por penteado), acessórios por ilha de malha, repintura da textura por pessoa |
| `../js3d/personagens3d-lowpoly.js` | personagens low-poly feitos só em código (reserva quando os modelos não carregam) |
| `99-inicio.js` | inicialização |

Arquivo novo: dê um prefixo que respeite a ordem e adicione o `<script>` no `index.html`.
O teste `web-structure` avisa se esquecer.

## Servidor (`server/`)

| arquivo | assunto |
|---------|---------|
| `start.mjs` | entrada do `npm start`: confere a versão do Node e lê o `.env` |
| `server.mjs` | HTTP (página, `/health`, `/api/hooks/claude`, `/api/hooks/status`), WebSocket (`/events`) |
| `claude-code.mjs` | ponte: cada evento do hook do Claude Code vira um estado na sala |
| `claude-hooks-install.mjs` | instala e remove os hooks à mão no `~/.claude/settings.json`; o status vê também o plugin |

## Plugin do Claude Code (`plugin/` e `.claude-plugin/marketplace.json`)

O repositório é o próprio marketplace (`claude plugin marketplace add efesodavila/Floorwalk`). O plugin fica em `plugin/`,
separado da raiz, para o Claude Code não instalar as dependências do projeto (Three.js) junto: o hook só usa o que vem
com o Node. `plugin/hooks/hooks.json` tem os mesmos eventos de `HOOK_EVENTS` (o teste `instalacao` confere); ao mudar
os eventos, gere o arquivo de novo e suba a versão em `plugin/.claude-plugin/plugin.json` junto com a do `package.json`.
`scripts/claude-hook.mjs` só repassa para `plugin/scripts/claude-hook.mjs` (instalações da v0.1.0 gravaram o caminho antigo).
Para conferir: `claude plugin validate ./plugin` e `claude plugin validate .`.
| `protocol.mjs`, `places.mjs` | formato das mensagens e lugares da sala |
| `pacer.mjs` | segura cada estado alguns segundos, para o personagem ter tempo de andar |

## Móveis

- **Catálogo** (`ITEMS` e `SPOTS` em `01-catalogo.js`): cada móvel é feito de blocos e tem pontos de uso.
- **Visual 3D do móvel:** acrescente um modelo em `MODELS` de `web/js3d/moveis3d.js` (peças no espaço do item, sem
  giro: `box`, `cyl`, `lathe`, `ball`, `rod`, `leaf`, `garment`, `base()` para reaproveitar caixas do catálogo).
  Sem modelo, o item aparece com as caixas do catálogo. `test/moveis3d.test.mjs` confere área e giro.

## Modelo: estados, papéis e tipos

- **Estados** (`RULES` em `01-catalogo.js`) são fixos: cada um leva o personagem a um lugar da sala.
  O ambiente pode renomeá-los em `W.labels` (ex.: `trabalhando` → "Codando").
- **Papéis** são livres e ficam no ambiente (`W.roles`): id, nome, cor e **tipo**.
- **Tipos** (`KINDS`) são fixos: `coordena`, `produz`, `revisa`, `pesquisa`, `entrega`.
  Toda lógica de comportamento usa o tipo, nunca o id ou o nome do papel.
  Use `kindOf(role)` e `roleInfo(role)`.
- Mudou a lista de estados ou tipos? Atualize também `server/protocol.mjs`. O teste `protocol` avisa.
- **Lugares** (`PLACES`) dizem para que serve cada elemento. A ponte do Claude Code escolhe um por ferramenta
  (`server/places.mjs` descreve; `web/js/01-catalogo.js` diz quais elementos servem). As duas listas
  precisam ter as mesmas chaves; o teste `protocol` confere.

## Regras do projeto

- Sem dependências no navegador e sem build para rodar. O único passo de build é o opcional `build:single`
  (esbuild, só em desenvolvimento). Se uma mudança precisar de mais, abra uma issue antes.
- Interface e mensagens em português do Brasil.
- Mudou o formato de eventos? Atualize `docs/PROTOCOLO.md`.
- Rode `npm test` antes de abrir o pull request.

### Novo modelo de personagem (estilo Meshy)

1. Gere o personagem em A-pose, low-poly com peças separadas (*smart topology*), textura chapada e rig humanoide,
   **já com óculos, fone, crachá** (e barba, se fizer sentido). Salve o `.glb` em `web/modelos/`.
2. Em `personagens3d-meshy.js`, adicione uma entrada em `MODELS`: cores de referência da textura (`a`),
   o centro de cada peça de acessório (`acc`) e das peças "de baixo" (`roles`: tronco, rosto, cabelo),
   em alturas do corpo (0 = pé, 1 = topo). Ligue o penteado em `POR_PENTEADO`.
3. Confira as peças com `node scripts/glb-ilhas.mjs web/modelos/<arquivo>.glb` (lista as ilhas) e rode
   `npm test` (`test/modelos.test.mjs` confere que todo ponto de `acc`/`roles` cai numa ilha do arquivo).
4. Tire retratos de cada combinação: `node scripts/retratos.mjs acessorios:<penteado> saida.png` (precisa do
   servidor rodando e do Playwright). Texturas grandes: `python3 scripts/reduzir-textura-glb.py arquivo.glb`.

Visão geral para quem chega agora e lista do que falta: [`docs/CONTINUACAO.md`](docs/CONTINUACAO.md).

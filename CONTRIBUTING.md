# Como contribuir

Obrigado pelo interesse. Issues e pull requests são bem-vindos, em português ou inglês.

## Preparar

```bash
npm install
```

```bash
npm run demo
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
| `22-missoes.js` | campo de tarefa, planos e missões |
| `24-quadros.js` | cartões que expandem e retraem |
| `25-configuracao.js` | tela inicial: escolher a IA, testar a conexão e descrever o serviço |
| `26-montagem.js` | monta a planta a partir da ficha do escritório e confere se ela é válida |
| `27-entregas-menu.js` | painel de resultado da tarefa e menu do canto superior direito |
| `../js3d/cena3d.js` | cena 3D (módulo ES, padrão com o servidor): lê os mesmos dados do 2D (`worldBoxes`, `segBoxes`, `animBox`, `peopleDrawables`) e desenha com Three.js |
| `../js3d/personagens3d-meshy.js` | **padrão**: modelos GLB de `web/modelos/` (um por penteado), acessórios por ilha de malha, repintura da textura por pessoa |
| `../js3d/personagens3d-lowpoly.js` | personagens low-poly feitos só em código (reserva quando os modelos não carregam) |
| `99-inicio.js` | inicialização |

Arquivo novo: dê um prefixo que respeite a ordem e adicione o `<script>` no `index.html`.
O teste `web-structure` avisa se esquecer.

## Servidor (`server/`)

| arquivo | assunto |
|---------|---------|
| `server.mjs` | HTTP (página, `/api/settings`, `/api/settings/web`, `/health`), WebSocket (`/events`), fila e tarefas em paralelo (`PIXELHQ_PARALELO`) |
| `web.mjs` | acesso à internet (só leitura): `search`, `readPage`, bloqueio da rede interna, limites de tempo e tamanho |
| `locks.mjs` | travas por agente: cada pessoa faz uma coisa por vez mesmo com tarefas em paralelo |
| `providers.mjs` | OpenAI, Anthropic e Ollama com a mesma interface: `test()` e `chat()` |
| `settings.mjs` | provedor, modelo e chaves em `data/settings.json` |
| `llm.mjs` | escolhe o modelo testando de verdade e troca sozinho quando o provedor recusa |
| `office.mjs` | pede à IA a ficha do escritório, valida, conserta e guarda em `data/office.json` |
| `protocol.mjs` | formato das mensagens com a página |
| `runner.mjs` | executa a tarefa: plano de quem coordena, passos de cada pessoa, pesquisa na internet (`research`), revisão, resumo e arquivos |
| `pacer.mjs` | segura cada estado alguns segundos, para o personagem ter tempo de andar |

Provedor novo: implemente `test` e `chat` em `providers.mjs` e um teste em `test/providers.test.mjs`
(os testes usam um servidor falso; não precisam de chave).

## Como o escritório é montado

A IA decide só o **conteúdo**: nome, estilo, equipe, papéis e tipos, nomes dos estados, áreas extras
(estúdio, recepção), impressora ou servidor, exemplos de tarefa. O **espaço** sai de `officeWorld()`:
a planta-base testada, com trocas que ocupam o mesmo lugar. Equipe de 7 a 10: a sala ganha uma ala à direita
(`BIG`, `BIG_STARTS` e uma vaga a mais). `officeProblems()` confere sobreposição,
pessoas presas e lugares inalcançáveis. Mudou a planta ou o catálogo de móveis? Rode
`npm run check:layouts` (precisa do Playwright), que testa todas as combinações.

## Móveis

- **Catálogo** (`ITEMS` e `SPOTS` em `01-catalogo.js`): cada móvel é feito de blocos e tem pontos de uso.
  Os móveis que a IA pode pedir para um negócio estão também em `server/furniture.mjs` (`CATALOG`),
  com o lugar a que servem. Precisam ter 1 quadrado de fundo e o lado de uso na frente.
- **Vagas** (`SLOTS` em `26-montagem.js`): onde os móveis extras entram na planta.
- **Móveis criados pela IA**: só quando nada do catálogo serve, no máximo 2 por escritório.
  Regras conferidas em `validateDesign()`: largura de 1 a 3, fundo 1, altura até 2,2, de 3 a 14 blocos,
  só cores da paleta e nada flutuando (todo bloco ligado ao chão por blocos que se tocam). Qualidade: pelo
  menos 2 cores, ocupar ao menos metade da largura escolhida, nenhum bloco escondido dentro de outro.
  Os exemplos do pedido à IA precisam passar nas mesmas regras (um teste confere).
  Falhou duas vezes: plano B com um móvel do catálogo e outro nome.
- Móvel novo no catálogo? Rode `npm test` (confere a ligação servidor ↔ página) e `npm run check:layouts`.

## Modelo: estados, papéis e tipos

- **Estados** (`RULES` em `01-catalogo.js`) são fixos: cada um leva o personagem a um lugar da sala.
  O ambiente pode renomeá-los em `W.labels` (ex.: `trabalhando` → "Codando").
- **Papéis** são livres e ficam no ambiente (`W.roles`): id, nome, cor e **tipo**.
- **Tipos** (`KINDS`) são fixos: `coordena`, `produz`, `revisa`, `pesquisa`, `entrega`.
  Toda lógica de comportamento usa o tipo, nunca o id ou o nome do papel.
  Use `kindOf(role)` e `roleInfo(role)`.
- Mudou a lista de estados ou tipos? Atualize também `server/protocol.mjs`. O teste `protocol` avisa.
- **Lugares** (`PLACES`) dizem para que serve cada elemento. A IA escolhe um por passo da tarefa
  (`server/places.mjs` descreve; `web/js/01-catalogo.js` diz quais elementos servem). As duas listas
  precisam ter as mesmas chaves; o teste `protocol` confere.

## Regras do projeto

- Sem dependências no navegador e sem build para rodar. O único passo de build é o opcional `build:single`
  (esbuild, só em desenvolvimento). Se uma mudança precisar de mais, abra uma issue antes.
- Chaves de API nunca vão para a página nem para o repositório.
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

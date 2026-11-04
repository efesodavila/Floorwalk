# Floorwalk

Um escritório em pixel art onde agentes de IA trabalham à vista.
Você escreve uma tarefa, a equipe divide o trabalho e cada personagem anda até a mesa,
a sala de reunião ou o servidor conforme o que o agente dele está fazendo de verdade.
Clique num personagem para ver a ficha: o que está fazendo, por quê e o que já entregou.

> Estado: protótipo em reestruturação para open source. Veja o [roteiro](#roteiro).

## Rodar

Requer Node 22.9 ou mais novo.

```bash
npm install
```

Sem chave e sem custo (eventos simulados):

```bash
npm run demo
```

Com agentes reais:

```bash
npm start
```

Abra http://127.0.0.1:8787 . Na primeira vez, a página:

1. pergunta qual IA usar (OpenAI, Anthropic ou Ollama) e a chave; o servidor testa os modelos
   da conta e fica sozinho com o primeiro que responde (se um modelo passar a ser recusado,
   ele troca por outro automaticamente). Quem quiser forçar um modelo usa `FLOORWALK_MODEL` no `.env`;
2. pede que você descreva o seu negócio; a IA monta a equipe (3 a 10 pessoas; acima de 6 a sala ganha uma ala), os papéis,
   o estilo e as áreas do escritório, que aparece pronto com o campo de tarefa embaixo.
A chave fica em `data/settings.json`, só no seu computador, legível apenas pelo seu usuário.
Quem preferir pode deixar a chave no `.env` (veja `.env.example`).

Também dá para abrir `web/index.html` direto no navegador (sem servidor: sem agentes reais),
ou gerar um arquivo único com `npm run build:single` (sai em `dist/floorwalk.html`).

## Com o Claude Code

O Floorwalk também mostra as sessões do [Claude Code](https://docs.anthropic.com/en/docs/claude-code) que você já
usa no terminal: cada sessão vira um personagem com o nome da pasta do projeto e vai ao móvel certo conforme o que
está fazendo. Não precisa de chave de IA para isso.

```bash
npm run hooks:install
npm start
```

Na primeira tela, clique em **Ver o Claude Code sem IA**: abre uma sala de dev pronta, sem chave e sem descrever
um negócio (dá para conectar uma IA depois, pelo menu). Abra uma sessão nova do Claude Code. Ela entra pela porta e:

| o Claude Code está… | na sala |
|---------------------|---------|
| editando ou criando arquivos | trabalha no computador |
| lendo, buscando, pesquisando na web | vai à estante |
| rodando testes ou lint | revisando |
| fazendo `git push`, deploy ou publicação | vai ao rack de servidores |
| planejando ou delegando a subagentes | vai ao quadro (ou à mesa de reunião) |
| pedindo permissão | fica bloqueado, com alerta |
| esperando sua resposta | aguardando |
| terminou o turno | comemora |
| sessão encerrada | sai da sala |

- `npm run hooks:install` registra os hooks no `~/.claude/settings.json`. Antes da primeira escrita guarda uma cópia
  (`settings.json.floorwalk.backup`); se o arquivo estiver ilegível ou num formato desconhecido, não mexe em nada. Só
  as entradas do Floorwalk são tocadas: seus hooks e permissões ficam como estão.
- `npm run hooks:status` mostra se está ligado; `npm run hooks:uninstall` tira só as entradas do Floorwalk.
- O hook nunca atrapalha o Claude Code: não escreve nada, sempre sai com sucesso e desiste em menos de 1 s quando o
  servidor está desligado.
- Os eventos só vão para o seu computador (`127.0.0.1`), com uma senha guardada em `~/.floorwalk/hook.json`. O texto
  dos seus pedidos não é lido; comandos aparecem cortados e sem valores que pareçam senha ou chave.
- As sessões não entram no escritório salvo: existem só enquanto a sessão está aberta.

## Visual 3D

Com o servidor, o escritório é desenhado em 3D (Three.js), no estilo pixel art: sombras projetadas,
contornos, brilho e texturas de 16 px. Mouse: **arrastar** move a sala, a **roda** aproxima na direção
do cursor e o **botão direito** (ou Shift + arrastar) gira a vista, que encaixa no ângulo isométrico
ao soltar. Clique numa pessoa para abrir a ficha.

Os personagens também são 3D: modelos low-poly gerados no [Meshy](https://www.meshy.ai) (pasta
`web/modelos/`), um por penteado — curto, cabelo longo, coque, cacheado e raspado —, todos com rig
humanoide. Cada modelo foi gerado **com** óculos, fone, crachá (e barba, nos meninos); o código esconde o que
a pessoa não usa e repinta a textura com as cores dela (pele, cabelo, camiseta, calça, tênis). Sombreado
chapado em dois tons e contorno preto fino. Poses pelo que estão fazendo: andar, sentar e digitar,
conversar, olhar o quadro, ler, trabalho manual, acenar ao concluir e mão na cabeça quando bloqueados.

- `?estilo=lowpoly` mostra os personagens feitos só em código (sem arquivos de modelo).
  Se os modelos não carregarem, a sala usa o low-poly sozinha.
- **Licença dos modelos:** foram gerados num plano do Meshy; confira os termos do seu plano antes de
  redistribuí-los. Quem preferir não depender deles pode apagar `web/modelos/` — o low-poly assume.

- O visual é sempre 3D (sala, editor e miniaturas). Só sem WebGL a página volta sozinha para o desenho 2D
  (`?2d` força o 2D, para testes). Enquanto o 3D carrega, aparece "Carregando o escritório…" — o 2D não pisca.
- A equipe entra e sai por uma porta dupla de vidro na parede, junto do capacho, que abre quando alguém passa.
- Os móveis são modelos low-poly facetados com contorno preto, no mesmo estilo dos personagens
  (`web/js3d/moveis3d.js`).
- Padrão: modo nítido, na resolução real da tela (até 2×), com bordas suavizadas (SMAA) e sombras suaves.
  `?px=3` volta ao visual pixel art (serrilhado de propósito, mais leve); `?2d` força o desenho 2D.
- A edição da sala (menu → editar) funciona no 3D: arrastar, colocar, girar e desenhar paredes.
- O arquivo único (`build:single`) inclui o 3D e os modelos (~10 MB). `--sem-modelos` gera ~1 MB com os
  personagens low-poly; `--sem-3d` gera só o 2D.

## Como funciona

```
navegador (web/)  ──tarefa──▶  servidor (server/)  ──▶  agentes de IA
      ▲                              │
      └────────── eventos ◀──────────┘  (o que cada agente está fazendo)
```

- A chave do provedor fica **só no servidor**; a página nunca a recebe de volta.
- Ao delegar uma tarefa, quem coordena divide o trabalho; cada pessoa faz a sua parte
  (pesquisar, produzir, revisar, entregar) com o material das anteriores; uma revisão
  reprovada volta para correção. Perguntas simples são respondidas direto por quem coordena.
- Cada passo acontece no lugar certo da sala: gravar no estúdio, analisar números diante da TV,
  escrever no computador, atender na recepção, examinar na maca, cozinhar no fogão.
- Ao montar o escritório, a IA escolhe móveis do catálogo para o negócio (maca, fogão, caixa,
  estoque, bancada…) e, se nada servir, desenha até 2 móveis novos dentro das regras do projeto.
- Cada entrega aparece na tela (painel de resultado e ficha da pessoa) e é salva em
  `workspace/entregas/<data>-<tarefa>/`, um arquivo `.md` por pessoa e um `resultado.md`.
- Funciona igual com OpenAI, Anthropic ou Ollama. O menu no canto superior direito troca a IA,
  remonta o escritório, abre a edição da sala e liga as ferramentas de desenvolvimento.
- O servidor traduz o que os agentes fazem em eventos do [protocolo Floorwalk](docs/PROTOCOLO.md).
  Qualquer sistema de agentes pode falar esse protocolo.
- Os arquivos que os agentes criam ficam em `workspace/projeto/`.
- **Pesquisa na internet:** na etapa de pesquisa (ou numa pergunta que depende de dado atual), a IA
  propõe até 3 buscas, a equipe lê até 4 páginas e cita as fontes ([1], [2]… e "Fontes:" no fim).
  Só leitura: os agentes não executam código nem enviam dados. Endereços da rede interna são
  bloqueados. Busca pelo DuckDuckGo (sem chave) ou pela Brave Search API se houver `BRAVE_API_KEY`.
  Menu → **Pesquisa na internet** liga e desliga; `FLOORWALK_WEB=0` desliga no servidor.
- **Tarefas em paralelo:** até 2 ao mesmo tempo (`FLOORWALK_PARALELO`). Cada pessoa faz uma coisa por
  vez; se duas tarefas precisam da mesma pessoa, uma espera a outra.

## Estrutura

| pasta | o que tem |
|-------|-----------|
| `web/` | a página: `index.html`, `css/app.css` e `js/` (um arquivo por assunto) |
| `server/` | servidor HTTP + WebSocket, equipe de agentes e protocolo |
| `docs/` | protocolo de eventos |
| `test/` | testes (`npm test`), sem chamar nenhuma IA |
| `scripts/` | arquivo único, conferência das plantas, retratos dos personagens, ilhas dos modelos, redução de textura |

## Roteiro

1. ~~Dividir o arquivo único em módulos e adotar licença MIT~~
2. ~~Papéis e ações genéricos, para qualquer tipo de serviço~~
3. ~~Tela inicial: escolher o LLM (OpenAI, Anthropic, Ollama) e testar a conexão~~
4. ~~O LLM monta a equipe e as áreas do escritório a partir da descrição do serviço~~
5. ~~Tarefas viram entregas reais; menu de configurações no canto superior direito~~

## Limites conhecidos

- **Internet só para ler.** Os agentes buscam e leem páginas, mas não acessam seus sistemas, não
  executam código e não preenchem formulários. Sites que exigem JavaScript ou login não são lidos.
  O DuckDuckGo pode limitar ou bloquear buscas automáticas; com `BRAVE_API_KEY` é mais estável.
- **Até 2 tarefas ao mesmo tempo** (fila de até 5). Dentro de cada tarefa os passos são sequenciais.
- **Custo.** Cada tarefa faz de 3 a 8 chamadas ao modelo (plano, até 6 passos, uma correção e o
  fechamento). Acompanhe o uso no painel do provedor.
- **Qualidade.** Depende do modelo escolhido. Modelos pequenos do Ollama erram mais o formato do
  plano; nesse caso o sistema usa um plano padrão (produzir e revisar).
- **Um escritório por servidor**, com até 10 pessoas e duas plantas (até 6 pessoas e 6 vagas para móveis extras; de 7 a 10, sala maior com 7 vagas).
- **Móveis criados pela IA** seguem regras de forma e cor, mas podem sair simples ou estranhos;
  quando não passam nas regras (forma, cor, pelo menos 2 cores, largura ocupada, nada escondido),
  viram um móvel do catálogo com outro nome.

## Contribuir

Veja [CONTRIBUTING.md](CONTRIBUTING.md).

## Licença

[MIT](LICENSE)

## Continuar o desenvolvimento

Leia [`docs/CONTINUACAO.md`](docs/CONTINUACAO.md): arquitetura, decisões de produto, como funcionam os personagens 3D, como usar o Meshy, limites conhecidos e a lista de pendências em ordem de prioridade.

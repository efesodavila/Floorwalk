# Pixel HQ

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
   ele troca por outro automaticamente). Quem quiser forçar um modelo usa `PIXELHQ_MODEL` no `.env`;
2. pede que você descreva o seu negócio; a IA monta a equipe (3 a 6 pessoas), os papéis,
   o estilo e as áreas do escritório, que aparece pronto com o campo de tarefa embaixo.
A chave fica em `data/settings.json`, só no seu computador, legível apenas pelo seu usuário.
Quem preferir pode deixar a chave no `.env` (veja `.env.example`).

Também dá para abrir `web/index.html` direto no navegador (sem servidor: sem agentes reais),
ou gerar um arquivo único com `npm run build:single` (sai em `dist/pixel-hq.html`).

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

- Sem WebGL, a página volta sozinha para o desenho 2D. Menu → **Visual 3D** desliga e liga.
- Padrão: modo nítido, na resolução real da tela (até 2×), com bordas suavizadas (SMAA) e sombras suaves.
  `?px=3` volta ao visual pixel art (serrilhado de propósito, mais leve); `?2d` força o desenho 2D.
- A edição da sala ainda usa o desenho 2D. O arquivo único (`build:single`) não inclui o 3D.

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
- O servidor traduz o que os agentes fazem em eventos do [protocolo Pixel HQ](docs/PROTOCOLO.md).
  Qualquer sistema de agentes pode falar esse protocolo.
- Os arquivos que os agentes criam ficam em `workspace/projeto/`.

## Estrutura

| pasta | o que tem |
|-------|-----------|
| `web/` | a página: `index.html`, `css/app.css` e `js/` (um arquivo por assunto) |
| `server/` | servidor HTTP + WebSocket, equipe de agentes e protocolo |
| `docs/` | protocolo de eventos |
| `test/` | testes (`npm test`), sem chamar nenhuma IA |
| `scripts/` | gerador do arquivo único |

## Roteiro

1. ~~Dividir o arquivo único em módulos e adotar licença MIT~~
2. ~~Papéis e ações genéricos, para qualquer tipo de serviço~~
3. ~~Tela inicial: escolher o LLM (OpenAI, Anthropic, Ollama) e testar a conexão~~
4. ~~O LLM monta a equipe e as áreas do escritório a partir da descrição do serviço~~
5. ~~Tarefas viram entregas reais; menu de configurações no canto superior direito~~

## Limites conhecidos

- **Os agentes não acessam a internet nem seus sistemas.** Eles trabalham com o que o modelo sabe
  e com o material da própria equipe. A pesquisa marca o que precisa ser confirmado.
- **Uma tarefa por vez, uma pessoa por vez.** As tarefas entram em fila (até 5) e os passos são
  sequenciais. O escritório mostra isso fielmente.
- **Custo.** Cada tarefa faz de 3 a 8 chamadas ao modelo (plano, até 6 passos, uma correção e o
  fechamento). Acompanhe o uso no painel do provedor.
- **Qualidade.** Depende do modelo escolhido. Modelos pequenos do Ollama erram mais o formato do
  plano; nesse caso o sistema usa um plano padrão (produzir e revisar).
- **Um escritório por servidor**, com até 6 pessoas e uma planta base com 6 vagas para móveis extras.
- **Móveis criados pela IA** seguem regras de forma e cor, mas podem sair simples ou estranhos;
  quando não passam nas regras, viram um móvel do catálogo com outro nome.

## Contribuir

Veja [CONTRIBUTING.md](CONTRIBUTING.md).

## Licença

[MIT](LICENSE)

## Continuar o desenvolvimento

Leia [`docs/CONTINUACAO.md`](docs/CONTINUACAO.md): arquitetura, decisões de produto, como funcionam os personagens 3D, como usar o Meshy, limites conhecidos e a lista de pendências em ordem de prioridade.

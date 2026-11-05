# Regras do Floorwalk

O que **precisa ser verdade** no Floorwalk, em frases que dá para conferir. É a referência da revisão de ponta a
ponta: cada regra diz onde vive no código e como provar. Uma revisão compara o código com esta lista e aponta cada
divergência.

Fontes: decisões do dono em [`CONTINUACAO.md`](CONTINUACAO.md) (seções 1, 2, 11 e 15), o
[protocolo](PROTOCOLO.md) e as promessas do [README](../README.md). Quando uma decisão nova for tomada, ela entra aqui.

**Prova hoje:**
✅ teste automático (`npm test`, roda também no GitHub em Linux, Windows e Mac) ·
🔎 só conferido à mão, no navegador ·
❌ sem prova ainda ·
⚠️ divergência conhecida entre a regra e o código ou os testes

---

## A. Segurança e privacidade

| # | Regra | Onde | Prova hoje |
|---|-------|------|------------|
| A1 | A chave da IA nunca volta para a página (só os 4 últimos caracteres, para a pessoa reconhecer qual é), e a chave guardada só vai para o endereço do provedor que já estava salvo: endereço novo exige a chave digitada no mesmo pedido. | `server/settings.mjs` (`publicView`), `server/server.mjs` (`cfgFor`) | ✅ `providers.test.mjs`, `seguranca.test.mjs` |
| A2 | `data/settings.json` só pode ser lido pelo dono (modo 0600). No Windows quem protege é a permissão da pasta. | `server/settings.mjs` | ✅ fora do Windows; ❌ no Windows |
| A3 | Rota que muda alguma coisa (`POST /api/*`) só aceita pedido da própria página (mesma origem). Todo pedido, de qualquer rota, só é atendido se o endereço usado for o do próprio computador (`localhost`, IP) ou um nome listado em `FLOORWALK_ALLOWED_HOSTS`: barra o "DNS rebinding". | `server/server.mjs` (`sameOrigin`, `hostOk`) | ✅ `providers.test.mjs`, `seguranca.test.mjs` |
| A4 | O WebSocket `/events` só aceita conexão da própria página: outro site aberto no navegador não manda tarefa nem gasta a chave. | `server/server.mjs` (`upgrade`) | ✅ `seguranca.test.mjs` |
| A5 | O servidor escuta só em `127.0.0.1`, a não ser que `HOST` diga outra coisa; com outro `HOST`, avisa no terminal que ficou aberto para a rede. | `server/server.mjs` | ✅ `seguranca.test.mjs` (endereço padrão) |
| A6 | A rota dos hooks (`POST /api/hooks/claude`) exige a senha de `~/.floorwalk/hook.json`. Sem ela: 403. | `server/server.mjs` (`hookAuth`) | ✅ "sem a senha, é recusado" |
| A7 | Arquivos estáticos nunca saem da pasta `web/`; o Three.js só sai de `build/` e `examples/jsm/`. Nenhum pedido derruba o servidor: endereço malformado recebe 400. | `server/server.mjs` (`handle`) | ✅ `providers.test.mjs`, `seguranca.test.mjs` |
| A8 | Internet dos agentes é só leitura (buscar e ler páginas); endereços da rede interna e protocolos estranhos são recusados. | `server/web.mjs` (`checkURL`) | ✅ `web.test.mjs` ⚠️ ver nota abaixo |
| A9 | O repositório não contém segredos, dados do usuário (`data/`, `workspace/`, `.env`) nem e-mail pessoal nos commits. | `.gitignore`, histórico do git | 🔎 conferido antes do primeiro envio |

**Revisão da camada A (2026-11-04):** quatro regras falhavam e foram corrigidas, com teste: um site qualquer conseguia se
passar pelo endereço do Floorwalk (DNS rebinding) e mandar a chave guardada para um servidor dele (A1, A3); o WebSocket
aceitava esse site (A4); um endereço malformado derrubava o servidor (A7). Ficam em aberto: A2 no Windows (depende da
permissão da pasta); A8 confere o IP antes de baixar, mas o download resolve o nome de novo (um site pode trocar o IP
entre as duas consultas) e, atrás de proxy, a checagem fica só pelo nome.

## B. Ponte com o Claude Code

| # | Regra | Onde | Prova hoje |
|---|-------|------|------------|
| B1 | O hook nunca atrapalha o Claude Code: não escreve nada na saída, sempre sai com código 0 e desiste rápido (menos de 1,5 s) quando o servidor está desligado. | `scripts/claude-hook.mjs` | ✅ "de ponta a ponta" |
| B2 | O instalador não mexe em `~/.claude/settings.json` ilegível ou com formato que não conhece. | `server/claude-hooks-install.mjs` | ✅ "aborta sem tocar em nada" |
| B3 | Antes da primeira escrita, guarda uma cópia do original e nunca a sobrescreve. A cópia feita com o nome antigo (`.pixel-hq.backup`) também vale como original. | idem | ✅ |
| B4 | Só mexe nas próprias entradas: hooks do usuário e de outras ferramentas ficam iguais, e desinstalar devolve o arquivo como era. Se o `settings.json` for um atalho (dotfiles), continua atalho: a gravação vai para o arquivo de verdade. | idem (`isOurs`, `writeSettings`) | ✅ (o do atalho roda no Linux e no Mac) |
| B5 | Reinstalar não duplica entradas; entradas antigas (`--pixel-hq`) são trocadas pelas novas. | idem | ✅ |
| B6 | O texto do pedido do usuário nunca é lido nem repassado. O hook só manda ao servidor os campos que a sala usa: o pedido, o conteúdo de arquivos e as respostas das ferramentas não saem do Claude Code. | `scripts/claude-hook.mjs`, `server/claude-code.mjs` | ✅ `ponte.test.mjs` |
| B7 | Comandos aparecem cortados e sem nada que pareça senha, chave ou token, em qualquer forma comum: `X=valor`, `--password valor`, `-u usuário:senha`, `postgres://usuário:senha@…`, cabeçalhos e cookies. | `server/claude-code.mjs` (`redact`) | ✅ `ponte.test.mjs` |
| B8 | Cada ferramenta leva ao lugar certo: editar → computador; ler, buscar, web → estante; testes → revisando; `git push`/deploy → rack; planejar/delegar → quadro; permissão → bloqueado; pergunta ao usuário → aguardando; fim do turno → concluído. Só conta o comando que roda: `cat deploy.md` ou `git commit -m "test"` não é deploy nem teste. | `server/claude-code.mjs` (`toolAction`) | ✅ `ponte.test.mjs` |
| B9 | Cada sessão vira um personagem com o nome da pasta do projeto; duas sessões na mesma pasta viram "nome" e "nome 2". | idem (`nameFor`) | ✅ |
| B10 | O primeiro evento de uma sessão nunca se perde: a página sabe quem é a pessoa antes de receber o estado dela. | `server/server.mjs` (`team` antes do `state`) | ✅ `ponte.test.mjs` (ordem) |
| B11 | Sessão encerrada, ou sem nenhum evento há 1 hora, sai da sala e da lista. | `claude-code.mjs` (`sweep`), `16-fonte-tempo-real.js` (`a.gone`) | ✅ servidor; 🔎 página |
| B12 | Recarregar a página não apaga o histórico: o servidor reenvia os últimos 40 estados de cada personagem, só para a ficha (ninguém anda). Sessão encerrada não é reenviada, e sessão nova com o mesmo nome começa com a ficha vazia. | `server/server.mjs` (`history`, `replay`, `endedSessions`) | ✅ servidor (`ponte.test.mjs`); 🔎 página |
| B13 | Caminho de arquivo do Windows num servidor Linux ou Mac vira só o nome do arquivo. | `claude-code.mjs` (`base`) | ✅ (no GitHub) |

**Revisão da camada B (2026-11-05):** cinco regras falhavam e foram corrigidas, com teste: o hook mandava ao servidor o
texto do pedido e o conteúdo inteiro dos arquivos (B6); `--password x`, `-u usuário:senha` e senha dentro de endereço
apareciam na tela (B7); `cat deploy.md` virava deploy e `git commit -m "test"` virava teste (B8); um `settings.json` que
era atalho virava arquivo comum (B4); a cada recarga, sessões já encerradas voltavam como "agente desconhecido", e uma
sessão nova na mesma pasta herdava a ficha da anterior (B12). Ficam em aberto: depois que você aprova uma permissão, o
personagem continua "bloqueado" até o próximo evento (o Claude Code não avisa quando a permissão é dada); o hook só
procura o servidor em `127.0.0.1` (com `HOST` apontando para outro endereço, os eventos não chegam).

## C. Página: sala, sessões e ficha

| # | Regra | Onde | Prova hoje |
|---|-------|------|------------|
| C1 | A equipe de IA vem **desligada**: sem campo de tarefa, sem tela de conectar IA, sem descrever negócio. Liga e desliga pelo menu; a chave e o negócio ficam guardados. | `02-mundo.js` (`aiTeamOn`), `25-configuracao.js` | 🔎 conferido (2026-11-05) |
| C2 | Com a equipe desligada, a primeira visita abre a sala de dev pronta, e o negócio salvo no servidor não toma a sala: nem a sala, nem a equipe dele (que entra só com a equipe ligada). | `02-mundo.js` (`tplClaude`), `25-configuracao.js` (`setupInit`), `16-fonte-tempo-real.js` (`team`) | 🔎 conferido (2026-11-05) |
| C3 | Sessões do Claude Code nunca entram no escritório salvo no navegador: nem a pessoa, nem o cargo "Claude Code". | `02-mundo.js` (`save`) | 🔎 conferido (2026-11-05) |
| C4 | A sessão aberta fica na sala; só sai quando termina, e então sai mesmo com o modo desenvolvedor ligado ou com uma tarefa da equipe de IA em andamento. | `27-entregas-menu.js`, `16-fonte-tempo-real.js` | 🔎 conferido (2026-11-05) |
| C5 | A gaveta Equipe separa as sessões do Claude Code da equipe do negócio; com a equipe desligada (ou sem tarefa delegada), a equipe do negócio fica recolhida. Cada um aparece com a foto do próprio personagem 3D. | `27-entregas-menu.js` (`renderTeamDrawer`) | 🔎 conferido (2026-11-05) |
| C6 | Clicar num personagem abre a ficha com o que ele está fazendo agora, onde, o tempo em cada atividade e o histórico com hora. Vale para todos, não só no modo desenvolvedor. Para sessões do Claude Code, o tempo é o do relógio de verdade: conta com a aba em segundo plano e continua depois de recarregar. | `23-ficha-render.js` (`wallTimes`), `13-sim-agentes.js` (`sinceAt`) | 🔎 conferido (2026-11-05) |
| C7 | "Limpar a sala" (equipe desligada) troca só a sala deste navegador pela sala de dev; nada é apagado no servidor. | `27-entregas-menu.js` (`m-reset`) | 🔎 conferido (2026-11-05) |
| C8 | Nenhum `confirm`, `alert` ou `prompt` do navegador. Toda ação que apaga ou troca algo pede confirmação na janela própria, com o foco começando em "Cancelar". | `20-toast-gaveta.js` (`askConfirm`) | ✅ `pagina.test.mjs` (nenhum nativo); 🔎 foco e Esc conferidos |
| C9 | No menu, a linha separadora só aparece entre grupos com item visível. | `27-entregas-menu.js` (`tidyMenuLines`) | 🔎 conferido (2026-11-05) |
| C10 | A experiência normal é toda em 3D: o 2D só aparece sozinho sem WebGL (ou com `?2d`) e nunca pisca antes do 3D ao abrir. | `00-base.js`, `js3d/cena3d.js` | 🔎 conferido no código (2026-11-05) |

**Revisão da camada C (2026-11-05):** cinco regras falhavam e foram corrigidas, conferidas no navegador antes e depois:
com a equipe desligada, a equipe do negócio salva no servidor entrava na sala de dev e ficava salva nela (C2, a origem
dos "personagens que nunca são usados"); o cargo "Claude Code" ficava salvo no escritório (C3); com o modo
desenvolvedor ligado, uma sessão encerrada ficava no sofá para sempre (C4); a foto na gaveta Equipe e na ficha ficava em
branco até o próximo evento da sessão (C5, C6); e a ficha contava o tempo pelo relógio da simulação, que para com a aba
em segundo plano: uma sessão editando havia 85 s aparecia "há 18s" (C6). A C8 virou teste automático. Fica em aberto:
se o próprio arquivo do 3D não carregar (erro de rede ou de sintaxe), a tela fica no "carregando" sem cair para o 2D (C10).

## D. Editor da sala

| # | Regra | Onde | Prova hoje |
|---|-------|------|------------|
| D1 | A sala tem exatamente uma porta de entrada, encostada numa parede externa (esquerda ou fundo), com piso livre na frente. Ela não pode ser apagada, e nenhuma parede pode passar por cima dela nem trancá-la (na linha da parede dela ou colada na frente); num salvo antigo trancado, a porta muda de lugar sozinha. | `03-geometria.js` (`doorFits`, `wallBlocksDoor`, `fixDoor`), `17-entrada.js` | ✅ `sala.test.mjs` |
| D2 | Móvel não fica fora do piso nem em cima de outro móvel ou parede; girar não pode fazê-lo sair do piso; a borracha de piso, como diminuir a sala, não apaga o chão embaixo de móvel, da porta ou de parede. | `03-geometria.js` (`footprintOk`, `tileRemovable`), `17-entrada.js` | ✅ `sala.test.mjs` |
| D3 | A sala que o dono montou nunca é refeita sozinha. Ligar e desligar a equipe de IA não perde sala: cada modo guarda a sua e ela volta quando se volta ao modo. | `25-configuracao.js` (`setupInit`, `switchAiTeam`) | 🔎 conferido (2026-11-05) |
| D4 | Todo móvel do catálogo tem modelo 3D, com geometria dentro da área dele. | `js3d/moveis3d.js` | ✅ `moveis3d.test.mjs` |

**Revisão da camada D (2026-11-05):** três regras falhavam e foram corrigidas: dava para desenhar uma parede por cima
da porta de entrada ou colada na frente dela, trancando a passagem, porque a porta é um item "chato" no chão e a
checagem de parede ignora esses itens (D1); a borracha de piso apagava o chão embaixo de móveis, da porta e de paredes,
o que diminuir a sala pela borda já recusava (D2); e ligar a equipe de IA trocava a sala que você montou pelo escritório
do negócio, e desligar a trocava pela sala de dev pronta, sem volta e sem aviso (D3). D1 e D2 viraram testes
automáticos; D3 foi conferida no navegador nos dois sentidos. Fica como está, por ser de propósito: tapete e outros
itens chatos podem ficar embaixo de móveis.

## E. Equipe de IA (opcional)

| # | Regra | Onde | Prova hoje |
|---|-------|------|------------|
| E1 | O usuário não escolhe o modelo: o servidor testa e fica com um que responde, e troca sozinho se ele passar a ser recusado. | `server/llm.mjs` | ✅ `llm.test.mjs` |
| E2 | Pergunta simples é respondida direto por quem coordena, sem chamar a equipe. | `server/runner.mjs` | ✅ |
| E3 | Revisão reprovada volta para quem produziu; ninguém fica "bloqueado" à toa. | idem | ✅ |
| E4 | Cancelar a tarefa para de chamar a IA. | idem | ✅ |
| E5 | Cada pessoa faz uma coisa por vez; até 2 tarefas ao mesmo tempo, fila de até 5. | `server/locks.mjs`, `server.mjs` | ✅ travas; ❌ limite da fila |
| E6 | Cada entrega é salva em `workspace/entregas/<data>-<tarefa>/`, um arquivo por pessoa e um `resultado.md`. | `server/runner.mjs` | ✅ "salva os arquivos" |
| E7 | Cada passo acontece no móvel certo para aquilo (computador para produzir, quadro para planejar…). | `server/places.mjs`, `runner.mjs` | ✅ |
| E8 | Móvel criado pela IA que não passa nas regras vira um móvel do catálogo. | `server/furniture.mjs` | ✅ |
| E9 | Crítica visual de móvel da IA: no máximo 2 chamadas por móvel, uma vez só; na OpenAI usa sempre `gpt-6.1-sol`. | `server/furniture.mjs`, `llm.mjs` | ✅ modelo; ❌ limite de chamadas |
| E10 | A IA **não monta o cenário**: cria equipe, papéis, rótulos e móveis novos que faltam; quem monta a sala é o dono. | `server/office.mjs`, `26-montagem.js` | ⚠️ `office.test.mjs` ainda testa "móveis escolhidos pela IA" e "piso, cor da parede e salas fechadas escolhidos pela IA" |

## F. Idioma

| # | Regra | Onde | Prova hoje |
|---|-------|------|------------|
| F1 | A interface segue o idioma do navegador (português ou inglês) e troca pelo menu. | `web/js/01-idioma.js` | ✅ parcial |
| F2 | Em português, nada muda. | idem | ✅ |
| F3 | Todo detalhe que o servidor manda das sessões do Claude Code tem tradução. | idem (`EN_RE`) | ✅ |
| F4 | Nomes de pessoas, arquivos e comandos nunca são traduzidos. | idem | ✅ parcial |

## G. Protocolo

| # | Regra | Onde | Prova hoje |
|---|-------|------|------------|
| G1 | Estados, tipos de papel e lugares são os mesmos no servidor e na página. | `server/protocol.mjs`, `01-catalogo.js` | ✅ |
| G2 | Estado desconhecido é recusado; nomes antigos e em inglês são aceitos (`codando`, `working`, `done`…). | idem | ✅ parcial |
| G3 | Cada estado fica na tela pelo menos `MIN_DWELL_MS` (3,5 s) para o personagem chegar ao lugar; estado repetido só atualiza o texto. | `server/pacer.mjs` | ❌ |
| G4 | Os nomes antigos do projeto continuam valendo: `PIXELHQ_*`, `--pixel-hq`, `~/.pixel-hq`, chaves `pixelhq.*` do navegador, `window.pixelHQ`. | `server/env.mjs`, instalador, `00-base.js` | ✅ variáveis e hooks; 🔎 navegador |

---

## Resumo

| | Regras |
|---|---|
| Total | 54 |
| ✅ Com teste automático (inclui parciais) | 42 |
| 🔎 Só conferidas à mão | 11, quase todas da página (C e D), onde não há teste de interface |
| ❌ Sem prova | 1 (G3), mais partes de A2, E5 e E9 |
| ⚠️ Divergência conhecida | 2 (E10; A8 parcial) |

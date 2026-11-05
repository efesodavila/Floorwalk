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
| A1 | A chave da IA nunca volta para a página: nenhuma resposta da API e nenhuma mensagem do WebSocket a contém. | `server/settings.mjs` (`publicView`), `server/server.mjs` | ✅ `providers.test.mjs` "nunca devolve a chave" |
| A2 | `data/settings.json` só pode ser lido pelo dono (modo 0600). No Windows quem protege é a permissão da pasta. | `server/settings.mjs` | ✅ fora do Windows; ❌ no Windows |
| A3 | Rota que muda alguma coisa (`POST /api/*`) só aceita pedido da própria página (mesma origem). | `server/server.mjs` (`sameOrigin`) | ✅ "recusa pedidos de outro site" |
| A4 | O WebSocket `/events` só aceita conexão da própria página: outro site aberto no navegador não manda tarefa nem gasta a chave. | `server/server.mjs` (`upgrade`) | ❌ |
| A5 | O servidor escuta só em `127.0.0.1`, a não ser que `HOST` diga outra coisa. | `server/server.mjs` | ❌ |
| A6 | A rota dos hooks (`POST /api/hooks/claude`) exige a senha de `~/.floorwalk/hook.json`. Sem ela: 403. | `server/server.mjs` (`hookAuth`) | ✅ "sem a senha, é recusado" |
| A7 | Arquivos estáticos nunca saem da pasta `web/`; o Three.js só sai de `build/` e `examples/jsm/`. | `server/server.mjs` | ✅ Three.js; ❌ pasta `web/` |
| A8 | Internet dos agentes é só leitura (buscar e ler páginas); endereços da rede interna e protocolos estranhos são recusados. | `server/web.mjs` (`checkURL`) | ✅ `web.test.mjs` |
| A9 | O repositório não contém segredos, dados do usuário (`data/`, `workspace/`, `.env`) nem e-mail pessoal nos commits. | `.gitignore`, histórico do git | 🔎 conferido antes do primeiro envio |

## B. Ponte com o Claude Code

| # | Regra | Onde | Prova hoje |
|---|-------|------|------------|
| B1 | O hook nunca atrapalha o Claude Code: não escreve nada na saída, sempre sai com código 0 e desiste rápido (menos de 1,5 s) quando o servidor está desligado. | `scripts/claude-hook.mjs` | ✅ "de ponta a ponta" |
| B2 | O instalador não mexe em `~/.claude/settings.json` ilegível ou com formato que não conhece. | `server/claude-hooks-install.mjs` | ✅ "aborta sem tocar em nada" |
| B3 | Antes da primeira escrita, guarda uma cópia do original e nunca a sobrescreve. A cópia feita com o nome antigo (`.pixel-hq.backup`) também vale como original. | idem | ✅ |
| B4 | Só mexe nas próprias entradas: hooks do usuário e de outras ferramentas ficam iguais, e desinstalar devolve o arquivo como era. | idem (`isOurs`) | ✅ |
| B5 | Reinstalar não duplica entradas; entradas antigas (`--pixel-hq`) são trocadas pelas novas. | idem | ✅ |
| B6 | O texto do pedido do usuário nunca é lido nem repassado. | `server/claude-code.mjs` | ✅ |
| B7 | Comandos aparecem cortados e sem nada que pareça senha, chave ou token. | idem (`redact`) | ✅ |
| B8 | Cada ferramenta leva ao lugar certo: editar → computador; ler, buscar, web → estante; testes → revisando; `git push`/deploy → rack; planejar/delegar → quadro; permissão → bloqueado; pergunta ao usuário → aguardando; fim do turno → concluído. | idem (`toolAction`) | ✅ |
| B9 | Cada sessão vira um personagem com o nome da pasta do projeto; duas sessões na mesma pasta viram "nome" e "nome 2". | idem (`nameFor`) | ✅ |
| B10 | O primeiro evento de uma sessão nunca se perde: a página sabe quem é a pessoa antes de receber o estado dela. | `server/server.mjs` (`team` antes do `state`) | ✅ parcial (o teste de ponta a ponta confere que os dois chegam) |
| B11 | Sessão encerrada, ou sem nenhum evento há 1 hora, sai da sala e da lista. | `claude-code.mjs` (`sweep`), `16-fonte-tempo-real.js` (`a.gone`) | ✅ servidor; 🔎 página |
| B12 | Recarregar a página não apaga o histórico: o servidor reenvia os últimos 40 estados de cada personagem, só para a ficha (ninguém anda). | `server/server.mjs` (`history`, `replay`) | 🔎 |
| B13 | Caminho de arquivo do Windows num servidor Linux ou Mac vira só o nome do arquivo. | `claude-code.mjs` (`base`) | ✅ (no GitHub) |

## C. Página: sala, sessões e ficha

| # | Regra | Onde | Prova hoje |
|---|-------|------|------------|
| C1 | A equipe de IA vem **desligada**: sem campo de tarefa, sem tela de conectar IA, sem descrever negócio. Liga e desliga pelo menu; a chave e o negócio ficam guardados. | `02-mundo.js` (`aiTeamOn`), `25-configuracao.js` | 🔎 |
| C2 | Com a equipe desligada, a primeira visita abre a sala de dev pronta, e o negócio salvo no servidor não toma a sala. | `02-mundo.js` (`tplClaude`), `25-configuracao.js` (`setupInit`) | 🔎 |
| C3 | Sessões do Claude Code nunca entram no escritório salvo no navegador. | `02-mundo.js` (`save`) | 🔎 |
| C4 | A sessão aberta fica na sala; só sai quando termina. | `27-entregas-menu.js` | 🔎 |
| C5 | A gaveta Equipe separa as sessões do Claude Code da equipe do negócio; com a equipe desligada (ou sem tarefa delegada), a equipe do negócio fica recolhida. | `27-entregas-menu.js` (`renderTeamDrawer`) | 🔎 |
| C6 | Clicar num personagem abre a ficha com o que ele está fazendo agora, onde, o tempo em cada atividade e o histórico com hora. Vale para todos, não só no modo desenvolvedor. | `23-ficha-render.js` | 🔎 |
| C7 | "Limpar a sala" (equipe desligada) troca só a sala deste navegador pela sala de dev; nada é apagado no servidor. | `27-entregas-menu.js` (`m-reset`) | 🔎 |
| C8 | Nenhum `confirm`, `alert` ou `prompt` do navegador. Toda ação que apaga ou troca algo pede confirmação na janela própria, com o foco começando em "Cancelar". | `20-toast-gaveta.js` (`askConfirm`) | 🔎 (dá para virar teste automático) |
| C9 | No menu, a linha separadora só aparece entre grupos com item visível. | `27-entregas-menu.js` (`tidyMenuLines`) | 🔎 |
| C10 | A experiência normal é toda em 3D: o 2D só aparece sozinho sem WebGL (ou com `?2d`) e nunca pisca antes do 3D ao abrir. | `00-base.js`, `js3d/cena3d.js` | 🔎 |

## D. Editor da sala

| # | Regra | Onde | Prova hoje |
|---|-------|------|------------|
| D1 | A sala tem exatamente uma porta de entrada, encostada numa parede externa (esquerda ou fundo), com piso livre na frente. Ela não pode ser apagada. | `17-entrada.js` | 🔎 |
| D2 | Móvel não fica fora do piso nem em cima de outro móvel ou parede; girar não pode fazê-lo sair do piso. | `17-entrada.js` | 🔎 |
| D3 | A sala que o dono montou nunca é refeita sozinha. | `25-configuracao.js` (`setupInit`) | 🔎 |
| D4 | Todo móvel do catálogo tem modelo 3D, com geometria dentro da área dele. | `js3d/moveis3d.js` | ✅ `moveis3d.test.mjs` |

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
| ✅ Com teste automático (inclui parciais) | 35 |
| 🔎 Só conferidas à mão | 15, quase todas da página (C e D), onde não há teste de interface |
| ❌ Sem prova | 3 (A4, A5, G3), mais partes de A2, A7, E5 e E9 |
| ⚠️ Divergência conhecida | 1 (E10) |

<h1 align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/img/logo-dark.svg">
    <img alt="Floorwalk" src="docs/img/logo-light.svg" width="440">
  </picture>
</h1>

**Ande pela sala e veja seus agentes de IA trabalhando.** Cada sessão do Claude Code que você roda vira um personagem
num escritório 3D e vai ao móvel que combina com o que ela está fazendo de verdade: a mesa quando edita, a estante
quando lê, o rack de servidores quando publica, e levanta um alerta quando precisa da sua permissão.

[English](README.md)

![Demonstração: começando de uma sala vazia, uma mesa é colocada no piso e arrastada para outro lugar; um personagem ganha cabelo, roupa e acessórios novos; depois as sessões do Claude Code entram pela porta, uma faz git push e vai ao rack de servidores, e um clique num personagem abre a ficha com o tempo por atividade e o histórico.](docs/img/demo.gif)

<sub>[Ver em MP4](docs/img/demo.mp4) · versão completa, 76 segundos</sub>

> Estado: primeira versão aberta. Funciona no Windows, macOS e Linux com Node 22.9 ou mais novo.
> A interface segue o idioma do navegador (inglês ou português); dá para trocar no menu (☰ → Language / Idioma).

## Começo rápido

Você precisa do [Node.js](https://nodejs.org) 22.9 ou mais novo e do [Claude Code](https://claude.com/claude-code).

**1. Suba o servidor** (é ele que mostra a sala no navegador):

```bash
git clone https://github.com/efesodavila/Floorwalk.git
cd Floorwalk
npm install
npm start
```

Abra http://127.0.0.1:8787. O escritório abre com uma sala de dev pronta; dá para mudar depois.

**2. Ligue o Claude Code** com o plugin, em outro terminal (ele instala os hooks para você, sem editar nada à mão):

```bash
claude plugin marketplace add efesodavila/Floorwalk
claude plugin install floorwalk@floorwalk
```

Depois abra uma sessão **nova** do Claude Code em qualquer projeto (as que já estavam abertas não aparecem). Ela entra
pela porta. Sem chave de API e sem conta.

<details>
<summary>Prefere não usar o plugin? Instale os hooks à mão</summary>

```bash
npm run hooks:install     # põe os hooks no ~/.claude/settings.json (guarda uma cópia antes)
npm run hooks:status      # mostra se estão ligados
npm run hooks:uninstall   # tira só as entradas do Floorwalk
```

Os hooks apontam para esta pasta. Se for mover ou apagar a pasta, rode `npm run hooks:uninstall` antes, ou
`npm run hooks:install` de novo depois de mover. Use o plugin ou os hooks à mão, não os dois (o instalador recusa quando o
plugin está ligado, para os eventos não chegarem em dobro).
</details>

| o Claude Code está… | na sala |
|---------------------|---------|
| editando ou criando arquivos | trabalha no computador |
| lendo, buscando, pesquisando na web | vai à estante ou à poltrona |
| rodando testes ou lint | revisando |
| fazendo `git push`, deploy ou publicação | vai ao rack de servidores |
| planejando ou delegando a subagentes | vai ao quadro (ou à mesa de reunião) |
| pedindo permissão | fica bloqueado, com alerta |
| esperando sua resposta | aguardando |
| terminou o turno | comemora |
| sessão encerrada | sai da sala |

Clique num personagem para abrir a ficha: o que está fazendo agora, onde, o tempo em cada atividade e o histórico das
ações com a hora.

## Está funcionando?

O aviso no canto inferior esquerdo da página diz:

- **Esperando a primeira sessão do Claude Code**: tudo certo. Abra uma sessão nova.
- **Falta ligar o Claude Code**: instale o plugin (ou os hooks à mão).
- **Os hooks apontam para uma pasta que não existe mais**: a pasta mudou de lugar. Rode `npm run hooks:install` de novo.
- **Sem conexão com o servidor**: o servidor parou. Rode `npm start`.
- **N sessões abertas · Último evento há 5s**: os eventos estão chegando.

Outras coisas que podem dar errado:

- **`Port 8787 is already in use`**: o Floorwalk (ou outro programa) já está rodando nessa porta. Abra a página, ou use
  outra porta: `PORT=8790 npm start` (ou ponha `PORT=8790` num arquivo `.env`, veja o `.env.example`).
- **`Floorwalk needs Node 22.9 or newer`**: instale a versão LTS atual em [nodejs.org](https://nodejs.org).
- **A sessão nunca aparece**: tem de ser uma sessão aberta depois de instalar o plugin ou os hooks, e o `node` precisa
  estar no PATH que o Claude Code enxerga (o hook roda `node`).

As mensagens do terminal são em inglês, como o README principal.

## Segurança e privacidade

Tudo fica no seu computador. O hook manda cada evento só para `127.0.0.1`, com uma senha que o servidor cria
(o "token", em `~/.floorwalk/hook.json`, que só você lê; apague o arquivo e o servidor cria outro).

**O que o hook manda:** o id da sessão, o nome do evento, a pasta do projeto, o nome da ferramenta e, da entrada da
ferramenta, o caminho do arquivo, o padrão ou termo de busca, a URL, o comando e a descrição dele, além das mensagens de
aviso do Claude Code. **O que ele nunca manda:** os seus pedidos, o conteúdo dos arquivos e a saída das ferramentas.

O servidor local tira dos comandos tudo o que parece token, chave ou senha antes de mostrar, e corta os longos. O
histórico fica na memória do servidor: continua depois de recarregar a página e some quando o servidor para. A sala que
você monta fica salva no navegador; as sessões nunca entram nela.

O hook nunca atrapalha o Claude Code: não escreve nada, sempre sai com sucesso e volta na hora quando o servidor está
desligado (espera no máximo 1,5 segundo um servidor que demora a responder).

O servidor só atende pedidos endereçados ao seu próprio computador (`localhost` ou um IP), o que impede outro site de se
passar por ele (DNS rebinding). Para acessar por um nome (proxy, Tailscale), liste o nome em `FLOORWALK_ALLOWED_HOSTS`.

O instalador à mão (`npm run hooks:install`) mexe no `~/.claude/settings.json`, que também guarda as suas permissões, e
por isso toma cuidado: se o arquivo estiver ilegível ou num formato que ele não conhece, para e não muda nada; antes da
primeira escrita guarda uma cópia (`settings.json.floorwalk.backup`) e nunca a sobrescreve; e só mexe nas próprias entradas.

## O que tem de diferente

- **Cada ação vai ao lugar certo.** O personagem não só digita ou lê: cada tipo de trabalho tem o seu canto na sala, e
  dá para ver de longe quem está publicando, quem travou e quem está pesquisando.
- **Nada para configurar.** Sem chave de API, sem conta, sem nuvem: o servidor roda no seu computador e só atende a ele.
- **O escritório é seu.** Comece da sala pronta ou do zero: móveis, paredes, salas de vidro, pessoas e papéis, tudo em 3D.

## Monte o seu escritório

Menu (☰) → **Editar a sala e as pessoas**. Escolha os móveis no catálogo, solte no piso e ajuste as pessoas, se quiser
personagens fixos além das sessões. Menu → **Restaurar a sala padrão** traz a sala pronta de volta.

| Escolher os móveis | Colocar na sala | Ajustar um personagem |
|---|---|---|
| ![Catálogo de móveis de trabalho: mesa, ilha com 4 lugares, mesa de reunião, recepção](docs/img/editor-catalog.png) | ![Colocando um sofá: o sofá novo aparece sobre um ponto livre do piso, com contorno verde](docs/img/editor-placing.png) | ![Editando um personagem: nome, papel, pele, gênero, cabelo e roupa](docs/img/editor-people.png) |

A iluminação acompanha a hora do dia (ou escolha dia, tarde ou noite no menu):

![O mesmo escritório à noite](docs/img/claude-code-room.jpg)

## Controles

Arrastar com o botão esquerdo gira a sala em passos de 90°, o botão direito (ou Shift + arrastar) move, a roda aproxima
na direção do cursor; setas/WASD também movem. Clique numa pessoa para abrir a ficha. Menu (canto superior direito) →
editar a sala, ou **Como usar (tour)** para um tour curto.

Sem WebGL a página volta para o desenho 2D. `npm run build:single` gera um único arquivo HTML que funciona sem
servidor (`dist/floorwalk.html`, cerca de 10 MB com os modelos 3D; `--sem-modelos` gera cerca de 1 MB).

## Como funciona

```
Claude Code ──hooks──▶ servidor (server/) ──eventos──▶ página (web/, Three.js)
```

O servidor transforma tudo em eventos do [protocolo Floorwalk](docs/PROTOCOLO.md) por WebSocket. Qualquer sistema de
agentes pode falar esse protocolo: mande `{ "agent": "Bia", "state": "trabalhando", "place": "computador" }` e o
personagem vai até um computador.

| pasta | o que tem |
|-------|-----------|
| `web/` | a página: `index.html`, `css/app.css`, `js/` (um arquivo por assunto), `js3d/` (cena 3D, móveis, personagens) |
| `server/` | servidor HTTP + WebSocket, ponte do Claude Code, protocolo |
| `plugin/` | o plugin do Claude Code: script do hook e `hooks.json` |
| `scripts/` | instalador dos hooks à mão, arquivo único, conferências |
| `test/` | `npm test` |
| `docs/` | protocolo e notas de desenvolvimento |

## Limites conhecidos

- O Claude Code é o único agente de código suportado hoje. Codex e Gemini CLI vêm a seguir.
- Subagentes ainda não ganham personagem próprio; a sessão principal vai à mesa de reunião quando delega.
- Um escritório por servidor.
- **Modelos 3D dos personagens** em `web/modelos/` foram gerados no [Meshy](https://www.meshy.ai) num plano pago, que dá
  direito de uso comercial, e são distribuídos com o projeto sob a mesma licença MIT. Quem preferir não usá-los pode
  apagar a pasta: os personagens low-poly feitos em código assumem.

## Contribuir

Veja [CONTRIBUTING.md](CONTRIBUTING.md). Notas de desenvolvimento, decisões e pendências ficam em
[`docs/CONTINUACAO.md`](docs/CONTINUACAO.md).

## Licença

[MIT](LICENSE)

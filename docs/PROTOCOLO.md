# Protocolo Pixel HQ v1

Como qualquer sistema de agentes conta ao escritório o que está acontecendo.
Transporte: WebSocket em `/events`, mensagens JSON, uma por frame (um array também vale).

## Servidor → página

| `type`  | Quando | Campos |
|---------|--------|--------|
| `hello` | ao conectar | `protocol` (1), `server`, `demo` |
| `team`  | ao conectar | `agents: [{ name, role, roleName, kind }]`. A página cria quem não existe, cria papéis novos e corrige o papel de quem existe. |
| `state` | um agente muda o que está fazendo | `agent`, `state`, `task`, `with?`, `detail?`, `run?` |
| `log`   | algo útil sem mudar o estado (resultado de ferramenta) | `agent`, `text`, `run?` |
| `result` | uma pessoa terminou a sua parte | `run`, `agent`, `action` (pesquisar, produzir, revisar, entregar), `title`, `text` (o texto completo) |
| `task`  | a tarefa do usuário muda de situação | `id`, `status`, `text`, `output?`, `folder?`, `error?` |

Uma mensagem **sem `type`** é tratada como `state`, para continuar compatível com o formato antigo
(`{ "agent": "Bia", "state": "codando", "task": "Login" }`).

### `state`

```json
{ "type": "state", "agent": "Bia", "state": "codando", "task": "Tela de login",
  "detail": "Escrevendo src/login.html", "run": "run-lq3x9" }
```

- `agent`: nome **ou** id do personagem. Diferença de maiúsculas é ignorada.
- `state`: um destes. O personagem vai para o lugar indicado.

  | estado | onde o personagem vai |
  |--------|----------------------|
  | `planejando` | quadro kanban (com `with`: mesa de reunião) |
  | `trabalhando` | mesa de trabalho, de preferência a mesma de antes |
  | `revisando` | até a pessoa em `with`; sem ninguém, uma mesa |
  | `pesquisando` | estante ou poltrona |
  | `reuniao` | mesa de reunião, junto de quem está em `with` |
  | `entregando` | ponto de entrega: rack de servidores, impressora ou mesa |
  | `aguardando` | copa ou sofá |
  | `bloqueado` | vai pedir ajuda a alguém de papel tipo `coordena` e volta com alerta |
  | `concluido` | comemora onde está; depois fica livre sozinho |
  | `ocioso` | circula pela sala |
  | `offline` | descansa no sofá, apagado |

  Os estados são fixos porque cada um aponta para um lugar da sala. O nome que aparece na
  tela muda por ambiente: numa software house, `trabalhando` aparece como "Codando".

  Nomes antigos continuam aceitos (`codando` e `testando` → `trabalhando`, `deploy` → `entregando`),
  assim como sinônimos em inglês (`working`, `review`, `delivering`, `blocked`, `done`, `idle`…).
- `task`: rótulo curto, até 60 caracteres. Aparece na lista da equipe e na ficha.
- `with`: nomes de outros agentes envolvidos. Obrigatório em `reuniao`.
- `detail`: o que exatamente está acontecendo ("Lendo README.md"). Vai para o histórico da ficha.
- `run`: id da tarefa do usuário. Liga o passo à seção **Missão** da ficha.
- `place` (opcional): **onde** aquilo é feito. A pessoa vai ao elemento que serve para isso;
  sem `place`, vale o lugar padrão do estado. Se o lugar não existir na sala ou não tiver acesso,
  ela usa o próximo elemento da lista.

  | `place` | elementos, em ordem de preferência | para quê |
  |---------|------------------------------------|----------|
  | `computador` | mesa de trabalho, ilha | escrever, programar, planilhas, respostas |
  | `quadro` | quadro kanban | planejar, organizar etapas |
  | `reuniao` | mesa de reunião | conversar e decidir em grupo |
  | `leitura` | estante, poltrona | estudar, consultar referências |
  | `painel` | TV com gráficos, mesa de reunião | analisar números e resultados |
  | `estudio` | fundo chroma | gravar vídeo, foto, áudio |
  | `recepcao` | balcão de recepção | atender clientes |
  | `impressora` | impressora | imprimir documentos |
  | `servidores` | rack de servidores | publicar, colocar no ar |
  | `atendimento` | maca, cadeira de salão, balança | examinar e atender pessoas |
  | `cozinha` | bancada de cozinha, fogão | cozinhar |
  | `estoque` | prateleira de estoque, arara, mesa de embalagem | separar e embalar produtos |
  | `loja` | caixa, vitrine | vender e cobrar |
  | `oficina` | bancada de ferramentas, cavalete | consertar, montar, pintar |
  | `p_…` | móvel criado pela IA para este escritório | a finalidade dada a ele |

### Papéis e tipos

Cada ambiente tem seus próprios papéis (`role` é o id, `roleName` o nome na tela). O que muda o
comportamento no escritório é o **tipo** (`kind`), que é sempre um destes:

| tipo | papel no escritório |
|------|--------------------|
| `coordena` | organiza o trabalho; quem fica bloqueado vai até ele |
| `produz` | faz o trabalho principal |
| `revisa` | confere o que os outros produziram |
| `pesquisa` | busca informação e referências |
| `entrega` | publica, envia ou entrega o resultado |

```json
{ "type": "team", "agents": [
  { "name": "Ana", "role": "direcao", "roleName": "Direção de arte", "kind": "coordena" },
  { "name": "Bia", "role": "redacao", "roleName": "Redação", "kind": "produz" } ] }
```

### `task`

`status` segue esta ordem: `na_fila` → `em_andamento` → `concluida`, `erro` **ou** `cancelada`.
Em `concluida`, `output` traz o resumo final e `folder` a pasta onde as entregas foram salvas.

## Página → servidor

```json
{ "type": "task", "id": "run-lq3x9", "text": "Criar a tela de login e publicar" }
```

`id` é opcional: o servidor cria um se faltar. Texto com até 2000 caracteres.
O servidor responde com mensagens `task` usando o mesmo `id`. Para cancelar:

```json
{ "type": "cancel", "id": "run-lq3x9" }
```

## Regras de convivência

- **Ritmo.** Agentes reais mudam de estado em milissegundos. O emissor deve segurar cada estado
  por alguns segundos (a ponte usa `MIN_DWELL_MS`, 3,5 s por padrão), senão o personagem
  troca de destino antes de sair do lugar. Isso atrasa a imagem em relação à realidade; o
  resultado final não muda.
- **Tarefas em paralelo.** A ponte de referência roda até 2 tarefas ao mesmo tempo (`PIXELHQ_PARALELO`;
  1 volta ao comportamento antigo, uma por vez). Pedidos além disso entram na fila (máx. 5).
  Mensagens `state`, `log`, `result` e `task` de tarefas diferentes chegam intercaladas: use `run`
  para saber a que tarefa cada uma pertence. Cada agente faz uma coisa por vez — se duas tarefas
  precisam da mesma pessoa, a segunda espera ela ficar livre.
- **Internet.** Na pesquisa, a ponte pode buscar na web e ler páginas (só leitura). O agente aparece
  em `pesquisando` com `detail` "Buscando: …" e "Lendo <site>". O texto final cita as fontes como
  [1], [2] e termina com "Fontes:". Liga e desliga no menu (**Pesquisa na internet**) ou com
  `PIXELHQ_WEB=0`.
- **Origem.** O WebSocket só aceita a página servida pelo próprio servidor. Sem isso,
  qualquer site aberto no seu navegador poderia mandar tarefas e gastar sua chave.

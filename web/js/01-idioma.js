'use strict';

/* ---------- Idioma da interface (inglês ou português) ----------
   O código e os dados estão em português. Em inglês, esta camada traduz:
   1) os dados do catálogo pelo id (móveis, estados, papéis, pisos…), logo depois de 01-catalogo.js;
   2) o que aparece na tela: um observador troca cada texto que está no dicionário EN (frase exata) ou casa com um
      padrão de EN_RE (frases com nome de arquivo, número, pessoa). Nomes de pessoas, arquivos e comandos não são
      tocados: só muda o que está no dicionário.
   Idioma: menu ☰ → Language / Idioma (floorwalk.lang); sem escolha, o do navegador (pt* → português; o resto, inglês). */
const LANG = (() => {
  try { const s = localStorage.getItem('floorwalk.lang'); if (s === 'pt' || s === 'en') return s; } catch {}
  const l = String((navigator.languages && navigator.languages[0]) || navigator.language || 'en').toLowerCase();
  return l.startsWith('pt') ? 'pt' : 'en';
})();
document.documentElement.lang = LANG === 'pt' ? 'pt-BR' : 'en';

/* frases exatas (português → inglês) */
const EN = {
  // carregando, menu, topo
  'Carregando o escritório': 'Loading the office', 'Carregando o escritório…': 'Loading the office…', 'Preparando…': 'Getting ready…',
  'Abrindo a página…': 'Opening the page…', 'Montando a sala…': 'Setting up the room…', 'Conectando ao servidor…': 'Connecting to the server…',
  'Carregando os móveis…': 'Loading the furniture…', 'Escritório em 3D': '3D office',
  'Menu': 'Menu', 'Configurações': 'Settings', 'Equipe': 'Team', 'Como usar (tour)': 'How to use (tour)',
  'Como os personagens se comportam': 'How the characters behave', 'Pesquisa na internet': 'Web research', 'Visual 3D': '3D view',
  'Ferramentas de desenvolvimento': 'Developer tools', 'Roteiro de teste': 'Test script', 'O que mudou': "What's new",
  'Começar do zero…': 'Start over…', 'Ligar a equipe de IA': 'Turn on the AI team', 'Ligar a equipe de IA (tarefas)': 'Turn on the AI team (tasks)',
  'Desligar a equipe de IA': 'Turn off the AI team', 'Descrever o negócio de novo': 'Describe the business again', 'Trocar a IA': 'Change the AI',
  'Editar a sala e as pessoas': 'Edit the room and people', 'Voltar ao trabalho (ao vivo)': 'Back to work (live)',
  'Claude Code · equipe de IA desligada': 'Claude Code · AI team off', 'Sem IA conectada': 'No AI connected', 'Conectar uma IA': 'Connect an AI',
  'Iluminação por horário': 'Lighting by time of day', 'Os agentes podem buscar na web e ler páginas (só leitura)': 'Agents can search the web and read pages (read-only)',
  'Apaga o negócio, a equipe, a sala e o histórico': 'Deletes the business, team, room and history',
  'Iluminação automática: segue o relógio do seu dispositivo': "Automatic lighting: follows your device's clock",
  'Dia': 'Day', 'Tarde': 'Afternoon', 'Noite': 'Night',
  // modos, editor, rodapé
  'Construir': 'Build', 'Ao vivo': 'Live', 'Modo': 'Mode', 'Editor': 'Editor', 'Centralizar': 'Center', 'Concluir edição': 'Done editing',
  'PASSO 1': 'STEP 1', 'PASSO 2': 'STEP 2', 'PASSO 3': 'STEP 3', 'Planta': 'Layout', 'Elementos': 'Items', 'Pessoas': 'People',
  'Desfazer': 'Undo', 'Refazer': 'Redo', 'Desfazer (Ctrl+Z)': 'Undo (Ctrl+Z)', 'Refazer (Ctrl+Shift+Z)': 'Redo (Ctrl+Shift+Z)', 'Mais opções': 'More options',
  'Recolher painel': 'Collapse panel', 'Abrir painel': 'Open panel', 'Expandir': 'Expand', 'Retrair': 'Collapse', 'Reduzir': 'Shrink',
  'Zoom': 'Zoom', 'Afastar': 'Zoom out', 'Aproximar': 'Zoom in', 'Planta do escritório em visão isométrica': 'Isometric office floor plan',
  'Tamanho da sala': 'Room size', 'Use + e − em cada lado, ou clique nos botões + roxos nas bordas da sala.': 'Use + and − on each side, or click the purple + buttons on the room edges.',
  'Piso': 'Floor', 'Onde aplicar o piso': 'Where to apply the floor', 'Na sala toda': 'Whole room', 'Só onde eu pintar': 'Only where I paint',
  'Cor das paredes da sala': 'Room wall color', 'Paredes internas e divisórias': 'Inner walls and partitions',
  'Para dividir a sala em ambientes: paredes, portas, vidro, ripado e painéis.': 'Split the room into areas: walls, doors, glass, slats and panels.',
  'Abrir paredes e divisórias': 'Open walls and partitions', '8 tipos, em Elementos': '8 types, under Items', 'Formato livre': 'Free shape',
  'Para salas em L ou com recortes, desenhe o piso à mão.': 'For L-shaped or irregular rooms, draw the floor by hand.',
  'Acrescentar piso': 'Add floor', 'Remover piso': 'Remove floor', 'acrescentar piso': 'add floor', 'remover': 'remove',
  'Arraste sobre os pontos da grade para criar piso novo, em qualquer formato.': 'Drag over the grid dots to create new floor, in any shape.',
  'Arraste sobre o piso para tirar quadrados.': 'Drag over the floor to remove squares.',
  'Escolha o piso e arraste sobre a sala para pintar só aquela área.': 'Pick a floor and drag over the room to paint just that area.',
  'Catálogo': 'Catalog', 'Buscar: parede, sofá, mesa…': 'Search: wall, sofa, desk…', 'Buscar elemento': 'Search items', 'Filtrar por tipo': 'Filter by type',
  'Móveis: clique no card e depois na sala. Paredes: clique no card e arraste na sala. Para mudar algo de lugar, arraste na sala.': 'Furniture: click the card, then the room. Walls: click the card and drag in the room. To move something, drag it in the room.',
  'Girar': 'Rotate', 'Duplicar': 'Duplicate', 'Apagar': 'Delete', 'Cor': 'Color', 'Tipo': 'Type', 'Trocar tipo': 'Change type',
  'Cancelar': 'Cancel', 'Concluir': 'Done', 'Tudo certo': 'All good', 'Fechar': 'Close', 'Abrir': 'Open', 'Editar': 'Edit', 'Copiado': 'Copied',
  'Cor trocada': 'Color changed', 'Piso acrescentado': 'Floor added', 'Piso removido': 'Floor removed', 'Piso trocado nessa área': 'Floor changed in this area',
  'Movido': 'Moved', 'Movida': 'Moved', 'Girado': 'Rotated', 'Duplicado ao lado': 'Duplicated next to it', 'arraste para mover': 'drag to move',
  'a equipe entra e sai por aqui · arraste para outra parede': 'people come and go through here · drag to another wall',
  'A sala já tem porta de entrada. Arraste a porta para mudar de lugar.': 'The room already has an entrance. Drag the door to move it.',
  'Esse lugar está fora do piso. Escolha um ponto dentro da sala.': 'That spot is off the floor. Pick a point inside the room.',
  'Esse lugar está ocupado por um móvel ou parede. Solte num espaço livre do piso.': 'That spot is taken by furniture or a wall. Drop it on free floor.',
  'Esse lugar está ocupado. A pessoa voltou para onde estava.': 'That spot is taken. The person went back.',
  'Movido por você e fixado neste lugar': 'Moved by you and pinned here', 'A porta mudou de lugar': 'The door moved',
  'Não dá para soltar fora do piso. Voltou para onde estava.': "Can't drop off the floor. It went back.",
  'A porta precisa ficar encostada numa parede (esquerda ou fundo), com o piso livre na frente.': 'The door must sit against a wall (left or back), with free floor in front.',
  'A porta acompanha a parede. Arraste para mudar de lugar.': 'The door follows the wall. Drag to move it.',
  'Girado ele sairia do piso. Mova para um lugar com mais espaço.': 'Rotated, it would leave the floor. Move it somewhere with more room.',
  'A sala tem uma porta de entrada só.': 'The room has only one entrance.', 'Sem espaço livre ao lado para duplicar': 'No free space next to it to duplicate',
  'A equipe entra e sai pela porta: ela não pode ser apagada. Arraste para outra parede.': "People come and go through the door: it can't be deleted. Drag it to another wall.",
  'A sala não pode ficar menor que isso': "The room can't get smaller than this",
  'Para resolver': 'To fix', 'Começar de novo': 'Start again', 'Modelo: Sala pequena': 'Template: small office', 'Ambiente vazio': 'Empty room',
  'Guardar e abrir': 'Save and open', 'Copiar ambiente': 'Copy room', 'Abrir arquivo de ambiente…': 'Open room file…',
  'Ambiente vazio criado': 'Empty room created', 'Ambiente aberto': 'Room opened', 'Ambiente copiado. Cole num arquivo de texto para guardar.': 'Room copied. Paste it into a text file to keep it.',
  'Não foi possível copiar neste navegador': "Couldn't copy in this browser", 'Esse arquivo não é um ambiente do Floorwalk': "That file isn't a Floorwalk room",
  'Modelo "Sala pequena" carregado': 'Template "small office" loaded', 'Isso troca a sala atual. Clique de novo': 'This replaces the current room. Click again',
  'Arraste sobre o piso para aplicar': 'Drag over the floor to apply',
  // pessoas (editor)
  'Pele': 'Skin', 'Gênero': 'Gender', 'Cabelo': 'Hair', 'Cor do cabelo': 'Hair color', 'Roupa': 'Clothes', 'Cor da roupa': 'Clothes color',
  'Calça': 'Pants', 'Sapato': 'Shoes', 'Acessórios': 'Accessories', 'Papel': 'Role', 'Sem papel': 'No role', 'Sem nome': 'No name',
  'Visual aleatório': 'Random look', 'Visual sorteado': 'Random look applied', 'Mostrar na sala': 'Show in room', 'Nome do agente': 'Agent name',
  'Os eventos encontram o agente por esse nome.': 'Events find the agent by this name.', 'Agentes': 'Agents', 'Adicionar pessoa': 'Add person',
  'Ninguém na equipe ainda.': 'Nobody on the team yet.', 'Ver os agentes trabalhando': 'Watch the agents work', 'Abrir Ao vivo': 'Open Live',
  '← Todas as pessoas': '← All people', 'Clique de novo para remover': 'Click again to remove',
  'Cada pessoa representa um agente do projeto. O tipo do papel decide para onde ela vai (por exemplo, quem está bloqueado procura quem coordena). Arraste na sala para mudar o lugar de partida.': 'Each person is an agent of the project. The role type decides where they go (for example, someone blocked looks for whoever coordinates). Drag in the room to change their starting spot.',
  'No modo Ao vivo, cada evento de um agente vira uma ação na sala: ir para a mesa, para o quadro, para a reunião.': 'In Live mode, every agent event becomes an action in the room: go to the desk, the board, the meeting.',
  // ficha
  'Ficha do agente': 'Agent card', 'Fechar ficha': 'Close card', 'Fechar (Esc)': 'Close (Esc)', 'Agora': 'Now', 'Função': 'Job', 'Fazendo': 'Doing',
  'Tarefa': 'Task', 'Projeto': 'Project', 'Onde': 'Where', 'Por quê': 'Why', 'Com': 'With', 'Nenhuma': 'None',
  'Tempo por atividade': 'Time per activity', 'Ainda sem dados: aparece conforme o trabalho acontece.': 'No data yet: it fills in as work happens.',
  'Números': 'Numbers', 'tarefas concluídas': 'tasks done', 'bloqueios': 'blocks', 'eventos recebidos': 'events received',
  'Histórico': 'History', 'automático': 'automatic', 'Nenhuma ação ainda.': 'No actions yet.', 'Mostrar menos': 'Show less',
  'Voltar à rotina': 'Back to routine', 'Fixar aqui': 'Pin here', 'Enviar evento': 'Send event', 'Parar de seguir': 'Stop following',
  'Seguir com a câmera': 'Follow with the camera', 'Fixado por você neste lugar': 'Pinned here by you', 'Voltou à rotina automática': 'Back to the automatic routine',
  'Sendo movido por você': 'Being moved by you', 'Parado onde você deixou': 'Staying where you left it', 'Ao lado de outra pessoa': 'Next to someone',
  'Andando pela sala': 'Walking around', 'Em pé': 'Standing', 'A caminho': 'On the way',
  'Livre, circulando pela sala': 'Free, walking around the room', 'Fica onde está': 'Stays put', 'Mudando de lugar': 'Moving',
  'Fica onde você deixou': 'Stays where you left it', 'lugar habitual': 'usual spot', 'o livre mais perto': 'the nearest free one',
  // gaveta Equipe / sessões
  'Sessões do Claude Code': 'Claude Code sessions', 'Sessões do Claude Code abertas': 'Open Claude Code sessions',
  'Nenhuma sessão do Claude Code aberta. Abra uma no terminal e ela entra pela porta.': 'No Claude Code session open. Start one in a terminal and it walks in through the door.',
  'As pessoas entram na sala quando uma tarefa delegada precisa delas. Clique para ver a ficha.': 'People walk in when a delegated task needs them. Click to see their card.',
  'Mostrar a equipe': 'Show the team', 'Equipe agora': 'Team now', 'Eventos e decisões': 'Events and decisions', 'Sem eventos': 'No events',
  'Clique num agente, aqui ou na sala, para abrir a ficha com o que ele está fazendo. Arraste alguém para deixar onde quiser.': 'Click an agent, here or in the room, to open their card with what they are doing. Drag someone to leave them anywhere.',
  // avisos do Claude Code
  'Falta ligar o Claude Code: rode npm run hooks:install no terminal e abra uma sessão nova.': 'Claude Code is not connected yet: run npm run hooks:install in a terminal and start a new session.',
  'Pronto. Abra uma sessão do Claude Code: ela entra pela porta.': 'Ready. Start a Claude Code session: it walks in through the door.',
  'O servidor está com código antigo: pare (Ctrl+C) e rode npm start de novo para as melhorias valerem.': 'The server is running old code: stop it (Ctrl+C) and run npm start again to apply the updates.',
  'Desligar a equipe de IA? O campo de tarefa some e a sala passa a mostrar só as sessões do Claude Code. A IA conectada e o negócio continuam guardados.': 'Turn off the AI team? The task field goes away and the room shows only Claude Code sessions. The connected AI and the business stay saved.',
  'Voltar à sala de dev pronta?\n\nA sala que você montou neste navegador é trocada. As sessões do Claude Code continuam.': 'Go back to the ready-made dev room?\n\nThe room you built in this browser is replaced. Claude Code sessions continue.',
  'Só quer ver seus agentes do': 'Just want to watch your', 'trabalhando? Não precisa de chave nem de descrever um negócio.': 'agents work? No key and no business description needed.',
  'Ver o Claude Code sem IA': 'Watch Claude Code without an AI',
  // janelas de confirmação e menu
  'Confirmar': 'Confirm', 'Desligar': 'Turn off', 'Limpar a sala…': 'Clear the room…', 'Limpar a sala?': 'Clear the room?', 'Limpar a sala': 'Clear the room',
  'Volta à sala de dev pronta': 'Back to the ready-made dev room', 'Apagar tudo': 'Delete everything', 'Começar do zero?': 'Start over?',
  'A sala que você montou neste navegador volta a ser a sala de dev pronta. As sessões do Claude Code continuam.': 'The room you built in this browser goes back to the ready-made dev room. Claude Code sessions continue.',
  'Apaga o negócio atual: a equipe, a sala que você montou e o histórico de tarefas. Não dá para desfazer. Continuam: a IA conectada e os arquivos que os agentes já entregaram.': 'Deletes the current business: the team, the room you built and the task history. This cannot be undone. Kept: the connected AI and the files the agents already delivered.',
  'Desligar a equipe de IA?': 'Turn off the AI team?',
  'O campo de tarefa some e a sala passa a mostrar só as sessões do Claude Code. A IA conectada e o negócio continuam guardados.': 'The task field goes away and the room shows only Claude Code sessions. The connected AI and the business stay saved.',
  // tour
  'Pular': 'Skip', 'Voltar': 'Back', 'Próximo': 'Next', 'Começar': 'Start',
  'Bem-vindo ao seu escritório': 'Welcome to your office', 'Passo 1 · Planta': 'Step 1 · Layout', 'Passo 2 · Elementos': 'Step 2 · Items',
  'Passo 3 · Pessoas': 'Step 3 · People', 'Olhar a sala': 'Look around', 'Terminou de montar?': 'Done building?', 'Pedir trabalho à equipe': 'Ask the team for work',
  'A IA montou a equipe do seu negócio. Agora é a sua vez de montar o lugar onde ela trabalha. Este tour leva um minuto.': "The AI put together your business team. Now it's your turn to build the place where they work. This tour takes a minute.",
  'Mude o tamanho da sala (botões + e −, ou os + roxos nas bordas), o piso e a cor das paredes. Aqui também se desenham paredes internas, portas, vidro e divisórias: escolha o tipo e arraste no piso.': 'Change the room size (+ and − buttons, or the purple + on the edges), the floor and the wall color. This is also where you draw inner walls, doors, glass and partitions: pick the type and drag on the floor.',
  'Escolha um móvel na lista e clique no piso para colocar. Arraste para mudar de lugar. Clique num móvel para girar, trocar a cor ou apagar. Monte com o que o seu negócio usa: é para esses móveis que a equipe vai.': 'Pick a piece of furniture from the list and click the floor to place it. Drag to move it. Click it to rotate, recolor or delete. Use what your work needs: that furniture is where the team goes.',
  'Sua equipe aparece aqui. Mude a aparência, o papel e onde cada pessoa começa. Fora desta aba, os avatares saem da frente para você montar a sala.': 'Your team shows up here. Change each person’s look, role and starting spot. Outside this tab, the avatars step aside so you can build the room.',
  // rótulos de estado usados pelos escritórios prontos
  'Codando': 'Coding', 'Fazendo deploy': 'Deploying', 'Atuando': 'Working', 'Concluiu': 'Done',
};
/* trechos com tags (o elemento inteiro tem este HTML) */
const EN_HTML = {
  '<b>Construir</b>: você monta a sala. <b>Ao vivo</b>: a equipe trabalha e você acompanha. Você pode trocar a qualquer hora.': '<b>Build</b>: you set up the room. <b>Live</b>: the team works and you watch. Switch any time.',
  '<b>Desfazer</b> (Ctrl+Z) e <b>Refazer</b>. O aviso ao lado mostra se algum móvel ficou sem passagem ou encavalado.': '<b>Undo</b> (Ctrl+Z) and <b>Redo</b>. The notice next to them shows if furniture is blocked or overlapping.',
  'Arraste com o botão <b>esquerdo</b> para girar a sala e com o <b>direito</b> para mover. A roda do mouse aproxima. Setas ou W A S D também movem. <b>Centralizar</b> volta ao começo.': 'Drag with the <b>left</b> button to rotate the room and with the <b>right</b> one to move it. The mouse wheel zooms. Arrows or W A S D also move. <b>Center</b> resets the view.',
  '<b>Concluir edição</b> leva para o modo Ao vivo. Dá para voltar e mexer depois.': '<b>Done editing</b> takes you to Live mode. You can come back and change things later.',
  'No Ao vivo, escreva o que a equipe deve fazer e clique em <b>Delegar</b>. A IA divide em passos, cada pessoa vai até o móvel certo e você vê tudo acontecer. O resultado aparece nas entregas.': 'In Live mode, write what the team should do and click <b>Delegate</b>. The AI splits it into steps, each person goes to the right furniture and you watch it happen. The result shows up in deliveries.',
  'Equipe, trocar a IA, pesquisa na internet, rever este tour e <b>começar do zero</b>.': 'Team, change the AI, web research, replay this tour and <b>start over</b>.',
  'Comece pela <b>Planta</b> e depois coloque os <b>Elementos</b>. Bom trabalho!': 'Start with the <b>Layout</b>, then place the <b>Items</b>. Have fun!',
};
/* frases com partes variáveis (arquivo, comando, pessoa, número); null = deixa como está */
const EN_RE = [
  // detalhes que o servidor manda das sessões do Claude Code (server/claude-code.mjs)
  [/^Editando arquivos$/, 'Editing files'], [/^Editando (.+)$/, 'Editing $1'], [/^Lendo arquivos$/, 'Reading files'], [/^Lendo (.+)$/, 'Reading $1'],
  [/^Buscando (.+)$/, 'Searching $1'], [/^Procurando arquivos$/, 'Looking for files'], [/^Pesquisando na internet$/, 'Searching the web'],
  [/^Pesquisando (.+)$/, 'Searching $1'], [/^Publicando: (.+)$/, 'Shipping: $1'], [/^Testando: (.+)$/, 'Testing: $1'],
  [/^Rodando um comando$/, 'Running a command'], [/^Rodando: (.+)$/, 'Running: $1'], [/^Delegando: (.+)$/, 'Delegating: $1'],
  [/^Organizando as etapas$/, 'Organizing the steps'], [/^Fazendo uma pergunta a você$/, 'Asking you a question'], [/^Usando (.+)$/, 'Using $1'],
  [/^Trabalhando$/, 'Working'], [/^Sessão iniciada$/, 'Session started'], [/^Sessão retomada$/, 'Session resumed'], [/^Pensando no seu pedido$/, 'Thinking about your request'],
  [/^Falhou: (.+)$/, 'Failed: $1'], [/^Pedindo permissão: (.+)$/, 'Asking permission: $1'], [/^Pedindo permissão$/, 'Asking permission'],
  [/^Esperando sua resposta$/, 'Waiting for your answer'], [/^Subagente começou: (.+)$/, 'Subagent started: $1'], [/^Subagente começou$/, 'Subagent started'],
  [/^Subagente terminou$/, 'Subagent finished'], [/^Turno concluído$/, 'Turn done'], [/^Sessão encerrada$/, 'Session ended'], [/^Sessão sem atividade$/, 'Session idle'],
  // decisões e lugares (13-sim-agentes, 21-ficha)
  [/^há (.+)$/, 'for $1'], [/^A caminho: (.+)$/, 'On the way: $1'], [/^Voltou para a mesa: (.+)$/, 'Back to the desk: $1'],
  [/^Sem (.+) na sala\. Fica onde está\.$/, 'No $1 in the room. Staying put.'], [/^Vai até (.+)$/, 'Going to $1'],
  [/^Vai pedir ajuda a (.+) \((.+)\)$/, 'Asking $1 ($2) for help'], [/^Livre: (.+)$/, 'Free: $1'], [/^não há (.+) livre$/, 'no free $1'],
  [/^Saindo: parte entregue$/, 'Leaving: part delivered'],
  // editor
  [/^Sala aumentada para (.+)$/, 'Room enlarged toward $1'], [/^Sala diminuída em (.+)$/, 'Room shrunk on $1'], [/^Piso trocado para (.+)$/, 'Floor changed to $1'],
  [/^A sala chegou ao tamanho máximo \((.+)\)$/, 'The room reached its maximum size ($1)'], [/^Tire "(.+)" dessa borda antes de diminuir$/, 'Move "$1" off this edge before shrinking'],
  [/^Tamanho máximo: (.+) quadrados$/, 'Maximum size: $1 squares'], [/^(.+) quadrados · máx\. (.+)$/, '$1 squares · max. $2'],
  [/^quadrados · máx. (.+)$/, 'squares · max. $1'], [/^Paredes da sala: (.+)$/, 'Room walls: $1'], [/^(.+) entrou na equipe\. Arraste para onde quiser\.$/, '$1 joined the team. Drag them anywhere.'],
  [/^(.+) saiu da equipe$/, '$1 left the team'], [/^(.+) mudou de lugar$/, '$1 moved'], [/^(.+) vai ficar aqui\. Para voltar à rotina, use o botão na lista\.$/, '$1 will stay here. To go back to the routine, use the button in the list.'],
  [/^Já tem "(.+)" aí\. Escolha outro lugar\.$/, 'There is already "$1" there. Pick another spot.'], [/^Já tem "(.+)" ali\. Voltou para onde estava\.$/, 'There is "$1" there. It went back.'],
  [/^Girado ele ficaria em cima de "(.+)"$/, 'Rotated, it would sit on top of "$1"'], [/^Esse trecho é curto demais para "(.+)"$/, 'This stretch is too short for "$1"'],
  [/^Trocado para (.+)$/, 'Changed to $1'], [/^Nada encontrado para "(.+)"$/, 'Nothing found for "$1"'],
  [/^Iluminação: (.+)$/, 'Lighting: $1'], [/^Iluminação fixa: (.+)$/, 'Fixed lighting: $1'], [/^(.+) \(fixo\)$/, '$1 (fixed)'],
  [/^(\S+) Dia(.*)$/, '$1 Day$2'], [/^(\S+) Tarde(.*)$/, '$1 Afternoon$2'], [/^(\S+) Noite(.*)$/, '$1 Night$2'],
  [/^Visual 3D indisponível neste navegador \((.+)\)\.?(.*)$/, '3D view unavailable in this browser ($1).$2'],
  [/^Prévia de (.+)$/, 'Preview of $1'], [/^Diminuir para (.+)$/, 'Shrink to $1'], [/^Aumentar para (.+)$/, 'Grow to $1'],
];

function T(s) {
  if (LANG === 'pt' || s == null) return s;
  const k = String(s);
  if (Object.prototype.hasOwnProperty.call(EN, k)) return EN[k];
  for (const [re, r] of EN_RE) if (re.test(k)) return r == null ? k : k.replace(re, (...g) => r.replace(/\$(\d)/g, (_, i) => T(g[i]) ?? ''));
  return k;
}

/* 1) dados do catálogo, pelo id */
if (LANG === 'en') {
  const set = (obj, map, field = 'n') => { for (const [k, v] of Object.entries(map)) if (obj?.[k]) obj[k][field] = v; };
  const setPairs = (arr, map) => { for (const p of arr || []) if (map[p[0]]) p[1] = map[p[0]]; };
  set(ITEMS, { desk: 'Desk', island: 'Island with 4 stations', meeting: 'Meeting table (7 seats)', reception: 'Reception desk', coffee: 'Coffee bar',
    fridge: 'Drinks fridge', stool: 'High stool', sofa: 'Sofa', armchair: 'Armchair', pouf: 'Pouf', ctable: 'Coffee table', rug: 'Colorful rug', palm: 'Palm',
    planter: 'Planter', plantshelf: 'Plant shelf', softbox: 'Softbox light', tripod: 'Camera on tripod', chroma: 'Green screen', colorlight: 'Color light',
    floorlamp: 'Floor lamp', lowshelf: 'Low bookshelf', vase: 'Tall vase', tv: 'TV with chart', kanban: 'Kanban board', rack: 'Server rack', printer: 'Printer',
    maca: 'Exam table', balanca: 'Scale', cadeira_salao: 'Barber chair with mirror', bancada_cozinha: 'Kitchen counter', fogao: 'Industrial stove',
    arara: 'Clothes rack', estoque: 'Stock shelf', vitrine: 'Display case', caixa: 'Checkout counter', sapateira: 'Shoe rack', bancada_oficina: 'Tool bench',
    cavalete: 'Easel', mesa_embalagem: 'Packing table', capacho: 'Entrance door' });
  set(WALLKINDS, { alvenaria: 'Wall', porta: 'Wall with door', janela: 'Wall with window', meia: 'Half wall', vidro: 'Glass partition', vidro_porta: 'Glass with door', ripado: 'Slatted partition', biombo: 'Acoustic panel' });
  set(WALLKINDS, { alvenaria: 'Full height, up to the ceiling', porta: 'Door in the middle of the stretch', janela: 'Glass strip in the middle', meia: 'Waist-high wall',
    vidro: 'Floor to ceiling', vidro_porta: 'Glass with a door in the middle', ripado: 'Open wooden slats', biombo: 'Low felt panel' }, 'd');
  set(MATS, { lilas: 'Original lilac', porcelanato: 'Porcelain tile', madeira_clara: 'Light wood', madeira_escura: 'Dark wood', salvia: 'Sage vinyl',
    cimento: 'Polished concrete', grafite: 'Graphite carpet', azul: 'Blue carpet', xadrez: 'Checkered tile' });
  const RN = { planejando: 'Planning', trabalhando: 'Working', revisando: 'Reviewing', pesquisando: 'Researching', reuniao: 'In a meeting', entregando: 'Delivering',
    aguardando: 'Waiting', bloqueado: 'Blocked', concluido: 'Done', ocioso: 'Free', offline: 'Offline' };
  const RB = Object.fromEntries(Object.keys(RN).map(k => [k, RULES[k]?.base])); // nome original, para saber se o escritório trocou o rótulo
  set(RULES, RN);
  set(RULES, { planejando: 'Goes to the kanban board. With other people, everyone goes to the same meeting table.', trabalhando: 'Sits at a desk, preferably one used before.',
    revisando: 'Goes to the person whose work is being reviewed. With nobody named, uses a desk.', pesquisando: 'Goes to the bookshelf or reading armchair.',
    reuniao: 'Everyone in the meeting goes to the same meeting table.', entregando: 'Goes to the delivery point: server rack, printer or, without them, the desk.',
    aguardando: 'Waits in the kitchen or on the sofa.', bloqueado: 'Asks whoever coordinates for help and goes back to the desk with the alert.',
    concluido: 'Celebrates where they are, then becomes free.', ocioso: 'Walks around: coffee, sofa, plants, reading.', offline: 'Rests on the sofa, dimmed.' }, 'does');
  set(KINDS, { coordena: 'Coordinates', produz: 'Produces', atende: 'Serves', opera: 'Operates', revisa: 'Reviews', pesquisa: 'Researches', entrega: 'Delivers' });
  set(KINDS, { coordena: 'Organizes the work and helps whoever is blocked.', produz: 'Does the main work.', atende: 'Deals with customers: sales, checkout, reception, support.',
    opera: 'Keeps the place running: stock, restocking, cleaning, maintenance.', revisa: 'Checks what others produced.', pesquisa: 'Looks up information and references.',
    entrega: 'Publishes, sends or delivers the result.' }, 'does');
  set(ROLES_GENERIC, { coordenacao: 'Coordination', producao: 'Production', atendimento: 'Customer service', operacao: 'Operations', revisao: 'Review', pesquisa: 'Research', entrega: 'Delivery' });
  set(ROLES_SOFTWARE, { orquestrador: 'Orchestrator', dev: 'Development', revisor: 'Review', qa: 'Testing', pesquisa: 'Research', devops: 'Infra and deploy', design: 'Design' });
  for (const k of Object.keys(LABELS_SOFTWARE)) LABELS_SOFTWARE[k] = T(LABELS_SOFTWARE[k]);
  const AN = { care: 'Exam table, chair or scale', cook: 'Kitchen', stock: 'Stock', sell: 'Checkout counter', craft: 'Workshop bench', attend: 'Reception', work: 'Desk',
    meeting: 'Meeting table', plan: 'Kanban board', read: 'Bookshelf or armchair', relax: 'Sofa or pouf', coffee: 'Coffee bar', fridge: 'Fridge', infra: 'Server rack',
    plants: 'Plants', print: 'Printer', tv: 'TV', record: 'Studio', film: 'Studio light or camera' };
  for (const [k, v] of Object.entries(AN)) if (k in AFFN) AFFN[k] = v;
  set(PLACES, { computador: 'needs a computer', quadro: 'organize on the board', reuniao: 'talk as a group', leitura: 'study and look things up', painel: 'analyze numbers',
    estudio: 'record', recepcao: 'serve the customer', impressora: 'print', servidores: 'ship to production', atendimento: 'attend to the person', cozinha: 'cook',
    estoque: 'pick and pack products', loja: 'sell at the counter', oficina: 'manual work' }, 'why');
  const AL = { work: ['Working', 'Going to work'], attend: ['Serving', 'Going to reception'], care: ['Attending', 'Going to attend'], cook: ['Cooking', 'Going to the kitchen'],
    stock: ['In the stockroom', 'Going to the stockroom'], sell: ['Selling', 'Going to the counter'], craft: ['At the bench', 'Going to the bench'],
    meeting: ['In a meeting', 'Going to the meeting'], coffee: ['Having coffee', 'Going for coffee'], fridge: ['Grabbing a drink', 'Going to the fridge'],
    relax: ['Resting', 'Going to rest'], plants: ['Watering the plants', 'Going to water the plants'], print: ['Printing', 'Going to the printer'],
    record: ['Recording content', 'Going to record'], film: ['Adjusting light and camera', 'Going to the equipment'], tv: ['Checking the numbers', 'Going to the TV'],
    read: ['Reading', 'Going to read'], wander: ['Taking a walk', 'Taking a walk'] };
  for (const [k, [l, g]] of Object.entries(AL)) if (ACTS[k]) { ACTS[k].label = l; ACTS[k].go = g; }
  const CL = { paredes: 'Walls and partitions', trabalho: 'Work', copa: 'Kitchenette', lounge: 'Lounge', plantas: 'Plants', 'estúdio': 'Studio', atendimento: 'Service',
    cozinha: 'Kitchen', 'comércio': 'Retail', oficina: 'Workshop', 'iluminação': 'Lighting', 'decoração': 'Decor', tecnologia: 'Technology' };
  for (const [k, v] of Object.entries(CL)) { if (k in CATLABEL) CATLABEL[k] = v; if (k in CHIPLABEL) CHIPLABEL[k] = k === 'paredes' ? 'Walls' : v; }
  if ('todos' in CHIPLABEL) CHIPLABEL.todos = 'All';
  setPairs(WALLS, { '#D5CED6': 'Light lilac', '#ECE5D6': 'Sand', '#C2D2DE': 'Mist blue', '#CAD8C1': 'Sage', '#EBCBB7': 'Peach', '#3A3C44': 'Graphite' });
  setPairs(HAIRSTYLES, { curto: 'Short', franja: 'Bangs', longo: 'Long', coque: 'Bun', rabo: 'Ponytail', cacheado: 'Curly', raspado: 'Shaved' });
  setPairs(TOPS, { camiseta: 'T-shirt', camisa: 'Shirt', jaqueta: 'Jacket', moletom: 'Hoodie', terno: 'Suit' });
  setPairs(EXTRAS, { cracha: 'Badge', oculos: 'Glasses', fone: 'Headset', barba: 'Beard' });
  setPairs(GENDERS, { f: 'Female', m: 'Male' });
  // os rótulos do escritório (W.labels) entram nos estados em syncCatalog: traduz depois dela (o rótulo padrão vira o nome em inglês)
  const sync0 = syncCatalog;
  syncCatalog = function (...a) {
    const r = sync0.apply(this, a);
    for (const k of Object.keys(RULES)) { const n = RULES[k].n; RULES[k].n = (n === RB[k] || n === RULES[k].base) ? RN[k] || n : T(n); }
    return r;
  };
}

/* 2) o que aparece na tela */
if (LANG === 'en') {
  const ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];
  const HTML_KEYS = new Map(Object.entries(EN_HTML).map(([k, v]) => [k.replace(/\s+/g, ' '), v]));
  const trText = (n) => {
    const v = n.nodeValue; if (!v || !/[A-Za-zÀ-ú]/.test(v)) return;
    const core = v.trim(), t = T(core);
    if (t !== core) { const i = v.indexOf(core); n.nodeValue = v.slice(0, i) + t + v.slice(i + core.length); }
  };
  const trAttrs = (el) => { for (const a of ATTRS) { const v = el.getAttribute?.(a); if (v) { const t = T(v.trim()); if (t !== v.trim()) el.setAttribute(a, t); } } };
  const trEl = (el) => {
    if (el.nodeType === 3) return trText(el);
    if (el.nodeType !== 1 || el.closest?.('[data-no-i18n]')) return;
    for (const e of [el, ...el.querySelectorAll('*')]) {
      trAttrs(e);
      if (e.children.length) { const h = HTML_KEYS.get(e.innerHTML.replace(/\s+/g, ' ').trim()); if (h) e.innerHTML = h; }
    }
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) if (!n.parentElement?.closest('script,style,textarea,[data-no-i18n]')) trText(n);
  };
  const start = () => {
    trEl(document.body);
    new MutationObserver((ms) => {
      for (const m of ms) {
        if (m.type === 'characterData') trText(m.target);
        else if (m.type === 'attributes') trAttrs(m.target);
        else for (const n of m.addedNodes) trEl(n);
      }
    }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  };
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
  // caixas do navegador (confirm/alert) também passam pelo dicionário
  const c0 = window.confirm.bind(window), a0 = window.alert.bind(window);
  window.confirm = (m) => c0(T(m)); window.alert = (m) => a0(T(m));
}

/* troca de idioma (menu ☰): guarda e recarrega */
function setLang(l) { try { localStorage.setItem('floorwalk.lang', l); } catch {} location.reload(); }

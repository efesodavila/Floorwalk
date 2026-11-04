// Lugares do escritório e para que servem. A IA escolhe um por passo da tarefa;
// a página leva a pessoa até o elemento certo (mesma lista em web/js/01-catalogo.js, PLACES).
import { CATALOG } from './furniture.mjs';

const hasExtra = (s, place) => (s.extras || []).some(id => CATALOG[id]?.place === place);

export const PLACES = {
  computador: { desc: 'mesa com computador: escrever, programar, montar planilhas, documentos e respostas' },
  quadro:     { desc: 'quadro kanban: planejar, organizar etapas e prioridades' },
  reuniao:    { desc: 'mesa de reunião: conversar e decidir em grupo' },
  leitura:    { desc: 'estante e poltrona: estudar, ler, consultar referências' },
  painel:     { desc: 'TV com gráficos: analisar números, métricas, vendas e resultados' },
  estudio:    { desc: 'estúdio: gravar vídeo, foto, áudio ou podcast', needs: (s) => !!s.areas?.studio },
  recepcao:   { desc: 'recepção: atender e conversar com clientes', needs: (s) => !!s.areas?.reception },
  impressora: { desc: 'impressora: imprimir e preparar documentos físicos', needs: (s) => s.delivery === 'impressora' },
  servidores: { desc: 'servidores: publicar, colocar no ar, mexer em sistemas', needs: (s) => s.delivery !== 'impressora' },
  atendimento: { desc: 'maca, cadeira ou balança: examinar, atender e cuidar de uma pessoa', needs: (s) => hasExtra(s, 'atendimento') },
  cozinha:    { desc: 'bancada e fogão: preparar e cozinhar alimentos', needs: (s) => hasExtra(s, 'cozinha') },
  estoque:    { desc: 'estoque: separar, conferir e embalar produtos e pedidos', needs: (s) => hasExtra(s, 'estoque') },
  loja:       { desc: 'balcão e vitrine: vender, cobrar e mostrar produtos', needs: (s) => hasExtra(s, 'loja') },
  oficina:    { desc: 'bancada de oficina: consertar, montar e trabalhos manuais', needs: (s) => hasExtra(s, 'oficina') },
};

// lugares que existem neste escritório
// + os lugares dos móveis criados pela IA para este escritório (p_…)
// Móvel da sala → lugar. Quando a página manda a sala real (spec.room), ela decide; sem isso, vale o escritório montado.
const ITEM_PLACE = {
  desk: 'computador', island: 'computador', reception: 'recepcao', meeting: 'reuniao', kanban: 'quadro', tv: 'painel',
  lowshelf: 'leitura', armchair: 'leitura', floorlamp: 'leitura', printer: 'impressora', rack: 'servidores',
  chroma: 'estudio', softbox: 'estudio', tripod: 'estudio', colorlight: 'estudio',
};
const placeOfItem = (id) => ITEM_PLACE[id] || CATALOG[id]?.place || null;
export const placesFor = (spec) => {
  const custom = (spec.custom || []).map(c => c.place);
  if (Array.isArray(spec.room) && spec.room.length) {
    const have = new Set(spec.room.map(placeOfItem).filter(Boolean));
    have.add('computador'); // sempre há onde trabalhar (sem mesa, a pessoa trabalha onde está)
    // móvel criado pela IA (c_…) só vale se estiver na sala
    return [...Object.keys(PLACES).filter(k => have.has(k)), ...(spec.custom || []).filter(c => spec.room.includes(c.id)).map(c => c.place)];
  }
  return [...Object.keys(PLACES).filter(k => !PLACES[k].needs || PLACES[k].needs(spec)), ...custom];
};
// a descrição traz os móveis que EXISTEM neste escritório naquele lugar e para que servem: a IA escreve o pedido do
// passo com a ação concreta ("cortar o cabelo"), e a página usa essas palavras para levar a pessoa ao móvel certo
export const placeDesc = (k, spec) => {
  if (PLACES[k]) {
    const here = [...new Set(spec?.room || spec?.extras || [])].filter(id => CATALOG[id]?.place === k).map(id => `${CATALOG[id].name} (${CATALOG[id].for})`);
    return PLACES[k].desc + (here.length ? ` — móveis: ${here.join('; ')}` : '');
  }
  const c = (spec?.custom || []).find(x => x.place === k); return c ? `${c.name}: ${c.purpose}` : k;
};

// Sem indicação da IA: palavras do pedido, depois o padrão da ação.
const HINTS = [
  ['atendimento', /\b(consulta|exame|examinar|procedimento|avalia(r|ção) (o|a) paciente|corte de cabelo|maquiag|pesar|medir|sessão)/i],
  ['cozinha', /\b(cozinh|receita|prato|cardápio|cardapio|refeição|refeicao|assar|marmita|doce|bolo)/i],
  ['estoque', /\b(estoque|embal|separar (o |os )?pedido|despach|invent[aá]rio|reposição|reposicao)/i],
  ['loja', /\b(vender|venda no balcão|cobrar|caixa|vitrine|promoção na loja)/i],
  ['oficina', /\b(consert|reparo|reparar|montar (o|a|um|uma) |ferrament|pintar|artesan|marcenar)/i],
  ['estudio', /\b(grav|vídeo|video|foto|filmag|podcast|reels|stories|áudio|audio)/i],
  ['painel', /\b(métric|metric|indicador|kpi|dashboard|vendas|faturamento|resultado|número|numero|gráfico|grafico|relatório de desempenho)/i],
  ['recepcao', /\b(atend|cliente|paciente|agend|recep)/i],
  ['impressora', /\b(imprim|impress|cópia física|panfleto)/i],
  ['servidores', /\b(deploy|publicar no ar|colocar no ar|servidor|hospedag|produção)/i],
  ['quadro', /\b(planej|cronograma|prioriz|organizar|roadmap|etapas)/i],
  ['leitura', /\b(pesquis|estud|ler |leitura|referênc|artigo|livro)/i],
];
const BY_ACTION = { pesquisar: 'leitura', produzir: 'computador', revisar: 'computador', entregar: null };

export function guessPlace(text, action, available) {
  for (const [place, re] of HINTS) if (available.includes(place) && re.test(text)) return place;
  if (action === 'entregar') return ['servidores', 'impressora', 'recepcao'].find(p => available.includes(p)) || 'computador';
  return BY_ACTION[action] || 'computador';
}

export const validPlace = (p, available) => (available.includes(p) ? p : null);

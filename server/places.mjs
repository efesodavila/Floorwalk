// Lugares do escritório e para que servem: o "place" de uma mensagem state leva a pessoa ao móvel certo
// (mesma lista em web/js/01-catalogo.js, PLACES; test/protocol.test.mjs confere).
export const PLACES = {
  computador: { desc: 'mesa com computador: escrever, programar, montar planilhas, documentos e respostas' },
  quadro:     { desc: 'quadro kanban: planejar, organizar etapas e prioridades' },
  reuniao:    { desc: 'mesa de reunião: conversar e decidir em grupo' },
  leitura:    { desc: 'estante e poltrona: estudar, ler, consultar referências' },
  painel:     { desc: 'TV com gráficos: analisar números, métricas, vendas e resultados' },
  estudio:    { desc: 'estúdio: gravar vídeo, foto, áudio ou podcast' },
  recepcao:   { desc: 'recepção: atender e conversar com clientes' },
  impressora: { desc: 'impressora: imprimir e preparar documentos físicos' },
  servidores: { desc: 'servidores: publicar, colocar no ar, mexer em sistemas' },
  atendimento: { desc: 'maca, cadeira ou balança: examinar, atender e cuidar de uma pessoa' },
  cozinha:    { desc: 'bancada e fogão: preparar e cozinhar alimentos' },
  estoque:    { desc: 'estoque: separar, conferir e embalar produtos e pedidos' },
  loja:       { desc: 'balcão e vitrine: vender, cobrar e mostrar produtos' },
  oficina:    { desc: 'bancada de oficina: consertar, montar e trabalhos manuais' },
};

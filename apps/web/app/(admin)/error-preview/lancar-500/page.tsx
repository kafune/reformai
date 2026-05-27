/**
 * Rota auxiliar que força um erro em tempo de render para testar o error.tsx.
 * Acesse /error-preview/lancar-500 e o error boundary captura automaticamente.
 */
export default function Lancar500Page() {
  throw new Error('Erro de teste gerado intencionalmente via /error-preview/lancar-500')
}

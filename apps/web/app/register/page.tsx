import { redirect } from "next/navigation"

/**
 * O autocadastro de morador é feito exclusivamente via link/QR code
 * gerado pelo síndico em /sindico/cadastro.
 * Acesso direto a esta rota redireciona para o login.
 */
export default function RegisterPage() {
  redirect("/login")
}

import { redirect } from "next/navigation"

/**
 * O autocadastro de morador é feito exclusivamente via link/QR code
 * gerado pelo síndico em /sindico/cadastro.
 * Links antigos de cadastro por condomínio redirecionam para o login
 * com banner informativo.
 */
export default function RegisterCondominiumPage() {
  redirect("/login?info=cadastro-por-convite")
}

import type { Metadata } from "next";
import { FormularioLogin } from "./formulario";

export const metadata: Metadata = { title: "Ingresar · LavaSmart" };

// No hay enlace de "crear cuenta": las cuentas las crea el dueño.
export default function PaginaLogin() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-8 px-6 py-16">
      <div>
        <h1 className="text-3xl font-semibold">LavaSmart</h1>
        <p className="mt-1 text-zinc-500">AquaBrillo · Ingresa con tu cuenta</p>
      </div>
      <FormularioLogin />
    </main>
  );
}

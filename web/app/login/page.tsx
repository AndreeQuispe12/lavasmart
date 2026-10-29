import type { Metadata } from "next";
import Image from "next/image";
import { FormularioLogin } from "./formulario";

export const metadata: Metadata = { title: "Ingresar · LavaSmart" };

// La misma presentación del prototipo validado: foto de fondo y una
// tarjeta blanca centrada. No hay enlace de "crear cuenta": las cuentas
// las crea el dueño.
export default function PaginaLogin() {
  return (
    <main className="relative flex flex-1 items-center justify-center px-4 py-16">
      {/* fill + object-cover: la foto cubre toda la pantalla sin deformarse.
          Es decorativa, por eso alt vacío. */}
      <Image
        src="/marca/fondo-login.jpg"
        alt=""
        fill
        priority
        sizes="100vw"
        className="-z-20 object-cover"
      />
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-marca/40 to-marca/70" />

      <div className="flex w-full max-w-sm flex-col gap-6 rounded-2xl bg-white p-8 shadow-2xl">
        <div className="flex flex-col items-center text-center">
          <Image
            src="/marca/logo.png"
            alt="LavaSmart"
            width={64}
            height={64}
            className="rounded-xl"
          />
          <h1 className="mt-3 text-2xl font-bold text-marca">LavaSmart</h1>
          <p className="text-sm text-zinc-500">
            Gestión inteligente para AquaBrillo
          </p>
        </div>
        <FormularioLogin />
      </div>
    </main>
  );
}

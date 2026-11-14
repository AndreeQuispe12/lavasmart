"""Segmentación de clientes con K-Means sobre RFM.

Recorrido:
  1. Lee los lavados entregados hasta --hasta y calcula, por cliente (placa):
       recencia   días desde su última visita,
       frecuencia cuántas veces vino,
       monetario  cuánto pagó en total (lo cobrado, no la tarifa).
  2. Escala las tres variables: sin eso, los soles (decenas o cientos)
     pesarían mucho más que las visitas (1 a 15) al medir distancias.
     Frecuencia y monetario pasan antes por un logaritmo, porque unos pocos
     clientes muy frecuentes estirarían la escala y aplastarían al resto.
  3. Prueba K-Means con 3, 4 y 5 grupos y se queda con el de mejor
     coeficiente de silueta (qué tan separados quedan los grupos).
  4. Pone a cada grupo un nombre de negocio según sus promedios, para que
     el dueño sepa qué hacer con él.
  5. Escribe cada cliente con su segmento y sus tres valores en
     cliente_segmento, y las métricas en modelo_metrica.

Uso (desde ml/):
  .venv\\Scripts\\python segmentacion.py --hasta 2026-11-12          # entrena y guarda
  .venv\\Scripts\\python segmentacion.py --hasta 2026-11-12 --seco   # solo muestra
"""

from __future__ import annotations

import argparse
from datetime import date, timedelta

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
from sklearn.preprocessing import StandardScaler

from comun import LIMA, Supabase, hoy_en_lima

GRUPOS_A_PROBAR = (3, 4, 5)
SEMILLA = 2026


def leer_rfm(db: Supabase, hasta: date) -> pd.DataFrame:
    filas = db.leer(
        "lavado",
        select="cliente_id,fecha_hora_entrega,monto_cobrado",
        estado="eq.entregado",
        order="id",
    )
    if not filas:
        raise SystemExit("No hay lavados entregados: no hay clientes que segmentar.")
    lavados = pd.DataFrame(filas)
    # El día de la visita se cuenta en hora de Lima. ISO8601 porque unas
    # horas vienen con fracciones de segundo y otras no.
    lavados["dia"] = (
        pd.to_datetime(lavados["fecha_hora_entrega"], utc=True, format="ISO8601")
        .dt.tz_convert(LIMA)
        .dt.date
    )
    lavados = lavados[lavados["dia"] <= hasta]
    lavados["monto_cobrado"] = lavados["monto_cobrado"].astype(float)

    rfm = lavados.groupby("cliente_id").agg(
        ultima=("dia", "max"),
        frecuencia=("dia", "size"),
        monetario=("monto_cobrado", "sum"),
    )
    rfm["recencia"] = [(hasta - d).days for d in rfm["ultima"]]
    return rfm[["recencia", "frecuencia", "monetario"]]


def preparar(rfm: pd.DataFrame) -> np.ndarray:
    datos = np.column_stack(
        [rfm["recencia"], np.log1p(rfm["frecuencia"]), np.log1p(rfm["monetario"])]
    )
    return StandardScaler().fit_transform(datos)


def nombrar(perfiles: pd.DataFrame) -> dict[int, str]:
    """Nombre de negocio para cada grupo, a partir de sus promedios.

    El de más visitas son los frecuentes. Entre los demás, el que hace más
    tiempo no viene son los inactivos; el que casi siempre vino una sola vez
    y hace menos de mes y medio son los nuevos; el resto, ocasionales. Si
    sobra más de un grupo, se distinguen por su gasto.
    """
    nombres: dict[int, str] = {}
    restantes = perfiles.copy()

    frecuentes = restantes["frecuencia"].idxmax()
    nombres[frecuentes] = "Frecuentes"
    restantes = restantes.drop(frecuentes)

    inactivos = restantes["recencia"].idxmax()
    if restantes.loc[inactivos, "recencia"] > 30:
        nombres[inactivos] = "Inactivos"
        restantes = restantes.drop(inactivos)

    if not restantes.empty:
        nuevos = restantes["frecuencia"].idxmin()
        if restantes.loc[nuevos, "frecuencia"] < 1.5 and restantes.loc[nuevos, "recencia"] <= 45:
            nombres[nuevos] = "Nuevos"
            restantes = restantes.drop(nuevos)

    ocasionales = restantes.sort_values("monetario", ascending=False).index
    for posicion, grupo in enumerate(ocasionales):
        if len(ocasionales) == 1:
            nombres[grupo] = "Ocasionales"
        else:
            nombres[grupo] = "Ocasionales de mayor gasto" if posicion == 0 else "Ocasionales"
    return nombres


def main() -> None:
    argumentos = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    argumentos.add_argument("--hasta", type=date.fromisoformat,
                            default=hoy_en_lima() - timedelta(days=1))
    argumentos.add_argument("--seco", action="store_true",
                            help="Entrena y muestra, pero no escribe en la base.")
    args = argumentos.parse_args()

    db = Supabase()
    rfm = leer_rfm(db, args.hasta)
    if len(rfm) < 30:
        raise SystemExit(f"Solo hay {len(rfm)} clientes: muy pocos para agrupar.")
    datos = preparar(rfm)

    # --- 1. Elegir el número de grupos por silueta -------------------------
    siluetas = {}
    modelos = {}
    for k in GRUPOS_A_PROBAR:
        modelo = KMeans(n_clusters=k, n_init=20, random_state=SEMILLA).fit(datos)
        siluetas[k] = float(silhouette_score(datos, modelo.labels_))
        modelos[k] = modelo
    k = max(siluetas, key=siluetas.get)
    rfm["grupo"] = modelos[k].labels_

    # --- 2. Perfil y nombre de cada grupo -----------------------------------
    perfiles = rfm.groupby("grupo")[["recencia", "frecuencia", "monetario"]].mean()
    perfiles["clientes"] = rfm.groupby("grupo").size()
    nombres = nombrar(perfiles)
    rfm["segmento"] = rfm["grupo"].map(nombres)
    perfiles["segmento"] = perfiles.index.map(nombres)

    version = f"kmeans{k}-{hoy_en_lima().isoformat()}"

    # --- Informe -------------------------------------------------------------
    print(f"Clientes con al menos una visita hasta {args.hasta}: {len(rfm)}")
    print("\nCoeficiente de silueta (más alto = grupos más separados):")
    for grupos, valor in siluetas.items():
        marca = "  <- elegido" if grupos == k else ""
        print(f"  {grupos} grupos  {valor:.3f}{marca}")
    print(f"\nSegmentos (versión {version}):")
    print(f"  {'segmento':<28}{'clientes':>9}{'recencia':>10}{'visitas':>9}{'gasto S/':>10}")
    for _, p in perfiles.sort_values("frecuencia", ascending=False).iterrows():
        print(f"  {p['segmento']:<28}{int(p['clientes']):>9}{p['recencia']:>9.0f}d"
              f"{p['frecuencia']:>9.1f}{p['monetario']:>10.0f}")

    if args.seco:
        print("\n--seco: no se escribió nada en la base.")
        return

    # --- 3. Escribir resultados ---------------------------------------------
    db.guardar(
        "cliente_segmento",
        [
            {
                "cliente_id": int(cliente),
                "segmento": fila["segmento"],
                "recencia_dias": int(fila["recencia"]),
                "frecuencia": int(fila["frecuencia"]),
                "monetario": round(float(fila["monetario"]), 2),
                "modelo_version": version,
            }
            for cliente, fila in rfm.iterrows()
        ],
        conflicto="cliente_id,modelo_version",
    )
    db.guardar(
        "modelo_metrica",
        [
            {"modelo": "kmeans", "version": version, "metrica": nombre,
             "valor": round(valor, 3), "filas_entrenamiento": len(rfm)}
            for nombre, valor in [("Silueta", siluetas[k]), ("Grupos", k)]
        ],
        conflicto="modelo,version,metrica",
    )
    print(f"\nGuardado: {len(rfm)} clientes segmentados y 2 métricas (versión {version}).")


if __name__ == "__main__":
    main()

"""Predicción de demanda: cuántos autos se esperan cada día.

Recorrido:
  1. Lee los autos entregados por día desde v_caja_dia.
  2. Describe cada día con lo que se sabe de él de antemano: el día de la
     semana, si es día de pago (quincena y fin de mes), si es feriado y
     cuánto tiempo pasó desde el inicio (la tendencia).
  3. Compara tres candidatos como se usarían de verdad, semana a semana:
     cada una de las últimas 4 semanas se predice solo con lo anterior a
     ella. Los candidatos son la referencia (el promedio de cada día de la
     semana), una regresión lineal Ridge y un Random Forest.
  4. Elige el de menor error, lo entrena con todo y predice los próximos
     14 días, con un intervalo sacado de sus errores en esas 4 semanas.
  5. Escribe la predicción en prediccion_demanda y las métricas en
     modelo_metrica. El tablero y la pantalla de inicio las leen solas.

Uso (desde ml/):
  .venv\\Scripts\\python demanda.py --hasta 2026-11-12          # entrena y guarda
  .venv\\Scripts\\python demanda.py --hasta 2026-11-12 --seco   # solo muestra

--hasta es el último día completo que se usa. Por defecto, ayer en Lima.
"""

from __future__ import annotations

import argparse
from datetime import date, timedelta

import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator, RegressorMixin
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import Ridge

from comun import Supabase, hoy_en_lima

HORIZONTE = 14  # días que se predicen hacia adelante
SEMANAS_DE_PRUEBA = 4  # semanas finales que se predicen una a una para medir el error
SEMILLA = 2026

# Feriados nacionales del Perú en 2026.
FERIADOS = {
    date(2026, 1, 1), date(2026, 4, 2), date(2026, 4, 3), date(2026, 5, 1),
    date(2026, 6, 7), date(2026, 6, 29), date(2026, 7, 23), date(2026, 7, 28),
    date(2026, 7, 29), date(2026, 8, 6), date(2026, 8, 30), date(2026, 10, 8),
    date(2026, 11, 1), date(2026, 12, 8), date(2026, 12, 9), date(2026, 12, 25),
}
DIAS = ["lun", "mar", "mie", "jue", "vie", "sab", "dom"]


def variables(fechas: pd.DatetimeIndex, inicio: pd.Timestamp) -> pd.DataFrame:
    """Lo que se sabe de un día antes de que ocurra.

    El día de la semana va en columnas de 0/1 (one-hot) y no como un número
    del 0 al 6: el viernes no está "entre" el jueves y el sábado en cuanto a
    autos, y así cada modelo lo trata como una categoría propia.
    """
    tabla = pd.DataFrame(index=fechas)
    for numero, nombre in enumerate(DIAS):
        tabla[nombre] = (fechas.day_of_week == numero).astype(int)
    tabla["dia_de_pago"] = fechas.day.isin([14, 15, 16, 29, 30, 31, 1]).astype(int)
    tabla["feriado"] = [int(f.date() in FERIADOS) for f in fechas]
    tabla["tendencia"] = (fechas - inicio).days / 30  # meses desde el inicio
    return tabla


class PromedioPorDia(BaseEstimator, RegressorMixin):
    """La referencia: predice el promedio de autos de ese día de la semana.

    Si un modelo no la supera, no vale la pena usarlo.
    """

    def fit(self, x: pd.DataFrame, y: pd.Series):
        dia = x[DIAS].values.argmax(axis=1)
        self.promedios_ = pd.Series(np.asarray(y)).groupby(dia).mean()
        return self

    def predict(self, x: pd.DataFrame) -> np.ndarray:
        dia = x[DIAS].values.argmax(axis=1)
        return self.promedios_.reindex(dia).values


CANDIDATOS = {
    "referencia": PromedioPorDia,
    # Ridge: regresión lineal con una penalización suave, estable con pocos datos.
    "ridge": lambda: Ridge(alpha=1.0),
    # Bosque con árboles poco profundos para no memorizar el ruido de cada fecha.
    "random_forest": lambda: RandomForestRegressor(
        n_estimators=300, max_depth=5, min_samples_leaf=3, random_state=SEMILLA
    ),
}


def leer_demanda(db: Supabase, hasta: date) -> pd.Series:
    filas = db.leer(
        "v_caja_dia",
        select="fecha,autos_entregados",
        fecha=f"lte.{hasta.isoformat()}",
        order="fecha",
    )
    if not filas:
        raise SystemExit("v_caja_dia no tiene días: no hay histórico que entrenar.")
    datos = pd.DataFrame(filas)
    serie = pd.Series(
        datos["autos_entregados"].astype(float).values,
        index=pd.to_datetime(datos["fecha"]),
    )
    # Un día sin entregas no aparece en la vista: es un día con 0 autos.
    dias = pd.date_range(serie.index.min(), pd.Timestamp(hasta), freq="D")
    return serie.reindex(dias, fill_value=0.0)


def probar_semana_a_semana(nombre: str, x: pd.DataFrame, y: pd.Series) -> np.ndarray:
    """Predice cada una de las últimas semanas solo con los días anteriores.

    Es lo que hará el proceso real: entrenar el lunes con lo que hay y
    predecir la semana. Devuelve los errores (real - predicho) de todos los
    días probados.
    """
    errores = []
    for semana in range(SEMANAS_DE_PRUEBA, 0, -1):
        corte = len(y) - 7 * semana
        modelo = CANDIDATOS[nombre]().fit(x.iloc[:corte], y.iloc[:corte])
        predicho = modelo.predict(x.iloc[corte:corte + 7])
        errores.extend(y.iloc[corte:corte + 7].values - predicho)
    return np.array(errores)


def main() -> None:
    argumentos = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    argumentos.add_argument("--hasta", type=date.fromisoformat,
                            default=hoy_en_lima() - timedelta(days=1))
    argumentos.add_argument("--seco", action="store_true",
                            help="Entrena y muestra, pero no escribe en la base.")
    args = argumentos.parse_args()

    db = Supabase()
    serie = leer_demanda(db, args.hasta)
    if len(serie) < 7 * (SEMANAS_DE_PRUEBA + 4):
        raise SystemExit(f"Solo hay {len(serie)} días: hacen falta al menos {7 * (SEMANAS_DE_PRUEBA + 4)}.")

    inicio = serie.index.min()
    x = variables(serie.index, inicio)
    y = serie

    # --- 1. Comparar candidatos semana a semana -----------------------------
    resultados = {}
    for nombre in CANDIDATOS:
        errores = probar_semana_a_semana(nombre, x, y)
        reales = y.iloc[-7 * SEMANAS_DE_PRUEBA:].values
        resultados[nombre] = {
            "errores": errores,
            "MAE": float(np.mean(np.abs(errores))),
            "RMSE": float(np.sqrt(np.mean(errores ** 2))),
            "MAPE %": float(np.mean(np.abs(errores) / np.maximum(reales, 1)) * 100),
        }
    elegido = min(resultados, key=lambda n: resultados[n]["MAE"])
    mejor = resultados[elegido]
    mae_referencia = resultados["referencia"]["MAE"]
    mejora = (1 - mejor["MAE"] / mae_referencia) * 100
    # El 80 % de los errores de la prueba cae dentro de este margen.
    margen = float(np.quantile(np.abs(mejor["errores"]), 0.8))

    # --- 2. Modelo final con todos los días y predicción -------------------
    modelo = CANDIDATOS[elegido]().fit(x, y)
    futuras = pd.date_range(pd.Timestamp(args.hasta) + pd.Timedelta(days=1),
                            periods=HORIZONTE, freq="D")
    estimado = np.clip(modelo.predict(variables(futuras, inicio)), 0, None)
    version = f"{elegido}-{hoy_en_lima().isoformat()}"

    # --- Informe -------------------------------------------------------------
    print(f"Histórico: {inicio.date()} a {args.hasta} ({len(serie)} días, {int(serie.sum())} autos).")
    print(f"\nPrueba semana a semana (las últimas {SEMANAS_DE_PRUEBA}, cada una con lo anterior):")
    print(f"  {'candidato':<15}{'MAE':>7}{'RMSE':>7}{'MAPE':>8}")
    for nombre, r in resultados.items():
        marca = "  <- elegido" if nombre == elegido else ""
        print(f"  {nombre:<15}{r['MAE']:7.2f}{r['RMSE']:7.2f}{r['MAPE %']:7.1f}%{marca}")
    print(f"  Mejora del elegido frente a la referencia: {mejora:.0f} %")
    if elegido == "ridge":
        print("\nEfecto de cada variable (autos por día, regresión lineal):")
        for nombre, coef in zip(x.columns, modelo.coef_):
            print(f"  {nombre:<12} {coef:+6.2f}")
    print(f"\nPróximos {HORIZONTE} días (versión {version}, intervalo ±{margen:.1f}):")
    for fecha, valor in zip(futuras, estimado):
        print(f"  {fecha.date()} {DIAS[fecha.day_of_week]}  {valor:5.1f} autos")

    if args.seco:
        print("\n--seco: no se escribió nada en la base.")
        return

    # --- 3. Escribir resultados ---------------------------------------------
    db.guardar(
        "prediccion_demanda",
        [
            {
                "fecha_objetivo": f.date().isoformat(),
                "vehiculos_estimados": round(float(v), 1),
                "intervalo_inferior": round(max(float(v) - margen, 0), 1),
                "intervalo_superior": round(float(v) + margen, 1),
                "modelo_version": version,
            }
            for f, v in zip(futuras, estimado)
        ],
        conflicto="fecha_objetivo,modelo_version",
    )
    db.guardar(
        "modelo_metrica",
        [
            {"modelo": "regresion", "version": version, "metrica": nombre,
             "valor": round(valor, 2), "filas_entrenamiento": len(serie)}
            for nombre, valor in [
                ("MAE", mejor["MAE"]),
                ("RMSE", mejor["RMSE"]),
                ("MAPE %", mejor["MAPE %"]),
                ("MAE referencia", mae_referencia),
                ("Mejora %", mejora),
            ]
        ],
        conflicto="modelo,version,metrica",
    )
    print(f"\nGuardado: {HORIZONTE} predicciones y 5 métricas (versión {version}).")


if __name__ == "__main__":
    main()
